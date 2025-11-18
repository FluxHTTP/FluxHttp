/**
 * @fileoverview Circuit breaker pattern and advanced retry mechanisms for FluxHTTP
 * @module @fluxhttp/core/features/circuit-breaker
 */

import type { fluxhttpRequestConfig, fluxhttpResponse, fluxhttpError } from '../types';

/**
 * Circuit breaker states
 */
export enum CircuitState {
  CLOSED = 'closed',
  OPEN = 'open',
  HALF_OPEN = 'half-open'
}

/**
 * Circuit breaker configuration
 */
export interface CircuitBreakerConfig {
  /** Failure threshold to open circuit */
  failureThreshold: number;
  /** Success threshold to close circuit from half-open */
  successThreshold: number;
  /** Timeout before moving from open to half-open (ms) */
  timeout: number;
  /** Monitoring window duration (ms) */
  monitoringWindow: number;
  /** Minimum number of requests in monitoring window */
  minimumRequests: number;
  /** Function to determine if error should trigger circuit breaker */
  shouldTrigger?: (error: fluxhttpError) => boolean;
  /** Function to determine if response should count as success */
  isSuccess?: (response: fluxhttpResponse) => boolean;
  /** Name for logging and identification */
  name?: string;
}

/**
 * Circuit breaker statistics
 */
export interface CircuitBreakerStats {
  /** Current state */
  state: CircuitState;
  /** Total number of requests */
  totalRequests: number;
  /** Number of failed requests */
  failedRequests: number;
  /** Number of successful requests */
  successfulRequests: number;
  /** Failure rate percentage */
  failureRate: number;
  /** Time when circuit was last opened */
  lastFailureTime?: number;
  /** Time when circuit was last closed */
  lastSuccessTime?: number;
  /** Number of requests rejected due to open circuit */
  rejectedRequests: number;
  /** Average response time */
  averageResponseTime: number;
}

/**
 * Request attempt record
 */
interface RequestAttempt {
  timestamp: number;
  success: boolean;
  responseTime: number;
  error?: fluxhttpError;
}

/**
 * Circuit breaker implementation
 */
