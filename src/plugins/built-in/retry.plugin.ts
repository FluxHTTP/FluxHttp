/**
 * @fileoverview Retry plugin for FluxHTTP
 * @module @fluxhttp/plugins/built-in/retry
 */

import type {
  Plugin,
  PluginConfig,
  PluginContext,
  PluginMetadata,
  PluginConfigSchema,
  fluxhttpRequestConfig,
  fluxhttpResponse,
  fluxhttpError
} from '../types';
import { PluginLifecycleState, PluginType, PluginPriority } from '../types';

/**
 * Backoff strategies
 */
export type BackoffStrategy = 'fixed' | 'linear' | 'exponential' | 'custom';

/**
 * Retry condition function type
 */
export type RetryCondition = (error: fluxhttpError, attempt: number, config: fluxhttpRequestConfig) => boolean;

/**
 * Delay calculation function type
 */
export type DelayCalculator = (attempt: number, baseDelay: number, error?: fluxhttpError) => number;

/**
 * Retry configuration
 */
export interface RetryPluginConfig extends PluginConfig {
  settings: {
    /** Maximum number of retry attempts */
    maxAttempts?: number;
    /** Base delay between retries in milliseconds */
    baseDelay?: number;
    /** Maximum delay between retries in milliseconds */
    maxDelay?: number;
    /** Backoff strategy */
    backoff?: BackoffStrategy;
    /** Backoff multiplier for exponential strategy */
    backoffMultiplier?: number;
    /** Jitter enabled to randomize delays */
    jitter?: boolean;
    /** Maximum jitter percentage (0-1) */
    maxJitter?: number;
    /** HTTP status codes that should trigger retry */
    retryStatusCodes?: number[];
    /** HTTP methods that are safe to retry */
    retryMethods?: string[];
    /** Network error types that should trigger retry */
    retryErrorCodes?: string[];
    /** Custom retry condition function */
    retryCondition?: RetryCondition;
    /** Custom delay calculation function */
    delayCalculator?: DelayCalculator;
    /** Respect Retry-After header */
    respectRetryAfter?: boolean;
    /** Reset timeout on retry */
    resetTimeout?: boolean;
    /** Retry timeout multiplier */
    timeoutMultiplier?: number;
    /** Circuit breaker integration */
    circuitBreaker?: {
      enabled: boolean;
      failureThreshold: number;
      resetTimeout: number;
    };
    /** Retry metrics enabled */
    metricsEnabled?: boolean;
    /** Retry on network errors */
    retryOnNetworkError?: boolean;
    /** Retry on timeout errors */
    retryOnTimeout?: boolean;
    /** Custom error handler */
    onRetryError?: (error: fluxhttpError, attempt: number) => void;
    /** Retry attempt callback */
    onRetryAttempt?: (attempt: number, delay: number, error: fluxhttpError) => void;
    /** Retry success callback */
    onRetrySuccess?: (attempt: number, response: fluxhttpResponse) => void;
    /** Retry exhausted callback */
    onRetriesExhausted?: (attempts: number, finalError: fluxhttpError) => void;
  };
}

/**
 * Retry attempt metadata
 */
interface RetryAttempt {
  /** Attempt number (1-based) */
  attempt: number;
  /** Attempt timestamp */
  timestamp: number;
  /** Delay before this attempt */
  delay: number;
  /** Error that triggered the retry */
  error?: fluxhttpError;
  /** Request configuration for this attempt */
  config: fluxhttpRequestConfig;
}

/**
 * Retry statistics
 */
interface RetryStats {
  /** Total retry attempts */
  totalAttempts: number;
  /** Total successful retries */
  successfulRetries: number;
  /** Total failed retries */
  failedRetries: number;
  /** Total exhausted retries */
  exhaustedRetries: number;
  /** Average retry count per request */
  averageRetryCount: number;
  /** Retry rate percentage */
  retryRate: number;
  /** Success rate after retry */
  retrySuccessRate: number;
  /** Total delay time from retries */
  totalDelayTime: number;
  /** Average delay per retry */
  averageDelay: number;
}

/**
 * Circuit breaker state
 */
enum CircuitBreakerState {
  CLOSED = 'closed',
  OPEN = 'open',
  HALF_OPEN = 'half-open'
}

/**
 * Circuit breaker for retry integration
 */
