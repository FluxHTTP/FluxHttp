/**
 * @fileoverview Metrics plugin for FluxHTTP
 * @module @fluxhttp/plugins/built-in/metrics
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
 * Metrics backend types
 */
export type MetricsBackend = 'prometheus' | 'statsD' | 'datadog' | 'newrelic' | 'custom' | 'console';

/**
 * Metrics configuration
 */
export interface MetricsPluginConfig extends PluginConfig {
  settings: {
    /** Metrics backend */
    backend?: MetricsBackend;
    /** Metrics collection interval */
    interval?: number;
    /** Metrics prefix */
    prefix?: string;
    /** Default tags to add to all metrics */
    defaultTags?: Record<string, string>;
    /** Custom metrics backend */
    customBackend?: MetricsBackendInterface;
    /** Request metrics configuration */
    request?: {
      enabled: boolean;
      includeHeaders: boolean;
      includeParams: boolean;
      trackUserAgent: boolean;
    };
    /** Response metrics configuration */
    response?: {
      enabled: boolean;
      trackResponseSize: boolean;
      trackContentType: boolean;
      percentiles: number[];
    };
    /** Error metrics configuration */
    error?: {
      enabled: boolean;
      groupByStatus: boolean;
      groupByErrorCode: boolean;
      trackStackTrace: boolean;
    };
    /** Performance metrics configuration */
    performance?: {
      enabled: boolean;
      trackDNS: boolean;
      trackTCP: boolean;
      trackTLS: boolean;
      trackFirstByte: boolean;
      trackDownload: boolean;
      buckets: number[];
    };
    /** Business metrics configuration */
    business?: {
      enabled: boolean;
      trackEndpoints: string[];
      customMetrics: Record<string, (config: fluxhttpRequestConfig, response?: fluxhttpResponse) => Record<string, number>>;
    };
    /** Prometheus specific configuration */
    prometheus?: {
      register?: any; // PrometheusRegistry
      gateway?: {
        endpoint: string;
        jobName: string;
        pushInterval: number;
      };
    };
    /** StatsD specific configuration */
    statsD?: {
      host: string;
      port: number;
      prefix: string;
      tags: Record<string, string>;
    };
    /** DataDog specific configuration */
    datadog?: {
      apiKey: string;
      host?: string;
      tags: string[];
    };
    /** Sampling configuration */
    sampling?: {
      enabled: boolean;
      rate: number;
      excludeHealthChecks: boolean;
    };
    /** Aggregation configuration */
    aggregation?: {
      enabled: boolean;
      windowSize: number;
      flushInterval: number;
    };
  };
}

/**
 * Metrics backend interface
 */
export interface MetricsBackendInterface {
  counter(name: string, value: number, tags?: Record<string, string>): void;
  gauge(name: string, value: number, tags?: Record<string, string>): void;
  histogram(name: string, value: number, tags?: Record<string, string>): void;
  timing(name: string, value: number, tags?: Record<string, string>): void;
  flush?(): Promise<void>;
  close?(): Promise<void>;
}

/**
 * Metric entry
 */
interface MetricEntry {
  type: 'counter' | 'gauge' | 'histogram' | 'timing';
  name: string;
  value: number;
  tags: Record<string, string>;
  timestamp: number;
}

/**
 * Request timing data
 */
interface RequestTiming {
  startTime: number;
  dnsLookup?: number;
  tcpConnect?: number;
  tlsHandshake?: number;
  firstByte?: number;
  download?: number;
}

/**
 * Aggregated metric data
 */
interface AggregatedMetric {
  name: string;
  type: string;
  count: number;
  sum: number;
  min: number;
  max: number;
  avg: number;
  tags: Record<string, string>;
  values: number[];
}

/**
 * Console metrics backend
 */
class ConsoleMetricsBackend implements MetricsBackendInterface {
  private metrics: MetricEntry[] = [];
  private flushInterval: number;
  private timer?: NodeJS.Timeout;

  constructor(flushInterval = 60000) {
    this.flushInterval = flushInterval;
    this.startFlushTimer();
  }

  counter(name: string, value: number, tags: Record<string, string> = {}): void {
    this.addMetric('counter', name, value, tags);
  }

