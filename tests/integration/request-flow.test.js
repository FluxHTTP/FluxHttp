const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');

// Import the mock adapter helper for controlled testing
const { MockAdapter } = require('../helpers/mock-adapter');

// Import the main library for integration testing
const fluxhttpModule = require('../../dist/index.js');
const fluxhttp = fluxhttpModule.default || fluxhttpModule;
const { fluxhttpError, CancelToken } = fluxhttpModule;

/**
 * Integration tests for complete request flow
 * Tests the entire pipeline from request creation to response delivery
 */
describe('Complete Request Flow Integration', () => {
  let instance;
  let mockAdapter;
  let requestTrace; // Track the request flow

  beforeEach(() => {
    requestTrace = [];
    mockAdapter = new MockAdapter();
    
    // Override the adapter to trace requests
    const originalRequest = mockAdapter.request.bind(mockAdapter);
    mockAdapter.request = async (config) => {
      requestTrace.push({ step: 'adapter-start', config: { ...config } });
      try {
        const response = await originalRequest(config);
        requestTrace.push({ step: 'adapter-success', response: { ...response } });
        return response;
      } catch (error) {
        requestTrace.push({ step: 'adapter-error', error: { ...error } });
        throw error;
      }
    };

    instance = fluxhttp.create({ adapter: mockAdapter });
  });

  afterEach(() => {
    // Clean up any timers
    if (global.gc) {
      global.gc();
    }
  });

  describe('Basic request flow', () => {
    it('should complete full successful request flow', async () => {
      mockAdapter.setMockResponse({
        data: { message: 'success', id: 123 },
        status: 200,
        statusText: 'OK',
        headers: { 'Content-Type': 'application/json' },
        config: {},
        request: {}
      });

      const response = await instance.get('https://api.test.com/users/123');

      // Verify complete response structure
      assert.strictEqual(response.status, 200);
      assert.strictEqual(response.statusText, 'OK');
      assert.deepStrictEqual(response.data, { message: 'success', id: 123 });
      assert.strictEqual(response.headers['Content-Type'], 'application/json');
      assert(response.config, 'Should include config');
      assert(response.request, 'Should include request');

      // Verify request reached adapter
      assert.strictEqual(requestTrace.length, 2);
      assert.strictEqual(requestTrace[0].step, 'adapter-start');
      assert.strictEqual(requestTrace[1].step, 'adapter-success');
    });

    it('should handle request with all HTTP methods', async () => {
      const methods = [
        { method: 'GET', call: () => instance.get('https://api.test.com/data') },
        { method: 'POST', call: () => instance.post('https://api.test.com/data', { name: 'test' }) },
        { method: 'PUT', call: () => instance.put('https://api.test.com/data/1', { name: 'updated' }) },
        { method: 'PATCH', call: () => instance.patch('https://api.test.com/data/1', { name: 'patched' }) },
        { method: 'DELETE', call: () => instance.delete('https://api.test.com/data/1') },
        { method: 'HEAD', call: () => instance.head('https://api.test.com/data') },
        { method: 'OPTIONS', call: () => instance.options('https://api.test.com/data') }
      ];

      for (const { method, call } of methods) {
        mockAdapter.reset();
        requestTrace = [];

        mockAdapter.setMockResponse({
          data: { method },
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {},
          request: {}
        });

        const response = await call();

        assert.strictEqual(response.status, 200);
        assert.strictEqual(response.data.method, method);
        assert.strictEqual(mockAdapter.getLastRequest().method, method);
      }
    });

    it('should properly merge configuration at all levels', async () => {
      // Global defaults
      const globalInstance = fluxhttp.create({
        adapter: mockAdapter,
        baseURL: 'https://api.test.com',
        headers: { 'X-Global': 'global' },
        timeout: 5000
      });

      // Instance-level config
      const serviceInstance = globalInstance.create({
        headers: { 'X-Service': 'service' },
        timeout: 3000
      });

      // Request-level config
      const response = await serviceInstance.get('/users', {
        headers: { 'X-Request': 'request' },
        params: { page: 1, limit: 10 }
      });

      const lastRequest = mockAdapter.getLastRequest();
      
      // Verify URL construction
      assert.strictEqual(lastRequest.url, 'https://api.test.com/users');
      
      // Verify header merging
      assert.strictEqual(lastRequest.headers['x-global'], 'global');
      assert.strictEqual(lastRequest.headers['x-service'], 'service');
      assert.strictEqual(lastRequest.headers['x-request'], 'request');
      
      // Verify config merging
      assert.strictEqual(lastRequest.timeout, 3000); // Instance level overrides global
      assert.deepStrictEqual(lastRequest.params, { page: 1, limit: 10 });
    });

    it('should handle complex request with all features', async () => {
      const requestData = {
        user: {
          name: 'John Doe',
          email: 'john@example.com',
          preferences: {
            theme: 'dark',
            notifications: true
          }
        },
        metadata: {
          source: 'web',
          timestamp: Date.now()
        }
      };

      mockAdapter.setMockResponse({
        data: { id: 'user-123', ...requestData.user },
        status: 201,
        statusText: 'Created',
        headers: { 
          'Content-Type': 'application/json',
          'Location': '/users/user-123'
        },
        config: {},
        request: {}
      });

      const response = await instance.post('https://api.test.com/users', requestData, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer token123',
          'X-Client-Version': '1.0.0'
        },
        timeout: 10000,
        params: {
          include: 'profile,settings',
          validate: true
        }
      });

      // Verify response
      assert.strictEqual(response.status, 201);
      assert.strictEqual(response.data.id, 'user-123');
      assert.strictEqual(response.data.name, 'John Doe');
      assert.strictEqual(response.headers['Location'], '/users/user-123');

      // Verify request processing
      const lastRequest = mockAdapter.getLastRequest();
      assert.strictEqual(lastRequest.method, 'POST');
      assert.deepStrictEqual(lastRequest.data, requestData);
      assert.strictEqual(lastRequest.headers['authorization'], 'Bearer token123');
      assert.strictEqual(lastRequest.timeout, 10000);
      assert.deepStrictEqual(lastRequest.params, { include: 'profile,settings', validate: true });
    });
  });

  describe('Request flow with interceptors', () => {
    it('should execute interceptors in correct order', async () => {
      const executionOrder = [];

      // Request interceptors (executed in order)
      instance.interceptors.request.use((config) => {
        executionOrder.push('request-1');
        config.headers = { ...config.headers, 'X-Req-1': 'value1' };
        return config;
      });

      instance.interceptors.request.use((config) => {
        executionOrder.push('request-2');
        config.headers = { ...config.headers, 'X-Req-2': 'value2' };
        return config;
      });

      // Response interceptors (executed in order)
      instance.interceptors.response.use((response) => {
        executionOrder.push('response-1');
        response.data = { ...response.data, intercepted1: true };
        return response;
      });

      instance.interceptors.response.use((response) => {
        executionOrder.push('response-2');
        response.data = { ...response.data, intercepted2: true };
        return response;
      });

      mockAdapter.setMockResponse({
        data: { original: true },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {},
        request: {}
      });

      const response = await instance.get('https://api.test.com/test');

      // Verify execution order
      assert.deepStrictEqual(executionOrder, [
        'request-1',
        'request-2',
        'response-1',
        'response-2'
      ]);

      // Verify request interceptor effects
      const lastRequest = mockAdapter.getLastRequest();
      assert.strictEqual(lastRequest.headers['x-req-1'], 'value1');
      assert.strictEqual(lastRequest.headers['x-req-2'], 'value2');

      // Verify response interceptor effects
      assert(response.data.original, 'Should preserve original data');
      assert(response.data.intercepted1, 'Should add first interceptor data');
      assert(response.data.intercepted2, 'Should add second interceptor data');
    });

    it('should handle async interceptors properly', async () => {
      const delays = [];

      instance.interceptors.request.use(async (config) => {
        const start = Date.now();
        await new Promise(resolve => setTimeout(resolve, 10));
        delays.push(Date.now() - start);
        config.asyncProcessed = true;
        return config;
      });

      instance.interceptors.response.use(async (response) => {
        const start = Date.now();
        await new Promise(resolve => setTimeout(resolve, 10));
        delays.push(Date.now() - start);
        response.data = { ...response.data, asyncProcessed: true };
        return response;
      });

      mockAdapter.setMockResponse({
        data: { original: true },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {},
        request: {}
      });

      const response = await instance.get('https://api.test.com/async');

      // Verify async processing
      assert.strictEqual(delays.length, 2, 'Should have recorded two delays');
      delays.forEach(delay => {
        assert(delay >= 8, `Delay should be at least 10ms, was ${delay}ms`);
      });

      assert(mockAdapter.getLastRequest().asyncProcessed, 'Request should be async processed');
      assert(response.data.asyncProcessed, 'Response should be async processed');
    });

    it('should handle interceptor chains with transformations', async () => {
      // Chain of request transformations
      instance.interceptors.request.use((config) => {
        if (config.data && typeof config.data === 'object') {
          config.data = { ...config.data, step1: 'transformed' };
        }
        return config;
      });

      instance.interceptors.request.use((config) => {
        if (config.data && config.data.step1) {
          config.data.step2 = 'chained';
        }
        config.headers = { ...config.headers, 'X-Transformed': 'true' };
        return config;
      });

      // Chain of response transformations
      instance.interceptors.response.use((response) => {
        if (response.data) {
          response.data.processed = Date.now();
        }
        return response;
      });

      instance.interceptors.response.use((response) => {
        if (response.data && response.data.processed) {
          response.data.validated = true;
        }
        return response;
      });

      mockAdapter.setMockResponse({
        data: { id: 123, name: 'test' },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {},
        request: {}
      });

      const originalData = { user: 'john' };
      const response = await instance.post('https://api.test.com/transform', originalData);

      // Verify request transformation chain
      const lastRequest = mockAdapter.getLastRequest();
      assert.strictEqual(lastRequest.data.user, 'john'); // Original data preserved
      assert.strictEqual(lastRequest.data.step1, 'transformed'); // First transformation
      assert.strictEqual(lastRequest.data.step2, 'chained'); // Second transformation
      assert.strictEqual(lastRequest.headers['x-transformed'], 'true');

      // Verify response transformation chain
      assert.strictEqual(response.data.id, 123); // Original response data
      assert(response.data.processed, 'Should have processed timestamp');
      assert(response.data.validated, 'Should be validated');
    });
  });

  describe('Error flow integration', () => {
    it('should handle errors through complete pipeline', async () => {
      let requestErrorHandled = false;
      let responseErrorHandled = false;

      // Request interceptor that might cause errors
      instance.interceptors.request.use(
        (config) => {
          if (config.url.includes('cause-request-error')) {
            throw new Error('Request interceptor error');
          }
          return config;
        },
        (error) => {
          requestErrorHandled = true;
          return Promise.reject(error);
        }
      );

      // Response interceptor error handling
      instance.interceptors.response.use(
        (response) => response,
        (error) => {
          responseErrorHandled = true;
          if (error.response && error.response.status === 404) {
            // Transform 404 to a custom error
            const customError = new fluxhttpError('Resource not found', 'ERR_NOT_FOUND', error.config);
            customError.response = error.response;
            return Promise.reject(customError);
          }
          return Promise.reject(error);
        }
      );

      // Test request interceptor error
      await assert.rejects(
        async () => await instance.get('https://api.test.com/cause-request-error'),
        { message: 'Request interceptor error' }
      );
      assert(requestErrorHandled, 'Request error handler should be called');

      // Reset for next test
      requestErrorHandled = false;
      responseErrorHandled = false;

      // Test response error transformation
      mockAdapter.setFailure(new fluxhttpError('Not Found', 'ERR_BAD_REQUEST', {}, {}, {
        status: 404,
        statusText: 'Not Found',
        data: { error: 'Resource not found' },
        headers: {},
        config: {}
      }));

      await assert.rejects(
        async () => await instance.get('https://api.test.com/missing'),
        { 
          message: 'Resource not found',
          code: 'ERR_NOT_FOUND'
        }
      );
      assert(responseErrorHandled, 'Response error handler should be called');
    });

    it('should propagate errors correctly through interceptor chain', async () => {
      const errorTrace = [];

      // Multiple request interceptors
      instance.interceptors.request.use(
        (config) => {
          errorTrace.push('req-1-success');
          return config;
        },
        (error) => {
          errorTrace.push('req-1-error');
          return Promise.reject(error);
        }
      );

      instance.interceptors.request.use(
        (config) => {
          errorTrace.push('req-2-success');
          throw new Error('Second interceptor error');
        },
        (error) => {
          errorTrace.push('req-2-error');
          return Promise.reject(error);
        }
      );

      instance.interceptors.request.use(
        (config) => {
          errorTrace.push('req-3-success'); // Should not be called
          return config;
        },
        (error) => {
          errorTrace.push('req-3-error');
          return Promise.reject(error);
        }
      );

      // Response interceptors
      instance.interceptors.response.use(
        (response) => {
          errorTrace.push('resp-1-success'); // Should not be called
          return response;
        },
        (error) => {
          errorTrace.push('resp-1-error');
          return Promise.reject(error);
        }
      );

      await assert.rejects(
        async () => await instance.get('https://api.test.com/test'),
        { message: 'Second interceptor error' }
      );

      // Verify error propagation path
      assert.deepStrictEqual(errorTrace, [
        'req-1-success',
        'req-2-success',
        'req-2-error',
        'req-1-error',
        'resp-1-error'
      ]);
    });
  });

  describe('Cancellation flow integration', () => {
    it('should handle request cancellation through complete flow', async () => {
      const source = CancelToken.source();
      let cancelHandled = false;

      // Add interceptor that handles cancellation
      instance.interceptors.response.use(
        (response) => response,
        (error) => {
          if (fluxhttp.isCancel(error)) {
            cancelHandled = true;
          }
          return Promise.reject(error);
        }
      );

      // Set up a slow mock response
      mockAdapter.setDelay(100);

      const requestPromise = instance.get('https://api.test.com/slow', {
        cancelToken: source.token
      });

      // Cancel immediately
      source.cancel('User cancelled');

      await assert.rejects(
        requestPromise,
        { message: 'User cancelled' }
      );

      assert(cancelHandled, 'Cancel should be handled by interceptor');
    });

    it('should handle cancellation at different stages', async () => {
      const source = CancelToken.source();
      let interceptorStage = '';

      // Request interceptor that can be cancelled
      instance.interceptors.request.use(async (config) => {
        interceptorStage = 'request-interceptor';
        
        // Check if already cancelled
        if (config.cancelToken) {
          config.cancelToken.throwIfRequested();
        }
        
        // Simulate some async work
        await new Promise(resolve => setTimeout(resolve, 50));
        
        // Check again after async work
        if (config.cancelToken) {
          config.cancelToken.throwIfRequested();
        }
        
        return config;
      });

      const requestPromise = instance.get('https://api.test.com/test', {
        cancelToken: source.token
      });

      // Cancel during request interceptor
      setTimeout(() => {
        source.cancel('Cancelled during interceptor');
      }, 25);

      await assert.rejects(
        requestPromise,
        { message: 'Cancelled during interceptor' }
      );

      assert.strictEqual(interceptorStage, 'request-interceptor');
    });
  });

  describe('Real-world integration scenarios', () => {
    it('should handle authentication flow with retry', async () => {
      let authAttempts = 0;
      let requestAttempts = 0;

      // Auth interceptor
      instance.interceptors.request.use((config) => {
        authAttempts++;
        config.headers = { ...config.headers, 'Authorization': `Bearer token-${authAttempts}` };
        return config;
      });

      // Response interceptor for auth renewal
      instance.interceptors.response.use(
        (response) => response,
        async (error) => {
          if (error.response && error.response.status === 401 && requestAttempts < 2) {
            requestAttempts++;
            // Simulate token refresh
            await new Promise(resolve => setTimeout(resolve, 10));
            // Retry the request
            return instance.request(error.config);
          }
          return Promise.reject(error);
        }
      );

      // First request fails with 401, second succeeds
      let callCount = 0;
      const originalRequest = mockAdapter.request.bind(mockAdapter);
      mockAdapter.request = async (config) => {
        callCount++;
        if (callCount === 1) {
          const error = new fluxhttpError('Unauthorized', 'ERR_BAD_REQUEST');
          error.config = config;
          error.response = {
            status: 401,
            statusText: 'Unauthorized',
            data: { error: 'Token expired' },
            headers: {},
            config
          };
          throw error;
        }
        
        // Second request succeeds
        return originalRequest(config);
      };

      mockAdapter.setMockResponse({
        data: { user: 'authenticated' },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {},
        request: {}
      });

      const response = await instance.get('https://api.test.com/protected');

      assert.strictEqual(response.status, 200);
      assert.strictEqual(response.data.user, 'authenticated');
      assert.strictEqual(authAttempts, 2, 'Should attempt auth twice');
      assert.strictEqual(requestAttempts, 1, 'Should retry once');
    });

    it('should handle concurrent requests with shared configuration', async () => {
      const sharedInstance = fluxhttp.create({
        adapter: mockAdapter,
        baseURL: 'https://api.test.com',
        headers: { 'X-Client': 'test-client' }
      });

      // Add request counter interceptor
      let requestCount = 0;
      sharedInstance.interceptors.request.use((config) => {
        requestCount++;
        config.headers = { ...config.headers, 'X-Request-ID': `req-${requestCount}` };
        return config;
      });

      // Mock different responses for different endpoints
      const originalRequest = mockAdapter.request.bind(mockAdapter);
      mockAdapter.request = async (config) => {
        await new Promise(resolve => setTimeout(resolve, Math.random() * 20));
        
        if (config.url.includes('/users')) {
          return {
            data: { type: 'users', url: config.url },
            status: 200,
            statusText: 'OK',
            headers: {},
            config,
            request: {}
          };
        } else if (config.url.includes('/posts')) {
          return {
            data: { type: 'posts', url: config.url },
            status: 200,
            statusText: 'OK',
            headers: {},
            config,
            request: {}
          };
        }
        
        return originalRequest(config);
      };

      // Make concurrent requests
      const promises = [
        sharedInstance.get('/users/1'),
        sharedInstance.get('/users/2'),
        sharedInstance.get('/posts/1'),
        sharedInstance.get('/posts/2'),
        sharedInstance.get('/users/3')
      ];

      const responses = await Promise.all(promises);

      // Verify all requests completed
      assert.strictEqual(responses.length, 5);
      
      // Verify request counting worked
      assert.strictEqual(requestCount, 5);
      
      // Verify responses are correct
      assert.strictEqual(responses[0].data.type, 'users');
      assert.strictEqual(responses[2].data.type, 'posts');
      
      // Verify shared headers were applied
      responses.forEach(response => {
        assert(response.config.headers['x-client'], 'Should have shared client header');
      });
    });

    it('should handle file upload simulation', async () => {
      const fileData = Buffer.from('file content data');
      const uploadProgress = [];

      // Mock file upload with progress
      mockAdapter.request = async (config) => {
        // Simulate upload progress
        for (let i = 0; i <= 100; i += 20) {
          if (config.onUploadProgress) {
            config.onUploadProgress({
              loaded: (fileData.length * i) / 100,
              total: fileData.length,
              progress: i / 100
            });
          }
          await new Promise(resolve => setTimeout(resolve, 5));
        }

        return {
          data: { 
            fileId: 'file-123',
            size: fileData.length,
            status: 'uploaded'
          },
          status: 201,
          statusText: 'Created',
          headers: { 'Location': '/files/file-123' },
          config,
          request: {}
        };
      };

      const response = await instance.post('https://api.test.com/upload', fileData, {
        headers: { 'Content-Type': 'application/octet-stream' },
        onUploadProgress: (progressEvent) => {
          uploadProgress.push({
            loaded: progressEvent.loaded,
            total: progressEvent.total,
            percentage: Math.round(progressEvent.progress * 100)
          });
        }
      });

      assert.strictEqual(response.status, 201);
      assert.strictEqual(response.data.fileId, 'file-123');
      assert.strictEqual(response.data.size, fileData.length);
      
      // Verify progress was tracked
      assert(uploadProgress.length > 0, 'Should track upload progress');
      assert.strictEqual(uploadProgress[uploadProgress.length - 1].percentage, 100);
    });
  });

  describe('Performance and resource management', () => {
    it('should handle many concurrent requests efficiently', async () => {
      const startTime = Date.now();
      const requestCount = 50;
      
      // Mock fast responses
      mockAdapter.request = async (config) => {
        await new Promise(resolve => setTimeout(resolve, 1));
        return {
          data: { id: config.url.split('/').pop() },
          status: 200,
          statusText: 'OK',
          headers: {},
          config,
          request: {}
        };
      };

      const promises = [];
      for (let i = 0; i < requestCount; i++) {
        promises.push(instance.get(`https://api.test.com/items/${i}`));
      }

      const responses = await Promise.all(promises);
      const endTime = Date.now();

      assert.strictEqual(responses.length, requestCount);
      
      // Should complete reasonably quickly (adjust threshold as needed)
      const duration = endTime - startTime;
      assert(duration < 5000, `Should complete efficiently, took ${duration}ms`);
      
      // Verify all responses are unique and correct
      responses.forEach((response, index) => {
        assert.strictEqual(response.data.id, String(index));
      });
    });

    it('should cleanup resources properly after requests', async () => {
      const initialMemory = process.memoryUsage?.()?.heapUsed || 0;
      
      // Make many requests to test memory usage
      for (let i = 0; i < 20; i++) {
        const response = await instance.get('https://api.test.com/test');
        assert.strictEqual(response.status, 200);
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage?.()?.heapUsed || 0;
      const memoryIncrease = finalMemory - initialMemory;
      
      // Memory increase should be reasonable (less than 5MB for this test)
      assert(memoryIncrease < 5 * 1024 * 1024, `Memory increase should be minimal: ${memoryIncrease} bytes`);
    });
  });
});