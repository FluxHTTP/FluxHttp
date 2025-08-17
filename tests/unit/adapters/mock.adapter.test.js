const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert');

// Import the MockAdapter from our helper
const { MockAdapter } = require('../../helpers/mock-adapter');

// Import the main library for integration testing
const fluxhttpModule = require('../../../dist/index.js');
const fluxhttp = fluxhttpModule.default || fluxhttpModule;

/**
 * Comprehensive unit tests for Mock Adapter functionality
 * Tests MockAdapter class and its integration with fluxhttp
 */
describe('Mock Adapter', () => {
  let mockAdapter;

  beforeEach(() => {
    mockAdapter = new MockAdapter();
  });

  describe('MockAdapter construction and basic functionality', () => {
    it('should create a new mock adapter instance', () => {
      assert(mockAdapter instanceof MockAdapter, 'Should be MockAdapter instance');
      assert(typeof mockAdapter.request === 'function', 'Should have request method');
      assert(typeof mockAdapter.setMockResponse === 'function', 'Should have setMockResponse method');
      assert(typeof mockAdapter.setFailure === 'function', 'Should have setFailure method');
      assert(typeof mockAdapter.reset === 'function', 'Should have reset method');
    });

    it('should initialize with clean state', () => {
      assert.strictEqual(mockAdapter.getRequestCount(), 0, 'Should start with 0 requests');
      assert.strictEqual(mockAdapter.getLastRequest(), null, 'Should have no last request');
      assert.deepStrictEqual(mockAdapter.getRequestHistory(), [], 'Should have empty history');
    });

    it('should track request count correctly', async () => {
      const config = { url: 'https://test.com', method: 'GET' };

      await mockAdapter.request(config);
      assert.strictEqual(mockAdapter.getRequestCount(), 1, 'Should track first request');

      await mockAdapter.request(config);
      assert.strictEqual(mockAdapter.getRequestCount(), 2, 'Should track second request');

      await mockAdapter.request(config);
      assert.strictEqual(mockAdapter.getRequestCount(), 3, 'Should track third request');
    });

    it('should store request history', async () => {
      const config1 = { url: 'https://test.com/1', method: 'GET' };
      const config2 = { url: 'https://test.com/2', method: 'POST', data: { test: true } };

      await mockAdapter.request(config1);
      await mockAdapter.request(config2);

      const history = mockAdapter.getRequestHistory();
      assert.strictEqual(history.length, 2, 'Should store both requests');
      assert.strictEqual(history[0].url, 'https://test.com/1');
      assert.strictEqual(history[1].url, 'https://test.com/2');
      assert.deepStrictEqual(history[1].data, { test: true });
    });

    it('should track last request', async () => {
      const config1 = { url: 'https://test.com/1', method: 'GET' };
      const config2 = { url: 'https://test.com/2', method: 'POST' };

      await mockAdapter.request(config1);
      assert.strictEqual(mockAdapter.getLastRequest().url, 'https://test.com/1');

      await mockAdapter.request(config2);
      assert.strictEqual(mockAdapter.getLastRequest().url, 'https://test.com/2');
      assert.strictEqual(mockAdapter.getLastRequest().method, 'POST');
    });
  });

  describe('Default response behavior', () => {
    it('should return default response when no mock is set', async () => {
      const config = { url: 'https://test.com', method: 'GET' };
      const response = await mockAdapter.request(config);

      assert.strictEqual(response.status, 200, 'Should default to 200 status');
      assert.strictEqual(response.statusText, 'OK', 'Should default to OK status text');
      assert.deepStrictEqual(response.headers, {}, 'Should default to empty headers');
      assert.deepStrictEqual(response.data, {}, 'Should default to empty data');
      assert.strictEqual(response.config, config, 'Should include request config');
      assert.deepStrictEqual(response.request, {}, 'Should include empty request object');
    });

    it('should include request config in response', async () => {
      const config = {
        url: 'https://test.com/api',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        data: { name: 'test' }
      };

      const response = await mockAdapter.request(config);
      assert.strictEqual(response.config, config, 'Should include original config');
    });
  });

  describe('Custom mock responses', () => {
    it('should return custom mock response', async () => {
      const mockResponse = {
        data: { id: 123, name: 'Test User' },
        status: 201,
        statusText: 'Created',
        headers: { 'Content-Type': 'application/json' },
        config: {},
        request: {}
      };

      mockAdapter.setMockResponse(mockResponse);

      const config = { url: 'https://test.com', method: 'POST' };
      const response = await mockAdapter.request(config);

      assert.strictEqual(response.status, 201);
      assert.strictEqual(response.statusText, 'Created');
      assert.deepStrictEqual(response.data, { id: 123, name: 'Test User' });
      assert.deepStrictEqual(response.headers, { 'Content-Type': 'application/json' });
    });

    it('should handle different data types in mock response', async () => {
      const testCases = [
        { data: 'string response' },
        { data: 42 },
        { data: true },
        { data: null },
        { data: { complex: { nested: 'object' } } },
        { data: [1, 2, 3, 'array'] }
      ];

      for (const testCase of testCases) {
        mockAdapter.setMockResponse({
          data: testCase.data,
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {},
          request: {}
        });

        const response = await mockAdapter.request({ url: 'https://test.com' });
        assert.deepStrictEqual(response.data, testCase.data, `Should handle ${typeof testCase.data} data`);
      }
    });

    it('should use MockAdapter static helper methods', () => {
      const mockResponse = MockAdapter.createMockResponse(
        { message: 'success' },
        201,
        'Created',
        { 'Location': '/api/resource/123' }
      );

      assert.deepStrictEqual(mockResponse.data, { message: 'success' });
      assert.strictEqual(mockResponse.status, 201);
      assert.strictEqual(mockResponse.statusText, 'Created');
      assert.deepStrictEqual(mockResponse.headers, { 'Location': '/api/resource/123' });
    });

    it('should create error responses with static helpers', () => {
      const errorResponse = MockAdapter.createMockErrorResponse(
        404,
        'Not Found',
        { error: 'Resource not found' }
      );

      assert.strictEqual(errorResponse.status, 404);
      assert.strictEqual(errorResponse.statusText, 'Not Found');
      assert.deepStrictEqual(errorResponse.data, { error: 'Resource not found' });
    });
  });

  describe('Error simulation', () => {
    it('should simulate request failures', async () => {
      const error = new Error('Network connection failed');
      mockAdapter.setFailure(error);

      await assert.rejects(
        async () => await mockAdapter.request({ url: 'https://test.com' }),
        { message: 'Network connection failed' }
      );
    });

    it('should simulate different error types', async () => {
      // Network error
      const networkError = MockAdapter.createNetworkError('Connection lost');
      mockAdapter.setFailure(networkError);

      await assert.rejects(
        async () => await mockAdapter.request({ url: 'https://test.com' }),
        { message: 'Connection lost', code: 'NETWORK_ERROR' }
      );

      mockAdapter.reset();

      // Timeout error
      const timeoutError = MockAdapter.createTimeoutError('Request timed out');
      mockAdapter.setFailure(timeoutError);

      await assert.rejects(
        async () => await mockAdapter.request({ url: 'https://test.com' }),
        { message: 'Request timed out', code: 'ECONNABORTED' }
      );
    });

    it('should count failed requests', async () => {
      mockAdapter.setFailure(new Error('Simulated failure'));

      try {
        await mockAdapter.request({ url: 'https://test.com' });
        assert.fail('Should have thrown error');
      } catch (error) {
        // Expected error
      }

      assert.strictEqual(mockAdapter.getRequestCount(), 1, 'Should count failed requests');
      assert(mockAdapter.getLastRequest(), 'Should record failed request in history');
    });

    it('should handle default mock adapter failure', async () => {
      // Set failure without providing error
      mockAdapter.shouldFail = true;
      mockAdapter.failureError = null;

      await assert.rejects(
        async () => await mockAdapter.request({ url: 'https://test.com' }),
        { message: 'Mock adapter failure' }
      );
    });
  });

  describe('Delay simulation', () => {
    it('should simulate response delays', async () => {
      const delay = 100; // 100ms
      mockAdapter.setDelay(delay);

      const startTime = Date.now();
      await mockAdapter.request({ url: 'https://test.com' });
      const endTime = Date.now();

      const actualDelay = endTime - startTime;
      assert(actualDelay >= delay - 10, `Should delay at least ${delay}ms, got ${actualDelay}ms`);
    });

    it('should work without delay by default', async () => {
      const startTime = Date.now();
      await mockAdapter.request({ url: 'https://test.com' });
      const endTime = Date.now();

      const actualTime = endTime - startTime;
      assert(actualTime < 50, `Should be fast by default, took ${actualTime}ms`);
    });

    it('should combine delay with custom responses', async () => {
      const mockResponse = {
        data: { delayed: true },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {},
        request: {}
      };

      mockAdapter.setMockResponse(mockResponse);
      mockAdapter.setDelay(50);

      const startTime = Date.now();
      const response = await mockAdapter.request({ url: 'https://test.com' });
      const endTime = Date.now();

      assert.deepStrictEqual(response.data, { delayed: true });
      assert(endTime - startTime >= 40, 'Should include delay');
    });
  });

  describe('Request matching and filtering', () => {
    it('should check if request was made with specific properties', async () => {
      await mockAdapter.request({
        url: 'https://api.test.com/users',
        method: 'GET',
        headers: { 'Authorization': 'Bearer token' }
      });

      await mockAdapter.request({
        url: 'https://api.test.com/posts',
        method: 'POST',
        data: { title: 'New Post' }
      });

      assert(mockAdapter.wasRequestMadeWith({ url: 'https://api.test.com/users' }));
      assert(mockAdapter.wasRequestMadeWith({ method: 'GET' }));
      assert(mockAdapter.wasRequestMadeWith({ method: 'POST', data: { title: 'New Post' } }));
      assert(!mockAdapter.wasRequestMadeWith({ url: 'https://api.test.com/comments' }));
      assert(!mockAdapter.wasRequestMadeWith({ method: 'DELETE' }));
    });

    it('should match partial request properties', async () => {
      await mockAdapter.request({
        url: 'https://api.test.com/users',
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer token' },
        data: { name: 'John', age: 30 }
      });

      // Should match partial properties
      assert(mockAdapter.wasRequestMadeWith({ url: 'https://api.test.com/users' }));
      assert(mockAdapter.wasRequestMadeWith({ method: 'POST' }));
      assert(mockAdapter.wasRequestMadeWith({ data: { name: 'John', age: 30 } }));

      // Should not match incorrect properties
      assert(!mockAdapter.wasRequestMadeWith({ url: 'https://api.test.com/posts' }));
      assert(!mockAdapter.wasRequestMadeWith({ method: 'GET' }));
      assert(!mockAdapter.wasRequestMadeWith({ data: { name: 'Jane' } }));
    });
  });

  describe('Reset functionality', () => {
    it('should reset all state', async () => {
      // Make some requests and set up state
      mockAdapter.setMockResponse({ data: { test: true }, status: 200 });
      mockAdapter.setDelay(100);
      await mockAdapter.request({ url: 'https://test.com' });
      await mockAdapter.request({ url: 'https://test2.com' });

      assert.strictEqual(mockAdapter.getRequestCount(), 2);
      assert(mockAdapter.getLastRequest());

      // Reset everything
      mockAdapter.reset();

      assert.strictEqual(mockAdapter.getRequestCount(), 0, 'Should reset request count');
      assert.strictEqual(mockAdapter.getLastRequest(), null, 'Should reset last request');
      assert.deepStrictEqual(mockAdapter.getRequestHistory(), [], 'Should reset history');
      assert.strictEqual(mockAdapter.delay, 0, 'Should reset delay');
      assert(!mockAdapter.shouldFail, 'Should reset failure state');
      assert.strictEqual(mockAdapter.failureError, null, 'Should reset failure error');
    });

    it('should allow reuse after reset', async () => {
      // Make request, reset, make another request
      await mockAdapter.request({ url: 'https://test1.com' });
      mockAdapter.reset();
      await mockAdapter.request({ url: 'https://test2.com' });

      assert.strictEqual(mockAdapter.getRequestCount(), 1, 'Should count requests after reset');
      assert.strictEqual(mockAdapter.getLastRequest().url, 'https://test2.com');
    });
  });

  describe('Integration with fluxhttp', () => {
    it('should work as fluxhttp adapter', async () => {
      const instance = fluxhttp.create({ adapter: mockAdapter });

      mockAdapter.setMockResponse({
        data: { message: 'Hello from mock' },
        status: 200,
        statusText: 'OK',
        headers: { 'Content-Type': 'application/json' },
        config: {},
        request: {}
      });

      const response = await instance.get('https://api.test.com/greeting');

      assert.strictEqual(response.status, 200);
      assert.deepStrictEqual(response.data, { message: 'Hello from mock' });
      assert.strictEqual(mockAdapter.getRequestCount(), 1);
      assert.strictEqual(mockAdapter.getLastRequest().url, 'https://api.test.com/greeting');
      assert.strictEqual(mockAdapter.getLastRequest().method, 'GET');
    });

    it('should work with all HTTP methods', async () => {
      const instance = fluxhttp.create({ adapter: mockAdapter });

      const methods = [
        { method: 'get', url: 'https://api.test.com/users' },
        { method: 'post', url: 'https://api.test.com/users', data: { name: 'John' } },
        { method: 'put', url: 'https://api.test.com/users/1', data: { name: 'Jane' } },
        { method: 'patch', url: 'https://api.test.com/users/1', data: { age: 25 } },
        { method: 'delete', url: 'https://api.test.com/users/1' },
        { method: 'head', url: 'https://api.test.com/users' },
        { method: 'options', url: 'https://api.test.com/users' }
      ];

      for (const { method, url, data } of methods) {
        mockAdapter.reset(); // Reset between tests

        if (data) {
          await instance[method](url, data);
        } else {
          await instance[method](url);
        }

        assert.strictEqual(mockAdapter.getRequestCount(), 1, `Should work with ${method.toUpperCase()}`);
        assert.strictEqual(mockAdapter.getLastRequest().method, method.toUpperCase());
        assert.strictEqual(mockAdapter.getLastRequest().url, url);
        if (data) {
          assert.deepStrictEqual(mockAdapter.getLastRequest().data, data);
        }
      }
    });

    it('should handle request configuration merging', async () => {
      const instance = fluxhttp.create({
        adapter: mockAdapter,
        baseURL: 'https://api.test.com',
        headers: { 'Authorization': 'Bearer token' },
        timeout: 5000
      });

      await instance.get('/users', {
        headers: { 'Accept': 'application/json' },
        params: { page: 1 }
      });

      const lastRequest = mockAdapter.getLastRequest();
      assert.strictEqual(lastRequest.url, 'https://api.test.com/users');
      assert.strictEqual(lastRequest.headers['authorization'], 'Bearer token');
      assert.strictEqual(lastRequest.headers['accept'], 'application/json');
      assert.strictEqual(lastRequest.timeout, 5000);
      assert.deepStrictEqual(lastRequest.params, { page: 1 });
    });

    it('should work with interceptors', async () => {
      const instance = fluxhttp.create({ adapter: mockAdapter });

      let requestInterceptorCalled = false;
      let responseInterceptorCalled = false;

      // Add request interceptor
      instance.interceptors.request.use((config) => {
        requestInterceptorCalled = true;
        config.headers = { ...config.headers, 'X-Intercepted': 'true' };
        return config;
      });

      // Add response interceptor
      instance.interceptors.response.use((response) => {
        responseInterceptorCalled = true;
        response.data = { ...response.data, intercepted: true };
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

      assert(requestInterceptorCalled, 'Request interceptor should be called');
      assert(responseInterceptorCalled, 'Response interceptor should be called');
      assert.strictEqual(mockAdapter.getLastRequest().headers['x-intercepted'], 'true');
      assert(response.data.original, 'Should preserve original data');
      assert(response.data.intercepted, 'Should add intercepted data');
    });

    it('should handle error responses correctly', async () => {
      const instance = fluxhttp.create({ adapter: mockAdapter });

      const error = new Error('Request failed');
      error.code = 'NETWORK_ERROR';
      mockAdapter.setFailure(error);

      await assert.rejects(
        async () => await instance.get('https://api.test.com/error'),
        { message: 'Request failed', code: 'NETWORK_ERROR' }
      );

      assert.strictEqual(mockAdapter.getRequestCount(), 1, 'Should count failed requests');
    });
  });

  describe('Advanced scenarios and edge cases', () => {
    it('should handle large request and response data', async () => {
      const largeData = {
        array: new Array(1000).fill({ key: 'value', data: 'x'.repeat(100) }),
        text: 'very long text '.repeat(1000)
      };

      mockAdapter.setMockResponse({
        data: largeData,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {},
        request: {}
      });

      const instance = fluxhttp.create({ adapter: mockAdapter });
      const response = await instance.post('https://api.test.com/large', largeData);

      assert.deepStrictEqual(response.data, largeData);
      assert.deepStrictEqual(mockAdapter.getLastRequest().data, largeData);
    });

    it('should handle unicode and special characters', async () => {
      const unicodeData = {
        emoji: '🚀🌟💻',
        chinese: '你好世界',
        special: 'Special "quotes" and \'apostrophes\' & symbols',
        unicode: '\u{1F600}\u{1F603}\u{1F604}'
      };

      mockAdapter.setMockResponse({
        data: unicodeData,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {},
        request: {}
      });

      const response = await mockAdapter.request({
        url: 'https://test.com',
        data: unicodeData
      });

      assert.deepStrictEqual(response.data, unicodeData);
      assert.deepStrictEqual(mockAdapter.getLastRequest().data, unicodeData);
    });

    it('should handle null and undefined values correctly', async () => {
      const testData = {
        nullValue: null,
        undefinedValue: undefined,
        emptyString: '',
        zero: 0,
        false: false
      };

      await mockAdapter.request({
        url: 'https://test.com',
        data: testData
      });

      const lastRequest = mockAdapter.getLastRequest();
      assert.strictEqual(lastRequest.data.nullValue, null);
      assert.strictEqual(lastRequest.data.undefinedValue, undefined);
      assert.strictEqual(lastRequest.data.emptyString, '');
      assert.strictEqual(lastRequest.data.zero, 0);
      assert.strictEqual(lastRequest.data.false, false);
    });

    it('should handle circular references in request data', async () => {
      const circularData = { name: 'test' };
      circularData.self = circularData;

      // Should not throw when storing circular data
      await assert.doesNotReject(async () => {
        await mockAdapter.request({
          url: 'https://test.com',
          data: circularData
        });
      });

      const lastRequest = mockAdapter.getLastRequest();
      assert.strictEqual(lastRequest.data.name, 'test');
      assert.strictEqual(lastRequest.data.self, lastRequest.data);
    });

    it('should maintain request history order', async () => {
      const urls = [
        'https://test.com/1',
        'https://test.com/2',
        'https://test.com/3',
        'https://test.com/4',
        'https://test.com/5'
      ];

      for (const url of urls) {
        await mockAdapter.request({ url, method: 'GET' });
      }

      const history = mockAdapter.getRequestHistory();
      assert.strictEqual(history.length, 5);

      for (let i = 0; i < urls.length; i++) {
        assert.strictEqual(history[i].url, urls[i], `Request ${i} should be in correct order`);
      }
    });

    it('should handle concurrent requests correctly', async () => {
      const promises = [];
      const urls = [
        'https://test.com/concurrent1',
        'https://test.com/concurrent2',
        'https://test.com/concurrent3'
      ];

      for (const url of urls) {
        promises.push(mockAdapter.request({ url, method: 'GET' }));
      }

      await Promise.all(promises);

      assert.strictEqual(mockAdapter.getRequestCount(), 3);
      assert.strictEqual(mockAdapter.getRequestHistory().length, 3);

      // All URLs should be present in history
      const historyUrls = mockAdapter.getRequestHistory().map(req => req.url);
      for (const url of urls) {
        assert(historyUrls.includes(url), `${url} should be in history`);
      }
    });

    it('should handle extremely large number of requests', async () => {
      const requestCount = 1000;
      const promises = [];

      for (let i = 0; i < requestCount; i++) {
        promises.push(mockAdapter.request({
          url: `https://test.com/${i}`,
          method: 'GET'
        }));
      }

      await Promise.all(promises);

      assert.strictEqual(mockAdapter.getRequestCount(), requestCount);
      assert.strictEqual(mockAdapter.getRequestHistory().length, requestCount);
    });
  });

  describe('Factory functions', () => {
    it('should create mock adapter with factory function', () => {
      const { createMockAdapter } = require('../../helpers/mock-adapter');
      const adapter = createMockAdapter();

      assert(adapter instanceof MockAdapter);
      assert.strictEqual(adapter.getRequestCount(), 0);
    });

    it('should create simple mock adapter with response', () => {
      const { createSimpleMockAdapter } = require('../../helpers/mock-adapter');
      const response = {
        data: { simple: true },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {},
        request: {}
      };

      const adapter = createSimpleMockAdapter(response);
      assert(typeof adapter.request === 'function');
    });
  });
});