export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime = 0;
  private requestHistory: RequestAttempt[] = [];
  private stateChangeListeners: Array<(state: CircuitState, stats: CircuitBreakerStats) => void> = [];
  // BUG-003 FIX: Add instance variable to track rejected requests
  private rejectedRequestsCount = 0;

  constructor(private config: Required<CircuitBreakerConfig>) {}

  /**
   * Execute a request through the circuit breaker
   */
  async execute<T>(
    requestFn: () => Promise<fluxhttpResponse<T>>
  ): Promise<fluxhttpResponse<T>> {
    if (this.state === CircuitState.OPEN) {
      if (this.shouldAttemptReset()) {
        this.setState(CircuitState.HALF_OPEN);
      } else {
        this.recordRejection();
        throw this.createCircuitBreakerError();
      }
    }

    const startTime = Date.now();
    
    try {
      const response = await requestFn();
      const responseTime = Date.now() - startTime;
      
      this.recordSuccess(responseTime, response);
      return response;
    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.recordFailure(responseTime, error as fluxhttpError);
      throw error;
    }
  }

  /**
   * Record a successful request
   */
  private recordSuccess(responseTime: number, response: fluxhttpResponse): void {
    const isSuccess = this.config.isSuccess ? this.config.isSuccess(response) : true;
    
    this.addToHistory({
      timestamp: Date.now(),
      success: isSuccess,
      responseTime
    });

    if (isSuccess) {
      this.onSuccess();
    } else {
      this.onFailure();
    }
  }

  /**
   * Record a failed request
   */
  private recordFailure(responseTime: number, error: fluxhttpError): void {
    const shouldTrigger = this.config.shouldTrigger ? this.config.shouldTrigger(error) : true;
    
    this.addToHistory({
      timestamp: Date.now(),
      success: false,
      responseTime,
      error
    });

    if (shouldTrigger) {
      this.onFailure();
    }
  }

  /**
   * Record a rejected request (circuit open)
   */
  private recordRejection(): void {
    // BUG-003 FIX: Increment instance variable instead of mutating returned stats
    this.rejectedRequestsCount++;
  }

  /**
   * Add request to history and clean old entries
   */
  private addToHistory(attempt: RequestAttempt): void {
    this.requestHistory.push(attempt);
    this.cleanupHistory();
  }

  /**
   * Remove old entries outside monitoring window
   */
  private cleanupHistory(): void {
    const cutoff = Date.now() - this.config.monitoringWindow;
    this.requestHistory = this.requestHistory.filter(attempt => attempt.timestamp > cutoff);
  }

  /**
   * Handle successful request
   */
  private onSuccess(): void {
    this.failureCount = 0;
    
    if (this.state === CircuitState.HALF_OPEN) {
      this.successCount++;
      if (this.successCount >= this.config.successThreshold) {
        this.setState(CircuitState.CLOSED);
      }
    }
  }

  /**
   * Handle failed request
   */
  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    
    if (this.state === CircuitState.HALF_OPEN) {
      this.setState(CircuitState.OPEN);
    } else if (this.state === CircuitState.CLOSED) {
      if (this.shouldOpenCircuit()) {
        this.setState(CircuitState.OPEN);
      }
    }
  }

  /**
   * Check if circuit should be opened
   */
  private shouldOpenCircuit(): boolean {
    this.cleanupHistory();
    
    const recentRequests = this.requestHistory.length;
    
    if (recentRequests < this.config.minimumRequests) {
      return false;
    }

    const failedRequests = this.requestHistory.filter(attempt => !attempt.success).length;
    const failureRate = failedRequests / recentRequests;
    
    return failureRate >= this.config.failureThreshold;
  }

  /**
   * Check if circuit should attempt reset from open to half-open
   */
  private shouldAttemptReset(): boolean {
    return Date.now() - this.lastFailureTime >= this.config.timeout;
  }

  /**
   * Set circuit state and notify listeners
   */
  private setState(newState: CircuitState): void {
    const oldState = this.state;
    this.state = newState;
    
    if (newState === CircuitState.CLOSED) {
      this.successCount = 0;
    } else if (newState === CircuitState.HALF_OPEN) {
      this.successCount = 0;
    }
    
    if (oldState !== newState) {
      const stats = this.getStats();
      this.stateChangeListeners.forEach(listener => listener(newState, stats));
    }
  }

  /**
   * Create circuit breaker error
   */
  private createCircuitBreakerError(): Error {
    const error = new Error(`Circuit breaker is OPEN for ${this.config.name || 'unnamed circuit'}`);
    (error as any).code = 'CIRCUIT_BREAKER_OPEN';
    (error as any).circuitBreakerName = this.config.name;
    return error;
  }

  /**
   * Get current statistics
   */
  getStats(): CircuitBreakerStats {
    this.cleanupHistory();
    
    const totalRequests = this.requestHistory.length;
    const failedRequests = this.requestHistory.filter(attempt => !attempt.success).length;
    const successfulRequests = totalRequests - failedRequests;
    const failureRate = totalRequests > 0 ? (failedRequests / totalRequests) * 100 : 0;
    
    const responseTimes = this.requestHistory.map(attempt => attempt.responseTime);
    const averageResponseTime = responseTimes.length > 0 
      ? responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length 
      : 0;

    return {
      state: this.state,
      totalRequests,
      failedRequests,
      successfulRequests,
      failureRate,
      lastFailureTime: this.lastFailureTime || undefined,
      lastSuccessTime: this.requestHistory
        .filter(attempt => attempt.success)
        .pop()?.timestamp,
      rejectedRequests: this.rejectedRequestsCount, // BUG-003 FIX: Return tracked value
      averageResponseTime
    };
  }

  /**
   * Add state change listener
   */
  onStateChange(listener: (state: CircuitState, stats: CircuitBreakerStats) => void): void {
    this.stateChangeListeners.push(listener);
  }

  /**
   * Remove state change listener
   */
  removeStateChangeListener(listener: (state: CircuitState, stats: CircuitBreakerStats) => void): void {
    const index = this.stateChangeListeners.indexOf(listener);
    if (index > -1) {
      this.stateChangeListeners.splice(index, 1);
    }
  }

  /**
   * Reset circuit breaker to initial state
   */
  reset(): void {
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = 0;
    this.requestHistory = [];
    // BUG-003 FIX: Reset rejected requests counter
    this.rejectedRequestsCount = 0;
  }

  /**
   * Get current state
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * Force circuit to open state
   */
  forceOpen(): void {
    this.setState(CircuitState.OPEN);
  }

  /**
   * Force circuit to closed state
   */
  forceClosed(): void {
    this.setState(CircuitState.CLOSED);
  }
}

