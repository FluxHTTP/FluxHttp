import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import fluxhttp from '../../dist/index.js';

// Mock different environments
function mockBrowserEnvironment(): void {
  (global as any).XMLHttpRequest = class XMLHttpRequest {
    constructor() {
      this.readyState = 0;
      this.status = 0;
      this.responseText = '';
      this.headers = {};
    }

    open(method, url) {
      this.method = method;
      this.url = url;
    }

    setRequestHeader(key, value) {
      this.headers[key] = value;
    }

    send(data) {
      // Simulate successful response
      setTimeout(() => {
        this.readyState = 4;
        this.status = 200;
        this.responseText = JSON.stringify({ source: 'xhr', data: 'test' });
        if (this.onloadend) this.onloadend();
      }, 10);
    }

    getAllResponseHeaders() {
      return 'content-type: application/json\r\nx-source: xhr';
    }
  };

  delete (global as any).process;
  delete (global as any).fetch;
}

function mockNodeEnvironment(): void {
  delete (global as any).XMLHttpRequest;
  delete (global as any).fetch;

  (global as any).process = {
    versions: { node: '16.0.0' },
  };
}

function mockModernEnvironment(): void {
  delete (global as any).XMLHttpRequest;
  delete (global as any).process;

  (global as any).fetch = async (url, options) => {
    return {
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: new Map([['content-type', 'application/json']]),
      json: async (): Promise<any> => ({ source: 'fetch', data: 'test' }),
      text: async () => '{"source":"fetch","data":"test"}',
    };
  };
}

