/**
 * @module cache
 * @description HTTP response caching system with multiple storage backends
 */

import type { fluxhttpRequestConfig, fluxhttpResponse, CacheConfig } from '../types';

/**
 * Cache entry containing response data and metadata
 * @interface CacheEntry
 * @template T - Response data type
 */
export interface CacheEntry<T = unknown> {
  /** Cached response data */
  data: fluxhttpResponse<T>;
  /** Timestamp when entry was created */
  timestamp: number;
  /** Time to live in milliseconds */
  ttl: number;
  /** Cache key */
  key: string;
}

/**
 * Interface for cache storage implementations
 * @interface CacheStorage
 */
export interface CacheStorage {
  /**
   * Get cached entry by key
   * @template T - Response data type
   * @param {string} key - Cache key
   * @returns {Promise<CacheEntry<T> | null>} Cached entry or null if not found/expired
   */
  get<T = unknown>(key: string): Promise<CacheEntry<T> | null>;

  /**
   * Store entry in cache
   * @template T - Response data type
   * @param {string} key - Cache key
   * @param {CacheEntry<T>} entry - Entry to store
   * @returns {Promise<void>}
   */
  set<T = unknown>(key: string, entry: CacheEntry<T>): Promise<void>;

  /**
   * Delete entry from cache
   * @param {string} key - Cache key
   * @returns {Promise<void>}
   */
  delete(key: string): Promise<void>;

  /**
   * Clear all entries from cache
   * @returns {Promise<void>}
   */
  clear(): Promise<void>;

  /**
   * Check if key exists in cache
   * @param {string} key - Cache key
   * @returns {Promise<boolean>} True if key exists and is not expired
   */
  has(key: string): Promise<boolean>;
}

/**
 * Memory-based cache storage implementation
 * @class MemoryCacheStorage
 * @implements {CacheStorage}
 * @description Fast in-memory cache storage. Data is lost when process ends.
 *
 * @example
 * ```typescript
 * const storage = new MemoryCacheStorage(30000); // 30 second cleanup interval
 * await storage.set('key', cacheEntry);
 * const entry = await storage.get('key');
 * ```
 */
export class MemoryCacheStorage implements CacheStorage {
  private cache = new Map<string, CacheEntry>();
  private cleanupTimer?: NodeJS.Timeout;

  /**
   * Create memory cache storage
   * @constructor
   * @param {number} [cleanupInterval=60000] - Cleanup interval in milliseconds
   */
  constructor(private cleanupInterval = 60000) {
    // 1 minute cleanup
    this.startCleanup();
  }

  async get<T = unknown>(key: string): Promise<CacheEntry<T> | null> {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;

    if (!entry) {
      return null;
    }

    // Check if entry has expired
    if (this.isExpired(entry)) {
      this.cache.delete(key);
      return null;
    }

    return entry;
  }

  async set<T = unknown>(key: string, entry: CacheEntry<T>): Promise<void> {
    this.cache.set(key, entry);
  }

  async delete(key: string): Promise<void> {
    this.cache.delete(key);
  }

  async clear(): Promise<void> {
    this.cache.clear();
  }

  async has(key: string): Promise<boolean> {
    const entry = this.cache.get(key);
    if (!entry) return false;

    if (this.isExpired(entry)) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  private isExpired(entry: CacheEntry): boolean {
    return Date.now() - entry.timestamp > entry.ttl;
  }

  private startCleanup(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanupExpired();
    }, this.cleanupInterval);
  }

  private cleanupExpired(): void {
    const now = Date.now();
    for (const [key, entry] of Array.from(this.cache.entries())) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
      }
    }
  }

  dispose(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }
    this.cache.clear();
  }
}

