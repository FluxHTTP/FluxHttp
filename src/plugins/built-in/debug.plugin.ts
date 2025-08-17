/**
 * @fileoverview Debug plugin for FluxHTTP
 * @module @fluxhttp/plugins/built-in/debug
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
 * Debug levels
 */
export type DebugLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error';

/**
 * Debug configuration
 */
export interface DebugPluginConfig extends PluginConfig {
  settings: {
    /** Debug level */
    level?: DebugLevel;
    /** Debug namespace for filtering */
    namespace?: string;
    /** Enable request debugging */
    request?: {
      enabled: boolean;
      headers: boolean;
      body: boolean;
      params: boolean;
      timing: boolean;
      curl: boolean;
    };
    /** Enable response debugging */
    response?: {
      enabled: boolean;
      headers: boolean;
      body: boolean;
      timing: boolean;
      size: boolean;
    };
    /** Enable error debugging */
    error?: {
      enabled: boolean;
      stackTrace: boolean;
      context: boolean;
      suggestion: boolean;
    };
    /** Enable performance debugging */
    performance?: {
      enabled: boolean;
      slowRequestThreshold: number;
      memoryTracking: boolean;
      networkTimings: boolean;
    };
    /** Enable interceptor debugging */
    interceptors?: {
      enabled: boolean;
      logRegistration: boolean;
      logExecution: boolean;
      logOrder: boolean;
    };
    /** Browser DevTools integration */
    devtools?: {
      enabled: boolean;
      groupRequests: boolean;
      useColors: boolean;
      expandDetails: boolean;
    };
    /** Debug output configuration */
    output?: {
      console: boolean;
      storage: boolean;
      callback?: (entry: DebugEntry) => void;
    };
    /** Debug filters */
    filters?: {
      includeUrls?: (string | RegExp)[];
      excludeUrls?: (string | RegExp)[];
      includeMethods?: string[];
      excludeMethods?: string[];
      includeStatusCodes?: number[];
      excludeStatusCodes?: number[];
    };
    /** Debug formatting */
    format?: {
      timestamps: boolean;
      colors: boolean;
      compact: boolean;
      prettify: boolean;
      maxBodyLength: number;
      maxHeaderLength: number;
    };
  };
}

/**
 * Debug entry interface
 */
export interface DebugEntry {
  /** Entry type */
  type: 'request' | 'response' | 'error' | 'performance' | 'interceptor' | 'system';
  /** Debug level */
  level: DebugLevel;
  /** Timestamp */
  timestamp: number;
  /** Request ID */
  requestId?: string;
  /** Message */
  message: string;
  /** Debug data */
  data: Record<string, unknown>;
  /** Context information */
  context?: {
    plugin?: string;
    interceptor?: string;
    adapter?: string;
  };
  /** Performance timings */
  timings?: {
    start?: number;
    end?: number;
    duration?: number;
  };
}

/**
 * Request timing data
 */
interface RequestTimings {
  startTime: number;
  endTime?: number;
  duration?: number;
  phases: {
    config?: number;
    interceptors?: {
      request?: number;
      response?: number;
    };
    adapter?: number;
    network?: number;
  };
}

/**
 * Debug plugin implementation
 */
export class DebugPlugin implements Plugin {
  readonly metadata: PluginMetadata = {
    id: 'debug',
    name: 'Debug Plugin',
    version: '1.0.0',
    type: PluginType.DEVELOPER,
    description: 'Provides comprehensive debugging capabilities for HTTP requests and responses',
    author: {
      name: 'FluxHTTP Team',
      email: 'team@fluxhttp.dev'
    },
    license: 'MIT',
    keywords: ['debug', 'development', 'troubleshooting', 'devtools', 'logging'],
    capabilities: {
      canModifyRequest: true,
      canModifyResponse: true,
      canHandleErrors: true,
      canMonitor: true
    },
    priority: PluginPriority.DEBUG
  };

