/**
 * @fileoverview Advanced caching system for FluxHTTP
 * @module @fluxhttp/core/features/cache-advanced
 */

import type { fluxhttpRequestConfig, fluxhttpResponse, Headers } from '../types';

/**
 * Cache entry metadata
 */
export interface CacheEntryMetadata {
  /** When the entry was created */
  createdAt: number;
  /** When the entry was last accessed */
  lastAccessed: number;
  /** How many times the entry has been accessed */
  accessCount: number;
  /** Time-to-live in milliseconds */
  ttl: number;
  /** When the entry expires */
  expiresAt: number;
  /** Entry size in bytes */
  size: number;
  /** Entry tags for bulk operations */
  tags: string[];
  /** Whether entry supports stale-while-revalidate */
  staleWhileRevalidate: boolean;
  /** HTTP headers used for cache validation */
  validationHeaders: {
    etag?: string;
    lastModified?: string;
    cacheControl?: string;
  };
}

/**
 * Cache entry interface
 */
export interface CacheEntry<T = unknown> {
  /** Cache key */
  key: string;
  /** Cached data */
  data: T;
  /** Entry metadata */
  metadata: CacheEntryMetadata;
  /** Original request configuration */
  requestConfig: fluxhttpRequestConfig;
  /** Original response headers */
  responseHeaders: Headers;
}

/**
 * Cache invalidation strategy
 */
export enum InvalidationStrategy {
  /** Time-based expiration */
  TTL = 'ttl',
  /** Least Recently Used */
  LRU = 'lru',
  /** Least Frequently Used */
  LFU = 'lfu',
  /** First In, First Out */
  FIFO = 'fifo',
  /** Manual invalidation only */
  MANUAL = 'manual',
  /** HTTP cache headers */
  HTTP_HEADERS = 'http-headers'
}

/**
 * Cache storage interface
 */
export interface CacheStorage {
  /** Get entry from cache */
  get<T>(key: string): Promise<CacheEntry<T> | null>;
  /** Set entry in cache */
  set<T>(key: string, entry: CacheEntry<T>): Promise<void>;
  /** Delete entry from cache */
  delete(key: string): Promise<boolean>;
  /** Clear all entries */
  clear(): Promise<void>;
  /** Get all keys */
  keys(): Promise<string[]>;
  /** Get cache size */
  size(): Promise<number>;
  /** Check if key exists */
  has(key: string): Promise<boolean>;
}

/**
 * Memory-based cache storage
 */
export class MemoryCacheStorage implements CacheStorage {
  private cache = new Map<string, CacheEntry>();

  async get<T>(key: string): Promise<CacheEntry<T> | null> {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;
    if (entry) {
      // Update access metadata
      entry.metadata.lastAccessed = Date.now();
      entry.metadata.accessCount++;
    }
    return entry || null;
  }

  async set<T>(key: string, entry: CacheEntry<T>): Promise<void> {
    this.cache.set(key, entry);
  }

  async delete(key: string): Promise<boolean> {
    return this.cache.delete(key);
  }

  async clear(): Promise<void> {
    this.cache.clear();
  }

  async keys(): Promise<string[]> {
    return Array.from(this.cache.keys());
  }

  async size(): Promise<number> {
    return this.cache.size;
  }

  async has(key: string): Promise<boolean> {
    return this.cache.has(key);
  }
}

/**
 * Browser localStorage-based cache storage
 */
export class LocalStorageCacheStorage implements CacheStorage {
  private prefix: string;

  constructor(prefix = 'fluxhttp-cache:') {
    this.prefix = prefix;
  }

  async get<T>(key: string): Promise<CacheEntry<T> | null> {
    if (typeof localStorage === 'undefined') return null;

    try {
      const data = localStorage.getItem(this.prefix + key);
      if (!data) return null;

      const entry = JSON.parse(data) as CacheEntry<T>;
      // Update access metadata
      entry.metadata.lastAccessed = Date.now();
      entry.metadata.accessCount++;
      await this.set(key, entry);
      
      return entry;
    } catch {
      return null;
    }
  }

  async set<T>(key: string, entry: CacheEntry<T>): Promise<void> {
    if (typeof localStorage === 'undefined') return;

    try {
      localStorage.setItem(this.prefix + key, JSON.stringify(entry));
    } catch {
      // Handle quota exceeded or other localStorage errors
    }
  }

  async delete(key: string): Promise<boolean> {
    if (typeof localStorage === 'undefined') return false;

    try {
      localStorage.removeItem(this.prefix + key);
      return true;
    } catch {
      return false;
    }
  }