/**
 * Browser localStorage-based cache storage
 * @class LocalStorageCacheStorage
 * @implements {CacheStorage}
 * @description Persistent cache storage using browser's localStorage API.
 * Data persists across browser sessions until explicitly cleared.
 *
 * @example
 * ```typescript
 * const storage = new LocalStorageCacheStorage('myapp_cache_');
 * await storage.set('key', cacheEntry);
 *
 * // Data persists even after browser restart
 * const entry = await storage.get('key');
 * ```
 */
export class LocalStorageCacheStorage implements CacheStorage {
  /**
   * Create localStorage cache storage
   * @constructor
   * @param {string} [prefix='fluxhttp_cache_'] - Key prefix to avoid collisions
   */
  constructor(private prefix = 'fluxhttp_cache_') {}

  async get<T = unknown>(key: string): Promise<CacheEntry<T> | null> {
    if (typeof localStorage === 'undefined') {
      return null;
    }

    try {
      const item = localStorage.getItem(this.prefix + key);
      if (!item) {
        return null;
      }

      const entry: CacheEntry<T> = JSON.parse(item);

      // Check if entry has expired
      if (Date.now() - entry.timestamp > entry.ttl) {
        localStorage.removeItem(this.prefix + key);
        return null;
      }

      return entry;
    } catch {
      return null;
    }
  }

  async set<T = unknown>(key: string, entry: CacheEntry<T>): Promise<void> {
    if (typeof localStorage === 'undefined') {
      return;
    }

    try {
      localStorage.setItem(this.prefix + key, JSON.stringify(entry));
    } catch {
      // Storage quota exceeded or other error
      // Could implement LRU eviction here
    }
  }

  async delete(key: string): Promise<void> {
    if (typeof localStorage === 'undefined') {
      return;
    }

    localStorage.removeItem(this.prefix + key);
  }

  async clear(): Promise<void> {
    if (typeof localStorage === 'undefined') {
      return;
    }

    // Remove all items with our prefix
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(this.prefix)) {
        keysToRemove.push(key);
      }
    }

    keysToRemove.forEach((key) => localStorage.removeItem(key));
  }

  async has(key: string): Promise<boolean> {
    const entry = await this.get(key);
    return entry !== null;
  }
}

/**
 * Browser sessionStorage-based cache storage
 * @class SessionStorageCacheStorage
 * @implements {CacheStorage}
 * @description Session-based cache storage using browser's sessionStorage API.
 * Data persists only for the current browser session.
 *
 * @example
 * ```typescript
 * const storage = new SessionStorageCacheStorage('session_cache_');
 * await storage.set('key', cacheEntry);
 *
 * // Data is lost when browser tab is closed
 * const entry = await storage.get('key');
 * ```
 */
export class SessionStorageCacheStorage implements CacheStorage {
  /**
   * Create sessionStorage cache storage
   * @constructor
   * @param {string} [prefix='fluxhttp_cache_'] - Key prefix to avoid collisions
   */
  constructor(private prefix = 'fluxhttp_cache_') {}

  async get<T = unknown>(key: string): Promise<CacheEntry<T> | null> {
    if (typeof sessionStorage === 'undefined') {
      return null;
    }

    try {
      const item = sessionStorage.getItem(this.prefix + key);
      if (!item) {
        return null;
      }

      const entry: CacheEntry<T> = JSON.parse(item);

      // Check if entry has expired
      if (Date.now() - entry.timestamp > entry.ttl) {
        sessionStorage.removeItem(this.prefix + key);
        return null;
      }

      return entry;
    } catch {
      return null;
    }
  }

  async set<T = unknown>(key: string, entry: CacheEntry<T>): Promise<void> {
    if (typeof sessionStorage === 'undefined') {
      return;
    }

    try {
      sessionStorage.setItem(this.prefix + key, JSON.stringify(entry));
    } catch {
      // Storage quota exceeded or other error
    }
  }

  async delete(key: string): Promise<void> {
    if (typeof sessionStorage === 'undefined') {
      return;
    }

    sessionStorage.removeItem(this.prefix + key);
  }

