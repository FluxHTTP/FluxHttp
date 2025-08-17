/**
 * @fileoverview Logging plugin for FluxHTTP
 * @module @fluxhttp/plugins/built-in/logging
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
 * Log levels
 */
export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal' | 'silent';

/**
 * Log formats
 */
export type LogFormat = 'json' | 'text' | 'compact' | 'pretty' | 'custom';

/**
 * Log transport types
 */
export type LogTransport = 'console' | 'file' | 'http' | 'custom';

/**
 * Logging configuration
 */
export interface LoggingPluginConfig extends PluginConfig {
  settings: {
    /** Log level */
    level?: LogLevel;
    /** Log format */
    format?: LogFormat;
    /** Log transports */
    transports?: LogTransport[];
    /** Custom format function */
    customFormatter?: (entry: LogEntry) => string;
    /** Custom transport function */
    customTransport?: (entry: LogEntry) => void;
    /** Request logging options */
    request?: {
      enabled: boolean;
      headers: boolean;
      body: boolean;
      params: boolean;
      maxBodySize: number;
      excludeHeaders: string[];
      sanitizeHeaders: string[];
    };
    /** Response logging options */
    response?: {
      enabled: boolean;
      headers: boolean;
      body: boolean;
      maxBodySize: number;
      excludeHeaders: string[];
      excludeStatusCodes: number[];
    };
    /** Error logging options */
    error?: {
      enabled: boolean;
      stackTrace: boolean;
      context: boolean;
    };
    /** Performance logging options */
    performance?: {
      enabled: boolean;
      includeTimings: boolean;
      slowRequestThreshold: number;
    };
    /** File transport options */
    file?: {
      filename: string;
      maxSize: number;
      maxFiles: number;
      compress: boolean;
    };
    /** HTTP transport options */
    http?: {
      endpoint: string;
      method: string;
      headers: Record<string, string>;
      batchSize: number;
      flushInterval: number;
    };
    /** Sampling options */
    sampling?: {
      enabled: boolean;
      rate: number;
      excludeSuccessful: boolean;
    };
    /** Redaction options */
    redaction?: {
      enabled: boolean;
      patterns: string[];
      replacement: string;
    };
    /** Buffer options */
    buffering?: {
      enabled: boolean;
      maxSize: number;
      flushInterval: number;
      flushOnLevel: LogLevel;
    };
  };
}

/**
 * Log entry interface
 */
export interface LogEntry {
  /** Log level */
  level: LogLevel;
  /** Log message */
  message: string;
  /** Timestamp */
  timestamp: number;
  /** Request ID */
  requestId?: string;
  /** Plugin ID */
  pluginId?: string;
  /** Request details */
  request?: {
    method: string;
    url: string;
    headers?: Record<string, string>;
    body?: unknown;
    params?: Record<string, unknown>;
  };
  /** Response details */
  response?: {
    status: number;
    statusText: string;
    headers?: Record<string, string>;
    body?: unknown;
    duration?: number;
  };
  /** Error details */
  error?: {
    name: string;
    message: string;
    code?: string;
    stack?: string;
  };
  /** Performance metrics */
  performance?: {
    duration: number;
    dnsLookup?: number;
    tcpConnect?: number;
    tlsHandshake?: number;
    firstByte?: number;
    download?: number;
  };
  /** Additional context */
  context?: Record<string, unknown>;
  /** Tags for categorization */
  tags?: string[];
}

/**
 * Log transport interface
 */
interface LogTransportInterface {
  log(entry: LogEntry): void | Promise<void>;
  flush?(): void | Promise<void>;
  close?(): void | Promise<void>;
}

/**
 * Console transport implementation
 */
class ConsoleTransport implements LogTransportInterface {
  constructor(
    private readonly formatter: (entry: LogEntry) => string,
    private readonly colors: boolean = true
  ) {}

  log(entry: LogEntry): void {
    const formatted = this.formatter(entry);
    const colorized = this.colors ? this.colorize(formatted, entry.level) : formatted;

    switch (entry.level) {
      case 'trace':
      case 'debug':
        console.debug(colorized);
        break;
      case 'info':
        console.info(colorized);
        break;
      case 'warn':
        console.warn(colorized);
        break;
      case 'error':
      case 'fatal':
        console.error(colorized);
        break;
    }
  }

