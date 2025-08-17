const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');

// Import the module we need to test - we'll test through the built library
const fluxhttpModule = require('../../../dist/index.js');

// For testing deduplication, we need to access the internal deduplication logic
// Since this might not be directly exported, we'll test it through the HTTP client behavior
const fluxhttp = fluxhttpModule.default || fluxhttpModule;

/**
 * Comprehensive unit tests for request deduplication
 * Tests the RequestDeduplicator class and related functionality
 */
describe('Request Deduplication', () => {
  let requestCount;
  let responses;
  let mockAdapter;

  beforeEach(() => {
    requestCount = 0;
    responses = {};
    
    // Create a mock adapter that tracks requests
    mockAdapter = {
      request: async (config) => {
        requestCount++;
        const key = `${config.method || 'GET'}:${config.url}`;
        
        // Return predefined response or default
        const response = responses[key] || {
          data: { requestCount, url: config.url, method: config.method },
          status: 200,
          statusText: 'OK',
          headers: {},
          config,
          request: {}
        };

        // Simulate some delay
        await new Promise(resolve => setTimeout(resolve, 10));
        
        return response;
      }
    };
  });

  afterEach(() => {
    // Clean up any timers or intervals
    if (global.gc) {
      global.gc();
    }
  });

  describe('Basic deduplication behavior', () => {
    it('should deduplicate identical GET requests', async () => {
      const instance = fluxhttp.create({
        adapter: mockAdapter,
        deduplication: { enabled: true }
      });

      const config = { url: 'https://api.test.com/users', method: 'GET' };

      // Make two identical requests simultaneously
      const [response1, response2] = await Promise.all([
        instance.request(config),
        instance.request(config)
      ]);

      // Should only make one actual request
      assert.strictEqual(requestCount, 1, 'Should only make one request');
      
      // Both responses should be identical
      assert.deepStrictEqual(response1.data, response2.data);
      assert.strictEqual(response1.data.requestCount, 1);
    });

    it('should not deduplicate non-safe HTTP methods by default', async () => {
      const instance = fluxhttp.create({
        adapter: mockAdapter,
        deduplication: { enabled: true }
      });

      const postConfig = { url: 'https://api.test.com/users', method: 'POST', data: { name: 'test' } };

      // Make two identical POST requests simultaneously
      const [response1, response2] = await Promise.all([
        instance.request(postConfig),
        instance.request(postConfig)
      ]);

      // Should make two separate requests
      assert.strictEqual(requestCount, 2, 'Should make two separate requests for POST');
      
      // Responses should have different request counts
      assert.notStrictEqual(response1.data.requestCount, response2.data.requestCount);
    });

    it('should deduplicate HEAD and OPTIONS requests', async () => {
      const instance = fluxhttp.create({
        adapter: mockAdapter,
        deduplication: { enabled: true }
      });

      // Test HEAD requests
      const headConfig = { url: 'https://api.test.com/users', method: 'HEAD' };
      const [headResponse1, headResponse2] = await Promise.all([
        instance.request(headConfig),
        instance.request(headConfig)
      ]);

      assert.strictEqual(requestCount, 1, 'Should deduplicate HEAD requests');

      // Reset counter
      requestCount = 0;

      // Test OPTIONS requests  
      const optionsConfig = { url: 'https://api.test.com/users', method: 'OPTIONS' };
      const [optionsResponse1, optionsResponse2] = await Promise.all([
        instance.request(optionsConfig),
        instance.request(optionsConfig)
      ]);

      assert.strictEqual(requestCount, 1, 'Should deduplicate OPTIONS requests');
    });

    it('should not deduplicate when disabled', async () => {
      const instance = fluxhttp.create({
        adapter: mockAdapter,
        deduplication: { enabled: false }
      });

      const config = { url: 'https://api.test.com/users', method: 'GET' };

      const [response1, response2] = await Promise.all([
        instance.request(config),
        instance.request(config)
      ]);

      // Should make two separate requests
      assert.strictEqual(requestCount, 2, 'Should make two requests when deduplication is disabled');
      assert.notStrictEqual(response1.data.requestCount, response2.data.requestCount);
    });
  });

  describe('Request differentiation', () => {
    it('should differentiate requests by URL', async () => {
      const instance = fluxhttp.create({
        adapter: mockAdapter,
        deduplication: { enabled: true }
      });

      const [response1, response2] = await Promise.all([
        instance.get('https://api.test.com/users'),
        instance.get('https://api.test.com/posts')
      ]);

      // Should make two separate requests for different URLs
      assert.strictEqual(requestCount, 2, 'Should make separate requests for different URLs');
      assert.notStrictEqual(response1.data.url, response2.data.url);
    });

    it('should differentiate requests by method', async () => {
      const instance = fluxhttp.create({
        adapter: mockAdapter,
        deduplication: { enabled: true }
      });

      const [response1, response2] = await Promise.all([
        instance.get('https://api.test.com/users'),
        instance.head('https://api.test.com/users')
      ]);

      // Should make two separate requests for different methods
      assert.strictEqual(requestCount, 2, 'Should make separate requests for different methods');
      assert.notStrictEqual(response1.data.method, response2.data.method);
    });

    it('should differentiate requests by query parameters', async () => {
      const instance = fluxhttp.create({
        adapter: mockAdapter,
        deduplication: { enabled: true }
      });

      const [response1, response2] = await Promise.all([
        instance.get('https://api.test.com/users', { params: { page: 1 } }),
        instance.get('https://api.test.com/users', { params: { page: 2 } })
      ]);

      // Should make two separate requests for different params
      assert.strictEqual(requestCount, 2, 'Should make separate requests for different params');
    });

    it('should deduplicate requests with same params in different order', async () => {
      const instance = fluxhttp.create({
        adapter: mockAdapter,
        deduplication: { enabled: true }
      });

      const [response1, response2] = await Promise.all([
        instance.get('https://api.test.com/users', { params: { page: 1, limit: 10 } }),
        instance.get('https://api.test.com/users', { params: { limit: 10, page: 1 } })
      ]);

      // Should deduplicate requests with same params regardless of order
      assert.strictEqual(requestCount, 1, 'Should deduplicate requests with same params in different order');
      assert.deepStrictEqual(response1.data, response2.data);
    });

    it('should differentiate requests by data payload', async () => {
      const instance = fluxhttp.create({
        adapter: mockAdapter,
        deduplication: { 
          enabled: true,
          shouldDeduplicate: () => true // Force deduplication for all methods
        }
      });

      const [response1, response2] = await Promise.all([
        instance.post('https://api.test.com/users', { name: 'John' }),
        instance.post('https://api.test.com/users', { name: 'Jane' })
      ]);

      // Should make two separate requests for different data
      assert.strictEqual(requestCount, 2, 'Should make separate requests for different data');
    });

    it('should deduplicate requests with identical data', async () => {
      const instance = fluxhttp.create({
        adapter: mockAdapter,
        deduplication: { 
          enabled: true,
          shouldDeduplicate: () => true // Force deduplication for all methods
        }
      });

      const data = { name: 'John', age: 30 };
      const [response1, response2] = await Promise.all([
        instance.post('https://api.test.com/users', data),
        instance.post('https://api.test.com/users', data)
      ]);

      // Should deduplicate requests with identical data
      assert.strictEqual(requestCount, 1, 'Should deduplicate requests with identical data');
      assert.deepStrictEqual(response1.data, response2.data);
    });
  });

  describe('Header-based deduplication', () => {
    it('should ignore headers by default', async () => {
      const instance = fluxhttp.create({
        adapter: mockAdapter,
        deduplication: { enabled: true }
      });

      const [response1, response2] = await Promise.all([
        instance.get('https://api.test.com/users', { headers: { 'X-Custom': 'value1' } }),
        instance.get('https://api.test.com/users', { headers: { 'X-Custom': 'value2' } })
      ]);

      // Should deduplicate since headers are ignored by default
      assert.strictEqual(requestCount, 1, 'Should deduplicate requests with different headers by default');
      assert.deepStrictEqual(response1.data, response2.data);
    });

    it('should differentiate requests when headers are included', async () => {
      const instance = fluxhttp.create({
        adapter: mockAdapter,
        deduplication: { 
          enabled: true,
          includeHeaders: ['X-Custom']
        }
      });

      const [response1, response2] = await Promise.all([
        instance.get('https://api.test.com/users', { headers: { 'X-Custom': 'value1' } }),
        instance.get('https://api.test.com/users', { headers: { 'X-Custom': 'value2' } })
      ]);

      // Should make separate requests when headers are included
      assert.strictEqual(requestCount, 2, 'Should make separate requests for different included headers');
    });

    it('should deduplicate requests with same included headers', async () => {
      const instance = fluxhttp.create({
        adapter: mockAdapter,
        deduplication: { 
          enabled: true,
          includeHeaders: ['Authorization', 'X-Custom']
        }
      });

      const headers = { 'Authorization': 'Bearer token', 'X-Custom': 'value' };
      const [response1, response2] = await Promise.all([
        instance.get('https://api.test.com/users', { headers }),
        instance.get('https://api.test.com/users', { headers })
      ]);

      // Should deduplicate requests with same included headers
      assert.strictEqual(requestCount, 1, 'Should deduplicate requests with same included headers');
      assert.deepStrictEqual(response1.data, response2.data);
    });

    it('should handle case-insensitive headers', async () => {
      const instance = fluxhttp.create({
        adapter: mockAdapter,
        deduplication: { 
          enabled: true,
          includeHeaders: ['authorization']
        }
      });

      const [response1, response2] = await Promise.all([
        instance.get('https://api.test.com/users', { headers: { 'Authorization': 'Bearer token' } }),
        instance.get('https://api.test.com/users', { headers: { 'AUTHORIZATION': 'Bearer token' } })
      ]);

      // Should deduplicate case-insensitive headers
      assert.strictEqual(requestCount, 1, 'Should handle case-insensitive headers');
      assert.deepStrictEqual(response1.data, response2.data);
    });
  });

  describe('Custom configuration', () => {
    it('should use custom shouldDeduplicate function', async () => {
      const instance = fluxhttp.create({
        adapter: mockAdapter,
        deduplication: { 
          enabled: true,
          shouldDeduplicate: (config) => {
            // Only deduplicate requests to /cache endpoint
            return config.url && config.url.includes('/cache');
          }
        }
      });

      // This should be deduplicated
      const [response1, response2] = await Promise.all([
        instance.get('https://api.test.com/cache'),
        instance.get('https://api.test.com/cache')
      ]);

      assert.strictEqual(requestCount, 1, 'Should deduplicate /cache requests');

      // Reset counter
      requestCount = 0;

      // This should not be deduplicated
      const [response3, response4] = await Promise.all([
        instance.get('https://api.test.com/users'),
        instance.get('https://api.test.com/users')
      ]);

      assert.strictEqual(requestCount, 2, 'Should not deduplicate /users requests');
    });

    it('should use custom key generator', async () => {
      let keyGeneratorCalled = false;
      
      const instance = fluxhttp.create({
        adapter: mockAdapter,
        deduplication: { 
          enabled: true,
          keyGenerator: (config) => {
            keyGeneratorCalled = true;
            // Simple key generator that ignores params
            return `${config.method || 'GET'}:${config.url}`;
          }
        }
      });

      const [response1, response2] = await Promise.all([
        instance.get('https://api.test.com/users', { params: { page: 1 } }),
        instance.get('https://api.test.com/users', { params: { page: 2 } })
      ]);

      assert(keyGeneratorCalled, 'Custom key generator should be called');
      assert.strictEqual(requestCount, 1, 'Should deduplicate using custom key generator');
    });

    it('should respect maxAge configuration', async () => {
      const instance = fluxhttp.create({
        adapter: mockAdapter,
        deduplication: { 
          enabled: true,
          maxAge: 50 // Very short expiry
        }
      });

      // First request
      const response1 = await instance.get('https://api.test.com/users');
      assert.strictEqual(requestCount, 1);

      // Wait for expiry
      await new Promise(resolve => setTimeout(resolve, 60));

      // Second request after expiry
      const response2 = await instance.get('https://api.test.com/users');
      assert.strictEqual(requestCount, 2, 'Should make new request after maxAge expiry');
    });
  });

  describe('Sequential vs concurrent requests', () => {
    it('should handle sequential requests correctly', async () => {
      const instance = fluxhttp.create({
        adapter: mockAdapter,
        deduplication: { enabled: true }
      });

      // Make requests sequentially
      const response1 = await instance.get('https://api.test.com/users');
      const response2 = await instance.get('https://api.test.com/users');

      // Sequential requests should not be deduplicated (first completes before second starts)
      assert.strictEqual(requestCount, 2, 'Sequential requests should not be deduplicated');
      assert.notStrictEqual(response1.data.requestCount, response2.data.requestCount);
    });

    it('should handle concurrent requests correctly', async () => {
      const instance = fluxhttp.create({
        adapter: mockAdapter,
        deduplication: { enabled: true }
      });

      // Make requests concurrently
      const [response1, response2] = await Promise.all([
        instance.get('https://api.test.com/users'),
        instance.get('https://api.test.com/users')
      ]);

      // Concurrent requests should be deduplicated
      assert.strictEqual(requestCount, 1, 'Concurrent requests should be deduplicated');
      assert.deepStrictEqual(response1.data, response2.data);
    });

    it('should handle mixed sequential and concurrent requests', async () => {
      const instance = fluxhttp.create({
        adapter: mockAdapter,
        deduplication: { enabled: true }
      });

      // First concurrent batch
      const [response1, response2] = await Promise.all([
        instance.get('https://api.test.com/users'),
        instance.get('https://api.test.com/users')
      ]);

      assert.strictEqual(requestCount, 1, 'First batch should be deduplicated');

      // Second concurrent batch (after first completes)
      const [response3, response4] = await Promise.all([
        instance.get('https://api.test.com/users'),
        instance.get('https://api.test.com/users')
      ]);

      assert.strictEqual(requestCount, 3, 'Second batch should make new requests');
    });
  });

  describe('Error handling in deduplication', () => {
    it('should handle request failures correctly', async () => {
      const failingAdapter = {
        request: async (config) => {
          requestCount++;
          if (requestCount === 1) {
            throw new Error('First request failed');
          }
          return {
            data: { success: true, requestCount },
            status: 200,
            statusText: 'OK',
            headers: {},
            config,
            request: {}
          };
        }
      };

      const instance = fluxhttp.create({
        adapter: failingAdapter,
        deduplication: { enabled: true }
      });

      // First request should fail
      await assert.rejects(
        async () => await instance.get('https://api.test.com/users'),
        { message: 'First request failed' }
      );

      assert.strictEqual(requestCount, 1);

      // Second request should succeed (not deduplicated with failed request)
      const response = await instance.get('https://api.test.com/users');
      assert.strictEqual(requestCount, 2);
      assert.strictEqual(response.data.success, true);
    });

    it('should handle adapter errors in concurrent requests', async () => {
      let failCount = 0;
      const partiallyFailingAdapter = {
        request: async (config) => {
          requestCount++;
          failCount++;
          
          if (failCount <= 2) {
            throw new Error('Request failed');
          }
          
          return {
            data: { success: true, requestCount },
            status: 200,
            statusText: 'OK',
            headers: {},
            config,
            request: {}
          };
        }
      };

      const instance = fluxhttp.create({
        adapter: partiallyFailingAdapter,
        deduplication: { enabled: true }
      });

      // Both concurrent requests should fail with the same error
      const results = await Promise.allSettled([
        instance.get('https://api.test.com/users'),
        instance.get('https://api.test.com/users')
      ]);

      assert.strictEqual(requestCount, 1, 'Should only make one request even when it fails');
      assert.strictEqual(results[0].status, 'rejected');
      assert.strictEqual(results[1].status, 'rejected');
      assert.strictEqual(results[0].reason.message, 'Request failed');
      assert.strictEqual(results[1].reason.message, 'Request failed');
    });

    it('should clean up failed requests properly', async () => {
      const instance = fluxhttp.create({
        adapter: mockAdapter,
        deduplication: { enabled: true }
      });

      // Mock a failing request
      const originalRequest = mockAdapter.request;
      mockAdapter.request = async (config) => {
        requestCount++;
        throw new Error('Request failed');
      };

      // First request fails
      await assert.rejects(
        async () => await instance.get('https://api.test.com/users'),
        { message: 'Request failed' }
      );

      // Restore working adapter
      mockAdapter.request = originalRequest;

      // Second request should work
      const response = await instance.get('https://api.test.com/users');
      assert.strictEqual(requestCount, 2, 'Should make new request after previous failure');
      assert(response.data, 'Second request should succeed');
    });
  });

  describe('Edge cases and special scenarios', () => {
    it('should handle requests with null/undefined data', async () => {
      const instance = fluxhttp.create({
        adapter: mockAdapter,
        deduplication: { 
          enabled: true,
          shouldDeduplicate: () => true
        }
      });

      const [response1, response2, response3] = await Promise.all([
        instance.post('https://api.test.com/users', null),
        instance.post('https://api.test.com/users', undefined),
        instance.post('https://api.test.com/users', null)
      ]);

      // null and undefined should be treated differently
      assert.strictEqual(requestCount, 2, 'Should differentiate between null and undefined data');
      
      // But identical null values should be deduplicated
      assert.deepStrictEqual(response1.data, response3.data);
    });

    it('should handle very large request data', async () => {
      const instance = fluxhttp.create({
        adapter: mockAdapter,
        deduplication: { 
          enabled: true,
          shouldDeduplicate: () => true
        }
      });

      const largeData = {
        array: new Array(1000).fill({ key: 'value' }),
        text: 'x'.repeat(10000)
      };

      const [response1, response2] = await Promise.all([
        instance.post('https://api.test.com/users', largeData),
        instance.post('https://api.test.com/users', largeData)
      ]);

      // Should handle large data correctly
      assert.strictEqual(requestCount, 1, 'Should deduplicate large data requests');
      assert.deepStrictEqual(response1.data, response2.data);
    });

    it('should handle circular references in data', async () => {
      const instance = fluxhttp.create({
        adapter: mockAdapter,
        deduplication: { 
          enabled: true,
          shouldDeduplicate: () => true
        }
      });

      const circularData = { name: 'test' };
      circularData.self = circularData;

      // Should not throw with circular data (JSON.stringify handles this)
      await assert.doesNotReject(async () => {
        await instance.post('https://api.test.com/users', circularData);
      });
    });

    it('should handle unicode and special characters', async () => {
      const instance = fluxhttp.create({
        adapter: mockAdapter,
        deduplication: { enabled: true }
      });

      const unicodeData = {
        emoji: '🚀🌟',
        chinese: '你好世界',
        special: 'special"chars\'here'
      };

      const [response1, response2] = await Promise.all([
        instance.post('https://api.test.com/users', unicodeData),
        instance.post('https://api.test.com/users', unicodeData)
      ]);

      // Should handle unicode correctly in deduplication
      assert.strictEqual(requestCount, 1, 'Should deduplicate unicode data requests');
    });

    it('should handle requests with different config properties', async () => {
      const instance = fluxhttp.create({
        adapter: mockAdapter,
        deduplication: { enabled: true }
      });

      // These should be deduplicated despite different timeout/other config
      const [response1, response2] = await Promise.all([
        instance.get('https://api.test.com/users', { timeout: 5000 }),
        instance.get('https://api.test.com/users', { timeout: 10000 })
      ]);

      // Should deduplicate based on URL/method/params/data, ignoring other config
      assert.strictEqual(requestCount, 1, 'Should deduplicate despite different config properties');
      assert.deepStrictEqual(response1.data, response2.data);
    });

    it('should handle empty and whitespace-only URLs', async () => {
      const instance = fluxhttp.create({
        adapter: mockAdapter,
        deduplication: { enabled: true }
      });

      const [response1, response2] = await Promise.all([
        instance.request({ url: '', method: 'GET' }),
        instance.request({ url: '', method: 'GET' })
      ]);

      // Should deduplicate empty URLs
      assert.strictEqual(requestCount, 1, 'Should deduplicate empty URL requests');
    });
  });

  describe('Integration with HTTP methods', () => {
    it('should work with all HTTP method shortcuts', async () => {
      const instance = fluxhttp.create({
        adapter: mockAdapter,
        deduplication: { enabled: true }
      });

      // Test GET (should deduplicate)
      const [get1, get2] = await Promise.all([
        instance.get('https://api.test.com/users'),
        instance.get('https://api.test.com/users')
      ]);
      
      assert.strictEqual(requestCount, 1, 'Should deduplicate GET requests');
      requestCount = 0;

      // Test HEAD (should deduplicate)
      const [head1, head2] = await Promise.all([
        instance.head('https://api.test.com/users'),
        instance.head('https://api.test.com/users')
      ]);
      
      assert.strictEqual(requestCount, 1, 'Should deduplicate HEAD requests');
      requestCount = 0;

      // Test OPTIONS (should deduplicate)
      const [options1, options2] = await Promise.all([
        instance.options('https://api.test.com/users'),
        instance.options('https://api.test.com/users')
      ]);
      
      assert.strictEqual(requestCount, 1, 'Should deduplicate OPTIONS requests');
      requestCount = 0;

      // Test POST (should not deduplicate by default)
      const [post1, post2] = await Promise.all([
        instance.post('https://api.test.com/users', { name: 'test' }),
        instance.post('https://api.test.com/users', { name: 'test' })
      ]);
      
      assert.strictEqual(requestCount, 2, 'Should not deduplicate POST requests by default');
    });
  });
});