/**
 * @fileoverview Middleware system for FluxHTTP
 * @module @fluxhttp/core/features/middleware
 */

import type { fluxhttpRequestConfig, fluxhttpResponse, fluxhttpError } from '../types';

/**
 * Middleware execution context
 */
export interface MiddlewareContext {
  /** Request configuration */
  config: fluxhttpRequestConfig;
  /** Response (available in response middleware) */
  response?: fluxhttpResponse;
  /** Error (available in error middleware) */
  error?: fluxhttpError;
  /** Middleware metadata */
  metadata: Map<string, unknown>;
  /** Execution start time */
  startTime: number;
  /** Request ID for tracing */
  requestId: string;
  /** Abort signal for cancellation */
  signal?: AbortSignal;
}

/**
 * Base middleware interface
 */
export interface Middleware {
  /** Middleware name for identification */
  name: string;
  /** Middleware priority (lower numbers execute first) */
  priority?: number;
  /** Whether this middleware is enabled */
  enabled?: boolean;
  /** Conditions for when this middleware should run */
  conditions?: MiddlewareConditions;
}

/**
 * Conditions for middleware execution
 */
export interface MiddlewareConditions {
  /** URLs to include (regex patterns) */
  includeUrls?: RegExp[];
  /** URLs to exclude (regex patterns) */
  excludeUrls?: RegExp[];
  /** HTTP methods to include */
  includeMethods?: string[];
  /** HTTP methods to exclude */
  excludeMethods?: string[];
  /** Custom condition function */
  custom?: (context: MiddlewareContext) => boolean;
}

/**
 * Request middleware interface
 */
export interface RequestMiddleware extends Middleware {
  /** Execute before request is sent */
  execute(context: MiddlewareContext): Promise<MiddlewareContext> | MiddlewareContext;
}

/**
 * Response middleware interface
 */
export interface ResponseMiddleware extends Middleware {
  /** Execute after successful response */
  execute(context: MiddlewareContext): Promise<MiddlewareContext> | MiddlewareContext;
}

/**
 * Error middleware interface
 */
export interface ErrorMiddleware extends Middleware {
  /** Execute when an error occurs */
  execute(context: MiddlewareContext): Promise<MiddlewareContext> | MiddlewareContext;
}

/**
 * Middleware pipeline configuration
 */
export interface MiddlewarePipelineConfig {
  /** Whether to stop on first error */
  stopOnError?: boolean;
  /** Timeout for middleware execution */
  timeout?: number;
  /** Whether to enable middleware performance tracking */
  enableProfiling?: boolean;
  /** Maximum number of middleware that can be registered */
  maxMiddleware?: number;
}

/**
 * Middleware execution result
 */
export interface MiddlewareExecutionResult {
  /** Whether execution was successful */
  success: boolean;
  /** Execution context after middleware */
  context: MiddlewareContext;
  /** Error if execution failed */
  error?: Error;
  /** Execution statistics */
  stats: MiddlewareExecutionStats;
}

/**
 * Middleware execution statistics
 */
export interface MiddlewareExecutionStats {
  /** Total execution time */
  totalTime: number;
  /** Number of middleware executed */
  middlewareCount: number;
  /** Per-middleware execution times */
  middlewareTimes: Record<string, number>;
  /** Memory usage before and after */
  memoryUsage?: {
    before: NodeJS.MemoryUsage;
    after: NodeJS.MemoryUsage;
  };
}

/**
 * Middleware performance metrics
 */
export interface MiddlewareMetrics {
  /** Middleware name */
  name: string;
  /** Total executions */
  totalExecutions: number;
  /** Total execution time */
  totalTime: number;
  /** Average execution time */
  averageTime: number;
  /** Minimum execution time */
  minTime: number;
  /** Maximum execution time */
  maxTime: number;
  /** Success rate */
  successRate: number;
  /** Error count */
  errorCount: number;
  /** Last execution time */
  lastExecutionTime?: number;
}

/**
 * Middleware pipeline for managing and executing middleware
 */
export class MiddlewarePipeline {
  private requestMiddleware: RequestMiddleware[] = [];
  private responseMiddleware: ResponseMiddleware[] = [];
  private errorMiddleware: ErrorMiddleware[] = [];
  private metrics = new Map<string, MiddlewareMetrics>();
  private requestIdCounter = 0;

  constructor(private config: MiddlewarePipelineConfig = {}) {
    this.config = {
      stopOnError: true,
      timeout: 10000,
      enableProfiling: false,
      maxMiddleware: 100,
      ...config
    };
  }