  readonly configSchema: PluginConfigSchema = {
    type: 'object',
    properties: {
      enabled: { type: 'boolean', default: true },
      settings: {
        type: 'object',
        properties: {
          level: {
            type: 'string',
            enum: ['trace', 'debug', 'info', 'warn', 'error'],
            default: 'debug'
          },
          namespace: { type: 'string', default: 'fluxhttp' },
          request: {
            type: 'object',
            properties: {
              enabled: { type: 'boolean', default: true },
              headers: { type: 'boolean', default: true },
              body: { type: 'boolean', default: false },
              params: { type: 'boolean', default: true },
              timing: { type: 'boolean', default: true },
              curl: { type: 'boolean', default: false }
            }
          },
          response: {
            type: 'object',
            properties: {
              enabled: { type: 'boolean', default: true },
              headers: { type: 'boolean', default: false },
              body: { type: 'boolean', default: false },
              timing: { type: 'boolean', default: true },
              size: { type: 'boolean', default: true }
            }
          },
          error: {
            type: 'object',
            properties: {
              enabled: { type: 'boolean', default: true },
              stackTrace: { type: 'boolean', default: true },
              context: { type: 'boolean', default: true },
              suggestion: { type: 'boolean', default: true }
            }
          },
          performance: {
            type: 'object',
            properties: {
              enabled: { type: 'boolean', default: true },
              slowRequestThreshold: { type: 'number', default: 3000 },
              memoryTracking: { type: 'boolean', default: false },
              networkTimings: { type: 'boolean', default: false }
            }
          },
          devtools: {
            type: 'object',
            properties: {
              enabled: { type: 'boolean', default: true },
              groupRequests: { type: 'boolean', default: true },
              useColors: { type: 'boolean', default: true },
              expandDetails: { type: 'boolean', default: false }
            }
          },
          format: {
            type: 'object',
            properties: {
              timestamps: { type: 'boolean', default: true },
              colors: { type: 'boolean', default: true },
              compact: { type: 'boolean', default: false },
              prettify: { type: 'boolean', default: true },
              maxBodyLength: { type: 'number', default: 1000 },
              maxHeaderLength: { type: 'number', default: 500 }
            }
          }
        }
      }
    }
  };

  state = PluginLifecycleState.UNINITIALIZED;
  config: DebugPluginConfig;
  context?: PluginContext;

  private requestTimings = new Map<string, RequestTimings>();
  private debugEntries: DebugEntry[] = [];
  private maxEntries = 1000;
  private levelPriority: Record<DebugLevel, number> = {
    trace: 0,
    debug: 1,
    info: 2,
    warn: 3,
    error: 4
  };

  constructor(config: Partial<DebugPluginConfig> = {}) {
    this.config = {
      enabled: true,
      settings: {
        level: 'debug',
        namespace: 'fluxhttp',
        request: {
          enabled: true,
          headers: true,
          body: false,
          params: true,
          timing: true,
          curl: false
        },
        response: {
          enabled: true,
          headers: false,
          body: false,
          timing: true,
          size: true
        },
        error: {
          enabled: true,
          stackTrace: true,
          context: true,
          suggestion: true
        },
        performance: {
          enabled: true,
          slowRequestThreshold: 3000,
          memoryTracking: false,
          networkTimings: false
        },
        interceptors: {
          enabled: true,
          logRegistration: false,
          logExecution: true,
          logOrder: false
        },
        devtools: {
          enabled: typeof window !== 'undefined',
          groupRequests: true,
          useColors: true,
          expandDetails: false
        },
        output: {
          console: true,
          storage: false
        },
        filters: {},
        format: {
          timestamps: true,
          colors: true,
          compact: false,
          prettify: true,
          maxBodyLength: 1000,
          maxHeaderLength: 500
        },
        ...config.settings
      },
      ...config
    } as DebugPluginConfig;
  }

