const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert');

// Import the mock adapter helper
const { MockAdapter } = require('../../helpers/mock-adapter');

// Import from the built library
const fluxhttpModule = require('../../../dist/index.js');
const fluxhttp = fluxhttpModule.default || fluxhttpModule;

/**
 * Comprehensive unit tests for the fluxhttp core class
 * These tests cover all public methods, edge cases, and error scenarios
 */
describe('fluxhttp Core Class', () => {
  let instance;
  let mockAdapter;

  beforeEach(() => {
    mockAdapter = new MockAdapter();
    instance = new fluxhttp({ adapter: mockAdapter });
  });

  describe('Constructor', () => {
    it('should create instance with default config', () => {
      const inst = new fluxhttp();
      assert(inst instanceof fluxhttp, 'Should be instance of fluxhttp');
      assert(inst.defaults, 'Should have defaults property');
      assert(inst.interceptors, 'Should have interceptors property');
      assert(inst.interceptors.request, 'Should have request interceptors');
      assert(inst.interceptors.response, 'Should have response interceptors');
    });

    it('should merge custom config with defaults', () => {
      const customConfig = {
        baseURL: 'https://api.test.com',
        timeout: 5000,
        headers: { 'X-Custom': 'test' }
      };
      const inst = new fluxhttp(customConfig);
      
      assert.strictEqual(inst.defaults.baseURL, 'https://api.test.com');
      assert.strictEqual(inst.defaults.timeout, 5000);
      assert.strictEqual(inst.defaults.headers['x-custom'], 'test'); // Headers are normalized to lowercase
    });

    it('should handle null config gracefully', () => {
      const inst = new fluxhttp(null);
      assert(inst instanceof fluxhttp, 'Should handle null config');
      assert(inst.defaults, 'Should have defaults');
    });

    it('should handle undefined config gracefully', () => {
      const inst = new fluxhttp(undefined);
      assert(inst instanceof fluxhttp, 'Should handle undefined config');
      assert(inst.defaults, 'Should have defaults');
    });

    it('should use custom adapter if provided', () => {
      const customAdapter = { request: async () => {} };
      const inst = new fluxhttp({ adapter: customAdapter });
      // Note: adapter is private, but we can test it works through requests
      assert(inst, 'Should accept custom adapter');
    });

    it('should handle empty object config', () => {
      const inst = new fluxhttp({});
      assert(inst instanceof fluxhttp, 'Should handle empty config');
      assert(inst.defaults, 'Should have defaults');
    });
  });

  describe('request method', () => {
    it('should make request with config object', async () => {
      const config = {
        url: '/test',
        method: 'GET',
        baseURL: 'https://api.test.com'
      };

      mockAdapter.setMockResponse({
        data: { success: true },
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
        request: {}
      });

      const response = await instance.request(config);
      
      assert(response, 'Should return response');
      assert.strictEqual(mockAdapter.getLastRequest().url, 'https://api.test.com/test');
      assert.strictEqual(mockAdapter.getLastRequest().method, 'GET');
      assert.deepStrictEqual(response.data, { success: true });
    });

    it('should make request with URL string', async () => {
      instance.defaults.baseURL = 'https://api.test.com';
      
      const response = await instance.request('/test');
      
      assert(response, 'Should return response');
      assert.strictEqual(mockAdapter.getLastRequest().url, 'https://api.test.com/test');
      assert.strictEqual(mockAdapter.getLastRequest().method, 'GET');
    });

    it('should throw error when URL is missing', async () => {
      await assert.rejects(
        async () => await instance.request({}),
        { message: 'Request URL is required' }
      );
    });

    it('should throw error for empty URL string', async () => {
      await assert.rejects(
        async () => await instance.request(''),
        { message: 'Request URL is required' }
      );
    });

    it('should validate absolute URLs', async () => {
      await assert.rejects(
        async () => await instance.request({ url: 'invalid://url' }),
        { message: /Invalid URL/ }
      );
    });

    it('should throw error for relative URL without baseURL', async () => {
      await assert.rejects(
        async () => await instance.request({ url: 'test/path' }),
        { message: 'Relative URL requires baseURL: test/path' }
      );
    });

    it('should validate HTTP methods', async () => {
      await assert.rejects(
        async () => await instance.request({ url: '/test', method: 'INVALID' }),
        { message: 'Invalid HTTP method: INVALID' }
      );
    });

    it('should normalize HTTP method to uppercase', async () => {
      await instance.request({ url: 'https://test.com', method: 'get' });
      assert.strictEqual(mockAdapter.getLastRequest().method, 'GET');
    });

    it('should default to GET method', async () => {
      await instance.request({ url: 'https://test.com' });
      assert.strictEqual(mockAdapter.getLastRequest().method, 'GET');
    });

    it('should handle protocol-relative URLs', async () => {
      await instance.request({ url: '//api.test.com/path' });
      assert.strictEqual(mockAdapter.getLastRequest().url, '//api.test.com/path');
    });

    it('should merge config with defaults', async () => {
      instance.defaults.headers = { 'X-Default': 'value' };
      instance.defaults.timeout = 3000;

      await instance.request({
        url: 'https://test.com',
        headers: { 'X-Custom': 'custom' },
        timeout: 5000
      });

      const lastRequest = mockAdapter.getLastRequest();
      assert.strictEqual(lastRequest.timeout, 5000);
      assert.strictEqual(lastRequest.headers['x-default'], 'value');
      assert.strictEqual(lastRequest.headers['x-custom'], 'custom');
    });

    it('should handle malformed URLs gracefully', async () => {
      await assert.rejects(
        async () => await instance.request({ url: 'http:///malformed' }),
        { message: /Invalid URL/ }
      );
    });

    it('should handle very long URLs', async () => {
      const longPath = '/test' + '?param=value'.repeat(100);
      const url = 'https://test.com' + longPath;
      
      await instance.request({ url });
      
      const lastRequest = mockAdapter.getLastRequest();
      assert(lastRequest.url.includes(longPath), 'Should handle long URLs');
    });

    it('should handle special characters in URL', async () => {
      const specialUrl = 'https://test.com/path?name=test&value=hello%20world';
      await instance.request(specialUrl);
      assert.strictEqual(mockAdapter.getLastRequest().url, specialUrl);
    });
  });

  describe('HTTP method shortcuts', () => {
    const testUrl = 'https://api.test.com/resource';
    const testData = { key: 'value' };
    const testConfig = { headers: { 'X-Test': 'header' } };

    describe('GET method', () => {
      it('should make GET request', async () => {
        await instance.get(testUrl);
        assert.strictEqual(mockAdapter.getLastRequest().method, 'GET');
        assert.strictEqual(mockAdapter.getLastRequest().url, testUrl);
      });

      it('should accept config', async () => {
        await instance.get(testUrl, testConfig);
        assert.strictEqual(mockAdapter.getLastRequest().headers['x-test'], 'header');
      });

      it('should handle undefined config', async () => {
        await instance.get(testUrl, undefined);
        assert.strictEqual(mockAdapter.getLastRequest().method, 'GET');
      });

      it('should handle null config', async () => {
        await instance.get(testUrl, null);
        assert.strictEqual(mockAdapter.getLastRequest().method, 'GET');
      });
    });

    describe('DELETE method', () => {
      it('should make DELETE request', async () => {
        await instance.delete(testUrl);
        assert.strictEqual(mockAdapter.getLastRequest().method, 'DELETE');
        assert.strictEqual(mockAdapter.getLastRequest().url, testUrl);
      });

      it('should accept config', async () => {
        await instance.delete(testUrl, testConfig);
        assert.strictEqual(mockAdapter.getLastRequest().headers['x-test'], 'header');
      });
    });

    describe('HEAD method', () => {
      it('should make HEAD request', async () => {
        await instance.head(testUrl);
        assert.strictEqual(mockAdapter.getLastRequest().method, 'HEAD');
        assert.strictEqual(mockAdapter.getLastRequest().url, testUrl);
      });

      it('should accept config', async () => {
        await instance.head(testUrl, testConfig);
        assert.strictEqual(mockAdapter.getLastRequest().headers['x-test'], 'header');
      });
    });

    describe('OPTIONS method', () => {
      it('should make OPTIONS request', async () => {
        await instance.options(testUrl);
        assert.strictEqual(mockAdapter.getLastRequest().method, 'OPTIONS');
        assert.strictEqual(mockAdapter.getLastRequest().url, testUrl);
      });

      it('should accept config', async () => {
        await instance.options(testUrl, testConfig);
        assert.strictEqual(mockAdapter.getLastRequest().headers['x-test'], 'header');
      });
    });

    describe('POST method', () => {
      it('should make POST request with data', async () => {
        await instance.post(testUrl, testData);
        const lastRequest = mockAdapter.getLastRequest();
        assert.strictEqual(lastRequest.method, 'POST');
        assert.strictEqual(lastRequest.url, testUrl);
        assert.deepStrictEqual(lastRequest.data, testData);
      });

      it('should handle no data', async () => {
        await instance.post(testUrl);
        const lastRequest = mockAdapter.getLastRequest();
        assert.strictEqual(lastRequest.method, 'POST');
        assert.strictEqual(lastRequest.data, undefined);
      });

      it('should accept config', async () => {
        await instance.post(testUrl, testData, testConfig);
        assert.strictEqual(mockAdapter.getLastRequest().headers['x-test'], 'header');
      });

      it('should handle null data', async () => {
        await instance.post(testUrl, null, testConfig);
        assert.strictEqual(mockAdapter.getLastRequest().data, null);
      });

      it('should handle string data', async () => {
        const stringData = 'raw string data';
        await instance.post(testUrl, stringData);
        assert.strictEqual(mockAdapter.getLastRequest().data, stringData);
      });

      it('should handle FormData', async () => {
        const formData = new FormData();
        formData.append('key', 'value');
        await instance.post(testUrl, formData);
        assert.strictEqual(mockAdapter.getLastRequest().data, formData);
      });
    });

    describe('PUT method', () => {
      it('should make PUT request with data', async () => {
        await instance.put(testUrl, testData);
        const lastRequest = mockAdapter.getLastRequest();
        assert.strictEqual(lastRequest.method, 'PUT');
        assert.strictEqual(lastRequest.url, testUrl);
        assert.deepStrictEqual(lastRequest.data, testData);
      });

      it('should handle no data', async () => {
        await instance.put(testUrl);
        assert.strictEqual(mockAdapter.getLastRequest().method, 'PUT');
        assert.strictEqual(mockAdapter.getLastRequest().data, undefined);
      });

      it('should accept config', async () => {
        await instance.put(testUrl, testData, testConfig);
        assert.strictEqual(mockAdapter.getLastRequest().headers['x-test'], 'header');
      });
    });

    describe('PATCH method', () => {
      it('should make PATCH request with data', async () => {
        await instance.patch(testUrl, testData);
        const lastRequest = mockAdapter.getLastRequest();
        assert.strictEqual(lastRequest.method, 'PATCH');
        assert.strictEqual(lastRequest.url, testUrl);
        assert.deepStrictEqual(lastRequest.data, testData);
      });

      it('should handle no data', async () => {
        await instance.patch(testUrl);
        assert.strictEqual(mockAdapter.getLastRequest().method, 'PATCH');
        assert.strictEqual(mockAdapter.getLastRequest().data, undefined);
      });

      it('should accept config', async () => {
        await instance.patch(testUrl, testData, testConfig);
        assert.strictEqual(mockAdapter.getLastRequest().headers['x-test'], 'header');
      });
    });
  });

  describe('getUri method', () => {
    it('should return full URL with baseURL', () => {
      instance.defaults.baseURL = 'https://api.test.com';
      const uri = instance.getUri({ url: '/path' });
      assert.strictEqual(uri, 'https://api.test.com/path');
    });

    it('should return URL without baseURL', () => {
      const uri = instance.getUri({ url: 'https://test.com/path' });
      assert.strictEqual(uri, 'https://test.com/path');
    });

    it('should use defaults when no config provided', () => {
      instance.defaults.baseURL = 'https://api.test.com';
      instance.defaults.url = '/default-path';
      const uri = instance.getUri();
      assert.strictEqual(uri, 'https://api.test.com/default-path');
    });

    it('should override defaults with config', () => {
      instance.defaults.baseURL = 'https://api.test.com';
      const uri = instance.getUri({
        baseURL: 'https://other.com',
        url: '/path'
      });
      assert.strictEqual(uri, 'https://other.com/path');
    });

    it('should handle undefined config', () => {
      instance.defaults.baseURL = 'https://api.test.com';
      const uri = instance.getUri(undefined);
      assert.strictEqual(uri, 'https://api.test.com'); // No url, just baseURL
    });

    it('should handle query parameters', () => {
      instance.defaults.baseURL = 'https://api.test.com';
      const uri = instance.getUri({ url: '/path?param=value' });
      assert.strictEqual(uri, 'https://api.test.com/path?param=value');
    });
  });

  describe('create method', () => {
    it('should create new instance with merged config', () => {
      instance.defaults.baseURL = 'https://api.test.com';
      instance.defaults.timeout = 3000;

      const newInstance = instance.create({
        timeout: 5000,
        headers: { 'X-New': 'header' }
      });

      assert(newInstance instanceof fluxhttp, 'Should be fluxhttp instance');
      assert(newInstance !== instance, 'Should be different instance');
      assert.strictEqual(newInstance.defaults.baseURL, 'https://api.test.com');
      assert.strictEqual(newInstance.defaults.timeout, 5000);
      assert.strictEqual(newInstance.defaults.headers['x-new'], 'header');
    });

    it('should create independent instance', () => {
      const originalBaseURL = instance.defaults.baseURL;
      const newInstance = instance.create();

      // Modify original instance
      instance.defaults.baseURL = 'https://changed.com';

      // New instance should not be affected
      assert.strictEqual(newInstance.defaults.baseURL, originalBaseURL);
    });

    it('should handle undefined config', () => {
      const newInstance = instance.create();
      assert(newInstance instanceof fluxhttp, 'Should handle undefined config');
    });

    it('should handle null config', () => {
      const newInstance = instance.create(null);
      assert(newInstance instanceof fluxhttp, 'Should handle null config');
    });

    it('should create instance with different adapter', () => {
      const customAdapter = { request: async () => ({}) };
      const newInstance = instance.create({ adapter: customAdapter });
      assert(newInstance instanceof fluxhttp, 'Should accept custom adapter');
    });
  });

  describe('Interceptor integration', () => {
    it('should have request and response interceptor managers', () => {
      assert(instance.interceptors.request, 'Should have request interceptors');
      assert(instance.interceptors.response, 'Should have response interceptors');
      assert(typeof instance.interceptors.request.use === 'function');
      assert(typeof instance.interceptors.response.use === 'function');
    });

    it('should apply request interceptors', async () => {
      let interceptorCalled = false;

      instance.interceptors.request.use((config) => {
        interceptorCalled = true;
        config.headers = { ...config.headers, 'X-Intercepted': 'true' };
        return config;
      });

      await instance.get('https://test.com');

      assert(interceptorCalled, 'Request interceptor should be called');
      assert.strictEqual(mockAdapter.getLastRequest().headers['x-intercepted'], 'true');
    });

    it('should apply response interceptors', async () => {
      let interceptorCalled = false;

      mockAdapter.setMockResponse({
        data: { original: true },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {},
        request: {}
      });

      instance.interceptors.response.use((response) => {
        interceptorCalled = true;
        response.data = { ...response.data, intercepted: true };
        return response;
      });

      const response = await instance.get('https://test.com');

      assert(interceptorCalled, 'Response interceptor should be called');
      assert(response.data.original, 'Should preserve original data');
      assert(response.data.intercepted, 'Should add intercepted data');
    });

    it('should handle multiple request interceptors', async () => {
      instance.interceptors.request.use((config) => {
        config.headers = { ...config.headers, 'X-First': 'first' };
        return config;
      });

      instance.interceptors.request.use((config) => {
        config.headers = { ...config.headers, 'X-Second': 'second' };
        return config;
      });

      await instance.get('https://test.com');

      const headers = mockAdapter.getLastRequest().headers;
      assert.strictEqual(headers['x-first'], 'first');
      assert.strictEqual(headers['x-second'], 'second');
    });
  });

  describe('Error handling', () => {
    it('should propagate adapter errors', async () => {
      const error = new Error('Adapter error');
      mockAdapter.setFailure(error);

      await assert.rejects(
        async () => await instance.get('https://test.com'),
        { message: 'Adapter error' }
      );
    });

    it('should handle errors in request interceptors', async () => {
      instance.interceptors.request.use(() => {
        throw new Error('Request interceptor error');
      });

      await assert.rejects(
        async () => await instance.get('https://test.com'),
        { message: 'Request interceptor error' }
      );
    });

    it('should handle errors in response interceptors', async () => {
      instance.interceptors.response.use(() => {
        throw new Error('Response interceptor error');
      });

      await assert.rejects(
        async () => await instance.get('https://test.com'),
        { message: 'Response interceptor error' }
      );
    });

    it('should handle network timeout errors', async () => {
      const timeoutError = new Error('Timeout');
      timeoutError.code = 'ECONNABORTED';
      mockAdapter.setFailure(timeoutError);

      await assert.rejects(
        async () => await instance.get('https://test.com'),
        { message: 'Timeout' }
      );
    });
  });

  describe('Method validation', () => {
    const validMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'];

    validMethods.forEach((method) => {
      it(`should accept ${method} method`, async () => {
        await instance.request({ url: 'https://test.com', method });
        assert.strictEqual(mockAdapter.getLastRequest().method, method);
      });

      it(`should accept lowercase ${method}`, async () => {
        await instance.request({ url: 'https://test.com', method: method.toLowerCase() });
        assert.strictEqual(mockAdapter.getLastRequest().method, method);
      });
    });

    const invalidMethods = ['CONNECT', 'TRACE', 'INVALID', 'get ', ' POST', ''];

    invalidMethods.forEach((method) => {
      it(`should reject invalid method: "${method}"`, async () => {
        await assert.rejects(
          async () => await instance.request({ url: 'https://test.com', method }),
          { message: `Invalid HTTP method: ${method.toUpperCase()}` }
        );
      });
    });
  });

  describe('Edge cases and special scenarios', () => {
    it('should handle unicode data', async () => {
      const unicodeData = { text: '你好世界🌍', emoji: '😀' };
      await instance.post('https://test.com', unicodeData);
      assert.deepStrictEqual(mockAdapter.getLastRequest().data, unicodeData);
    });

    it('should handle binary data', async () => {
      const buffer = Buffer.from('binary data');
      await instance.post('https://test.com', buffer);
      assert.strictEqual(mockAdapter.getLastRequest().data, buffer);
    });

    it('should handle circular references in config gracefully', async () => {
      const config = { url: 'https://test.com' };
      config.circular = config;

      // Should not throw and should handle gracefully
      await instance.request(config);
      assert.strictEqual(mockAdapter.getLastRequest().url, 'https://test.com');
    });

    it('should handle large request bodies', async () => {
      const largeData = { 
        data: 'x'.repeat(10000),
        array: new Array(1000).fill({ key: 'value' })
      };
      
      await instance.post('https://test.com', largeData);
      assert.deepStrictEqual(mockAdapter.getLastRequest().data, largeData);
    });

    it('should preserve response data types', async () => {
      const mockData = {
        string: 'text',
        number: 42,
        boolean: true,
        null: null,
        array: [1, 2, 3],
        object: { nested: 'value' }
      };

      mockAdapter.setMockResponse({
        data: mockData,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {},
        request: {}
      });

      const response = await instance.get('https://test.com');
      assert.deepStrictEqual(response.data, mockData);
    });

    it('should handle requests without data body for POST/PUT/PATCH', async () => {
      // POST without data
      await instance.post('https://test.com');
      assert.strictEqual(mockAdapter.getLastRequest().data, undefined);

      // PUT without data
      await instance.put('https://test.com');
      assert.strictEqual(mockAdapter.getLastRequest().data, undefined);

      // PATCH without data
      await instance.patch('https://test.com');
      assert.strictEqual(mockAdapter.getLastRequest().data, undefined);
    });
  });

  describe('Configuration inheritance', () => {
    it('should properly inherit baseURL in created instances', () => {
      instance.defaults.baseURL = 'https://api.example.com';
      const child = instance.create({ timeout: 5000 });
      
      assert.strictEqual(child.defaults.baseURL, 'https://api.example.com');
      assert.strictEqual(child.defaults.timeout, 5000);
    });

    it('should allow overriding inherited config', () => {
      instance.defaults.baseURL = 'https://api.example.com';
      instance.defaults.timeout = 3000;
      
      const child = instance.create({ 
        baseURL: 'https://other-api.com',
        timeout: 5000 
      });
      
      assert.strictEqual(child.defaults.baseURL, 'https://other-api.com');
      assert.strictEqual(child.defaults.timeout, 5000);
    });

    it('should maintain separate interceptor instances', () => {
      let parentCalled = false;
      let childCalled = false;

      instance.interceptors.request.use(() => {
        parentCalled = true;
        return config;
      });

      const child = instance.create();
      child.interceptors.request.use(() => {
        childCalled = true;
        return config;
      });

      // Test that they are independent
      assert(instance.interceptors.request !== child.interceptors.request);
    });
  });
});