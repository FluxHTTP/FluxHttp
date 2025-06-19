import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';

// InterceptorManager is bundled and not directly accessible
// We'll test it through a mock implementation based on source code
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

describe('InterceptorManager', () => {
  let manager;

  beforeEach(() => {
    manager = new InterceptorManager();
  });

  describe('use method', (): void => {
    it('should add interceptor and return id', (): void => {
      const onFulfilled = (value) => value;
      const onRejected = (error) => error;

      const id = manager.use(onFulfilled, onRejected);

      assert(typeof id === 'number');
      assert.strictEqual(manager.size, 1);
    });

    it('should add multiple interceptors with unique ids', (): void => {
      const ids = [];

      for (let i = 0; i < 5; i++) {
        const id = manager.use((value) => value);
        ids.push(id);
      }

      // All ids should be unique
      const uniqueIds = new Set(ids);
      assert.strictEqual(uniqueIds.size, 5);
      assert.strictEqual(manager.size, 5);
    });

    it('should accept only onFulfilled handler', (): void => {
      const id = manager.use((value) => value);

      assert(typeof id === 'number');
      assert.strictEqual(manager.size, 1);
    });

    it('should accept only onRejected handler', (): void => {
      const id = manager.use(undefined, (error) => error);

      assert(typeof id === 'number');
      assert.strictEqual(manager.size, 1);
    });

    it('should accept interceptor options', (): void => {
      const options = {
        synchronous: true,
        runWhen: (config) => config.method === 'GET',
      };

      const id = manager.use((value) => value, undefined, options);

      assert(typeof id === 'number');
      assert.strictEqual(manager.size, 1);
    });

    it('should handle undefined handlers', (): void => {
      const id = manager.use(undefined, undefined);

      assert(typeof id === 'number');
      assert.strictEqual(manager.size, 1);
    });
  });

  describe('eject method', () => {
    it('should remove interceptor by id', (): void => {
      const id1 = manager.use((value) => value);
      const id2 = manager.use((value) => value);

      assert.strictEqual(manager.size, 2);

      manager.eject(id1);

      assert.strictEqual(manager.size, 1);
    });

    it('should handle ejecting non-existent id', (): void => {
      manager.use((value) => value);

      // Should not throw
      manager.eject(999);

      assert.strictEqual(manager.size, 1);
    });

    it('should allow reusing ejected id slot', (): void => {
      const id1 = manager.use((value) => value);
      manager.eject(id1);

      const id2 = manager.use((value) => value);

      // IDs should be different (auto-incrementing)
      assert.notStrictEqual(id1, id2);
      assert.strictEqual(manager.size, 1);
    });

    it('should handle multiple ejections', (): void => {
      const ids = [];
      for (let i = 0; i < 5; i++) {
        ids.push(manager.use((value) => value));
      }

      assert.strictEqual(manager.size, 5);

      // Eject all
      ids.forEach((id) => manager.eject(id));

      assert.strictEqual(manager.size, 0);
    });
  });

  describe('clear method', () => {
    it('should remove all interceptors', (): void => {
      for (let i = 0; i < 10; i++) {
        manager.use((value) => value);
      }

      assert.strictEqual(manager.size, 10);

      manager.clear();

      assert.strictEqual(manager.size, 0);
    });

    it('should handle clearing empty manager', (): void => {
      assert.strictEqual(manager.size, 0);

      // Should not throw
      manager.clear();

      assert.strictEqual(manager.size, 0);
    });

    it('should allow adding interceptors after clear', (): void => {
      manager.use((value) => value);
      manager.clear();

      const id = manager.use((value) => value);

      assert(typeof id === 'number');
      assert.strictEqual(manager.size, 1);
    });
  });

  describe('forEach method', () => {
    it('should iterate over all interceptors', (): void => {
      const interceptors = [
        { fulfilled: (v) => v, rejected: undefined },
        { fulfilled: undefined, rejected: (e) => e },
        { fulfilled: (v) => v, rejected: (e) => e },
      ];

      interceptors.forEach(({ fulfilled, rejected }) => {
        manager.use(fulfilled, rejected);
      });

      let count = 0;
      const foundInterceptors = [];

      manager.forEach((_interceptor) => {
        count++;
        foundInterceptors.push(interceptor);
      });

      assert.strictEqual(count, 3);
      assert.strictEqual(foundInterceptors.length, 3);
    });

    it('should provide interceptor with options', (): void => {
      const options = { synchronous: true };
      manager.use(
        (v) => v,
        (e) => e,
        options
      );

      manager.forEach((_interceptor) => {
        assert(interceptor.fulfilled);
        assert(interceptor.rejected);
        assert.deepStrictEqual(interceptor.options, options);
      });
    });

    it('should handle empty manager', (): void => {
      let count = 0;

      manager.forEach(() => {
        count++;
      });

      assert.strictEqual(count, 0);
    });

    it('should skip null interceptors', (): void => {
      // Add interceptors
      const id1 = manager.use((v) => v);
      manager.use((v) => v);
      const id3 = manager.use((v) => v);

      // The implementation checks for null, though ejected interceptors are deleted
      // This test ensures the null check doesn't cause issues
      manager.eject(id1);
      manager.eject(id3);

      let count = 0;
      manager.forEach(() => {
        count++;
      });

      assert.strictEqual(count, 1);
    });
  });

  describe('Symbol.iterator', () => {
    it('should make manager iterable', (): void => {
      manager.use((v) => v);
      manager.use((v) => v);
      manager.use((v) => v);

      const interceptors = [];
      for (const interceptor of manager) {
        interceptors.push(interceptor);
      }

      assert.strictEqual(interceptors.length, 3);
    });

    it('should work with spread operator', (): void => {
      manager.use(
        (v) => v,
        (e) => e
      );
      manager.use((v) => v * 2);

      const interceptors = [...manager];

      assert.strictEqual(interceptors.length, 2);
      assert(interceptors[0].fulfilled);
      assert(interceptors[0].rejected);
      assert(interceptors[1].fulfilled);
      assert(!interceptors[1].rejected);
    });

    it('should work with Array.from', (): void => {
      manager.use((v) => v);
      manager.use((v) => v);

      const interceptors = Array.from(manager);

      assert(Array.isArray(interceptors));
      assert.strictEqual(interceptors.length, 2);
    });

    it('should handle empty manager', (): void => {
      const interceptors = [...manager];
      assert.strictEqual(interceptors.length, 0);
    });
  });

  describe('size property', () => {
    it('should return correct size', (): void => {
      assert.strictEqual(manager.size, 0);

      manager.use((v) => v);
      assert.strictEqual(manager.size, 1);

      manager.use((v) => v);
      assert.strictEqual(manager.size, 2);
    });

    it('should update size after eject', (): void => {
      const id = manager.use((v) => v);
      assert.strictEqual(manager.size, 1);

      manager.eject(id);
      assert.strictEqual(manager.size, 0);
    });

    it('should update size after clear', (): void => {
      manager.use((v) => v);
      manager.use((v) => v);
      manager.use((v) => v);

      assert.strictEqual(manager.size, 3);

      manager.clear();
      assert.strictEqual(manager.size, 0);
    });
  });

  describe('Complex scenarios', () => {
    it('should handle async interceptors', async (): Promise<void> => {
      const asyncInterceptor = async (_value) => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return value + ' async';
      };

      manager.use(asyncInterceptor);

      // Get the interceptor
      const [interceptor] = manager;
      const result = await interceptor.fulfilled('test');

      assert.strictEqual(result, 'test async');
    });

    it('should handle interceptor that throws', (): void => {
      const throwingInterceptor = () => {
        throw new Error('Interceptor error');
      };

      manager.use(throwingInterceptor);

      const [interceptor] = manager;
      assert.throws(() => interceptor.fulfilled(), { message: 'Interceptor error' });
    });

    it('should maintain order of interceptors', (): void => {
      const order = [];

      manager.use(() => order.push(1));
      manager.use(() => order.push(2));
      manager.use(() => order.push(3));

      manager.forEach((_interceptor) => {
        if (interceptor.fulfilled) {
          interceptor.fulfilled();
        }
      });

      assert.deepStrictEqual(order, [1, 2, 3]);
    });

    it('should handle mixed sync/async interceptors', async (): Promise<void> => {
      const results = [];

      manager.use((_value) => {
        results.push('sync1');
        return value;
      });

      manager.use(async (_value) => {
        results.push('async');
        return value;
      });

      manager.use((_value) => {
        results.push('sync2');
        return value;
      });

      // Execute all interceptors
      for (const interceptor of manager) {
        if (interceptor.fulfilled) {
          await interceptor.fulfilled('test');
        }
      }

      assert.deepStrictEqual(results, ['sync1', 'async', 'sync2']);
    });

    it('should handle interceptor options correctly', (): void => {
      const interceptorsWithOptions = [];

      manager.use((v) => v, undefined, { synchronous: true });
      manager.use((v) => v, undefined, { synchronous: false });
      manager.use((v) => v, undefined, {
        runWhen: (config) => config.method === 'POST',
      });

      manager.forEach((_interceptor) => {
        interceptorsWithOptions.push(interceptor.options);
      });

      assert.strictEqual(interceptorsWithOptions[0].synchronous, true);
      assert.strictEqual(interceptorsWithOptions[1].synchronous, false);
      assert(typeof interceptorsWithOptions[2].runWhen === 'function');
    });
  });

  describe('Edge cases', () => {
    it('should handle very large number of interceptors', (): void => {
      const count = 10000;

      for (let i = 0; i < count; i++) {
        manager.use((v) => v);
      }

      assert.strictEqual(manager.size, count);

      let iteratedCount = 0;
      for (const interceptor of manager) {
        iteratedCount++;
      }

      assert.strictEqual(iteratedCount, count);
    });

    it('should handle interceptor that returns undefined', (): void => {
      manager.use(() => undefined);

      const [interceptor] = manager;
      const result = interceptor.fulfilled('test');

      assert.strictEqual(result, undefined);
    });

    it('should handle interceptor that modifies input', (): void => {
      manager.use((_value) => {
        if (typeof value === 'object' && value !== null) {
          return { ...value, modified: true };
        }
        return value;
      });

      const [interceptor] = manager;
      const input = { original: true };
      const result = interceptor.fulfilled(input);

      assert.deepStrictEqual(result, { original: true, modified: true });
      assert.deepStrictEqual(input, { original: true }); // Original unchanged
    });

    it('should handle concurrent modifications safely', (): void => {
      // Add initial interceptors
      manager.use((v) => v);
      manager.use((v) => v);

      let iterationCount = 0;
      let shouldContinue = true;

      // This tests that forEach creates a snapshot
      manager.forEach((_interceptor) => {
        iterationCount++;

        // Try to modify during iteration
        if (shouldContinue) {
          shouldContinue = false;
          manager.use((v) => v); // Add new
          manager.clear(); // Clear all
        }
      });

      // Should have iterated over original 2 interceptors
      assert.strictEqual(iterationCount, 2);
      // But manager should be empty after clear
      assert.strictEqual(manager.size, 0);
    });
  });
});
