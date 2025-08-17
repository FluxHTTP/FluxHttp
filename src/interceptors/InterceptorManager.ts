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
  /** Creation timestamp for cleanup */
  created: number;
  /** Last used timestamp for LRU eviction */
  lastUsed: number;
  /** Usage count for tracking */
  usageCount: number;
  /** Whether this is a one-time interceptor */
  runOnce?: boolean;
  /** Whether this interceptor has been used once */
  hasRun?: boolean;
}

/**
 * Interceptor cleanup configuration
 * @interface CleanupConfig
 * @internal
 */
interface CleanupConfig {
  /** Maximum number of interceptors per manager */
  maxInterceptors: number;
  /** Maximum age for unused interceptors (ms) */
  maxAge: number;
  /** Cleanup interval (ms) */
  cleanupInterval: number;
  /** Whether to use LRU eviction */
  enableLRU: boolean;
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
  /** Cleanup configuration */
  private cleanupConfig: CleanupConfig;
  /** Cleanup timer */
  private cleanupTimer: NodeJS.Timeout | number | null = null;
  /** Whether the manager has been disposed */
  private disposed = false;
  /** WeakSet for tracking interceptor references */
  private interceptorRefs = new WeakSet<object>();

  constructor(cleanupConfig?: Partial<CleanupConfig>) {
    this.cleanupConfig = {
      maxInterceptors: cleanupConfig?.maxInterceptors ?? 100,
      maxAge: cleanupConfig?.maxAge ?? 300000, // 5 minutes
      cleanupInterval: cleanupConfig?.cleanupInterval ?? 60000, // 1 minute
      enableLRU: cleanupConfig?.enableLRU ?? true,
    };
    
    this.startCleanupTimer();
  }

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
    if (this.disposed) {
      throw new Error('InterceptorManager has been disposed');
    }

    // Check if we need to clean up before adding new interceptor
    if (this.interceptors.size >= this.cleanupConfig.maxInterceptors) {
      this.performLRUEviction();
    }

    const id = this.currentId++;
    const now = Date.now();
    const interceptor: Interceptor<T> = {
      fulfilled: onFulfilled,
      rejected: onRejected,
      options,
      created: now,
      lastUsed: now,
      usageCount: 0,
      runOnce: options?.runOnce,
      hasRun: false,
    };

    this.interceptors.set(id, interceptor);

