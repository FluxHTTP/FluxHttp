import type { fluxhttpRequestConfig, fluxhttpResponse } from '../types';

/**
 * Request signature for deduplication
 * @interface RequestSignature
 */
interface RequestSignature {
  /** HTTP method */
  method: string;
  /** Request URL */
  url: string;
  /** Query parameters hash */
  paramsHash: string;
  /** Request data hash */
  dataHash: string;
  /** Selected headers hash */
  headersHash: string;
}

/**
 * Pending request entry
 * @interface PendingRequest
 */
interface PendingRequest<T = unknown> {
  /** Promise for the request */
  promise: Promise<fluxhttpResponse<T>>;
  /** Timestamp when request was started */
  timestamp: number;
  /** Request configuration */
  config: fluxhttpRequestConfig;
}

/**
 * Deduplication configuration
 * @interface DeduplicationConfig
 */
export interface DeduplicationConfig {
  /** Whether deduplication is enabled */
  enabled?: boolean;
  /** Maximum time to keep pending requests in cache (ms) */
  maxAge?: number;
  /** Headers to include in signature (default: none) */
  includeHeaders?: string[];
  /** Custom key generator function */
  keyGenerator?: (config: fluxhttpRequestConfig) => string;
  /** Function to determine if requests should be deduplicated */
  shouldDeduplicate?: (config: fluxhttpRequestConfig) => boolean;
}

/**
 * Request deduplication manager
 * @class RequestDeduplicator
 */
export class RequestDeduplicator {
  private pendingRequests = new Map<string, PendingRequest>();
  private config: Required<DeduplicationConfig>;
  private cleanupInterval: NodeJS.Timeout | number | null = null;
  private disposed = false;
  private maxCacheSize = 1000; // Maximum number of pending requests
  private requestPromises = new WeakMap<Promise<any>, string>(); // Track promise to key mapping

  /**
   * Create a new request deduplicator
   * @param {DeduplicationConfig} [config] - Deduplication configuration
   */
  constructor(config: DeduplicationConfig = {}) {
    this.config = {
      enabled: config.enabled ?? true,
      maxAge: config.maxAge ?? 60000, // 1 minute
      includeHeaders: config.includeHeaders ?? [],
      keyGenerator: config.keyGenerator ?? this.defaultKeyGenerator.bind(this),
      shouldDeduplicate: config.shouldDeduplicate ?? this.defaultShouldDeduplicate.bind(this),
    };

    this.startCleanupInterval();
  }

  /**
   * Start the cleanup interval to remove expired requests
   * @private
   */
  private startCleanupInterval(): void {
    if (this.cleanupInterval || this.disposed) {
      return;
    }

    const cleanup = () => {
      if (this.disposed) {
        return;
      }
      
      const now = Date.now();
      const keysToDelete: string[] = [];
      
      this.pendingRequests.forEach((request, key) => {
        // Remove expired requests
        if (now - request.timestamp > this.config.maxAge) {
          keysToDelete.push(key);
        }
      });
      
      keysToDelete.forEach(key => {
        this.pendingRequests.delete(key);
      });
      
      // If cache is too large, remove oldest entries (LRU eviction)
      if (this.pendingRequests.size > this.maxCacheSize) {
        const sortedEntries = Array.from(this.pendingRequests.entries())
          .sort(([, a], [, b]) => a.timestamp - b.timestamp);
        
        const toRemove = this.pendingRequests.size - this.maxCacheSize;
        for (let i = 0; i < toRemove; i++) {
          const entry = sortedEntries[i];
          if (entry) { // BUG-004 fixed: Check undefined before destructuring
            const [key] = entry;
            this.pendingRequests.delete(key);
          }
        }
      }
    };

    // Clean up every 30 seconds
    this.cleanupInterval = setInterval(cleanup, 30000);
  }