  /**
   * Initialize plugin
   */
  async init(context: PluginContext): Promise<void> {
    this.context = context;
    
    // Register interceptors
    this.interceptRequest(this.handleRequestDebug.bind(this));
    this.interceptResponse(this.handleResponseDebug.bind(this));
    this.interceptError(this.handleErrorDebug.bind(this));
    
    // Start performance monitoring if enabled
    if (this.config.settings.performance?.enabled) {
      this.startPerformanceMonitoring();
    }
    
    // Log debug initialization
    this.debug('Debug plugin initialized', {
      level: this.config.settings.level,
      namespace: this.config.settings.namespace,
      devtools: this.config.settings.devtools?.enabled
    });
    
    context.logger.info('Debug plugin initialized');
  }

  /**
   * Stop plugin
   */
  async stop(context: PluginContext): Promise<void> {
    // Export debug entries if storage is enabled
    if (this.config.settings.output?.storage) {
      this.exportDebugEntries();
    }
    
    context.logger.info('Debug plugin stopped');
  }

  /**
   * Register request interceptor
   */
  interceptRequest(interceptor: (config: fluxhttpRequestConfig, context: PluginContext) => Promise<fluxhttpRequestConfig> | fluxhttpRequestConfig): void {
    if (this.context?.fluxhttp.interceptors.request) {
      this.context.fluxhttp.interceptors.request.use(
        (config) => interceptor(config, this.context!),
        undefined,
        { runWhen: () => this.config.enabled }
      );
    }
  }

  /**
   * Register response interceptor
   */
  interceptResponse(interceptor: (response: fluxhttpResponse, context: PluginContext) => Promise<fluxhttpResponse> | fluxhttpResponse): void {
    if (this.context?.fluxhttp.interceptors.response) {
      this.context.fluxhttp.interceptors.response.use(
        (response) => interceptor(response, this.context!),
        undefined,
        { runWhen: () => this.config.enabled }
      );
    }
  }

  /**
   * Register error interceptor
   */
  interceptError(interceptor: (error: fluxhttpError, context: PluginContext) => Promise<fluxhttpError> | fluxhttpError): void {
    if (this.context?.fluxhttp.interceptors.response) {
      this.context.fluxhttp.interceptors.response.use(
        undefined,
        (error) => {
          interceptor(error, this.context!);
          return Promise.reject(error);
        },
        { runWhen: () => this.config.enabled }
      );
    }
  }

  /**
   * Handle request debugging
   */
  private handleRequestDebug(config: fluxhttpRequestConfig): fluxhttpRequestConfig {
    if (!this.config.settings.request?.enabled || !this.shouldDebugRequest(config)) {
      return config;
    }

    const requestId = this.generateRequestId();
    const startTime = Date.now();
    
    // Store timing data
    this.requestTimings.set(requestId, {
      startTime,
      phases: {}
    });
    
    // Add request ID to config for tracking
    config.headers = {
      ...config.headers,
      'X-Debug-Request-ID': requestId
    };

    // Create debug entry
    const debugData: Record<string, unknown> = {
      method: config.method || 'GET',
      url: config.url,
      baseURL: config.baseURL
    };

    if (this.config.settings.request.headers && config.headers) {
      debugData.headers = this.sanitizeHeaders(config.headers);
    }

    if (this.config.settings.request.params && config.params) {
      debugData.params = config.params;
    }

    if (this.config.settings.request.body && config.data) {
      debugData.body = this.truncateData(config.data, this.config.settings.format?.maxBodyLength);
    }

    if (this.config.settings.request.curl) {
      debugData.curl = this.generateCurlCommand(config);
    }

    this.debug('HTTP Request', debugData, 'request', requestId);

    // Log to DevTools if enabled
    if (this.config.settings.devtools?.enabled) {
      this.logToDevTools('request', config, requestId);
    }

    return config;
  }