  async clear(): Promise<void> {
    if (typeof localStorage === 'undefined') return;

    const keys = await this.keys();
    for (const key of keys) {
      localStorage.removeItem(this.prefix + key);
    }
  }

  async keys(): Promise<string[]> {
    if (typeof localStorage === 'undefined') return [];

    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(this.prefix)) {
        keys.push(key.substring(this.prefix.length));
      }
    }
    return keys;
  }

  async size(): Promise<number> {
    return (await this.keys()).length;
  }

  async has(key: string): Promise<boolean> {
    if (typeof localStorage === 'undefined') return false;
    return localStorage.getItem(this.prefix + key) !== null;
  }
}

/**
 * Advanced cache configuration
 */
export interface AdvancedCacheConfig {
  /** Cache storage implementation */
  storage: CacheStorage;
  /** Default TTL in milliseconds */
  defaultTtl: number;
  /** Maximum cache size in bytes */
  maxSize: number;
  /** Maximum number of entries */
  maxEntries: number;
  /** Invalidation strategy */
  invalidationStrategy: InvalidationStrategy;
  /** Whether to enable stale-while-revalidate */
  staleWhileRevalidate: boolean;
  /** Stale timeout in milliseconds */
  staleTimeout: number;
  /** Cache key generator function */
  keyGenerator: (config: fluxhttpRequestConfig) => string;
  /** Headers to exclude from caching */
  excludeHeaders: string[];
  /** Headers to include in cache validation */
  validationHeaders: string[];
  /** Whether to compress cached data */
  compress: boolean;
  /** Cache warming configuration */
  warming: {
    enabled: boolean;
    urls: string[];
    interval: number;
  };
}

/**
 * Cache statistics
 */
export interface CacheStats {
  /** Cache hit count */
  hits: number;
  /** Cache miss count */
  misses: number;
  /** Cache hit ratio */
  hitRatio: number;
  /** Total requests */
  totalRequests: number;
  /** Current cache size in bytes */
  currentSize: number;
  /** Current number of entries */
  currentEntries: number;
  /** Eviction count */
  evictions: number;
  /** Average entry age */
  averageAge: number;
  /** Memory usage */
  memoryUsage: {
    used: number;
    available: number;
    percentage: number;
  };
}

/**
 * HTTP cache control directive parser
 */
export class CacheControlParser {
  /**
   * Parse Cache-Control header
   */
  static parse(cacheControl: string): Record<string, string | boolean> {
    const directives: Record<string, string | boolean> = {};
    
    if (!cacheControl) return directives;

    const parts = cacheControl.split(',').map(part => part.trim());
    
    for (const part of parts) {
      const [key, value] = part.split('=');
      if (value !== undefined) {
        directives[key.trim()] = value.trim().replace(/"/g, '');
      } else {
        directives[key.trim()] = true;
      }
    }

    return directives;
  }

  /**
   * Check if response is cacheable based on Cache-Control
   */
  static isCacheable(cacheControl: string): boolean {
    const directives = this.parse(cacheControl);
    
    if (directives['no-store'] || directives['private']) {
      return false;
    }

    return true;
  }

  /**
   * Get TTL from Cache-Control header
   */
  static getTtl(cacheControl: string): number | null {
    const directives = this.parse(cacheControl);
    
    if (directives['max-age']) {
      return parseInt(directives['max-age'] as string, 10) * 1000;
    }

    return null;
  }

  /**
   * Check if stale-while-revalidate is enabled
   */
  static getStaleWhileRevalidate(cacheControl: string): number | null {
    const directives = this.parse(cacheControl);
    
    if (directives['stale-while-revalidate']) {
      return parseInt(directives['stale-while-revalidate'] as string, 10) * 1000;
    }

    return null;
  }
}

/**
 * Advanced HTTP cache implementation
 */
export class AdvancedHttpCache {
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    hitRatio: 0,
    totalRequests: 0,
    currentSize: 0,
    currentEntries: 0,
    evictions: 0,
    averageAge: 0,
    memoryUsage: {
      used: 0,
      available: 0,
      percentage: 0
    }
  };

  private revalidationPromises = new Map<string, Promise<fluxhttpResponse>>();

  constructor(private config: AdvancedCacheConfig) {}

