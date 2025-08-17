import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import {
  ExponentialBackoffStrategy,
  executeWithRetry,
  defaultRetryConfig,
  type RetryStrategy,
} from '../../../src/core/retry.js';
import type { fluxhttpRequestConfig, RetryConfig } from '../../../src/types/index.js';
import { fluxhttpError } from '../../../src/errors/fluxhttperror.js';

// Helper function to create mock errors
function createMockError(
  code?: string,
  status?: number,
  headers?: Record<string, string>
): fluxhttpError {
  const error = new fluxhttpError('Mock error', {}, null, {});
  if (code) error.code = code;
  if (status) {
    error.response = {
      data: {},
      status,
      statusText: 'Error',
      headers: headers || {},
      config: {},
    };
  }
  return error;
}

// Helper function to create a failing operation
function createFailingOperation(
  attempts: number,
  error: fluxhttpError,
  successValue?: any
) {
  let callCount = 0;
  return () => {
    callCount++;
    if (callCount <= attempts) {
      throw error;
    }
    return Promise.resolve(successValue || 'success');
  };
}

// Helper function to create a timing operation
function createTimedOperation(delay: number, result: any = 'success') {
  return () => {
    return new Promise((resolve) => {
      setTimeout(() => resolve(result), delay);
    });
  };
}