  async clear(): Promise<void> {
    if (typeof sessionStorage === 'undefined') {
      return;
    }

    // Remove all items with our prefix
    const keysToRemove: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key && key.startsWith(this.prefix)) {
        keysToRemove.push(key);
      }
    }

    keysToRemove.forEach((key) => sessionStorage.removeItem(key));
  }

  async has(key: string): Promise<boolean> {
    const entry = await this.get(key);
    return entry !== null;
  }
}

/**
 * Browser Cache API-based storage
 * @class CacheApiStorage
 * @implements {CacheStorage}
 * @description Modern cache storage using browser's Cache API.
 * Service Worker compatible and optimized for network requests.
 *
 * @example
 * ```typescript
 * const storage = new CacheApiStorage('api-cache-v1');
 * await storage.set('/api/users', cacheEntry);
 *
 * // Works in Service Workers
 * self.addEventListener('fetch', event => {
 *   const cached = await storage.get(event.request.url);
 *   if (cached) event.respondWith(cached.data);
 * });
 * ```
 */
export class CacheApiStorage implements CacheStorage {
  private cache?: Cache;

  /**
   * Create Cache API storage
   * @constructor
   * @param {string} [cacheName='fluxhttp-cache'] - Cache bucket name
   */
  constructor(private cacheName = 'fluxhttp-cache') {}

  private async getCache(): Promise<Cache | null> {
    if (typeof caches === 'undefined') {
      return null;
    }

    if (!this.cache) {
      this.cache = await caches.open(this.cacheName);
    }

    return this.cache;
  }

  async get<T = unknown>(key: string): Promise<CacheEntry<T> | null> {
    const cache = await this.getCache();
    if (!cache) return null;

    try {
      const response = await cache.match(key);
      if (!response) {
        return null;
      }

      const entry: CacheEntry<T> = await response.json();

      // Check if entry has expired
      if (Date.now() - entry.timestamp > entry.ttl) {
        await cache.delete(key);
        return null;
      }

      return entry;
    } catch {
      return null;
    }
  }

  async set<T = unknown>(key: string, entry: CacheEntry<T>): Promise<void> {
    const cache = await this.getCache();
    if (!cache) return;

    try {
      const response = new Response(JSON.stringify(entry), {
        headers: { 'Content-Type': 'application/json' },
      });
      await cache.put(key, response);
    } catch {
      // Cache operation failed
    }
  }

  async delete(key: string): Promise<void> {
    const cache = await this.getCache();
    if (!cache) return;

    await cache.delete(key);
  }

  async clear(): Promise<void> {
    if (typeof caches === 'undefined') {
      return;
    }

    await caches.delete(this.cacheName);
    this.cache = undefined;
  }