  /**
   * Get cached response if available and valid
   */
  async get<T>(requestConfig: fluxhttpRequestConfig): Promise<fluxhttpResponse<T> | null> {
    const key = this.config.keyGenerator(requestConfig);
    const entry = await this.config.storage.get<T>(key);

    this.stats.totalRequests++;

    if (!entry) {
      this.stats.misses++;
      this.updateHitRatio();
      return null;
    }

    // Check if entry is expired
    if (this.isExpired(entry)) {
      // Check if stale-while-revalidate is enabled
      if (this.config.staleWhileRevalidate && entry.metadata.staleWhileRevalidate) {
        const staleExpiry = entry.metadata.expiresAt + this.config.staleTimeout;
        
        if (Date.now() <= staleExpiry) {
          // Return stale response and trigger background revalidation
          this.triggerRevalidation(key, requestConfig);
          this.stats.hits++;
          this.updateHitRatio();
          return this.createResponseFromEntry(entry);
        }
      }

      // Entry is expired and stale period is over
      await this.config.storage.delete(key);
      this.stats.misses++;
      this.updateHitRatio();
      return null;
    }

    // Entry is valid
    this.stats.hits++;
    this.updateHitRatio();
    return this.createResponseFromEntry(entry);
  }

  /**
   * Cache a response
   */
  async set<T>(
    requestConfig: fluxhttpRequestConfig,
    response: fluxhttpResponse<T>
  ): Promise<void> {
    if (!this.shouldCache(requestConfig, response)) {
      return;
    }

    const key = this.config.keyGenerator(requestConfig);
    const ttl = this.getTtlForResponse(response);
    const now = Date.now();

    const metadata: CacheEntryMetadata = {
      createdAt: now,
      lastAccessed: now,
      accessCount: 0,
      ttl,
      expiresAt: now + ttl,
      size: this.calculateEntrySize(response),
      tags: this.extractTags(requestConfig),
      staleWhileRevalidate: this.supportsStaleWhileRevalidate(response),
      validationHeaders: this.extractValidationHeaders(response.headers)
    };

    const entry: CacheEntry<T> = {
      key,
      data: response.data,
      metadata,
      requestConfig: this.sanitizeRequestConfig(requestConfig),
      responseHeaders: this.sanitizeHeaders(response.headers)
    };

    // Check cache size limits before adding
    await this.enforceStorageLimits();

    await this.config.storage.set(key, entry);
    await this.updateStats();
  }

  /**
   * Invalidate cache entries
   */
  async invalidate(pattern?: string | RegExp, tags?: string[]): Promise<number> {
    const keys = await this.config.storage.keys();
    let invalidatedCount = 0;

    for (const key of keys) {
      let shouldInvalidate = false;

      // Check pattern match
      if (pattern) {
        if (typeof pattern === 'string') {
          shouldInvalidate = key.includes(pattern);
        } else {
          shouldInvalidate = pattern.test(key);
        }
      }

      // Check tag match
      if (tags && tags.length > 0) {
        const entry = await this.config.storage.get(key);
        if (entry && entry.metadata.tags.some(tag => tags.includes(tag))) {
          shouldInvalidate = true;
        }
      }

      // Invalidate all if no criteria specified
      if (!pattern && (!tags || tags.length === 0)) {
        shouldInvalidate = true;
      }

      if (shouldInvalidate) {
        await this.config.storage.delete(key);
        invalidatedCount++;
      }
    }

    await this.updateStats();
    return invalidatedCount;
  }

  /**
   * Trigger background revalidation for stale entries
   */
  private async triggerRevalidation<T>(
    key: string,
    requestConfig: fluxhttpRequestConfig
  ): Promise<void> {
    // Avoid multiple revalidation requests for the same key
    if (this.revalidationPromises.has(key)) {
      return;
    }

    const revalidationPromise = this.performRevalidation(key, requestConfig);
    this.revalidationPromises.set(key, revalidationPromise);

    try {
      await revalidationPromise;
    } finally {
      this.revalidationPromises.delete(key);
    }
  }

  /**
   * Perform actual revalidation
   */
  private async performRevalidation<T>(
    key: string,
    requestConfig: fluxhttpRequestConfig
  ): Promise<fluxhttpResponse<T>> {
    // This would be implemented by the HTTP client
    // For now, we'll just remove the stale entry
    await this.config.storage.delete(key);
    throw new Error('Revalidation not implemented - override this method');
  }

  /**
   * Check if cache entry is expired
   */
  private isExpired(entry: CacheEntry): boolean {
    return Date.now() > entry.metadata.expiresAt;
  }