  private colorize(message: string, level: LogLevel): string {
    if (typeof window !== 'undefined') {
      return message; // No colors in browser
    }

    const colors = {
      trace: '\x1b[90m',
      debug: '\x1b[36m',
      info: '\x1b[32m',
      warn: '\x1b[33m',
      error: '\x1b[31m',
      fatal: '\x1b[35m'
    };

    const reset = '\x1b[0m';
    const color = colors[level] || '';
    return `${color}${message}${reset}`;
  }
}

/**
 * HTTP transport implementation
 */
class HttpTransport implements LogTransportInterface {
  private buffer: LogEntry[] = [];
  private flushTimer?: NodeJS.Timeout;

  constructor(
    private readonly endpoint: string,
    private readonly options: {
      method: string;
      headers: Record<string, string>;
      batchSize: number;
      flushInterval: number;
    }
  ) {
    this.startFlushTimer();
  }

  log(entry: LogEntry): void {
    this.buffer.push(entry);

    if (this.buffer.length >= this.options.batchSize) {
      this.flush();
    }
  }

  async flush(): Promise<void> {
    if (this.buffer.length === 0) return;

    const entries = [...this.buffer];
    this.buffer = [];

    try {
      await fetch(this.endpoint, {
        method: this.options.method,
        headers: {
          'Content-Type': 'application/json',
          ...this.options.headers
        },
        body: JSON.stringify({ logs: entries })
      });
    } catch (error) {
      console.error('Failed to send logs to HTTP endpoint:', error);
      // Re-add entries to buffer for retry
      this.buffer.unshift(...entries);
    }
  }

  close(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    this.flush();
  }

  private startFlushTimer(): void {
    this.flushTimer = setInterval(() => {
      this.flush();
    }, this.options.flushInterval);

    if (this.flushTimer.unref) {
      this.flushTimer.unref();
    }
  }
}

/**
 * Logging plugin implementation
 */