class CircuitBreaker {
  private state = CircuitBreakerState.CLOSED;
  private failures = 0;
  private lastFailureTime = 0;
  private successCount = 0;

  constructor(
    private readonly failureThreshold: number,
    private readonly resetTimeout: number
  ) {}

  canExecute(): boolean {
    if (this.state === CircuitBreakerState.CLOSED) {
      return true;
    }

    if (this.state === CircuitBreakerState.OPEN) {
      if (Date.now() - this.lastFailureTime >= this.resetTimeout) {
        this.state = CircuitBreakerState.HALF_OPEN;
        this.successCount = 0;
        return true;
      }
      return false;
    }

    // HALF_OPEN state - allow limited requests
    return this.successCount < 3;
  }

  recordSuccess(): void {
    this.failures = 0;
    
    if (this.state === CircuitBreakerState.HALF_OPEN) {
      this.successCount++;
      if (this.successCount >= 3) {
        this.state = CircuitBreakerState.CLOSED;
      }
    }
  }

  recordFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();

    if (this.failures >= this.failureThreshold) {
      this.state = CircuitBreakerState.OPEN;
    }
  }

  getState(): CircuitBreakerState {
    return this.state;
  }

  getStats() {
    return {
      state: this.state,
      failures: this.failures,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime
    };
  }
}

/**
 * Retry plugin implementation
 */
export class RetryPlugin implements Plugin {
  readonly metadata: PluginMetadata = {
    id: 'retry',
    name: 'Retry Plugin',
    version: '1.0.0',
    type: PluginType.FEATURE,
    description: 'Provides intelligent retry logic for failed HTTP requests with backoff strategies',
    author: {
      name: 'FluxHTTP Team',
      email: 'team@fluxhttp.dev'
    },
    license: 'MIT',
    keywords: ['retry', 'resilience', 'backoff', 'circuit-breaker', 'reliability'],
    capabilities: {
      canRetry: true,
      canHandleErrors: true
    },
    priority: PluginPriority.HIGH
  };

  readonly configSchema: PluginConfigSchema = {
    type: 'object',
    properties: {
      enabled: { type: 'boolean', default: true },
      settings: {
        type: 'object',
        properties: {
          maxAttempts: { type: 'number', default: 3, minimum: 1, maximum: 10 },
          baseDelay: { type: 'number', default: 1000, minimum: 0 },
          maxDelay: { type: 'number', default: 30000, minimum: 0 },
          backoff: {
            type: 'string',
            enum: ['fixed', 'linear', 'exponential', 'custom'],
            default: 'exponential'
          },
          backoffMultiplier: { type: 'number', default: 2, minimum: 1 },
          jitter: { type: 'boolean', default: true },
          maxJitter: { type: 'number', default: 0.1, minimum: 0, maximum: 1 },
          retryStatusCodes: {
            type: 'array',
            items: { type: 'number' },
            default: [408, 429, 500, 502, 503, 504]
          },
          retryMethods: {
            type: 'array',
            items: { type: 'string' },
            default: ['GET', 'HEAD', 'PUT', 'DELETE', 'OPTIONS']
          },
          respectRetryAfter: { type: 'boolean', default: true },
          resetTimeout: { type: 'boolean', default: true },
          timeoutMultiplier: { type: 'number', default: 1.5, minimum: 1 },
          metricsEnabled: { type: 'boolean', default: true },
          retryOnNetworkError: { type: 'boolean', default: true },
          retryOnTimeout: { type: 'boolean', default: true }
        }
      }
    }
  };

  state = PluginLifecycleState.UNINITIALIZED;
  config: RetryPluginConfig;
  context?: PluginContext;

  private stats: RetryStats = {
    totalAttempts: 0,
    successfulRetries: 0,
    failedRetries: 0,
    exhaustedRetries: 0,
    averageRetryCount: 0,
    retryRate: 0,
    retrySuccessRate: 0,
    totalDelayTime: 0,
    averageDelay: 0
  };

  private circuitBreaker?: CircuitBreaker;
  private retryHistory = new Map<string, RetryAttempt[]>();