describe('Retry System', () => {
  describe('ExponentialBackoffStrategy', () => {
    let strategy: ExponentialBackoffStrategy;

    beforeEach(() => {
      strategy = new ExponentialBackoffStrategy();
    });

    describe('shouldRetry', () => {
      it('should retry network errors', () => {
        const error = createMockError('ERR_NETWORK');
        const config: RetryConfig = { attempts: 3 };
        
        assert.strictEqual(strategy.shouldRetry(error, 0, config), true);
        assert.strictEqual(strategy.shouldRetry(error, 1, config), true);
        assert.strictEqual(strategy.shouldRetry(error, 2, config), true);
        assert.strictEqual(strategy.shouldRetry(error, 3, config), false); // Exceeds attempts
      });

      it('should retry timeout errors', () => {
        const error = createMockError('ETIMEDOUT');
        const config: RetryConfig = { attempts: 3 };
        
        assert.strictEqual(strategy.shouldRetry(error, 0, config), true);
        assert.strictEqual(strategy.shouldRetry(error, 1, config), true);
      });

      it('should retry server errors (5xx)', () => {
        const error500 = createMockError(undefined, 500);
        const error502 = createMockError(undefined, 502);
        const error503 = createMockError(undefined, 503);
        const config: RetryConfig = { attempts: 3 };
        
        assert.strictEqual(strategy.shouldRetry(error500, 0, config), true);
        assert.strictEqual(strategy.shouldRetry(error502, 0, config), true);
        assert.strictEqual(strategy.shouldRetry(error503, 0, config), true);
      });

      it('should retry rate limiting errors (429)', () => {
        const error = createMockError(undefined, 429);
        const config: RetryConfig = { attempts: 3 };
        
        assert.strictEqual(strategy.shouldRetry(error, 0, config), true);
      });

      it('should retry connection errors', () => {
        const errorRefused = createMockError('ECONNREFUSED');
        const errorReset = createMockError('ECONNRESET');
        const config: RetryConfig = { attempts: 3 };
        
        assert.strictEqual(strategy.shouldRetry(errorRefused, 0, config), true);
        assert.strictEqual(strategy.shouldRetry(errorReset, 0, config), true);
      });

      it('should not retry client errors (4xx except 429)', () => {
        const error400 = createMockError(undefined, 400);
        const error401 = createMockError(undefined, 401);
        const error404 = createMockError(undefined, 404);
        const config: RetryConfig = { attempts: 3 };
        
        assert.strictEqual(strategy.shouldRetry(error400, 0, config), false);
        assert.strictEqual(strategy.shouldRetry(error401, 0, config), false);
        assert.strictEqual(strategy.shouldRetry(error404, 0, config), false);
      });

      it('should not retry successful responses', () => {
        const error200 = createMockError(undefined, 200);
        const config: RetryConfig = { attempts: 3 };
        
        assert.strictEqual(strategy.shouldRetry(error200, 0, config), false);
      });

      it('should respect custom retry condition', () => {
        const error = createMockError('CUSTOM_ERROR');
        const config: RetryConfig = {
          attempts: 3,
          retryCondition: (err) => err.code === 'CUSTOM_ERROR',
        };
        
        assert.strictEqual(strategy.shouldRetry(error, 0, config), true);
        
        const config2: RetryConfig = {
          attempts: 3,
          retryCondition: (err) => err.code === 'OTHER_ERROR',
        };
        
        assert.strictEqual(strategy.shouldRetry(error, 0, config2), false);
      });

      it('should not retry when attempt exceeds max attempts', () => {
        const error = createMockError('ERR_NETWORK');
        const config: RetryConfig = { attempts: 2 };
        
        assert.strictEqual(strategy.shouldRetry(error, 0, config), true);
        assert.strictEqual(strategy.shouldRetry(error, 1, config), true);
        assert.strictEqual(strategy.shouldRetry(error, 2, config), false);
      });

      it('should handle missing config gracefully', () => {
        const error = createMockError('ERR_NETWORK');
        const config: RetryConfig = {}; // No attempts specified
        
        // Should default to 3 attempts
        assert.strictEqual(strategy.shouldRetry(error, 0, config), true);
        assert.strictEqual(strategy.shouldRetry(error, 3, config), false);
      });
    });

    describe('getDelay', () => {
      it('should calculate exponential backoff by default', () => {
        const config: RetryConfig = { delay: 1000, backoff: 'exponential' };
        
        assert.strictEqual(strategy.getDelay(0, config), 1000); // Base delay + jitter
        
        // Allow for jitter (10% of delay)
        const delay1 = strategy.getDelay(1, config);
        assert(delay1 >= 2000 && delay1 <= 2200); // 2000 + 10% jitter
        
        const delay2 = strategy.getDelay(2, config);
        assert(delay2 >= 4000 && delay2 <= 4400); // 4000 + 10% jitter
      });

      it('should calculate linear backoff', () => {
        const config: RetryConfig = { delay: 1000, backoff: 'linear' };
        
        const delay0 = strategy.getDelay(0, config);
        assert(delay0 >= 1000 && delay0 <= 1100); // 1000 + 10% jitter
        
        const delay1 = strategy.getDelay(1, config);
        assert(delay1 >= 2000 && delay1 <= 2200); // 2000 + 10% jitter
        
        const delay2 = strategy.getDelay(2, config);
        assert(delay2 >= 3000 && delay2 <= 3300); // 3000 + 10% jitter
      });

      it('should calculate constant backoff', () => {
        const config: RetryConfig = { delay: 1000, backoff: 'constant' };
        
        const delay0 = strategy.getDelay(0, config);
        const delay1 = strategy.getDelay(1, config);
        const delay2 = strategy.getDelay(2, config);
        
        // All delays should be around 1000ms + jitter
        assert(delay0 >= 1000 && delay0 <= 1100);
        assert(delay1 >= 1000 && delay1 <= 1100);
        assert(delay2 >= 1000 && delay2 <= 1100);
      });

      it('should respect maxDelay', () => {
        const config: RetryConfig = {
          delay: 1000,
          maxDelay: 5000,
          backoff: 'exponential',
        };
        
        // High attempt number should be capped by maxDelay
        const delay = strategy.getDelay(10, config);
        assert(delay <= 5000);
      });

      it('should use default values when not specified', () => {
        const config: RetryConfig = {};
        
        const delay = strategy.getDelay(0, config);
        assert(delay >= 1000 && delay <= 1100); // Default delay 1000 + jitter
      });

      it('should respect Retry-After header', () => {
        const error = createMockError(undefined, 429, { 'retry-after': '5' });
        const config: RetryConfig = { delay: 1000 };
        
        const delay = strategy.getDelay(0, config, error);
        assert(delay >= 5000); // Should be at least 5 seconds
      });

      it('should handle invalid Retry-After header', () => {
        const error = createMockError(undefined, 429, { 'retry-after': 'invalid' });
        const config: RetryConfig = { delay: 1000 };
        
        const delay = strategy.getDelay(0, config, error);
        assert(delay >= 1000 && delay <= 1100); // Should fall back to normal delay
      });

      it('should prefer larger delay between calculated and Retry-After', () => {
        const error = createMockError(undefined, 429, { 'retry-after': '2' });
        const config: RetryConfig = { delay: 1000, backoff: 'exponential' };
        
        // For attempt 2, exponential delay would be ~4000ms
        const delay = strategy.getDelay(2, config, error);
        assert(delay >= 4000); // Should use calculated delay, not Retry-After
      });
    });

    describe('Edge Cases', () => {
      it('should handle null/undefined error gracefully', () => {
        const config: RetryConfig = { attempts: 3 };
        
        assert.doesNotThrow(() => {
          strategy.shouldRetry(null as any, 0, config);
        });
        
        assert.doesNotThrow(() => {
          strategy.getDelay(0, config, undefined);
        });
      });

      it('should handle error without response', () => {
        const error = new fluxhttpError('Test error', {}, null, {});
        const config: RetryConfig = { attempts: 3 };
        
        // Should use default retry logic for errors without response
        const shouldRetry = strategy.shouldRetry(error, 0, config);
        assert.strictEqual(typeof shouldRetry, 'boolean');
      });

      it('should handle very high attempt numbers', () => {
        const config: RetryConfig = { delay: 1000, maxDelay: 30000 };
        
        const delay = strategy.getDelay(100, config);
        assert(delay <= 30000); // Should be capped by maxDelay
      });

      it('should handle negative delay values', () => {
        const config: RetryConfig = { delay: -1000 };
        
        const delay = strategy.getDelay(0, config);
        assert(delay >= 0); // Should not be negative
      });
    });
  });

  describe('executeWithRetry', () => {
    it('should execute operation once if it succeeds', async () => {
      let callCount = 0;
      const operation = () => {
        callCount++;
        return Promise.resolve('success');
      };
      
      const config: fluxhttpRequestConfig = {
        retry: { attempts: 3 },
      };
      
      const result = await executeWithRetry(operation, config);
      
      assert.strictEqual(result, 'success');
      assert.strictEqual(callCount, 1);
    });

    it('should retry failed operations', async () => {
      const error = createMockError('ERR_NETWORK');
      const operation = createFailingOperation(2, error, 'success');
      
      const config: fluxhttpRequestConfig = {
        retry: { attempts: 3, delay: 10 }, // Fast retry for testing
      };
      
      const result = await executeWithRetry(operation, config);
      assert.strictEqual(result, 'success');
    });

    it('should throw error after max attempts', async () => {
      const error = createMockError('ERR_NETWORK');
      const operation = () => {
        throw error;
      };
      
      const config: fluxhttpRequestConfig = {
        retry: { attempts: 2, delay: 10 },
      };
      
      await assert.rejects(
        () => executeWithRetry(operation, config),
        (err: fluxhttpError) => err.code === 'ERR_NETWORK'
      );
    });

    it('should not retry non-retryable errors', async () => {
      const error = createMockError(undefined, 400); // Client error
      let callCount = 0;
      const operation = () => {
        callCount++;
        throw error;
      };
      
      const config: fluxhttpRequestConfig = {
        retry: { attempts: 3, delay: 10 },
      };
      
      await assert.rejects(
        () => executeWithRetry(operation, config),
        (err: fluxhttpError) => err.response?.status === 400
      );
      
      assert.strictEqual(callCount, 1); // Should only try once
    });

    it('should work without retry config', async () => {
      let callCount = 0;
      const operation = () => {
        callCount++;
        return Promise.resolve('success');
      };
      
      const config: fluxhttpRequestConfig = {}; // No retry config
      
      const result = await executeWithRetry(operation, config);
      
      assert.strictEqual(result, 'success');
      assert.strictEqual(callCount, 1);
    });

    it('should work with disabled retry (attempts = 0)', async () => {
      const error = createMockError('ERR_NETWORK');
      let callCount = 0;
      const operation = () => {
        callCount++;
        throw error;
      };
      
      const config: fluxhttpRequestConfig = {
        retry: { attempts: 0 },
      };
      
      await assert.rejects(
        () => executeWithRetry(operation, config),
        (err: fluxhttpError) => err.code === 'ERR_NETWORK'
      );
      
      assert.strictEqual(callCount, 1);
    });

    it('should work with custom retry strategy', async () => {
      const customStrategy: RetryStrategy = {
        shouldRetry: () => true, // Always retry
        getDelay: () => 1, // Very fast retry
      };
      
      const error = createMockError('CUSTOM_ERROR');
      const operation = createFailingOperation(2, error, 'success');
      
      const config: fluxhttpRequestConfig = {
        retry: { attempts: 3 },
      };
      
      const result = await executeWithRetry(operation, config, customStrategy);
      assert.strictEqual(result, 'success');
    });

    it('should handle async operations correctly', async () => {
      let callCount = 0;
      const operation = async () => {
        callCount++;
        await new Promise(resolve => setTimeout(resolve, 10));
        if (callCount < 3) {
          throw createMockError('ERR_NETWORK');
        }
        return 'async success';
      };
      
      const config: fluxhttpRequestConfig = {
        retry: { attempts: 3, delay: 10 },
      };
      
      const result = await executeWithRetry(operation, config);
      assert.strictEqual(result, 'async success');
      assert.strictEqual(callCount, 3);
    });

    it('should handle operations that throw synchronously', async () => {
      const error = createMockError('SYNC_ERROR');
      let callCount = 0;
      const operation = () => {
        callCount++;
        throw error; // Synchronous throw
      };
      
      const config: fluxhttpRequestConfig = {
        retry: { attempts: 2, delay: 10 },
      };
      
      await assert.rejects(
        () => executeWithRetry(operation, config),
        (err: fluxhttpError) => err.code === 'SYNC_ERROR'
      );
      
      assert.strictEqual(callCount, 2); // Should retry once
    });

    it('should respect retry delays', async () => {
      const error = createMockError('ERR_NETWORK');
      const operation = createFailingOperation(1, error, 'success');
      
      const config: fluxhttpRequestConfig = {
        retry: { attempts: 2, delay: 100 }, // 100ms delay
      };
      
      const start = Date.now();
      const result = await executeWithRetry(operation, config);
      const duration = Date.now() - start;
      
      assert.strictEqual(result, 'success');
      assert(duration >= 100, 'Should wait for delay'); // At least 100ms
    });

    it('should handle complex error objects', async () => {
      const complexError = createMockError('ERR_NETWORK');
      complexError.config = { url: 'https://api.example.com' };
      complexError.request = { method: 'GET' };
      
      let callCount = 0;
      const operation = () => {
        callCount++;
        if (callCount === 1) {
          throw complexError;
        }
        return Promise.resolve('success');
      };
      
      const config: fluxhttpRequestConfig = {
        retry: { attempts: 2, delay: 10 },
      };
      
      const result = await executeWithRetry(operation, config);
      assert.strictEqual(result, 'success');
      assert.strictEqual(callCount, 2);
    });
  });

  describe('defaultRetryConfig', () => {
    it('should export default retry configuration', () => {
      assert.strictEqual(defaultRetryConfig.attempts, 3);
      assert.strictEqual(defaultRetryConfig.delay, 1000);
      assert.strictEqual(defaultRetryConfig.maxDelay, 30000);
      assert.strictEqual(defaultRetryConfig.backoff, 'exponential');
      assert.strictEqual(defaultRetryConfig.retryCondition, undefined);
    });

    it('should be usable as retry config', async () => {
      const error = createMockError('ERR_NETWORK');
      const operation = createFailingOperation(2, error, 'success');
      
      const config: fluxhttpRequestConfig = {
        retry: { ...defaultRetryConfig, delay: 10 }, // Fast for testing
      };
      
      const result = await executeWithRetry(operation, config);
      assert.strictEqual(result, 'success');
    });
  });

  describe('Integration Tests', () => {
    it('should work with real-world retry scenarios', async () => {
      // Simulate intermittent network failures
      let attempt = 0;
      const operation = () => {
        attempt++;
        
        if (attempt === 1) {
          throw createMockError('ETIMEDOUT'); // First: timeout
        } else if (attempt === 2) {
          throw createMockError(undefined, 503); // Second: service unavailable
        } else if (attempt === 3) {
          throw createMockError(undefined, 429, { 'retry-after': '1' }); // Third: rate limited
        }
        
        return Promise.resolve({ data: 'success', status: 200 });
      };
      
      const config: fluxhttpRequestConfig = {
        retry: {
          attempts: 5,
          delay: 10,
          maxDelay: 1000,
          backoff: 'exponential',
        },
      };
      
      const result = await executeWithRetry(operation, config);
      assert.deepStrictEqual(result, { data: 'success', status: 200 });
      assert.strictEqual(attempt, 4); // Should succeed on 4th attempt
    });

    it('should handle custom retry conditions correctly', async () => {
      const operation = () => {
        throw createMockError('CUSTOM_TRANSIENT_ERROR');
      };
      
      const config: fluxhttpRequestConfig = {
        retry: {
          attempts: 3,
          delay: 10,
          retryCondition: (error) => {
            return error.code === 'CUSTOM_TRANSIENT_ERROR';
          },
        },
      };
      
      await assert.rejects(
        () => executeWithRetry(operation, config),
        (err: fluxhttpError) => err.code === 'CUSTOM_TRANSIENT_ERROR'
      );
    });

    it('should respect different backoff strategies', async () => {
      const strategies = ['constant', 'linear', 'exponential'] as const;
      
      for (const backoff of strategies) {
        const error = createMockError('ERR_NETWORK');
        const operation = createFailingOperation(1, error, `success-${backoff}`);
        
        const config: fluxhttpRequestConfig = {
          retry: {
            attempts: 2,
            delay: 10,
            backoff,
          },
        };
        
        const result = await executeWithRetry(operation, config);
        assert.strictEqual(result, `success-${backoff}`);
      }
    });
  });

  describe('Performance and Memory', () => {
    it('should not leak memory with many retry operations', async () => {
      const initialMemory = process.memoryUsage().heapUsed;
      
      const operations = [];
      for (let i = 0; i < 100; i++) {
        const operation = createTimedOperation(1, `result-${i}`);
        const config: fluxhttpRequestConfig = {
          retry: { attempts: 1 }, // No actual retries
        };
        
        operations.push(executeWithRetry(operation, config));
      }
      
      await Promise.all(operations);
      
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;
      
      // Memory increase should be reasonable
      assert(memoryIncrease < 10 * 1024 * 1024, 'Memory usage should not grow excessively');
    });

    it('should handle high-frequency retry operations', async () => {
      const start = Date.now();
      
      const operations = [];
      for (let i = 0; i < 50; i++) {
        const operation = () => Promise.resolve(`fast-result-${i}`);
        const config: fluxhttpRequestConfig = {
          retry: { attempts: 1 },
        };
        
        operations.push(executeWithRetry(operation, config));
      }
      
      const results = await Promise.all(operations);
      const duration = Date.now() - start;
      
      assert.strictEqual(results.length, 50);
      assert(duration < 1000, 'Should handle many operations quickly');
    });
  });

  describe('Error Edge Cases', () => {
    it('should handle errors without code property', async () => {
      const error = new fluxhttpError('No code error', {}, null, {});
      delete (error as any).code;
      
      const strategy = new ExponentialBackoffStrategy();
      const config: RetryConfig = { attempts: 3 };
      
      // Should not throw when checking if error is retryable
      const shouldRetry = strategy.shouldRetry(error, 0, config);
      assert.strictEqual(typeof shouldRetry, 'boolean');
    });

    it('should handle errors with non-numeric status', async () => {
      const error = createMockError();
      if (error.response) {
        (error.response as any).status = 'invalid';
      }
      
      const strategy = new ExponentialBackoffStrategy();
      const config: RetryConfig = { attempts: 3 };
      
      // Should handle gracefully
      const shouldRetry = strategy.shouldRetry(error, 0, config);
      assert.strictEqual(typeof shouldRetry, 'boolean');
    });

    it('should handle operations that return non-promise values', async () => {
      const operation = () => 'immediate-value' as any;
      const config: fluxhttpRequestConfig = {
        retry: { attempts: 3 },
      };
      
      const result = await executeWithRetry(operation, config);
      assert.strictEqual(result, 'immediate-value');
    });

    it('should handle malformed retry-after headers', async () => {
      const strategy = new ExponentialBackoffStrategy();
      const config: RetryConfig = { delay: 1000 };
      
      const testCases = [
        { 'retry-after': '' },
        { 'retry-after': 'not-a-number' },
        { 'retry-after': '-5' },
        { 'retry-after': '999999999999' },
      ];
      
      for (const headers of testCases) {
        const error = createMockError(undefined, 429, headers);
        const delay = strategy.getDelay(0, config, error);
        
        // Should return a reasonable delay
        assert(delay >= 1000);
        assert(delay <= 32000); // Should be capped reasonably
      }
    });
  });
});