/**
 * Advanced retry configuration
 */
export interface AdvancedRetryConfig {
  /** Maximum number of retry attempts */
  maxAttempts: number;
  /** Initial delay between retries */
  initialDelay: number;
  /** Maximum delay between retries */
  maxDelay: number;
  /** Backoff strategy */
  backoffStrategy: 'exponential' | 'linear' | 'constant' | 'fibonacci';
  /** Jitter configuration */
  jitter: {
    /** Whether to enable jitter */
    enabled: boolean;
    /** Jitter type */
    type: 'full' | 'equal' | 'decorrelated';
    /** Maximum jitter amount (0-1) */
    maxJitter: number;
  };
  /** Retry conditions */
  retryCondition: {
    /** HTTP status codes to retry */
    statusCodes?: number[];
    /** Error codes to retry */
    errorCodes?: string[];
    /** Custom retry condition function */
    custom?: (error: fluxhttpError, attempt: number) => boolean;
  };
  /** Timeout for each retry attempt */
  attemptTimeout?: number;
  /** Overall timeout for all retry attempts */
  totalTimeout?: number;
  /** Whether to retry on network errors */
  retryOnNetworkError: boolean;
  /** Whether to retry on timeout errors */
  retryOnTimeout: boolean;
}

/**
 * Retry attempt information
 */
export interface RetryAttempt {
  /** Attempt number (1-based) */
  attemptNumber: number;
  /** Delay before this attempt */
  delay: number;
  /** Error from previous attempt */
  previousError?: fluxhttpError;
  /** Total elapsed time */
  elapsedTime: number;
}

/**
 * Advanced retry mechanism with circuit breaker integration
 */
export class AdvancedRetryMechanism {
  private circuitBreakers = new Map<string, CircuitBreaker>();

  constructor(
    private defaultConfig: Partial<AdvancedRetryConfig> = {},
    private defaultCircuitBreakerConfig: Partial<CircuitBreakerConfig> = {}
  ) {}