  async has(key: string): Promise<boolean> {
    const cache = await this.getCache();
    if (!cache) return false;

    const response = await cache.match(key);
    if (!response) return false;

    try {
      const entry: CacheEntry = await response.json();

      // Check if entry has expired
      if (Date.now() - entry.timestamp > entry.ttl) {
        await cache.delete(key);
        return false;
      }

      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Main cache manager for HTTP response caching
 * @class CacheManager
 * @description Manages HTTP response caching with configurable storage backends
 *
 * @example
 * ```typescript
 * const cacheManager = new CacheManager({
 *   storage: 'localStorage',
 *   ttl: 600000 // 10 minutes
 * });
 *
 * // Check cache before request
 * const cached = await cacheManager.get(config);
 * if (cached) return cached;
 *
 * // Store response after request
 * await cacheManager.set(config, response);
 * ```
 */
export class CacheManager {
  private storage: CacheStorage;

  /**
   * Create cache manager
   * @constructor
   * @param {CacheConfig} [config={}] - Cache configuration
   */
  constructor(config: CacheConfig = {}) {
    this.storage = this.createStorage(config);
  }

  private createStorage(config: CacheConfig): CacheStorage {
    const storageType = config.storage || 'memory';

    if (typeof storageType === 'string') {
      switch (storageType) {
        case 'localStorage':
          return new LocalStorageCacheStorage();
        case 'sessionStorage':
          return new SessionStorageCacheStorage();
        case 'memory':
        default:
          return new MemoryCacheStorage();
      }
    }

    // If a custom CacheStorage instance is provided
    if (typeof storageType === 'object' && storageType !== null) {
      return storageType as unknown as CacheStorage;
    }

    return new MemoryCacheStorage();
  }

  /**
   * Generate cache key from request configuration
   * @param {fluxhttpRequestConfig} config - Request configuration
   * @param {Function} [customKeyGenerator] - Custom key generator function
   * @returns {string} Cache key
   * @example
   * ```typescript
   * const key = cacheManager.generateCacheKey({
   *   method: 'GET',
   *   url: '/api/users',
   *   params: { page: 1 }
   * });
   * // Returns: 'GET:/api/users:{"page":1}::'
   * ```
   */
  generateCacheKey(
    config: fluxhttpRequestConfig,
    customKeyGenerator?: (config: fluxhttpRequestConfig) => string
  ): string {
    if (customKeyGenerator) {
      return customKeyGenerator(config);
    }

    // Default key generation based on URL, method, and relevant parameters
    const method = (config.method || 'GET').toUpperCase();
    const url = config.url || '';
    const params = config.params ? JSON.stringify(config.params) : '';
    const data = config.data && method !== 'GET' ? JSON.stringify(config.data) : '';

    // Include relevant headers (excluding auth and cache-control)
    const relevantHeaders: Record<string, string> = {};
    if (config.headers) {
      Object.entries(config.headers).forEach(([key, value]) => {
        const lowerKey = key.toLowerCase();
        if (
          !['authorization', 'cache-control', 'if-none-match', 'if-modified-since'].includes(
            lowerKey
          )
        ) {
          relevantHeaders[lowerKey] = String(value);
        }
      });
    }
    const headers = Object.keys(relevantHeaders).length > 0 ? JSON.stringify(relevantHeaders) : '';

    return `${method}:${url}:${params}:${data}:${headers}`;
  }

  /**
   * Check if request is cacheable
   * @param {fluxhttpRequestConfig} config - Request configuration
   * @returns {boolean} True if request can be cached
   * @description Only GET, HEAD, and OPTIONS requests without auth headers are cacheable by default
   */
  isCacheable(config: fluxhttpRequestConfig): boolean {
    const method = (config.method || 'GET').toUpperCase();

    // Only cache safe methods by default
    const cacheableMethods = ['GET', 'HEAD', 'OPTIONS'];

    if (!cacheableMethods.includes(method)) {
      return false;
    }

    // Don't cache requests with authorization headers by default
    if (config.headers) {
      const hasAuth = Object.keys(config.headers).some(
        (key) => key.toLowerCase() === 'authorization'
      );
      if (hasAuth) {
        return false;
      }
    }

    return true;
  }

  /**
   * Get cached response
   * @async
   * @template T - Response data type
   * @param {fluxhttpRequestConfig} config - Request configuration
   * @param {CacheConfig} [cacheConfig] - Cache configuration
   * @returns {Promise<fluxhttpResponse<T> | null>} Cached response or null if not found/expired
   */
  async get<T = unknown>(
    config: fluxhttpRequestConfig,
    cacheConfig?: CacheConfig
  ): Promise<fluxhttpResponse<T> | null> {
    if (!cacheConfig?.enabled) {
      return null;
    }

    if (!this.isCacheable(config)) {
      return null;
    }

    const key = this.generateCacheKey(config, cacheConfig.key);
    const entry = await this.storage.get<T>(key);

    return entry ? entry.data : null;
  }

  /**
   * Store response in cache
   * @async
   * @template T - Response data type
   * @param {fluxhttpRequestConfig} config - Request configuration
   * @param {fluxhttpResponse<T>} response - Response to cache
   * @param {CacheConfig} [cacheConfig] - Cache configuration
   * @returns {Promise<void>}
   * @description Stores response if request is cacheable and response is successful (status < 400)
   */
  async set<T = unknown>(
    config: fluxhttpRequestConfig,
    response: fluxhttpResponse<T>,
    cacheConfig?: CacheConfig
  ): Promise<void> {
    if (!cacheConfig?.enabled) {
      return;
    }

    if (!this.isCacheable(config)) {
      return;
    }

    // Don't cache error responses by default
    if (response.status >= 400) {
      return;
    }

    const ttl = cacheConfig.ttl || 300000; // 5 minutes default
    const key = this.generateCacheKey(config, cacheConfig.key);

    // Clone response to avoid mutations
    const cachedResponse: fluxhttpResponse<T> = {
      data: response.data,
      status: response.status,
      statusText: response.statusText,
      headers: { ...response.headers } as any, // Convert to record for storage
      config: { ...response.config },
    };

    // Remove excluded headers
    if (cacheConfig.excludeHeaders) {
      const headersRecord = { ...response.headers } as Record<string, string>;
      cacheConfig.excludeHeaders.forEach((header) => {
        delete headersRecord[header];
      });
      cachedResponse.headers = headersRecord as any;
    }

    const entry: CacheEntry<T> = {
      data: cachedResponse,
      timestamp: Date.now(),
      ttl,
      key,
    };

    await this.storage.set(key, entry);
  }

  /**
   * Delete cached entry
   * @async
   * @param {fluxhttpRequestConfig} config - Request configuration
   * @param {CacheConfig} [cacheConfig] - Cache configuration for custom key
   * @returns {Promise<void>}
   */
  async delete(config: fluxhttpRequestConfig, cacheConfig?: CacheConfig): Promise<void> {
    const key = this.generateCacheKey(config, cacheConfig?.key);
    await this.storage.delete(key);
  }

  /**
   * Clear all cached entries
   * @async
   * @returns {Promise<void>}
   */
  async clear(): Promise<void> {
    await this.storage.clear();
  }

  /**
   * Check if entry exists in cache
   * @async
   * @param {fluxhttpRequestConfig} config - Request configuration
   * @param {CacheConfig} [cacheConfig] - Cache configuration for custom key
   * @returns {Promise<boolean>} True if entry exists and is not expired
   */
  async has(config: fluxhttpRequestConfig, cacheConfig?: CacheConfig): Promise<boolean> {
    const key = this.generateCacheKey(config, cacheConfig?.key);
    return await this.storage.has(key);
  }

  /**
   * Get cache storage instance
   * @returns {CacheStorage} Current storage backend
   * @description For advanced usage when direct storage access is needed
   */
  getStorage(): CacheStorage {
    return this.storage;
  }

  /**
   * Dispose of cache resources
   * @returns {void}
   * @description Cleans up resources like timers. Call when cache manager is no longer needed.
   */
  dispose(): void {
    if (this.storage instanceof MemoryCacheStorage) {
      this.storage.dispose();
    }
  }
}

// Default cache manager instance
export const defaultCacheManager = new CacheManager();

/**
 * Create cache configuration with defaults
 * @function createCacheConfig
 * @param {Partial<CacheConfig>} [config={}] - Partial cache configuration
 * @returns {CacheConfig} Complete cache configuration with defaults
 * @example
 * ```typescript
 * const cacheConfig = createCacheConfig({
 *   enabled: true,
 *   ttl: 600000, // 10 minutes
 *   storage: 'localStorage'
 * });
 * ```
 */
export function createCacheConfig(config: Partial<CacheConfig> = {}): CacheConfig {
  return {
    enabled: false,
    ttl: 300000, // 5 minutes
    storage: 'memory',
    excludeHeaders: ['set-cookie', 'authorization'],
    ...config,
  };
}
