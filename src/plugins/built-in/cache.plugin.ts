/**
 * @fileoverview Advanced caching plugin for FluxHTTP
 * @module @fluxhttp/plugins/built-in/cache
 */

import type {
  Plugin,
  PluginConfig,
  PluginContext,
  PluginMetadata,
  PluginConfigSchema,
  fluxhttpRequestConfig,
  fluxhttpResponse
} from '../types';
import { PluginLifecycleState, PluginType, PluginPriority } from '../types';

/**
 * Cache strategies
 */
export type CacheStrategy = 'cache-first' | 'network-first' | 'cache-only' | 'network-only' | 'stale-while-revalidate';

/**
 * Cache storage backends
 */
export type CacheStorage = 'memory' | 'localStorage' | 'sessionStorage' | 'indexedDB' | 'custom';

/**
 * Cache configuration
 */
export interface CachePluginConfig extends PluginConfig {
  settings: {
    /** Cache strategy */
    strategy?: CacheStrategy;
    /** Default TTL in milliseconds */
    defaultTtl?: number;
    /** Maximum cache size (number of entries) */
    maxSize?: number;
    /** Cache storage backend */
    storage?: CacheStorage;
    /** Cache key generator function */
    keyGenerator?: (config: fluxhttpRequestConfig) => string;
    /** Cache validation function */
    shouldCache?: (config: fluxhttpRequestConfig, response?: fluxhttpResponse) => boolean;
    /** Custom storage implementation */
    customStorage?: CacheStorageInterface;
    /** Headers to exclude from cache key */
    excludeHeaders?: string[];
    /** Headers to include in cache key */
    includeHeaders?: string[];
    /** Cache invalidation patterns */
    invalidationPatterns?: string[];
    /** Vary headers for cache invalidation */
    varyHeaders?: string[];
    /** Compression enabled */
    compression?: boolean;
    /** Encryption enabled */
    encryption?: boolean;
    /** Cache warming URLs */
    warmupUrls?: string[];
    /** Background refresh enabled */
    backgroundRefresh?: boolean;
    /** Stale time in milliseconds */
    staleTime?: number;
    /** Cache metrics enabled */
    metricsEnabled?: boolean;
  };
}

/**
 * Cache entry interface
 */
interface CacheEntry {
  /** Cached response data */
  data: unknown;
  /** Response headers */
  headers: Record<string, string>;
  /** Response status */
  status: number;
  /** Response status text */
  statusText: string;
  /** Cache timestamp */
  timestamp: number;
  /** Entry expiry timestamp */
  expires: number;
  /** Entry TTL in milliseconds */
  ttl: number;
  /** Request configuration hash */
  configHash: string;
  /** Entry tags for invalidation */
  tags: string[];
  /** Entry access count */
  accessCount: number;
  /** Last access timestamp */
  lastAccess: number;
  /** Entry size in bytes */
  size: number;
}

/**
 * Cache statistics
 */
interface CacheStats {
  /** Total cache hits */
  hits: number;
  /** Total cache misses */
  misses: number;
  /** Total cache writes */
  writes: number;
  /** Total cache invalidations */
  invalidations: number;
  /** Current cache size */
  size: number;
  /** Maximum cache size */
  maxSize: number;
  /** Hit rate percentage */
  hitRate: number;
  /** Total cached data size in bytes */
  totalSize: number;
}

/**
 * Custom cache storage interface
 */
export interface CacheStorageInterface {
  get(key: string): Promise<CacheEntry | null>;
  set(key: string, entry: CacheEntry): Promise<void>;
  delete(key: string): Promise<boolean>;
  clear(): Promise<void>;
  keys(): Promise<string[]>;
  size(): Promise<number>;
}

/**
 * Advanced caching plugin implementation
 */
export class CachePlugin implements Plugin {
  readonly metadata: PluginMetadata = {
    id: 'cache',
    name: 'Advanced Cache Plugin',
    version: '1.0.0',
    type: PluginType.CACHE,
    description: 'Provides advanced HTTP response caching with multiple strategies and storage backends',
    author: {
      name: 'FluxHTTP Team',
      email: 'team@fluxhttp.dev'
    },
    license: 'MIT',
    keywords: ['cache', 'caching', 'performance', 'storage', 'optimization'],
    capabilities: {
      canModifyRequest: true,
      canModifyResponse: true,
      canCache: true
    },
    priority: PluginPriority.NORMAL
  };

