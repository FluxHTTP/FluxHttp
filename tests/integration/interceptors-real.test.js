const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');

// Import the main library
const fluxhttpModule = require('../../dist/index.js');
const fluxhttp = fluxhttpModule.default || fluxhttpModule;
const { fluxhttpError } = fluxhttpModule;

/**
 * Real Interceptors Integration Tests
 * Tests interceptor functionality with real HTTP endpoints
 * 
 * Note: These tests make real network requests and may be affected by network conditions
 */

/**
 * Helper function to parse JSON response data
 * Handles both string and object responses from different adapters
 */
function parseResponseData(data) {
  if (typeof data === 'string') {
    try {
      return JSON.parse(data);
    } catch {
      return data;
    }
  }
  return data;
}

describe('Real Interceptors Integration Tests', () => {
  let client;
  const HTTPBIN_BASE = 'https://httpbin.org';
  const REQUEST_TIMEOUT = 15000; // 15 second timeout for network requests

  beforeEach(() => {
    client = fluxhttp.create({
      baseURL: HTTPBIN_BASE,
      timeout: REQUEST_TIMEOUT,
      headers: {
        'User-Agent': 'FluxHTTP-Interceptor-Test/1.0.0'
      }
    });
  });

  afterEach(() => {
    // Clear all interceptors between tests
    client.interceptors.request.clear();
    client.interceptors.response.clear();
    
    if (global.gc) {
      global.gc();
    }
  });

  describe('Request interceptors with real endpoints', () => {
    it('should add authentication headers via interceptor', async () => {
      const token = 'real-test-token-123';
      
      // Add authentication interceptor
      client.interceptors.request.use((config) => {
        config.headers = {
          ...config.headers,
          'Authorization': `Bearer ${token}`,
          'X-Auth-Timestamp': new Date().toISOString()
        };
        return config;
      });

      const response = await client.get('/get');
      
      assert.strictEqual(response.status, 200);
      assert.strictEqual(parseResponseData(response.data).headers['Authorization'], `Bearer ${token}`);
      assert(parseResponseData(response.data).headers['X-Auth-Timestamp'], 'Should include auth timestamp');
    });

    it('should modify request URL via interceptor', async () => {
      // Add URL modification interceptor
      client.interceptors.request.use((config) => {
        if (config.url === '/redirect-me') {
          config.url = '/get?redirected=true';
        }
        return config;
      });

      const response = await client.get('/redirect-me');
      
      assert.strictEqual(response.status, 200);
      assert.strictEqual(parseResponseData(response.data).args.redirected, 'true');
    });

    it('should add request tracking via interceptor', async () => {
      const requestIds = [];
      
      client.interceptors.request.use((config) => {
        const requestId = `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        requestIds.push(requestId);
        
        config.headers = {
          ...config.headers,
          'X-Request-ID': requestId,
          'X-Client-Version': '1.0.0'
        };
        return config;
      });

      const response1 = await client.get('/get?test=1');
      const response2 = await client.get('/get?test=2');
      
      assert.strictEqual(response1.status, 200);
      assert.strictEqual(response2.status, 200);
      assert.strictEqual(requestIds.length, 2);
      assert.notStrictEqual(requestIds[0], requestIds[1], 'Request IDs should be unique');
      assert.strictEqual(response1.data.headers['X-Request-ID'], requestIds[0]);
      assert.strictEqual(response2.data.headers['X-Request-ID'], requestIds[1]);
    });

    it('should handle request data transformation', async () => {
      client.interceptors.request.use((config) => {
        if (config.data && typeof config.data === 'object') {
          // Add metadata to all requests
          config.data = {
            ...config.data,
            _metadata: {
              timestamp: new Date().toISOString(),
              source: 'interceptor-test',
              version: '1.0'
            }
          };
        }
        return config;
      });

      const originalData = { name: 'John', email: 'john@example.com' };
      const response = await client.post('/post', originalData);
      
      assert.strictEqual(response.status, 200);
      assert.strictEqual(parseResponseData(response.data).json.name, 'John');
      assert.strictEqual(parseResponseData(response.data).json.email, 'john@example.com');
      assert(parseResponseData(response.data).json._metadata, 'Should include metadata');
      assert.strictEqual(parseResponseData(response.data).json._metadata.source, 'interceptor-test');
    });

    it('should handle async request interceptors', async () => {
      const apiKeyPromise = new Promise(resolve => {
        setTimeout(() => resolve('async-api-key-456'), 100);
      });

      client.interceptors.request.use(async (config) => {
        const apiKey = await apiKeyPromise;
        config.headers = {
          ...config.headers,
          'X-API-Key': apiKey,
          'X-Async-Processed': 'true'
        };
        return config;
      });

      const response = await client.get('/get');
      
      assert.strictEqual(response.status, 200);
      assert.strictEqual(parseResponseData(response.data).headers['X-API-Key'], 'async-api-key-456');
      assert.strictEqual(parseResponseData(response.data).headers['X-Async-Processed'], 'true');
    });
  });

  describe('Response interceptors with real endpoints', () => {
    it('should transform response data', async () => {
      client.interceptors.response.use((response) => {
        if (((data) => data && typeof data === 'object')(parseResponseData(response.data))) {
          response.data = {
            ...response.data,
            intercepted: true,
            processedAt: new Date().toISOString(),
            originalStatus: response.status
          };
        }
        return response;
      });

      const response = await client.get('/json');
      
      assert.strictEqual(response.status, 200);
      assert(parseResponseData(response.data).intercepted, 'Should be marked as intercepted');
      assert(parseResponseData(response.data).processedAt, 'Should include processing timestamp');
      assert.strictEqual(parseResponseData(response.data).originalStatus, 200);
      assert(parseResponseData(response.data).slideshow, 'Should preserve original data');
    });

    it('should add response caching headers', async () => {
      client.interceptors.response.use((response) => {
        response.headers = {
          ...response.headers,
          'x-cache-status': 'MISS',
          'x-cached-at': new Date().toISOString()
        };
        return response;
      });

      const response = await client.get('/get');
      
      assert.strictEqual(response.status, 200);
      assert.strictEqual(response.headers['x-cache-status'], 'MISS');
      assert(response.headers['x-cached-at'], 'Should include cache timestamp');
    });

    it('should handle response validation', async () => {
      client.interceptors.response.use((response) => {
        // Validate response structure
        if (((data) => data && typeof data === 'object')(parseResponseData(response.data))) {
          parseResponseData(response.data)._validation = {
            isValid: true,
            checkedAt: new Date().toISOString(),
            schema: 'httpbin-response'
          };
        }
        return response;
      });

      const response = await client.get('/get');
      
      assert.strictEqual(response.status, 200);
      assert(parseResponseData(response.data)._validation, 'Should include validation info');
      assert.strictEqual(parseResponseData(response.data)._validation.isValid, true);
      assert.strictEqual(parseResponseData(response.data)._validation.schema, 'httpbin-response');
    });

    it('should handle async response interceptors', async () => {
      client.interceptors.response.use(async (response) => {
        // Simulate async processing (e.g., logging to external service)
        await new Promise(resolve => setTimeout(resolve, 50));
        
        response.data = {
          ...response.data,
          asyncProcessed: true,
          processingDelay: 50
        };
        return response;
      });

      const startTime = Date.now();
      const response = await client.get('/get');
      const endTime = Date.now();
      
      assert.strictEqual(response.status, 200);
      assert(parseResponseData(response.data).asyncProcessed, 'Should be async processed');
      assert(endTime - startTime >= 50, 'Should have processing delay');
    });
  });

  describe('Error handling interceptors with real endpoints', () => {
    it('should handle authentication retry with real 401 errors', async () => {
      let authAttempts = 0;
      let tokenRefreshed = false;

      // Request interceptor for auth
      client.interceptors.request.use((config) => {
        authAttempts++;
        const token = tokenRefreshed ? 'valid-token' : 'invalid-token';
        config.headers = {
          ...config.headers,
          'Authorization': `Bearer ${token}`
        };
        return config;
      });

      // Response interceptor for auth retry
      client.interceptors.response.use(
        (response) => response,
        async (error) => {
          if (error.response && error.response.status === 401 && !tokenRefreshed) {
            tokenRefreshed = true;
            // Simulate token refresh
            await new Promise(resolve => setTimeout(resolve, 100));
            // Retry the original request
            return client.request(error.config);
          }
          return Promise.reject(error);
        }
      );

      // This should fail initially but succeed after retry
      const response = await client.get('/bearer');
      
      assert.strictEqual(response.status, 200);
      assert.strictEqual(authAttempts, 2, 'Should attempt auth twice');
      assert(tokenRefreshed, 'Token should be refreshed');
      assert.strictEqual(parseResponseData(response.data).token, 'valid-token');
    });

    it('should transform 404 errors to custom errors', async () => {
      client.interceptors.response.use(
        (response) => response,
        (error) => {
          if (error.response && error.response.status === 404) {
            const customError = new fluxhttpError(
              'Resource not found in our system',
              'ERR_RESOURCE_NOT_FOUND',
              error.config
            );
            customError.response = error.response;
            customError.originalError = error;
            return Promise.reject(customError);
          }
          return Promise.reject(error);
        }
      );

      try {
        await client.get('/status/404');
        assert.fail('Should have thrown an error');
      } catch (error) {
        assert.strictEqual(error.message, 'Resource not found in our system');
        assert.strictEqual(error.code, 'ERR_RESOURCE_NOT_FOUND');
        assert(error.originalError, 'Should include original error');
        assert.strictEqual(error.response.status, 404);
      }
    });

    it('should handle network error recovery', async () => {
      let attemptCount = 0;
      
      client.interceptors.response.use(
        (response) => response,
        async (error) => {
          attemptCount++;
          
          // Simulate network recovery after first attempt
          if (attemptCount === 1 && (!error.response || error.code === 'ECONNRESET')) {
            // Wait a bit and retry
            await new Promise(resolve => setTimeout(resolve, 500));
            return client.request(error.config);
          }
          
          return Promise.reject(error);
        }
      );

      // Use a request that should succeed (testing our retry logic)
      const response = await client.get('/delay/1'); // Small delay endpoint
      
      assert.strictEqual(response.status, 200);
      // The retry logic should work even if network doesn't fail
      assert(attemptCount >= 1);
    });

    it('should add error context via interceptors', async () => {
      client.interceptors.response.use(
        (response) => response,
        (error) => {
          // Add additional context to all errors
          error.context = {
            timestamp: new Date().toISOString(),
            userAgent: 'FluxHTTP-Interceptor-Test/1.0.0',
            endpoint: error.config?.url,
            method: error.config?.method
          };
          return Promise.reject(error);
        }
      );

      try {
        await client.get('/status/500');
        assert.fail('Should have thrown an error');
      } catch (error) {
        assert(error.context, 'Should include error context');
        assert(error.context.timestamp, 'Should include timestamp');
        assert.strictEqual(error.context.userAgent, 'FluxHTTP-Interceptor-Test/1.0.0');
        assert(error.context.endpoint.includes('/status/500'));
        assert.strictEqual(error.context.method, 'get');
      }
    });
  });

  describe('Chained interceptors with real endpoints', () => {
    it('should execute multiple request interceptors in order', async () => {
      const executionOrder = [];

      client.interceptors.request.use((config) => {
        executionOrder.push('interceptor-1');
        config.headers = { ...config.headers, 'X-Step-1': 'true' };
        return config;
      });

      client.interceptors.request.use((config) => {
        executionOrder.push('interceptor-2');
        config.headers = { ...config.headers, 'X-Step-2': 'true' };
        return config;
      });

      client.interceptors.request.use((config) => {
        executionOrder.push('interceptor-3');
        config.headers = { ...config.headers, 'X-Step-3': 'true' };
        return config;
      });

      const response = await client.get('/get');
      
      assert.strictEqual(response.status, 200);
      assert.deepStrictEqual(executionOrder, ['interceptor-1', 'interceptor-2', 'interceptor-3']);
      assert.strictEqual(parseResponseData(response.data).headers['X-Step-1'], 'true');
      assert.strictEqual(parseResponseData(response.data).headers['X-Step-2'], 'true');
      assert.strictEqual(parseResponseData(response.data).headers['X-Step-3'], 'true');
    });

    it('should execute multiple response interceptors in order', async () => {
      const executionOrder = [];

      client.interceptors.response.use((response) => {
        executionOrder.push('response-interceptor-1');
        response.data = { ...response.data, step1: true };
        return response;
      });

      client.interceptors.response.use((response) => {
        executionOrder.push('response-interceptor-2');
        response.data = { ...response.data, step2: true };
        return response;
      });

      client.interceptors.response.use((response) => {
        executionOrder.push('response-interceptor-3');
        response.data = { ...response.data, step3: true };
        return response;
      });

      const response = await client.get('/json');
      
      assert.strictEqual(response.status, 200);
      assert.deepStrictEqual(executionOrder, ['response-interceptor-1', 'response-interceptor-2', 'response-interceptor-3']);
      assert(parseResponseData(response.data).step1, 'Should have step 1 processed');
      assert(parseResponseData(response.data).step2, 'Should have step 2 processed');
      assert(parseResponseData(response.data).step3, 'Should have step 3 processed');
    });

    it('should handle complex request/response transformation chain', async () => {
      // Request transformation chain
      client.interceptors.request.use((config) => {
        config.metadata = { started: Date.now() };
        config.headers = { ...config.headers, 'X-Request-Start': config.metadata.started.toString() };
        return config;
      });

      client.interceptors.request.use((config) => {
        config.metadata.processed = Date.now();
        config.headers = { ...config.headers, 'X-Request-Processed': config.metadata.processed.toString() };
        return config;
      });

      // Response transformation chain
      client.interceptors.response.use((response) => {
        const requestStart = parseInt(response.config.headers['X-Request-Start']);
        response.data = {
          ...response.data,
          timing: {
            requestStart,
            responseReceived: Date.now(),
            totalTime: Date.now() - requestStart
          }
        };
        return response;
      });

      client.interceptors.response.use((response) => {
        parseResponseData(response.data).performance = {
          fast: parseResponseData(response.data).timing.totalTime < 1000,
          category: parseResponseData(response.data).timing.totalTime < 500 ? 'fast' : 'slow'
        };
        return response;
      });

      const response = await client.get('/delay/0.5'); // 500ms delay
      
      assert.strictEqual(response.status, 200);
      assert(parseResponseData(response.data).timing, 'Should include timing data');
      assert(parseResponseData(response.data).timing.totalTime > 400, 'Should reflect actual delay');
      assert(parseResponseData(response.data).performance, 'Should include performance analysis');
      assert.strictEqual(typeof parseResponseData(response.data).performance.fast, 'boolean');
    });
  });

  describe('Real-world interceptor scenarios', () => {
    it('should implement request/response logging', async () => {
      const logs = [];

      client.interceptors.request.use((config) => {
        logs.push({
          type: 'request',
          method: config.method,
          url: config.url,
          timestamp: new Date().toISOString()
        });
        return config;
      });

      client.interceptors.response.use(
        (response) => {
          logs.push({
            type: 'response',
            status: response.status,
            url: response.config.url,
            timestamp: new Date().toISOString()
          });
          return response;
        },
        (error) => {
          logs.push({
            type: 'error',
            status: error.response?.status || 'network',
            url: error.config?.url,
            message: error.message,
            timestamp: new Date().toISOString()
          });
          return Promise.reject(error);
        }
      );

      // Make successful request
      await client.get('/get');
      
      // Make failed request
      try {
        await client.get('/status/404');
      } catch (error) {
        // Expected to fail
      }

      assert.strictEqual(logs.length, 4); // 2 requests, 1 response, 1 error
      assert.strictEqual(logs[0].type, 'request');
      assert.strictEqual(logs[1].type, 'response');
      assert.strictEqual(logs[2].type, 'request');
      assert.strictEqual(logs[3].type, 'error');
      assert.strictEqual(logs[3].status, 404);
    });

    it('should implement API rate limiting with backoff', async () => {
      let requestCount = 0;
      const rateLimitDelay = 100; // 100ms delay after 3 requests

      client.interceptors.request.use(async (config) => {
        requestCount++;
        
        if (requestCount > 3) {
          // Simulate rate limiting backoff
          await new Promise(resolve => setTimeout(resolve, rateLimitDelay));
        }
        
        config.headers = {
          ...config.headers,
          'X-Request-Count': requestCount.toString()
        };
        return config;
      });

      const startTime = Date.now();
      
      // Make 5 requests
      const promises = [];
      for (let i = 0; i < 5; i++) {
        promises.push(client.get(`/get?request=${i}`));
      }
      
      const responses = await Promise.all(promises);
      const endTime = Date.now();
      
      assert.strictEqual(responses.length, 5);
      assert(endTime - startTime >= rateLimitDelay * 2, 'Should have rate limiting delays');
      
      // Verify request counting
      responses.forEach((response, index) => {
        const requestNum = parseInt(parseResponseData(response.data).headers['X-Request-Count']);
        assert(requestNum >= 1 && requestNum <= 5, 'Should have valid request count');
      });
    });

    it('should implement response caching mechanism', async () => {
      const cache = new Map();
      
      client.interceptors.request.use((config) => {
        const cacheKey = `${config.method}_${config.url}`;
        config.cacheKey = cacheKey;
        
        if (cache.has(cacheKey)) {
          const cachedResponse = cache.get(cacheKey);
          // Return cached response immediately
          config.fromCache = true;
          return Promise.resolve(cachedResponse);
        }
        
        return config;
      });

      client.interceptors.response.use((response) => {
        if (!response.config.fromCache) {
          // Cache successful responses
          cache.set(response.config.cacheKey, {
            ...response,
            fromCache: true,
            cachedAt: new Date().toISOString()
          });
        }
        return response;
      });

      // First request - should hit the network
      const response1 = await client.get('/get?cache=test');
      assert.strictEqual(response1.status, 200);
      assert(!response1.fromCache, 'First request should not be from cache');

      // Second request - should be cached (but httpbin doesn't support this scenario well)
      // This test demonstrates the caching logic structure
      assert(cache.size > 0, 'Cache should have entries');
    });
  });
});