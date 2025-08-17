import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import {
  MockAdapter,
  mockAdapter,
  createMockAdapter,
  type MockResponse,
  type MockMatcher,
  type MockHandler,
} from '../../../src/adapters/mock.adapter.js';
import type { fluxhttpRequestConfig } from '../../../src/types/index.js';
import { fluxhttpError } from '../../../src/errors/fluxhttperror.js';

// Helper function to create test request config
function createRequestConfig(overrides: Partial<fluxhttpRequestConfig> = {}): fluxhttpRequestConfig {
  return {
    url: 'https://api.example.com/test',
    method: 'GET',
    ...overrides,
  };
}

// Helper function to create mock response
function createMockResponse<T = unknown>(overrides: Partial<MockResponse<T>> = {}): MockResponse<T> {
  return {
    status: 200,
    statusText: 'OK',
    data: {} as T,
    headers: {},
    ...overrides,
  };
}

describe('Mock Adapter', () => {
  describe('MockAdapter Class', () => {
    let adapter: MockAdapter;

    beforeEach(() => {
      adapter = new MockAdapter();
    });

    describe('Basic Functionality', () => {
      it('should create new MockAdapter instance', () => {
        assert(adapter instanceof MockAdapter);
      });

      it('should handle simple GET request mock', async () => {
        const responseData = { id: 1, name: 'Test' };
        adapter.onGet('/api/users', createMockResponse({ data: responseData }));

        const config = createRequestConfig({
          url: 'https://api.example.com/api/users',
          method: 'GET',
        });

        const response = await adapter.request(config);
        
        assert.strictEqual(response.status, 200);
        assert.deepStrictEqual(response.data, responseData);
        assert.strictEqual(response.statusText, 'OK');
      });

      it('should handle POST request with data matching', async () => {
        const requestData = { name: 'John', email: 'john@example.com' };
        const responseData = { id: 1, ...requestData };
        
        adapter.onPost('/api/users', requestData, createMockResponse({ data: responseData, status: 201 }));

        const config = createRequestConfig({
          url: 'https://api.example.com/api/users',
          method: 'POST',
          data: requestData,
        });

        const response = await adapter.request(config);
        
        assert.strictEqual(response.status, 201);
        assert.deepStrictEqual(response.data, responseData);
      });

      it('should handle PUT request', async () => {
        const requestData = { name: 'Jane', email: 'jane@example.com' };
        const responseData = { id: 1, ...requestData };
        
        adapter.onPut('/api/users/1', requestData, createMockResponse({ data: responseData }));

        const config = createRequestConfig({
          url: 'https://api.example.com/api/users/1',
          method: 'PUT',
          data: requestData,
        });

        const response = await adapter.request(config);
        
        assert.strictEqual(response.status, 200);
        assert.deepStrictEqual(response.data, responseData);
      });

      it('should handle DELETE request', async () => {
        adapter.onDelete('/api/users/1', createMockResponse({ status: 204, data: null }));

        const config = createRequestConfig({
          url: 'https://api.example.com/api/users/1',
          method: 'DELETE',
        });

        const response = await adapter.request(config);
        
        assert.strictEqual(response.status, 204);
        assert.strictEqual(response.data, null);
      });

      it('should handle PATCH request', async () => {
        const requestData = { email: 'newemail@example.com' };
        const responseData = { id: 1, name: 'John', ...requestData };
        
        adapter.onPatch('/api/users/1', requestData, createMockResponse({ data: responseData }));

        const config = createRequestConfig({
          url: 'https://api.example.com/api/users/1',
          method: 'PATCH',
          data: requestData,
        });

        const response = await adapter.request(config);
        
        assert.strictEqual(response.status, 200);
        assert.deepStrictEqual(response.data, responseData);
      });

      it('should handle HEAD request', async () => {
        adapter.onHead('/api/users', createMockResponse({ data: '', headers: { 'x-total-count': '100' } }));

        const config = createRequestConfig({
          url: 'https://api.example.com/api/users',
          method: 'HEAD',
        });

        const response = await adapter.request(config);
        
        assert.strictEqual(response.status, 200);
        assert.strictEqual(response.headers['x-total-count'], '100');
      });

      it('should handle OPTIONS request', async () => {
        adapter.onOptions('/api/users', createMockResponse({ 
          data: '',
          headers: { 'allow': 'GET,POST,PUT,DELETE' }
        }));

        const config = createRequestConfig({
          url: 'https://api.example.com/api/users',
          method: 'OPTIONS',
        });

        const response = await adapter.request(config);
        
        assert.strictEqual(response.status, 200);
        assert.strictEqual(response.headers['allow'], 'GET,POST,PUT,DELETE');
      });
    });

    describe('URL Matching', () => {
      it('should match exact URL strings', async () => {
        adapter.onGet('/api/users', createMockResponse({ data: { users: [] } }));

        const response = await adapter.request(createRequestConfig({
          url: 'https://api.example.com/api/users',
        }));
        
        assert.strictEqual(response.status, 200);
      });

      it('should match URL with regex patterns', async () => {
        adapter.onGet(/\/api\/users\/\d+/, createMockResponse({ data: { id: 1 } }));

        const response = await adapter.request(createRequestConfig({
          url: 'https://api.example.com/api/users/123',
        }));
        
        assert.strictEqual(response.status, 200);
        assert.deepStrictEqual(response.data, { id: 1 });
      });

      it('should handle URL with query parameters', async () => {
        adapter.onGet('/api/users', createMockResponse({ data: { users: [] } }));

        const response = await adapter.request(createRequestConfig({
          url: 'https://api.example.com/api/users?page=1&limit=10',
        }));
        
        assert.strictEqual(response.status, 200);
      });

      it('should match URL without protocol and domain', async () => {
        adapter.onGet('/api/users', createMockResponse({ data: { users: [] } }));

        const response = await adapter.request(createRequestConfig({
          url: '/api/users',
        }));
        
        assert.strictEqual(response.status, 200);
      });
    });

    describe('Parameter Matching', () => {
      it('should match request parameters', async () => {
        adapter.addHandler({
          matcher: {
            method: 'GET',
            url: '/api/users',
            params: { page: 1, limit: 10 },
          },
          response: createMockResponse({ data: { users: [], page: 1 } }),
        });

        const response = await adapter.request(createRequestConfig({
          url: '/api/users',
          params: { page: 1, limit: 10 },
        }));
        
        assert.strictEqual(response.status, 200);
        assert.deepStrictEqual(response.data, { users: [], page: 1 });
      });

      it('should match partial parameters', async () => {
        adapter.addHandler({
          matcher: {
            method: 'GET',
            url: '/api/users',
            params: { page: 1 }, // Only matching page, not limit
          },
          response: createMockResponse({ data: { users: [] } }),
        });

        const response = await adapter.request(createRequestConfig({
          url: '/api/users',
          params: { page: 1, limit: 10, sort: 'name' },
        }));
        
        assert.strictEqual(response.status, 200);
      });

      it('should not match when required parameters are missing', async () => {
        adapter.addHandler({
          matcher: {
            method: 'GET',
            url: '/api/users',
            params: { page: 1 },
          },
          response: createMockResponse({ data: { users: [] } }),
        });

        await assert.rejects(
          () => adapter.request(createRequestConfig({
            url: '/api/users',
            params: { limit: 10 }, // Missing required 'page' parameter
          })),
          (error: fluxhttpError) => {
            return error.message.includes('No mock handler found');
          }
        );
      });
    });

    describe('Header Matching', () => {
      it('should match request headers', async () => {
        adapter.addHandler({
          matcher: {
            method: 'GET',
            url: '/api/users',
            headers: { 'authorization': 'Bearer token123' },
          },
          response: createMockResponse({ data: { users: [] } }),
        });

        const response = await adapter.request(createRequestConfig({
          url: '/api/users',
          headers: { 'authorization': 'Bearer token123', 'content-type': 'application/json' },
        }));
        
        assert.strictEqual(response.status, 200);
      });

      it('should be case-insensitive for header matching', async () => {
        adapter.addHandler({
          matcher: {
            method: 'GET',
            url: '/api/users',
            headers: { 'Authorization': 'Bearer token123' },
          },
          response: createMockResponse({ data: { users: [] } }),
        });

        const response = await adapter.request(createRequestConfig({
          url: '/api/users',
          headers: { 'authorization': 'Bearer token123' },
        }));
        
        assert.strictEqual(response.status, 200);
      });
    });

    describe('Data Matching', () => {
      it('should match exact request data', async () => {
        const requestData = { name: 'John', age: 30 };
        
        adapter.addHandler({
          matcher: {
            method: 'POST',
            url: '/api/users',
            data: requestData,
          },
          response: createMockResponse({ data: { id: 1, ...requestData }, status: 201 }),
        });

        const response = await adapter.request(createRequestConfig({
          url: '/api/users',
          method: 'POST',
          data: requestData,
        }));
        
        assert.strictEqual(response.status, 201);
      });

      it('should match partial request data', async () => {
        adapter.addHandler({
          matcher: {
            method: 'POST',
            url: '/api/users',
            data: { name: 'John' }, // Only matching name
          },
          response: createMockResponse({ data: { id: 1 }, status: 201 }),
        });

        const response = await adapter.request(createRequestConfig({
          url: '/api/users',
          method: 'POST',
          data: { name: 'John', age: 30, email: 'john@example.com' },
        }));
        
        assert.strictEqual(response.status, 201);
      });

      it('should handle complex nested data matching', async () => {
        const requestData = {
          user: {
            name: 'John',
            profile: {
              age: 30,
              skills: ['JavaScript', 'TypeScript'],
            },
          },
        };
        
        adapter.addHandler({
          matcher: {
            method: 'POST',
            url: '/api/users',
            data: { user: { name: 'John' } }, // Partial nested matching
          },
          response: createMockResponse({ data: { id: 1 }, status: 201 }),
        });

        const response = await adapter.request(createRequestConfig({
          url: '/api/users',
          method: 'POST',
          data: requestData,
        }));
        
        assert.strictEqual(response.status, 201);
      });
    });

    describe('Multiple HTTP Methods', () => {
      it('should match multiple HTTP methods', async () => {
        adapter.addHandler({
          matcher: {
            method: ['GET', 'POST'],
            url: '/api/health',
          },
          response: createMockResponse({ data: { status: 'ok' } }),
        });

        // Test GET
        const getResponse = await adapter.request(createRequestConfig({
          url: '/api/health',
          method: 'GET',
        }));
        assert.strictEqual(getResponse.status, 200);

        // Test POST
        const postResponse = await adapter.request(createRequestConfig({
          url: '/api/health',
          method: 'POST',
        }));
        assert.strictEqual(postResponse.status, 200);
      });

      it('should not match excluded HTTP methods', async () => {
        adapter.addHandler({
          matcher: {
            method: ['GET', 'POST'],
            url: '/api/health',
          },
          response: createMockResponse({ data: { status: 'ok' } }),
        });

        await assert.rejects(
          () => adapter.request(createRequestConfig({
            url: '/api/health',
            method: 'PUT',
          })),
          (error: fluxhttpError) => {
            return error.message.includes('No mock handler found');
          }
        );
      });
    });

    describe('Handler Priority and Limits', () => {
      it('should use handlers in order of registration', async () => {
        // First handler
        adapter.onGet('/api/test', createMockResponse({ data: { result: 'first' } }));
        
        // Second handler (should not be used)
        adapter.onGet('/api/test', createMockResponse({ data: { result: 'second' } }));

        const response = await adapter.request(createRequestConfig({
          url: '/api/test',
        }));
        
        assert.deepStrictEqual(response.data, { result: 'first' });
      });

      it('should respect handler usage limits', async () => {
        adapter.onGet('/api/test', createMockResponse({ data: { result: 'limited' } }), 1);
        adapter.onGet('/api/test', createMockResponse({ data: { result: 'fallback' } }));

        // First request should use limited handler
        const response1 = await adapter.request(createRequestConfig({ url: '/api/test' }));
        assert.deepStrictEqual(response1.data, { result: 'limited' });

        // Second request should use fallback handler
        const response2 = await adapter.request(createRequestConfig({ url: '/api/test' }));
        assert.deepStrictEqual(response2.data, { result: 'fallback' });
      });

      it('should handle zero usage limit (unlimited)', async () => {
        adapter.onGet('/api/test', createMockResponse({ data: { result: 'unlimited' } }), 0);

        // Should work multiple times
        for (let i = 0; i < 5; i++) {
          const response = await adapter.request(createRequestConfig({ url: '/api/test' }));
          assert.deepStrictEqual(response.data, { result: 'unlimited' });
        }
      });
    });

    describe('Dynamic Response Functions', () => {
      it('should support function-based responses', async () => {
        adapter.addHandler({
          matcher: { method: 'GET', url: '/api/echo' },
          response: (config) => {
            return createMockResponse({
              data: { echo: config.url },
            });
          },
        });

        const response = await adapter.request(createRequestConfig({
          url: '/api/echo?message=hello',
        }));
        
        assert.deepStrictEqual(response.data, { echo: '/api/echo?message=hello' });
      });

      it('should support async function-based responses', async () => {
        adapter.addHandler({
          matcher: { method: 'GET', url: '/api/async' },
          response: async (config) => {
            await new Promise(resolve => setTimeout(resolve, 10));
            return createMockResponse({
              data: { async: true, url: config.url },
            });
          },
        });

        const response = await adapter.request(createRequestConfig({
          url: '/api/async',
        }));
        
        assert.deepStrictEqual(response.data, { async: true, url: '/api/async' });
      });

      it('should pass complete config to response function', async () => {
        adapter.addHandler({
          matcher: { method: 'POST', url: '/api/mirror' },
          response: (config) => {
            return createMockResponse({
              data: {
                method: config.method,
                url: config.url,
                data: config.data,
                headers: config.headers,
                params: config.params,
              },
            });
          },
        });

        const requestConfig = createRequestConfig({
          url: '/api/mirror',
          method: 'POST',
          data: { test: 'data' },
          headers: { 'x-test': 'header' },
          params: { page: 1 },
        });

        const response = await adapter.request(requestConfig);
        
        assert.strictEqual(response.data.method, 'POST');
        assert.strictEqual(response.data.url, '/api/mirror');
        assert.deepStrictEqual(response.data.data, { test: 'data' });
        assert.strictEqual(response.data.headers['x-test'], 'header');
        assert.deepStrictEqual(response.data.params, { page: 1 });
      });
    });

    describe('Delay Simulation', () => {
      it('should respect response delay', async () => {
        const delay = 50;
        adapter.onGet('/api/slow', createMockResponse({ 
          data: { result: 'slow' },
          delay,
        }));

        const start = Date.now();
        const response = await adapter.request(createRequestConfig({ url: '/api/slow' }));
        const duration = Date.now() - start;
        
        assert.deepStrictEqual(response.data, { result: 'slow' });
        assert(duration >= delay - 10, `Expected delay of at least ${delay}ms, got ${duration}ms`);
      });

      it('should support default delay for all responses', async () => {
        adapter.setDefaultDelay(30);
        adapter.onGet('/api/test', createMockResponse({ data: { result: 'test' } }));

        const start = Date.now();
        const response = await adapter.request(createRequestConfig({ url: '/api/test' }));
        const duration = Date.now() - start;
        
        assert(duration >= 20, `Expected delay of at least 20ms, got ${duration}ms`);
      });

      it('should override default delay with response-specific delay', async () => {
        adapter.setDefaultDelay(100);
        adapter.onGet('/api/fast', createMockResponse({ 
          data: { result: 'fast' },
          delay: 10,
        }));

        const start = Date.now();
        const response = await adapter.request(createRequestConfig({ url: '/api/fast' }));
        const duration = Date.now() - start;
        
        // Should use specific delay (10ms) not default (100ms)
        assert(duration < 50, `Expected fast response, got ${duration}ms`);
      });
    });

    describe('Error Simulation', () => {
      it('should simulate network errors', async () => {
        adapter.onNetworkError(/\/api\/error/);

        await assert.rejects(
          () => adapter.request(createRequestConfig({ url: '/api/error' })),
          (error: fluxhttpError) => {
            return error.code === 'ERR_NETWORK';
          }
        );
      });

      it('should simulate timeout errors', async () => {
        adapter.onTimeoutError('/api/timeout');

        await assert.rejects(
          () => adapter.request(createRequestConfig({ url: '/api/timeout' })),
          (error: fluxhttpError) => {
            return error.code === 'ETIMEDOUT';
          }
        );
      });

      it('should simulate custom errors', async () => {
        const customError = new fluxhttpError('Custom error', {}, null, {});
        customError.code = 'CUSTOM_ERROR';
        
        adapter.onError('/api/custom-error', customError);

        await assert.rejects(
          () => adapter.request(createRequestConfig({ url: '/api/custom-error' })),
          (error: fluxhttpError) => {
            return error.code === 'CUSTOM_ERROR' && error.message === 'Custom error';
          }
        );
      });
    });

    describe('Request History', () => {
      it('should track request history', async () => {
        adapter.onGet('/api/test1', createMockResponse({ data: { result: 1 } }));
        adapter.onPost('/api/test2', createMockResponse({ data: { result: 2 } }));

        await adapter.request(createRequestConfig({ url: '/api/test1', method: 'GET' }));
        await adapter.request(createRequestConfig({ url: '/api/test2', method: 'POST', data: { test: 'data' } }));

        const history = adapter.getHistory();
        
        assert.strictEqual(history.length, 2);
        assert.strictEqual(history[0].url, '/api/test1');
        assert.strictEqual(history[0].method, 'GET');
        assert.strictEqual(history[1].url, '/api/test2');
        assert.strictEqual(history[1].method, 'POST');
        assert.deepStrictEqual(history[1].data, { test: 'data' });
      });

      it('should clear request history', async () => {
        adapter.onGet('/api/test', createMockResponse({ data: { result: 'test' } }));
        
        await adapter.request(createRequestConfig({ url: '/api/test' }));
        assert.strictEqual(adapter.getHistory().length, 1);
        
        adapter.clearHistory();
        assert.strictEqual(adapter.getHistory().length, 0);
      });

      it('should get last request', async () => {
        adapter.onGet('/api/test1', createMockResponse({ data: { result: 1 } }));
        adapter.onGet('/api/test2', createMockResponse({ data: { result: 2 } }));

        await adapter.request(createRequestConfig({ url: '/api/test1' }));
        await adapter.request(createRequestConfig({ url: '/api/test2' }));

        const lastRequest = adapter.getLastRequest();
        assert(lastRequest);
        assert.strictEqual(lastRequest.url, '/api/test2');
      });

      it('should return null for last request when history is empty', () => {
        const lastRequest = adapter.getLastRequest();
        assert.strictEqual(lastRequest, null);
      });
    });

    describe('State Management', () => {
      it('should reset adapter state', async () => {
        adapter.onGet('/api/test', createMockResponse({ data: { result: 'test' } }));
        await adapter.request(createRequestConfig({ url: '/api/test' }));
        
        assert.strictEqual(adapter.getHistory().length, 1);
        
        adapter.reset();
        
        assert.strictEqual(adapter.getHistory().length, 0);
        
        // Handlers should also be cleared
        await assert.rejects(
          () => adapter.request(createRequestConfig({ url: '/api/test' })),
          (error: fluxhttpError) => {
            return error.message.includes('No mock handler found');
          }
        );
      });

      it('should chain method calls fluently', () => {
        const result = adapter
          .onGet('/api/users', createMockResponse({ data: { users: [] } }))
          .onPost('/api/users', createMockResponse({ data: { id: 1 }, status: 201 }))
          .setDefaultDelay(10);
        
        assert.strictEqual(result, adapter);
      });
    });

    describe('Parameter Overloading', () => {
      it('should handle POST method parameter overloading (no data)', () => {
        const response = createMockResponse({ data: { result: 'test' }, status: 201 });
        
        // Call with URL and response only (no data matching)
        const result = adapter.onPost('/api/test', response);
        assert.strictEqual(result, adapter);
      });

      it('should handle POST method parameter overloading (with data)', () => {
        const data = { name: 'test' };
        const response = createMockResponse({ data: { id: 1 }, status: 201 });
        
        // Call with URL, data, and response
        const result = adapter.onPost('/api/test', data, response);
        assert.strictEqual(result, adapter);
      });

      it('should handle PUT method parameter overloading', () => {
        const response = createMockResponse({ data: { result: 'updated' } });
        
        const result = adapter.onPut('/api/test', response);
        assert.strictEqual(result, adapter);
      });

      it('should handle PATCH method parameter overloading', () => {
        const response = createMockResponse({ data: { result: 'patched' } });
        
        const result = adapter.onPatch('/api/test', response);
        assert.strictEqual(result, adapter);
      });
    });
  });

  describe('Module Functions', () => {
    describe('createMockAdapter', () => {
      it('should create new MockAdapter instance', () => {
        const adapter = createMockAdapter();
        assert(adapter instanceof MockAdapter);
      });

      it('should create independent instances', () => {
        const adapter1 = createMockAdapter();
        const adapter2 = createMockAdapter();
        
        assert.notStrictEqual(adapter1, adapter2);
        
        // Configure differently
        adapter1.onGet('/api/test', createMockResponse({ data: { source: 'adapter1' } }));
        adapter2.onGet('/api/test', createMockResponse({ data: { source: 'adapter2' } }));
        
        // Should maintain separate configurations
        return Promise.all([
          adapter1.request(createRequestConfig({ url: '/api/test' })),
          adapter2.request(createRequestConfig({ url: '/api/test' })),
        ]).then(([response1, response2]) => {
          assert.deepStrictEqual(response1.data, { source: 'adapter1' });
          assert.deepStrictEqual(response2.data, { source: 'adapter2' });
        });
      });
    });

    describe('mockAdapter (default instance)', () => {
      beforeEach(() => {
        mockAdapter.reset();
      });

      it('should be MockAdapter instance', () => {
        assert(mockAdapter instanceof MockAdapter);
      });

      it('should work as default mock adapter', async () => {
        mockAdapter.onGet('/api/default', createMockResponse({ data: { default: true } }));
        
        const response = await mockAdapter.request(createRequestConfig({
          url: '/api/default',
        }));
        
        assert.deepStrictEqual(response.data, { default: true });
      });

      it('should maintain state across calls', async () => {
        mockAdapter.onGet('/api/test', createMockResponse({ data: { test: 'data' } }));
        
        // First request
        await mockAdapter.request(createRequestConfig({ url: '/api/test' }));
        
        // Check history
        assert.strictEqual(mockAdapter.getHistory().length, 1);
        
        // Second request
        await mockAdapter.request(createRequestConfig({ url: '/api/test' }));
        
        // History should have both
        assert.strictEqual(mockAdapter.getHistory().length, 2);
      });
    });
  });

  describe('Edge Cases and Error Handling', () => {
    let adapter: MockAdapter;

    beforeEach(() => {
      adapter = new MockAdapter();
    });

    it('should handle missing URL in request', async () => {
      adapter.onGet('/api/test', createMockResponse({ data: { result: 'test' } }));
      
      await assert.rejects(
        () => adapter.request(createRequestConfig({ url: undefined as any })),
        (error: fluxhttpError) => {
          return error.message.includes('No mock handler found');
        }
      );
    });

    it('should handle missing method in request', async () => {
      adapter.onGet('/api/test', createMockResponse({ data: { result: 'test' } }));
      
      const response = await adapter.request(createRequestConfig({ 
        url: '/api/test',
        method: undefined as any,
      }));
      
      // Should default to GET method
      assert.strictEqual(response.status, 200);
    });

    it('should handle empty handlers array', async () => {
      await assert.rejects(
        () => adapter.request(createRequestConfig({ url: '/api/test' })),
        (error: fluxhttpError) => {
          return error.message.includes('No mock handler found');
        }
      );
    });

    it('should handle malformed request config', async () => {
      adapter.onGet('/api/test', createMockResponse({ data: { result: 'test' } }));
      
      const response = await adapter.request({
        url: '/api/test',
        method: 'GET',
        headers: null as any,
        data: undefined,
        params: null as any,
      });
      
      assert.strictEqual(response.status, 200);
    });

    it('should handle circular references in request data', async () => {
      const data: any = { name: 'test' };
      data.circular = data;
      
      adapter.addHandler({
        matcher: {
          method: 'POST',
          url: '/api/test',
          data: { name: 'test' },
        },
        response: createMockResponse({ data: { result: 'success' }, status: 201 }),
      });
      
      const response = await adapter.request(createRequestConfig({
        url: '/api/test',
        method: 'POST',
        data,
      }));
      
      assert.strictEqual(response.status, 201);
    });

    it('should handle very large request data', async () => {
      const largeData = {
        content: 'x'.repeat(100000), // 100KB string
        array: new Array(10000).fill({ item: 'data' }),
      };
      
      adapter.onPost('/api/large', createMockResponse({ 
        data: { received: true },
        status: 201,
      }));
      
      const response = await adapter.request(createRequestConfig({
        url: '/api/large',
        method: 'POST',
        data: largeData,
      }));
      
      assert.strictEqual(response.status, 201);
    });

    it('should handle special characters in URLs', async () => {
      const specialUrl = '/api/test/user name with spaces/café/🚀';
      
      adapter.onGet(specialUrl, createMockResponse({ data: { special: true } }));
      
      const response = await adapter.request(createRequestConfig({ url: specialUrl }));
      
      assert.deepStrictEqual(response.data, { special: true });
    });

    it('should handle response function throwing errors', async () => {
      adapter.addHandler({
        matcher: { method: 'GET', url: '/api/error' },
        response: () => {
          throw new Error('Response function error');
        },
      });
      
      await assert.rejects(
        () => adapter.request(createRequestConfig({ url: '/api/error' })),
        { message: 'Response function error' }
      );
    });

    it('should handle async response function rejection', async () => {
      adapter.addHandler({
        matcher: { method: 'GET', url: '/api/async-error' },
        response: async () => {
          await new Promise(resolve => setTimeout(resolve, 10));
          throw new Error('Async response error');
        },
      });
      
      await assert.rejects(
        () => adapter.request(createRequestConfig({ url: '/api/async-error' })),
        { message: 'Async response error' }
      );
    });
  });

  describe('Performance', () => {
    it('should handle many handlers efficiently', async () => {
      const adapter = new MockAdapter();
      
      // Add many handlers
      for (let i = 0; i < 1000; i++) {
        adapter.onGet(`/api/test${i}`, createMockResponse({ data: { id: i } }));
      }
      
      const start = process.hrtime();
      
      // Make request to last handler (worst case)
      const response = await adapter.request(createRequestConfig({ url: '/api/test999' }));
      
      const [seconds, nanoseconds] = process.hrtime(start);
      const milliseconds = seconds * 1000 + nanoseconds / 1000000;
      
      assert.deepStrictEqual(response.data, { id: 999 });
      assert(milliseconds < 100, 'Should find handler quickly even with many handlers');
    });

    it('should not leak memory with many requests', async () => {
      const adapter = new MockAdapter();
      adapter.onGet('/api/test', createMockResponse({ data: { result: 'test' } }));
      
      const initialMemory = process.memoryUsage().heapUsed;
      
      // Make many requests
      for (let i = 0; i < 1000; i++) {
        await adapter.request(createRequestConfig({ url: '/api/test' }));
      }
      
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;
      
      // Memory increase should be reasonable (history tracking will use some memory)
      assert(memoryIncrease < 10 * 1024 * 1024, 'Memory usage should not grow excessively');
    });
  });
});
