/**
 * @module @fluxhttp/core
 * @description Zero-dependency, lightweight HTTP client for JavaScript/TypeScript applications
 *
 * @example
 * ```typescript
 * import fluxhttp from '@fluxhttp/core';
 *
 * // Simple GET request
 * const response = await fluxhttp.get('https://api.example.com/data');
 *
 * // POST with data
 * const result = await fluxhttp.post('/api/users', {
 *   name: 'John Doe',
 *   email: 'john@example.com'
 * });
 *
 * // Create instance with custom config
 * const api = fluxhttp.create({
 *   baseURL: 'https://api.example.com',
 *   timeout: 5000,
 *   headers: {
 *     'Authorization': 'Bearer token'
 *   }
 * });
 * ```
 */

import { createfluxhttpInstance, defaults } from './core';

/**
 * Default fluxhttp instance with standard configuration
 * @const {fluxhttpInstance}
 */
const fluxhttp = createfluxhttpInstance(defaults);

export default fluxhttp;

export * from './types';
export { fluxhttpError } from './errors';
export { CancelToken, CancelTokenSource, type Cancel, type Canceler } from './core/canceltoken';
export {
  SecurityManager,
  defaultSecurity,
  createSecurityConfig,
  type SecurityConfig,
} from './core/security';
export {
  securityRequestInterceptor,
  securityResponseInterceptor,
  createSecurityRequestInterceptor,
  createSecurityResponseInterceptor,
} from './interceptors/security';
export {
  CacheManager,
  defaultCacheManager,
  createCacheConfig,
  MemoryCacheStorage,
  LocalStorageCacheStorage,
  SessionStorageCacheStorage,
  CacheApiStorage,
  type CacheStorage,
  type CacheEntry,
} from './core/cache';
export {
  cacheRequestInterceptor,
  cacheResponseInterceptor,
  cacheInvalidationInterceptor,
  createCacheRequestInterceptor,
  createCacheResponseInterceptor,
  createCacheInvalidationInterceptor,
} from './interceptors/cache';

/**
 * Create a new fluxhttp instance with custom configuration
 * @function create
 * @param {fluxhttpRequestConfig} [config] - Configuration for the new instance
 * @returns {fluxhttpInstance} New fluxhttp instance
 * @example
 * ```typescript
 * const customClient = create({
 *   baseURL: 'https://api.example.com',
 *   timeout: 10000
 * });
 * ```
 */
export const create = fluxhttp.create.bind(fluxhttp);

/**
 * Check if a value is a cancellation error
 * @function isCancel
 * @param {unknown} value - Value to check
 * @returns {boolean} True if the value is a cancellation error
 * @example
 * ```typescript
 * try {
 *   const response = await fluxhttp.get('/api/data', {
 *     cancelToken: source.token
 *   });
 * } catch (error) {
 *   if (isCancel(error)) {
 *     console.log('Request was cancelled');
 *   }
 * }
 * ```
 */
export const isCancel = fluxhttp.isCancel.bind(fluxhttp);

/**
 * Helper for handling multiple concurrent requests
 * @function all
 * @param {Array<Promise>} promises - Array of promises to resolve
 * @returns {Promise<Array>} Promise that resolves when all input promises resolve
 * @example
 * ```typescript
 * const [users, posts] = await all([
 *   fluxhttp.get('/api/users'),
 *   fluxhttp.get('/api/posts')
 * ]);
 * ```
 */
export const all = fluxhttp.all.bind(fluxhttp);

/**
 * Helper for spreading array arguments to a function
 * @function spread
 * @param {Function} callback - Function to call with spread arguments
 * @returns {Function} Function that accepts an array and spreads it as arguments
 * @example
 * ```typescript
 * const sumAll = spread((a, b, c) => a + b + c);
 * sumAll([1, 2, 3]); // Returns 6
 * ```
 */
export const spread = fluxhttp.spread.bind(fluxhttp);

/**
 * Check if an error is a fluxhttpError instance
 * @function isfluxhttpError
 * @param {unknown} error - Error to check
 * @returns {boolean} True if the error is a fluxhttpError
 * @example
 * ```typescript
 * try {
 *   await fluxhttp.get('/api/data');
 * } catch (error) {
 *   if (isfluxhttpError(error)) {
 *     console.log('HTTP Error:', error.response?.status);
 *   }
 * }
 * ```
 */
export const isfluxhttpError = fluxhttp.isfluxhttpError.bind(fluxhttp);