  /**
   * Handle response debugging
   */
  private handleResponseDebug(response: fluxhttpResponse): fluxhttpResponse {
    if (!this.config.settings.response?.enabled) {
      return response;
    }

    const requestId = response.config.headers?.['X-Debug-Request-ID'] as string;
    const timing = this.requestTimings.get(requestId);
    
    if (timing) {
      timing.endTime = Date.now();
      timing.duration = timing.endTime - timing.startTime;
    }

    if (!this.shouldDebugRequest(response.config)) {
      return response;
    }

    // Create debug entry
    const debugData: Record<string, unknown> = {
      status: response.status,
      statusText: response.statusText
    };

    if (this.config.settings.response.headers && response.headers) {
      debugData.headers = this.sanitizeHeaders(response.headers);
    }

    if (this.config.settings.response.body && response.data) {
      debugData.body = this.truncateData(response.data, this.config.settings.format?.maxBodyLength);
    }

    if (this.config.settings.response.size) {
      debugData.size = this.calculateResponseSize(response.data);
    }

    if (this.config.settings.response.timing && timing?.duration) {
      debugData.duration = timing.duration;
      
      // Check for slow requests
      const threshold = this.config.settings.performance?.slowRequestThreshold || 3000;
      if (timing.duration > threshold) {
        this.warn('Slow request detected', {
          ...debugData,
          threshold,
          url: response.config.url
        }, 'performance', requestId);
      }
    }

    const level: DebugLevel = response.status >= 400 ? 'warn' : 'debug';
    this.log(level, 'HTTP Response', debugData, 'response', requestId);

    // Log to DevTools if enabled
    if (this.config.settings.devtools?.enabled) {
      this.logToDevTools('response', response, requestId, timing?.duration);
    }

    // Clean up timing data
    if (requestId) {
      this.requestTimings.delete(requestId);
    }

    return response;
  }

  /**
   * Handle error debugging
   */
  private handleErrorDebug(error: fluxhttpError): fluxhttpError {
    if (!this.config.settings.error?.enabled) {
      return error;
    }

    const requestId = error.config?.headers?.['X-Debug-Request-ID'] as string;
    const timing = this.requestTimings.get(requestId);
    
    if (timing) {
      timing.endTime = Date.now();
      timing.duration = timing.endTime - timing.startTime;
    }

    if (error.config && !this.shouldDebugRequest(error.config)) {
      return error;
    }

    // Create debug entry
    const debugData: Record<string, unknown> = {
      name: error.name,
      message: error.message,
      code: error.code
    };

    if (this.config.settings.error.stackTrace && error.stack) {
      debugData.stack = error.stack;
    }

    if (this.config.settings.error.context) {
      debugData.context = {
        url: error.config?.url,
        method: error.config?.method,
        isfluxhttpError: error.isfluxhttpError,
        hasResponse: !!error.response
      };
    }

    if (error.response) {
      debugData.response = {
        status: error.response.status,
        statusText: error.response.statusText,
        data: this.truncateData(error.response.data, this.config.settings.format?.maxBodyLength)
      };
    }

    if (timing?.duration) {
      debugData.duration = timing.duration;
    }

    if (this.config.settings.error.suggestion) {
      debugData.suggestion = this.generateErrorSuggestion(error);
    }

    this.error('HTTP Error', debugData, 'error', requestId);

    // Log to DevTools if enabled
    if (this.config.settings.devtools?.enabled) {
      this.logToDevTools('error', error, requestId);
    }

    // Clean up timing data
    if (requestId) {
      this.requestTimings.delete(requestId);
    }

    return error;
  }

  /**
   * Start performance monitoring
   */
  private startPerformanceMonitoring(): void {
    setInterval(() => {
      const perfData: Record<string, unknown> = {
        activeRequests: this.requestTimings.size,
        debugEntries: this.debugEntries.length
      };

      if (this.config.settings.performance?.memoryTracking && typeof process !== 'undefined') {
        const memory = process.memoryUsage();
        perfData.memory = {
          rss: memory.rss,
          heapUsed: memory.heapUsed,
          heapTotal: memory.heapTotal,
          external: memory.external
        };
      }

      this.trace('Performance metrics', perfData, 'performance');
    }, 30000); // Every 30 seconds
  }

