// CACHE: Cache interceptors for request/response pipeline

import type { fluxhttpRequestConfig, fluxhttpResponse } from '../types';
import type { CacheManager } from '../core/cache';
import { defaultCacheManager } from '../core/cache';

/**
 * Create cache request interceptor
 * Checks cache before making HTTP request
 */
export function createCacheRequestInterceptor(
  manager: CacheManager = defaultCacheManager
): (config: fluxhttpRequestConfig) => Promise<fluxhttpRequestConfig | fluxhttpResponse> {
  return async function cacheRequestInterceptor(
    config: fluxhttpRequestConfig
  ): Promise<fluxhttpRequestConfig | fluxhttpResponse> {
    // If cache is not enabled, proceed with request
    if (!config.cache?.enabled) {
      return config;
    }

    try {
      // Try to get cached response
      const cachedResponse = await manager.get(config, config.cache);

      if (cachedResponse) {
        // Return cached response, bypassing actual HTTP request
        return cachedResponse;
      }
    } catch (error) {
      // Cache error should not prevent request
      console.warn('Cache read error:', error);
    }

    // No cached response found, proceed with request
    return config;
  };
}

/**
 * Create cache response interceptor
 * Stores responses in cache after successful requests
 */
export function createCacheResponseInterceptor(
  manager: CacheManager = defaultCacheManager
): (response: fluxhttpResponse) => Promise<fluxhttpResponse> {
  return async function cacheResponseInterceptor(
    response: fluxhttpResponse
  ): Promise<fluxhttpResponse> {
    // If cache is not enabled, return response as-is
    if (!response.config.cache?.enabled) {
      return response;
    }

    try {
      // Store response in cache
      await manager.set(response.config, response, response.config.cache);
    } catch (error) {
      // Cache error should not affect response
      console.warn('Cache write error:', error);
    }

    return response;
  };
}

/**
 * Cache invalidation interceptor
 * Clears cache entries on non-safe HTTP methods
 */
export function createCacheInvalidationInterceptor(
  manager: CacheManager = defaultCacheManager
): (config: fluxhttpRequestConfig) => fluxhttpRequestConfig {
  return function cacheInvalidationInterceptor(
    config: fluxhttpRequestConfig
  ): fluxhttpRequestConfig {
    if (!config.cache?.enabled) {
      return config;
    }

    const method = (config.method || 'GET').toUpperCase();
    const invalidatingMethods = ['POST', 'PUT', 'PATCH', 'DELETE'];

    if (invalidatingMethods.includes(method)) {
      // Invalidate cache asynchronously (don't block request)
      manager.delete(config, config.cache).catch((error) => {
        console.warn('Cache invalidation error:', error);
      });

      // For more aggressive invalidation, could clear entire cache:
      // manager.clear().catch(error => console.warn('Cache clear error:', error));
    }

    return config;
  };
}

// Default interceptors using the global cache manager
export const cacheRequestInterceptor = createCacheRequestInterceptor();
export const cacheResponseInterceptor = createCacheResponseInterceptor();
export const cacheInvalidationInterceptor = createCacheInvalidationInterceptor();
