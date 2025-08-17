import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import {
  fluxhttpError,
  createError,
  isCancel,
  CancelToken,
  Cancel,
} from '../../../src/errors/index.js';
import type { fluxhttpRequestConfig, fluxhttpResponse } from '../../../src/types/index.js';

// Helper function to create mock request config
function createMockConfig(overrides: Partial<fluxhttpRequestConfig> = {}): fluxhttpRequestConfig {
  return {
    url: 'https://api.example.com/test',
    method: 'GET',
    headers: {},
    ...overrides,
  };
}

// Helper function to create mock response
function createMockResponse(overrides: Partial<fluxhttpResponse> = {}): fluxhttpResponse {
  return {
    data: {},
    status: 200,
    statusText: 'OK',
    headers: {},
    config: createMockConfig(),
    ...overrides,
  };
}

describe('FluxHTTP Error System', () => {
  describe('fluxhttpError', () => {
    describe('Constructor', () => {
      it('should create error with message', () => {
        const error = new fluxhttpError('Test error', {}, null, {});
        
        assert(error instanceof Error);
        assert(error instanceof fluxhttpError);
        assert.strictEqual(error.message, 'Test error');
        assert.strictEqual(error.name, 'fluxhttpError');
      });

      it('should create error with config', () => {
        const config = createMockConfig({ url: 'https://test.com' });
        const error = new fluxhttpError('Test error', config, null, {});
        
        assert.strictEqual(error.config, config);
        assert.strictEqual(error.config.url, 'https://test.com');
      });

      it('should create error with request', () => {
        const request = { method: 'GET', url: 'https://test.com' };
        const error = new fluxhttpError('Test error', {}, request, {});
        
        assert.strictEqual(error.request, request);
      });

      it('should create error with response', () => {
        const response = createMockResponse({ status: 404 });
        const error = new fluxhttpError('Test error', {}, null, response);
        
        assert.strictEqual(error.response, response);
        assert.strictEqual(error.response.status, 404);
      });

      it('should create error with all parameters', () => {
        const config = createMockConfig();
        const request = { method: 'POST' };
        const response = createMockResponse({ status: 500 });
        
        const error = new fluxhttpError('Complete error', config, request, response);
        
        assert.strictEqual(error.message, 'Complete error');
        assert.strictEqual(error.config, config);
        assert.strictEqual(error.request, request);
        assert.strictEqual(error.response, response);
      });

      it('should inherit from Error properly', () => {
        const error = new fluxhttpError('Test error', {}, null, {});
        
        assert(error instanceof Error);
        assert(error.stack);
        assert.strictEqual(error.name, 'fluxhttpError');
        assert.strictEqual(error.constructor.name, 'fluxhttpError');
      });
    });

    describe('Properties', () => {
      it('should have correct default properties', () => {
        const error = new fluxhttpError('Test', {}, null, {});
        
        assert.strictEqual(error.isfluxhttpError, true);
        assert.strictEqual(error.code, undefined);
        assert.strictEqual(error.status, undefined);
      });

      it('should set code property', () => {
        const error = new fluxhttpError('Test', {}, null, {});
        error.code = 'ERR_NETWORK';
        
        assert.strictEqual(error.code, 'ERR_NETWORK');
      });

      it('should derive status from response', () => {
        const response = createMockResponse({ status: 404 });
        const error = new fluxhttpError('Not found', {}, null, response);
        
        assert.strictEqual(error.status, 404);
      });

      it('should handle response without status', () => {
        const response = { ...createMockResponse() };
        delete (response as any).status;
        
        const error = new fluxhttpError('Test', {}, null, response);
        assert.strictEqual(error.status, undefined);
      });
    });

    describe('toJSON', () => {
      it('should serialize error to JSON', () => {
        const config = createMockConfig({ url: 'https://test.com' });
        const response = createMockResponse({ status: 400 });
        const error = new fluxhttpError('Test error', config, {}, response);
        error.code = 'ERR_BAD_REQUEST';
        
        const json = error.toJSON();
        
        assert.strictEqual(json.message, 'Test error');
        assert.strictEqual(json.name, 'fluxhttpError');
        assert.strictEqual(json.code, 'ERR_BAD_REQUEST');
        assert.strictEqual(json.status, 400);
        assert.deepStrictEqual(json.config, config);
        assert(json.stack);
      });

      it('should handle serialization without optional properties', () => {
        const error = new fluxhttpError('Simple error', {}, null, {});
        
        const json = error.toJSON();
        
        assert.strictEqual(json.message, 'Simple error');
        assert.strictEqual(json.code, undefined);
        assert.strictEqual(json.status, undefined);
      });

      it('should handle circular references in config', () => {
        const config: any = createMockConfig();
        config.circular = config;
        
        const error = new fluxhttpError('Test', config, null, {});
        
        assert.doesNotThrow(() => {
          error.toJSON();
        });
      });
    });

    describe('Error Categories', () => {
      it('should identify network errors', () => {
        const error = new fluxhttpError('Network Error', {}, null, {});
        error.code = 'ERR_NETWORK';
        
        assert.strictEqual(error.code, 'ERR_NETWORK');
      });

      it('should identify timeout errors', () => {
        const error = new fluxhttpError('Timeout Error', {}, null, {});
        error.code = 'ETIMEDOUT';
        
        assert.strictEqual(error.code, 'ETIMEDOUT');
      });

      it('should identify client errors (4xx)', () => {
        const response = createMockResponse({ status: 404 });
        const error = new fluxhttpError('Not Found', {}, null, response);
        
        assert.strictEqual(error.status, 404);
        assert(error.status >= 400 && error.status < 500);
      });

      it('should identify server errors (5xx)', () => {
        const response = createMockResponse({ status: 500 });
        const error = new fluxhttpError('Internal Server Error', {}, null, response);
        
        assert.strictEqual(error.status, 500);
        assert(error.status >= 500);
      });
    });
  });

  describe('createError', () => {
    it('should create fluxhttpError with all parameters', () => {
      const message = 'Test error';
      const config = createMockConfig();
      const code = 'ERR_TEST';
      const request = { method: 'GET' };
      const response = createMockResponse();
      
      const error = createError(message, config, code, request, response);
      
      assert(error instanceof fluxhttpError);
      assert.strictEqual(error.message, message);
      assert.strictEqual(error.config, config);
      assert.strictEqual(error.code, code);
      assert.strictEqual(error.request, request);
      assert.strictEqual(error.response, response);
    });

    it('should create error with minimal parameters', () => {
      const error = createError('Simple error');
      
      assert(error instanceof fluxhttpError);
      assert.strictEqual(error.message, 'Simple error');
      assert.strictEqual(error.config, undefined);
      assert.strictEqual(error.code, undefined);
    });

    it('should handle empty message', () => {
      const error = createError('');
      
      assert.strictEqual(error.message, '');
    });

    it('should handle null/undefined parameters', () => {
      const error = createError('Test', null, null, null, null);
      
      assert.strictEqual(error.message, 'Test');
      assert.strictEqual(error.config, null);
      assert.strictEqual(error.code, null);
      assert.strictEqual(error.request, null);
      assert.strictEqual(error.response, null);
    });
  });

  describe('Cancel Token System', () => {
    describe('Cancel', () => {
      it('should create cancel with message', () => {
        const cancel = new Cancel('Operation cancelled');
        
        assert(cancel instanceof Cancel);
        assert.strictEqual(cancel.message, 'Operation cancelled');
        assert.strictEqual(cancel.__CANCEL__, true);
      });

      it('should create cancel without message', () => {
        const cancel = new Cancel();
        
        assert.strictEqual(cancel.message, 'canceled');
        assert.strictEqual(cancel.__CANCEL__, true);
      });

      it('should be identifiable as cancel', () => {
        const cancel = new Cancel('Test');
        
        assert.strictEqual(isCancel(cancel), true);
      });
    });

    describe('CancelToken', () => {
      it('should create cancel token with executor', () => {
        let cancelFunction: ((message?: string) => void) | null = null;
        
        const token = new CancelToken((cancel) => {
          cancelFunction = cancel;
        });
        
        assert(token instanceof CancelToken);
        assert(typeof cancelFunction === 'function');
        assert.strictEqual(token.reason, undefined);
      });

      it('should cancel token when executor calls cancel', () => {
        let cancelFunction: ((message?: string) => void) | null = null;
        
        const token = new CancelToken((cancel) => {
          cancelFunction = cancel;
        });
        
        assert.strictEqual(token.reason, undefined);
        
        cancelFunction!('User cancelled');
        
        assert(token.reason instanceof Cancel);
        assert.strictEqual(token.reason.message, 'User cancelled');
      });

      it('should throw if cancelled', () => {
        let cancelFunction: ((message?: string) => void) | null = null;
        
        const token = new CancelToken((cancel) => {
          cancelFunction = cancel;
        });
        
        cancelFunction!('Test cancellation');
        
        assert.throws(() => {
          token.throwIfRequested();
        }, (error: any) => {
          return isCancel(error) && error.message === 'Test cancellation';
        });
      });

      it('should not throw if not cancelled', () => {
        const token = new CancelToken(() => {});
        
        assert.doesNotThrow(() => {
          token.throwIfRequested();
        });
      });

      it('should support promise-based cancellation', async () => {
        let cancelFunction: ((message?: string) => void) | null = null;
        
        const token = new CancelToken((cancel) => {
          cancelFunction = cancel;
        });
        
        // Set up promise handler
        const cancelPromise = new Promise((resolve) => {
          if (token.reason) {
            resolve(token.reason);
          } else {
            // In a real implementation, this would listen for cancellation
            setTimeout(() => {
              if (token.reason) {
                resolve(token.reason);
              }
            }, 10);
          }
        });
        
        // Cancel after a short delay
        setTimeout(() => {
          cancelFunction!('Async cancellation');
        }, 5);
        
        const reason = await cancelPromise;
        assert(isCancel(reason));
      });

      it('should create cancelled token using source', () => {
        const source = CancelToken.source();
        
        assert(source.token instanceof CancelToken);
        assert(typeof source.cancel === 'function');
        
        source.cancel('Source cancellation');
        
        assert(source.token.reason instanceof Cancel);
        assert.strictEqual(source.token.reason.message, 'Source cancellation');
      });

      it('should handle multiple cancellations', () => {
        const source = CancelToken.source();
        
        source.cancel('First cancellation');
        const firstReason = source.token.reason;
        
        source.cancel('Second cancellation');
        const secondReason = source.token.reason;
        
        // Should keep the first cancellation reason
        assert.strictEqual(firstReason, secondReason);
        assert.strictEqual(firstReason!.message, 'First cancellation');
      });
    });

    describe('isCancel', () => {
      it('should identify Cancel objects', () => {
        const cancel = new Cancel('Test');
        assert.strictEqual(isCancel(cancel), true);
      });

      it('should identify Cancel-like objects', () => {
        const cancelLike = { __CANCEL__: true, message: 'Fake cancel' };
        assert.strictEqual(isCancel(cancelLike), true);
      });

      it('should reject non-Cancel objects', () => {
        assert.strictEqual(isCancel(new Error('Regular error')), false);
        assert.strictEqual(isCancel({ message: 'Not a cancel' }), false);
        assert.strictEqual(isCancel('string'), false);
        assert.strictEqual(isCancel(null), false);
        assert.strictEqual(isCancel(undefined), false);
        assert.strictEqual(isCancel(123), false);
      });

      it('should handle objects with __CANCEL__ set to false', () => {
        const notCancel = { __CANCEL__: false, message: 'Not cancelled' };
        assert.strictEqual(isCancel(notCancel), false);
      });
    });
  });

  describe('Error Integration', () => {
    it('should work with request cancellation', () => {
      const source = CancelToken.source();
      const config = createMockConfig({ cancelToken: source.token } as any);
      
      source.cancel('Request cancelled by user');
      
      assert.throws(() => {
        source.token.throwIfRequested();
      }, (error: any) => {
        return isCancel(error) && error.message === 'Request cancelled by user';
      });
    });

    it('should create cancellation error', () => {
      const cancel = new Cancel('Operation cancelled');
      const config = createMockConfig();
      
      const error = createError('Request was cancelled', config, 'ERR_CANCELLED', {}, {});
      
      assert(error instanceof fluxhttpError);
      assert.strictEqual(error.code, 'ERR_CANCELLED');
      assert.strictEqual(error.message, 'Request was cancelled');
    });

    it('should distinguish between cancel and regular errors', () => {
      const cancel = new Cancel('Cancelled');
      const regularError = new fluxhttpError('Regular error', {}, null, {});
      
      assert.strictEqual(isCancel(cancel), true);
      assert.strictEqual(isCancel(regularError), false);
    });
  });

  describe('Error Serialization and Cloning', () => {
    it('should handle JSON serialization of complex errors', () => {
      const config = createMockConfig({
        url: 'https://api.example.com/test',
        headers: { 'Authorization': 'Bearer token' },
        data: { nested: { value: 'test' } },
      });
      
      const response = createMockResponse({
        status: 422,
        statusText: 'Unprocessable Entity',
        data: { errors: ['Field is required'] },
        headers: { 'Content-Type': 'application/json' },
      });
      
      const error = new fluxhttpError('Validation failed', config, {}, response);
      error.code = 'ERR_VALIDATION';
      
      const json = error.toJSON();
      const serialized = JSON.stringify(json);
      const parsed = JSON.parse(serialized);
      
      assert.strictEqual(parsed.message, 'Validation failed');
      assert.strictEqual(parsed.code, 'ERR_VALIDATION');
      assert.strictEqual(parsed.status, 422);
      assert.deepStrictEqual(parsed.config.data, { nested: { value: 'test' } });
    });

    it('should handle errors with undefined/null values', () => {
      const error = new fluxhttpError('Test', null, undefined, null);
      
      const json = error.toJSON();
      
      assert.strictEqual(json.config, null);
      assert.strictEqual(json.request, undefined);
      assert.strictEqual(json.response, null);
    });

    it('should preserve error prototype chain', () => {
      const error = new fluxhttpError('Test', {}, null, {});
      
      assert(error instanceof Error);
      assert(error instanceof fluxhttpError);
      assert.strictEqual(error.constructor, fluxhttpError);
      assert.strictEqual(Object.getPrototypeOf(error).constructor, fluxhttpError);
    });
  });

  describe('Edge Cases', () => {
    it('should handle very long error messages', () => {
      const longMessage = 'Error: ' + 'x'.repeat(10000);
      const error = new fluxhttpError(longMessage, {}, null, {});
      
      assert.strictEqual(error.message, longMessage);
      assert(error.message.length > 10000);
    });

    it('should handle error messages with special characters', () => {
      const specialMessage = 'Error with unicode: 你好世界 and emoji: 🚨💥';
      const error = new fluxhttpError(specialMessage, {}, null, {});
      
      assert.strictEqual(error.message, specialMessage);
    });

    it('should handle circular references in error context', () => {
      const config: any = createMockConfig();
      config.circular = config;
      
      const error = new fluxhttpError('Circular test', config, null, {});
      
      assert.doesNotThrow(() => {
        error.toString();
      });
      
      assert.doesNotThrow(() => {
        JSON.stringify(error.toJSON());
      });
    });

    it('should handle errors created with Object.create', () => {
      const proto = fluxhttpError.prototype;
      const error = Object.create(proto);
      
      fluxhttpError.call(error, 'Created error', {}, null, {});
      
      assert(error instanceof fluxhttpError);
      assert.strictEqual(error.message, 'Created error');
    });

    it('should handle cancel token with no executor', () => {
      assert.throws(() => {
        new CancelToken(null as any);
      }, TypeError);
    });

    it('should handle cancel token with throwing executor', () => {
      assert.throws(() => {
        new CancelToken(() => {
          throw new Error('Executor error');
        });
      }, { message: 'Executor error' });
    });

    it('should handle multiple cancel token sources', () => {
      const source1 = CancelToken.source();
      const source2 = CancelToken.source();
      
      source1.cancel('First source');
      source2.cancel('Second source');
      
      assert.strictEqual(source1.token.reason!.message, 'First source');
      assert.strictEqual(source2.token.reason!.message, 'Second source');
      assert.notStrictEqual(source1.token.reason, source2.token.reason);
    });
  });

  describe('Performance', () => {
    it('should create many errors efficiently', () => {
      const start = process.hrtime();
      
      for (let i = 0; i < 1000; i++) {
        const error = new fluxhttpError(`Error ${i}`, createMockConfig(), null, {});
        error.code = `ERR_${i}`;
      }
      
      const [seconds, nanoseconds] = process.hrtime(start);
      const milliseconds = seconds * 1000 + nanoseconds / 1000000;
      
      assert(milliseconds < 100, 'Should create errors quickly');
    });

    it('should not leak memory with many error operations', () => {
      const initialMemory = process.memoryUsage().heapUsed;
      
      for (let i = 0; i < 10000; i++) {
        const error = new fluxhttpError(`Error ${i}`, createMockConfig(), null, createMockResponse());
        error.toJSON();
        error.toString();
        
        const source = CancelToken.source();
        source.cancel(`Cancel ${i}`);
        isCancel(source.token.reason);
      }
      
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;
      
      // Memory increase should be reasonable
      assert(memoryIncrease < 50 * 1024 * 1024, 'Memory usage should not grow excessively');
    });
  });
});