  /**
   * Check if request should be debugged based on filters
   */
  private shouldDebugRequest(config: fluxhttpRequestConfig): boolean {
    const filters = this.config.settings.filters;
    if (!filters) return true;

    const url = config.url || '';
    const method = (config.method || 'GET').toUpperCase();

    // Check URL filters
    if (filters.includeUrls?.length) {
      const included = filters.includeUrls.some(pattern => this.matchesPattern(url, pattern));
      if (!included) return false;
    }

    if (filters.excludeUrls?.length) {
      const excluded = filters.excludeUrls.some(pattern => this.matchesPattern(url, pattern));
      if (excluded) return false;
    }

    // Check method filters
    if (filters.includeMethods?.length) {
      if (!filters.includeMethods.includes(method)) return false;
    }

    if (filters.excludeMethods?.length) {
      if (filters.excludeMethods.includes(method)) return false;
    }

    return true;
  }

  /**
   * Check if response should be debugged based on status filters
   */
  private shouldDebugResponse(status: number): boolean {
    const filters = this.config.settings.filters;
    if (!filters) return true;

    if (filters.includeStatusCodes?.length) {
      if (!filters.includeStatusCodes.includes(status)) return false;
    }

    if (filters.excludeStatusCodes?.length) {
      if (filters.excludeStatusCodes.includes(status)) return false;
    }

    return true;
  }

  /**
   * Check if pattern matches value
   */
  private matchesPattern(value: string, pattern: string | RegExp): boolean {
    if (pattern instanceof RegExp) {
      return pattern.test(value);
    }
    return value.includes(pattern);
  }

  /**
   * Generate curl command from request config
   */
  private generateCurlCommand(config: fluxhttpRequestConfig): string {
    const parts = ['curl'];
    
    // Method
    if (config.method && config.method !== 'GET') {
      parts.push(`-X ${config.method.toUpperCase()}`);
    }
    
    // Headers
    if (config.headers) {
      for (const [key, value] of Object.entries(config.headers)) {
        if (key !== 'X-Debug-Request-ID') {
          parts.push(`-H "${key}: ${value}"`);
        }
      }
    }
    
    // Data
    if (config.data && ['POST', 'PUT', 'PATCH'].includes((config.method || 'GET').toUpperCase())) {
      const dataStr = typeof config.data === 'string' ? config.data : JSON.stringify(config.data);
      parts.push(`-d '${dataStr}'`);
    }
    
    // URL
    const fullUrl = config.baseURL ? `${config.baseURL}${config.url}` : config.url;
    parts.push(`"${fullUrl}"`);
    
    return parts.join(' ');
  }

  /**
   * Generate error suggestion
   */
  private generateErrorSuggestion(error: fluxhttpError): string {
    if (error.code === 'ECONNREFUSED') {
      return 'Check if the server is running and the URL is correct';
    }
    
    if (error.code === 'ENOTFOUND') {
      return 'Check the hostname/domain in the URL';
    }
    
    if (error.code === 'ECONNABORTED') {
      return 'Request timed out - consider increasing timeout or checking network';
    }
    
    if (error.response?.status === 404) {
      return 'Endpoint not found - check the URL path';
    }
    
    if (error.response?.status === 401) {
      return 'Authentication required - check credentials';
    }
    
    if (error.response?.status === 403) {
      return 'Access forbidden - check permissions';
    }
    
    if (error.response?.status === 429) {
      return 'Rate limit exceeded - reduce request frequency';
    }
    
    if (error.response?.status && error.response.status >= 500) {
      return 'Server error - check server logs or try again later';
    }
    
    return 'Check network connection and server availability';
  }