  /**
   * Execute request with retry logic and circuit breaker
   */
  async executeWithRetry<T>(
    requestFn: () => Promise<fluxhttpResponse<T>>,
    config?: Partial<AdvancedRetryConfig>,
    circuitBreakerName?: string
  ): Promise<fluxhttpResponse<T>> {
    const retryConfig = this.mergeRetryConfig(config);
    const startTime = Date.now();
    let lastError: fluxhttpError;

    // Get or create circuit breaker
    let circuitBreaker: CircuitBreaker | undefined;
    if (circuitBreakerName) {
      circuitBreaker = this.getOrCreateCircuitBreaker(circuitBreakerName);
    }

    for (let attempt = 1; attempt <= retryConfig.maxAttempts; attempt++) {
      try {
        const elapsedTime = Date.now() - startTime;

        // Check total timeout
        if (retryConfig.totalTimeout && elapsedTime >= retryConfig.totalTimeout) {
          throw this.createTimeoutError('Total retry timeout exceeded', elapsedTime);
        }

        // Execute through circuit breaker if available
        const response = circuitBreaker 
          ? await circuitBreaker.execute(requestFn)
          : await requestFn();

        return response;

      } catch (error) {
        lastError = error as fluxhttpError;
        const elapsedTime = Date.now() - startTime;

        // Check if we should retry
        if (attempt === retryConfig.maxAttempts || !this.shouldRetry(lastError, attempt, retryConfig)) {
          throw lastError;
        }

        // Calculate delay with jitter
        const delay = this.calculateDelay(attempt, retryConfig, elapsedTime);
        
        // Check total timeout including delay
        if (retryConfig.totalTimeout && elapsedTime + delay >= retryConfig.totalTimeout) {
          throw this.createTimeoutError('Total retry timeout would be exceeded', elapsedTime);
        }

        // Wait before retry
        await this.delay(delay);
      }
    }

    throw lastError!;
  }

  /**
   * Get or create circuit breaker for a given name
   */
  private getOrCreateCircuitBreaker(name: string): CircuitBreaker {
    if (!this.circuitBreakers.has(name)) {
      const config = this.mergeCircuitBreakerConfig({ name });
      const circuitBreaker = new CircuitBreaker(config);
      this.circuitBreakers.set(name, circuitBreaker);
    }
    return this.circuitBreakers.get(name)!;
  }

  /**
   * Merge retry configuration with defaults
   */
  private mergeRetryConfig(config?: Partial<AdvancedRetryConfig>): Required<AdvancedRetryConfig> {
    return {
      maxAttempts: 3,
      initialDelay: 1000,
      maxDelay: 30000,
      backoffStrategy: 'exponential',
      jitter: {
        enabled: true,
        type: 'full',
        maxJitter: 0.1
      },
      retryCondition: {
        statusCodes: [408, 429, 500, 502, 503, 504],
        errorCodes: ['TIMEOUT', 'NETWORK_ERROR', 'CONNECTION_ERROR'],
        custom: undefined
      },
      attemptTimeout: undefined,
      totalTimeout: undefined,
      retryOnNetworkError: true,
      retryOnTimeout: true,
      ...this.defaultConfig,
      ...config,
      jitter: {
        ...this.defaultConfig.jitter,
        ...config?.jitter
      },
      retryCondition: {
        ...this.defaultConfig.retryCondition,
        ...config?.retryCondition
      }
    };
  }

  /**
   * Merge circuit breaker configuration with defaults
   */
  private mergeCircuitBreakerConfig(config?: Partial<CircuitBreakerConfig>): Required<CircuitBreakerConfig> {
    return {
      failureThreshold: 0.5,
      successThreshold: 3,
      timeout: 60000,
      monitoringWindow: 60000,
      minimumRequests: 10,
      shouldTrigger: undefined,
      isSuccess: undefined,
      name: 'default',
      ...this.defaultCircuitBreakerConfig,
      ...config
    };
  }

  /**
   * Check if error should trigger a retry
   */
  private shouldRetry(error: fluxhttpError, attempt: number, config: Required<AdvancedRetryConfig>): boolean {
    // Custom retry condition takes precedence
    if (config.retryCondition.custom) {
      return config.retryCondition.custom(error, attempt);
    }

    // Check status codes
    if (error.response?.status && config.retryCondition.statusCodes) {
      if (config.retryCondition.statusCodes.includes(error.response.status)) {
        return true;
      }
    }

    // Check error codes
    if (error.code && config.retryCondition.errorCodes) {
      if (config.retryCondition.errorCodes.includes(error.code)) {
        return true;
      }
    }

    // Check network errors
    if (config.retryOnNetworkError && this.isNetworkError(error)) {
      return true;
    }

    // Check timeout errors
    if (config.retryOnTimeout && this.isTimeoutError(error)) {
      return true;
    }

    return false;
  }

