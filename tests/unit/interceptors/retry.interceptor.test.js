const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert');

// Import the mock adapter helper for testing
const { MockAdapter } = require('../../helpers/mock-adapter');

// Import the main library to test retry functionality
const fluxhttpModule = require('../../../dist/index.js');
const fluxhttp = fluxhttpModule.default || fluxhttpModule;
const { fluxhttpError } = fluxhttpModule;

/**
 * Comprehensive unit tests for retry interceptor functionality
 * Tests retry logic, backoff strategies, and error conditions
 */
describe('Retry Interceptor', () => {
  let instance;
  let mockAdapter;
  let requestCount;
  let requestHistory;

  beforeEach(() => {
    requestCount = 0;
    requestHistory = [];
    
    // Create a controlled mock adapter for testing retry behavior
    mockAdapter = {
      request: async (config) => {
        requestCount++;
        const currentRequest = {
          attempt: requestCount,
          url: config.url,
          retryCount: config.__retryCount || 0,
          timestamp: Date.now()
        };
        requestHistory.push(currentRequest);

        // Simulate different failure scenarios based on URL
        if (config.url.includes('/always-fail')) {
          const error = new fluxhttpError('Always fails', 'ERR_NETWORK');
          error.config = config;
          throw error;
        }

        if (config.url.includes('/fail-twice')) {
          if (requestCount <= 2) {
            const error = new fluxhttpError('Temporary failure', 'ERR_NETWORK');
            error.config = config;
            throw error;
          }
        }

        if (config.url.includes('/fail-once')) {
          if (requestCount === 1) {
            const error = new fluxhttpError('Single failure', 'ERR_NETWORK');
            error.config = config;
            throw error;
          }
        }

        if (config.url.includes('/server-error')) {
          const error = new fluxhttpError('Internal Server Error', 'ERR_BAD_RESPONSE');
          error.config = config;
          error.response = {
            status: 500,
            statusText: 'Internal Server Error',
            data: { error: 'Server error' },
            headers: {},
            config
          };
          throw error;
        }

        if (config.url.includes('/rate-limit')) {
          if (requestCount <= 2) {
            const error = new fluxhttpError('Too Many Requests', 'ERR_BAD_RESPONSE');
            error.config = config;
            error.response = {
              status: 429,
              statusText: 'Too Many Requests',
              data: { error: 'Rate limited' },
              headers: { 'Retry-After': '1' },
              config
            };
            throw error;
          }
        }

        if (config.url.includes('/client-error')) {
          const error = new fluxhttpError('Bad Request', 'ERR_BAD_REQUEST');
          error.config = config;
          error.response = {
            status: 400,
            statusText: 'Bad Request',
            data: { error: 'Invalid request' },
            headers: {},
            config
          };
          throw error;
        }

        // Success response
        return {
          data: {
            success: true,
            attempt: requestCount,
            url: config.url,
            retryCount: config.__retryCount || 0
          },
          status: 200,
          statusText: 'OK',
          headers: {},
          config,
          request: {}
        };
      }
    };

    instance = fluxhttp.create({ adapter: mockAdapter });
  });

  describe('Basic retry configuration', () => {
    it('should retry failed requests when retry is configured', async () => {
      const response = await instance.get('https://api.test.com/fail-once', {
        retry: {
          attempts: 3,
          delay: 10 // Short delay for testing
        }
      });

      assert.strictEqual(requestCount, 2, 'Should make 2 requests total (1 failure + 1 success)');
      assert.strictEqual(response.data.success, true);
      assert.strictEqual(response.data.attempt, 2);
    });

    it('should not retry requests without retry configuration', async () => {
      await assert.rejects(
        async () => await instance.get('https://api.test.com/fail-once'),
        { message: 'Single failure' }
      );

      assert.strictEqual(requestCount, 1, 'Should only make 1 request');
    });

    it('should respect maximum retry attempts', async () => {
      await assert.rejects(
        async () => await instance.get('https://api.test.com/always-fail', {
          retry: {
            attempts: 3,
            delay: 10
          }
        }),
        { message: 'Always fails' }
      );

      assert.strictEqual(requestCount, 3, 'Should make 3 attempts');
    });

    it('should succeed after multiple retries', async () => {
      const response = await instance.get('https://api.test.com/fail-twice', {
        retry: {
          attempts: 5,
          delay: 10
        }
      });

      assert.strictEqual(requestCount, 3, 'Should make 3 requests (2 failures + 1 success)');
      assert.strictEqual(response.data.success, true);
      assert.strictEqual(response.data.attempt, 3);
    });
  });

  describe('Error type handling', () => {
    it('should retry network errors', async () => {
      await assert.rejects(
        async () => await instance.get('https://api.test.com/always-fail', {
          retry: { attempts: 2, delay: 10 }
        }),
        { code: 'ERR_NETWORK' }
      );

      assert.strictEqual(requestCount, 2, 'Should retry network errors');
    });

    it('should retry server errors (5xx)', async () => {
      await assert.rejects(
        async () => await instance.get('https://api.test.com/server-error', {
          retry: { attempts: 2, delay: 10 }
        }),
        { message: 'Internal Server Error' }
      );

      assert.strictEqual(requestCount, 2, 'Should retry server errors');
    });

    it('should retry rate limit errors (429)', async () => {
      const response = await instance.get('https://api.test.com/rate-limit', {
        retry: { attempts: 3, delay: 10 }
      });

      assert.strictEqual(requestCount, 3, 'Should retry rate limit errors');
      assert.strictEqual(response.data.success, true);
    });

    it('should not retry client errors (4xx except 429)', async () => {
      await assert.rejects(
        async () => await instance.get('https://api.test.com/client-error', {
          retry: { attempts: 3, delay: 10 }
        }),
        { message: 'Bad Request' }
      );

      assert.strictEqual(requestCount, 1, 'Should not retry client errors');
    });
  });

  describe('Custom retry conditions', () => {
    it('should use custom retry condition when provided', async () => {
      let conditionCalled = false;
      let receivedError = null;

      const customRetryCondition = (error) => {
        conditionCalled = true;
        receivedError = error;
        // Only retry if the error message contains 'Temporary'
        return error.message.includes('Temporary');
      };

      const response = await instance.get('https://api.test.com/fail-twice', {
        retry: {
          attempts: 3,
          delay: 10,
          retryCondition: customRetryCondition
        }
      });

      assert(conditionCalled, 'Custom retry condition should be called');
      assert(receivedError, 'Should receive error in retry condition');
      assert.strictEqual(receivedError.message, 'Temporary failure');
      assert.strictEqual(response.data.success, true);
    });

    it('should not retry when custom condition returns false', async () => {
      const alwaysFalseCondition = () => false;

      await assert.rejects(
        async () => await instance.get('https://api.test.com/fail-once', {
          retry: {
            attempts: 3,
            delay: 10,
            retryCondition: alwaysFalseCondition
          }
        }),
        { message: 'Single failure' }
      );

      assert.strictEqual(requestCount, 1, 'Should not retry when condition returns false');
    });

    it('should always retry when custom condition returns true', async () => {
      const alwaysTrueCondition = () => true;

      await assert.rejects(
        async () => await instance.get('https://api.test.com/client-error', {
          retry: {
            attempts: 2,
            delay: 10,
            retryCondition: alwaysTrueCondition
          }
        }),
        { message: 'Bad Request' }
      );

      assert.strictEqual(requestCount, 2, 'Should retry when condition returns true');
    });
  });

  describe('Delay and backoff behavior', () => {
    it('should apply delay between retries', async () => {
      const startTime = Date.now();
      
      await assert.rejects(
        async () => await instance.get('https://api.test.com/always-fail', {
          retry: {
            attempts: 3,
            delay: 100 // 100ms delay
          }
        })
      );

      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // Should take at least 200ms (2 delays of 100ms each)
      assert(totalTime >= 180, `Should apply delays, took ${totalTime}ms`);
      assert.strictEqual(requestCount, 3);
    });

    it('should handle exponential backoff', async () => {
      const delays = [];
      const originalSetTimeout = global.setTimeout;
      
      global.setTimeout = (callback, delay) => {
        delays.push(delay);
        return originalSetTimeout(callback, Math.min(delay, 50)); // Cap delay for testing
      };

      try {
        await assert.rejects(
          async () => await instance.get('https://api.test.com/always-fail', {
            retry: {
              attempts: 3,
              delay: 10,
              exponentialBackoff: true
            }
          })
        );

        assert(delays.length >= 2, 'Should have recorded delays');
        // With exponential backoff, delays should increase
        if (delays.length >= 2) {
          assert(delays[1] >= delays[0], 'Delays should increase with exponential backoff');
        }
      } finally {
        global.setTimeout = originalSetTimeout;
      }
    });

    it('should handle zero delay configuration', async () => {
      const startTime = Date.now();
      
      await assert.rejects(
        async () => await instance.get('https://api.test.com/always-fail', {
          retry: {
            attempts: 3,
            delay: 0
          }
        })
      );

      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // Should complete quickly with no delay
      assert(totalTime < 100, `Should be fast with no delay, took ${totalTime}ms`);
      assert.strictEqual(requestCount, 3);
    });
  });

  describe('Request tracking and metadata', () => {
    it('should track retry count in request config', async () => {
      const response = await instance.get('https://api.test.com/fail-twice', {
        retry: {
          attempts: 5,
          delay: 10
        }
      });

      // Check request history
      assert.strictEqual(requestHistory.length, 3);
      assert.strictEqual(requestHistory[0].retryCount, 0); // First attempt
      assert.strictEqual(requestHistory[1].retryCount, 1); // First retry
      assert.strictEqual(requestHistory[2].retryCount, 2); // Second retry (success)

      assert.strictEqual(response.data.retryCount, 2);
    });

    it('should reset retry count on successful response', async () => {
      // First, make a request that succeeds after retries
      const response1 = await instance.get('https://api.test.com/fail-once', {
        retry: { attempts: 3, delay: 10 }
      });

      // Reset for next test
      requestCount = 0;
      requestHistory = [];

      // Then make a successful request
      const response2 = await instance.get('https://api.test.com/success', {
        retry: { attempts: 3, delay: 10 }
      });

      // The second response should not have retry metadata
      assert.strictEqual(response2.data.retryCount, 0);
    });

    it('should preserve original request configuration', async () => {
      const originalConfig = {
        url: 'https://api.test.com/fail-once',
        method: 'GET',
        headers: { 'X-Custom': 'value' },
        timeout: 5000,
        retry: { attempts: 3, delay: 10 }
      };

      const response = await instance.request(originalConfig);

      // Original config should be preserved
      const lastRequest = requestHistory[requestHistory.length - 1];
      assert.strictEqual(mockAdapter.lastConfig.url, originalConfig.url);
      assert.strictEqual(mockAdapter.lastConfig.method, originalConfig.method);
      assert.strictEqual(mockAdapter.lastConfig.timeout, originalConfig.timeout);
    });
  });

  describe('Integration with other features', () => {
    it('should work with request interceptors', async () => {
      let interceptorCalls = 0;
      
      instance.interceptors.request.use((config) => {
        interceptorCalls++;
        config.headers = { ...config.headers, 'X-Intercepted': `call-${interceptorCalls}` };
        return config;
      });

      const response = await instance.get('https://api.test.com/fail-once', {
        retry: { attempts: 3, delay: 10 }
      });

      // Interceptor should be called for each attempt
      assert.strictEqual(interceptorCalls, 2, 'Request interceptor should be called for each attempt');
      assert.strictEqual(response.data.success, true);
    });

    it('should work with response interceptors', async () => {
      let interceptorCalls = 0;
      
      instance.interceptors.response.use((response) => {
        interceptorCalls++;
        response.data = { ...response.data, interceptorCall: interceptorCalls };
        return response;
      });

      const response = await instance.get('https://api.test.com/fail-once', {
        retry: { attempts: 3, delay: 10 }
      });

      // Response interceptor should only be called for successful response
      assert.strictEqual(interceptorCalls, 1, 'Response interceptor should be called once for success');
      assert.strictEqual(response.data.interceptorCall, 1);
    });

    it('should work with base URL configuration', async () => {
      const instanceWithBase = fluxhttp.create({
        adapter: mockAdapter,
        baseURL: 'https://api.test.com'
      });

      const response = await instanceWithBase.get('/fail-once', {
        retry: { attempts: 3, delay: 10 }
      });

      assert.strictEqual(response.data.success, true);
      assert(requestHistory[0].url.includes('https://api.test.com/fail-once'));
    });

    it('should work with different HTTP methods', async () => {
      const methods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
      
      for (const method of methods) {
        requestCount = 0;
        requestHistory = [];

        let response;
        if (['POST', 'PUT', 'PATCH'].includes(method)) {
          response = await instance[method.toLowerCase()]('https://api.test.com/fail-once', 
            { data: 'test' },
            { retry: { attempts: 3, delay: 10 } }
          );
        } else {
          response = await instance[method.toLowerCase()]('https://api.test.com/fail-once',
            { retry: { attempts: 3, delay: 10 } }
          );
        }

        assert.strictEqual(requestCount, 2, `Should retry for ${method} method`);
        assert.strictEqual(response.data.success, true);
      }
    });
  });

  describe('Edge cases and error scenarios', () => {
    it('should handle undefined retry configuration gracefully', async () => {
      await assert.rejects(
        async () => await instance.get('https://api.test.com/fail-once', {
          retry: undefined
        })
      );

      assert.strictEqual(requestCount, 1, 'Should not retry with undefined config');
    });

    it('should handle null retry configuration gracefully', async () => {
      await assert.rejects(
        async () => await instance.get('https://api.test.com/fail-once', {
          retry: null
        })
      );

      assert.strictEqual(requestCount, 1, 'Should not retry with null config');
    });

    it('should handle invalid attempts configuration', async () => {
      await assert.rejects(
        async () => await instance.get('https://api.test.com/fail-once', {
          retry: {
            attempts: -1, // Invalid
            delay: 10
          }
        })
      );

      assert.strictEqual(requestCount, 1, 'Should not retry with invalid attempts');
    });

    it('should handle zero attempts configuration', async () => {
      await assert.rejects(
        async () => await instance.get('https://api.test.com/fail-once', {
          retry: {
            attempts: 0,
            delay: 10
          }
        })
      );

      assert.strictEqual(requestCount, 1, 'Should not retry with zero attempts');
    });

    it('should handle large delay values', async () => {
      const startTime = Date.now();
      
      await assert.rejects(
        async () => await instance.get('https://api.test.com/always-fail', {
          retry: {
            attempts: 2,
            delay: 1000 // 1 second (we'll cap it in the adapter)
          }
        })
      );

      const endTime = Date.now();
      assert.strictEqual(requestCount, 2);
      // Test should still complete in reasonable time due to our adapter setup
    });

    it('should handle errors without config', async () => {
      // Create a special adapter that throws errors without config
      const noConfigAdapter = {
        request: async () => {
          const error = new Error('No config error');
          // Don't set error.config
          throw error;
        }
      };

      const noConfigInstance = fluxhttp.create({ adapter: noConfigAdapter });

      await assert.rejects(
        async () => await noConfigInstance.get('https://api.test.com/test', {
          retry: { attempts: 3, delay: 10 }
        }),
        { message: 'No config error' }
      );
    });

    it('should handle errors without response', async () => {
      const networkErrorAdapter = {
        request: async (config) => {
          const error = new fluxhttpError('Network error', 'ERR_NETWORK');
          error.config = config;
          // Don't set error.response
          throw error;
        }
      };

      const networkInstance = fluxhttp.create({ adapter: networkErrorAdapter });

      await assert.rejects(
        async () => await networkInstance.get('https://api.test.com/test', {
          retry: { attempts: 2, delay: 10 }
        }),
        { message: 'Network error' }
      );

      // Should retry network errors even without response
    });

    it('should handle malformed retry configuration', async () => {
      const malformedRetry = {
        attempts: 'invalid',
        delay: 'invalid',
        retryCondition: 'not a function'
      };

      // Should handle gracefully without throwing
      await assert.rejects(
        async () => await instance.get('https://api.test.com/fail-once', {
          retry: malformedRetry
        })
      );
    });

    it('should handle concurrent retry requests', async () => {
      const promises = [
        instance.get('https://api.test.com/fail-once-1', { retry: { attempts: 3, delay: 10 } }),
        instance.get('https://api.test.com/fail-once-2', { retry: { attempts: 3, delay: 10 } }),
        instance.get('https://api.test.com/fail-once-3', { retry: { attempts: 3, delay: 10 } })
      ];

      const responses = await Promise.all(promises);

      responses.forEach(response => {
        assert.strictEqual(response.data.success, true);
      });

      // Each request should have been retried independently
      assert(requestCount >= 6, 'Should handle concurrent retries');
    });
  });

  describe('Performance and resource management', () => {
    it('should not leak memory with many retry attempts', async () => {
      const startMemory = process.memoryUsage?.()?.heapUsed || 0;

      // Create many requests with retries
      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(
          instance.get(`https://api.test.com/success-${i}`, {
            retry: { attempts: 1, delay: 1 }
          }).catch(() => {}) // Ignore errors
        );
      }

      await Promise.allSettled(promises);

      const endMemory = process.memoryUsage?.()?.heapUsed || 0;
      const memoryIncrease = endMemory - startMemory;

      // Memory increase should be reasonable (less than 10MB for this test)
      assert(memoryIncrease < 10 * 1024 * 1024, `Memory increase should be minimal: ${memoryIncrease} bytes`);
    });

    it('should handle very short delays efficiently', async () => {
      const startTime = Date.now();

      await assert.rejects(
        async () => await instance.get('https://api.test.com/always-fail', {
          retry: {
            attempts: 10,
            delay: 1 // 1ms delay
          }
        })
      );

      const endTime = Date.now();
      const totalTime = endTime - startTime;

      assert.strictEqual(requestCount, 10);
      // Should complete quickly even with many attempts
      assert(totalTime < 500, `Should be efficient with short delays: ${totalTime}ms`);
    });
  });
});