/**
 * @fileoverview Plugin cache implementation
 * @module @fluxhttp/plugins/core/cache
 */

import type { PluginCache as IPluginCache } from '../types';

/**
 * Cache configuration
 */
export interface PluginCacheConfig {
  enabled?: boolean;
  maxSize?: number;
  defaultTtl?: number;
  checkInterval?: number;
  namespace?: string;
}

/**
 * Cache entry
 */
interface CacheEntry<T = unknown> {
  value: T;
  expires: number;
  created: number;
  accessed: number;
  hits: number;
}

/**
 * Cache statistics
 */
interface CacheStats {
  size: number;
  maxSize: number;
  hits: number;
  misses: number;
  evictions: number;
  hitRate: number;
  enabled: boolean;
}

/**
 * Plugin cache implementation using LRU eviction strategy
 */
export class PluginCache implements IPluginCache {
  private readonly config: Required<PluginCacheConfig>;
  private readonly cache = new Map<string, CacheEntry>();
  private readonly accessOrder: string[] = [];
  private stats = {
    hits: 0,
    misses: 0,
    evictions: 0
  };
  private cleanupTimer?: NodeJS.Timeout;

  constructor(config: PluginCacheConfig = {}) {
    this.config = {
      enabled: true,
      maxSize: 1000,
      defaultTtl: 3600000, // 1 hour
      checkInterval: 300000, // 5 minutes
      namespace: 'default',
      ...config
    };

    if (this.config.enabled && this.config.checkInterval > 0) {
      this.startCleanupTimer();
    }
  }

  /**
   * Get value from cache
   */
  async get<T = unknown>(key: string): Promise<T | undefined> {
    if (!this.config.enabled) {
      return undefined;
    }

    const fullKey = this.getFullKey(key);
    const entry = this.cache.get(fullKey);

    if (!entry) {
      this.stats.misses++;
      return undefined;
    }

    // Check if expired
    if (Date.now() > entry.expires) {
      this.cache.delete(fullKey);
      this.removeFromAccessOrder(fullKey);
      this.stats.misses++;
      return undefined;
    }

    // Update access info
    entry.accessed = Date.now();
    entry.hits++;
    this.updateAccessOrder(fullKey);
    this.stats.hits++;

    return entry.value as T;
  }

  /**
   * Set value in cache
   */
  async set<T = unknown>(key: string, value: T, ttl?: number): Promise<void> {
    if (!this.config.enabled) {
      return;
    }

    const fullKey = this.getFullKey(key);
    const now = Date.now();
    const expires = now + (ttl || this.config.defaultTtl);

    // Check if we need to evict entries
    if (!this.cache.has(fullKey) && this.cache.size >= this.config.maxSize) {
      this.evictLeastRecentlyUsed();
    }

    const entry: CacheEntry<T> = {
      value,
      expires,
      created: now,
      accessed: now,
      hits: 0
    };

    this.cache.set(fullKey, entry);
    this.updateAccessOrder(fullKey);
  }

  /**
   * Delete value from cache
   */
  async delete(key: string): Promise<boolean> {
    if (!this.config.enabled) {
      return false;
    }

    const fullKey = this.getFullKey(key);
    const deleted = this.cache.delete(fullKey);
    
    if (deleted) {
      this.removeFromAccessOrder(fullKey);
    }
    
    return deleted;
  }

  /**
   * Check if key exists in cache
   */
  async has(key: string): Promise<boolean> {
    if (!this.config.enabled) {
      return false;
    }

    const fullKey = this.getFullKey(key);
    const entry = this.cache.get(fullKey);

    if (!entry) {
      return false;
    }

    // Check if expired
    if (Date.now() > entry.expires) {
      this.cache.delete(fullKey);
      this.removeFromAccessOrder(fullKey);
      return false;
    }

    return true;
  }

  /**
   * Clear all cache entries
   */
  async clear(): Promise<void> {
    this.cache.clear();
    this.accessOrder.length = 0;
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0
    };
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<Record<string, unknown>> {
    const totalRequests = this.stats.hits + this.stats.misses;
    const hitRate = totalRequests > 0 ? this.stats.hits / totalRequests : 0;

    const stats: CacheStats = {
      size: this.cache.size,
      maxSize: this.config.maxSize,
      hits: this.stats.hits,
      misses: this.stats.misses,
      evictions: this.stats.evictions,
      hitRate: Math.round(hitRate * 100) / 100,
      enabled: this.config.enabled
    };

    // Add detailed entry information
    const entries: Record<string, any> = {};
    for (const [key, entry] of this.cache) {
      entries[key] = {
        created: new Date(entry.created).toISOString(),
        expires: new Date(entry.expires).toISOString(),
        accessed: new Date(entry.accessed).toISOString(),
        hits: entry.hits,
        ttl: entry.expires - Date.now()
      };
    }

    return {
      ...stats,
      entries,
      config: this.config
    };
  }

  /**
   * Create child cache with namespace
   */
  child(namespace: string): PluginCache {
    const childConfig = {
      ...this.config,
      namespace: `${this.config.namespace}.${namespace}`
    };
    return new PluginCache(childConfig);
  }

  /**
   * Cleanup expired entries
   */
  cleanup(): void {
    const now = Date.now();
    const toDelete: string[] = [];

    for (const [key, entry] of this.cache) {
      if (now > entry.expires) {
        toDelete.push(key);
      }
    }

    for (const key of toDelete) {
      this.cache.delete(key);
      this.removeFromAccessOrder(key);
    }
  }

  /**
   * Dispose cache
   */
  async dispose(): Promise<void> {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }
    
    await this.clear();
  }

  // Private methods

  /**
   * Get full cache key with namespace
   */
  private getFullKey(key: string): string {
    return `${this.config.namespace}:${key}`;
  }

  /**
   * Update access order for LRU eviction
   */
  private updateAccessOrder(key: string): void {
    // Remove from current position
    this.removeFromAccessOrder(key);
    
    // Add to end (most recently used)
    this.accessOrder.push(key);
  }

  /**
   * Remove key from access order
   */
  private removeFromAccessOrder(key: string): void {
    const index = this.accessOrder.indexOf(key);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
    }
  }

  /**
   * Evict least recently used entry
   */
  private evictLeastRecentlyUsed(): void {
    if (this.accessOrder.length === 0) {
      return;
    }

    const lruKey = this.accessOrder[0];
    this.cache.delete(lruKey);
    this.removeFromAccessOrder(lruKey);
    this.stats.evictions++;
  }

  /**
   * Start cleanup timer
   */
  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.config.checkInterval);

    // Don't prevent process exit
    if (this.cleanupTimer.unref) {
      this.cleanupTimer.unref();
    }
  }
}