  gauge(name: string, value: number, tags: Record<string, string> = {}): void {
    this.addMetric('gauge', name, value, tags);
  }

  histogram(name: string, value: number, tags: Record<string, string> = {}): void {
    this.addMetric('histogram', name, value, tags);
  }

  timing(name: string, value: number, tags: Record<string, string> = {}): void {
    this.addMetric('timing', name, value, tags);
  }

  async flush(): Promise<void> {
    if (this.metrics.length === 0) return;

    console.log('=== FluxHTTP Metrics ===');
    console.table(this.metrics.map(m => ({
      Type: m.type,
      Name: m.name,
      Value: m.value,
      Tags: JSON.stringify(m.tags),
      Timestamp: new Date(m.timestamp).toISOString()
    })));
    
    this.metrics = [];
  }

  async close(): Promise<void> {
    if (this.timer) {
      clearInterval(this.timer);
    }
    await this.flush();
  }

  private addMetric(type: string, name: string, value: number, tags: Record<string, string>): void {
    this.metrics.push({
      type: type as any,
      name,
      value,
      tags,
      timestamp: Date.now()
    });
  }

  private startFlushTimer(): void {
    this.timer = setInterval(() => {
      this.flush();
    }, this.flushInterval);

    if (this.timer.unref) {
      this.timer.unref();
    }
  }
}

/**
 * Metrics aggregator
 */
class MetricsAggregator {
  private metrics = new Map<string, AggregatedMetric>();
  private windowSize: number;
  private flushInterval: number;
  private timer?: NodeJS.Timeout;

  constructor(windowSize: number, flushInterval: number) {
    this.windowSize = windowSize;
    this.flushInterval = flushInterval;
    this.startFlushTimer();
  }

  addMetric(type: string, name: string, value: number, tags: Record<string, string>): void {
    const key = this.getMetricKey(name, tags);
    let metric = this.metrics.get(key);

    if (!metric) {
      metric = {
        name,
        type,
        count: 0,
        sum: 0,
        min: Infinity,
        max: -Infinity,
        avg: 0,
        tags,
        values: []
      };
      this.metrics.set(key, metric);
    }

    metric.count++;
    metric.sum += value;
    metric.min = Math.min(metric.min, value);
    metric.max = Math.max(metric.max, value);
    metric.avg = metric.sum / metric.count;
    metric.values.push(value);

    // Limit values array size
    if (metric.values.length > this.windowSize) {
      metric.values.shift();
    }
  }

  getAggregatedMetrics(): AggregatedMetric[] {
    return Array.from(this.metrics.values());
  }

  getPercentile(values: number[], percentile: number): number {
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)] || 0;
  }

  clear(): void {
    this.metrics.clear();
  }

  dispose(): void {
    if (this.timer) {
      clearInterval(this.timer);
    }
    this.clear();
  }

  private getMetricKey(name: string, tags: Record<string, string>): string {
    const tagString = Object.keys(tags)
      .sort()
      .map(key => `${key}=${tags[key]}`)
      .join(',');
    return `${name}{${tagString}}`;
  }

  private startFlushTimer(): void {
    this.timer = setInterval(() => {
      // Auto-clear old metrics
      this.clear();
    }, this.flushInterval);

    if (this.timer.unref) {
      this.timer.unref();
    }
  }
}

/**
 * Metrics plugin implementation
 */
export class MetricsPlugin implements Plugin {
  readonly metadata: PluginMetadata = {
    id: 'metrics',
    name: 'Metrics Plugin',
    version: '1.0.0',
    type: PluginType.MONITORING,
    description: 'Provides comprehensive HTTP metrics collection and reporting for performance monitoring',
    author: {
      name: 'FluxHTTP Team',
      email: 'team@fluxhttp.dev'
    },
    license: 'MIT',
    keywords: ['metrics', 'monitoring', 'observability', 'performance', 'analytics'],
    capabilities: {
      canModifyRequest: true,
      canModifyResponse: true,
      canHandleErrors: true,
      canMonitor: true
    },
    priority: PluginPriority.NORMAL
  };