    // Track interceptor functions for cleanup
    if (onFulfilled && typeof onFulfilled === 'object') {
      this.interceptorRefs.add(onFulfilled);
    }
    if (onRejected && typeof onRejected === 'object') {
      this.interceptorRefs.add(onRejected);
    }

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
    // Clear WeakSet references will be automatically garbage collected
  }

  /**
   * Iterate through all interceptors
   * @param {Function} callback - Function to call for each interceptor
   * @returns {void}
   * @internal
   */
  forEach(callback: (interceptor: Interceptor<T>) => void): void {
    this.interceptors.forEach((interceptor, id) => {
      if (interceptor !== null) {
        // Update usage tracking
        interceptor.lastUsed = Date.now();
        interceptor.usageCount++;
        
        callback(interceptor);
        
        // Check if this is a one-time interceptor that has now run
        if (interceptor.runOnce && !interceptor.hasRun) {
          interceptor.hasRun = true;
          // Schedule for removal after current execution
          setTimeout(() => this.eject(id), 0);
        }
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

  /**
   * Start automatic cleanup timer
   * @private
   */
  private startCleanupTimer(): void {
    if (this.cleanupTimer || this.disposed) {
      return;
    }

    this.cleanupTimer = setInterval(() => {
      this.performCleanup();
    }, this.cleanupConfig.cleanupInterval);
  }

  /**
   * Perform cleanup of old and unused interceptors
   * @private
   */
  private performCleanup(): void {
    if (this.disposed) {
      return;
    }

    const now = Date.now();
    const maxAge = this.cleanupConfig.maxAge;
    const keysToDelete: number[] = [];

    this.interceptors.forEach((interceptor, id) => {
      // Remove one-time interceptors that have run
      if (interceptor.runOnce && interceptor.hasRun) {
        keysToDelete.push(id);
        return;
      }

      // Remove old unused interceptors
      if (now - interceptor.lastUsed > maxAge && interceptor.usageCount === 0) {
        keysToDelete.push(id);
        return;
      }

      // Remove very old interceptors regardless of usage
      if (now - interceptor.created > maxAge * 3) {
        keysToDelete.push(id);
      }
    });

    keysToDelete.forEach(id => this.interceptors.delete(id));
  }

  /**
   * Perform LRU eviction when max interceptors reached
   * @private
   */
  private performLRUEviction(): void {
    if (!this.cleanupConfig.enableLRU || this.disposed) {
      return;
    }

    // Remove 25% of least recently used interceptors
    const evictionCount = Math.floor(this.interceptors.size * 0.25);
    if (evictionCount === 0) {
      return;
    }

    // Sort by last used time (ascending)
    const sortedInterceptors = Array.from(this.interceptors.entries())
      .sort(([, a], [, b]) => a.lastUsed - b.lastUsed);

    // Remove the oldest ones
    for (let i = 0; i < evictionCount && i < sortedInterceptors.length; i++) {
      const [id] = sortedInterceptors[i];
      this.interceptors.delete(id);
    }
  }

  /**
   * Add a one-time interceptor that will be automatically removed after first use
   * @param {Function} [onFulfilled] - Success handler
   * @param {Function} [onRejected] - Error handler
   * @param {InterceptorOptions} [options] - Additional options
   * @returns {number} Unique interceptor ID for removal
   */
  useOnce(
    onFulfilled?: (value: T) => T | Promise<T>,
    onRejected?: (error: unknown) => unknown,
    options?: InterceptorOptions
  ): number {
    return this.use(onFulfilled, onRejected, { ...options, runOnce: true });
  }

  /**
   * Get interceptor statistics
   * @returns {object} Statistics about interceptor usage
   */
  getStats(): {
    total: number;
    active: number;
    oneTimeUsed: number;
    averageAge: number;
    oldestAge: number;
  } {
    const now = Date.now();
    let oneTimeUsed = 0;
    let totalAge = 0;
    let oldestAge = 0;

    this.interceptors.forEach((interceptor) => {
      if (interceptor.runOnce && interceptor.hasRun) {
        oneTimeUsed++;
      }
      const age = now - interceptor.created;
      totalAge += age;
      oldestAge = Math.max(oldestAge, age);
    });

    return {
      total: this.interceptors.size,
      active: this.interceptors.size - oneTimeUsed,
      oneTimeUsed,
      averageAge: this.interceptors.size > 0 ? totalAge / this.interceptors.size : 0,
      oldestAge,
    };
  }

  /**
   * Update cleanup configuration
   * @param {Partial<CleanupConfig>} config - New cleanup configuration
   */
  updateCleanupConfig(config: Partial<CleanupConfig>): void {
    this.cleanupConfig = { ...this.cleanupConfig, ...config };
    
    // Restart timer if interval changed
    if (config.cleanupInterval !== undefined) {
      this.stopCleanupTimer();
      this.startCleanupTimer();
    }
  }

  /**
   * Stop cleanup timer
   * @private
   */
  private stopCleanupTimer(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer as NodeJS.Timeout);
      this.cleanupTimer = null;
    }
  }

  /**
   * Dispose of the interceptor manager and clean up all resources
   */
  dispose(): void {
    if (this.disposed) {
      return;
    }

    this.disposed = true;
    this.stopCleanupTimer();
    this.interceptors.clear();
    // WeakSet and WeakMap will be automatically garbage collected
  }

  /**
   * Check if the manager has been disposed
   * @returns {boolean} True if disposed
   */
  isDisposed(): boolean {
    return this.disposed;
  }
}