  /**
   * Calculate delay for retry attempt
   */
  private calculateDelay(attempt: number, config: Required<AdvancedRetryConfig>, elapsedTime: number): number {
    let delay: number;

    switch (config.backoffStrategy) {
      case 'exponential':
        delay = Math.min(config.initialDelay * Math.pow(2, attempt - 1), config.maxDelay);
        break;
      case 'linear':
        delay = Math.min(config.initialDelay * attempt, config.maxDelay);
        break;
      case 'fibonacci':
        delay = Math.min(this.fibonacci(attempt) * config.initialDelay, config.maxDelay);
        break;
      case 'constant':
      default:
        delay = config.initialDelay;
        break;
    }

    // Apply jitter if enabled
    if (config.jitter.enabled) {
      delay = this.applyJitter(delay, config.jitter, attempt);
    }

    return Math.max(0, delay);
  }

  /**
   * Apply jitter to delay
   */
  private applyJitter(delay: number, jitterConfig: Required<AdvancedRetryConfig>['jitter'], attempt: number): number {
    const { type, maxJitter } = jitterConfig;

    switch (type) {
      case 'full':
        // BUG-018 FIX: Use (1 - maxJitter * Math.random()) to avoid too-small delays
        return delay * (1 - maxJitter * Math.random());
      case 'equal':
        return delay + (Math.random() * delay * maxJitter);
      case 'decorrelated':
        // Cap at 3 * base delay for decorrelated jitter
        return Math.min(delay * 3, Math.random() * delay * (maxJitter + 1));
      default:
        return delay;
    }
  }

  /**
   * Calculate fibonacci number
   */
  private fibonacci(n: number): number {
    if (n <= 1) return 1;
    let a = 1, b = 1;
    for (let i = 2; i < n; i++) {
      [a, b] = [b, a + b];
    }
    return b;
  }

  /**
   * Check if error is a network error
   */
  private isNetworkError(error: fluxhttpError): boolean {
    return !error.response && (
      error.code === 'NETWORK_ERROR' ||
      error.code === 'CONNECTION_ERROR' ||
      error.message.toLowerCase().includes('network') ||
      error.message.toLowerCase().includes('connection')
    );
  }

  /**
   * Check if error is a timeout error
   */
  private isTimeoutError(error: fluxhttpError): boolean {
    return error.code === 'TIMEOUT' || 
           error.code === 'ECONNRESET' ||
           error.message.toLowerCase().includes('timeout');
  }

  /**
   * Create timeout error
   */
  private createTimeoutError(message: string, elapsedTime: number): Error {
    const error = new Error(`${message} (elapsed: ${elapsedTime}ms)`);
    (error as any).code = 'RETRY_TIMEOUT';
    (error as any).elapsedTime = elapsedTime;
    return error;
  }

  /**
   * Delay execution
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get circuit breaker by name
   */
  getCircuitBreaker(name: string): CircuitBreaker | undefined {
    return this.circuitBreakers.get(name);
  }

  /**
   * Get all circuit breaker statistics
   */
  getAllCircuitBreakerStats(): Record<string, CircuitBreakerStats> {
    const stats: Record<string, CircuitBreakerStats> = {};
    for (const [name, circuitBreaker] of this.circuitBreakers) {
      stats[name] = circuitBreaker.getStats();
    }
    return stats;
  }

  /**
   * Reset all circuit breakers
   */
  resetAllCircuitBreakers(): void {
    for (const circuitBreaker of this.circuitBreakers.values()) {
      circuitBreaker.reset();
    }
  }

  /**
   * Remove circuit breaker
   */
  removeCircuitBreaker(name: string): boolean {
    return this.circuitBreakers.delete(name);
  }
}

export default AdvancedRetryMechanism;