  /**
   * Log to browser DevTools
   */
  private logToDevTools(type: string, data: any, requestId?: string, duration?: number): void {
    if (typeof window === 'undefined' || !console.group) {
      return;
    }

    const useColors = this.config.settings.devtools?.useColors;
    const groupRequests = this.config.settings.devtools?.groupRequests;
    
    const colors = {
      request: useColors ? 'color: blue' : '',
      response: useColors ? 'color: green' : '',
      error: useColors ? 'color: red' : ''
    };

    if (groupRequests && requestId) {
      if (type === 'request') {
        console.group(`%c🌐 HTTP Request ${requestId}`, colors.request);
      } else {
        console.groupCollapsed(`%c✅ HTTP ${type} ${requestId}${duration ? ` (${duration}ms)` : ''}`, colors[type as keyof typeof colors]);
      }
    }

    if (type === 'request') {
      console.log('Config:', data);
    } else if (type === 'response') {
      console.log('Response:', data);
    } else if (type === 'error') {
      console.error('Error:', data);
    }

    if (groupRequests) {
      console.groupEnd();
    }
  }

  /**
   * Sanitize headers for logging
   */
  private sanitizeHeaders(headers: Record<string, any>): Record<string, string> {
    const sanitized: Record<string, string> = {};
    const sensitiveHeaders = ['authorization', 'cookie', 'x-api-key'];
    
    for (const [key, value] of Object.entries(headers)) {
      if (sensitiveHeaders.includes(key.toLowerCase())) {
        sanitized[key] = '[SANITIZED]';
      } else {
        const strValue = String(value);
        const maxLength = this.config.settings.format?.maxHeaderLength || 500;
        sanitized[key] = strValue.length > maxLength ? 
          `${strValue.substring(0, maxLength)}...` : strValue;
      }
    }
    
    return sanitized;
  }

  /**
   * Truncate data for logging
   */
  private truncateData(data: unknown, maxLength = 1000): unknown {
    if (data === null || data === undefined) {
      return data;
    }
    
    const stringified = JSON.stringify(data);
    if (stringified.length <= maxLength) {
      return data;
    }
    
    return `${stringified.substring(0, maxLength)}... [TRUNCATED ${stringified.length - maxLength} chars]`;
  }