  /**
   * Add request middleware
   */
  addRequestMiddleware(middleware: RequestMiddleware): void {
    this.validateAndAddMiddleware(this.requestMiddleware, middleware);
  }

  /**
   * Add response middleware
   */
  addResponseMiddleware(middleware: ResponseMiddleware): void {
    this.validateAndAddMiddleware(this.responseMiddleware, middleware);
  }

  /**
   * Add error middleware
   */
  addErrorMiddleware(middleware: ErrorMiddleware): void {
    this.validateAndAddMiddleware(this.errorMiddleware, middleware);
  }

  /**
   * Validate and add middleware to array
   */
  private validateAndAddMiddleware<T extends Middleware>(array: T[], middleware: T): void {
    if (array.length >= (this.config.maxMiddleware || 100)) {
      throw new Error(`Maximum middleware limit reached (${this.config.maxMiddleware})`);
    }

    if (array.find(m => m.name === middleware.name)) {
      throw new Error(`Middleware with name '${middleware.name}' already exists`);
    }

    array.push(middleware);
    this.sortMiddlewareByPriority(array);
    this.initializeMetrics(middleware.name);
  }

  /**
   * Sort middleware by priority
   */
  private sortMiddlewareByPriority<T extends Middleware>(array: T[]): void {
    array.sort((a, b) => (a.priority || 0) - (b.priority || 0));
  }

  /**
   * Initialize metrics for middleware
   */
  private initializeMetrics(name: string): void {
    this.metrics.set(name, {
      name,
      totalExecutions: 0,
      totalTime: 0,
      averageTime: 0,
      minTime: Infinity,
      maxTime: 0,
      successRate: 100,
      errorCount: 0
    });
  }

  /**
   * Execute request middleware pipeline
   */
  async executeRequestMiddleware(config: fluxhttpRequestConfig): Promise<MiddlewareExecutionResult> {
    const context = this.createContext(config);
    return this.executeMiddlewarePipeline(this.requestMiddleware, context);
  }

  /**
   * Execute response middleware pipeline
   */
  async executeResponseMiddleware(
    config: fluxhttpRequestConfig,
    response: fluxhttpResponse
  ): Promise<MiddlewareExecutionResult> {
    const context = this.createContext(config, response);
    return this.executeMiddlewarePipeline(this.responseMiddleware, context);
  }

  /**
   * Execute error middleware pipeline
   */
  async executeErrorMiddleware(
    config: fluxhttpRequestConfig,
    error: fluxhttpError
  ): Promise<MiddlewareExecutionResult> {
    const context = this.createContext(config, undefined, error);
    return this.executeMiddlewarePipeline(this.errorMiddleware, context);
  }

  /**
   * Create middleware context
   */
  private createContext(
    config: fluxhttpRequestConfig,
    response?: fluxhttpResponse,
    error?: fluxhttpError
  ): MiddlewareContext {
    return {
      config: { ...config },
      response,
      error,
      metadata: new Map(),
      startTime: Date.now(),
      requestId: this.generateRequestId(),
      signal: config.signal
    };
  }

  /**
   * Execute middleware pipeline
   */
  private async executeMiddlewarePipeline<T extends Middleware>(
    middleware: T[],
    context: MiddlewareContext
  ): Promise<MiddlewareExecutionResult> {
    const startTime = Date.now();
    const middlewareTimes: Record<string, number> = {};
    let middlewareCount = 0;
    let memoryBefore: NodeJS.MemoryUsage | undefined;
    let memoryAfter: NodeJS.MemoryUsage | undefined;

    if (this.config.enableProfiling && typeof process !== 'undefined' && process.memoryUsage) {
      memoryBefore = process.memoryUsage();
    }

    try {
      for (const mw of middleware) {
        if (!this.shouldExecuteMiddleware(mw, context)) {
          continue;
        }

        const mwStartTime = Date.now();
        
        try {
          // Execute with timeout
          const result = await this.executeWithTimeout(
            () => mw.execute(context),
            this.config.timeout || 10000,
            `Middleware '${mw.name}' execution timeout`
          );

          // Update context
          Object.assign(context, result);
          
          const executionTime = Date.now() - mwStartTime;
          middlewareTimes[mw.name] = executionTime;
          middlewareCount++;

          this.updateMetrics(mw.name, executionTime, true);

        } catch (error) {
          const executionTime = Date.now() - mwStartTime;
          middlewareTimes[mw.name] = executionTime;
          this.updateMetrics(mw.name, executionTime, false);

          if (this.config.stopOnError) {
            throw error;
          }
          
          // Log error but continue
          console.warn(`Middleware '${mw.name}' failed:`, error);
        }

        // Check for cancellation
        if (context.signal?.aborted) {
          throw new Error('Middleware execution cancelled');
        }
      }

      if (this.config.enableProfiling && typeof process !== 'undefined' && process.memoryUsage) {
        memoryAfter = process.memoryUsage();
      }

      const totalTime = Date.now() - startTime;

      return {
        success: true,
        context,
        stats: {
          totalTime,
          middlewareCount,
          middlewareTimes,
          memoryUsage: memoryBefore && memoryAfter ? {
            before: memoryBefore,
            after: memoryAfter
          } : undefined
        }
      };

    } catch (error) {
      if (this.config.enableProfiling && typeof process !== 'undefined' && process.memoryUsage) {
        memoryAfter = process.memoryUsage();
      }

      const totalTime = Date.now() - startTime;

      return {
        success: false,
        context,
        error: error as Error,
        stats: {
          totalTime,
          middlewareCount,
          middlewareTimes,
          memoryUsage: memoryBefore && memoryAfter ? {
            before: memoryBefore,
            after: memoryAfter
          } : undefined
        }
      };
    }
  }

