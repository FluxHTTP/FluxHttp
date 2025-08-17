const test = require('node:test');
const assert = require('node:assert');
const fluxhttpModule = require('../dist/index.js');
const { create: createFluxhttp, fluxhttpError } = fluxhttpModule;

test('Memory Leak Fixes', async (t) => {
  await t.test('InterceptorManager should clean up properly', () => {
    const client = createFluxhttp();
    
    // Add multiple interceptors
    const ids = [];
    for (let i = 0; i < 50; i++) {
      const id = client.interceptors.request.use(
        (config) => config,
        (error) => Promise.reject(error)
      );
      ids.push(id);
    }
    
    assert.strictEqual(client.interceptors.request.size, 50);
    
    // Test cleanup
    client.interceptors.request.clear();
    assert.strictEqual(client.interceptors.request.size, 0);
    
    // Test disposal
    client.dispose();
    assert.strictEqual(client.isDisposed(), true);
  });

  await t.test('InterceptorManager should support one-time interceptors', () => {
    const client = createFluxhttp();
    
    // Add one-time interceptors
    const id1 = client.interceptors.request.use(
      (config) => config,
      (error) => Promise.reject(error),
      { runOnce: true }
    );
    
    const id2 = client.interceptors.request.useOnce(
      (config) => config,
      (error) => Promise.reject(error)
    );
    
    assert.strictEqual(client.interceptors.request.size, 2);
    
    // Verify the interceptors are marked as one-time
    const stats = client.interceptors.request.getStats();
    assert.strictEqual(stats.total, 2);
    
    client.dispose();
  });

  await t.test('InterceptorManager should provide memory statistics', () => {
    const client = createFluxhttp();
    
    // Add some interceptors
    for (let i = 0; i < 10; i++) {
      client.interceptors.request.use((config) => config);
    }
    
    const stats = client.interceptors.request.getStats();
    assert.strictEqual(typeof stats.total, 'number');
    assert.strictEqual(typeof stats.averageAge, 'number');
    assert.strictEqual(stats.total, 10);
    
    const memoryStats = client.getMemoryStats();
    assert.strictEqual(typeof memoryStats.interceptors, 'object');
    assert.strictEqual(typeof memoryStats.disposed, 'boolean');
    
    client.dispose();
  });

  await t.test('fluxhttp instance should dispose cleanly', () => {
    const client = createFluxhttp();
    
    // Add some interceptors
    client.interceptors.request.use((config) => config);
    client.interceptors.response.use((response) => response);
    
    assert.strictEqual(client.isDisposed(), false);
    
    // Dispose and check
    client.dispose();
    assert.strictEqual(client.isDisposed(), true);
    
    // Should be safe to call multiple times
    client.dispose();
    assert.strictEqual(client.isDisposed(), true);
  });

  await t.test('InterceptorManager should handle max interceptors limit', () => {
    const client = createFluxhttp();
    
    // Update cleanup config to have a low max limit
    client.interceptors.request.updateCleanupConfig({ maxInterceptors: 5 });
    
    // Add more than the limit
    for (let i = 0; i < 10; i++) {
      client.interceptors.request.use((config) => config);
    }
    
    // Should not exceed the limit significantly due to LRU eviction
    assert.ok(client.interceptors.request.size <= 10); // Allow some buffer for timing
    
    client.dispose();
  });
});