  /**
   * Check if response should be cached
   */
  private shouldCache(config: fluxhttpRequestConfig, response: fluxhttpResponse): boolean {
    // Don't cache error responses
    if (response.status >= 400) {
      return false;
    }

    // Don't cache if caching is explicitly disabled
    if (config.cache?.enabled === false) {
      return false;
    }

    // Check HTTP cache headers
    const cacheControl = response.headers['cache-control'];
    if (cacheControl && !CacheControlParser.isCacheable(cacheControl)) {
      return false;
    }

    // Don't cache requests with certain methods
    const method = config.method?.toUpperCase();
    if (method && !['GET', 'HEAD', 'OPTIONS'].includes(method)) {
      return false;
    }

    return true;
  }

  /**
   * Get TTL for response based on headers and config
   */
  private getTtlForResponse(response: fluxhttpResponse): number {
    // Try to get TTL from Cache-Control header
    const cacheControl = response.headers['cache-control'];
    if (cacheControl) {
      const headerTtl = CacheControlParser.getTtl(cacheControl);
      if (headerTtl !== null) {
        return headerTtl;
      }
    }

    // Try to get TTL from Expires header
    const expires = response.headers['expires'];
    if (expires) {
      const expiresDate = new Date(expires).getTime();
      const now = Date.now();
      if (expiresDate > now) {
        return expiresDate - now;
      }
    }

    // Fall back to default TTL
    return this.config.defaultTtl;
  }

  /**
   * Check if response supports stale-while-revalidate
   */
  private supportsStaleWhileRevalidate(response: fluxhttpResponse): boolean {
    const cacheControl = response.headers['cache-control'];
    if (cacheControl) {
      return CacheControlParser.getStaleWhileRevalidate(cacheControl) !== null;
    }
    return this.config.staleWhileRevalidate;
  }

  /**
   * Extract validation headers for conditional requests
   */
  private extractValidationHeaders(headers: Headers): CacheEntryMetadata['validationHeaders'] {
    return {
      etag: headers['etag'],
      lastModified: headers['last-modified'],
      cacheControl: headers['cache-control']
    };
  }

  /**
   * Extract tags from request config for bulk operations
   */
  private extractTags(config: fluxhttpRequestConfig): string[] {
    // Extract tags from URL path, query params, etc.
    const tags: string[] = [];
    
    if (config.url) {
      const url = new URL(config.url, 'http://localhost');
      tags.push(`path:${url.pathname}`);
      
      // Add query parameter tags
      for (const [key] of url.searchParams) {
        tags.push(`param:${key}`);
      }
    }

    if (config.method) {
      tags.push(`method:${config.method.toLowerCase()}`);
    }

    return tags;
  }

  /**
   * Calculate entry size for storage management
   */
  private calculateEntrySize(response: fluxhttpResponse): number {
    try {
      return new Blob([JSON.stringify(response.data)]).size;
    } catch {
      // Fallback size estimation
      return JSON.stringify(response.data || '').length * 2; // Rough UTF-16 estimation
    }
  }

  /**
   * Sanitize request config for storage
   */
  private sanitizeRequestConfig(config: fluxhttpRequestConfig): fluxhttpRequestConfig {
    const sanitized = { ...config };
    
    // Remove sensitive headers
    if (sanitized.headers) {
      const headers = { ...sanitized.headers };
      delete headers['authorization'];
      delete headers['cookie'];
      sanitized.headers = headers;
    }

    return sanitized;
  }

  /**
   * Sanitize response headers for storage
   */
  private sanitizeHeaders(headers: Headers): Headers {
    const sanitized = { ...headers };
    
    // Exclude headers specified in config
    for (const header of this.config.excludeHeaders) {
      delete sanitized[header.toLowerCase()];
    }

    return sanitized;
  }

  /**
   * Create response object from cache entry
   */
  private createResponseFromEntry<T>(entry: CacheEntry<T>): fluxhttpResponse<T> {
    return {
      data: entry.data,
      status: 200, // Cached responses are considered successful
      statusText: 'OK',
      headers: entry.responseHeaders,
      config: entry.requestConfig
    };
  }

  /**
   * Enforce storage size and entry limits
   */
  private async enforceStorageLimits(): Promise<void> {
    const currentEntries = await this.config.storage.size();
    
    if (currentEntries >= this.config.maxEntries) {
      await this.evictEntries(Math.floor(this.config.maxEntries * 0.1)); // Evict 10%
    }

    // Size-based eviction would require tracking total size
    // This is simplified - real implementation would track cumulative size
  }