  readonly configSchema: PluginConfigSchema = {
    type: 'object',
    properties: {
      enabled: { type: 'boolean', default: true },
      settings: {
        type: 'object',
        properties: {
          strategy: {
            type: 'string',
            enum: ['cache-first', 'network-first', 'cache-only', 'network-only', 'stale-while-revalidate'],
            default: 'cache-first'
          },
          defaultTtl: { type: 'number', default: 300000, description: 'Default TTL in milliseconds' },
          maxSize: { type: 'number', default: 1000, description: 'Maximum cache size' },
          storage: {
            type: 'string',
            enum: ['memory', 'localStorage', 'sessionStorage', 'indexedDB', 'custom'],
            default: 'memory'
          },
          excludeHeaders: {
            type: 'array',
            items: { type: 'string' },
            default: ['authorization', 'cookie', 'set-cookie'],
            description: 'Headers to exclude from cache key'
          },
          compression: { type: 'boolean', default: false },
          encryption: { type: 'boolean', default: false },
          backgroundRefresh: { type: 'boolean', default: true },
          staleTime: { type: 'number', default: 60000 },
          metricsEnabled: { type: 'boolean', default: true }
        }
      }
    }
  };

  state = PluginLifecycleState.UNINITIALIZED;
  config: CachePluginConfig;
  context?: PluginContext;