  /**
   * Check if middleware should execute based on conditions
   */
  private shouldExecuteMiddleware(middleware: Middleware, context: MiddlewareContext): boolean {
    if (middleware.enabled === false) {
      return false;
    }

    const conditions = middleware.conditions;
    if (!conditions) {
      return true;
    }

    const url = context.config.url || '';
    const method = context.config.method?.toUpperCase() || 'GET';

    // Check URL inclusion
    if (conditions.includeUrls && conditions.includeUrls.length > 0) {
      if (!conditions.includeUrls.some(pattern => pattern.test(url))) {
        return false;
      }
    }

    // Check URL exclusion
    if (conditions.excludeUrls && conditions.excludeUrls.length > 0) {
      if (conditions.excludeUrls.some(pattern => pattern.test(url))) {
        return false;
      }
    }

    // Check method inclusion
    if (conditions.includeMethods && conditions.includeMethods.length > 0) {
      if (!conditions.includeMethods.includes(method)) {
        return false;
      }
    }

    // Check method exclusion
    if (conditions.excludeMethods && conditions.excludeMethods.length > 0) {
      if (conditions.excludeMethods.includes(method)) {
        return false;
      }
    }

    // Check custom condition
    if (conditions.custom) {
      return conditions.custom(context);
    }

    return true;
  }

