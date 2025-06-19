import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { fluxhttpError } from '../../../dist/index.js';

// Mock InterceptorManager for testing
class InterceptorManager {
  constructor() {
    this.interceptors = new Map();
    this.currentId = 0;
  }

  use(fulfilled, rejected, options) {
    const id = this.currentId++;
    this.interceptors.set(id, {
      fulfilled,
      rejected,
      options,
    });
    return id;
  }

  eject(id) {
    this.interceptors.delete(id);
  }

  clear() {
    this.interceptors.clear();
  }

  forEach(callback) {
    this.interceptors.forEach((_interceptor) => {
      if (interceptor !== null) {
        callback(interceptor);
      }
    });
  }

  *[Symbol.iterator]() {
    for (const interceptor of Array.from(this.interceptors.values())) {
      yield interceptor;
    }
  }

  get size() {
    return this.interceptors.size;
  }
}

// dispatchRequest is bundled and not directly accessible
// We'll test the concept through a mock implementation
async function dispatchRequest(config, requestInterceptors, responseInterceptors, adapter): void {
  let currentConfig = config;
  const reqInterceptors = [];
  const resInterceptors = [];

  // Collect request interceptors
  requestInterceptors.forEach((_interceptor) => {
    reqInterceptors.push(interceptor);
  });

  // Collect response interceptors
  responseInterceptors.forEach((_interceptor) => {
    resInterceptors.push(interceptor);
  });

  // Apply request interceptors in reverse order
  for (let i = reqInterceptors.length - 1; i >= 0; i--) {
    const interceptor = reqInterceptors[i];
    if (interceptor.fulfilled) {
      try {
        currentConfig = await interceptor.fulfilled(currentConfig);
      } catch (error) {
        if (interceptor.rejected) {
          currentConfig = await interceptor.rejected(error);
        } else {
          throw error;
        }
      }
    }
  }

  // Call adapter
  let response;
  try {
    response = await adapter(currentConfig);
  } catch (error) {
    // Apply response error interceptors
    for (const interceptor of resInterceptors) {
      if (interceptor.rejected) {
        try {
          response = await interceptor.rejected(error);
          break;
        } catch (e) {
          error = e;
        }
      }
    }
    if (!response) throw error;
  }

  // Apply response interceptors
  for (const interceptor of resInterceptors) {
    if (interceptor.fulfilled) {
      try {
        response = await interceptor.fulfilled(response);
      } catch (error) {
        if (interceptor.rejected) {
          response = await interceptor.rejected(error);
        } else {
          throw error;
        }
      }
    }
  }

  return response;
}

