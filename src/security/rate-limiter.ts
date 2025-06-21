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

  constructor(private config: Required<RateLimitConfig>) {
    this.startCleanupTimer();
  }

  /**
   * Check if request should be rate limited
   * Throws fluxhttpError if rate limit exceeded
   */
  checkRateLimit(config: fluxhttpRequestConfig): void {
    if (!this.config.enabled) {
      return;
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
      };
      this.rateLimitState.set(key, state);
    }

    // Remove requests outside current window
    state.requests = state.requests.filter((timestamp) => now - timestamp < windowMs);

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
    state.lastCleanup = now;
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
    const now = Date.now();
    const windowMs = this.config.windowMs;
    const cleanupInterval = this.config.cleanupInterval;

    for (const [key, state] of Array.from(this.rateLimitState.entries())) {
      // Remove old requests
      state.requests = state.requests.filter((timestamp) => now - timestamp < windowMs);

      // Remove empty states that haven't been used recently
      if (
        state.requests.length === 0 &&
        state.lastCleanup &&
        now - state.lastCleanup > cleanupInterval
      ) {
        this.rateLimitState.delete(key);
      }
    }
  }

  /**
   * Start automatic cleanup timer
   */
  private startCleanupTimer(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }

    const cleanupInterval = this.config.cleanupInterval;
    this.cleanupTimer = setInterval(() => {
      this.cleanupRateLimit();
    }, cleanupInterval);
  }

  /**
   * Dispose of rate limiter and clean up resources
   */
  dispose(): void {
    this.rateLimitState.clear();
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }
  }
}