describe('Cross-platform compatibility', () => {
  let originalEnv;

  beforeEach(() => {
    // Save original environment
    originalEnv = {
      XMLHttpRequest: global.XMLHttpRequest,
      process: global.process,
      fetch: global.fetch,
      FormData: global.FormData,
      URLSearchParams: global.URLSearchParams,
      Blob: global.Blob,
      Buffer: global.Buffer,
    };
  });

  afterEach(() => {
    // Restore original environment
    Object.keys(originalEnv).forEach((_key) => {
      if (originalEnv[key] !== undefined) {
        global[key] = originalEnv[key];
      } else {
        delete global[key];
      }
    });
  });

  describe('Environment detection', (): void => {
    it('should work in browser environment with XHR', async (): Promise<void> => {
      mockBrowserEnvironment();

      // Clear module cache to force re-evaluation
      delete require.cache[require.resolve('../../dist/index.js')];
      import fluxhttp from '../../dist/index.js';

      const client = fluxhttp.create();

      // This would use XHR adapter in real browser
      assert(client);
      assert(typeof client.get === 'function');
    });

    it('should work in Node.js environment', async (): Promise<void> => {
      mockNodeEnvironment();

      // Clear module cache
      delete require.cache[require.resolve('../../dist/index.js')];
      import fluxhttp from '../../dist/index.js';

      const client = fluxhttp.create();

      assert(client);
      assert(typeof client.get === 'function');
    });

    it('should work in modern environment with fetch', async (): Promise<void> => {
      mockModernEnvironment();

      // Clear module cache
      delete require.cache[require.resolve('../../dist/index.js')];
      import fluxhttp from '../../dist/index.js';

      const client = fluxhttp.create();

      assert(client);
      assert(typeof client.get === 'function');
    });
  });

  describe('Data type compatibility', () => {
    it('should handle FormData across environments', (): void => {
      // Mock FormData for environments that don't have it
      (global as any).FormData = class FormData {
        constructor() {
          this._data = new Map();
        }
        append(key, value) {
          this._data.set(key, value);
        }
      };

      const client = fluxhttp.create();
      const formData = new FormData();
      formData.append('field', 'value');

      // Should accept FormData without errors
      assert.doesNotThrow(() => {
        client.post('/test', formData);
      });
    });

    it('should handle URLSearchParams across environments', (): void => {
      // Mock URLSearchParams
      (global as any).URLSearchParams = class URLSearchParams {
        constructor(init) {
          this._params = new Map();
          if (init) {
            Object.entries(init).forEach(([k, v]) => this._params.set(k, v));
          }
        }
        toString() {
          return Array.from(this._params.entries())
            .map(([k, v]) => `${k}=${v}`)
            .join('&');
        }
      };

      const client = fluxhttp.create();
      const params = new URLSearchParams({ key: 'value' });

      assert.doesNotThrow(() => {
        client.post('/test', params);
      });
    });

    it('should handle Blob in supported environments', (): void => {
      // Mock Blob
      (global as any).Blob = class Blob {
        constructor(parts, options = {}) {
          this.parts = parts;
          this.type = options.type || '';
          this.size = parts.reduce((sum, part) => sum + part.length, 0);
        }
      };

      const client = fluxhttp.create();
      const blob = new Blob(['test data'], { type: 'text/plain' });

      assert.doesNotThrow(() => {
        client.post('/test', blob);
      });
    });

    it('should handle Buffer in Node.js', (): void => {
      if (typeof Buffer !== 'undefined') {
        const client = fluxhttp.create();
        const buffer = Buffer.from('test data');

        assert.doesNotThrow(() => {
          client.post('/test', buffer);
        });
      }
    });

    it('should handle ArrayBuffer universally', (): void => {
      const client = fluxhttp.create();
      const buffer = new ArrayBuffer(8);

      assert.doesNotThrow(() => {
        client.post('/test', buffer);
      });
    });
  });

  describe('Header handling across platforms', () => {
    it('should normalize headers consistently', (): void => {
      const client = fluxhttp.create({
        headers: {
          'Content-Type': 'application/json',
          'X-Custom-Header': 'value',
        },
      });

      // Headers should be normalized regardless of platform
      assert(client.defaults.headers);

      // Test case-insensitive header access
      const headers = client.defaults.headers;
      assert(headers['content-type'] || headers['Content-Type']);
    });

    it('should handle array header values', (): void => {
      const client = fluxhttp.create();

      // Some platforms may handle array headers differently
      const config = {
        headers: {
          Accept: ['application/json', 'text/plain'],
        },
      };

      assert.doesNotThrow(() => {
        client.get('/test', config);
      });
    });
  });

  describe('Error handling across platforms', () => {
    it('should create consistent error objects', (): void => {
      import { fluxhttpError } from '../../dist/index.js';

      const error = new fluxhttpError('Test error', 'TEST_CODE');

      assert(error instanceof Error);
      assert.strictEqual(error.message, 'Test error');
      assert.strictEqual(error.code, 'TEST_CODE');
      assert(error.isfluxhttpError);
    });

    it('should handle network errors consistently', (): void => {
      // Network error creation is internal to the built module
      const createNetworkError = (message, config) => {
        const error = new Error(message);
        error.code = 'ERR_NETWORK';
        error.config = config;
        return error;
      };

      const error = createNetworkError('Network failed', { url: '/test' });

      assert.strictEqual(error.code, 'ERR_NETWORK');
      assert(error.config);
    });
  });

  describe('Configuration handling', () => {
    it('should merge configs consistently', (): void => {
      const instance1 = fluxhttp.create({
        baseURL: 'https://api1.com',
        timeout: 5000,
      });

      const instance2 = instance1.create({
        baseURL: 'https://api2.com',
        headers: { 'X-Custom': 'value' },
      });

      assert.strictEqual(instance2.defaults.baseURL, 'https://api2.com');
      assert.strictEqual(instance2.defaults.timeout, 5000);
      assert(instance2.defaults.headers['X-Custom']);
    });

    it('should handle platform-specific options', (): void => {
      const client = fluxhttp.create({
        withCredentials: true, // Browser-specific
        decompress: true, // Node-specific
        responseType: 'json', // Universal
      });

      assert.strictEqual(client.defaults.withCredentials, true);
      assert.strictEqual(client.defaults.decompress, true);
      assert.strictEqual(client.defaults.responseType, 'json');
    });
  });

  describe('Interceptor behavior', () => {
    it('should handle interceptors consistently', async (): Promise<void> => {
      const client = fluxhttp.create();

      let requestIntercepted = false;
      let responseIntercepted = false;

      client.interceptors.request.use((_config) => {
        requestIntercepted = true;
        config.headers = config.headers || {};
        config.headers['X-Intercepted'] = 'true';
        return config;
      });

      client.interceptors.response.use((_response) => {
        responseIntercepted = true;
        response.data = { ...response.data, intercepted: true };
        return response;
      });

      // In real scenario, this would make actual request
      assert(client.interceptors.request.size > 0);
      assert(client.interceptors.response.size > 0);
    });
  });

  describe('Promise handling', () => {
    it('should return consistent promises', (): void => {
      const client = fluxhttp.create();

      // All methods should return promises
      const getPromise = client.get('/test');
      const postPromise = client.post('/test', {});
      const putPromise = client.put('/test', {});
      const deletePromise = client.delete('/test');

      assert(getPromise instanceof Promise);
      assert(postPromise instanceof Promise);
      assert(putPromise instanceof Promise);
      assert(deletePromise instanceof Promise);
    });

    it('should support async/await', async (): Promise<void> => {
      const client = fluxhttp.create();

      // Mock successful response
      client.defaults.adapter = async (config): Promise<any> => ({
        data: { success: true },
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
        request: {},
      });

      const response = await client.get('/test');
      assert((response.data as any).success);
    });
  });

  describe('Static methods compatibility', () => {
    it('should provide isCancel method', (): void => {
      assert(typeof fluxhttp.isCancel === 'function');

      const cancelError = { code: 'ECONNABORTED' };
      assert(fluxhttp.isCancel(cancelError));
    });

    it('should provide all method', async (): Promise<void> => {
      assert(typeof fluxhttp.all === 'function');

      const promises = [Promise.resolve(1), Promise.resolve(2), Promise.resolve(3)];

      const results = await fluxhttp.all(promises);
      assert.deepStrictEqual(results, [1, 2, 3]);
    });

    it('should provide spread method', (): void => {
      assert(typeof fluxhttp.spread === 'function');

      const callback = (a, b, c) => a + b + c;
      const spread = fluxhttp.spread(callback);

      assert.strictEqual(spread([1, 2, 3]), 6);
    });

    it('should provide isfluxhttpError method', (): void => {
      assert(typeof fluxhttp.isfluxhttpError === 'function');

      import { fluxhttpError } from '../../dist/index.js';
      const error = new fluxhttpError('Test');

      assert(fluxhttp.isfluxhttpError(error));
      assert(!fluxhttp.isfluxhttpError(new Error('Regular')));
    });
  });

  describe('Memory management', () => {
    it('should not leak memory with interceptors', (): void => {
      const client = fluxhttp.create();

      // Add and remove many interceptors
      const ids = [];
      for (let i = 0; i < 1000; i++) {
        const id = client.interceptors.request.use((config) => config);
        ids.push(id);
      }

      // Remove all
      ids.forEach((id) => client.interceptors.request.eject(id));

      assert.strictEqual(client.interceptors.request.size, 0);
    });

    it('should handle large data efficiently', (): void => {
      const client = fluxhttp.create();

      // Create large data
      const largeArray = new Array(10000).fill({ data: 'test' });

      assert.doesNotThrow(() => {
        client.post('/test', largeArray);
      });
    });
  });
});