  /**
   * Calculate response size
   */
  private calculateResponseSize(data: unknown): string {
    try {
      const size = JSON.stringify(data).length;
      if (size < 1024) return `${size}B`;
      if (size < 1024 * 1024) return `${Math.round(size / 1024)}KB`;
      return `${Math.round(size / (1024 * 1024))}MB`;
    } catch {
      return 'unknown';
    }
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Create debug entry
   */
  private createDebugEntry(
    level: DebugLevel,
    message: string,
    data: Record<string, unknown>,
    type: DebugEntry['type'],
    requestId?: string
  ): void {
    const entry: DebugEntry = {
      type,
      level,
      timestamp: Date.now(),
      requestId,
      message,
      data,
      context: {
        plugin: this.metadata.id
      }
    };

    // Add to entries buffer
    this.debugEntries.push(entry);
    
    // Limit buffer size
    if (this.debugEntries.length > this.maxEntries) {
      this.debugEntries.shift();
    }

    // Output to console if enabled
    if (this.config.settings.output?.console) {
      this.outputToConsole(entry);
    }

    // Call custom callback if provided
    if (this.config.settings.output?.callback) {
      this.config.settings.output.callback(entry);
    }
  }

  /**
   * Output debug entry to console
   */
  private outputToConsole(entry: DebugEntry): void {
    const namespace = this.config.settings.namespace || 'fluxhttp';
    const timestamp = this.config.settings.format?.timestamps ? 
      new Date(entry.timestamp).toISOString() : '';
    
    const prefix = `[${namespace}:${entry.type}]${timestamp ? ` ${timestamp}` : ''}`;
    const message = `${prefix} ${entry.message}`;
    
    const method = this.getConsoleMethod(entry.level);
    
    if (this.config.settings.format?.compact) {
      console[method](message, entry.data);
    } else {
      console[method](message);
      if (this.config.settings.format?.prettify) {
        console.log(JSON.stringify(entry.data, null, 2));
      } else {
        console.log(entry.data);
      }
    }
  }

  /**
   * Get appropriate console method for log level
   */
  private getConsoleMethod(level: DebugLevel): 'trace' | 'debug' | 'info' | 'warn' | 'error' {
    switch (level) {
      case 'trace': return 'trace';
      case 'debug': return 'debug';
      case 'info': return 'info';
      case 'warn': return 'warn';
      case 'error': return 'error';
      default: return 'log' as any;
    }
  }

  /**
   * Check if message should be logged based on level
   */
  private shouldLog(level: DebugLevel): boolean {
    const configLevel = this.config.settings.level || 'debug';
    return this.levelPriority[level] >= this.levelPriority[configLevel];
  }

  /**
   * Log message with level check
   */
  private log(level: DebugLevel, message: string, data: Record<string, unknown>, type: DebugEntry['type'], requestId?: string): void {
    if (this.shouldLog(level)) {
      this.createDebugEntry(level, message, data, type, requestId);
    }
  }

  /**
   * Debug level logging
   */
  private debug(message: string, data: Record<string, unknown>, type: DebugEntry['type'] = 'system', requestId?: string): void {
    this.log('debug', message, data, type, requestId);
  }

  /**
   * Info level logging
   */
  private info(message: string, data: Record<string, unknown>, type: DebugEntry['type'] = 'system', requestId?: string): void {
    this.log('info', message, data, type, requestId);
  }

  /**
   * Warn level logging
   */
  private warn(message: string, data: Record<string, unknown>, type: DebugEntry['type'] = 'system', requestId?: string): void {
    this.log('warn', message, data, type, requestId);
  }

  /**
   * Error level logging
   */
  private error(message: string, data: Record<string, unknown>, type: DebugEntry['type'] = 'system', requestId?: string): void {
    this.log('error', message, data, type, requestId);
  }

  /**
   * Trace level logging
   */
  private trace(message: string, data: Record<string, unknown>, type: DebugEntry['type'] = 'system', requestId?: string): void {
    this.log('trace', message, data, type, requestId);
  }

  /**
   * Export debug entries
   */
  private exportDebugEntries(): void {
    const data = {
      timestamp: Date.now(),
      version: this.metadata.version,
      entries: this.debugEntries
    };

    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem('fluxhttp-debug-entries', JSON.stringify(data));
    }
  }

  /**
   * Get debug entries
   */
  getDebugEntries(): DebugEntry[] {
    return [...this.debugEntries];
  }

  /**
   * Clear debug entries
   */
  clearDebugEntries(): void {
    this.debugEntries = [];
  }

  /**
   * Get debug statistics
   */
  getDebugStats() {
    const byType: Record<string, number> = {};
    const byLevel: Record<string, number> = {};
    
    for (const entry of this.debugEntries) {
      byType[entry.type] = (byType[entry.type] || 0) + 1;
      byLevel[entry.level] = (byLevel[entry.level] || 0) + 1;
    }

    return {
      totalEntries: this.debugEntries.length,
      activeRequests: this.requestTimings.size,
      byType,
      byLevel,
      oldestEntry: this.debugEntries[0]?.timestamp,
      newestEntry: this.debugEntries[this.debugEntries.length - 1]?.timestamp
    };
  }

  /**
   * Update configuration
   */
  async updateConfig(config: Partial<DebugPluginConfig>): Promise<void> {
    this.config = { ...this.config, ...config };
    this.context?.logger.info('Debug plugin configuration updated');
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
        level: this.config.settings.level,
        namespace: this.config.settings.namespace,
        debugEntries: this.debugEntries.length,
        activeRequests: this.requestTimings.size,
        devtools: this.config.settings.devtools?.enabled
      }
    };
  }

  /**
   * Get plugin metrics
   */
  async getMetrics() {
    return {
      level: this.config.settings.level,
      debugEntries: this.debugEntries.length,
      activeRequests: this.requestTimings.size,
      ...this.getDebugStats()
    };
  }
}

/**
 * Debug plugin factory
 */
export function createDebugPlugin(config?: Partial<DebugPluginConfig>): DebugPlugin {
  return new DebugPlugin(config);
}