  private storage?: CacheStorageInterface;
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    writes: 0,
    invalidations: 0,
    size: 0,
    maxSize: 1000,
    hitRate: 0,
    totalSize: 0
  };

  private backgroundTasks = new Set<Promise<void>>();

  constructor(config: Partial<CachePluginConfig> = {}) {
    this.config = {
      enabled: true,
      settings: {
        strategy: 'cache-first',
        defaultTtl: 300000, // 5 minutes
        maxSize: 1000,
        storage: 'memory',
        excludeHeaders: ['authorization', 'cookie', 'set-cookie'],
        compression: false,
        encryption: false,
        backgroundRefresh: true,
        staleTime: 60000, // 1 minute
        metricsEnabled: true,
        ...config.settings
      },
      ...config
    } as CachePluginConfig;

    this.stats.maxSize = this.config.settings.maxSize || 1000;
  }

  /**
   * Initialize plugin
   */
  async init(context: PluginContext): Promise<void> {
    this.context = context;
    
    // Initialize storage backend
    await this.initializeStorage();
    
    // Register interceptors
    this.interceptRequest(this.handleCacheRequest.bind(this));
    this.interceptResponse(this.handleCacheResponse.bind(this));
    
    // Warm up cache if configured
    if (this.config.settings.warmupUrls?.length) {
      this.warmupCache();
    }
    
    context.logger.info('Cache plugin initialized', {
      strategy: this.config.settings.strategy,
      storage: this.config.settings.storage,
      maxSize: this.config.settings.maxSize
    });
  }

  /**
   * Stop plugin
   */
  async stop(context: PluginContext): Promise<void> {
    // Wait for background tasks to complete
    await Promise.allSettled(this.backgroundTasks);
    this.backgroundTasks.clear();
    
    context.logger.info('Cache plugin stopped');
  }

  /**
   * Initialize storage backend
   */
  private async initializeStorage(): Promise<void> {
    const storageType = this.config.settings.storage;
    
    switch (storageType) {
      case 'memory':
        this.storage = new MemoryCacheStorage(this.config.settings.maxSize);
        break;
      
      case 'localStorage':
        this.storage = new BrowserCacheStorage('localStorage');
        break;
      
      case 'sessionStorage':
        this.storage = new BrowserCacheStorage('sessionStorage');
        break;
      
      case 'indexedDB':
        this.storage = new IndexedDBCacheStorage();
        break;
      
      case 'custom':
        if (!this.config.settings.customStorage) {
          throw new Error('Custom storage implementation is required');
        }
        this.storage = this.config.settings.customStorage;
        break;
      
      default:
        throw new Error(`Unsupported storage type: ${storageType}`);
    }
  }

  /**
   * Register request interceptor
   */
  interceptRequest(interceptor: (config: fluxhttpRequestConfig, context: PluginContext) => Promise<fluxhttpRequestConfig> | fluxhttpRequestConfig): void {
    if (this.context?.fluxhttp.interceptors.request) {
      this.context.fluxhttp.interceptors.request.use(
        (config) => interceptor(config, this.context!),
        undefined,
        { runWhen: () => this.config.enabled }
      );
    }
  }

  /**
   * Register response interceptor
   */
  interceptResponse(interceptor: (response: fluxhttpResponse, context: PluginContext) => Promise<fluxhttpResponse> | fluxhttpResponse): void {
    if (this.context?.fluxhttp.interceptors.response) {
      this.context.fluxhttp.interceptors.response.use(
        (response) => interceptor(response, this.context!),
        undefined,
        { runWhen: () => this.config.enabled }
      );
    }
  }

  /**
   * Handle cache request
   */
  private async handleCacheRequest(config: fluxhttpRequestConfig): Promise<fluxhttpRequestConfig> {
    if (!this.shouldCacheRequest(config)) {
      return config;
    }

    const cacheKey = this.generateCacheKey(config);
    const strategy = this.config.settings.strategy || 'cache-first';

    try {
      switch (strategy) {
        case 'cache-first':
          return await this.handleCacheFirst(config, cacheKey);
        
        case 'network-first':
          return await this.handleNetworkFirst(config, cacheKey);
        
        case 'cache-only':
          return await this.handleCacheOnly(config, cacheKey);
        
        case 'network-only':
          return config; // No caching, just pass through
        
        case 'stale-while-revalidate':
          return await this.handleStaleWhileRevalidate(config, cacheKey);
        
        default:
          return config;
      }
    } catch (error) {
      this.context?.logger.error('Cache request handling failed', { error, cacheKey });
      return config;
    }
  }

  /**
   * Handle cache response
   */
  private async handleCacheResponse(response: fluxhttpResponse): Promise<fluxhttpResponse> {
    if (!this.shouldCacheResponse(response.config, response)) {
      return response;
    }

    const cacheKey = this.generateCacheKey(response.config);
    
    try {
      await this.setCacheEntry(cacheKey, response);
      
      if (this.config.settings.metricsEnabled) {
        this.stats.writes++;
        this.updateMetrics();
      }
    } catch (error) {
      this.context?.logger.error('Cache response handling failed', { error, cacheKey });
    }

    return response;
  }

  /**
   * Handle cache-first strategy
   */
  private async handleCacheFirst(config: fluxhttpRequestConfig, cacheKey: string): Promise<fluxhttpRequestConfig> {
    const cached = await this.getCacheEntry(cacheKey);
    
    if (cached && !this.isExpired(cached)) {
      // Return cached response
      this.updateStats('hit');
      throw new CachedResponse(cached);
    }
    
    this.updateStats('miss');
    return config;
  }

  /**
   * Handle network-first strategy
   */
  private async handleNetworkFirst(config: fluxhttpRequestConfig, cacheKey: string): Promise<fluxhttpRequestConfig> {
    // Always try network first, fallback to cache on failure
    const cached = await this.getCacheEntry(cacheKey);
    
    if (cached) {
      // Store cached response as fallback
      config._cacheEntry = cached;
    }
    
    return config;
  }

  /**
   * Handle cache-only strategy
   */
  private async handleCacheOnly(config: fluxhttpRequestConfig, cacheKey: string): Promise<fluxhttpRequestConfig> {
    const cached = await this.getCacheEntry(cacheKey);
    
    if (cached && !this.isExpired(cached)) {
      this.updateStats('hit');
      throw new CachedResponse(cached);
    }
    
    this.updateStats('miss');
    throw new Error('No cached response available for cache-only strategy');
  }

  /**
   * Handle stale-while-revalidate strategy
   */
  private async handleStaleWhileRevalidate(config: fluxhttpRequestConfig, cacheKey: string): Promise<fluxhttpRequestConfig> {
    const cached = await this.getCacheEntry(cacheKey);
    
    if (cached) {
      const isStale = this.isStale(cached);
      
      if (isStale && this.config.settings.backgroundRefresh) {
        // Return stale data and refresh in background
        this.backgroundRefresh(config, cacheKey);
        this.updateStats('hit');
        throw new CachedResponse(cached);
      } else if (!this.isExpired(cached)) {
        // Return fresh cached data
        this.updateStats('hit');
        throw new CachedResponse(cached);
      }
    }
    
    this.updateStats('miss');
    return config;
  }

  /**
   * Background refresh for stale-while-revalidate
   */
  private backgroundRefresh(config: fluxhttpRequestConfig, cacheKey: string): void {
    const refreshTask = this.performBackgroundRefresh(config, cacheKey);
    this.backgroundTasks.add(refreshTask);
    
    refreshTask.finally(() => {
      this.backgroundTasks.delete(refreshTask);
    });
  }

  /**
   * Perform background refresh
   */
  private async performBackgroundRefresh(config: fluxhttpRequestConfig, cacheKey: string): Promise<void> {
    try {
      // Create a new request without cache headers
      const refreshConfig = { ...config };
      delete refreshConfig._cacheEntry;
      
      // In a real implementation, you would make the request here
      // For now, we'll just log the intention
      this.context?.logger.debug('Background refresh started', { cacheKey });
      
    } catch (error) {
      this.context?.logger.error('Background refresh failed', { error, cacheKey });
    }
  }

  /**
   * Generate cache key for request
   */
  private generateCacheKey(config: fluxhttpRequestConfig): string {
    if (this.config.settings.keyGenerator) {
      return this.config.settings.keyGenerator(config);
    }

    const keyParts = [
      config.method?.toUpperCase() || 'GET',
      config.url || '',
      this.serializeParams(config.params),
      this.serializeHeaders(config.headers)
    ];

    const key = keyParts.join('|');
    return this.hashString(key);
  }

  /**
   * Serialize query parameters for cache key
   */
  private serializeParams(params?: Record<string, unknown>): string {
    if (!params) return '';
    
    const sortedParams = Object.keys(params)
      .sort()
      .map(key => `${key}=${params[key]}`)
      .join('&');
    
    return sortedParams;
  }

  /**
   * Serialize headers for cache key
   */
  private serializeHeaders(headers?: Record<string, string | string[]>): string {
    if (!headers) return '';
    
    const excludeHeaders = this.config.settings.excludeHeaders || [];
    const includeHeaders = this.config.settings.includeHeaders;
    
    let relevantHeaders: Record<string, string | string[]> = {};
    
    if (includeHeaders?.length) {
      // Only include specified headers
      for (const header of includeHeaders) {
        if (headers[header] !== undefined) {
          relevantHeaders[header] = headers[header];
        }
      }
    } else {
      // Include all headers except excluded ones
      relevantHeaders = { ...headers };
      for (const header of excludeHeaders) {
        delete relevantHeaders[header];
      }
    }
    
    const sortedHeaders = Object.keys(relevantHeaders)
      .sort()
      .map(key => `${key}=${relevantHeaders[key]}`)
      .join('&');
    
    return sortedHeaders;
  }

  /**
   * Hash string to generate cache key
   */
  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Get cache entry
   */
  private async getCacheEntry(key: string): Promise<CacheEntry | null> {
    if (!this.storage) return null;
    
    const entry = await this.storage.get(key);
    
    if (entry) {
      entry.accessCount++;
      entry.lastAccess = Date.now();
      await this.storage.set(key, entry); // Update access info
    }
    
    return entry;
  }

  /**
   * Set cache entry
   */
  private async setCacheEntry(key: string, response: fluxhttpResponse): Promise<void> {
    if (!this.storage) return;
    
    const ttl = this.getTtl(response);
    const now = Date.now();
    
    const entry: CacheEntry = {
      data: response.data,
      headers: response.headers as Record<string, string>,
      status: response.status,
      statusText: response.statusText,
      timestamp: now,
      expires: now + ttl,
      ttl,
      configHash: this.generateCacheKey(response.config),
      tags: this.extractTags(response),
      accessCount: 0,
      lastAccess: now,
      size: this.calculateSize(response.data)
    };

    // Check if we need to evict entries
    await this.ensureCacheSpace();
    
    await this.storage.set(key, entry);
    this.stats.size = await this.storage.size();
    this.stats.totalSize += entry.size;
  }

  /**
   * Check if entry is expired
   */
  private isExpired(entry: CacheEntry): boolean {
    return Date.now() > entry.expires;
  }

  /**
   * Check if entry is stale
   */
  private isStale(entry: CacheEntry): boolean {
    const staleTime = this.config.settings.staleTime || 60000;
    return Date.now() > (entry.timestamp + staleTime);
  }

  /**
   * Get TTL for response
   */
  private getTtl(response: fluxhttpResponse): number {
    // Check Cache-Control header
    const cacheControl = response.headers['cache-control'] || response.headers['Cache-Control'];
    if (cacheControl) {
      const maxAge = cacheControl.match(/max-age=(\d+)/);
      if (maxAge) {
        return parseInt(maxAge[1]) * 1000;
      }
    }
    
    // Check Expires header
    const expires = response.headers['expires'] || response.headers['Expires'];
    if (expires) {
      const expiresTime = new Date(expires).getTime();
      const now = Date.now();
      if (expiresTime > now) {
        return expiresTime - now;
      }
    }
    
    // Use default TTL
    return this.config.settings.defaultTtl || 300000;
  }

  /**
   * Extract tags from response for cache invalidation
   */
  private extractTags(response: fluxhttpResponse): string[] {
    const tags: string[] = [];
    
    // Extract from custom headers
    const cacheTag = response.headers['cache-tag'] || response.headers['Cache-Tag'];
    if (cacheTag) {
      tags.push(...cacheTag.split(',').map(tag => tag.trim()));
    }
    
    // Extract from URL patterns
    if (response.config.url) {
      const url = new URL(response.config.url, 'http://localhost');
      tags.push(`path:${url.pathname}`);
      
      if (url.searchParams.has('id')) {
        tags.push(`id:${url.searchParams.get('id')}`);
      }
    }
    
    return tags;
  }

  /**
   * Calculate data size in bytes
   */
  private calculateSize(data: unknown): number {
    try {
      return JSON.stringify(data).length * 2; // Rough estimate (UTF-16)
    } catch {
      return 0;
    }
  }

  /**
   * Ensure cache has space for new entries
   */
  private async ensureCacheSpace(): Promise<void> {
    if (!this.storage) return;
    
    const currentSize = await this.storage.size();
    const maxSize = this.config.settings.maxSize || 1000;
    
    if (currentSize >= maxSize) {
      // Implement LRU eviction
      const keys = await this.storage.keys();
      const entries: Array<{ key: string; entry: CacheEntry }> = [];
      
      for (const key of keys) {
        const entry = await this.storage.get(key);
        if (entry) {
          entries.push({ key, entry });
        }
      }
      
      // Sort by last access time (oldest first)
      entries.sort((a, b) => a.entry.lastAccess - b.entry.lastAccess);
      
      // Remove oldest entries
      const toRemove = Math.ceil(maxSize * 0.1); // Remove 10% of cache
      for (let i = 0; i < toRemove && i < entries.length; i++) {
        await this.storage.delete(entries[i].key);
        this.stats.totalSize -= entries[i].entry.size;
        this.stats.invalidations++;
      }
    }
  }

  /**
   * Check if request should be cached
   */
  private shouldCacheRequest(config: fluxhttpRequestConfig): boolean {
    if (this.config.settings.shouldCache) {
      return this.config.settings.shouldCache(config);
    }
    
    // Default caching rules
    const method = config.method?.toUpperCase() || 'GET';
    return ['GET', 'HEAD'].includes(method);
  }

  /**
   * Check if response should be cached
   */
  private shouldCacheResponse(config: fluxhttpRequestConfig, response: fluxhttpResponse): boolean {
    if (this.config.settings.shouldCache) {
      return this.config.settings.shouldCache(config, response);
    }
    
    // Default caching rules
    const status = response.status;
    return status >= 200 && status < 300;
  }

  /**
   * Update cache statistics
   */
  private updateStats(type: 'hit' | 'miss'): void {
    if (!this.config.settings.metricsEnabled) return;
    
    if (type === 'hit') {
      this.stats.hits++;
    } else {
      this.stats.misses++;
    }
    
    this.updateMetrics();
  }

  /**
   * Update metrics
   */
  private updateMetrics(): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? this.stats.hits / total : 0;
    
    if (this.context?.metrics) {
      this.context.metrics.gauge('cache.hit_rate', this.stats.hitRate * 100);
      this.context.metrics.gauge('cache.size', this.stats.size);
      this.context.metrics.gauge('cache.total_size', this.stats.totalSize);
    }
  }

  /**
   * Warm up cache with configured URLs
   */
  private async warmupCache(): Promise<void> {
    const urls = this.config.settings.warmupUrls || [];
    
    for (const url of urls) {
      try {
        // In a real implementation, you would make requests to these URLs
        this.context?.logger.debug('Cache warmup', { url });
      } catch (error) {
        this.context?.logger.error('Cache warmup failed', { url, error });
      }
    }
  }

  /**
   * Invalidate cache by pattern
   */
  async invalidate(pattern: string): Promise<number> {
    if (!this.storage) return 0;
    
    const keys = await this.storage.keys();
    let invalidated = 0;
    
    for (const key of keys) {
      if (key.includes(pattern)) {
        await this.storage.delete(key);
        invalidated++;
      }
    }
    
    this.stats.invalidations += invalidated;
    this.stats.size = await this.storage.size();
    
    return invalidated;
  }

  /**
   * Clear entire cache
   */
  async clear(): Promise<void> {
    if (this.storage) {
      await this.storage.clear();
      this.stats.size = 0;
      this.stats.totalSize = 0;
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    return { ...this.stats };
  }

  /**
   * Get plugin health status
   */
  async getHealth() {
    const status = this.config.enabled ? 'healthy' : 'degraded';
    
    return {
      status,
      timestamp: Date.now(),
      details: {
        enabled: this.config.enabled,
        strategy: this.config.settings.strategy,
        storage: this.config.settings.storage,
        size: this.stats.size,
        maxSize: this.stats.maxSize,
        hitRate: this.stats.hitRate,
        backgroundTasks: this.backgroundTasks.size
      }
    };
  }

  /**
   * Get plugin metrics
   */
  async getMetrics() {
    return {
      ...this.stats,
      strategy: this.config.settings.strategy,
      storage: this.config.settings.storage,
      backgroundTasks: this.backgroundTasks.size
    };
  }
}

