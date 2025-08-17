import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import {
  CacheManager,
  MemoryCacheStorage,
  LocalStorageCacheStorage,
  SessionStorageCacheStorage,
  CacheApiStorage,
  createCacheConfig,
  defaultCacheManager,
  type CacheEntry,
  type CacheStorage,
} from '../../../src/core/cache.js';
import type { fluxhttpRequestConfig, fluxhttpResponse } from '../../../src/types/index.js';

// Mock global storage APIs
class MockStorage {
  private storage = new Map<string, string>();

  getItem(key: string): string | null {
    return this.storage.get(key) || null;
  }

  setItem(key: string, value: string): void {
    this.storage.set(key, value);
  }

  removeItem(key: string): void {
    this.storage.delete(key);
  }

  clear(): void {
    this.storage.clear();
  }

  key(index: number): string | null {
    const keys = Array.from(this.storage.keys());
    return keys[index] || null;
  }

  get length(): number {
    return this.storage.size;
  }
}

// Mock caches API
class MockCacheStorage {
  private data = new Map<string, Response>();

  async match(request: string): Promise<Response | undefined> {
    return this.data.get(request);
  }

  async put(request: string, response: Response): Promise<void> {
    this.data.set(request, response);
  }

  async delete(request: string): Promise<boolean> {
    return this.data.delete(request);
  }

  async keys(): Promise<string[]> {
    return Array.from(this.data.keys());
  }
}

class MockCaches {
  private caches = new Map<string, MockCacheStorage>();

  async open(cacheName: string): Promise<MockCacheStorage> {
    if (!this.caches.has(cacheName)) {
      this.caches.set(cacheName, new MockCacheStorage());
    }
    return this.caches.get(cacheName)!;
  }

  async delete(cacheName: string): Promise<boolean> {
    return this.caches.delete(cacheName);
  }
}