  constructor(config: Partial<RetryPluginConfig> = {}) {
    this.config = {
      enabled: true,
      settings: {
        maxAttempts: 3,
        baseDelay: 1000,
        maxDelay: 30000,
        backoff: 'exponential',
        backoffMultiplier: 2,
        jitter: true,
        maxJitter: 0.1,
        retryStatusCodes: [408, 429, 500, 502, 503, 504],
        retryMethods: ['GET', 'HEAD', 'PUT', 'DELETE', 'OPTIONS'],
        retryErrorCodes: ['ECONNRESET', 'ENOTFOUND', 'ECONNREFUSED', 'ETIMEDOUT'],
        respectRetryAfter: true,
        resetTimeout: true,
        timeoutMultiplier: 1.5,
        metricsEnabled: true,
        retryOnNetworkError: true,
        retryOnTimeout: true,
        ...config.settings
      },
      ...config
    } as RetryPluginConfig;
  }

  /**
   * Initialize plugin
   */
  async init(context: PluginContext): Promise<void> {
    this.context = context;
    
    // Initialize circuit breaker if enabled
    if (this.config.settings.circuitBreaker?.enabled) {
      this.circuitBreaker = new CircuitBreaker(
        this.config.settings.circuitBreaker.failureThreshold,
        this.config.settings.circuitBreaker.resetTimeout
      );
    }
    
    // Register error interceptor for retry logic
    this.interceptError(this.handleRetryError.bind(this));
    
    context.logger.info('Retry plugin initialized', {
      maxAttempts: this.config.settings.maxAttempts,
      backoff: this.config.settings.backoff,
      circuitBreaker: !!this.circuitBreaker
    });
  }

  /**
   * Register error interceptor
   */
  interceptError(interceptor: (error: fluxhttpError, context: PluginContext) => Promise<fluxhttpError | fluxhttpResponse> | fluxhttpError | fluxhttpResponse): void {
    if (this.context?.fluxhttp.interceptors.response) {
      this.context.fluxhttp.interceptors.response.use(
        undefined,
        (error) => interceptor(error, this.context!),
        { runWhen: () => this.config.enabled }
      );
    }
  }

  /**
   * Handle retry error logic
   */
  private async handleRetryError(error: fluxhttpError): Promise<fluxhttpError | fluxhttpResponse> {
    if (!this.shouldRetry(error)) {
      return Promise.reject(error);
    }

    // Check circuit breaker
    if (this.circuitBreaker && !this.circuitBreaker.canExecute()) {
      this.context?.logger.warn('Circuit breaker is open, skipping retry');
      return Promise.reject(error);
    }

    const requestId = this.getRequestId(error.config);
    const attempts = this.retryHistory.get(requestId) || [];
    
    if (attempts.length >= (this.config.settings.maxAttempts || 3)) {
      // Retries exhausted
      this.stats.exhaustedRetries++;
      this.updateStats();
      
      if (this.config.settings.onRetriesExhausted) {
        this.config.settings.onRetriesExhausted(attempts.length, error);
      }
      
      this.context?.logger.warn('Retries exhausted', {
        requestId,
        attempts: attempts.length,
        error: error.message
      });
      
      return Promise.reject(error);
    }

    // Calculate delay for next attempt
    const attemptNumber = attempts.length + 1;
    const delay = this.calculateDelay(attemptNumber, error);

    // Record retry attempt
    const retryAttempt: RetryAttempt = {
      attempt: attemptNumber,
      timestamp: Date.now(),
      delay,
      error,
      config: error.config || {}
    };

    attempts.push(retryAttempt);
    this.retryHistory.set(requestId, attempts);

    // Update statistics
    this.stats.totalAttempts++;
    this.stats.totalDelayTime += delay;
    this.updateStats();

    // Call retry attempt callback
    if (this.config.settings.onRetryAttempt) {
      this.config.settings.onRetryAttempt(attemptNumber, delay, error);
    }

    this.context?.logger.info('Retrying request', {
      requestId,
      attempt: attemptNumber,
      delay,
      error: error.message
    });

    // Wait for calculated delay
    await this.sleep(delay);

    try {
      // Prepare config for retry
      const retryConfig = this.prepareRetryConfig(error.config || {}, attemptNumber);
      
      // Make retry request (in a real implementation, you would use the actual HTTP client)
      // For now, we'll simulate the retry logic
      const response = await this.executeRetry(retryConfig);
      
      // Retry succeeded
      this.stats.successfulRetries++;
      this.retryHistory.delete(requestId);
      
      if (this.circuitBreaker) {
        this.circuitBreaker.recordSuccess();
      }
      
      if (this.config.settings.onRetrySuccess) {
        this.config.settings.onRetrySuccess(attemptNumber, response);
      }
      
      this.context?.logger.info('Retry succeeded', {
        requestId,
        attempt: attemptNumber
      });
      
      return response;
      
    } catch (retryError) {
      // Retry failed
      this.stats.failedRetries++;
      
      if (this.circuitBreaker) {
        this.circuitBreaker.recordFailure();
      }
      
      if (this.config.settings.onRetryError) {
        this.config.settings.onRetryError(retryError as fluxhttpError, attemptNumber);
      }
      
      // Continue with retry logic
      return this.handleRetryError(retryError as fluxhttpError);
    }
  }

