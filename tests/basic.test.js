const { describe, it } = require('node:test');
const assert = require('node:assert');

// Import the built library
const fluxhttpModule = require('../dist/index.js');
const fluxhttp = fluxhttpModule.default || fluxhttpModule;
const { fluxhttpError } = fluxhttpModule;

describe('FluxHTTP Basic Functionality', () => {
  it('should export default fluxhttp function', () => {
    assert(typeof fluxhttp === 'function', 'fluxhttp should be a function');
  });

  it('should have create method', () => {
    assert(typeof fluxhttp.create === 'function', 'fluxhttp.create should be a function');
  });

  it('should create instances with HTTP methods', () => {
    const instance = fluxhttp.create();
    
    assert(typeof instance === 'function', 'instance should be a function');
    assert(typeof instance.get === 'function', 'instance.get should be a function');
    assert(typeof instance.post === 'function', 'instance.post should be a function');
    assert(typeof instance.put === 'function', 'instance.put should be a function');
    assert(typeof instance.delete === 'function', 'instance.delete should be a function');
    assert(typeof instance.patch === 'function', 'instance.patch should be a function');
    assert(typeof instance.head === 'function', 'instance.head should be a function');
    assert(typeof instance.options === 'function', 'instance.options should be a function');
  });

  it('should have defaults property', () => {
    const instance = fluxhttp.create();
    assert(instance.defaults, 'instance should have defaults property');
    assert(typeof instance.defaults === 'object', 'defaults should be an object');
  });

  it('should have interceptors property', () => {
    const instance = fluxhttp.create();
    assert(instance.interceptors, 'instance should have interceptors property');
    assert(instance.interceptors.request, 'should have request interceptors');
    assert(instance.interceptors.response, 'should have response interceptors');
  });

  it('should create instance with custom config', () => {
    const config = {
      baseURL: 'https://api.example.com',
      timeout: 5000,
      headers: {
        'Content-Type': 'application/json',
        'X-Custom': 'header'
      }
    };

    const instance = fluxhttp.create(config);
    
    assert.strictEqual(instance.defaults.baseURL, 'https://api.example.com');
    assert.strictEqual(instance.defaults.timeout, 5000);
    // Headers are normalized to lowercase
    assert.strictEqual(instance.defaults.headers['content-type'], 'application/json');
    assert.strictEqual(instance.defaults.headers['x-custom'], 'header');
  });

  it('should support static utility methods', () => {
    assert(typeof fluxhttp.isCancel === 'function', 'should have isCancel method');
    assert(typeof fluxhttp.all === 'function', 'should have all method');
    assert(typeof fluxhttp.spread === 'function', 'should have spread method');
    assert(typeof fluxhttp.isfluxhttpError === 'function', 'should have isfluxhttpError method');
  });

  it('should handle mock adapter correctly', async () => {
    const mockAdapter = async (config) => {
      return {
        data: { message: 'success', url: config.url },
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
        request: {}
      };
    };

    const instance = fluxhttp.create({ adapter: mockAdapter });
    const response = await instance.get('/test');

    assert.strictEqual(response.status, 200);
    assert.strictEqual(response.data.message, 'success');
    assert.strictEqual(response.data.url, '/test');
  });

  it('should handle interceptors', async () => {
    const mockAdapter = async (config) => ({
      data: { original: true },
      status: 200,
      statusText: 'OK',
      headers: {},
      config,
      request: {}
    });

    const instance = fluxhttp.create({ adapter: mockAdapter });

    // Add request interceptor
    instance.interceptors.request.use((config) => {
      config.headers = config.headers || {};
      config.headers['X-Intercepted'] = 'true';
      return config;
    });

    // Add response interceptor
    instance.interceptors.response.use((response) => {
      response.data.intercepted = true;
      return response;
    });

    const response = await instance.get('/test');

    assert(response.data.intercepted, 'response should be intercepted');
    assert(response.data.original, 'original data should be preserved');
  });
});

describe('FluxHTTP Error Handling', () => {
  it('should export fluxhttpError', () => {
    assert(fluxhttpError, 'should export fluxhttpError');
    assert(typeof fluxhttpError === 'function', 'fluxhttpError should be a constructor');
  });

  it('should handle adapter errors', async () => {
    const errorAdapter = async () => {
      throw new Error('Adapter failed');
    };

    const instance = fluxhttp.create({ adapter: errorAdapter });

    try {
      await instance.get('/test');
      assert.fail('Should have thrown an error');
    } catch (error) {
      assert(error instanceof Error);
      assert.strictEqual(error.message, 'Adapter failed');
    }
  });

  it('should identify cancel errors', () => {
    const cancelError = { code: 'ECONNABORTED' };
    assert(fluxhttp.isCancel(cancelError), 'should identify cancel errors');

    const normalError = new Error('Normal error');
    assert(!fluxhttp.isCancel(normalError), 'should not identify normal errors as cancel');
  });
});

describe('FluxHTTP Utility Methods', () => {
  it('should handle Promise.all with fluxhttp.all', async () => {
    const promises = [
      Promise.resolve(1),
      Promise.resolve(2),
      Promise.resolve(3)
    ];

    const results = await fluxhttp.all(promises);
    assert.deepStrictEqual(results, [1, 2, 3]);
  });

  it('should spread array arguments with fluxhttp.spread', () => {
    const callback = (a, b, c) => a + b + c;
    const spreadCallback = fluxhttp.spread(callback);

    const result = spreadCallback([1, 2, 3]);
    assert.strictEqual(result, 6);
  });

  it('should identify fluxhttp errors', () => {
    const fluxhttpErr = new fluxhttpError('Test error', 'TEST_CODE');
    assert(fluxhttp.isfluxhttpError(fluxhttpErr), 'should identify fluxhttp errors');

    const normalError = new Error('Normal error');
    assert(!fluxhttp.isfluxhttpError(normalError), 'should not identify normal errors');
  });
});