/**
 * Cached response class for interrupting request flow
 */
class CachedResponse extends Error {
  constructor(public readonly entry: CacheEntry) {
    super('Cached response available');
    this.name = 'CachedResponse';
  }
}

/**
 * Memory cache storage implementation
 */
class MemoryCacheStorage implements CacheStorageInterface {
  private cache = new Map<string, CacheEntry>();

  constructor(private maxSize: number = 1000) {}

  async get(key: string): Promise<CacheEntry | null> {
    return this.cache.get(key) || null;
  }

  async set(key: string, entry: CacheEntry): Promise<void> {
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
}

/**
 * Browser storage implementation (localStorage/sessionStorage)
 */
class BrowserCacheStorage implements CacheStorageInterface {
  private prefix = 'fluxhttp-cache:';

  constructor(private storageType: 'localStorage' | 'sessionStorage') {}

  private getStorage(): Storage {
    if (typeof window === 'undefined') {
      throw new Error('Browser storage not available');
    }
    return window[this.storageType];
  }

  async get(key: string): Promise<CacheEntry | null> {
    try {
      const storage = this.getStorage();
      const data = storage.getItem(this.prefix + key);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  }

  async set(key: string, entry: CacheEntry): Promise<void> {
    try {
      const storage = this.getStorage();
      storage.setItem(this.prefix + key, JSON.stringify(entry));
    } catch (error) {
      // Handle quota exceeded error
      if (error instanceof Error && error.name === 'QuotaExceededError') {
        // Clear old entries
        await this.cleanup();
        // Try again
        storage.setItem(this.prefix + key, JSON.stringify(entry));
      }
    }
  }

  async delete(key: string): Promise<boolean> {
    try {
      const storage = this.getStorage();
      const exists = storage.getItem(this.prefix + key) !== null;
      storage.removeItem(this.prefix + key);
      return exists;
    } catch {
      return false;
    }
  }

  async clear(): Promise<void> {
    try {
      const storage = this.getStorage();
      const keys = await this.keys();
      for (const key of keys) {
        storage.removeItem(this.prefix + key);
      }
    } catch {
      // Ignore errors
    }
  }

  async keys(): Promise<string[]> {
    try {
      const storage = this.getStorage();
      const keys: string[] = [];
      for (let i = 0; i < storage.length; i++) {
        const key = storage.key(i);
        if (key && key.startsWith(this.prefix)) {
          keys.push(key.substring(this.prefix.length));
        }
      }
      return keys;
    } catch {
      return [];
    }
  }

  async size(): Promise<number> {
    const keys = await this.keys();
    return keys.length;
  }

  private async cleanup(): Promise<void> {
    const keys = await this.keys();
    const entries: Array<{ key: string; entry: CacheEntry }> = [];
    
    for (const key of keys) {
      const entry = await this.get(key);
      if (entry) {
        entries.push({ key, entry });
      }
    }
    
    // Sort by last access time and remove oldest 25%
    entries.sort((a, b) => a.entry.lastAccess - b.entry.lastAccess);
    const toRemove = Math.ceil(entries.length * 0.25);
    
    for (let i = 0; i < toRemove; i++) {
      await this.delete(entries[i].key);
    }
  }
}

/**
 * IndexedDB cache storage implementation
 */
class IndexedDBCacheStorage implements CacheStorageInterface {
  private dbName = 'fluxhttp-cache';
  private storeName = 'cache-entries';
  private version = 1;

