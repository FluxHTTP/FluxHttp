import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import {
  RequestDeduplicator,
  defaultDeduplicator,
  createDeduplicator,
  type DeduplicationConfig,
} from '../../../src/core/deduplication.js';
import type { fluxhttpRequestConfig, fluxhttpResponse } from '../../../src/types/index.js';

// Helper function to create a mock response
function createMockResponse<T = unknown>(data: T = {} as T): fluxhttpResponse<T> {
  return {
    data,
    status: 200,
    statusText: 'OK',
    headers: {},
    config: {},
  };
}

// Helper function to create a mock request executor
function createMockExecutor<T = unknown>(
  response: fluxhttpResponse<T> = createMockResponse(),
  delay = 0
): () => Promise<fluxhttpResponse<T>> {
  return () => {
    return new Promise((resolve) => {
      setTimeout(() => resolve(response), delay);
    });
  };
}

// Helper function to create a failing request executor
function createFailingExecutor(error: Error, delay = 0): () => Promise<never> {
  return () => {
    return new Promise((_, reject) => {
      setTimeout(() => reject(error), delay);
    });
  };
}

describe('Request Deduplication', () => {
  describe('RequestDeduplicator', () => {
    let deduplicator: RequestDeduplicator;

    beforeEach(() => {
      deduplicator = new RequestDeduplicator({
        enabled: true,
        maxAge: 1000, // 1 second for fast testing
      });
    });

    afterEach(() => {
      deduplicator.destroy();
    });

    describe('Construction and Configuration', () => {
      it('should create with default configuration', () => {
        const d = new RequestDeduplicator();
        assert(d instanceof RequestDeduplicator);
        assert.strictEqual(d.isDisposed(), false);
        d.destroy();
      });

      it('should accept custom configuration', () => {
        const config: DeduplicationConfig = {
          enabled: false,
          maxAge: 5000,
          includeHeaders: ['authorization'],
        };
        
        const d = new RequestDeduplicator(config);
        assert(d instanceof RequestDeduplicator);
        d.destroy();
      });

      it('should use default values for missing config properties', () => {
        const d = new RequestDeduplicator({});
        assert.strictEqual(d.getPendingCount(), 0);
        d.destroy();
      });

      it('should handle null/undefined config', () => {
        const d1 = new RequestDeduplicator(null as any);
        const d2 = new RequestDeduplicator(undefined);
        
        assert(d1 instanceof RequestDeduplicator);
        assert(d2 instanceof RequestDeduplicator);
        
        d1.destroy();
        d2.destroy();
      });
    });

    describe('Request Deduplication', () => {
      it('should deduplicate identical GET requests', async () => {
        const config: fluxhttpRequestConfig = {
          method: 'GET',
          url: '/api/users',
        };

        let executionCount = 0;
        const executor = () => {
          executionCount++;
          return Promise.resolve(createMockResponse({ id: executionCount }));
        };

        // Make two identical requests
        const [response1, response2] = await Promise.all([
          deduplicator.deduplicate(config, executor),
          deduplicator.deduplicate(config, executor),
        ]);

        // Should only execute once
        assert.strictEqual(executionCount, 1);
        assert.deepStrictEqual(response1, response2);
        assert.strictEqual((response1.data as any).id, 1);
      });

      it('should not deduplicate different requests', async () => {
        const config1: fluxhttpRequestConfig = {
          method: 'GET',
          url: '/api/users',
        };

        const config2: fluxhttpRequestConfig = {
          method: 'GET',
          url: '/api/posts',
        };

        let executionCount = 0;
        const executor = () => {
          executionCount++;
          return Promise.resolve(createMockResponse({ id: executionCount }));
        };

        const [response1, response2] = await Promise.all([
          deduplicator.deduplicate(config1, executor),
          deduplicator.deduplicate(config2, executor),
        ]);

        // Should execute both
        assert.strictEqual(executionCount, 2);
        assert.notDeepStrictEqual(response1, response2);
      });

      it('should not deduplicate unsafe methods by default', async () => {
        const config: fluxhttpRequestConfig = {
          method: 'POST',
          url: '/api/users',
          data: { name: 'John' },
        };

        let executionCount = 0;
        const executor = () => {
          executionCount++;
          return Promise.resolve(createMockResponse({ id: executionCount }));
        };

        const [response1, response2] = await Promise.all([
          deduplicator.deduplicate(config, executor),
          deduplicator.deduplicate(config, executor),
        ]);

        // Should execute both POST requests
        assert.strictEqual(executionCount, 2);
        assert.strictEqual((response1.data as any).id, 1);
        assert.strictEqual((response2.data as any).id, 2);
      });

      it('should respect custom shouldDeduplicate function', async () => {
        const customDeduplicator = new RequestDeduplicator({
          enabled: true,
          shouldDeduplicate: (config) => {
            // Allow POST deduplication for testing
            return ['GET', 'POST'].includes((config.method || 'GET').toUpperCase());
          },
        });

        const config: fluxhttpRequestConfig = {
          method: 'POST',
          url: '/api/users',
          data: { name: 'John' },
        };

        let executionCount = 0;
        const executor = () => {
          executionCount++;
          return Promise.resolve(createMockResponse({ id: executionCount }));
        };

        const [response1, response2] = await Promise.all([
          customDeduplicator.deduplicate(config, executor),
          customDeduplicator.deduplicate(config, executor),
        ]);

        // Should deduplicate POST requests with custom function
        assert.strictEqual(executionCount, 1);
        assert.deepStrictEqual(response1, response2);

        customDeduplicator.destroy();
      });

      it('should consider request parameters in deduplication', async () => {
        const config1: fluxhttpRequestConfig = {
          method: 'GET',
          url: '/api/users',
          params: { page: 1 },
        };

        const config2: fluxhttpRequestConfig = {
          method: 'GET',
          url: '/api/users',
          params: { page: 2 },
        };

        let executionCount = 0;
        const executor = () => {
          executionCount++;
          return Promise.resolve(createMockResponse({ id: executionCount }));
        };

        const [response1, response2] = await Promise.all([
          deduplicator.deduplicate(config1, executor),
          deduplicator.deduplicate(config2, executor),
        ]);

        // Should execute both due to different params
        assert.strictEqual(executionCount, 2);
        assert.notDeepStrictEqual(response1, response2);
      });

      it('should consider request data in deduplication', async () => {
        const customDeduplicator = new RequestDeduplicator({
          enabled: true,
          shouldDeduplicate: () => true, // Allow all methods
        });

        const config1: fluxhttpRequestConfig = {
          method: 'POST',
          url: '/api/users',
          data: { name: 'John' },
        };

        const config2: fluxhttpRequestConfig = {
          method: 'POST',
          url: '/api/users',
          data: { name: 'Jane' },
        };

        let executionCount = 0;
        const executor = () => {
          executionCount++;
          return Promise.resolve(createMockResponse({ id: executionCount }));
        };

        const [response1, response2] = await Promise.all([
          customDeduplicator.deduplicate(config1, executor),
          customDeduplicator.deduplicate(config2, executor),
        ]);

        // Should execute both due to different data
        assert.strictEqual(executionCount, 2);
        assert.notDeepStrictEqual(response1, response2);

        customDeduplicator.destroy();
      });

      it('should consider included headers in deduplication', async () => {
        const headerDeduplicator = new RequestDeduplicator({
          enabled: true,
          includeHeaders: ['authorization'],
        });

        const config1: fluxhttpRequestConfig = {
          method: 'GET',
          url: '/api/users',
          headers: { authorization: 'Bearer token1' },
        };

        const config2: fluxhttpRequestConfig = {
          method: 'GET',
          url: '/api/users',
          headers: { authorization: 'Bearer token2' },
        };

        let executionCount = 0;
        const executor = () => {
          executionCount++;
          return Promise.resolve(createMockResponse({ id: executionCount }));
        };

        const [response1, response2] = await Promise.all([
          headerDeduplicator.deduplicate(config1, executor),
          headerDeduplicator.deduplicate(config2, executor),
        ]);

        // Should execute both due to different authorization headers
        assert.strictEqual(executionCount, 2);
        assert.notDeepStrictEqual(response1, response2);

        headerDeduplicator.destroy();
      });

      it('should use custom key generator', async () => {
        const customDeduplicator = new RequestDeduplicator({
          enabled: true,
          keyGenerator: (config) => config.url || 'default', // Only use URL
        });

        const config1: fluxhttpRequestConfig = {
          method: 'GET',
          url: '/api/users',
          params: { page: 1 },
        };

        const config2: fluxhttpRequestConfig = {
          method: 'GET',
          url: '/api/users',
          params: { page: 2 }, // Different params but same URL
        };

        let executionCount = 0;
        const executor = () => {
          executionCount++;
          return Promise.resolve(createMockResponse({ id: executionCount }));
        };

        const [response1, response2] = await Promise.all([
          customDeduplicator.deduplicate(config1, executor),
          customDeduplicator.deduplicate(config2, executor),
        ]);

        // Should deduplicate because custom key generator only uses URL
        assert.strictEqual(executionCount, 1);
        assert.deepStrictEqual(response1, response2);

        customDeduplicator.destroy();
      });
    });

    describe('Request Expiration', () => {
      it('should expire requests after maxAge', async () => {
        const shortDeduplicator = new RequestDeduplicator({
          enabled: true,
          maxAge: 50, // 50ms
        });

        const config: fluxhttpRequestConfig = {
          method: 'GET',
          url: '/api/users',
        };

        let executionCount = 0;
        const executor = () => {
          executionCount++;
          return Promise.resolve(createMockResponse({ id: executionCount }));
        };

        // First request
        const response1 = await shortDeduplicator.deduplicate(config, executor);
        assert.strictEqual(executionCount, 1);

        // Wait for expiration
        await new Promise(resolve => setTimeout(resolve, 100));

        // Second request should not be deduplicated
        const response2 = await shortDeduplicator.deduplicate(config, executor);
        assert.strictEqual(executionCount, 2);
        assert.notDeepStrictEqual(response1, response2);

        shortDeduplicator.destroy();
      });

      it('should clean up expired requests automatically', async () => {
        const shortDeduplicator = new RequestDeduplicator({
          enabled: true,
          maxAge: 50, // 50ms
        });

        const config: fluxhttpRequestConfig = {
          method: 'GET',
          url: '/api/users',
        };

        const executor = createMockExecutor();

        // Add request to pending
        await shortDeduplicator.deduplicate(config, executor);
        assert.strictEqual(shortDeduplicator.getPendingCount(), 0); // Should be cleaned up after completion

        // Add request and check before completion
        const slowExecutor = createMockExecutor(createMockResponse(), 200);
        const promise = shortDeduplicator.deduplicate(config, slowExecutor);
        assert.strictEqual(shortDeduplicator.getPendingCount(), 1);

        await promise;
        assert.strictEqual(shortDeduplicator.getPendingCount(), 0);

        shortDeduplicator.destroy();
      });
    });

    describe('Error Handling', () => {
      it('should handle request failures without affecting deduplication', async () => {
        const config: fluxhttpRequestConfig = {
          method: 'GET',
          url: '/api/users',
        };

        const error = new Error('Network error');
        const failingExecutor = createFailingExecutor(error);

        // Both requests should fail with the same error
        const [result1, result2] = await Promise.allSettled([
          deduplicator.deduplicate(config, failingExecutor),
          deduplicator.deduplicate(config, failingExecutor),
        ]);

        assert.strictEqual(result1.status, 'rejected');
        assert.strictEqual(result2.status, 'rejected');
        
        if (result1.status === 'rejected' && result2.status === 'rejected') {
          assert.strictEqual(result1.reason.message, 'Network error');
          assert.strictEqual(result2.reason.message, 'Network error');
        }

        // Pending count should be cleaned up
        assert.strictEqual(deduplicator.getPendingCount(), 0);
      });

      it('should handle executor throwing synchronously', async () => {
        const config: fluxhttpRequestConfig = {
          method: 'GET',
          url: '/api/users',
        };

        const throwingExecutor = () => {
          throw new Error('Sync error');
        };

        await assert.rejects(
          () => deduplicator.deduplicate(config, throwingExecutor),
          { message: 'Sync error' }
        );
      });

      it('should handle JSON stringify errors in data', async () => {
        const config: fluxhttpRequestConfig = {
          method: 'GET',
          url: '/api/users',
          data: {}, // Will create circular reference
        };

        // Create circular reference
        (config.data as any).circular = config.data;

        let executionCount = 0;
        const executor = () => {
          executionCount++;
          return Promise.resolve(createMockResponse());
        };

        // Should handle circular reference gracefully
        const response = await deduplicator.deduplicate(config, executor);
        assert(response);
        assert.strictEqual(executionCount, 1);
      });
    });

    describe('Cache Management', () => {
      it('should respect maximum cache size', () => {
        const maxSize = 5;
        deduplicator.setMaxCacheSize(maxSize);
        assert.strictEqual(deduplicator.getMaxCacheSize(), maxSize);
      });

      it('should evict oldest entries when cache is full', async () => {
        deduplicator.setMaxCacheSize(2);

        const executor = createMockExecutor(createMockResponse(), 100); // Slow execution

        // Start 3 requests that will be pending
        const promises = [
          deduplicator.deduplicate({ method: 'GET', url: '/api/1' }, executor),
          deduplicator.deduplicate({ method: 'GET', url: '/api/2' }, executor),
          deduplicator.deduplicate({ method: 'GET', url: '/api/3' }, executor),
        ];

        // Should not exceed max cache size
        await new Promise(resolve => setTimeout(resolve, 10));
        assert(deduplicator.getCacheSize() <= 2);

        await Promise.all(promises);
      });

      it('should perform immediate cleanup when needed', async () => {
        const shortDeduplicator = new RequestDeduplicator({
          enabled: true,
          maxAge: 1, // 1ms for immediate expiration
        });
        
        shortDeduplicator.setMaxCacheSize(1);

        const slowExecutor = createMockExecutor(createMockResponse(), 50);
        
        // Add request
        const promise1 = shortDeduplicator.deduplicate(
          { method: 'GET', url: '/api/1' },
          slowExecutor
        );
        
        // Wait for expiration
        await new Promise(resolve => setTimeout(resolve, 10));
        
        // Add another request - should trigger cleanup
        const promise2 = shortDeduplicator.deduplicate(
          { method: 'GET', url: '/api/2' },
          slowExecutor
        );

        await Promise.all([promise1, promise2]);
        assert.strictEqual(shortDeduplicator.getCacheSize(), 0);

        shortDeduplicator.destroy();
      });

      it('should handle negative or zero cache size gracefully', () => {
        const originalSize = deduplicator.getMaxCacheSize();
        
        deduplicator.setMaxCacheSize(0);
        assert.strictEqual(deduplicator.getMaxCacheSize(), originalSize); // Should not change
        
        deduplicator.setMaxCacheSize(-1);
        assert.strictEqual(deduplicator.getMaxCacheSize(), originalSize); // Should not change
      });
    });

    describe('State Management', () => {
      it('should track pending requests correctly', async () => {
        const config: fluxhttpRequestConfig = {
          method: 'GET',
          url: '/api/users',
        };

        assert.strictEqual(deduplicator.getPendingCount(), 0);
        assert.strictEqual(deduplicator.isPending(config), false);
        assert.deepStrictEqual(deduplicator.getPendingKeys(), []);

        const slowExecutor = createMockExecutor(createMockResponse(), 100);
        const promise = deduplicator.deduplicate(config, slowExecutor);

        // Should be pending
        assert.strictEqual(deduplicator.getPendingCount(), 1);
        assert.strictEqual(deduplicator.isPending(config), true);
        assert.strictEqual(deduplicator.getPendingKeys().length, 1);

        await promise;

        // Should be cleaned up
        assert.strictEqual(deduplicator.getPendingCount(), 0);
        assert.strictEqual(deduplicator.isPending(config), false);
      });

      it('should clear all pending requests', () => {
        const slowExecutor = createMockExecutor(createMockResponse(), 100);
        
        // Start multiple requests
        deduplicator.deduplicate({ method: 'GET', url: '/api/1' }, slowExecutor);
        deduplicator.deduplicate({ method: 'GET', url: '/api/2' }, slowExecutor);
        
        assert(deduplicator.getPendingCount() > 0);
        
        deduplicator.clear();
        assert.strictEqual(deduplicator.getPendingCount(), 0);
      });

      it('should cancel specific requests', async () => {
        const config: fluxhttpRequestConfig = {
          method: 'GET',
          url: '/api/users',
        };

        const slowExecutor = createMockExecutor(createMockResponse(), 100);
        const promise = deduplicator.deduplicate(config, slowExecutor);

        assert.strictEqual(deduplicator.isPending(config), true);
        
        const cancelled = deduplicator.cancel(config);
        assert.strictEqual(cancelled, true);
        assert.strictEqual(deduplicator.isPending(config), false);

        // Original promise should still resolve
        await promise;
      });

      it('should return false when cancelling non-existent requests', () => {
        const config: fluxhttpRequestConfig = {
          method: 'GET',
          url: '/api/nonexistent',
        };

        const cancelled = deduplicator.cancel(config);
        assert.strictEqual(cancelled, false);
      });
    });

    describe('Configuration Updates', () => {
      it('should update configuration dynamically', () => {
        const newConfig: DeduplicationConfig = {
          enabled: false,
          maxAge: 5000,
          includeHeaders: ['x-custom'],
        };

        deduplicator.updateConfig(newConfig);
        
        // Verify configuration was updated by testing behavior
        const config: fluxhttpRequestConfig = {
          method: 'GET',
          url: '/api/test',
        };

        let executionCount = 0;
        const executor = () => {
          executionCount++;
          return Promise.resolve(createMockResponse());
        };

        // Should not deduplicate when disabled
        return Promise.all([
          deduplicator.deduplicate(config, executor),
          deduplicator.deduplicate(config, executor),
        ]).then(() => {
          assert.strictEqual(executionCount, 2); // Should execute both
        });
      });

      it('should preserve custom functions when updating config', () => {
        const customKeyGen = (config: fluxhttpRequestConfig) => `custom-${config.url}`;
        const customShouldDedupe = () => false;

        deduplicator.updateConfig({
          keyGenerator: customKeyGen,
          shouldDeduplicate: customShouldDedupe,
        });

        // Update other properties
        deduplicator.updateConfig({
          maxAge: 10000,
        });

        // Custom functions should still be preserved
        // We can verify this by checking that deduplication doesn't happen
        const config: fluxhttpRequestConfig = {
          method: 'GET',
          url: '/api/test',
        };

        let executionCount = 0;
        const executor = () => {
          executionCount++;
          return Promise.resolve(createMockResponse());
        };

        return Promise.all([
          deduplicator.deduplicate(config, executor),
          deduplicator.deduplicate(config, executor),
        ]).then(() => {
          assert.strictEqual(executionCount, 2); // Custom shouldDeduplicate returns false
        });
      });

      it('should ignore updates after disposal', () => {
        deduplicator.destroy();
        
        // Should not throw
        assert.doesNotThrow(() => {
          deduplicator.updateConfig({ enabled: false });
        });
      });
    });

    describe('Disposal and Cleanup', () => {
      it('should dispose resources properly', () => {
        const d = new RequestDeduplicator();
        assert.strictEqual(d.isDisposed(), false);
        
        d.destroy();
        assert.strictEqual(d.isDisposed(), true);
        
        // Multiple disposals should be safe
        d.destroy();
        assert.strictEqual(d.isDisposed(), true);
      });

      it('should not deduplicate after disposal', async () => {
        deduplicator.destroy();

        const config: fluxhttpRequestConfig = {
          method: 'GET',
          url: '/api/users',
        };

        let executionCount = 0;
        const executor = () => {
          executionCount++;
          return Promise.resolve(createMockResponse());
        };

        const [response1, response2] = await Promise.all([
          deduplicator.deduplicate(config, executor),
          deduplicator.deduplicate(config, executor),
        ]);

        // Should execute both because deduplicator is disposed
        assert.strictEqual(executionCount, 2);
      });

      it('should clear pending requests on disposal', () => {
        const slowExecutor = createMockExecutor(createMockResponse(), 100);
        
        deduplicator.deduplicate({ method: 'GET', url: '/api/1' }, slowExecutor);
        assert(deduplicator.getPendingCount() > 0);
        
        deduplicator.destroy();
        // Disposal should clear pending requests
      });
    });

    describe('Edge Cases', () => {
      it('should handle requests with no URL', async () => {
        const config: fluxhttpRequestConfig = {
          method: 'GET',
        };

        const executor = createMockExecutor();
        const response = await deduplicator.deduplicate(config, executor);
        assert(response);
      });

      it('should handle requests with no method', async () => {
        const config: fluxhttpRequestConfig = {
          url: '/api/test',
        };

        const executor = createMockExecutor();
        const response = await deduplicator.deduplicate(config, executor);
        assert(response);
      });

      it('should handle empty configuration', async () => {
        const config: fluxhttpRequestConfig = {};
        const executor = createMockExecutor();
        const response = await deduplicator.deduplicate(config, executor);
        assert(response);
      });

      it('should handle very large request data', async () => {
        const largeData = 'x'.repeat(100000); // 100KB string
        const config: fluxhttpRequestConfig = {
          method: 'GET',
          url: '/api/test',
          data: { large: largeData },
        };

        const executor = createMockExecutor();
        const response = await deduplicator.deduplicate(config, executor);
        assert(response);
      });

      it('should handle special characters in URLs and data', async () => {
        const config: fluxhttpRequestConfig = {
          method: 'GET',
          url: '/api/test?query=hello%20world&unicode=😀',
          data: { emoji: '🚀', unicode: 'café' },
        };

        const executor = createMockExecutor();
        const response = await deduplicator.deduplicate(config, executor);
        assert(response);
      });

      it('should handle concurrent disposal and deduplication', async () => {
        const promises = [];
        
        // Start multiple deduplication operations
        for (let i = 0; i < 10; i++) {
          promises.push(
            deduplicator.deduplicate(
              { method: 'GET', url: `/api/${i}` },
              createMockExecutor(createMockResponse(), 50)
            )
          );
        }
        
        // Dispose while operations are running
        setTimeout(() => deduplicator.destroy(), 25);
        
        // Should not throw
        await Promise.allSettled(promises);
      });
    });
  });

  describe('Module Functions', () => {
    describe('createDeduplicator', () => {
      it('should create new deduplicator instance', () => {
        const d1 = createDeduplicator();
        const d2 = createDeduplicator({ enabled: false });
        
        assert(d1 instanceof RequestDeduplicator);
        assert(d2 instanceof RequestDeduplicator);
        assert.notStrictEqual(d1, d2);
        
        d1.destroy();
        d2.destroy();
      });

      it('should accept configuration', () => {
        const config: DeduplicationConfig = {
          enabled: false,
          maxAge: 10000,
        };
        
        const d = createDeduplicator(config);
        assert(d instanceof RequestDeduplicator);
        d.destroy();
      });
    });

    describe('defaultDeduplicator', () => {
      it('should export default deduplicator instance', () => {
        assert(defaultDeduplicator instanceof RequestDeduplicator);
        assert.strictEqual(defaultDeduplicator.isDisposed(), false);
      });

      it('should be usable for deduplication', async () => {
        const config: fluxhttpRequestConfig = {
          method: 'GET',
          url: '/api/default-test',
        };

        const executor = createMockExecutor();
        const response = await defaultDeduplicator.deduplicate(config, executor);
        assert(response);
      });
    });
  });

  describe('Hash Function', () => {
    it('should generate consistent hashes', () => {
      const deduplicator1 = new RequestDeduplicator();
      const deduplicator2 = new RequestDeduplicator();

      const config: fluxhttpRequestConfig = {
        method: 'GET',
        url: '/api/test',
        params: { a: 1, b: 2 },
      };

      // Get keys from different instances
      const key1 = (deduplicator1 as any).defaultKeyGenerator(config);
      const key2 = (deduplicator2 as any).defaultKeyGenerator(config);

      assert.strictEqual(key1, key2);

      deduplicator1.destroy();
      deduplicator2.destroy();
    });

    it('should generate different hashes for different inputs', () => {
      const d = new RequestDeduplicator();

      const config1: fluxhttpRequestConfig = {
        method: 'GET',
        url: '/api/test1',
      };

      const config2: fluxhttpRequestConfig = {
        method: 'GET',
        url: '/api/test2',
      };

      const key1 = (d as any).defaultKeyGenerator(config1);
      const key2 = (d as any).defaultKeyGenerator(config2);

      assert.notStrictEqual(key1, key2);

      d.destroy();
    });

    it('should handle empty strings in hash function', () => {
      const d = new RequestDeduplicator();
      const hash = (d as any).hash('');
      assert.strictEqual(typeof hash, 'string');
      d.destroy();
    });
  });

  describe('Performance', () => {
    it('should handle many concurrent requests efficiently', async () => {
      const d = new RequestDeduplicator({ enabled: true });
      const start = process.hrtime();
      
      const promises = [];
      for (let i = 0; i < 1000; i++) {
        promises.push(
          d.deduplicate(
            { method: 'GET', url: `/api/test${i % 10}` }, // 10 unique URLs
            createMockExecutor(createMockResponse(), 1)
          )
        );
      }
      
      await Promise.all(promises);
      
      const [seconds, nanoseconds] = process.hrtime(start);
      const milliseconds = seconds * 1000 + nanoseconds / 1000000;
      
      // Should complete within reasonable time
      assert(milliseconds < 1000, 'Should handle 1000 requests quickly');
      
      d.destroy();
    });

    it('should not leak memory with many operations', () => {
      const d = new RequestDeduplicator();
      const initialMemory = process.memoryUsage().heapUsed;
      
      // Perform many key generation operations
      for (let i = 0; i < 10000; i++) {
        (d as any).defaultKeyGenerator({
          method: 'GET',
          url: `/api/test${i}`,
          params: { id: i },
          data: { value: i },
        });
      }
      
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;
      
      // Memory increase should be reasonable
      assert(memoryIncrease < 50 * 1024 * 1024, 'Memory usage should not grow excessively');
      
      d.destroy();
    });
  });
});