describe('Cache System', () => {
  let originalLocalStorage: any;
  let originalSessionStorage: any;
  let originalCaches: any;
  let mockLocalStorage: MockStorage;
  let mockSessionStorage: MockStorage;
  let mockCaches: MockCaches;

  beforeEach(() => {
    // Mock storage APIs
    mockLocalStorage = new MockStorage();
    mockSessionStorage = new MockStorage();
    mockCaches = new MockCaches();

    originalLocalStorage = global.localStorage;
    originalSessionStorage = global.sessionStorage;
    originalCaches = global.caches;

    (global as any).localStorage = mockLocalStorage;
    (global as any).sessionStorage = mockSessionStorage;
    (global as any).caches = mockCaches;
    (global as any).Response = class MockResponse {
      constructor(public body: any, public init?: any) {}
      async json() {
        return JSON.parse(this.body);
      }
    };
  });

  afterEach(() => {
    global.localStorage = originalLocalStorage;
    global.sessionStorage = originalSessionStorage;
    global.caches = originalCaches;
    delete (global as any).Response;
  });

  describe('MemoryCacheStorage', () => {
    let storage: MemoryCacheStorage;

    beforeEach(() => {
      storage = new MemoryCacheStorage(100); // Fast cleanup for testing
    });

    afterEach(() => {
      storage.dispose();
    });

    it('should store and retrieve cache entries', async () => {
      const entry: CacheEntry = {
        data: {
          data: { test: 'value' },
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {},
        },
        timestamp: Date.now(),
        ttl: 60000,
        key: 'test-key',
      };

      await storage.set('test-key', entry);
      const retrieved = await storage.get('test-key');

      assert.deepStrictEqual(retrieved, entry);
    });

    it('should return null for non-existent keys', async () => {
      const result = await storage.get('non-existent');
      assert.strictEqual(result, null);
    });

    it('should expire entries after TTL', async () => {
      const entry: CacheEntry = {
        data: {
          data: { test: 'value' },
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {},
        },
        timestamp: Date.now() - 61000, // 61 seconds ago
        ttl: 60000, // 60 second TTL
        key: 'expired-key',
      };

      await storage.set('expired-key', entry);
      const result = await storage.get('expired-key');

      assert.strictEqual(result, null);
    });

    it('should delete entries', async () => {
      const entry: CacheEntry = {
        data: {
          data: { test: 'value' },
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {},
        },
        timestamp: Date.now(),
        ttl: 60000,
        key: 'delete-key',
      };

      await storage.set('delete-key', entry);
      assert(await storage.has('delete-key'));

      await storage.delete('delete-key');
      assert.strictEqual(await storage.has('delete-key'), false);
    });

    it('should clear all entries', async () => {
      const entry: CacheEntry = {
        data: {
          data: { test: 'value' },
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {},
        },
        timestamp: Date.now(),
        ttl: 60000,
        key: 'clear-key',
      };

      await storage.set('clear-key', entry);
      assert(await storage.has('clear-key'));

      await storage.clear();
      assert.strictEqual(await storage.has('clear-key'), false);
    });

    it('should clean up expired entries automatically', async () => {
      const entry: CacheEntry = {
        data: {
          data: { test: 'value' },
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {},
        },
        timestamp: Date.now() - 61000, // 61 seconds ago
        ttl: 60000, // 60 second TTL
        key: 'cleanup-key',
      };

      await storage.set('cleanup-key', entry);
      
      // Trigger cleanup manually for testing
      (storage as any).cleanupExpired();
      
      assert.strictEqual(await storage.has('cleanup-key'), false);
    });

    it('should dispose resources properly', () => {
      storage.dispose();
      // Should not throw after disposal
      storage.dispose();
    });
  });

  describe('LocalStorageCacheStorage', () => {
    let storage: LocalStorageCacheStorage;

    beforeEach(() => {
      storage = new LocalStorageCacheStorage('test_');
      mockLocalStorage.clear();
    });

    it('should store and retrieve cache entries', async () => {
      const entry: CacheEntry = {
        data: {
          data: { test: 'value' },
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {},
        },
        timestamp: Date.now(),
        ttl: 60000,
        key: 'test-key',
      };

      await storage.set('test-key', entry);
      const retrieved = await storage.get('test-key');

      assert.deepStrictEqual(retrieved, entry);
    });

    it('should return null when localStorage is unavailable', async () => {
      const originalLocalStorage = global.localStorage;
      delete (global as any).localStorage;

      const result = await storage.get('test-key');
      assert.strictEqual(result, null);

      await storage.set('test-key', {} as CacheEntry);
      await storage.delete('test-key');
      await storage.clear();

      global.localStorage = originalLocalStorage;
    });

    it('should handle JSON parse errors', async () => {
      mockLocalStorage.setItem('test_broken-key', 'invalid-json');
      const result = await storage.get('broken-key');
      assert.strictEqual(result, null);
    });

    it('should handle storage quota exceeded', async () => {
      const originalSetItem = mockLocalStorage.setItem;
      mockLocalStorage.setItem = () => {
        throw new Error('Quota exceeded');
      };

      const entry: CacheEntry = {
        data: {
          data: { test: 'value' },
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {},
        },
        timestamp: Date.now(),
        ttl: 60000,
        key: 'quota-key',
      };

      // Should not throw
      await storage.set('quota-key', entry);

      mockLocalStorage.setItem = originalSetItem;
    });

    it('should expire entries after TTL', async () => {
      const entry: CacheEntry = {
        data: {
          data: { test: 'value' },
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {},
        },
        timestamp: Date.now() - 61000, // 61 seconds ago
        ttl: 60000, // 60 second TTL
        key: 'expired-key',
      };

      await storage.set('expired-key', entry);
      const result = await storage.get('expired-key');

      assert.strictEqual(result, null);
    });

    it('should clear entries with prefix only', async () => {
      const entry: CacheEntry = {
        data: {
          data: { test: 'value' },
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {},
        },
        timestamp: Date.now(),
        ttl: 60000,
        key: 'clear-key',
      };

      // Add entry with prefix
      await storage.set('clear-key', entry);
      
      // Add entry without prefix (should not be cleared)
      mockLocalStorage.setItem('other-key', 'value');

      await storage.clear();

      assert.strictEqual(await storage.has('clear-key'), false);
      assert.strictEqual(mockLocalStorage.getItem('other-key'), 'value');
    });
  });

  describe('SessionStorageCacheStorage', () => {
    let storage: SessionStorageCacheStorage;

    beforeEach(() => {
      storage = new SessionStorageCacheStorage('session_');
      mockSessionStorage.clear();
    });

    it('should store and retrieve cache entries', async () => {
      const entry: CacheEntry = {
        data: {
          data: { test: 'value' },
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {},
        },
        timestamp: Date.now(),
        ttl: 60000,
        key: 'test-key',
      };

      await storage.set('test-key', entry);
      const retrieved = await storage.get('test-key');

      assert.deepStrictEqual(retrieved, entry);
    });

    it('should return null when sessionStorage is unavailable', async () => {
      const originalSessionStorage = global.sessionStorage;
      delete (global as any).sessionStorage;

      const result = await storage.get('test-key');
      assert.strictEqual(result, null);

      await storage.set('test-key', {} as CacheEntry);
      await storage.delete('test-key');
      await storage.clear();

      global.sessionStorage = originalSessionStorage;
    });

    it('should handle JSON parse errors', async () => {
      mockSessionStorage.setItem('session_broken-key', 'invalid-json');
      const result = await storage.get('broken-key');
      assert.strictEqual(result, null);
    });

    it('should handle storage quota exceeded', async () => {
      const originalSetItem = mockSessionStorage.setItem;
      mockSessionStorage.setItem = () => {
        throw new Error('Quota exceeded');
      };

      const entry: CacheEntry = {
        data: {
          data: { test: 'value' },
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {},
        },
        timestamp: Date.now(),
        ttl: 60000,
        key: 'quota-key',
      };

      // Should not throw
      await storage.set('quota-key', entry);

      mockSessionStorage.setItem = originalSetItem;
    });
  });

  describe('CacheApiStorage', () => {
    let storage: CacheApiStorage;

    beforeEach(() => {
      storage = new CacheApiStorage('test-cache');
    });

    it('should store and retrieve cache entries', async () => {
      const entry: CacheEntry = {
        data: {
          data: { test: 'value' },
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {},
        },
        timestamp: Date.now(),
        ttl: 60000,
        key: 'test-key',
      };

      await storage.set('test-key', entry);
      const retrieved = await storage.get('test-key');

      assert.deepStrictEqual(retrieved, entry);
    });

    it('should return null when Cache API is unavailable', async () => {
      const originalCaches = global.caches;
      delete (global as any).caches;

      const result = await storage.get('test-key');
      assert.strictEqual(result, null);

      await storage.set('test-key', {} as CacheEntry);
      await storage.delete('test-key');
      await storage.clear();
      assert.strictEqual(await storage.has('test-key'), false);

      global.caches = originalCaches;
    });

    it('should handle expired entries', async () => {
      const entry: CacheEntry = {
        data: {
          data: { test: 'value' },
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {},
        },
        timestamp: Date.now() - 61000, // 61 seconds ago
        ttl: 60000, // 60 second TTL
        key: 'expired-key',
      };

      await storage.set('expired-key', entry);
      const result = await storage.get('expired-key');

      assert.strictEqual(result, null);
    });

    it('should handle JSON parse errors', async () => {
      const cache = await mockCaches.open('test-cache');
      const mockResponse = new (global as any).Response('invalid-json');
      mockResponse.json = () => {
        throw new Error('Invalid JSON');
      };
      await cache.put('broken-key', mockResponse);

      const result = await storage.get('broken-key');
      assert.strictEqual(result, null);
    });

    it('should handle cache operation failures', async () => {
      const originalOpen = mockCaches.open;
      let callCount = 0;
      mockCaches.open = async () => {
        callCount++;
        if (callCount === 1) {
          // First call succeeds (for set)
          return originalOpen.call(mockCaches, 'test-cache');
        }
        throw new Error('Cache operation failed');
      };

      const entry: CacheEntry = {
        data: {
          data: { test: 'value' },
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {},
        },
        timestamp: Date.now(),
        ttl: 60000,
        key: 'fail-key',
      };

      // Should not throw
      await storage.set('fail-key', entry);

      mockCaches.open = originalOpen;
    });
  });

  describe('CacheManager', () => {
    let cacheManager: CacheManager;

    beforeEach(() => {
      cacheManager = new CacheManager({
        enabled: true,
        ttl: 300000,
        storage: 'memory',
      });
    });

    afterEach(() => {
      cacheManager.dispose();
    });

    it('should create memory storage by default', () => {
      const manager = new CacheManager();
      const storage = manager.getStorage();
      assert(storage instanceof MemoryCacheStorage);
      manager.dispose();
    });

    it('should create localStorage storage', () => {
      const manager = new CacheManager({ storage: 'localStorage' });
      const storage = manager.getStorage();
      assert(storage instanceof LocalStorageCacheStorage);
    });

    it('should create sessionStorage storage', () => {
      const manager = new CacheManager({ storage: 'sessionStorage' });
      const storage = manager.getStorage();
      assert(storage instanceof SessionStorageCacheStorage);
    });

    it('should accept custom storage instance', () => {
      const customStorage = new MemoryCacheStorage();
      const manager = new CacheManager({ storage: customStorage as any });
      const storage = manager.getStorage();
      assert.strictEqual(storage, customStorage);
      customStorage.dispose();
    });

    it('should fallback to memory storage for invalid config', () => {
      const manager = new CacheManager({ storage: 'invalid' as any });
      const storage = manager.getStorage();
      assert(storage instanceof MemoryCacheStorage);
      manager.dispose();
    });

    it('should generate cache keys correctly', () => {
      const config: fluxhttpRequestConfig = {
        method: 'GET',
        url: '/api/users',
        params: { page: 1 },
        headers: { 'Accept': 'application/json', 'Authorization': 'Bearer token' },
      };

      const key = cacheManager.generateCacheKey(config);
      
      // Should include method, URL, params, and relevant headers
      assert(key.includes('GET'));
      assert(key.includes('/api/users'));
      assert(key.includes('"page":1'));
      assert(key.includes('"accept":"application/json"'));
      // Should exclude authorization header
      assert(!key.includes('Authorization'));
    });

    it('should use custom key generator', () => {
      const config: fluxhttpRequestConfig = {
        method: 'GET',
        url: '/api/users',
      };

      const customKey = cacheManager.generateCacheKey(config, (cfg) => `custom-${cfg.url}`);
      assert.strictEqual(customKey, 'custom-/api/users');
    });

    it('should determine cacheability correctly', () => {
      // Cacheable requests
      assert(cacheManager.isCacheable({ method: 'GET', url: '/api/users' }));
      assert(cacheManager.isCacheable({ method: 'HEAD', url: '/api/users' }));
      assert(cacheManager.isCacheable({ method: 'OPTIONS', url: '/api/users' }));
      assert(cacheManager.isCacheable({ url: '/api/users' })); // defaults to GET

      // Non-cacheable requests
      assert(!cacheManager.isCacheable({ method: 'POST', url: '/api/users' }));
      assert(!cacheManager.isCacheable({ method: 'PUT', url: '/api/users' }));
      assert(!cacheManager.isCacheable({ method: 'DELETE', url: '/api/users' }));
      assert(!cacheManager.isCacheable({ method: 'PATCH', url: '/api/users' }));

      // Requests with authorization headers
      assert(!cacheManager.isCacheable({
        method: 'GET',
        url: '/api/users',
        headers: { 'Authorization': 'Bearer token' },
      }));
    });

    it('should get cached response', async () => {
      const config: fluxhttpRequestConfig = {
        method: 'GET',
        url: '/api/users',
      };

      const response: fluxhttpResponse = {
        data: { users: [] },
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
      };

      const cacheConfig = { enabled: true, ttl: 300000 };

      // Cache miss
      let cached = await cacheManager.get(config, cacheConfig);
      assert.strictEqual(cached, null);

      // Store response
      await cacheManager.set(config, response, cacheConfig);

      // Cache hit
      cached = await cacheManager.get(config, cacheConfig);
      assert(cached);
      assert.deepStrictEqual(cached.data, response.data);
    });

    it('should not cache when disabled', async () => {
      const config: fluxhttpRequestConfig = {
        method: 'GET',
        url: '/api/users',
      };

      const response: fluxhttpResponse = {
        data: { users: [] },
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
      };

      const cacheConfig = { enabled: false };

      // Should not cache
      await cacheManager.set(config, response, cacheConfig);
      const cached = await cacheManager.get(config, cacheConfig);
      assert.strictEqual(cached, null);
    });

    it('should not cache non-cacheable requests', async () => {
      const config: fluxhttpRequestConfig = {
        method: 'POST',
        url: '/api/users',
      };

      const response: fluxhttpResponse = {
        data: { success: true },
        status: 201,
        statusText: 'Created',
        headers: {},
        config,
      };

      const cacheConfig = { enabled: true, ttl: 300000 };

      // Should not cache POST requests
      await cacheManager.set(config, response, cacheConfig);
      const cached = await cacheManager.get(config, cacheConfig);
      assert.strictEqual(cached, null);
    });

    it('should not cache error responses', async () => {
      const config: fluxhttpRequestConfig = {
        method: 'GET',
        url: '/api/users',
      };

      const response: fluxhttpResponse = {
        data: { error: 'Not found' },
        status: 404,
        statusText: 'Not Found',
        headers: {},
        config,
      };

      const cacheConfig = { enabled: true, ttl: 300000 };

      // Should not cache 4xx/5xx responses
      await cacheManager.set(config, response, cacheConfig);
      const cached = await cacheManager.get(config, cacheConfig);
      assert.strictEqual(cached, null);
    });

    it('should exclude specified headers from cache', async () => {
      const config: fluxhttpRequestConfig = {
        method: 'GET',
        url: '/api/users',
      };

      const response: fluxhttpResponse = {
        data: { users: [] },
        status: 200,
        statusText: 'OK',
        headers: {
          'content-type': 'application/json',
          'set-cookie': 'session=abc123',
          'authorization': 'Bearer token',
        } as any,
        config,
      };

      const cacheConfig = {
        enabled: true,
        ttl: 300000,
        excludeHeaders: ['set-cookie', 'authorization'],
      };

      await cacheManager.set(config, response, cacheConfig);
      const cached = await cacheManager.get(config, cacheConfig);

      assert(cached);
      assert(cached.headers['content-type']);
      assert(!cached.headers['set-cookie']);
      assert(!cached.headers['authorization']);
    });

    it('should delete cached entries', async () => {
      const config: fluxhttpRequestConfig = {
        method: 'GET',
        url: '/api/users',
      };

      const response: fluxhttpResponse = {
        data: { users: [] },
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
      };

      const cacheConfig = { enabled: true, ttl: 300000 };

      // Store and verify
      await cacheManager.set(config, response, cacheConfig);
      assert(await cacheManager.has(config, cacheConfig));

      // Delete and verify
      await cacheManager.delete(config, cacheConfig);
      assert.strictEqual(await cacheManager.has(config, cacheConfig), false);
    });

    it('should clear all cached entries', async () => {
      const config1: fluxhttpRequestConfig = {
        method: 'GET',
        url: '/api/users',
      };

      const config2: fluxhttpRequestConfig = {
        method: 'GET',
        url: '/api/posts',
      };

      const response: fluxhttpResponse = {
        data: {},
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {},
      };

      const cacheConfig = { enabled: true, ttl: 300000 };

      // Store multiple entries
      await cacheManager.set(config1, response, cacheConfig);
      await cacheManager.set(config2, response, cacheConfig);

      assert(await cacheManager.has(config1, cacheConfig));
      assert(await cacheManager.has(config2, cacheConfig));

      // Clear all
      await cacheManager.clear();

      assert.strictEqual(await cacheManager.has(config1, cacheConfig), false);
      assert.strictEqual(await cacheManager.has(config2, cacheConfig), false);
    });
  });

  describe('createCacheConfig', () => {
    it('should create default cache config', () => {
      const config = createCacheConfig();
      
      assert.strictEqual(config.enabled, false);
      assert.strictEqual(config.ttl, 300000);
      assert.strictEqual(config.storage, 'memory');
      assert.deepStrictEqual(config.excludeHeaders, ['set-cookie', 'authorization']);
    });

    it('should merge custom config with defaults', () => {
      const config = createCacheConfig({
        enabled: true,
        ttl: 600000,
        storage: 'localStorage',
      });
      
      assert.strictEqual(config.enabled, true);
      assert.strictEqual(config.ttl, 600000);
      assert.strictEqual(config.storage, 'localStorage');
      assert.deepStrictEqual(config.excludeHeaders, ['set-cookie', 'authorization']);
    });

    it('should override exclude headers', () => {
      const config = createCacheConfig({
        excludeHeaders: ['custom-header'],
      });
      
      assert.deepStrictEqual(config.excludeHeaders, ['custom-header']);
    });
  });

  describe('defaultCacheManager', () => {
    it('should export default cache manager instance', () => {
      assert(defaultCacheManager instanceof CacheManager);
      assert(defaultCacheManager.getStorage() instanceof MemoryCacheStorage);
    });
  });

  describe('Edge Cases', () => {
    let cacheManager: CacheManager;

    beforeEach(() => {
      cacheManager = new CacheManager({ enabled: true });
    });

    afterEach(() => {
      cacheManager.dispose();
    });

    it('should handle config with no URL', () => {
      const config: fluxhttpRequestConfig = {
        method: 'GET',
      };

      const key = cacheManager.generateCacheKey(config);
      assert(key.includes('GET'));
    });

    it('should handle config with no method', () => {
      const config: fluxhttpRequestConfig = {
        url: '/api/test',
      };

      const key = cacheManager.generateCacheKey(config);
      assert(key.includes('GET')); // Should default to GET
    });

    it('should handle config with complex nested data', () => {
      const config: fluxhttpRequestConfig = {
        method: 'POST',
        url: '/api/test',
        data: {
          nested: {
            array: [1, 2, 3],
            object: { key: 'value' },
          },
        },
      };

      const key = cacheManager.generateCacheKey(config);
      assert(key.includes('POST'));
      assert(key.includes('"nested"'));
    });

    it('should handle circular references in config data gracefully', () => {
      const config: fluxhttpRequestConfig = {
        method: 'POST',
        url: '/api/test',
        data: {},
      };
      
      // Create circular reference
      (config.data as any).circular = config.data;

      // Should not throw
      assert.doesNotThrow(() => {
        cacheManager.generateCacheKey(config);
      });
    });

    it('should handle very large cache keys', () => {
      const largeParams: Record<string, string> = {};
      for (let i = 0; i < 1000; i++) {
        largeParams[`param${i}`] = `value${i}`.repeat(10);
      }

      const config: fluxhttpRequestConfig = {
        method: 'GET',
        url: '/api/test',
        params: largeParams,
      };

      const key = cacheManager.generateCacheKey(config);
      assert(key.length > 1000);
      assert(key.includes('GET'));
    });

    it('should handle special characters in headers', () => {
      const config: fluxhttpRequestConfig = {
        method: 'GET',
        url: '/api/test',
        headers: {
          'X-Custom-Header': 'value with spaces and símbolos',
          'Content-Type': 'application/json; charset=utf-8',
        },
      };

      const key = cacheManager.generateCacheKey(config);
      assert(key.includes('símbolos'));
      assert(key.includes('charset=utf-8'));
    });
  });
});