  private async getDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
      
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName);
        }
      };
    });
  }

  async get(key: string): Promise<CacheEntry | null> {
    try {
      const db = await this.getDB();
      const transaction = db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      
      return new Promise((resolve, reject) => {
        const request = store.get(key);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result || null);
      });
    } catch {
      return null;
    }
  }

  async set(key: string, entry: CacheEntry): Promise<void> {
    const db = await this.getDB();
    const transaction = db.transaction([this.storeName], 'readwrite');
    const store = transaction.objectStore(this.storeName);
    
    return new Promise((resolve, reject) => {
      const request = store.put(entry, key);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async delete(key: string): Promise<boolean> {
    try {
      const db = await this.getDB();
      const transaction = db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      
      return new Promise((resolve, reject) => {
        const request = store.delete(key);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(true);
      });
    } catch {
      return false;
    }
  }

  async clear(): Promise<void> {
    const db = await this.getDB();
    const transaction = db.transaction([this.storeName], 'readwrite');
    const store = transaction.objectStore(this.storeName);
    
    return new Promise((resolve, reject) => {
      const request = store.clear();
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async keys(): Promise<string[]> {
    try {
      const db = await this.getDB();
      const transaction = db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      
      return new Promise((resolve, reject) => {
        const request = store.getAllKeys();
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result as string[]);
      });
    } catch {
      return [];
    }
  }

  async size(): Promise<number> {
    try {
      const db = await this.getDB();
      const transaction = db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      
      return new Promise((resolve, reject) => {
        const request = store.count();
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
      });
    } catch {
      return 0;
    }
  }
}

/**
 * Cache plugin factory
 */
export function createCachePlugin(config?: Partial<CachePluginConfig>): CachePlugin {
  return new CachePlugin(config);
}