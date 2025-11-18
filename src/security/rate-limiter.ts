// SECURITY: Rate limiting functionality

import type { fluxhttpRequestConfig } from '../types';
import { fluxhttpError } from '../errors/fluxhttperror';
import type { RateLimitConfig, RateLimitState } from './types';

/**
 * Rate limiter implementation with sliding window algorithm
 * Prevents abuse by limiting requests per time window
 */
export class RateLimiter {
  private rateLimitState: Map<string, RateLimitState> = new Map();
  private cleanupTimer?: NodeJS.Timeout;
  private disposed = false;
  private maxStateEntries = 1000; // Maximum number of rate limit states to track
  private lastCleanup = Date.now();

  constructor(private config: Required<RateLimitConfig>) {
    this.startCleanupTimer();
  }

  /**
   * Check if request should be rate limited
   * Throws fluxhttpError if rate limit exceeded
   */
  checkRateLimit(config: fluxhttpRequestConfig): void {
    if (this.disposed || !this.config.enabled) {
      return;
    }

    // Check if we need to clean up before processing
    if (this.rateLimitState.size >= this.maxStateEntries) {
      this.performImmediateCleanup();
    }

    const key = this.generateKey(config);
    const now = Date.now();
    const windowMs = this.config.windowMs;
    const maxRequests = this.config.maxRequests;

    let state = this.rateLimitState.get(key);
    if (!state) {
      state = {
        requests: [],
        windowStart: now,
        lastCleanup: now,
      };
      this.rateLimitState.set(key, state);
    }

    // Remove requests outside current window
    state.requests = state.requests.filter((timestamp) => now - timestamp < windowMs);
    state.lastCleanup = now;

    // Check if limit exceeded
    if (state.requests.length >= maxRequests) {
      const oldestRequest = state.requests[0];
      if (oldestRequest !== undefined) {
        const resetTime = Math.ceil((oldestRequest + windowMs - now) / 1000);
        throw new fluxhttpError(
          `Rate limit exceeded. Try again in ${resetTime} seconds`,
          'ERR_RATE_LIMITED',
          config,
          undefined,
          {
            data: { resetTime },
            status: 429,
            statusText: 'Too Many Requests',
            headers: {
              'Retry-After': resetTime.toString(),
              'X-RateLimit-Limit': maxRequests.toString(),
              'X-RateLimit-Remaining': '0',
              'X-RateLimit-Reset': new Date(oldestRequest + windowMs).toISOString(),
            },
            config,
          }
        );
      }
    }

    // Add current request
    state.requests.push(now);
  }

  /**
   * Generate rate limit key for request
   */
  private generateKey(config: fluxhttpRequestConfig): string {
    if (this.config.keyGenerator) {
      return this.config.keyGenerator(config);
    }

    // Default key generation based on origin and user agent
    const origin = config.url ? new URL(config.url).origin : 'unknown';
    const userAgent = config.headers?.['User-Agent'] || config.headers?.['user-agent'] || 'unknown';
    return `${origin}:${String(userAgent)}`;
  }

  /**
   * Clean up old rate limit entries
   */
  cleanupRateLimit(): void {
    if (this.disposed) {
      return;
    }
    
    this.performImmediateCleanup();
  }

  /**
   * Perform immediate cleanup without waiting for timer
   * @private
   */
  private performImmediateCleanup(): void {
    if (this.disposed) {
      return;
    }
    
    const now = Date.now();
    const windowMs = this.config.windowMs;
    const cleanupInterval = this.config.cleanupInterval;
    const keysToDelete: string[] = [];

    for (const [key, state] of this.rateLimitState.entries()) {
      // Remove old requests
      state.requests = state.requests.filter((timestamp) => now - timestamp < windowMs);

      // Remove empty states that haven't been used recently
      if (
        state.requests.length === 0 &&
        state.lastCleanup &&
        now - state.lastCleanup > cleanupInterval
      ) {
        keysToDelete.push(key);
      }
    }
    
    keysToDelete.forEach(key => this.rateLimitState.delete(key));
    
    // If still too many entries, remove oldest unused ones (LRU eviction)
    if (this.rateLimitState.size > this.maxStateEntries) {
      const sortedEntries = Array.from(this.rateLimitState.entries())
        .filter(([key]) => !keysToDelete.includes(key))
        .sort(([, a], [, b]) => {
          // Sort by last cleanup time (ascending) - oldest first
          return (a.lastCleanup || 0) - (b.lastCleanup || 0);
        });

      const toRemove = this.rateLimitState.size - this.maxStateEntries;
      // BUG-015 FIX: Add bounds check and null safety before accessing array elements
      for (let i = 0; i < toRemove && i < sortedEntries.length; i++) {
        const entry = sortedEntries[i];
        if (entry) {
          const [key] = entry;
          this.rateLimitState.delete(key);
        }
      }
    }
    
    this.lastCleanup = now;
  }

  /**
   * Start automatic cleanup timer
   */
  private startCleanupTimer(): void {
    if (this.cleanupTimer || this.disposed) {
      return;
    }

    const cleanupInterval = this.config.cleanupInterval;
    this.cleanupTimer = setInterval(() => {
      if (!this.disposed) {
        this.cleanupRateLimit();
      }
    }, cleanupInterval);
  }

  /**
   * Stop automatic cleanup timer
   * @private
   */
  private stopCleanupTimer(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }
  }

  /**
   * Dispose of rate limiter and clean up resources
   */
  /**
   * Set maximum number of rate limit state entries
   * @param {number} max - Maximum number of state entries
   */
  setMaxStateEntries(max: number): void {
    if (max > 0) {
      this.maxStateEntries = max;
      // Trigger cleanup if current size exceeds new limit
      if (this.rateLimitState.size > max) {
        this.performImmediateCleanup();
      }
    }
  }

  /**
   * Get current number of rate limit state entries
   * @returns {number} Current number of state entries
   */
  getStateEntriesCount(): number {
    return this.rateLimitState.size;
  }

  /**
   * Get maximum number of state entries
   * @returns {number} Maximum state entries
   */
  getMaxStateEntries(): number {
    return this.maxStateEntries;
  }

  /**
   * Get rate limiter statistics
   * @returns {object} Statistics about rate limiter usage
   */
  getStats(): {
    totalStates: number;
    activeStates: number;
    totalRequests: number;
    lastCleanup: number;
  } {
    let activeStates = 0;
    let totalRequests = 0;
    
    this.rateLimitState.forEach((state) => {
      if (state.requests.length > 0) {
        activeStates++;
      }
      totalRequests += state.requests.length;
    });
    
    return {
      totalStates: this.rateLimitState.size,
      activeStates,
      totalRequests,
      lastCleanup: this.lastCleanup,
    };
  }

  /**
   * Check if rate limiter has been disposed
   * @returns {boolean} True if disposed
   */
  isDisposed(): boolean {
    return this.disposed;
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }
    
    this.disposed = true;
    this.stopCleanupTimer();
    this.rateLimitState.clear();
  }
}
