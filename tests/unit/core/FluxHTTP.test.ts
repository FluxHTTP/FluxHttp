import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import fluxhttp from '../../../dist/index.js';

// Mock adapter for testing
class MockAdapter {
  constructor() {
    this.lastRequest = null;
    this.mockResponse = null;
    this.shouldFail = false;
    this.failureError = null;
  }

  setMockResponse(response) {
    this.mockResponse = response;
  }

  setFailure(error) {
    this.shouldFail = true;
    this.failureError = error;
  }

  async request(config) {
    this.lastRequest = config;

    if (this.shouldFail) {
      throw this.failureError || new Error('Mock adapter failure');
    }

    return (
      this.mockResponse || {
        data: {},
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
        request: {},
      }
    );
  }
}

describe('fluxhttp Core Class', () => {
  let instance;
  let mockAdapter;

  beforeEach(() => {
    mockAdapter = new MockAdapter();
    instance = new fluxhttp({ adapter: mockAdapter });
  });

  describe('Constructor', (): void => {
    it('should create instance with default config', (): void => {
      const inst = new fluxhttp();
      assert(inst instanceof fluxhttp);
      assert(inst.defaults);
      assert(inst.interceptors);
      assert(inst.interceptors.request);
      assert(inst.interceptors.response);
    });

    it('should merge custom config with defaults', (): void => {
      const customConfig = {
        baseURL: 'https://api.test.com',
        timeout: 5000,
        headers: { 'X-Custom': 'test' },
      };
      const inst = new fluxhttp(customConfig);
      assert.strictEqual(inst.defaults.baseURL, 'https://api.test.com');
      assert.strictEqual(inst.defaults.timeout, 5000);
      assert.strictEqual(inst.defaults.headers['X-Custom'], 'test');
    });

    it('should handle null config', (): void => {
      const inst = new fluxhttp(null);
      assert(inst instanceof fluxhttp);
      assert(inst.defaults);
    });

    it('should handle undefined config', (): void => {
      const inst = new fluxhttp(undefined);
      assert(inst instanceof fluxhttp);
      assert(inst.defaults);
    });

    it('should use custom adapter if provided', (): void => {
      const customAdapter = { request: async () => {} };
      const inst = new fluxhttp({ adapter: customAdapter });
      assert.strictEqual(inst.adapter, customAdapter);
    });
  });

  describe('request method', () => {
    it('should make request with config object', async (): Promise<void> => {
      const config = {
        url: '/test',
        method: 'GET',
        baseURL: 'https://api.test.com',
      };

      const response = await instance.request(config);
      assert(response);
      assert.strictEqual(mockAdapter.lastRequest.url, 'https://api.test.com/test');
      assert.strictEqual(mockAdapter.lastRequest.method, 'GET');
    });

    it('should make request with URL string', async (): Promise<void> => {
      instance.defaults.baseURL = 'https://api.test.com';
      const response = await instance.request('/test');
      assert(response);
      assert.strictEqual(mockAdapter.lastRequest.url, 'https://api.test.com/test');
      assert.strictEqual(mockAdapter.lastRequest.method, 'GET');
    });

    it('should throw error when URL is missing', async (): Promise<void> => {
      await assert.rejects(async () => await instance.request({}), {
        message: 'Request URL is required',
      });
    });

    it('should validate absolute URLs', async (): Promise<void> => {
      await assert.rejects(async () => await instance.request({ url: 'invalid://url' }), {
        message: 'Invalid URL: invalid://url',
      });
    });

    it('should throw error for relative URL without baseURL', async (): Promise<void> => {
      await assert.rejects(async () => await instance.request({ url: 'test/path' }), {
        message: 'Relative URL requires baseURL: test/path',
      });
    });

    it('should validate HTTP methods', async (): Promise<void> => {
      await assert.rejects(
        async () => await instance.request({ url: '/test', method: 'INVALID' }),
        { message: 'Invalid HTTP method: INVALID' }
      );
    });

    it('should normalize HTTP method to uppercase', async (): Promise<void> => {
      await instance.request({ url: 'https://test.com', method: 'get' });
      assert.strictEqual(mockAdapter.lastRequest.method, 'GET');
    });

    it('should default to GET method', async (): Promise<void> => {
      await instance.request({ url: 'https://test.com' });
      assert.strictEqual(mockAdapter.lastRequest.method, 'GET');
    });

    it('should handle protocol-relative URLs', async (): Promise<void> => {
      await instance.request({ url: '//api.test.com/path' });
      assert.strictEqual(mockAdapter.lastRequest.url, '//api.test.com/path');
    });

    it('should merge config with defaults', async (): Promise<void> => {
      instance.defaults.headers = { 'X-Default': 'value' };
      instance.defaults.timeout = 3000;

      await instance.request({
        url: 'https://test.com',
        headers: { 'X-Custom': 'custom' },
        timeout: 5000,
      });

      assert.strictEqual(mockAdapter.lastRequest.timeout, 5000);
      assert.strictEqual(mockAdapter.lastRequest.headers['X-Default'], 'value');
      assert.strictEqual(mockAdapter.lastRequest.headers['X-Custom'], 'custom');
    });

    it('should support typed responses', async (): Promise<void> => {
      mockAdapter.setMockResponse({
        data: { id: 1, name: 'Test' },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {},
        request: {},
      });

      const response = await instance.request({ url: 'https://test.com' });
      assert.strictEqual((response.data as any).id, 1);
      assert.strictEqual((response.data as any).name, 'Test');
    });
  });

  describe('HTTP method shortcuts', () => {
    const testUrl = 'https://api.test.com/resource';
    const testData = { key: 'value' };
    const testConfig = { headers: { 'X-Test': 'header' } };

    describe('GET method', () => {
      it('should make GET request', async (): Promise<void> => {
        await instance.get(testUrl);
        assert.strictEqual(mockAdapter.lastRequest.method, 'GET');
        assert.strictEqual(mockAdapter.lastRequest.url, testUrl);
      });

      it('should accept config', async (): Promise<void> => {
        await instance.get(testUrl, testConfig);
        assert.strictEqual(mockAdapter.lastRequest.headers['X-Test'], 'header');
      });

      it('should handle undefined config', async (): Promise<void> => {
        await instance.get(testUrl, undefined);
        assert.strictEqual(mockAdapter.lastRequest.method, 'GET');
      });
    });

    describe('DELETE method', () => {
      it('should make DELETE request', async (): Promise<void> => {
        await instance.delete(testUrl);
        assert.strictEqual(mockAdapter.lastRequest.method, 'DELETE');
        assert.strictEqual(mockAdapter.lastRequest.url, testUrl);
      });

      it('should accept config', async (): Promise<void> => {
        await instance.delete(testUrl, testConfig);
        assert.strictEqual(mockAdapter.lastRequest.headers['X-Test'], 'header');
      });
    });

    describe('HEAD method', () => {
      it('should make HEAD request', async (): Promise<void> => {
        await instance.head(testUrl);
        assert.strictEqual(mockAdapter.lastRequest.method, 'HEAD');
        assert.strictEqual(mockAdapter.lastRequest.url, testUrl);
      });

      it('should accept config', async (): Promise<void> => {
        await instance.head(testUrl, testConfig);
        assert.strictEqual(mockAdapter.lastRequest.headers['X-Test'], 'header');
      });
    });

    describe('OPTIONS method', () => {
      it('should make OPTIONS request', async (): Promise<void> => {
        await instance.options(testUrl);
        assert.strictEqual(mockAdapter.lastRequest.method, 'OPTIONS');
        assert.strictEqual(mockAdapter.lastRequest.url, testUrl);
      });

      it('should accept config', async (): Promise<void> => {
        await instance.options(testUrl, testConfig);
        assert.strictEqual(mockAdapter.lastRequest.headers['X-Test'], 'header');
      });
    });

    describe('POST method', () => {
      it('should make POST request with data', async (): Promise<void> => {
        await instance.post(testUrl, testData);
        assert.strictEqual(mockAdapter.lastRequest.method, 'POST');
        assert.strictEqual(mockAdapter.lastRequest.url, testUrl);
        assert.deepStrictEqual(mockAdapter.lastRequest.data, testData);
      });

      it('should handle no data', async (): Promise<void> => {
        await instance.post(testUrl);
        assert.strictEqual(mockAdapter.lastRequest.method, 'POST');
        assert.strictEqual(mockAdapter.lastRequest.data, undefined);
      });

      it('should accept config', async (): Promise<void> => {
        await instance.post(testUrl, testData, testConfig);
        assert.strictEqual(mockAdapter.lastRequest.headers['X-Test'], 'header');
      });

      it('should handle null data', async (): Promise<void> => {
        await instance.post(testUrl, null, testConfig);
        assert.strictEqual(mockAdapter.lastRequest.data, null);
      });
    });

    describe('PUT method', () => {
      it('should make PUT request with data', async (): Promise<void> => {
        await instance.put(testUrl, testData);
        assert.strictEqual(mockAdapter.lastRequest.method, 'PUT');
        assert.strictEqual(mockAdapter.lastRequest.url, testUrl);
        assert.deepStrictEqual(mockAdapter.lastRequest.data, testData);
      });

      it('should handle no data', async (): Promise<void> => {
        await instance.put(testUrl);
        assert.strictEqual(mockAdapter.lastRequest.method, 'PUT');
        assert.strictEqual(mockAdapter.lastRequest.data, undefined);
      });

      it('should accept config', async (): Promise<void> => {
        await instance.put(testUrl, testData, testConfig);
        assert.strictEqual(mockAdapter.lastRequest.headers['X-Test'], 'header');
      });
    });

    describe('PATCH method', () => {
      it('should make PATCH request with data', async (): Promise<void> => {
        await instance.patch(testUrl, testData);
        assert.strictEqual(mockAdapter.lastRequest.method, 'PATCH');
        assert.strictEqual(mockAdapter.lastRequest.url, testUrl);
        assert.deepStrictEqual(mockAdapter.lastRequest.data, testData);
      });

      it('should handle no data', async (): Promise<void> => {
        await instance.patch(testUrl);
        assert.strictEqual(mockAdapter.lastRequest.method, 'PATCH');
        assert.strictEqual(mockAdapter.lastRequest.data, undefined);
      });

      it('should accept config', async (): Promise<void> => {
        await instance.patch(testUrl, testData, testConfig);
        assert.strictEqual(mockAdapter.lastRequest.headers['X-Test'], 'header');
      });
    });
  });

  describe('getUri method', () => {
    it('should return full URL with baseURL', (): void => {
      instance.defaults.baseURL = 'https://api.test.com';
      const uri = instance.getUri({ url: '/path' });
      assert.strictEqual(uri, 'https://api.test.com/path');
    });

    it('should return URL without baseURL', (): void => {
      const uri = instance.getUri({ url: 'https://test.com/path' });
      assert.strictEqual(uri, 'https://test.com/path');
    });

    it('should use defaults when no config provided', (): void => {
      instance.defaults.baseURL = 'https://api.test.com';
      instance.defaults.url = '/default-path';
      const uri = instance.getUri();
      assert.strictEqual(uri, 'https://api.test.com/default-path');
    });

    it('should override defaults with config', (): void => {
      instance.defaults.baseURL = 'https://api.test.com';
      const uri = instance.getUri({
        baseURL: 'https://other.com',
        url: '/path',
      });
      assert.strictEqual(uri, 'https://other.com/path');
    });
  });

  describe('create method', () => {
    it('should create new instance with merged config', (): void => {
      instance.defaults.baseURL = 'https://api.test.com';
      instance.defaults.timeout = 3000;

      const newInstance = instance.create({
        timeout: 5000,
        headers: { 'X-New': 'header' },
      });

      assert(newInstance instanceof fluxhttp);
      assert(newInstance !== instance);
      assert.strictEqual(newInstance.defaults.baseURL, 'https://api.test.com');
      assert.strictEqual(newInstance.defaults.timeout, 5000);
      assert.strictEqual(newInstance.defaults.headers['X-New'], 'header');
    });

    it('should create independent instance', (): void => {
      const newInstance = instance.create();

      // Modify original instance
      instance.defaults.baseURL = 'https://changed.com';

      // New instance should not be affected
      assert.notStrictEqual(newInstance.defaults.baseURL, 'https://changed.com');
    });

    it('should handle undefined config', (): void => {
      const newInstance = instance.create();
      assert(newInstance instanceof fluxhttp);
    });

    it('should preserve adapter in new instance', (): void => {
      const customAdapter = { request: async () => {} };
      instance.defaults.adapter = customAdapter;

      const newInstance = instance.create();
      assert.strictEqual(newInstance.defaults.adapter, customAdapter);
    });
  });

  describe('Interceptor integration', () => {
    it('should have request and response interceptor managers', (): void => {
      assert(instance.interceptors.request);
      assert(instance.interceptors.response);
      assert(typeof instance.interceptors.request.use === 'function');
      assert(typeof instance.interceptors.response.use === 'function');
    });

    it('should apply request interceptors', async (): Promise<void> => {
      let interceptorCalled = false;

      instance.interceptors.request.use((_config) => {
        interceptorCalled = true;
        config.headers = { ...config.headers, 'X-Intercepted': 'true' };
        return config;
      });

      await instance.get('https://test.com');

      assert(interceptorCalled);
      assert.strictEqual(mockAdapter.lastRequest.headers['X-Intercepted'], 'true');
    });

    it('should apply response interceptors', async (): Promise<void> => {
      let interceptorCalled = false;

      mockAdapter.setMockResponse({
        data: { original: true },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {},
        request: {},
      });

      instance.interceptors.response.use((_response) => {
        interceptorCalled = true;
        response.data = { ...response.data, intercepted: true };
        return response;
      });

      const response = await instance.get('https://test.com');

      assert(interceptorCalled);
      assert((response.data as any).original);
      assert((response.data as any).intercepted);
    });
  });

  describe('Error handling', () => {
    it('should propagate adapter errors', async (): Promise<void> => {
      const error = new Error('Adapter error');
      mockAdapter.setFailure(error);

      await assert.rejects(async () => await instance.get('https://test.com'), {
        message: 'Adapter error',
      });
    });

    it('should handle errors in interceptors', async (): Promise<void> => {
      instance.interceptors.request.use(() => {
        throw new Error('Interceptor error');
      });

      await assert.rejects(async () => await instance.get('https://test.com'), {
        message: 'Interceptor error',
      });
    });
  });

  describe('Edge cases', () => {
    it('should handle empty string URL', async (): Promise<void> => {
      await assert.rejects(async () => await instance.request(''), {
        message: 'Request URL is required',
      });
    });

    it('should handle very long URLs', async (): Promise<void> => {
      const longPath = '/test' + '?param=value'.repeat(100);
      const response = await instance.request({
        baseURL: 'https://test.com',
        url: longPath,
      });
      assert(response);
      assert(mockAdapter.lastRequest.url.includes(longPath));
    });

    it('should handle special characters in URL', async (): Promise<void> => {
      const specialUrl = 'https://test.com/path?name=test&value=hello%20world';
      await instance.request(specialUrl);
      assert.strictEqual(mockAdapter.lastRequest.url, specialUrl);
    });

    it('should handle unicode in request data', async (): Promise<void> => {
      const unicodeData = { text: '你好世界🌍', emoji: '😀' };
      await instance.post('https://test.com', unicodeData);
      assert.deepStrictEqual(mockAdapter.lastRequest.data, unicodeData);
    });

    it('should handle circular references in config', async (): Promise<void> => {
      const config = { url: 'https://test.com' };
      config.circular = config;

      // Should not throw and should handle gracefully
      await instance.request(config);
      assert.strictEqual(mockAdapter.lastRequest.url, 'https://test.com');
    });
  });

  describe('Method validation', () => {
    const validMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'];

    validMethods.forEach((_method) => {
      it(`should accept ${method} method`, async (): Promise<void> => {
        await instance.request({ url: 'https://test.com', method });
        assert.strictEqual(mockAdapter.lastRequest.method, method);
      });

      it(`should accept lowercase ${method}`, async (): Promise<void> => {
        await instance.request({ url: 'https://test.com', method: method.toLowerCase() });
        assert.strictEqual(mockAdapter.lastRequest.method, method);
      });
    });

    const invalidMethods = ['CONNECT', 'TRACE', 'INVALID', 'get ', ' POST', ''];

    invalidMethods.forEach((_method) => {
      it(`should reject invalid method: "${method}"`, async (): Promise<void> => {
        await assert.rejects(
          async () => await instance.request({ url: 'https://test.com', method }),
          { message: `Invalid HTTP method: ${method.toUpperCase()}` }
        );
      });
    });
  });
});
