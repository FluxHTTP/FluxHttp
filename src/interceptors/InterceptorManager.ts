import type { InterceptorManager as IInterceptorManager, InterceptorOptions } from '../types';

/**
 * Internal interceptor structure
 * @interface Interceptor
 * @template T - Value type (request config or response)
 * @internal
 */
interface Interceptor<T> {
  /** Success handler */
  fulfilled?: (value: T) => T | Promise<T>;
  /** Error handler */
  rejected?: (error: unknown) => unknown;
  /** Interceptor options */
  options?: InterceptorOptions;
}

/**
 * Manages request/response interceptors
 * @class InterceptorManager
 * @template T - Type of value being intercepted (request config or response)
 * @implements {IInterceptorManager<T>}
 * @description Provides a way to register, remove, and iterate through interceptors
 *
 * @example
 * ```typescript
 * // Request interceptor
 * const requestId = client.interceptors.request.use(
 *   config => {
 *     config.headers['Authorization'] = 'Bearer token';
 *     return config;
 *   },
 *   error => Promise.reject(error)
 * );
 *
 * // Response interceptor
 * const responseId = client.interceptors.response.use(
 *   response => response,
 *   error => {
 *     if (error.response?.status === 401) {
 *       // Handle unauthorized
 *     }
 *     return Promise.reject(error);
 *   }
 * );
 *
 * // Remove interceptor
 * client.interceptors.request.eject(requestId);
 * ```
 */
export class InterceptorManager<T> implements IInterceptorManager<T> {
  /** Map of interceptor ID to interceptor */
  private interceptors: Map<number, Interceptor<T>> = new Map();
  /** Counter for generating unique IDs */
  private currentId = 0;

  /**
   * Register a new interceptor
   * @param {Function} [onFulfilled] - Success handler
   * @param {Function} [onRejected] - Error handler
   * @param {InterceptorOptions} [options] - Interceptor options
   * @returns {number} Unique interceptor ID for removal
   * @example
   * ```typescript
   * const id = interceptors.use(
   *   value => {
   *     console.log('Success:', value);
   *     return value;
   *   },
   *   error => {
   *     console.error('Error:', error);
   *     return Promise.reject(error);
   *   },
   *   { synchronous: true }
   * );
   * ```
   */
  use(
    onFulfilled?: (value: T) => T | Promise<T>,
    onRejected?: (error: unknown) => unknown,
    options?: InterceptorOptions
  ): number {
    const id = this.currentId++;
    this.interceptors.set(id, {
      fulfilled: onFulfilled,
      rejected: onRejected,
      options,
    });
    return id;
  }

  /**
   * Remove an interceptor by ID
   * @param {number} id - Interceptor ID returned by use()
   * @returns {void}
   * @example
   * ```typescript
   * const id = interceptors.use(handler);
   * // Later...
   * interceptors.eject(id);
   * ```
   */
  eject(id: number): void {
    this.interceptors.delete(id);
  }

  /**
   * Remove all interceptors
   * @returns {void}
   * @example
   * ```typescript
   * interceptors.clear();
   * ```
   */
  clear(): void {
    this.interceptors.clear();
  }

  /**
   * Iterate through all interceptors
   * @param {Function} callback - Function to call for each interceptor
   * @returns {void}
   * @internal
   */
  forEach(callback: (interceptor: Interceptor<T>) => void): void {
    this.interceptors.forEach((interceptor) => {
      if (interceptor !== null) {
        callback(interceptor);
      }
    });
  }

  /**
   * Make interceptor manager iterable
   * @yields {Interceptor<T>} Each registered interceptor
   * @internal
   */
  *[Symbol.iterator](): IterableIterator<Interceptor<T>> {
    for (const interceptor of Array.from(this.interceptors.values())) {
      yield interceptor;
    }
  }

  /**
   * Get number of registered interceptors
   * @returns {number} Count of interceptors
   */
  get size(): number {
    return this.interceptors.size;
  }
}