export class LoggingPlugin implements Plugin {
  readonly metadata: PluginMetadata = {
    id: 'logging',
    name: 'Logging Plugin',
    version: '1.0.0',
    type: PluginType.DEVELOPER,
    description: 'Provides comprehensive HTTP request/response logging with multiple formats and transports',
    author: {
      name: 'FluxHTTP Team',
      email: 'team@fluxhttp.dev'
    },
    license: 'MIT',
    keywords: ['logging', 'debug', 'monitoring', 'observability', 'tracing'],
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
            enum: ['trace', 'debug', 'info', 'warn', 'error', 'fatal', 'silent'],
            default: 'info'
          },
          format: {
            type: 'string',
            enum: ['json', 'text', 'compact', 'pretty', 'custom'],
            default: 'text'
          },
          transports: {
            type: 'array',
            items: {
              type: 'string',
              enum: ['console', 'file', 'http', 'custom']
            },
            default: ['console']
          },
          request: {
            type: 'object',
            properties: {
              enabled: { type: 'boolean', default: true },
              headers: { type: 'boolean', default: true },
              body: { type: 'boolean', default: false },
              params: { type: 'boolean', default: true },
              maxBodySize: { type: 'number', default: 1024 }
            }
          },
          response: {
            type: 'object',
            properties: {
              enabled: { type: 'boolean', default: true },
              headers: { type: 'boolean', default: false },
              body: { type: 'boolean', default: false },
              maxBodySize: { type: 'number', default: 1024 }
            }
          },
          error: {
            type: 'object',
            properties: {
              enabled: { type: 'boolean', default: true },
              stackTrace: { type: 'boolean', default: true },
              context: { type: 'boolean', default: true }
            }
          },
          performance: {
            type: 'object',
            properties: {
              enabled: { type: 'boolean', default: true },
              includeTimings: { type: 'boolean', default: false },
              slowRequestThreshold: { type: 'number', default: 5000 }
            }
          }
        }
      }
    }
  };

  state = PluginLifecycleState.UNINITIALIZED;
  config: LoggingPluginConfig;
  context?: PluginContext;

  private transports: LogTransportInterface[] = [];
  private requestTimings = new Map<string, number>();
  private logBuffer: LogEntry[] = [];
  private flushTimer?: NodeJS.Timeout;
  private logLevels: Record<LogLevel, number> = {
    trace: 0,
    debug: 1,
    info: 2,
    warn: 3,
    error: 4,
    fatal: 5,
    silent: 6
  };

  constructor(config: Partial<LoggingPluginConfig> = {}) {
    this.config = {
      enabled: true,
      settings: {
        level: 'info',
        format: 'text',
        transports: ['console'],
        request: {
          enabled: true,
          headers: true,
          body: false,
          params: true,
          maxBodySize: 1024,
          excludeHeaders: ['authorization', 'cookie'],
          sanitizeHeaders: ['authorization', 'x-api-key']
        },
        response: {
          enabled: true,
          headers: false,
          body: false,
          maxBodySize: 1024,
          excludeHeaders: ['set-cookie'],
          excludeStatusCodes: []
        },
        error: {
          enabled: true,
          stackTrace: true,
          context: true
        },
        performance: {
          enabled: true,
          includeTimings: false,
          slowRequestThreshold: 5000
        },
        sampling: {
          enabled: false,
          rate: 1.0,
          excludeSuccessful: false
        },
        redaction: {
          enabled: true,
          patterns: ['password', 'token', 'secret', 'key'],
          replacement: '[REDACTED]'
        },
        buffering: {
          enabled: false,
          maxSize: 1000,
          flushInterval: 5000,
          flushOnLevel: 'error'
        },
        ...config.settings
      },
      ...config
    } as LoggingPluginConfig;
  }

  /**
   * Initialize plugin
   */
  async init(context: PluginContext): Promise<void> {
    this.context = context;
    
    // Initialize transports
    await this.initializeTransports();
    
    // Initialize buffering if enabled
    if (this.config.settings.buffering?.enabled) {
      this.initializeBuffering();
    }
    
    // Register interceptors
    this.interceptRequest(this.handleRequestLogging.bind(this));
    this.interceptResponse(this.handleResponseLogging.bind(this));
    this.interceptError(this.handleErrorLogging.bind(this));
    
    context.logger.info('Logging plugin initialized', {
      level: this.config.settings.level,
      format: this.config.settings.format,
      transports: this.config.settings.transports
    });
  }

  /**
   * Stop plugin
   */
  async stop(context: PluginContext): Promise<void> {
    // Flush any remaining logs
    await this.flush();
    
    // Close transports
    for (const transport of this.transports) {
      if (transport.close) {
        await transport.close();
      }
    }
    
    // Clear flush timer
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    
    context.logger.info('Logging plugin stopped');
  }

  /**
   * Initialize transports
   */
  private async initializeTransports(): Promise<void> {
    const transports = this.config.settings.transports || ['console'];
    
    for (const transportType of transports) {
      switch (transportType) {
        case 'console':
          this.transports.push(new ConsoleTransport(
            this.getFormatter(),
            typeof window === 'undefined'
          ));
          break;
        
        case 'http':
          if (this.config.settings.http) {
            this.transports.push(new HttpTransport(
              this.config.settings.http.endpoint,
              this.config.settings.http
            ));
          }
          break;
        
        case 'custom':
          if (this.config.settings.customTransport) {
            this.transports.push({
              log: this.config.settings.customTransport
            });
          }
          break;
      }
    }
  }

  /**
   * Initialize buffering
   */
  private initializeBuffering(): void {
    const bufferConfig = this.config.settings.buffering!;
    
    this.flushTimer = setInterval(() => {
      this.flush();
    }, bufferConfig.flushInterval);

    if (this.flushTimer.unref) {
      this.flushTimer.unref();
    }
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
   * Handle request logging
   */
  private handleRequestLogging(config: fluxhttpRequestConfig): fluxhttpRequestConfig {
    if (!this.config.settings.request?.enabled) {
      return config;
    }

    const requestId = this.generateRequestId();
    const startTime = Date.now();
    
    // Store timing for performance logging
    this.requestTimings.set(requestId, startTime);
    
    // Add request ID to config for tracking
    config.headers = {
      ...config.headers,
      'X-Request-ID': requestId
    };

    const entry: LogEntry = {
      level: 'info',
      message: 'HTTP Request',
      timestamp: startTime,
      requestId,
      pluginId: this.metadata.id,
      request: this.sanitizeRequest(config),
      tags: ['request']
    };

    this.log(entry);
    return config;
  }

  /**
   * Handle response logging
   */
  private handleResponseLogging(response: fluxhttpResponse): fluxhttpResponse {
    if (!this.config.settings.response?.enabled) {
      return response;
    }

    const requestId = response.config.headers?.['X-Request-ID'] as string;
    const startTime = this.requestTimings.get(requestId);
    const endTime = Date.now();
    const duration = startTime ? endTime - startTime : 0;

    // Clean up timing data
    if (requestId) {
      this.requestTimings.delete(requestId);
    }

    // Check if status code should be excluded
    const excludeStatusCodes = this.config.settings.response?.excludeStatusCodes || [];
    if (excludeStatusCodes.includes(response.status)) {
      return response;
    }

    // Determine log level based on status code
    let level: LogLevel = 'info';
    if (response.status >= 400 && response.status < 500) {
      level = 'warn';
    } else if (response.status >= 500) {
      level = 'error';
    }

    // Check for slow requests
    const slowThreshold = this.config.settings.performance?.slowRequestThreshold || 5000;
    if (duration > slowThreshold) {
      level = 'warn';
    }

    const entry: LogEntry = {
      level,
      message: 'HTTP Response',
      timestamp: endTime,
      requestId,
      pluginId: this.metadata.id,
      request: this.sanitizeRequest(response.config),
      response: this.sanitizeResponse(response),
      performance: {
        duration
      },
      tags: ['response', `status-${response.status}`]
    };

    this.log(entry);
    return response;
  }

  /**
   * Handle error logging
   */
  private handleErrorLogging(error: fluxhttpError): fluxhttpError {
    if (!this.config.settings.error?.enabled) {
      return error;
    }

    const requestId = error.config?.headers?.['X-Request-ID'] as string;
    const startTime = this.requestTimings.get(requestId);
    const endTime = Date.now();
    const duration = startTime ? endTime - startTime : 0;

    // Clean up timing data
    if (requestId) {
      this.requestTimings.delete(requestId);
    }

    const entry: LogEntry = {
      level: 'error',
      message: 'HTTP Error',
      timestamp: endTime,
      requestId,
      pluginId: this.metadata.id,
      request: error.config ? this.sanitizeRequest(error.config) : undefined,
      response: error.response ? this.sanitizeResponse(error.response) : undefined,
      error: {
        name: error.name,
        message: error.message,
        code: error.code,
        stack: this.config.settings.error?.stackTrace ? error.stack : undefined
      },
      performance: {
        duration
      },
      context: this.config.settings.error?.context ? {
        isfluxhttpError: error.isfluxhttpError,
        config: error.config
      } : undefined,
      tags: ['error', error.code || 'unknown']
    };

    this.log(entry);
    return error;
  }

  /**
   * Sanitize request data for logging
   */
  private sanitizeRequest(config: fluxhttpRequestConfig): LogEntry['request'] {
    const requestConfig = this.config.settings.request!;
    
    const request: LogEntry['request'] = {
      method: config.method || 'GET',
      url: config.url || ''
    };

    if (requestConfig.params && config.params) {
      request.params = this.redactSensitiveData(config.params);
    }

    if (requestConfig.headers && config.headers) {
      request.headers = this.sanitizeHeaders(config.headers, requestConfig.excludeHeaders);
    }

    if (requestConfig.body && config.data) {
      request.body = this.sanitizeBody(config.data, requestConfig.maxBodySize);
    }

    return request;
  }

  /**
   * Sanitize response data for logging
   */
  private sanitizeResponse(response: fluxhttpResponse): LogEntry['response'] {
    const responseConfig = this.config.settings.response!;
    
    const res: LogEntry['response'] = {
      status: response.status,
      statusText: response.statusText
    };

    if (responseConfig.headers && response.headers) {
      res.headers = this.sanitizeHeaders(response.headers, responseConfig.excludeHeaders);
    }

    if (responseConfig.body && response.data) {
      res.body = this.sanitizeBody(response.data, responseConfig.maxBodySize);
    }

    return res;
  }

  /**
   * Sanitize headers for logging
   */
  private sanitizeHeaders(headers: Record<string, any>, excludeHeaders: string[] = []): Record<string, string> {
    const sanitized: Record<string, string> = {};
    const sanitizeHeaders = this.config.settings.request?.sanitizeHeaders || [];
    
    for (const [key, value] of Object.entries(headers)) {
      const lowerKey = key.toLowerCase();
      
      if (excludeHeaders.includes(lowerKey)) {
        continue;
      }
      
      if (sanitizeHeaders.includes(lowerKey)) {
        sanitized[key] = '[SANITIZED]';
      } else {
        sanitized[key] = String(value);
      }
    }
    
    return sanitized;
  }

  /**
   * Sanitize body data for logging
   */
  private sanitizeBody(data: unknown, maxSize: number): unknown {
    let sanitized = this.redactSensitiveData(data);
    
    const stringified = JSON.stringify(sanitized);
    if (stringified.length > maxSize) {
      return stringified.substring(0, maxSize) + '... [TRUNCATED]';
    }
    
    return sanitized;
  }

  /**
   * Redact sensitive data from objects
   */
  private redactSensitiveData(data: unknown): unknown {
    if (!this.config.settings.redaction?.enabled) {
      return data;
    }

    const patterns = this.config.settings.redaction.patterns || [];
    const replacement = this.config.settings.redaction.replacement || '[REDACTED]';

    return this.deepRedact(data, patterns, replacement);
  }

  /**
   * Deep redaction of sensitive data
   */
  private deepRedact(obj: unknown, patterns: string[], replacement: string): unknown {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.deepRedact(item, patterns, replacement));
    }

    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      const shouldRedact = patterns.some(pattern => 
        key.toLowerCase().includes(pattern.toLowerCase())
      );
      
      if (shouldRedact) {
        result[key] = replacement;
      } else {
        result[key] = this.deepRedact(value, patterns, replacement);
      }
    }

    return result;
  }

  /**
   * Log entry
   */
  private log(entry: LogEntry): void {
    // Check log level
    const currentLevel = this.logLevels[this.config.settings.level || 'info'];
    const entryLevel = this.logLevels[entry.level];
    
    if (entryLevel < currentLevel) {
      return;
    }

    // Check sampling
    if (this.config.settings.sampling?.enabled) {
      const rate = this.config.settings.sampling.rate || 1.0;
      if (Math.random() > rate) {
        return;
      }
      
      // Exclude successful requests if configured
      if (this.config.settings.sampling.excludeSuccessful && 
          entry.response?.status && 
          entry.response.status >= 200 && 
          entry.response.status < 300) {
        return;
      }
    }

    // Add to buffer or log immediately
    if (this.config.settings.buffering?.enabled) {
      this.addToBuffer(entry);
    } else {
      this.writeToTransports(entry);
    }
  }

  /**
   * Add entry to buffer
   */
  private addToBuffer(entry: LogEntry): void {
    const bufferConfig = this.config.settings.buffering!;
    
    this.logBuffer.push(entry);
    
    // Check buffer size
    if (this.logBuffer.length >= bufferConfig.maxSize) {
      this.flush();
    }
    
    // Check flush on level
    if (bufferConfig.flushOnLevel && 
        this.logLevels[entry.level] >= this.logLevels[bufferConfig.flushOnLevel]) {
      this.flush();
    }
  }

  /**
   * Flush buffered logs
   */
  private async flush(): Promise<void> {
    if (this.logBuffer.length === 0) return;
    
    const entries = [...this.logBuffer];
    this.logBuffer = [];
    
    for (const entry of entries) {
      this.writeToTransports(entry);
    }
  }

  /**
   * Write entry to all transports
   */
  private writeToTransports(entry: LogEntry): void {
    for (const transport of this.transports) {
      try {
        transport.log(entry);
      } catch (error) {
        console.error('Transport error:', error);
      }
    }
  }

  /**
   * Get formatter function
   */
  private getFormatter(): (entry: LogEntry) => string {
    if (this.config.settings.customFormatter) {
      return this.config.settings.customFormatter;
    }

    const format = this.config.settings.format || 'text';
    
    switch (format) {
      case 'json':
        return this.jsonFormatter.bind(this);
      case 'compact':
        return this.compactFormatter.bind(this);
      case 'pretty':
        return this.prettyFormatter.bind(this);
      default:
        return this.textFormatter.bind(this);
    }
  }

  /**
   * JSON formatter
   */
  private jsonFormatter(entry: LogEntry): string {
    return JSON.stringify(entry);
  }

  /**
   * Text formatter
   */
  private textFormatter(entry: LogEntry): string {
    const timestamp = new Date(entry.timestamp).toISOString();
    const level = entry.level.toUpperCase();
    const message = entry.message;
    const requestId = entry.requestId ? ` [${entry.requestId}]` : '';
    
    let details = '';
    if (entry.request) {
      details += ` ${entry.request.method} ${entry.request.url}`;
    }
    if (entry.response) {
      details += ` → ${entry.response.status}`;
    }
    if (entry.performance?.duration) {
      details += ` (${entry.performance.duration}ms)`;
    }
    
    return `${timestamp} [${level}]${requestId} ${message}${details}`;
  }

  /**
   * Compact formatter
   */
  private compactFormatter(entry: LogEntry): string {
    const time = new Date(entry.timestamp).toLocaleTimeString();
    const level = entry.level[0].toUpperCase();
    
    if (entry.request && entry.response) {
      return `${time} ${level} ${entry.request.method} ${entry.request.url} → ${entry.response.status} (${entry.performance?.duration || 0}ms)`;
    }
    
    return `${time} ${level} ${entry.message}`;
  }

  /**
   * Pretty formatter
   */
  private prettyFormatter(entry: LogEntry): string {
    const lines: string[] = [];
    const timestamp = new Date(entry.timestamp).toISOString();
    
    lines.push(`┌─ ${entry.level.toUpperCase()} ${timestamp}`);
    lines.push(`├─ ${entry.message}`);
    
    if (entry.requestId) {
      lines.push(`├─ Request ID: ${entry.requestId}`);
    }
    
    if (entry.request) {
      lines.push(`├─ ${entry.request.method} ${entry.request.url}`);
    }
    
    if (entry.response) {
      lines.push(`├─ Response: ${entry.response.status} ${entry.response.statusText}`);
    }
    
    if (entry.performance?.duration) {
      lines.push(`├─ Duration: ${entry.performance.duration}ms`);
    }
    
    if (entry.error) {
      lines.push(`├─ Error: ${entry.error.message}`);
    }
    
    lines.push('└─');
    
    return lines.join('\n');
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Update configuration
   */
  async updateConfig(config: Partial<LoggingPluginConfig>): Promise<void> {
    this.config = { ...this.config, ...config };
    
    // Reinitialize transports if changed
    if (config.settings?.transports) {
      this.transports = [];
      await this.initializeTransports();
    }
    
    this.context?.logger.info('Logging plugin configuration updated');
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
        transports: this.config.settings.transports,
        bufferSize: this.logBuffer.length,
        activeTimings: this.requestTimings.size
      }
    };
  }

  /**
   * Get plugin metrics
   */
  async getMetrics() {
    return {
      level: this.config.settings.level,
      format: this.config.settings.format,
      transports: this.config.settings.transports,
      bufferSize: this.logBuffer.length,
      activeTimings: this.requestTimings.size
    };
  }
}

/**
 * Logging plugin factory
 */
export function createLoggingPlugin(config?: Partial<LoggingPluginConfig>): LoggingPlugin {
  return new LoggingPlugin(config);
}