  readonly configSchema: PluginConfigSchema = {
    type: 'object',
    properties: {
      enabled: { type: 'boolean', default: true },
      settings: {
        type: 'object',
        properties: {
          backend: {
            type: 'string',
            enum: ['prometheus', 'statsD', 'datadog', 'newrelic', 'custom', 'console'],
            default: 'console'
          },
          interval: { type: 'number', default: 60000 },
          prefix: { type: 'string', default: 'fluxhttp' },
          request: {
            type: 'object',
            properties: {
              enabled: { type: 'boolean', default: true },
              includeHeaders: { type: 'boolean', default: false },
              includeParams: { type: 'boolean', default: false },
              trackUserAgent: { type: 'boolean', default: true }
            }
          },
          response: {
            type: 'object',
            properties: {
              enabled: { type: 'boolean', default: true },
              trackResponseSize: { type: 'boolean', default: true },
              trackContentType: { type: 'boolean', default: true },
              percentiles: {
                type: 'array',
                items: { type: 'number' },
                default: [50, 95, 99]
              }
            }
          },
          error: {
            type: 'object',
            properties: {
              enabled: { type: 'boolean', default: true },
              groupByStatus: { type: 'boolean', default: true },
              groupByErrorCode: { type: 'boolean', default: true },
              trackStackTrace: { type: 'boolean', default: false }
            }
          },
          performance: {
            type: 'object',
            properties: {
              enabled: { type: 'boolean', default: true },
              trackDNS: { type: 'boolean', default: false },
              trackTCP: { type: 'boolean', default: false },
              trackTLS: { type: 'boolean', default: false },
              trackFirstByte: { type: 'boolean', default: false },
              trackDownload: { type: 'boolean', default: false }
            }
          }
        }
      }
    }
  };

  state = PluginLifecycleState.UNINITIALIZED;
  config: MetricsPluginConfig;
  context?: PluginContext;

  private backend?: MetricsBackendInterface;
  private requestTimings = new Map<string, RequestTiming>();
  private aggregator?: MetricsAggregator;
  private metricsBuffer: MetricEntry[] = [];

