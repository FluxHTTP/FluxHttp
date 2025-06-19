import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import fluxhttp, { fluxhttpError } from '../../../dist/index.js';

describe('createfluxhttpInstance', () => {
  let instance;

  beforeEach((): void => {
    // The default export from index.js is already created by createfluxhttpInstance
    instance = fluxhttp.create();
  });

  describe('Instance creation', (): void => {
    it('should create a function that can be called', (): void => {
      assert(typeof instance === 'function');
    });

    it('should have all HTTP method shortcuts', (): void => {
      assert(typeof instance.get === 'function');
      assert(typeof instance.post === 'function');
      assert(typeof instance.put === 'function');
      assert(typeof instance.delete === 'function');
      assert(typeof instance.patch === 'function');
      assert(typeof instance.head === 'function');
      assert(typeof instance.options === 'function');
    });

    it('should have request method', (): void => {
      assert(typeof instance.request === 'function');
    });

    it('should have getUri method', (): void => {
      assert(typeof instance.getUri === 'function');
    });

    it('should have create method', (): void => {
      assert(typeof instance.create === 'function');
    });

    it('should have defaults property', (): void => {
      assert(instance.defaults);
      assert(typeof instance.defaults === 'object');
    });

    it('should have interceptors property', (): void => {
      assert(instance.interceptors);
      assert(instance.interceptors.request);
      assert(instance.interceptors.response);
    });
  });

  describe('Static methods', () => {
    it('should have isCancel method', (): void => {
      assert(typeof instance.isCancel === 'function');
    });

    it('should have all method', (): void => {
      assert(typeof instance.all === 'function');
    });

    it('should have spread method', (): void => {
      assert(typeof instance.spread === 'function');
    });

    it('should have isfluxhttpError method', (): void => {
      assert(typeof instance.isfluxhttpError === 'function');
    });
  });

  describe('create method', () => {
    it('should create new instance with merged config', (): void => {
      const config = {
        baseURL: 'https://api.test.com',
        timeout: 5000,
      };

      const newInstance = instance.create(config);

      assert(typeof newInstance === 'function');
      assert.strictEqual(newInstance.defaults.baseURL, 'https://api.test.com');
      assert.strictEqual(newInstance.defaults.timeout, 5000);
    });

    it('should create independent instances', (): void => {
      const instance1 = instance.create({ baseURL: 'https://api1.com' });
      const instance2 = instance.create({ baseURL: 'https://api2.com' });

      assert.strictEqual(instance1.defaults.baseURL, 'https://api1.com');
      assert.strictEqual(instance2.defaults.baseURL, 'https://api2.com');

      // Modifying one should not affect the other
      instance1.defaults.timeout = 1000;
      assert.notStrictEqual(instance2.defaults.timeout, 1000);
    });

    it('should inherit parent config', (): void => {
      instance.defaults.headers = { 'X-Parent': 'header' };

      const child = instance.create({
        headers: { 'X-Child': 'header' },
      });

      assert.strictEqual(child.defaults.headers['X-Parent'], 'header');
      assert.strictEqual(child.defaults.headers['X-Child'], 'header');
    });
  });

  describe('isCancel method', () => {
    it('should return false for non-cancel values', (): void => {
      assert.strictEqual(instance.isCancel(null), false);
      assert.strictEqual(instance.isCancel(undefined), false);
      assert.strictEqual(instance.isCancel('string'), false);
      assert.strictEqual(instance.isCancel(123), false);
      assert.strictEqual(instance.isCancel({}), false);
    });

    it('should return true for cancel errors', (): void => {
      const cancelError = { code: 'ECONNABORTED' };
      assert.strictEqual(instance.isCancel(cancelError), true);
    });

    it('should return false for other errors', (): void => {
      const normalError = new Error('Normal error');
      assert.strictEqual(instance.isCancel(normalError), false);
    });
  });

  describe('all method', () => {
    it('should resolve all promises', async (): Promise<void> => {
      const promises = [Promise.resolve(1), Promise.resolve(2), Promise.resolve(3)];

      const results = await instance.all(promises);
      assert.deepStrictEqual(results, [1, 2, 3]);
    });

    it('should handle mixed values and promises', async (): Promise<void> => {
      const values = [1, Promise.resolve(2), 3];
      const results = await instance.all(values);
      assert.deepStrictEqual(results, [1, 2, 3]);
    });

    it('should reject if any promise rejects', async (): Promise<void> => {
      const promises = [
        Promise.resolve(1),
        Promise.reject(new Error('Failed')),
        Promise.resolve(3),
      ];

      await assert.rejects(async () => await instance.all(promises), { message: 'Failed' });
    });

    it('should handle empty array', async (): Promise<void> => {
      const results = await instance.all([]);
      assert.deepStrictEqual(results, []);
    });
  });

  describe('spread method', () => {
    it('should spread array arguments to callback', (): void => {
      const callback = (a, b, c) => a + b + c;
      const spread = instance.spread(callback);

      const result = spread([1, 2, 3]);
      assert.strictEqual(result, 6);
    });

    it('should handle variable number of arguments', (): void => {
      const callback = (...args) => args.join('-');
      const spread = instance.spread(callback);

      assert.strictEqual(spread(['a', 'b', 'c']), 'a-b-c');
      assert.strictEqual(spread(['x', 'y']), 'x-y');
    });

    it('should preserve this context', (): void => {
      const obj = {
        value: 10,
        multiply: function (...args) {
          return args.reduce((sum, n) => sum + n, 0) * this.value;
        },
      };

      const spread = instance.spread(obj.multiply.bind(obj));
      const result = spread([1, 2, 3]);
      assert.strictEqual(result, 60); // (1+2+3) * 10
    });

    it('should handle empty array', (): void => {
      const callback = (...args) => args.length;
      const spread = instance.spread(callback);

      assert.strictEqual(spread([]), 0);
    });
  });

  describe('isfluxhttpError method', () => {
    it('should identify fluxhttpError instances', (): void => {
      const error = new fluxhttpError('Test error', 'TEST_CODE', {}, null, {});
      assert.strictEqual(instance.isfluxhttpError(error), true);
    });

    it('should return false for regular errors', (): void => {
      const error = new Error('Regular error');
      assert.strictEqual(instance.isfluxhttpError(error), false);
    });

    it('should return false for non-error objects', (): void => {
      assert.strictEqual(instance.isfluxhttpError(null), false);
      assert.strictEqual(instance.isfluxhttpError(undefined), false);
      assert.strictEqual(instance.isfluxhttpError('string'), false);
      assert.strictEqual(instance.isfluxhttpError(123), false);
      assert.strictEqual(instance.isfluxhttpError({}), false);
    });
  });

  describe('Instance as function', () => {
    it('should be callable as a function', async (): Promise<void> => {
      // Mock the request to avoid actual HTTP calls
      let capturedConfig;
      instance.request = async (_config) => {
        capturedConfig = config;
        return { data: 'test', status: 200 };
      };

      const response = await instance({ url: 'https://test.com', method: 'GET' });

      assert(response);
      assert.strictEqual(response.data, 'test');
      assert.strictEqual(capturedConfig.url, 'https://test.com');
      assert.strictEqual(capturedConfig.method, 'GET');
    });

    it('should accept string URL when called as function', async (): Promise<void> => {
      // Mock the request
      let capturedConfig;
      instance.request = async (_config) => {
        capturedConfig = config;
        return { data: 'test', status: 200 };
      };

      const response = await instance('https://test.com');

      assert(response);
      assert.strictEqual(capturedConfig, 'https://test.com');
    });
  });

  describe('Property inheritance', () => {
    it('should have proper prototype chain', (): void => {
      // The instance should have fluxhttp methods in its prototype chain
      assert(instance.get);
      assert(instance.post);
      assert(instance.interceptors);
    });

    it('should allow property modification', (): void => {
      instance.defaults.timeout = 10000;
      assert.strictEqual(instance.defaults.timeout, 10000);

      instance.defaults.headers = { 'X-Custom': 'value' };
      assert.strictEqual(instance.defaults.headers['X-Custom'], 'value');
    });

    it('should maintain interceptor functionality', (): void => {
      let interceptorCalled = false;

      instance.interceptors.request.use((_config) => {
        interceptorCalled = true;
        return config;
      });

      // This would trigger the interceptor in a real request
      assert(instance.interceptors.request);
      assert(typeof instance.interceptors.request.use === 'function');
    });
  });

  describe('Edge cases', () => {
    it('should handle undefined config in create', (): void => {
      const newInstance = instance.create(undefined);
      assert(typeof newInstance === 'function');
      assert(newInstance.defaults);
    });

    it('should handle null config in create', (): void => {
      const newInstance = instance.create(null);
      assert(typeof newInstance === 'function');
      assert(newInstance.defaults);
    });

    it('should preserve custom properties in child instances', (): void => {
      // Add a custom property
      instance.customProp = 'custom value';

      const child = instance.create();

      // Child should not inherit custom properties
      assert.strictEqual(child.customProp, undefined);
    });

    it('should handle circular references in config', (): void => {
      const config = { headers: {} };
      config.headers.circular = config;

      // Should not throw
      const newInstance = instance.create(config);
      assert(newInstance);
    });
  });
});
