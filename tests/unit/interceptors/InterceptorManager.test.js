const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert');

// Import the mock adapter helper for testing integration
const { MockAdapter } = require('../../helpers/mock-adapter');

// Import the main library to test InterceptorManager through fluxhttp
const fluxhttpModule = require('../../../dist/index.js');
const fluxhttp = fluxhttpModule.default || fluxhttpModule;

/**
 * Comprehensive unit tests for InterceptorManager
 * Tests interceptor registration, removal, execution, and integration
 */
describe('InterceptorManager', () => {
  let instance;
  let mockAdapter;
  let requestInterceptors;
  let responseInterceptors;

  beforeEach(() => {
    mockAdapter = new MockAdapter();
    instance = fluxhttp.create({ adapter: mockAdapter });
    requestInterceptors = instance.interceptors.request;
    responseInterceptors = instance.interceptors.response;
  });

  describe('Basic functionality', () => {
    it('should have interceptor managers on instance', () => {
      assert(instance.interceptors, 'Should have interceptors object');
      assert(instance.interceptors.request, 'Should have request interceptors');
      assert(instance.interceptors.response, 'Should have response interceptors');
    });

    it('should have required methods on interceptor managers', () => {
      const methods = ['use', 'eject', 'clear'];
      
      methods.forEach(method => {
        assert(typeof requestInterceptors[method] === 'function', `Request interceptors should have ${method} method`);
        assert(typeof responseInterceptors[method] === 'function', `Response interceptors should have ${method} method`);
      });
    });

    it('should start with empty interceptor collections', () => {
      // Check if they start empty (size property might not be exposed, so we test behavior)
      let requestCount = 0;
      let responseCount = 0;

      requestInterceptors.forEach(() => requestCount++);
      responseInterceptors.forEach(() => responseCount++);

      assert.strictEqual(requestCount, 0, 'Should start with no request interceptors');
      assert.strictEqual(responseCount, 0, 'Should start with no response interceptors');
    });
  });

  describe('Interceptor registration (use method)', () => {
    it('should register request interceptors and return ID', () => {
      const handler = (config) => config;
      const id = requestInterceptors.use(handler);

      assert(typeof id === 'number', 'Should return numeric ID');
      assert(id >= 0, 'ID should be non-negative');
    });

    it('should register response interceptors and return ID', () => {
      const handler = (response) => response;
      const id = responseInterceptors.use(handler);

      assert(typeof id === 'number', 'Should return numeric ID');
      assert(id >= 0, 'ID should be non-negative');
    });

    it('should return unique IDs for each interceptor', () => {
      const handler1 = (value) => value;
      const handler2 = (value) => value;
      const handler3 = (value) => value;

      const id1 = requestInterceptors.use(handler1);
      const id2 = requestInterceptors.use(handler2);
      const id3 = responseInterceptors.use(handler3);

      assert.notStrictEqual(id1, id2, 'Request interceptor IDs should be unique');
      assert.notStrictEqual(id1, id3, 'Interceptor IDs should be unique across managers');
      assert.notStrictEqual(id2, id3, 'Interceptor IDs should be unique across managers');
    });

    it('should allow registering fulfilled handler only', () => {
      const fulfilledHandler = (config) => {
        config.intercepted = true;
        return config;
      };

      const id = requestInterceptors.use(fulfilledHandler);
      assert(typeof id === 'number', 'Should return ID for fulfilled-only handler');
    });

    it('should allow registering rejected handler only', () => {
      const rejectedHandler = (error) => {
        error.intercepted = true;
        return Promise.reject(error);
      };

      const id = requestInterceptors.use(undefined, rejectedHandler);
      assert(typeof id === 'number', 'Should return ID for rejected-only handler');
    });

    it('should allow registering both fulfilled and rejected handlers', () => {
      const fulfilledHandler = (config) => config;
      const rejectedHandler = (error) => Promise.reject(error);

      const id = requestInterceptors.use(fulfilledHandler, rejectedHandler);
      assert(typeof id === 'number', 'Should return ID for both handlers');
    });

    it('should allow registering interceptors with options', () => {
      const handler = (config) => config;
      const options = { synchronous: true };

      const id = requestInterceptors.use(handler, undefined, options);
      assert(typeof id === 'number', 'Should return ID when options provided');
    });

    it('should allow registering empty interceptors', () => {
      const id = requestInterceptors.use();
      assert(typeof id === 'number', 'Should return ID even with no handlers');
    });
  });

  describe('Interceptor removal (eject method)', () => {
    it('should remove interceptors by ID', () => {
      const handler = (config) => config;
      const id = requestInterceptors.use(handler);

      // Verify it exists by checking count before removal
      let countBefore = 0;
      requestInterceptors.forEach(() => countBefore++);

      requestInterceptors.eject(id);

      let countAfter = 0;
      requestInterceptors.forEach(() => countAfter++);

      assert.strictEqual(countAfter, countBefore - 1, 'Should remove one interceptor');
    });

    it('should handle ejecting non-existent ID gracefully', () => {
      assert.doesNotThrow(() => {
        requestInterceptors.eject(999);
      }, 'Should not throw when ejecting non-existent ID');
    });

    it('should handle ejecting already ejected ID gracefully', () => {
      const handler = (config) => config;
      const id = requestInterceptors.use(handler);

      requestInterceptors.eject(id);
      
      assert.doesNotThrow(() => {
        requestInterceptors.eject(id);
      }, 'Should not throw when ejecting already ejected ID');
    });

    it('should not affect other interceptors when ejecting', () => {
      const handler1 = (config) => { config.handler1 = true; return config; };
      const handler2 = (config) => { config.handler2 = true; return config; };
      const handler3 = (config) => { config.handler3 = true; return config; };

      const id1 = requestInterceptors.use(handler1);
      const id2 = requestInterceptors.use(handler2);
      const id3 = requestInterceptors.use(handler3);

      requestInterceptors.eject(id2);

      // Test that remaining interceptors still work
      let remainingCount = 0;
      requestInterceptors.forEach(() => remainingCount++);

      assert.strictEqual(remainingCount, 2, 'Should have 2 remaining interceptors');
    });
  });

  describe('Clearing all interceptors (clear method)', () => {
    it('should remove all request interceptors', () => {
      requestInterceptors.use((config) => config);
      requestInterceptors.use((config) => config);
      requestInterceptors.use((config) => config);

      requestInterceptors.clear();

      let count = 0;
      requestInterceptors.forEach(() => count++);

      assert.strictEqual(count, 0, 'Should have no interceptors after clear');
    });

    it('should remove all response interceptors', () => {
      responseInterceptors.use((response) => response);
      responseInterceptors.use((response) => response);
      responseInterceptors.use((response) => response);

      responseInterceptors.clear();

      let count = 0;
      responseInterceptors.forEach(() => count++);

      assert.strictEqual(count, 0, 'Should have no interceptors after clear');
    });

    it('should not affect other interceptor managers when clearing', () => {
      requestInterceptors.use((config) => config);
      requestInterceptors.use((config) => config);
      responseInterceptors.use((response) => response);
      responseInterceptors.use((response) => response);

      requestInterceptors.clear();

      let requestCount = 0;
      let responseCount = 0;
      requestInterceptors.forEach(() => requestCount++);
      responseInterceptors.forEach(() => responseCount++);

      assert.strictEqual(requestCount, 0, 'Request interceptors should be cleared');
      assert.strictEqual(responseCount, 2, 'Response interceptors should remain');
    });

    it('should handle clearing empty interceptor collection', () => {
      assert.doesNotThrow(() => {
        requestInterceptors.clear();
      }, 'Should not throw when clearing empty collection');
    });
  });

  describe('Interceptor execution and integration', () => {
    it('should execute request interceptors during requests', async () => {
      let interceptorCalled = false;
      
      const requestHandler = (config) => {
        interceptorCalled = true;
        config.headers = { ...config.headers, 'X-Intercepted': 'true' };
        return config;
      };

      requestInterceptors.use(requestHandler);

      await instance.get('https://api.test.com/test');

      assert(interceptorCalled, 'Request interceptor should be called');
      assert.strictEqual(mockAdapter.getLastRequest().headers['x-intercepted'], 'true');
    });

    it('should execute response interceptors during requests', async () => {
      let interceptorCalled = false;

      mockAdapter.setMockResponse({
        data: { original: true },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {},
        request: {}
      });

      const responseHandler = (response) => {
        interceptorCalled = true;
        response.data = { ...response.data, intercepted: true };
        return response;
      };

      responseInterceptors.use(responseHandler);

      const response = await instance.get('https://api.test.com/test');

      assert(interceptorCalled, 'Response interceptor should be called');
      assert(response.data.original, 'Should preserve original data');
      assert(response.data.intercepted, 'Should add intercepted data');
    });

    it('should execute multiple request interceptors in order', async () => {
      const executionOrder = [];

      const handler1 = (config) => {
        executionOrder.push('handler1');
        config.headers = { ...config.headers, 'X-Handler1': 'true' };
        return config;
      };

      const handler2 = (config) => {
        executionOrder.push('handler2');
        config.headers = { ...config.headers, 'X-Handler2': 'true' };
        return config;
      };

      const handler3 = (config) => {
        executionOrder.push('handler3');
        config.headers = { ...config.headers, 'X-Handler3': 'true' };
        return config;
      };

      requestInterceptors.use(handler1);
      requestInterceptors.use(handler2);
      requestInterceptors.use(handler3);

      await instance.get('https://api.test.com/test');

      assert.deepStrictEqual(executionOrder, ['handler1', 'handler2', 'handler3']);
      const headers = mockAdapter.getLastRequest().headers;
      assert.strictEqual(headers['x-handler1'], 'true');
      assert.strictEqual(headers['x-handler2'], 'true');
      assert.strictEqual(headers['x-handler3'], 'true');
    });

    it('should execute multiple response interceptors in order', async () => {
      const executionOrder = [];

      mockAdapter.setMockResponse({
        data: { start: true },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {},
        request: {}
      });

      const handler1 = (response) => {
        executionOrder.push('response1');
        response.data = { ...response.data, step1: true };
        return response;
      };

      const handler2 = (response) => {
        executionOrder.push('response2');
        response.data = { ...response.data, step2: true };
        return response;
      };

      const handler3 = (response) => {
        executionOrder.push('response3');
        response.data = { ...response.data, step3: true };
        return response;
      };

      responseInterceptors.use(handler1);
      responseInterceptors.use(handler2);
      responseInterceptors.use(handler3);

      const response = await instance.get('https://api.test.com/test');

      assert.deepStrictEqual(executionOrder, ['response1', 'response2', 'response3']);
      assert(response.data.start, 'Should preserve original data');
      assert(response.data.step1, 'Should apply first interceptor');
      assert(response.data.step2, 'Should apply second interceptor');
      assert(response.data.step3, 'Should apply third interceptor');
    });

    it('should handle async interceptors', async () => {
      const asyncRequestHandler = async (config) => {
        await new Promise(resolve => setTimeout(resolve, 10));
        config.headers = { ...config.headers, 'X-Async': 'true' };
        return config;
      };

      const asyncResponseHandler = async (response) => {
        await new Promise(resolve => setTimeout(resolve, 10));
        response.data = { ...response.data, async: true };
        return response;
      };

      requestInterceptors.use(asyncRequestHandler);
      responseInterceptors.use(asyncResponseHandler);

      mockAdapter.setMockResponse({
        data: { original: true },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {},
        request: {}
      });

      const response = await instance.get('https://api.test.com/test');

      assert.strictEqual(mockAdapter.getLastRequest().headers['x-async'], 'true');
      assert(response.data.async, 'Should handle async response interceptor');
    });
  });

  describe('Error handling in interceptors', () => {
    it('should handle errors in request interceptors', async () => {
      const errorHandler = () => {
        throw new Error('Request interceptor error');
      };

      requestInterceptors.use(errorHandler);

      await assert.rejects(
        async () => await instance.get('https://api.test.com/test'),
        { message: 'Request interceptor error' }
      );
    });

    it('should handle errors in response interceptors', async () => {
      const errorHandler = () => {
        throw new Error('Response interceptor error');
      };

      responseInterceptors.use(errorHandler);

      await assert.rejects(
        async () => await instance.get('https://api.test.com/test'),
        { message: 'Response interceptor error' }
      );
    });

    it('should call rejected handlers for request errors', async () => {
      let rejectedCalled = false;
      let rejectedError = null;

      const fulfilledHandler = () => {
        throw new Error('Fulfilled handler error');
      };

      const rejectedHandler = (error) => {
        rejectedCalled = true;
        rejectedError = error;
        return Promise.reject(error);
      };

      requestInterceptors.use(fulfilledHandler, rejectedHandler);

      try {
        await instance.get('https://api.test.com/test');
        assert.fail('Should have thrown error');
      } catch (error) {
        assert(rejectedCalled, 'Rejected handler should be called');
        assert.strictEqual(rejectedError.message, 'Fulfilled handler error');
      }
    });

    it('should call rejected handlers for response errors', async () => {
      let rejectedCalled = false;
      let rejectedError = null;

      const fulfilledHandler = () => {
        throw new Error('Response interceptor error');
      };

      const rejectedHandler = (error) => {
        rejectedCalled = true;
        rejectedError = error;
        return Promise.reject(error);
      };

      responseInterceptors.use(fulfilledHandler, rejectedHandler);

      try {
        await instance.get('https://api.test.com/test');
        assert.fail('Should have thrown error');
      } catch (error) {
        assert(rejectedCalled, 'Rejected handler should be called');
        assert.strictEqual(rejectedError.message, 'Response interceptor error');
      }
    });

    it('should allow rejected handlers to recover from errors', async () => {
      const fulfilledHandler = () => {
        throw new Error('Interceptor error');
      };

      const rejectedHandler = (error) => {
        // Recover by returning a valid config/response
        if (error.message === 'Interceptor error') {
          return { url: 'https://api.test.com/test', method: 'GET', recovered: true };
        }
        return Promise.reject(error);
      };

      requestInterceptors.use(fulfilledHandler, rejectedHandler);

      // Should not throw since rejected handler recovers
      const response = await instance.get('https://api.test.com/test');
      assert(response, 'Should get response after recovery');
    });
  });

  describe('Interceptor isolation between instances', () => {
    it('should maintain separate interceptors for different instances', async () => {
      const instance1 = fluxhttp.create({ adapter: new MockAdapter() });
      const instance2 = fluxhttp.create({ adapter: new MockAdapter() });

      let instance1Called = false;
      let instance2Called = false;

      instance1.interceptors.request.use((config) => {
        instance1Called = true;
        return config;
      });

      instance2.interceptors.request.use((config) => {
        instance2Called = true;
        return config;
      });

      await instance1.get('https://api.test.com/test1');
      assert(instance1Called, 'Instance 1 interceptor should be called');
      assert(!instance2Called, 'Instance 2 interceptor should not be called');

      instance1Called = false;
      instance2Called = false;

      await instance2.get('https://api.test.com/test2');
      assert(!instance1Called, 'Instance 1 interceptor should not be called');
      assert(instance2Called, 'Instance 2 interceptor should be called');
    });

    it('should not share interceptors when creating instances from instances', () => {
      const parent = fluxhttp.create({ adapter: mockAdapter });
      const child = parent.create();

      let parentCalled = false;
      let childCalled = false;

      parent.interceptors.request.use((config) => {
        parentCalled = true;
        return config;
      });

      child.interceptors.request.use((config) => {
        childCalled = true;
        return config;
      });

      // They should have different interceptor managers
      assert(parent.interceptors.request !== child.interceptors.request);
    });
  });

  describe('Advanced interceptor scenarios', () => {
    it('should handle interceptors that modify request method', async () => {
      const methodChanger = (config) => {
        if (config.method === 'GET') {
          config.method = 'POST';
          config.data = { converted: true };
        }
        return config;
      };

      requestInterceptors.use(methodChanger);

      await instance.get('https://api.test.com/test');

      const lastRequest = mockAdapter.getLastRequest();
      assert.strictEqual(lastRequest.method, 'POST');
      assert.deepStrictEqual(lastRequest.data, { converted: true });
    });

    it('should handle interceptors that modify response status', async () => {
      mockAdapter.setMockResponse({
        data: { message: 'success' },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {},
        request: {}
      });

      const statusModifier = (response) => {
        response.status = 201;
        response.statusText = 'Created';
        return response;
      };

      responseInterceptors.use(statusModifier);

      const response = await instance.get('https://api.test.com/test');

      assert.strictEqual(response.status, 201);
      assert.strictEqual(response.statusText, 'Created');
    });

    it('should handle interceptors that completely replace request config', async () => {
      const configReplacer = () => {
        return {
          url: 'https://different.com/api',
          method: 'POST',
          data: { replaced: true },
          headers: { 'X-Replaced': 'true' }
        };
      };

      requestInterceptors.use(configReplacer);

      await instance.get('https://api.test.com/original');

      const lastRequest = mockAdapter.getLastRequest();
      assert.strictEqual(lastRequest.url, 'https://different.com/api');
      assert.strictEqual(lastRequest.method, 'POST');
      assert.deepStrictEqual(lastRequest.data, { replaced: true });
      assert.strictEqual(lastRequest.headers['x-replaced'], 'true');
    });

    it('should handle interceptors that completely replace response', async () => {
      mockAdapter.setMockResponse({
        data: { original: true },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {},
        request: {}
      });

      const responseReplacer = () => {
        return {
          data: { replaced: true },
          status: 202,
          statusText: 'Accepted',
          headers: { 'X-Replaced': 'true' },
          config: {},
          request: {}
        };
      };

      responseInterceptors.use(responseReplacer);

      const response = await instance.get('https://api.test.com/test');

      assert.deepStrictEqual(response.data, { replaced: true });
      assert.strictEqual(response.status, 202);
      assert.strictEqual(response.statusText, 'Accepted');
      assert.strictEqual(response.headers['X-Replaced'], 'true');
    });

    it('should handle chained async transformations', async () => {
      const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

      const asyncTransform1 = async (config) => {
        await delay(10);
        config.step1 = Date.now();
        return config;
      };

      const asyncTransform2 = async (config) => {
        await delay(10);
        config.step2 = Date.now();
        return config;
      };

      const asyncTransform3 = async (config) => {
        await delay(10);
        config.step3 = Date.now();
        return config;
      };

      requestInterceptors.use(asyncTransform1);
      requestInterceptors.use(asyncTransform2);
      requestInterceptors.use(asyncTransform3);

      await instance.get('https://api.test.com/test');

      const lastRequest = mockAdapter.getLastRequest();
      assert(lastRequest.step1, 'Should have step1 timestamp');
      assert(lastRequest.step2, 'Should have step2 timestamp');
      assert(lastRequest.step3, 'Should have step3 timestamp');
      assert(lastRequest.step1 <= lastRequest.step2, 'Steps should be in order');
      assert(lastRequest.step2 <= lastRequest.step3, 'Steps should be in order');
    });
  });

  describe('Edge cases and robustness', () => {
    it('should handle interceptors returning Promise.resolve', async () => {
      const promiseReturner = (config) => {
        return Promise.resolve({ ...config, promiseReturned: true });
      };

      requestInterceptors.use(promiseReturner);

      await instance.get('https://api.test.com/test');

      assert(mockAdapter.getLastRequest().promiseReturned, 'Should handle Promise.resolve');
    });

    it('should handle interceptors returning Promise.reject', async () => {
      const promiseRejecter = () => {
        return Promise.reject(new Error('Promise rejected'));
      };

      requestInterceptors.use(promiseRejecter);

      await assert.rejects(
        async () => await instance.get('https://api.test.com/test'),
        { message: 'Promise rejected' }
      );
    });

    it('should handle interceptors that return undefined', async () => {
      const undefinedReturner = () => {
        // Explicitly return undefined
        return undefined;
      };

      requestInterceptors.use(undefinedReturner);

      // Should handle gracefully (though behavior depends on implementation)
      await assert.doesNotReject(async () => {
        await instance.get('https://api.test.com/test');
      });
    });

    it('should handle interceptors that modify non-enumerable properties', async () => {
      const propAdder = (config) => {
        Object.defineProperty(config, 'nonEnumerable', {
          value: 'hidden',
          enumerable: false,
          writable: true,
          configurable: true
        });
        return config;
      };

      requestInterceptors.use(propAdder);

      await instance.get('https://api.test.com/test');

      const lastRequest = mockAdapter.getLastRequest();
      assert.strictEqual(lastRequest.nonEnumerable, 'hidden');
    });

    it('should handle very large number of interceptors', async () => {
      const interceptorCount = 100;
      const counters = [];

      for (let i = 0; i < interceptorCount; i++) {
        counters.push(0);
        const index = i;
        requestInterceptors.use((config) => {
          counters[index]++;
          return config;
        });
      }

      await instance.get('https://api.test.com/test');

      // All interceptors should have been called exactly once
      counters.forEach((count, index) => {
        assert.strictEqual(count, 1, `Interceptor ${index} should be called once`);
      });
    });

    it('should maintain performance with many interceptors', async () => {
      // Add many simple interceptors
      for (let i = 0; i < 50; i++) {
        requestInterceptors.use((config) => {
          config[`step${i}`] = true;
          return config;
        });
      }

      const startTime = Date.now();
      await instance.get('https://api.test.com/test');
      const endTime = Date.now();

      // Should complete reasonably quickly (adjust threshold as needed)
      const duration = endTime - startTime;
      assert(duration < 1000, `Should complete in reasonable time, took ${duration}ms`);
    });
  });
});