  constructor(config: Partial<MetricsPluginConfig> = {}) {
    this.config = {
      enabled: true,
      settings: {
        backend: 'console',
        interval: 60000,
        prefix: 'fluxhttp',
        defaultTags: {},
        request: {
          enabled: true,
          includeHeaders: false,
          includeParams: false,
          trackUserAgent: true
        },
        response: {
          enabled: true,
          trackResponseSize: true,
          trackContentType: true,
          percentiles: [50, 95, 99]
        },
        error: {
          enabled: true,
          groupByStatus: true,
          groupByErrorCode: true,
          trackStackTrace: false
        },
        performance: {
          enabled: true,
          trackDNS: false,
          trackTCP: false,
          trackTLS: false,
          trackFirstByte: false,
          trackDownload: false,
          buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10]
        },
        business: {
          enabled: false,
          trackEndpoints: [],
          customMetrics: {}
        },
        sampling: {
          enabled: false,
          rate: 1.0,
          excludeHealthChecks: true
        },
        aggregation: {
          enabled: false,
          windowSize: 1000,
          flushInterval: 60000
        },
        ...config.settings
      },
      ...config
    } as MetricsPluginConfig;
  }

  /**
   * Initialize plugin
   */
  async init(context: PluginContext): Promise<void> {
    this.context = context;
    
    // Initialize metrics backend
    await this.initializeBackend();
    
    // Initialize aggregator if enabled
    if (this.config.settings.aggregation?.enabled) {
      this.aggregator = new MetricsAggregator(
        this.config.settings.aggregation.windowSize,
        this.config.settings.aggregation.flushInterval
      );
    }
    
    // Register interceptors
    this.interceptRequest(this.handleRequestMetrics.bind(this));
    this.interceptResponse(this.handleResponseMetrics.bind(this));
    this.interceptError(this.handleErrorMetrics.bind(this));
    
    // Start system metrics collection
    this.startSystemMetrics();
    
    context.logger.info('Metrics plugin initialized', {
      backend: this.config.settings.backend,
      prefix: this.config.settings.prefix,
      aggregation: this.config.settings.aggregation?.enabled
    });
  }

  /**
   * Stop plugin
   */
  async stop(context: PluginContext): Promise<void> {
    // Flush any remaining metrics
    if (this.backend?.flush) {
      await this.backend.flush();
    }
    
    // Close backend
    if (this.backend?.close) {
      await this.backend.close();
    }
    
    // Dispose aggregator
    if (this.aggregator) {
      this.aggregator.dispose();
    }
    
    context.logger.info('Metrics plugin stopped');
  }

  /**
   * Initialize metrics backend
   */
  private async initializeBackend(): Promise<void> {
    const backendType = this.config.settings.backend || 'console';
    
    switch (backendType) {
      case 'console':
        this.backend = new ConsoleMetricsBackend(this.config.settings.interval);
        break;
      
      case 'custom':
        if (!this.config.settings.customBackend) {
          throw new Error('Custom metrics backend is required');
        }
        this.backend = this.config.settings.customBackend;
        break;
      
      default:
        throw new Error(`Metrics backend '${backendType}' not implemented`);
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
   * Handle request metrics
   */
  private handleRequestMetrics(config: fluxhttpRequestConfig): fluxhttpRequestConfig {
    if (!this.config.settings.request?.enabled) {
      return config;
    }

    // Check sampling
    if (!this.shouldSample(config)) {
      return config;
    }

    const requestId = this.generateRequestId();
    const startTime = Date.now();
    
    // Store timing data
    this.requestTimings.set(requestId, { startTime });
    
    // Add request ID for tracking
    config.headers = {
      ...config.headers,
      'X-Request-ID': requestId
    };

    // Collect request metrics
    const tags = this.getRequestTags(config);
    
    this.counter('requests.total', 1, tags);
    this.counter('requests.started', 1, tags);

    // Track user agent if enabled
    if (this.config.settings.request.trackUserAgent && config.headers?.['User-Agent']) {
      const userAgent = this.parseUserAgent(config.headers['User-Agent'] as string);
      this.counter('requests.user_agent', 1, { ...tags, ...userAgent });
    }

    return config;
  }

  /**
   * Handle response metrics
   */
  private handleResponseMetrics(response: fluxhttpResponse): fluxhttpResponse {
    if (!this.config.settings.response?.enabled) {
      return response;
    }

    const requestId = response.config.headers?.['X-Request-ID'] as string;
    const timing = this.requestTimings.get(requestId);
    
    if (!timing) {
      return response;
    }

    const endTime = Date.now();
    const duration = endTime - timing.startTime;
    
    // Clean up timing data
    this.requestTimings.delete(requestId);

    // Collect response metrics
    const tags = this.getResponseTags(response);
    
    this.counter('requests.completed', 1, tags);
    this.histogram('requests.duration', duration, tags);
    this.timing('requests.response_time', duration, tags);

    // Track response size if enabled
    if (this.config.settings.response.trackResponseSize) {
      const responseSize = this.getResponseSize(response.data);
      this.histogram('requests.response_size', responseSize, tags);
    }

    // Track content type if enabled
    if (this.config.settings.response.trackContentType) {
      const contentType = this.getContentType(response.headers);
      this.counter('requests.content_type', 1, { ...tags, content_type: contentType });
    }

    // Business metrics
    if (this.config.settings.business?.enabled) {
      this.collectBusinessMetrics(response.config, response);
    }

    return response;
  }

  /**
   * Handle error metrics
   */
  private handleErrorMetrics(error: fluxhttpError): fluxhttpError {
    if (!this.config.settings.error?.enabled) {
      return error;
    }

    const requestId = error.config?.headers?.['X-Request-ID'] as string;
    const timing = this.requestTimings.get(requestId);
    
    if (timing) {
      const endTime = Date.now();
      const duration = endTime - timing.startTime;
      this.histogram('requests.error_duration', duration);
      this.requestTimings.delete(requestId);
    }

    // Collect error metrics
    const tags = this.getErrorTags(error);
    
    this.counter('requests.errors', 1, tags);
    this.counter('requests.failed', 1, tags);

    // Group by status code if enabled
    if (this.config.settings.error.groupByStatus && error.response) {
      this.counter('requests.status_code', 1, {
        ...tags,
        status_code: error.response.status.toString()
      });
    }

    // Group by error code if enabled
    if (this.config.settings.error.groupByErrorCode && error.code) {
      this.counter('requests.error_code', 1, {
        ...tags,
        error_code: error.code
      });
    }

    return error;
  }

  /**
   * Start system metrics collection
   */
  private startSystemMetrics(): void {
    setInterval(() => {
      // Collect system metrics
      this.gauge('system.active_requests', this.requestTimings.size);
      
      if (typeof process !== 'undefined' && process.memoryUsage) {
        const memory = process.memoryUsage();
        this.gauge('system.memory.rss', memory.rss);
        this.gauge('system.memory.heap_used', memory.heapUsed);
        this.gauge('system.memory.heap_total', memory.heapTotal);
        this.gauge('system.memory.external', memory.external);
      }
    }, this.config.settings.interval || 60000);
  }

  /**
   * Check if request should be sampled
   */
  private shouldSample(config: fluxhttpRequestConfig): boolean {
    const sampling = this.config.settings.sampling;
    
    if (!sampling?.enabled) {
      return true;
    }

    // Exclude health checks if configured
    if (sampling.excludeHealthChecks) {
      const url = config.url?.toLowerCase() || '';
      const healthPaths = ['/health', '/ping', '/status', '/ready', '/live'];
      if (healthPaths.some(path => url.includes(path))) {
        return false;
      }
    }

    // Apply sampling rate
    return Math.random() < (sampling.rate || 1.0);
  }

  /**
   * Get request tags
   */
  private getRequestTags(config: fluxhttpRequestConfig): Record<string, string> {
    const tags: Record<string, string> = {
      method: config.method?.toUpperCase() || 'GET',
      ...this.config.settings.defaultTags
    };

    // Add URL path (sanitized)
    if (config.url) {
      tags.path = this.sanitizePath(config.url);
    }

    return tags;
  }

  /**
   * Get response tags
   */
  private getResponseTags(response: fluxhttpResponse): Record<string, string> {
    const tags = this.getRequestTags(response.config);
    
    tags.status_code = response.status.toString();
    tags.status_class = `${Math.floor(response.status / 100)}xx`;
    
    return tags;
  }

  /**
   * Get error tags
   */
  private getErrorTags(error: fluxhttpError): Record<string, string> {
    const tags = error.config ? this.getRequestTags(error.config) : { ...this.config.settings.defaultTags };
    
    tags.error_type = error.response ? 'response_error' : 'network_error';
    
    if (error.response) {
      tags.status_code = error.response.status.toString();
      tags.status_class = `${Math.floor(error.response.status / 100)}xx`;
    }
    
    if (error.code) {
      tags.error_code = error.code;
    }
    
    return tags;
  }

  /**
   * Collect business metrics
   */
  private collectBusinessMetrics(config: fluxhttpRequestConfig, response: fluxhttpResponse): void {
    const businessConfig = this.config.settings.business!;
    
    // Track specific endpoints
    const url = config.url || '';
    for (const endpoint of businessConfig.trackEndpoints) {
      if (url.includes(endpoint)) {
        this.counter('business.endpoint', 1, {
          endpoint,
          status: response.status.toString()
        });
      }
    }

    // Custom business metrics
    for (const [metricName, metricFn] of Object.entries(businessConfig.customMetrics)) {
      try {
        const metrics = metricFn(config, response);
        for (const [name, value] of Object.entries(metrics)) {
          this.gauge(`business.${metricName}.${name}`, value);
        }
      } catch (error) {
        this.context?.logger.error('Business metric collection failed', {
          metric: metricName,
          error
        });
      }
    }
  }

  /**
   * Sanitize URL path for metrics
   */
  private sanitizePath(url: string): string {
    try {
      const parsed = new URL(url, 'http://localhost');
      let path = parsed.pathname;
      
      // Replace IDs and UUIDs with placeholders
      path = path.replace(/\/\d+/g, '/:id');
      path = path.replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/:uuid');
      
      return path;
    } catch {
      return '/unknown';
    }
  }

  /**
   * Parse user agent string
   */
  private parseUserAgent(userAgent: string): Record<string, string> {
    // Simple user agent parsing
    const tags: Record<string, string> = {};
    
    if (userAgent.includes('Chrome')) {
      tags.browser = 'chrome';
    } else if (userAgent.includes('Firefox')) {
      tags.browser = 'firefox';
    } else if (userAgent.includes('Safari')) {
      tags.browser = 'safari';
    } else if (userAgent.includes('Edge')) {
      tags.browser = 'edge';
    } else {
      tags.browser = 'other';
    }
    
    if (userAgent.includes('Mobile')) {
      tags.device = 'mobile';
    } else if (userAgent.includes('Tablet')) {
      tags.device = 'tablet';
    } else {
      tags.device = 'desktop';
    }
    
    return tags;
  }

  /**
   * Get response size
   */
  private getResponseSize(data: unknown): number {
    try {
      return JSON.stringify(data).length;
    } catch {
      return 0;
    }
  }

  /**
   * Get content type from headers
   */
  private getContentType(headers: Record<string, any>): string {
    const contentType = headers['content-type'] || headers['Content-Type'] || '';
    const base = contentType.split(';')[0].toLowerCase();
    
    if (base.includes('json')) return 'json';
    if (base.includes('xml')) return 'xml';
    if (base.includes('html')) return 'html';
    if (base.includes('text')) return 'text';
    if (base.includes('image')) return 'image';
    if (base.includes('video')) return 'video';
    if (base.includes('audio')) return 'audio';
    
    return 'other';
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Emit counter metric
   */
  private counter(name: string, value: number, tags: Record<string, string> = {}): void {
    const fullName = `${this.config.settings.prefix}.${name}`;
    
    if (this.aggregator) {
      this.aggregator.addMetric('counter', fullName, value, tags);
    }
    
    if (this.backend) {
      this.backend.counter(fullName, value, tags);
    }
  }

  /**
   * Emit gauge metric
   */
  private gauge(name: string, value: number, tags: Record<string, string> = {}): void {
    const fullName = `${this.config.settings.prefix}.${name}`;
    
    if (this.aggregator) {
      this.aggregator.addMetric('gauge', fullName, value, tags);
    }
    
    if (this.backend) {
      this.backend.gauge(fullName, value, tags);
    }
  }

  /**
   * Emit histogram metric
   */
  private histogram(name: string, value: number, tags: Record<string, string> = {}): void {
    const fullName = `${this.config.settings.prefix}.${name}`;
    
    if (this.aggregator) {
      this.aggregator.addMetric('histogram', fullName, value, tags);
    }
    
    if (this.backend) {
      this.backend.histogram(fullName, value, tags);
    }
  }

  /**
   * Emit timing metric
   */
  private timing(name: string, value: number, tags: Record<string, string> = {}): void {
    const fullName = `${this.config.settings.prefix}.${name}`;
    
    if (this.aggregator) {
      this.aggregator.addMetric('timing', fullName, value, tags);
    }
    
    if (this.backend) {
      this.backend.timing(fullName, value, tags);
    }
  }

  /**
   * Get aggregated metrics
   */
  getAggregatedMetrics(): AggregatedMetric[] {
    return this.aggregator?.getAggregatedMetrics() || [];
  }

  /**
   * Update configuration
   */
  async updateConfig(config: Partial<MetricsPluginConfig>): Promise<void> {
    this.config = { ...this.config, ...config };
    
    // Reinitialize backend if changed
    if (config.settings?.backend) {
      if (this.backend?.close) {
        await this.backend.close();
      }
      await this.initializeBackend();
    }
    
    this.context?.logger.info('Metrics plugin configuration updated');
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
        backend: this.config.settings.backend,
        activeRequests: this.requestTimings.size,
        aggregation: this.config.settings.aggregation?.enabled,
        sampling: this.config.settings.sampling?.enabled
      }
    };
  }

  /**
   * Get plugin metrics
   */
  async getMetrics() {
    return {
      backend: this.config.settings.backend,
      prefix: this.config.settings.prefix,
      activeRequests: this.requestTimings.size,
      aggregatedMetrics: this.getAggregatedMetrics().length
    };
  }
}

/**
 * Metrics plugin factory
 */
export function createMetricsPlugin(config?: Partial<MetricsPluginConfig>): MetricsPlugin {
  return new MetricsPlugin(config);
}