  /**
   * Execute function with timeout
   */
  private async executeWithTimeout<T>(
    fn: () => Promise<T> | T,
    timeout: number,
    errorMessage: string
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(errorMessage));
      }, timeout);

      Promise.resolve(fn())
        .then(result => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }

  /**
   * Update middleware metrics
   */
  private updateMetrics(name: string, executionTime: number, success: boolean): void {
    const metrics = this.metrics.get(name);
    if (!metrics) return;

    metrics.totalExecutions++;
    metrics.totalTime += executionTime;
    metrics.averageTime = metrics.totalTime / metrics.totalExecutions;
    metrics.minTime = Math.min(metrics.minTime, executionTime);
    metrics.maxTime = Math.max(metrics.maxTime, executionTime);
    metrics.lastExecutionTime = Date.now();

    if (!success) {
      metrics.errorCount++;
    }

    metrics.successRate = ((metrics.totalExecutions - metrics.errorCount) / metrics.totalExecutions) * 100;
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `req-${Date.now()}-${++this.requestIdCounter}`;
  }

  /**
   * Remove middleware by name
   */
  removeMiddleware(name: string): boolean {
    const removed = 
      this.removeFromArray(this.requestMiddleware, name) ||
      this.removeFromArray(this.responseMiddleware, name) ||
      this.removeFromArray(this.errorMiddleware, name);

    if (removed) {
      this.metrics.delete(name);
    }

    return removed;
  }

  /**
   * Remove middleware from array by name
   */
  private removeFromArray<T extends Middleware>(array: T[], name: string): boolean {
    const index = array.findIndex(m => m.name === name);
    if (index > -1) {
      array.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * Enable/disable middleware
   */
  setMiddlewareEnabled(name: string, enabled: boolean): boolean {
    const middleware = this.findMiddleware(name);
    if (middleware) {
      middleware.enabled = enabled;
      return true;
    }
    return false;
  }

  /**
   * Find middleware by name
   */
  private findMiddleware(name: string): Middleware | undefined {
    return [...this.requestMiddleware, ...this.responseMiddleware, ...this.errorMiddleware]
      .find(m => m.name === name);
  }

  /**
   * Get middleware metrics
   */
  getMetrics(name?: string): MiddlewareMetrics | Record<string, MiddlewareMetrics> {
    if (name) {
      const metrics = this.metrics.get(name);
      if (!metrics) {
        throw new Error(`No metrics found for middleware '${name}'`);
      }
      return metrics;
    }

    const allMetrics: Record<string, MiddlewareMetrics> = {};
    for (const [name, metrics] of this.metrics) {
      allMetrics[name] = { ...metrics };
    }
    return allMetrics;
  }

  /**
   * Reset metrics for all or specific middleware
   */
  resetMetrics(name?: string): void {
    if (name) {
      this.initializeMetrics(name);
    } else {
      for (const middlewareName of this.metrics.keys()) {
        this.initializeMetrics(middlewareName);
      }
    }
  }

  /**
   * Get middleware lists
   */
  getMiddleware(): {
    request: RequestMiddleware[];
    response: ResponseMiddleware[];
    error: ErrorMiddleware[];
  } {
    return {
      request: [...this.requestMiddleware],
      response: [...this.responseMiddleware],
      error: [...this.errorMiddleware]
    };
  }

  /**
   * Clear all middleware
   */
  clear(): void {
    this.requestMiddleware = [];
    this.responseMiddleware = [];
    this.errorMiddleware = [];
    this.metrics.clear();
  }

  /**
   * Get pipeline statistics
   */
  getStats(): {
    totalMiddleware: number;
    requestMiddleware: number;
    responseMiddleware: number;
    errorMiddleware: number;
    enabledMiddleware: number;
    disabledMiddleware: number;
  } {
    const allMiddleware = [...this.requestMiddleware, ...this.responseMiddleware, ...this.errorMiddleware];
    const enabled = allMiddleware.filter(m => m.enabled !== false).length;
    
    return {
      totalMiddleware: allMiddleware.length,
      requestMiddleware: this.requestMiddleware.length,
      responseMiddleware: this.responseMiddleware.length,
      errorMiddleware: this.errorMiddleware.length,
      enabledMiddleware: enabled,
      disabledMiddleware: allMiddleware.length - enabled
    };
  }
}

/**
 * Composable middleware utilities
 */
export class MiddlewareComposer {
  /**
   * Compose multiple request middleware into one
   */
  static composeRequest(middleware: RequestMiddleware[]): RequestMiddleware {
    return {
      name: `composed-request-${Date.now()}`,
      execute: async (context: MiddlewareContext) => {
        let currentContext = context;
        for (const mw of middleware) {
          currentContext = await mw.execute(currentContext);
        }
        return currentContext;
      }
    };
  }

  /**
   * Compose multiple response middleware into one
   */
  static composeResponse(middleware: ResponseMiddleware[]): ResponseMiddleware {
    return {
      name: `composed-response-${Date.now()}`,
      execute: async (context: MiddlewareContext) => {
        let currentContext = context;
        for (const mw of middleware) {
          currentContext = await mw.execute(currentContext);
        }
        return currentContext;
      }
    };
  }

  /**
   * Create conditional middleware wrapper
   */
  static conditional<T extends Middleware>(
    middleware: T,
    condition: (context: MiddlewareContext) => boolean
  ): T {
    return {
      ...middleware,
      name: `conditional-${middleware.name}`,
      conditions: {
        ...middleware.conditions,
        custom: condition
      }
    };
  }

  /**
   * Create middleware that only runs once
   */
  static once<T extends Middleware>(middleware: T): T {
    let hasRun = false;
    
    return {
      ...middleware,
      name: `once-${middleware.name}`,
      execute: async (context: MiddlewareContext) => {
        if (hasRun) {
          return context;
        }
        hasRun = true;
        return middleware.execute(context);
      }
    };
  }

  /**
   * Create middleware with retry logic
   */
  static withRetry<T extends Middleware>(
    middleware: T,
    maxRetries = 3,
    delay = 1000
  ): T {
    return {
      ...middleware,
      name: `retry-${middleware.name}`,
      execute: async (context: MiddlewareContext) => {
        let lastError: Error | undefined;
        
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
          try {
            return await middleware.execute(context);
          } catch (error) {
            lastError = error as Error;
            if (attempt < maxRetries) {
              await new Promise(resolve => setTimeout(resolve, delay));
            }
          }
        }
        
        throw lastError;
      }
    };
  }
}

export default MiddlewarePipeline;