  /**
   * Check if request should be retried
   */
  private shouldRetry(error: fluxhttpError): boolean {
    const config = error.config;
    if (!config) return false;

    // Check custom retry condition
    if (this.config.settings.retryCondition) {
      const attempts = this.retryHistory.get(this.getRequestId(config))?.length || 0;
      return this.config.settings.retryCondition(error, attempts, config);
    }

    // Check HTTP method
    const method = config.method?.toUpperCase() || 'GET';
    const retryMethods = this.config.settings.retryMethods || ['GET', 'HEAD', 'PUT', 'DELETE', 'OPTIONS'];
    if (!retryMethods.includes(method)) {
      return false;
    }

    // Check if it's a response error
    if (error.response) {
      const status = error.response.status;
      const retryStatusCodes = this.config.settings.retryStatusCodes || [408, 429, 500, 502, 503, 504];
      return retryStatusCodes.includes(status);
    }

    // Check if it's a network error
    if (this.config.settings.retryOnNetworkError && this.isNetworkError(error)) {
      return true;
    }

    // Check if it's a timeout error
    if (this.config.settings.retryOnTimeout && this.isTimeoutError(error)) {
      return true;
    }

    return false;
  }

  /**
   * Check if error is a network error
   */
  private isNetworkError(error: fluxhttpError): boolean {
    const retryErrorCodes = this.config.settings.retryErrorCodes || ['ECONNRESET', 'ENOTFOUND', 'ECONNREFUSED', 'ETIMEDOUT'];
    return error.code ? retryErrorCodes.includes(error.code) : false;
  }

  /**
   * Check if error is a timeout error
   */
  private isTimeoutError(error: fluxhttpError): boolean {
    return error.code === 'ECONNABORTED' || error.message?.includes('timeout') || false;
  }

  /**
   * Calculate delay for retry attempt
   */
  private calculateDelay(attempt: number, error?: fluxhttpError): number {
    const baseDelay = this.config.settings.baseDelay || 1000;
    const maxDelay = this.config.settings.maxDelay || 30000;
    
    // Check for custom delay calculator
    if (this.config.settings.delayCalculator) {
      return Math.min(this.config.settings.delayCalculator(attempt, baseDelay, error), maxDelay);
    }

    // Check for Retry-After header
    if (this.config.settings.respectRetryAfter && error?.response?.headers) {
      const retryAfter = error.response.headers['retry-after'] || error.response.headers['Retry-After'];
      if (retryAfter) {
        const retryAfterMs = parseInt(retryAfter) * 1000;
        if (!isNaN(retryAfterMs)) {
          return Math.min(retryAfterMs, maxDelay);
        }
      }
    }

    let delay: number;
    const backoff = this.config.settings.backoff || 'exponential';
    const multiplier = this.config.settings.backoffMultiplier || 2;

    switch (backoff) {
      case 'fixed':
        delay = baseDelay;
        break;
      
      case 'linear':
        delay = baseDelay * attempt;
        break;
      
      case 'exponential':
        delay = baseDelay * Math.pow(multiplier, attempt - 1);
        break;
      
      default:
        delay = baseDelay;
    }

    // Apply jitter if enabled
    if (this.config.settings.jitter) {
      const maxJitter = this.config.settings.maxJitter || 0.1;
      const jitterRange = delay * maxJitter;
      const jitter = (Math.random() - 0.5) * 2 * jitterRange;
      delay += jitter;
    }

    return Math.min(Math.max(delay, 0), maxDelay);
  }

