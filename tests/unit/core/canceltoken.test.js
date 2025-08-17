const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');

// Import the built library
const fluxhttpModule = require('../../../dist/index.js');
const fluxhttp = fluxhttpModule.default || fluxhttpModule;
const { CancelToken, isCancel, fluxhttpError } = fluxhttpModule;

/**
 * Comprehensive unit tests for cancel token functionality
 * Tests CancelToken, CancelTokenSource, and cancellation behavior
 */
describe('Cancel Token Functionality', () => {
  let source;
  let mockAdapter;
  let requestPromises;

  beforeEach(() => {
    source = CancelToken.source();
    requestPromises = [];
    
    // Create a mock adapter that can be controlled for testing cancellation
    mockAdapter = {
      request: async (config) => {
        const promise = new Promise((resolve, reject) => {
          // Simulate async operation
          const timeout = setTimeout(() => {
            resolve({
              data: { success: true, url: config.url },
              status: 200,
              statusText: 'OK',
              headers: {},
              config,
              request: {}
            });
          }, 100);

          // Handle cancellation if cancelToken is provided
          if (config.cancelToken) {
            config.cancelToken.promise.then((cancel) => {
              clearTimeout(timeout);
              reject(new fluxhttpError(cancel.message || 'Request canceled', 'ECONNABORTED'));
            });
          }

          // Handle AbortSignal if provided (modern cancellation)
          if (config.signal && config.signal.aborted) {
            clearTimeout(timeout);
            reject(new fluxhttpError('Request canceled', 'ECONNABORTED'));
          } else if (config.signal) {
            config.signal.addEventListener('abort', () => {
              clearTimeout(timeout);
              reject(new fluxhttpError('Request canceled', 'ECONNABORTED'));
            });
          }
        });

        requestPromises.push(promise);
        return promise;
      }
    };
  });

  afterEach(() => {
    // Cancel any pending requests
    if (source) {
      source.cancel('Test cleanup');
    }
    
    // Wait for any pending promises to settle
    return Promise.allSettled(requestPromises);
  });

  describe('CancelToken.source()', () => {
    it('should create a cancel token source', () => {
      const source = CancelToken.source();
      
      assert(source, 'Should create source');
      assert(source.token, 'Should have token');
      assert(source.cancel, 'Should have cancel method');
      assert(typeof source.cancel === 'function', 'Cancel should be function');
    });

    it('should create source with valid token', () => {
      const source = CancelToken.source();
      const token = source.token;
      
      assert(token.promise, 'Token should have promise');
      assert(typeof token.promise.then === 'function', 'Should be a promise');
      assert(typeof token.throwIfRequested === 'function', 'Should have throwIfRequested method');
      assert(token.reason === undefined, 'Should not have reason initially');
    });

    it('should create independent sources', () => {
      const source1 = CancelToken.source();
      const source2 = CancelToken.source();
      
      assert(source1 !== source2, 'Sources should be different instances');
      assert(source1.token !== source2.token, 'Tokens should be different');
      assert(source1.token.promise !== source2.token.promise, 'Promises should be different');
    });

    it('should provide AbortSignal', () => {
      const source = CancelToken.source();
      
      assert(source.signal, 'Should have signal property');
      assert(source.signal instanceof AbortSignal, 'Should be AbortSignal');
      assert(!source.signal.aborted, 'Should not be aborted initially');
    });
  });

  describe('CancelTokenSource.cancel()', () => {
    it('should cancel with default message', async () => {
      const source = CancelToken.source();
      
      // Start listening for cancellation
      const cancelPromise = source.token.promise;
      
      // Cancel the token
      source.cancel();
      
      // Wait for cancellation
      const cancel = await cancelPromise;
      
      assert(cancel, 'Should receive cancel object');
      assert(source.token.reason, 'Token should have reason');
      assert.deepStrictEqual(source.token.reason, cancel, 'Reason should match cancel object');
    });

    it('should cancel with custom message', async () => {
      const source = CancelToken.source();
      const message = 'User cancelled operation';
      
      const cancelPromise = source.token.promise;
      source.cancel(message);
      
      const cancel = await cancelPromise;
      
      assert.strictEqual(cancel.message, message, 'Should have custom message');
      assert.strictEqual(source.token.reason.message, message, 'Reason should have custom message');
    });

    it('should not cancel multiple times', async () => {
      const source = CancelToken.source();
      
      const cancelPromise = source.token.promise;
      
      // Cancel multiple times
      source.cancel('First cancel');
      source.cancel('Second cancel');
      source.cancel('Third cancel');
      
      const cancel = await cancelPromise;
      
      // Should only have the first cancellation
      assert.strictEqual(cancel.message, 'First cancel', 'Should keep first cancellation message');
      assert.strictEqual(source.token.reason.message, 'First cancel', 'Reason should keep first message');
    });

    it('should abort AbortSignal when cancelled', () => {
      const source = CancelToken.source();
      
      assert(!source.signal.aborted, 'Signal should not be aborted initially');
      
      source.cancel('Test cancellation');
      
      assert(source.signal.aborted, 'Signal should be aborted after cancellation');
    });
  });

  describe('CancelToken.throwIfRequested()', () => {
    it('should not throw when not cancelled', () => {
      const source = CancelToken.source();
      
      assert.doesNotThrow(() => {
        source.token.throwIfRequested();
      }, 'Should not throw when not cancelled');
    });

    it('should throw when cancelled with default message', () => {
      const source = CancelToken.source();
      source.cancel();
      
      assert.throws(() => {
        source.token.throwIfRequested();
      }, {
        name: 'fluxhttpError',
        code: 'ECONNABORTED'
      }, 'Should throw fluxhttpError when cancelled');
    });

    it('should throw with custom cancellation message', () => {
      const source = CancelToken.source();
      const message = 'Custom cancellation';
      source.cancel(message);
      
      assert.throws(() => {
        source.token.throwIfRequested();
      }, {
        message: message,
        code: 'ECONNABORTED'
      }, 'Should throw with custom message');
    });

    it('should throw fluxhttpError instance', () => {
      const source = CancelToken.source();
      source.cancel('Test');
      
      try {
        source.token.throwIfRequested();
        assert.fail('Should have thrown');
      } catch (error) {
        assert(error instanceof fluxhttpError, 'Should throw fluxhttpError');
        assert.strictEqual(error.code, 'ECONNABORTED');
        assert.strictEqual(error.message, 'Test');
      }
    });
  });

  describe('isCancel() function', () => {
    it('should identify cancel objects', () => {
      assert(isCancel({}), 'Empty object should be cancel');
      assert(isCancel({ message: 'cancelled' }), 'Object with message should be cancel');
      assert(isCancel({ message: undefined }), 'Object with undefined message should be cancel');
      assert(isCancel({ message: null }), 'Object with null message should be cancel');
      assert(isCancel({ message: '' }), 'Object with empty message should be cancel');
    });

    it('should not identify non-cancel objects', () => {
      assert(!isCancel(null), 'null should not be cancel');
      assert(!isCancel(undefined), 'undefined should not be cancel');
      assert(!isCancel('string'), 'string should not be cancel');
      assert(!isCancel(123), 'number should not be cancel');
      assert(!isCancel(true), 'boolean should not be cancel');
      assert(!isCancel([]), 'array should not be cancel');
      assert(!isCancel(() => {}), 'function should not be cancel');
    });

    it('should not identify Error objects as cancel', () => {
      const error = new Error('Test error');
      const fluxError = new fluxhttpError('Test', 'CODE');
      
      assert(!isCancel(error), 'Error should not be cancel');
      assert(!isCancel(fluxError), 'fluxhttpError should not be cancel');
    });

    it('should not identify objects with Error-like properties', () => {
      const errorLike = {
        name: 'Error',
        message: 'Test',
        stack: 'stack trace'
      };
      
      assert(!isCancel(errorLike), 'Error-like object should not be cancel');
    });

    it('should handle edge cases', () => {
      assert(!isCancel({ message: 'test', name: 'Error' }), 'Object with name should not be cancel');
      assert(!isCancel({ message: 'test', stack: 'trace' }), 'Object with stack should not be cancel');
      assert(isCancel({ message: 'test', customProp: 'value' }), 'Object with message and non-Error props should be cancel');
    });
  });

  describe('Request cancellation integration', () => {
    it('should cancel request before completion', async () => {
      const source = CancelToken.source();
      const instance = fluxhttp.create({ adapter: mockAdapter });

      const requestPromise = instance.get('https://api.test.com/slow', {
        cancelToken: source.token
      });

      // Cancel immediately
      source.cancel('User cancelled');

      await assert.rejects(
        requestPromise,
        {
          message: 'User cancelled',
          code: 'ECONNABORTED'
        },
        'Should reject with cancellation error'
      );
    });

    it('should identify cancelled requests with isCancel', async () => {
      const source = CancelToken.source();
      const instance = fluxhttp.create({ adapter: mockAdapter });

      const requestPromise = instance.get('https://api.test.com/slow', {
        cancelToken: source.token
      });

      source.cancel('Test cancellation');

      try {
        await requestPromise;
        assert.fail('Request should have been cancelled');
      } catch (error) {
        assert(fluxhttp.isCancel(error), 'Should be identified as cancelled by fluxhttp.isCancel');
      }
    });

    it('should not affect completed requests', async () => {
      const source = CancelToken.source();
      
      // Create adapter with immediate response
      const immediateAdapter = {
        request: async (config) => ({
          data: { success: true },
          status: 200,
          statusText: 'OK',
          headers: {},
          config,
          request: {}
        })
      };

      const instance = fluxhttp.create({ adapter: immediateAdapter });

      const response = await instance.get('https://api.test.com/fast', {
        cancelToken: source.token
      });

      // Cancel after completion
      source.cancel('Too late');

      // Response should still be valid
      assert.strictEqual(response.status, 200);
      assert.strictEqual(response.data.success, true);
    });

    it('should handle multiple requests with same cancel token', async () => {
      const source = CancelToken.source();
      const instance = fluxhttp.create({ adapter: mockAdapter });

      const request1 = instance.get('https://api.test.com/data1', {
        cancelToken: source.token
      });

      const request2 = instance.get('https://api.test.com/data2', {
        cancelToken: source.token
      });

      // Cancel both requests
      source.cancel('Cancel all');

      const results = await Promise.allSettled([request1, request2]);

      assert.strictEqual(results[0].status, 'rejected');
      assert.strictEqual(results[1].status, 'rejected');
      assert.strictEqual(results[0].reason.message, 'Cancel all');
      assert.strictEqual(results[1].reason.message, 'Cancel all');
    });

    it('should handle cancel token without affecting other requests', async () => {
      const source = CancelToken.source();
      const instance = fluxhttp.create({ adapter: mockAdapter });

      // Request with cancel token
      const cancelledRequest = instance.get('https://api.test.com/cancelled', {
        cancelToken: source.token
      });

      // Request without cancel token
      const normalRequest = instance.get('https://api.test.com/normal');

      // Cancel only the first request
      source.cancel('Selective cancel');

      const results = await Promise.allSettled([cancelledRequest, normalRequest]);

      assert.strictEqual(results[0].status, 'rejected');
      assert.strictEqual(results[0].reason.message, 'Selective cancel');
      assert.strictEqual(results[1].status, 'fulfilled');
      assert.strictEqual(results[1].value.data.success, true);
    });
  });

  describe('AbortSignal integration', () => {
    it('should work with AbortController directly', async () => {
      const controller = new AbortController();
      const instance = fluxhttp.create({ adapter: mockAdapter });

      const requestPromise = instance.get('https://api.test.com/abortable', {
        signal: controller.signal
      });

      // Abort immediately
      controller.abort();

      await assert.rejects(
        requestPromise,
        {
          message: 'Request canceled',
          code: 'ECONNABORTED'
        },
        'Should reject with abort error'
      );
    });

    it('should handle pre-aborted signal', async () => {
      const controller = new AbortController();
      controller.abort(); // Abort before request

      const instance = fluxhttp.create({ adapter: mockAdapter });

      const requestPromise = instance.get('https://api.test.com/pre-aborted', {
        signal: controller.signal
      });

      await assert.rejects(
        requestPromise,
        {
          message: 'Request canceled',
          code: 'ECONNABORTED'
        },
        'Should reject immediately for pre-aborted signal'
      );
    });

    it('should provide AbortSignal from CancelTokenSource', () => {
      const source = CancelToken.source();
      
      assert(source.signal instanceof AbortSignal, 'Should provide AbortSignal');
      assert(!source.signal.aborted, 'Should not be aborted initially');
      
      source.cancel();
      
      assert(source.signal.aborted, 'Should be aborted after cancel');
    });
  });

  describe('Error scenarios and edge cases', () => {
    it('should handle cancellation during adapter execution', async () => {
      let cancelDuringExecution;
      
      const delayedAdapter = {
        request: async (config) => {
          // Set up cancellation callback
          if (config.cancelToken) {
            config.cancelToken.promise.then(() => {
              cancelDuringExecution = true;
            });
          }

          // Simulate some processing time
          await new Promise(resolve => setTimeout(resolve, 50));
          
          if (cancelDuringExecution) {
            throw new fluxhttpError('Request canceled', 'ECONNABORTED');
          }
          
          return {
            data: { success: true },
            status: 200,
            statusText: 'OK',
            headers: {},
            config,
            request: {}
          };
        }
      };

      const source = CancelToken.source();
      const instance = fluxhttp.create({ adapter: delayedAdapter });

      const requestPromise = instance.get('https://api.test.com/delayed', {
        cancelToken: source.token
      });

      // Cancel during execution
      setTimeout(() => source.cancel('Mid-execution cancel'), 25);

      await assert.rejects(
        requestPromise,
        {
          message: 'Request canceled',
          code: 'ECONNABORTED'
        },
        'Should handle cancellation during adapter execution'
      );
    });

    it('should handle invalid cancel tokens gracefully', async () => {
      const instance = fluxhttp.create({ adapter: mockAdapter });

      // Test with invalid cancel token
      const invalidToken = {
        promise: 'not-a-promise',
        throwIfRequested: 'not-a-function'
      };

      // Should not throw when creating request with invalid token
      assert.doesNotThrow(() => {
        instance.get('https://api.test.com/test', {
          cancelToken: invalidToken
        });
      });
    });

    it('should handle cancellation with no message', async () => {
      const source = CancelToken.source();
      const cancelPromise = source.token.promise;
      
      source.cancel(); // No message
      
      const cancel = await cancelPromise;
      assert(cancel, 'Should have cancel object');
      assert(cancel.message === undefined, 'Message should be undefined');
      
      // Should throw with default message
      assert.throws(() => {
        source.token.throwIfRequested();
      }, {
        message: 'Request canceled'
      });
    });

    it('should handle rapid cancel/uncancel attempts', () => {
      const source = CancelToken.source();
      
      // Rapid cancellation attempts
      source.cancel('First');
      source.cancel('Second');
      source.cancel('Third');
      
      // Should maintain first cancellation
      assert.strictEqual(source.token.reason.message, 'First');
      
      // Should throw with first message
      assert.throws(() => {
        source.token.throwIfRequested();
      }, {
        message: 'First'
      });
    });

    it('should handle memory cleanup properly', async () => {
      const sources = [];
      
      // Create many cancel token sources
      for (let i = 0; i < 100; i++) {
        const source = CancelToken.source();
        sources.push(source);
        
        if (i % 2 === 0) {
          source.cancel(`Cancel ${i}`);
        }
      }
      
      // All sources should be independent
      for (let i = 0; i < sources.length; i++) {
        if (i % 2 === 0) {
          assert(sources[i].token.reason, `Source ${i} should be cancelled`);
          assert.strictEqual(sources[i].token.reason.message, `Cancel ${i}`);
        } else {
          assert(!sources[i].token.reason, `Source ${i} should not be cancelled`);
        }
      }
    });
  });

  describe('Real-world usage patterns', () => {
    it('should support request timeout simulation', async () => {
      const source = CancelToken.source();
      const instance = fluxhttp.create({ adapter: mockAdapter });

      // Set up timeout cancellation
      const timeout = setTimeout(() => {
        source.cancel('Request timeout');
      }, 50);

      const requestPromise = instance.get('https://api.test.com/slow', {
        cancelToken: source.token
      });

      try {
        await requestPromise;
        clearTimeout(timeout);
        assert.fail('Request should have timed out');
      } catch (error) {
        clearTimeout(timeout);
        assert.strictEqual(error.message, 'Request timeout');
        assert(fluxhttp.isCancel(error));
      }
    });

    it('should support user-initiated cancellation', async () => {
      const source = CancelToken.source();
      const instance = fluxhttp.create({ adapter: mockAdapter });

      const requestPromise = instance.post('https://api.test.com/upload', {
        data: new Array(1000).fill('large data'),
        cancelToken: source.token
      });

      // Simulate user clicking cancel button
      setTimeout(() => {
        source.cancel('User cancelled upload');
      }, 10);

      try {
        await requestPromise;
        assert.fail('Request should have been cancelled');
      } catch (error) {
        assert.strictEqual(error.message, 'User cancelled upload');
        assert(fluxhttp.isCancel(error));
      }
    });

    it('should support cancelling multiple related requests', async () => {
      const source = CancelToken.source();
      const instance = fluxhttp.create({ adapter: mockAdapter });

      // Start multiple related requests
      const requests = [
        instance.get('https://api.test.com/user', { cancelToken: source.token }),
        instance.get('https://api.test.com/profile', { cancelToken: source.token }),
        instance.get('https://api.test.com/settings', { cancelToken: source.token })
      ];

      // Cancel all related requests
      source.cancel('Page navigation - cancel all');

      const results = await Promise.allSettled(requests);

      // All should be cancelled
      results.forEach((result, index) => {
        assert.strictEqual(result.status, 'rejected', `Request ${index} should be rejected`);
        assert.strictEqual(result.reason.message, 'Page navigation - cancel all');
        assert(fluxhttp.isCancel(result.reason), `Request ${index} should be cancelled`);
      });
    });

    it('should work with async/await error handling', async () => {
      const source = CancelToken.source();
      const instance = fluxhttp.create({ adapter: mockAdapter });

      setTimeout(() => source.cancel('Async cancel'), 10);

      try {
        const response = await instance.get('https://api.test.com/data', {
          cancelToken: source.token
        });
        assert.fail('Should not reach here');
      } catch (error) {
        if (fluxhttp.isCancel(error)) {
          assert.strictEqual(error.message, 'Async cancel');
        } else {
          assert.fail('Error should be cancellation');
        }
      }
    });
  });
});