  /**
   * Evict entries based on invalidation strategy
   */
  private async evictEntries(count: number): Promise<void> {
    const keys = await this.config.storage.keys();
    const entries: Array<{ key: string; entry: CacheEntry }> = [];

    // Load entries for eviction analysis
    for (const key of keys) {
      const entry = await this.config.storage.get(key);
      if (entry) {
        entries.push({ key, entry });
      }
    }

    // Sort entries based on eviction strategy
    let sortedEntries: Array<{ key: string; entry: CacheEntry }>;

    switch (this.config.invalidationStrategy) {
      case InvalidationStrategy.LRU:
        sortedEntries = entries.sort((a, b) => a.entry.metadata.lastAccessed - b.entry.metadata.lastAccessed);
        break;
      case InvalidationStrategy.LFU:
        sortedEntries = entries.sort((a, b) => a.entry.metadata.accessCount - b.entry.metadata.accessCount);
        break;
      case InvalidationStrategy.FIFO:
        sortedEntries = entries.sort((a, b) => a.entry.metadata.createdAt - b.entry.metadata.createdAt);
        break;
      case InvalidationStrategy.TTL:
        sortedEntries = entries.sort((a, b) => a.entry.metadata.expiresAt - b.entry.metadata.expiresAt);
        break;
      default:
        sortedEntries = entries;
        break;
    }

    // Evict oldest/least used entries
    for (let i = 0; i < Math.min(count, sortedEntries.length); i++) {
      await this.config.storage.delete(sortedEntries[i].key);
      this.stats.evictions++;
    }
  }

  /**
   * Update cache statistics
   */
  private async updateStats(): Promise<void> {
    this.stats.currentEntries = await this.config.storage.size();
    this.updateHitRatio();

    // Calculate average age
    const keys = await this.config.storage.keys();
    let totalAge = 0;
    let validEntries = 0;

    for (const key of keys) {
      const entry = await this.config.storage.get(key);
      if (entry) {
        totalAge += Date.now() - entry.metadata.createdAt;
        validEntries++;
      }
    }

    this.stats.averageAge = validEntries > 0 ? totalAge / validEntries : 0;

    // Update memory usage if available
    if (typeof process !== 'undefined' && process.memoryUsage) {
      const usage = process.memoryUsage();
      this.stats.memoryUsage = {
        used: usage.heapUsed,
        available: usage.heapTotal,
        percentage: (usage.heapUsed / usage.heapTotal) * 100
      };
    }
  }

  /**
   * Update hit ratio
   */
  private updateHitRatio(): void {
    this.stats.hitRatio = this.stats.totalRequests > 0 
      ? (this.stats.hits / this.stats.totalRequests) * 100 
      : 0;
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    return { ...this.stats };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      hits: 0,
      misses: 0,
      hitRatio: 0,
      totalRequests: 0,
      currentSize: 0,
      currentEntries: 0,
      evictions: 0,
      averageAge: 0,
      memoryUsage: {
        used: 0,
        available: 0,
        percentage: 0
      }
    };
  }

  /**
   * Clear all cached entries
   */
  async clear(): Promise<void> {
    await this.config.storage.clear();
    await this.updateStats();
  }

  /**
   * Get all cache keys
   */
  async getKeys(): Promise<string[]> {
    return this.config.storage.keys();
  }

  /**
   * Check if key is cached
   */
  async has(key: string): Promise<boolean> {
    return this.config.storage.has(key);
  }
}

/**
 * Default cache key generator
 */
export function defaultCacheKeyGenerator(config: fluxhttpRequestConfig): string {
  const parts = [
    config.method || 'GET',
    config.url || '',
    JSON.stringify(config.params || {}),
    JSON.stringify(config.data || {})
  ];
  
  return btoa(parts.join('|')).replace(/[+/=]/g, '');
}

/**
 * Create default advanced cache configuration
 */
export function createDefaultAdvancedCacheConfig(): AdvancedCacheConfig {
  return {
    storage: new MemoryCacheStorage(),
    defaultTtl: 300000, // 5 minutes
    maxSize: 50 * 1024 * 1024, // 50MB
    maxEntries: 1000,
    invalidationStrategy: InvalidationStrategy.LRU,
    staleWhileRevalidate: true,
    staleTimeout: 60000, // 1 minute
    keyGenerator: defaultCacheKeyGenerator,
    excludeHeaders: ['set-cookie', 'date', 'server'],
    validationHeaders: ['etag', 'last-modified', 'cache-control'],
    compress: false,
    warming: {
      enabled: false,
      urls: [],
      interval: 300000 // 5 minutes
    }
  };
}

export default AdvancedHttpCache;