  /**
   * Stop the cleanup interval and dispose resources
   */
  destroy(): void {
    if (this.disposed) {
      return;
    }
    
    this.disposed = true;
    
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval as NodeJS.Timeout);
      this.cleanupInterval = null;
    }
    
    // Clear all pending requests
    this.pendingRequests.clear();
    
    // WeakMap will be automatically garbage collected
  }

  /**
   * Default function to determine if requests should be deduplicated
   * @private
   * @param {fluxhttpRequestConfig} config - Request configuration
   * @returns {boolean} True if request should be deduplicated
   */
  private defaultShouldDeduplicate(config: fluxhttpRequestConfig): boolean {
    // Only deduplicate safe methods by default
    const method = (config.method || 'GET').toUpperCase();
    return ['GET', 'HEAD', 'OPTIONS'].includes(method);
  }

  /**
   * Generate a hash from a string
   * @private
   * @param {string} str - String to hash
   * @returns {string} Hash string
   */
  private hash(str: string): string {
    let hash = 0;
    if (str.length === 0) return hash.toString();
    
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    return hash.toString();
  }

  /**
   * Generate request signature for deduplication
   * @private
   * @param {fluxhttpRequestConfig} config - Request configuration
   * @returns {RequestSignature} Request signature
   */
  private generateSignature(config: fluxhttpRequestConfig): RequestSignature {
    const method = (config.method || 'GET').toUpperCase();
    const url = config.url || '';
    
    // Sort and stringify params
    const params = config.params || {};
    const sortedParams = Object.keys(params)
      .sort()
      .reduce((obj: Record<string, unknown>, key) => {
        obj[key] = params[key];
        return obj;
      }, {});
    const paramsHash = this.hash(JSON.stringify(sortedParams));

    // Stringify data
    const dataHash = this.hash(JSON.stringify(config.data || null));

    // Include selected headers
    const headers = config.headers || {};
    const selectedHeaders: Record<string, unknown> = {};
    for (const headerName of this.config.includeHeaders) {
      const value = headers[headerName.toLowerCase()] || headers[headerName];
      if (value !== undefined) {
        selectedHeaders[headerName.toLowerCase()] = value;
      }
    }
    const sortedHeaders = Object.keys(selectedHeaders)
      .sort()
      .reduce((obj: Record<string, unknown>, key) => {
        obj[key] = selectedHeaders[key];
        return obj;
      }, {});
    const headersHash = this.hash(JSON.stringify(sortedHeaders));

    return {
      method,
      url,
      paramsHash,
      dataHash,
      headersHash,
    };
  }

  /**
   * Default key generator
   * @private
   * @param {fluxhttpRequestConfig} config - Request configuration
   * @returns {string} Deduplication key
   */
  private defaultKeyGenerator(config: fluxhttpRequestConfig): string {
    const signature = this.generateSignature(config);
    return `${signature.method}:${signature.url}:${signature.paramsHash}:${signature.dataHash}:${signature.headersHash}`;
  }

  /**
   * Get or create a deduplicated request
   * @param {fluxhttpRequestConfig} config - Request configuration
   * @param {Function} requestExecutor - Function to execute the actual request
   * @returns {Promise<fluxhttpResponse>} Response promise
   */
  async deduplicate<T = unknown>(
    config: fluxhttpRequestConfig,
    requestExecutor: () => Promise<fluxhttpResponse<T>>
  ): Promise<fluxhttpResponse<T>> {
    // Check if deduplication is enabled and should be applied
    if (this.disposed || !this.config.enabled || !this.config.shouldDeduplicate(config)) {
      return requestExecutor();
    }

    const key = this.config.keyGenerator(config);
    const existing = this.pendingRequests.get(key) as PendingRequest<T> | undefined;

    if (existing) {
      // Check if the existing request is still valid
      const age = Date.now() - existing.timestamp;
      if (age <= this.config.maxAge) {
        return existing.promise;
      } else {
        // Remove expired request
        this.pendingRequests.delete(key);
      }
    }

    // Check cache size limit before adding new request
    if (this.pendingRequests.size >= this.maxCacheSize) {
      // Trigger immediate cleanup
      this.performImmediateCleanup();
    }

    // Create new request
    const promise = requestExecutor();
    const pendingRequest: PendingRequest<T> = {
      promise,
      timestamp: Date.now(),
      config,
    };

    this.pendingRequests.set(key, pendingRequest);
    this.requestPromises.set(promise, key);

    // Clean up after request completes (success or failure)
    const cleanup = () => {
      this.pendingRequests.delete(key);
      // WeakMap cleanup is automatic
    };

    promise.then(cleanup, cleanup);

    return promise;
  }

  /**
   * Clear all pending requests
   */
  clear(): void {
    this.pendingRequests.clear();
  }

  /**
   * Get number of pending requests
   * @returns {number} Number of pending requests
   */
  getPendingCount(): number {
    return this.pendingRequests.size;
  }

  /**
   * Get pending request keys
   * @returns {string[]} Array of pending request keys
   */
  getPendingKeys(): string[] {
    return Array.from(this.pendingRequests.keys());
  }

  /**
   * Check if a request is pending
   * @param {fluxhttpRequestConfig} config - Request configuration
   * @returns {boolean} True if request is pending
   */
  isPending(config: fluxhttpRequestConfig): boolean {
    if (!this.config.enabled || !this.config.shouldDeduplicate(config)) {
      return false;
    }

    const key = this.config.keyGenerator(config);
    const existing = this.pendingRequests.get(key);
    
    if (!existing) {
      return false;
    }

    const age = Date.now() - existing.timestamp;
    return age <= this.config.maxAge;
  }

  /**
   * Cancel a pending request
   * @param {fluxhttpRequestConfig} config - Request configuration
   * @returns {boolean} True if request was cancelled
   */
  cancel(config: fluxhttpRequestConfig): boolean {
    if (!this.config.enabled || !this.config.shouldDeduplicate(config)) {
      return false;
    }

    const key = this.config.keyGenerator(config);
    return this.pendingRequests.delete(key);
  }

  /**
   * Perform immediate cleanup without waiting for interval
   * @private
   */
  private performImmediateCleanup(): void {
    if (this.disposed) {
      return;
    }
    
    const now = Date.now();
    const keysToDelete: string[] = [];
    
    this.pendingRequests.forEach((request, key) => {
      if (now - request.timestamp > this.config.maxAge) {
        keysToDelete.push(key);
      }
    });
    
    keysToDelete.forEach(key => this.pendingRequests.delete(key));
    
    // If still too large, remove oldest entries
    if (this.pendingRequests.size >= this.maxCacheSize) {
      const sortedEntries = Array.from(this.pendingRequests.entries())
        .sort(([, a], [, b]) => a.timestamp - b.timestamp);

      const toRemove = Math.max(1, Math.floor(this.maxCacheSize * 0.25)); // Remove 25%
      for (let i = 0; i < toRemove && i < sortedEntries.length; i++) {
        const entry = sortedEntries[i];
        if (entry) {
          const [key] = entry;
          this.pendingRequests.delete(key);
        }
      }
    }
  }

  /**
   * Set maximum cache size
   * @param {number} size - Maximum number of pending requests
   */
  setMaxCacheSize(size: number): void {
    if (size > 0) {
      this.maxCacheSize = size;
      // Trigger cleanup if current size exceeds new limit
      if (this.pendingRequests.size > size) {
        this.performImmediateCleanup();
      }
    }
  }

  /**
   * Get current cache size
   * @returns {number} Current number of pending requests
   */
  getCacheSize(): number {
    return this.pendingRequests.size;
  }

  /**
   * Get maximum cache size
   * @returns {number} Maximum cache size
   */
  getMaxCacheSize(): number {
    return this.maxCacheSize;
  }

  /**
   * Check if deduplicator has been disposed
   * @returns {boolean} True if disposed
   */
  isDisposed(): boolean {
    return this.disposed;
  }

  /**
   * Update configuration
   * @param {DeduplicationConfig} newConfig - New configuration
   */
  updateConfig(newConfig: DeduplicationConfig): void {
    if (this.disposed) {
      return;
    }
    
    this.config = {
      ...this.config,
      ...newConfig,
      keyGenerator: newConfig.keyGenerator ?? this.config.keyGenerator,
      shouldDeduplicate: newConfig.shouldDeduplicate ?? this.config.shouldDeduplicate,
    };
  }
}

/**
 * Default request deduplicator instance
 */
export const defaultDeduplicator = new RequestDeduplicator();

// Clean up default deduplicator on process exit
if (typeof process !== 'undefined' && process && typeof process.on === 'function') {
  process.on('exit', () => {
    defaultDeduplicator.destroy();
  });

  process.on('SIGTERM', () => {
    defaultDeduplicator.destroy();
    if (typeof process !== 'undefined' && process && typeof process.exit === 'function') {
      process.exit(0);
    }
  });

  process.on('SIGINT', () => {
    defaultDeduplicator.destroy();
    if (typeof process !== 'undefined' && process && typeof process.exit === 'function') {
      process.exit(0);
    }
  });
}

/**
 * Create a new request deduplicator
 * @param {DeduplicationConfig} [config] - Deduplication configuration
 * @returns {RequestDeduplicator} New deduplicator instance
 */
export function createDeduplicator(config?: DeduplicationConfig): RequestDeduplicator {
  return new RequestDeduplicator(config);
}