  /**
   * Prepare configuration for retry
   */
  private prepareRetryConfig(config: fluxhttpRequestConfig, attempt: number): fluxhttpRequestConfig {
    const retryConfig = { ...config };

    // Reset timeout if configured
    if (this.config.settings.resetTimeout && config.timeout) {
      const multiplier = this.config.settings.timeoutMultiplier || 1.5;
      retryConfig.timeout = config.timeout * Math.pow(multiplier, attempt - 1);
    }

    // Remove any retry-specific headers or properties
    if (retryConfig.headers) {
      delete retryConfig.headers['X-Retry-Attempt'];
    }

    // Add retry attempt header
    retryConfig.headers = {
      ...retryConfig.headers,
      'X-Retry-Attempt': attempt.toString()
    };

    return retryConfig;
  }

  /**
   * Execute retry request
   */
  private async executeRetry(config: fluxhttpRequestConfig): Promise<fluxhttpResponse> {
    // In a real implementation, this would use the actual FluxHTTP client
    // For now, we'll simulate the request
    if (!this.context?.fluxhttp) {
      throw new Error('FluxHTTP instance not available');
    }

    return this.context.fluxhttp.request(config);
  }

  /**
   * Generate unique request ID
   */
  private getRequestId(config?: fluxhttpRequestConfig): string {
    if (!config) return 'unknown';
    
    const parts = [
      config.method || 'GET',
      config.url || '',
      JSON.stringify(config.params || {}),
      Date.now().toString()
    ];
    
    return parts.join('|');
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Update retry statistics
   */
  private updateStats(): void {
    if (!this.config.settings.metricsEnabled) return;
    
    const totalRequests = this.stats.successfulRetries + this.stats.exhaustedRetries;
    this.stats.averageRetryCount = totalRequests > 0 ? this.stats.totalAttempts / totalRequests : 0;
    this.stats.retryRate = totalRequests > 0 ? (this.stats.totalAttempts - totalRequests) / totalRequests : 0;
    this.stats.retrySuccessRate = this.stats.totalAttempts > 0 ? this.stats.successfulRetries / this.stats.totalAttempts : 0;
    this.stats.averageDelay = this.stats.totalAttempts > 0 ? this.stats.totalDelayTime / this.stats.totalAttempts : 0;

    // Update context metrics
    if (this.context?.metrics) {
      this.context.metrics.gauge('retry.average_attempts', this.stats.averageRetryCount);
      this.context.metrics.gauge('retry.success_rate', this.stats.retrySuccessRate * 100);
      this.context.metrics.gauge('retry.average_delay', this.stats.averageDelay);
      this.context.metrics.increment('retry.total_attempts', 1);
    }
  }

  /**
   * Get retry statistics
   */
  getStats(): RetryStats {
    return { ...this.stats };
  }

  /**
   * Clear retry history
   */
  clearHistory(): void {
    this.retryHistory.clear();
  }

  /**
   * Update configuration
   */
  async updateConfig(config: Partial<RetryPluginConfig>): Promise<void> {
    this.config = { ...this.config, ...config };
    
    // Reinitialize circuit breaker if settings changed
    if (config.settings?.circuitBreaker) {
      if (config.settings.circuitBreaker.enabled) {
        this.circuitBreaker = new CircuitBreaker(
          config.settings.circuitBreaker.failureThreshold,
          config.settings.circuitBreaker.resetTimeout
        );
      } else {
        this.circuitBreaker = undefined;
      }
    }
    
    this.context?.logger.info('Retry plugin configuration updated');
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
        maxAttempts: this.config.settings.maxAttempts,
        backoff: this.config.settings.backoff,
        activeRetries: this.retryHistory.size,
        circuitBreaker: this.circuitBreaker?.getStats(),
        stats: this.stats
      }
    };
  }

  /**
   * Get plugin metrics
   */
  async getMetrics() {
    return {
      ...this.stats,
      activeRetries: this.retryHistory.size,
      circuitBreaker: this.circuitBreaker?.getStats()
    };
  }
}

/**
 * Retry plugin factory
 */
export function createRetryPlugin(config?: Partial<RetryPluginConfig>): RetryPlugin {
  return new RetryPlugin(config);
}