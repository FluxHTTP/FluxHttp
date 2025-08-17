const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert');

// Import the mock adapter helper
const { MockAdapter } = require('../../helpers/mock-adapter');

// Import from the built library
const fluxhttpModule = require('../../../dist/index.js');
const fluxhttp = fluxhttpModule.default || fluxhttpModule;
const { fluxhttpError } = fluxhttpModule;

/**
 * Comprehensive unit tests for fluxhttp instance creation
 * Tests the createfluxhttpInstance function and static methods
 */
describe('fluxhttp Instance Creation', () => {
  let mockAdapter;

  beforeEach(() => {
    mockAdapter = new MockAdapter();
  });

  describe('createfluxhttpInstance function', () => {
    it('should create a function that can make requests', async () => {
      const instance = fluxhttp.create({ adapter: mockAdapter });
      
      assert(typeof instance === 'function', 'Instance should be callable');
      
      mockAdapter.setMockResponse({
        data: { success: true },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {},
        request: {}
      });

      const response = await instance('/test');
      assert(response, 'Should return response when called as function');
      assert.strictEqual(response.data.success, true);
    });

    it('should create instance with default config', () => {
      const instance = fluxhttp.create();
      
      assert(typeof instance === 'function', 'Should be callable');
      assert(instance.defaults, 'Should have defaults property');
      assert(instance.interceptors, 'Should have interceptors property');
      assert(typeof instance.get === 'function', 'Should have get method');
      assert(typeof instance.post === 'function', 'Should have post method');
    });

    it('should create instance with custom config', () => {
      const config = {
        baseURL: 'https://api.test.com',
        timeout: 5000,
        headers: { 'X-Custom': 'test' }
      };

      const instance = fluxhttp.create(config);
      
      assert.strictEqual(instance.defaults.baseURL, 'https://api.test.com');
      assert.strictEqual(instance.defaults.timeout, 5000);
      assert.strictEqual(instance.defaults.headers['x-custom'], 'test');
    });

    it('should create instance that preserves prototype chain', () => {
      const instance = fluxhttp.create();
      
      // Should have all the expected methods
      assert(typeof instance.request === 'function');
      assert(typeof instance.get === 'function');
      assert(typeof instance.post === 'function');
      assert(typeof instance.put === 'function');
      assert(typeof instance.delete === 'function');
      assert(typeof instance.patch === 'function');
      assert(typeof instance.head === 'function');
      assert(typeof instance.options === 'function');
      assert(typeof instance.getUri === 'function');
      assert(typeof instance.create === 'function');
    });

    it('should copy all properties from context to instance', () => {
      const instance = fluxhttp.create({ adapter: mockAdapter });
      
      assert(instance.defaults, 'Should have defaults');
      assert(instance.interceptors, 'Should have interceptors');
      assert(instance.interceptors.request, 'Should have request interceptors');
      assert(instance.interceptors.response, 'Should have response interceptors');
    });

    it('should handle null config gracefully', () => {
      const instance = fluxhttp.create(null);
      
      assert(typeof instance === 'function', 'Should handle null config');
      assert(instance.defaults, 'Should have defaults');
    });

    it('should handle undefined config gracefully', () => {
      const instance = fluxhttp.create(undefined);
      
      assert(typeof instance === 'function', 'Should handle undefined config');
      assert(instance.defaults, 'Should have defaults');
    });

    it('should handle empty config object', () => {
      const instance = fluxhttp.create({});
      
      assert(typeof instance === 'function', 'Should handle empty config');
      assert(instance.defaults, 'Should have defaults');
    });
  });

  describe('Instance as function call', () => {
    it('should work when called as function with config', async () => {
      const instance = fluxhttp.create({ adapter: mockAdapter });
      
      mockAdapter.setMockResponse({
        data: { message: 'success' },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {},
        request: {}
      });

      const response = await instance({
        url: '/test',
        method: 'GET'
      });

      assert.strictEqual(response.status, 200);
      assert.strictEqual(response.data.message, 'success');
      assert.strictEqual(mockAdapter.getLastRequest().url, '/test');
      assert.strictEqual(mockAdapter.getLastRequest().method, 'GET');
    });

    it('should work when called as function with URL string', async () => {
      const instance = fluxhttp.create({ 
        adapter: mockAdapter,
        baseURL: 'https://api.test.com'
      });

      const response = await instance('/test');
      
      assert.strictEqual(mockAdapter.getLastRequest().url, 'https://api.test.com/test');
      assert.strictEqual(mockAdapter.getLastRequest().method, 'GET');
    });

    it('should support all HTTP methods when called as function', async () => {
      const instance = fluxhttp.create({ adapter: mockAdapter });

      const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'];

      for (const method of methods) {
        await instance({
          url: 'https://test.com',
          method: method
        });

        assert.strictEqual(
          mockAdapter.getLastRequest().method, 
          method,
          `Should support ${method} method`
        );
      }
    });
  });

  describe('Static method: create', () => {
    it('should create new instance with merged config', () => {
      const parent = fluxhttp.create({
        baseURL: 'https://api.test.com',
        timeout: 3000,
        headers: { 'X-Parent': 'parent' }
      });

      const child = parent.create({
        timeout: 5000,
        headers: { 'X-Child': 'child' }
      });

      assert(typeof child === 'function', 'Child should be callable');
      assert(child !== parent, 'Should be different instance');
      assert.strictEqual(child.defaults.baseURL, 'https://api.test.com');
      assert.strictEqual(child.defaults.timeout, 5000);
      assert.strictEqual(child.defaults.headers['x-parent'], 'parent');
      assert.strictEqual(child.defaults.headers['x-child'], 'child');
    });

    it('should create independent instances', () => {
      const parent = fluxhttp.create({ timeout: 3000 });
      const child = parent.create({ timeout: 5000 });

      // Modify parent
      parent.defaults.baseURL = 'https://changed.com';

      // Child should not be affected
      assert.notStrictEqual(child.defaults.baseURL, 'https://changed.com');
      assert.strictEqual(child.defaults.timeout, 5000);
    });

    it('should handle null config in create', () => {
      const parent = fluxhttp.create({ timeout: 3000 });
      const child = parent.create(null);

      assert(typeof child === 'function', 'Should handle null config');
      assert.strictEqual(child.defaults.timeout, 3000);
    });

    it('should handle undefined config in create', () => {
      const parent = fluxhttp.create({ timeout: 3000 });
      const child = parent.create(undefined);

      assert(typeof child === 'function', 'Should handle undefined config');
      assert.strictEqual(child.defaults.timeout, 3000);
    });

    it('should preserve adapter in created instances', () => {
      const customAdapter = mockAdapter;
      const parent = fluxhttp.create({ adapter: customAdapter });
      const child = parent.create();

      assert.strictEqual(child.defaults.adapter, customAdapter);
    });

    it('should allow overriding adapter in created instances', () => {
      const adapter1 = new MockAdapter();
      const adapter2 = new MockAdapter();
      
      const parent = fluxhttp.create({ adapter: adapter1 });
      const child = parent.create({ adapter: adapter2 });

      assert.strictEqual(child.defaults.adapter, adapter2);
      assert.notStrictEqual(child.defaults.adapter, adapter1);
    });
  });

  describe('Static method: isCancel', () => {
    it('should identify cancel errors by code', () => {
      const cancelError = { code: 'ECONNABORTED' };
      assert(fluxhttp.isCancel(cancelError), 'Should identify cancel errors');
    });

    it('should identify cancel errors with message', () => {
      const cancelError = { 
        code: 'ECONNABORTED',
        message: 'Request canceled'
      };
      assert(fluxhttp.isCancel(cancelError), 'Should identify cancel errors with message');
    });

    it('should not identify normal errors as cancel', () => {
      const normalError = new Error('Normal error');
      assert(!fluxhttp.isCancel(normalError), 'Should not identify normal errors');
    });

    it('should not identify other objects as cancel', () => {
      assert(!fluxhttp.isCancel({}), 'Should not identify empty object');
      assert(!fluxhttp.isCancel({ code: 'OTHER' }), 'Should not identify other codes');
      assert(!fluxhttp.isCancel(null), 'Should not identify null');
      assert(!fluxhttp.isCancel(undefined), 'Should not identify undefined');
      assert(!fluxhttp.isCancel('string'), 'Should not identify strings');
      assert(!fluxhttp.isCancel(123), 'Should not identify numbers');
    });

    it('should handle edge cases', () => {
      assert(!fluxhttp.isCancel({ code: '' }), 'Should not identify empty code');
      assert(!fluxhttp.isCancel({ code: null }), 'Should not identify null code');
      assert(!fluxhttp.isCancel({ code: undefined }), 'Should not identify undefined code');
    });
  });

  describe('Static method: all', () => {
    it('should handle Promise.all with array of promises', async () => {
      const promises = [
        Promise.resolve(1),
        Promise.resolve(2),
        Promise.resolve(3)
      ];

      const results = await fluxhttp.all(promises);
      assert.deepStrictEqual(results, [1, 2, 3]);
    });

    it('should handle Promise.all with mixed values', async () => {
      const values = [
        Promise.resolve('async'),
        'sync',
        Promise.resolve(42),
        null
      ];

      const results = await fluxhttp.all(values);
      assert.deepStrictEqual(results, ['async', 'sync', 42, null]);
    });

    it('should reject if any promise rejects', async () => {
      const promises = [
        Promise.resolve(1),
        Promise.reject(new Error('Failed')),
        Promise.resolve(3)
      ];

      await assert.rejects(
        async () => await fluxhttp.all(promises),
        { message: 'Failed' }
      );
    });

    it('should handle empty array', async () => {
      const results = await fluxhttp.all([]);
      assert.deepStrictEqual(results, []);
    });

    it('should preserve order', async () => {
      const promises = [
        new Promise(resolve => setTimeout(() => resolve('third'), 30)),
        new Promise(resolve => setTimeout(() => resolve('first'), 10)),
        new Promise(resolve => setTimeout(() => resolve('second'), 20))
      ];

      const results = await fluxhttp.all(promises);
      assert.deepStrictEqual(results, ['third', 'first', 'second']);
    });
  });

  describe('Static method: spread', () => {
    it('should spread array arguments to callback', () => {
      const add = (a, b, c) => a + b + c;
      const spreadAdd = fluxhttp.spread(add);

      const result = spreadAdd([1, 2, 3]);
      assert.strictEqual(result, 6);
    });

    it('should handle callbacks with different arity', () => {
      const concat = (...args) => args.join('-');
      const spreadConcat = fluxhttp.spread(concat);

      const result = spreadConcat(['a', 'b', 'c', 'd']);
      assert.strictEqual(result, 'a-b-c-d');
    });

    it('should handle empty arrays', () => {
      const counter = (...args) => args.length;
      const spreadCounter = fluxhttp.spread(counter);

      const result = spreadCounter([]);
      assert.strictEqual(result, 0);
    });

    it('should handle callbacks with no parameters', () => {
      const constant = () => 'constant';
      const spreadConstant = fluxhttp.spread(constant);

      const result = spreadConstant([1, 2, 3]);
      assert.strictEqual(result, 'constant');
    });

    it('should preserve callback context', () => {
      const obj = {
        value: 10,
        add: function(...args) {
          return this.value + args.reduce((sum, arg) => sum + arg, 0);
        }
      };

      const spreadAdd = fluxhttp.spread(obj.add.bind(obj));
      const result = spreadAdd([5, 15]);
      assert.strictEqual(result, 30); // 10 + 5 + 15
    });

    it('should work with array methods', () => {
      const values = [
        [1, 2, 3],
        [4, 5, 6],
        [7, 8, 9]
      ];

      const spreadMax = fluxhttp.spread(Math.max);
      const results = values.map(spreadMax);
      
      assert.deepStrictEqual(results, [3, 6, 9]);
    });
  });

  describe('Static method: isfluxhttpError', () => {
    it('should identify fluxhttpError instances', () => {
      const error = new fluxhttpError('Test error', 'TEST_CODE');
      assert(fluxhttp.isfluxhttpError(error), 'Should identify fluxhttpError');
    });

    it('should not identify normal errors', () => {
      const error = new Error('Normal error');
      assert(!fluxhttp.isfluxhttpError(error), 'Should not identify normal errors');
    });

    it('should not identify other objects', () => {
      assert(!fluxhttp.isfluxhttpError({}), 'Should not identify empty object');
      assert(!fluxhttp.isfluxhttpError(null), 'Should not identify null');
      assert(!fluxhttp.isfluxhttpError(undefined), 'Should not identify undefined');
      assert(!fluxhttp.isfluxhttpError('string'), 'Should not identify strings');
    });

    it('should handle edge cases', () => {
      const fakeError = {
        name: 'fluxhttpError',
        message: 'Fake error',
        isfluxhttpError: true
      };
      
      // Should depend on actual fluxhttpError logic, not just properties
      // The actual implementation should be more robust
      assert(!fluxhttp.isfluxhttpError(fakeError), 'Should not identify fake errors');
    });
  });

  describe('Instance method inheritance', () => {
    it('should have all HTTP methods available', async () => {
      const instance = fluxhttp.create({ adapter: mockAdapter });

      const methods = ['get', 'post', 'put', 'delete', 'patch', 'head', 'options'];

      for (const method of methods) {
        assert(
          typeof instance[method] === 'function',
          `Should have ${method} method`
        );
      }
    });

    it('should have utility methods available', () => {
      const instance = fluxhttp.create();

      assert(typeof instance.getUri === 'function', 'Should have getUri method');
      assert(typeof instance.create === 'function', 'Should have create method');
    });

    it('should have interceptor managers available', () => {
      const instance = fluxhttp.create();

      assert(instance.interceptors, 'Should have interceptors');
      assert(instance.interceptors.request, 'Should have request interceptors');
      assert(instance.interceptors.response, 'Should have response interceptors');
      assert(typeof instance.interceptors.request.use === 'function');
      assert(typeof instance.interceptors.response.use === 'function');
    });

    it('should maintain separate interceptor instances', () => {
      const instance1 = fluxhttp.create();
      const instance2 = fluxhttp.create();

      assert(
        instance1.interceptors.request !== instance2.interceptors.request,
        'Should have separate request interceptors'
      );
      assert(
        instance1.interceptors.response !== instance2.interceptors.response,
        'Should have separate response interceptors'
      );
    });
  });

  describe('Config merging in instance creation', () => {
    it('should deep merge headers', () => {
      const parent = fluxhttp.create({
        headers: {
          'Content-Type': 'application/json',
          'X-Parent': 'parent'
        }
      });

      const child = parent.create({
        headers: {
          'Authorization': 'Bearer token',
          'X-Child': 'child'
        }
      });

      const headers = child.defaults.headers;
      assert.strictEqual(headers['content-type'], 'application/json');
      assert.strictEqual(headers['x-parent'], 'parent');
      assert.strictEqual(headers['authorization'], 'Bearer token');
      assert.strictEqual(headers['x-child'], 'child');
    });

    it('should override parent config with child config', () => {
      const parent = fluxhttp.create({
        timeout: 3000,
        maxRedirects: 5
      });

      const child = parent.create({
        timeout: 5000,
        maxRedirects: 10
      });

      assert.strictEqual(child.defaults.timeout, 5000);
      assert.strictEqual(child.defaults.maxRedirects, 10);
    });

    it('should preserve parent config when not overridden', () => {
      const parent = fluxhttp.create({
        baseURL: 'https://api.test.com',
        timeout: 3000,
        maxRedirects: 5
      });

      const child = parent.create({
        timeout: 5000
      });

      assert.strictEqual(child.defaults.baseURL, 'https://api.test.com');
      assert.strictEqual(child.defaults.timeout, 5000);
      assert.strictEqual(child.defaults.maxRedirects, 5);
    });
  });

  describe('Error scenarios', () => {
    it('should handle errors during instance creation', () => {
      // Test with extremely malformed config
      const malformedConfig = {
        baseURL: 'not-a-url',
        timeout: 'not-a-number',
        headers: 'not-an-object'
      };

      // Should not throw during creation
      assert.doesNotThrow(() => {
        fluxhttp.create(malformedConfig);
      });
    });

    it('should maintain functionality even with partial config errors', async () => {
      const instance = fluxhttp.create({
        adapter: mockAdapter,
        baseURL: 'https://api.test.com',
        invalidProperty: 'should be ignored'
      });

      const response = await instance.get('/test');
      assert(response, 'Should still work with invalid properties');
    });
  });
});