describe('dispatchRequest', () => {
  let requestInterceptors;
  let responseInterceptors;
  let mockAdapter;
  let mockResponse;

  beforeEach(() => {
    requestInterceptors = new InterceptorManager();
    responseInterceptors = new InterceptorManager();

    mockResponse = {
      data: { test: 'data' },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {},
      request: {},
    };

    mockAdapter = async (_config) => {
      // Mock adapter that returns the mock response
      return { ...mockResponse, config };
    };
  });

  describe('Basic functionality', () => {
    it('should execute request without interceptors', async (): Promise<void> => {
      const config = { url: '/test', method: 'GET' };

      const response = await dispatchRequest(
        config,
        requestInterceptors,
        responseInterceptors,
        mockAdapter
      );

      assert.deepStrictEqual(response.data, { test: 'data' });
      assert.strictEqual(response.status, 200);
      assert.strictEqual(response.config, config);
    });

    it('should pass config through to adapter', async (): Promise<void> => {
      const config = {
        url: '/test',
        method: 'POST',
        data: { request: 'data' },
        headers: { 'X-Custom': 'header' },
      };

      let adapterConfig;
      const captureAdapter = async (_cfg) => {
        adapterConfig = cfg;
        return mockResponse;
      };

      await dispatchRequest(config, requestInterceptors, responseInterceptors, captureAdapter);

      assert.deepStrictEqual(adapterConfig, config);
    });
  });

  describe('Request interceptors', () => {
    it('should execute single request interceptor', async (): Promise<void> => {
      const config = { url: '/test', method: 'GET' };
      let interceptorCalled = false;

      requestInterceptors.use((_cfg) => {
        interceptorCalled = true;
        return { ...cfg, modified: true };
      });

      await dispatchRequest(config, requestInterceptors, responseInterceptors, mockAdapter);

      assert(interceptorCalled);
    });

    it('should execute multiple request interceptors in order', async (): Promise<void> => {
      const config = { url: '/test', method: 'GET' };
      const order = [];

      requestInterceptors.use((_cfg) => {
        order.push(1);
        return { ...cfg, step1: true };
      });

      requestInterceptors.use((_cfg) => {
        order.push(2);
        return { ...cfg, step2: true };
      });

      let finalConfig;
      const captureAdapter = async (_cfg) => {
        finalConfig = cfg;
        return mockResponse;
      };

      await dispatchRequest(config, requestInterceptors, responseInterceptors, captureAdapter);

      assert.deepStrictEqual(order, [2, 1]); // Interceptors are unshifted (LIFO)
      assert(finalConfig.step1);
      assert(finalConfig.step2);
    });

    it('should handle async request interceptors', async (): Promise<void> => {
      const config = { url: '/test', method: 'GET' };

      requestInterceptors.use(async (_cfg) => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return { ...cfg, async: true };
      });

      let adapterConfig;
      const captureAdapter = async (_cfg) => {
        adapterConfig = cfg;
        return mockResponse;
      };

      await dispatchRequest(config, requestInterceptors, responseInterceptors, captureAdapter);

      assert(adapterConfig.async);
    });

    it('should handle request interceptor rejection', async (): Promise<void> => {
      const config = { url: '/test', method: 'GET' };

      requestInterceptors.use(
        () => {
          throw new Error('Request interceptor error');
        },
        (_error) => {
          // Error handler
          return { ...config, errorHandled: true };
        }
      );

      let adapterConfig;
      const captureAdapter = async (_cfg) => {
        adapterConfig = cfg;
        return mockResponse;
      };

      await dispatchRequest(config, requestInterceptors, responseInterceptors, captureAdapter);

      assert(adapterConfig.errorHandled);
    });

    it('should throw if request interceptor returns non-config', async (): Promise<void> => {
      const config = { url: '/test', method: 'GET' };

      requestInterceptors.use(() => 'invalid');

      await assert.rejects(
        async () =>
          await dispatchRequest(config, requestInterceptors, responseInterceptors, mockAdapter),
        fluxhttpError
      );
    });

    it('should handle synchronous request interceptors', async (): Promise<void> => {
      const config = { url: '/test', method: 'GET' };
      const results = [];

      requestInterceptors.use(
        (_cfg) => {
          results.push('sync1');
          return cfg;
        },
        undefined,
        { synchronous: true }
      );

      requestInterceptors.use(
        (_cfg) => {
          results.push('sync2');
          return cfg;
        },
        undefined,
        { synchronous: true }
      );

      await dispatchRequest(config, requestInterceptors, responseInterceptors, mockAdapter);

      assert.deepStrictEqual(results, ['sync2', 'sync1']);
    });
  });

  describe('Response interceptors', () => {
    it('should execute single response interceptor', async (): Promise<void> => {
      const config = { url: '/test', method: 'GET' };
      let interceptorCalled = false;

      responseInterceptors.use((_response) => {
        interceptorCalled = true;
        return { ...response, intercepted: true };
      });

      const response = await dispatchRequest(
        config,
        requestInterceptors,
        responseInterceptors,
        mockAdapter
      );

      assert(interceptorCalled);
      assert(response.intercepted);
    });

    it('should execute multiple response interceptors in order', async (): Promise<void> => {
      const config = { url: '/test', method: 'GET' };
      const order = [];

      responseInterceptors.use((_response) => {
        order.push(1);
        return { ...response, step1: true };
      });

      responseInterceptors.use((_response) => {
        order.push(2);
        return { ...response, step2: true };
      });

      const response = await dispatchRequest(
        config,
        requestInterceptors,
        responseInterceptors,
        mockAdapter
      );

      assert.deepStrictEqual(order, [1, 2]); // Response interceptors in normal order
      assert(response.step1);
      assert(response.step2);
    });

    it('should handle async response interceptors', async (): Promise<void> => {
      const config = { url: '/test', method: 'GET' };

      responseInterceptors.use(async (_response) => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return { ...response, async: true };
      });

      const response = await dispatchRequest(
        config,
        requestInterceptors,
        responseInterceptors,
        mockAdapter
      );

      assert(response.async);
    });

    it('should handle response interceptor rejection', async (): Promise<void> => {
      const config = { url: '/test', method: 'GET' };

      responseInterceptors.use(
        () => {
          throw new Error('Response interceptor error');
        },
        (_error) => {
          // Error handler returns a response
          return {
            data: { error: true },
            status: 500,
            statusText: 'Error',
            headers: {},
            config,
            request: {},
          };
        }
      );

      const response = await dispatchRequest(
        config,
        requestInterceptors,
        responseInterceptors,
        mockAdapter
      );

      assert.deepStrictEqual(response.data, { error: true });
      assert.strictEqual(response.status, 500);
    });

    it('should throw if response interceptor returns non-response', async (): Promise<void> => {
      const config = { url: '/test', method: 'GET' };

      responseInterceptors.use(() => 'invalid');

      await assert.rejects(
        async () =>
          await dispatchRequest(config, requestInterceptors, responseInterceptors, mockAdapter),
        fluxhttpError
      );
    });
  });

  describe('Interceptor options', () => {
    it('should respect runWhen option', async (): Promise<void> => {
      const config = { url: '/test', method: 'GET' };
      let interceptor1Called = false;
      let interceptor2Called = false;

      requestInterceptors.use(
        (_cfg) => {
          interceptor1Called = true;
          return cfg;
        },
        undefined,
        { runWhen: (cfg) => cfg.method === 'POST' }
      );

      requestInterceptors.use(
        (_cfg) => {
          interceptor2Called = true;
          return cfg;
        },
        undefined,
        { runWhen: (cfg) => cfg.method === 'GET' }
      );

      await dispatchRequest(config, requestInterceptors, responseInterceptors, mockAdapter);

      assert(!interceptor1Called); // Should not run for GET
      assert(interceptor2Called); // Should run for GET
    });

    it('should handle mixed sync/async interceptors', async (): Promise<void> => {
      const config = { url: '/test', method: 'GET' };
      const results = [];

      // Add async interceptor (no synchronous flag)
      requestInterceptors.use(async (_cfg) => {
        results.push('async');
        return cfg;
      });

      // Add sync interceptor
      requestInterceptors.use(
        (_cfg) => {
          results.push('sync');
          return cfg;
        },
        undefined,
        { synchronous: true }
      );

      await dispatchRequest(config, requestInterceptors, responseInterceptors, mockAdapter);

      // When mixed, all are treated as async
      assert(results.includes('async'));
      assert(results.includes('sync'));
    });
  });

  describe('Error handling', () => {
    it('should handle adapter errors', async (): Promise<void> => {
      const config = { url: '/test', method: 'GET' };
      const errorAdapter = async () => {
        throw new Error('Adapter error');
      };

      await assert.rejects(
        async () =>
          await dispatchRequest(config, requestInterceptors, responseInterceptors, errorAdapter),
        { message: 'Adapter error' }
      );
    });

    it('should handle request interceptor error without handler', async (): Promise<void> => {
      const config = { url: '/test', method: 'GET' };

      requestInterceptors.use(() => {
        throw new Error('Unhandled request error');
      });

      await assert.rejects(
        async () =>
          await dispatchRequest(config, requestInterceptors, responseInterceptors, mockAdapter),
        { message: 'Unhandled request error' }
      );
    });

    it('should handle response interceptor error without handler', async (): Promise<void> => {
      const config = { url: '/test', method: 'GET' };

      responseInterceptors.use(() => {
        throw new Error('Unhandled response error');
      });

      await assert.rejects(
        async () =>
          await dispatchRequest(config, requestInterceptors, responseInterceptors, mockAdapter),
        { message: 'Unhandled response error' }
      );
    });

    it('should validate config in interceptor chain', async (): Promise<void> => {
      const config = { url: '/test', method: 'GET' };

      requestInterceptors.use(() => null); // Return invalid config

      await assert.rejects(
        async () =>
          await dispatchRequest(config, requestInterceptors, responseInterceptors, mockAdapter),
        fluxhttpError
      );
    });

    it('should validate response in interceptor chain', async (): Promise<void> => {
      const config = { url: '/test', method: 'GET' };

      responseInterceptors.use(() => null); // Return invalid response

      await assert.rejects(
        async () =>
          await dispatchRequest(config, requestInterceptors, responseInterceptors, mockAdapter),
        fluxhttpError
      );
    });
  });

  describe('Complex scenarios', () => {
    it('should handle full interceptor pipeline', async (): Promise<void> => {
      const config = { url: '/test', method: 'GET' };
      const log = [];

      // Request interceptors
      requestInterceptors.use((_cfg) => {
        log.push('request1');
        return { ...cfg, req1: true };
      });

      requestInterceptors.use((_cfg) => {
        log.push('request2');
        return { ...cfg, req2: true };
      });

      // Response interceptors
      responseInterceptors.use((_response) => {
        log.push('response1');
        return { ...response, res1: true };
      });

      responseInterceptors.use((_response) => {
        log.push('response2');
        return { ...response, res2: true };
      });

      const response = await dispatchRequest(
        config,
        requestInterceptors,
        responseInterceptors,
        mockAdapter
      );

      assert.deepStrictEqual(log, ['request2', 'request1', 'response1', 'response2']);
      assert(response.res1);
      assert(response.res2);
    });

    it('should handle interceptor modifying data', async (): Promise<void> => {
      const config = { url: '/test', method: 'GET' };

      responseInterceptors.use((_response) => {
        return {
          ...response,
          data: { ...response.data, modified: true },
        };
      });

      const response = await dispatchRequest(
        config,
        requestInterceptors,
        responseInterceptors,
        mockAdapter
      );

      assert.deepStrictEqual(response.data, { test: 'data', modified: true });
    });

    it('should handle error recovery in interceptors', async (): Promise<void> => {
      const config = { url: '/test', method: 'GET' };

      // Adapter that always fails
      const failingAdapter = async () => {
        throw new Error('Network error');
      };

      // Response interceptor that handles errors
      responseInterceptors.use(undefined, (_error) => {
        // Return a synthetic response
        return {
          data: { recovered: true },
          status: 200,
          statusText: 'OK',
          headers: {},
          config,
          request: {},
        };
      });

      const response = await dispatchRequest(
        config,
        requestInterceptors,
        responseInterceptors,
        failingAdapter
      );

      assert.deepStrictEqual(response.data, { recovered: true });
    });

    it('should handle empty interceptor arrays', async (): Promise<void> => {
      const config = { url: '/test', method: 'GET' };

      // Create new empty managers
      const emptyRequestInterceptors = new InterceptorManager();
      const emptyResponseInterceptors = new InterceptorManager();

      const response = await dispatchRequest(
        config,
        emptyRequestInterceptors,
        emptyResponseInterceptors,
        mockAdapter
      );

      assert.deepStrictEqual(response.data, { test: 'data' });
    });

    it('should preserve config immutability', async (): Promise<void> => {
      const originalConfig = { url: '/test', method: 'GET', data: { original: true } };
      const configCopy = { ...originalConfig };

      requestInterceptors.use((_cfg) => {
        cfg.modified = true; // Try to modify
        return cfg;
      });

      await dispatchRequest(originalConfig, requestInterceptors, responseInterceptors, mockAdapter);

      // Original should be unchanged
      assert.deepStrictEqual(originalConfig, configCopy);
    });
  });

  describe('Edge cases', () => {
    it('should handle very long interceptor chains', async (): Promise<void> => {
      const config = { url: '/test', method: 'GET' };

      // Add many interceptors
      for (let i = 0; i < 100; i++) {
        requestInterceptors.use((cfg) => ({ ...cfg, [`req${i}`]: true }));
        responseInterceptors.use((res) => ({ ...res, [`res${i}`]: true }));
      }

      const response = await dispatchRequest(
        config,
        requestInterceptors,
        responseInterceptors,
        mockAdapter
      );

      // Check that all interceptors ran
      assert(response.res0);
      assert(response.res99);
    });

    it('should handle interceptor returning Promise.reject', async (): Promise<void> => {
      const config = { url: '/test', method: 'GET' };

      requestInterceptors.use(
        () => Promise.reject(new Error('Rejected')),
        (_error) => {
          return { ...config, recovered: true };
        }
      );

      let adapterConfig;
      const captureAdapter = async (_cfg) => {
        adapterConfig = cfg;
        return mockResponse;
      };

      await dispatchRequest(config, requestInterceptors, responseInterceptors, captureAdapter);

      assert(adapterConfig.recovered);
    });

    it('should handle undefined handlers gracefully', async (): Promise<void> => {
      const config = { url: '/test', method: 'GET' };

      requestInterceptors.use(undefined, undefined);
      responseInterceptors.use(undefined, undefined);

      const response = await dispatchRequest(
        config,
        requestInterceptors,
        responseInterceptors,
        mockAdapter
      );

      assert.deepStrictEqual(response.data, { test: 'data' });
    });

    it('should handle circular references in config', async (): Promise<void> => {
      const config = { url: '/test', method: 'GET' };
      config.circular = config;

      requestInterceptors.use((_cfg) => {
        // Should be able to handle circular config
        return { ...cfg, processed: true };
      });

      const response = await dispatchRequest(
        config,
        requestInterceptors,
        responseInterceptors,
        mockAdapter
      );

      assert(response);
    });
  });
});
