/**
 * @fileoverview Metrics and observability for FluxHTTP
 * @module @fluxhttp/core/features/metrics
 */

import type { fluxhttpRequestConfig, fluxhttpResponse, fluxhttpError } from '../types';

/**
 * HTTP request metrics
 */
export interface RequestMetrics {
  /** Unique request ID */
  requestId: string;
  /** Request method */
  method: string;
  /** Request URL */
  url: string;
  /** HTTP status code */
  statusCode?: number;
  /** Request start time */
  startTime: number;
  /** Request end time */
  endTime?: number;
  /** Total duration in milliseconds */
  duration?: number;
  /** DNS lookup time */
  dnsLookupTime?: number;
  /** TCP connection time */
  connectionTime?: number;
  /** TLS handshake time */
  tlsTime?: number;
  /** Time to first byte */
  timeToFirstByte?: number;
  /** Content download time */
  downloadTime?: number;
  /** Request size in bytes */
  requestSize: number;
  /** Response size in bytes */
  responseSize?: number;
  /** Error information */
  error?: {
    code?: string;
    message: string;
    type: 'network' | 'timeout' | 'abort' | 'server' | 'client' | 'unknown';
  };
  /** Additional metadata */
  metadata: Record<string, unknown>;
}

/**
 * Performance metrics aggregated over time
 */
export interface PerformanceMetrics {
  /** Total number of requests */
  totalRequests: number;
  /** Number of successful requests */
  successfulRequests: number;
  /** Number of failed requests */
  failedRequests: number;
  /** Success rate percentage */
  successRate: number;
  /** Average response time */
  averageResponseTime: number;
  /** Median response time */
  medianResponseTime: number;
  /** 95th percentile response time */
  p95ResponseTime: number;
  /** 99th percentile response time */
  p99ResponseTime: number;
  /** Minimum response time */
  minResponseTime: number;
  /** Maximum response time */
  maxResponseTime: number;
  /** Requests per second */
  requestsPerSecond: number;
  /** Average request size */
  averageRequestSize: number;
  /** Average response size */
  averageResponseSize: number;
  /** Total bytes sent */
  totalBytesSent: number;
  /** Total bytes received */
  totalBytesReceived: number;
  /** Error rate by type */
  errorsByType: Record<string, number>;
  /** Status code distribution */
  statusCodeDistribution: Record<number, number>;
  /** Top slow requests */
  slowestRequests: Array<Pick<RequestMetrics, 'requestId' | 'url' | 'duration' | 'statusCode'>>;
}

/**
 * Tracing span for request lifecycle
 */
export interface TraceSpan {
  /** Unique span ID */
  spanId: string;
  /** Parent span ID */
  parentSpanId?: string;
  /** Trace ID for correlation */
  traceId: string;
  /** Operation name */
  operationName: string;
  /** Span start time */
  startTime: number;
  /** Span end time */
  endTime?: number;
  /** Span duration */
  duration?: number;
  /** Span tags */
  tags: Record<string, string | number | boolean>;
  /** Span logs */
  logs: Array<{
    timestamp: number;
    fields: Record<string, unknown>;
  }>;
  /** Span status */
  status: 'ok' | 'error' | 'timeout' | 'cancelled';
}

/**
 * Health check result
 */
export interface HealthCheckResult {
  /** Check name */
  name: string;
  /** Health status */
  status: 'healthy' | 'unhealthy' | 'degraded';
  /** Check duration */
  duration: number;
  /** Timestamp of check */
  timestamp: number;
  /** Additional details */
  details?: Record<string, unknown>;
  /** Error message if unhealthy */
  error?: string;
}

/**
 * Overall system health
 */
export interface SystemHealth {
  /** Overall status */
  status: 'healthy' | 'unhealthy' | 'degraded';
  /** Individual check results */
  checks: HealthCheckResult[];
  /** System uptime */
  uptime: number;
  /** Memory usage */
  memory?: {
    used: number;
    total: number;
    percentage: number;
  };
  /** CPU usage */
  cpu?: {
    percentage: number;
    loadAverage?: number[];
  };
  /** Request metrics summary */
  requests?: {
    total: number;
    successful: number;
    failed: number;
    averageResponseTime: number;
  };
}

/**
 * Metrics collector configuration
 */
export interface MetricsConfig {
  /** Whether metrics collection is enabled */
  enabled: boolean;
  /** Sample rate (0-1) for tracing */
  sampleRate: number;
  /** Maximum number of metrics to keep in memory */
  maxMetrics: number;
  /** Metrics retention period in milliseconds */
  retentionPeriod: number;
  /** Whether to collect detailed timing information */
  collectTimings: boolean;
  /** Whether to collect request/response sizes */
  collectSizes: boolean;
  /** Tags to add to all metrics */
  globalTags: Record<string, string>;
  /** Custom metric extractors */
  extractors: {
    /** Extract custom tags from request */
    requestTags?: (config: fluxhttpRequestConfig) => Record<string, string>;
    /** Extract custom tags from response */
    responseTags?: (response: fluxhttpResponse) => Record<string, string>;
    /** Extract custom tags from error */
    errorTags?: (error: fluxhttpError) => Record<string, string>;
  };
}

/**
 * Request timing information
 */
export interface RequestTimings {
  /** DNS lookup time */
  dnsLookup?: number;
  /** TCP connection time */
  tcpConnection?: number;
  /** TLS handshake time */
  tlsHandshake?: number;
  /** Time to first byte */
  timeToFirstByte?: number;
  /** Content download time */
  contentDownload?: number;
  /** Total time */
  total: number;
}

/**
 * Metrics and observability collector
 */
export class MetricsCollector {
  private config: Required<MetricsConfig>;
  private metrics = new Map<string, RequestMetrics>();
  private traces = new Map<string, TraceSpan[]>();
  private healthChecks = new Map<string, () => Promise<HealthCheckResult>>();
  private performanceData: RequestMetrics[] = [];
  private requestIdCounter = 0;

  constructor(config: Partial<MetricsConfig> = {}) {
    this.config = {
      enabled: true,
      sampleRate: 1.0,
      maxMetrics: 10000,
      retentionPeriod: 3600000, // 1 hour
      collectTimings: true,
      collectSizes: true,
      globalTags: {},
      extractors: {},
      ...config
    };

    // Cleanup old metrics periodically
    setInterval(() => this.cleanupOldMetrics(), 60000); // Every minute
  }

  /**
   * Start tracking a request
   */
  startRequest(config: fluxhttpRequestConfig): string {
    if (!this.config.enabled) {
      return '';
    }

    const requestId = this.generateRequestId();
    const url = this.buildFullUrl(config);

    const metrics: RequestMetrics = {
      requestId,
      method: config.method?.toUpperCase() || 'GET',
      url,
      startTime: Date.now(),
      requestSize: this.calculateRequestSize(config),
      metadata: {
        ...this.config.globalTags,
        ...(this.config.extractors.requestTags?.(config) || {})
      }
    };

    this.metrics.set(requestId, metrics);

    // Start tracing if enabled
    if (Math.random() <= this.config.sampleRate) {
      this.startTrace(requestId, 'http_request', {
        'http.method': metrics.method,
        'http.url': metrics.url,
        'http.request_size': metrics.requestSize
      });
    }

    return requestId;
  }

  /**
   * Record successful response
   */
  recordResponse(requestId: string, response: fluxhttpResponse, timings?: RequestTimings): void {
    if (!this.config.enabled || !requestId) {
      return;
    }

    const metrics = this.metrics.get(requestId);
    if (!metrics) {
      return;
    }

    const endTime = Date.now();
    const duration = endTime - metrics.startTime;

    // Update metrics
    metrics.endTime = endTime;
    metrics.duration = duration;
    metrics.statusCode = response.status;
    
    if (this.config.collectSizes) {
      metrics.responseSize = this.calculateResponseSize(response);
    }

    if (this.config.collectTimings && timings) {
      metrics.dnsLookupTime = timings.dnsLookup;
      metrics.connectionTime = timings.tcpConnection;
      metrics.tlsTime = timings.tlsHandshake;
      metrics.timeToFirstByte = timings.timeToFirstByte;
      metrics.downloadTime = timings.contentDownload;
    }

    // Add response tags
    if (this.config.extractors.responseTags) {
      Object.assign(metrics.metadata, this.config.extractors.responseTags(response));
    }

    // Add to performance data
    this.performanceData.push(metrics);
    this.trimPerformanceData();

    // Finish trace
    this.finishTrace(requestId, 'ok', {
      'http.status_code': response.status,
      'http.response_size': metrics.responseSize || 0
    });
  }

  /**
   * Record request error
   */
  recordError(requestId: string, error: fluxhttpError, timings?: RequestTimings): void {
    if (!this.config.enabled || !requestId) {
      return;
    }

    const metrics = this.metrics.get(requestId);
    if (!metrics) {
      return;
    }

    const endTime = Date.now();
    const duration = endTime - metrics.startTime;

    // Update metrics
    metrics.endTime = endTime;
    metrics.duration = duration;
    metrics.statusCode = error.response?.status;
    
    metrics.error = {
      code: error.code,
      message: error.message,
      type: this.categorizeError(error)
    };

    if (this.config.collectTimings && timings) {
      metrics.dnsLookupTime = timings.dnsLookup;
      metrics.connectionTime = timings.tcpConnection;
      metrics.tlsTime = timings.tlsHandshake;
      metrics.timeToFirstByte = timings.timeToFirstByte;
      metrics.downloadTime = timings.contentDownload;
    }

    // Add error tags
    if (this.config.extractors.errorTags) {
      Object.assign(metrics.metadata, this.config.extractors.errorTags(error));
    }

    // Add to performance data
    this.performanceData.push(metrics);
    this.trimPerformanceData();

    // Finish trace with error
    this.finishTrace(requestId, 'error', {
      'error': true,
      'error.type': metrics.error.type,
      'error.message': metrics.error.message,
      'http.status_code': metrics.statusCode || 0
    });
  }

  /**
   * Start a trace span
   */
  startTrace(requestId: string, operationName: string, tags: Record<string, string | number | boolean> = {}): string {
    const spanId = this.generateSpanId();
    const traceId = requestId; // Use request ID as trace ID for simplicity

    const span: TraceSpan = {
      spanId,
      traceId,
      operationName,
      startTime: Date.now(),
      tags: { ...tags, ...this.config.globalTags },
      logs: [],
      status: 'ok'
    };

    if (!this.traces.has(traceId)) {
      this.traces.set(traceId, []);
    }
    this.traces.get(traceId)!.push(span);

    return spanId;
  }

  /**
   * Finish a trace span
   */
  finishTrace(
    requestId: string, 
    status: TraceSpan['status'], 
    tags: Record<string, string | number | boolean> = {}
  ): void {
    const spans = this.traces.get(requestId);
    if (!spans || spans.length === 0) {
      return;
    }

    const span = spans[spans.length - 1]; // Get the last span
    span.endTime = Date.now();
    span.duration = span.endTime - span.startTime;
    span.status = status;
    Object.assign(span.tags, tags);
  }

  /**
   * Add log entry to current trace span
   */
  addTraceLog(requestId: string, fields: Record<string, unknown>): void {
    const spans = this.traces.get(requestId);
    if (!spans || spans.length === 0) {
      return;
    }

    const span = spans[spans.length - 1];
    span.logs.push({
      timestamp: Date.now(),
      fields
    });
  }

  /**
   * Register a health check
   */
  registerHealthCheck(name: string, check: () => Promise<HealthCheckResult>): void {
    this.healthChecks.set(name, check);
  }

  /**
   * Remove a health check
   */
  removeHealthCheck(name: string): boolean {
    return this.healthChecks.delete(name);
  }

  /**
   * Perform all health checks
   */
  async performHealthChecks(): Promise<SystemHealth> {
    const checks: HealthCheckResult[] = [];
    
    for (const [name, check] of this.healthChecks) {
      try {
        const result = await check();
        checks.push(result);
      } catch (error) {
        checks.push({
          name,
          status: 'unhealthy',
          duration: 0,
          timestamp: Date.now(),
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    // Determine overall status
    const statuses = checks.map(check => check.status);
    let overallStatus: SystemHealth['status'] = 'healthy';
    
    if (statuses.includes('unhealthy')) {
      overallStatus = 'unhealthy';
    } else if (statuses.includes('degraded')) {
      overallStatus = 'degraded';
    }

    // Get system metrics
    const systemHealth: SystemHealth = {
      status: overallStatus,
      checks,
      uptime: process.uptime?.() * 1000 || 0
    };

    // Add memory usage if available
    if (typeof process !== 'undefined' && process.memoryUsage) {
      const memUsage = process.memoryUsage();
      systemHealth.memory = {
        used: memUsage.heapUsed,
        total: memUsage.heapTotal,
        percentage: (memUsage.heapUsed / memUsage.heapTotal) * 100
      };
    }

    // Add CPU usage if available
    if (typeof process !== 'undefined' && process.cpuUsage) {
      const cpuUsage = process.cpuUsage();
      systemHealth.cpu = {
        percentage: (cpuUsage.user + cpuUsage.system) / 1000000, // Convert to percentage
        loadAverage: process.loadavg?.()
      };
    }

    // Add request summary
    const perfMetrics = this.getPerformanceMetrics();
    systemHealth.requests = {
      total: perfMetrics.totalRequests,
      successful: perfMetrics.successfulRequests,
      failed: perfMetrics.failedRequests,
      averageResponseTime: perfMetrics.averageResponseTime
    };

    return systemHealth;
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics(): PerformanceMetrics {
    const recentData = this.performanceData.filter(
      metric => metric.endTime && (Date.now() - metric.endTime) <= this.config.retentionPeriod
    );

    if (recentData.length === 0) {
      return this.getEmptyPerformanceMetrics();
    }

    const totalRequests = recentData.length;
    const successfulRequests = recentData.filter(m => !m.error && m.statusCode && m.statusCode < 400).length;
    const failedRequests = totalRequests - successfulRequests;
    
    const durations = recentData.map(m => m.duration || 0).sort((a, b) => a - b);
    const requestSizes = recentData.map(m => m.requestSize);
    const responseSizes = recentData.map(m => m.responseSize || 0);

    // Calculate percentiles
    const p95Index = Math.floor(durations.length * 0.95);
    const p99Index = Math.floor(durations.length * 0.99);
    const medianIndex = Math.floor(durations.length * 0.5);

    // Error distribution
    const errorsByType: Record<string, number> = {};
    const statusCodeDistribution: Record<number, number> = {};

    for (const metric of recentData) {
      if (metric.error) {
        errorsByType[metric.error.type] = (errorsByType[metric.error.type] || 0) + 1;
      }
      
      if (metric.statusCode) {
        statusCodeDistribution[metric.statusCode] = (statusCodeDistribution[metric.statusCode] || 0) + 1;
      }
    }

    // Slowest requests
    const slowestRequests = recentData
      .filter(m => m.duration)
      .sort((a, b) => (b.duration || 0) - (a.duration || 0))
      .slice(0, 10)
      .map(m => ({
        requestId: m.requestId,
        url: m.url,
        duration: m.duration!,
        statusCode: m.statusCode
      }));

    // Calculate RPS (requests per second)
    const timeSpan = Math.max(
      recentData[recentData.length - 1].endTime! - recentData[0].startTime,
      1000
    ) / 1000;

    return {
      totalRequests,
      successfulRequests,
      failedRequests,
      successRate: (successfulRequests / totalRequests) * 100,
      averageResponseTime: durations.reduce((sum, d) => sum + d, 0) / durations.length,
      medianResponseTime: durations[medianIndex] || 0,
      p95ResponseTime: durations[p95Index] || 0,
      p99ResponseTime: durations[p99Index] || 0,
      minResponseTime: durations[0] || 0,
      maxResponseTime: durations[durations.length - 1] || 0,
      requestsPerSecond: totalRequests / timeSpan,
      averageRequestSize: requestSizes.reduce((sum, s) => sum + s, 0) / requestSizes.length,
      averageResponseSize: responseSizes.reduce((sum, s) => sum + s, 0) / responseSizes.length,
      totalBytesSent: requestSizes.reduce((sum, s) => sum + s, 0),
      totalBytesReceived: responseSizes.reduce((sum, s) => sum + s, 0),
      errorsByType,
      statusCodeDistribution,
      slowestRequests
    };
  }

  /**
   * Get trace data for a request
   */
  getTrace(requestId: string): TraceSpan[] | undefined {
    return this.traces.get(requestId);
  }

  /**
   * Get all traces
   */
  getAllTraces(): Map<string, TraceSpan[]> {
    return new Map(this.traces);
  }

  /**
   * Get request metrics
   */
  getRequestMetrics(requestId: string): RequestMetrics | undefined {
    return this.metrics.get(requestId);
  }

  /**
   * Get all request metrics
   */
  getAllRequestMetrics(): RequestMetrics[] {
    return Array.from(this.metrics.values());
  }

  /**
   * Clear all metrics and traces
   */
  clear(): void {
    this.metrics.clear();
    this.traces.clear();
    this.performanceData = [];
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `req-${Date.now()}-${++this.requestIdCounter}`;
  }

  /**
   * Generate unique span ID
   */
  private generateSpanId(): string {
    return `span-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Build full URL from config
   */
  private buildFullUrl(config: fluxhttpRequestConfig): string {
    let url = config.url || '';
    
    if (config.baseURL && !url.startsWith('http')) {
      url = config.baseURL.replace(/\/$/, '') + '/' + url.replace(/^\//, '');
    }

    if (config.params) {
      const searchParams = new URLSearchParams();
      for (const [key, value] of Object.entries(config.params)) {
        if (Array.isArray(value)) {
          value.forEach(v => searchParams.append(key, String(v)));
        } else {
          searchParams.append(key, String(value));
        }
      }
      
      const paramString = searchParams.toString();
      if (paramString) {
        url += (url.includes('?') ? '&' : '?') + paramString;
      }
    }

    return url;
  }

  /**
   * Calculate request size
   */
  private calculateRequestSize(config: fluxhttpRequestConfig): number {
    let size = 0;

    // URL size
    size += this.buildFullUrl(config).length;

    // Headers size
    if (config.headers) {
      for (const [key, value] of Object.entries(config.headers)) {
        size += key.length + String(value).length + 4; // +4 for ": " and "\r\n"
      }
    }

    // Body size
    if (config.data) {
      if (typeof config.data === 'string') {
        size += config.data.length;
      } else if (config.data instanceof ArrayBuffer) {
        size += config.data.byteLength;
      } else if (config.data instanceof FormData) {
        // Rough estimation for FormData
        size += 1024; // Placeholder
      } else {
        size += JSON.stringify(config.data).length;
      }
    }

    return size;
  }

  /**
   * Calculate response size
   */
  private calculateResponseSize(response: fluxhttpResponse): number {
    let size = 0;

    // Headers size
    for (const [key, value] of Object.entries(response.headers)) {
      size += key.length + String(value).length + 4;
    }

    // Body size
    if (response.data) {
      if (typeof response.data === 'string') {
        size += response.data.length;
      } else if (response.data instanceof ArrayBuffer) {
        size += response.data.byteLength;
      } else {
        try {
          size += JSON.stringify(response.data).length;
        } catch {
          size += 0; // Can't serialize
        }
      }
    }

    return size;
  }

  /**
   * Categorize error type
   */
  private categorizeError(error: fluxhttpError): RequestMetrics['error']['type'] {
    if (error.code === 'TIMEOUT' || error.message.toLowerCase().includes('timeout')) {
      return 'timeout';
    }

    if (error.code === 'ECONNABORTED' || error.message.toLowerCase().includes('abort')) {
      return 'abort';
    }

    if (!error.response) {
      return 'network';
    }

    if (error.response.status >= 500) {
      return 'server';
    }

    if (error.response.status >= 400) {
      return 'client';
    }

    return 'unknown';
  }

  /**
   * Cleanup old metrics
   */
  private cleanupOldMetrics(): void {
    const cutoff = Date.now() - this.config.retentionPeriod;

    // Clean up individual metrics
    for (const [requestId, metric] of this.metrics) {
      if (metric.endTime && metric.endTime < cutoff) {
        this.metrics.delete(requestId);
      }
    }

    // Clean up traces
    for (const [traceId, spans] of this.traces) {
      const lastSpan = spans[spans.length - 1];
      if (lastSpan.endTime && lastSpan.endTime < cutoff) {
        this.traces.delete(traceId);
      }
    }

    // Clean up performance data
    this.performanceData = this.performanceData.filter(
      metric => !metric.endTime || metric.endTime >= cutoff
    );
  }

  /**
   * Trim performance data to max size
   */
  private trimPerformanceData(): void {
    if (this.performanceData.length > this.config.maxMetrics) {
      // Remove oldest entries
      this.performanceData = this.performanceData
        .sort((a, b) => (b.endTime || 0) - (a.endTime || 0))
        .slice(0, this.config.maxMetrics);
    }
  }

  /**
   * Get empty performance metrics
   */
  private getEmptyPerformanceMetrics(): PerformanceMetrics {
    return {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      successRate: 0,
      averageResponseTime: 0,
      medianResponseTime: 0,
      p95ResponseTime: 0,
      p99ResponseTime: 0,
      minResponseTime: 0,
      maxResponseTime: 0,
      requestsPerSecond: 0,
      averageRequestSize: 0,
      averageResponseSize: 0,
      totalBytesSent: 0,
      totalBytesReceived: 0,
      errorsByType: {},
      statusCodeDistribution: {},
      slowestRequests: []
    };
  }

  /**
   * Export metrics in various formats
   */
  exportMetrics(format: 'json' | 'prometheus' = 'json'): string {
    if (format === 'prometheus') {
      return this.exportPrometheusMetrics();
    }

    return JSON.stringify({
      performance: this.getPerformanceMetrics(),
      requests: this.getAllRequestMetrics(),
      traces: Object.fromEntries(this.getAllTraces())
    }, null, 2);
  }

  /**
   * Export metrics in Prometheus format
   */
  private exportPrometheusMetrics(): string {
    const perfMetrics = this.getPerformanceMetrics();
    const lines: string[] = [];

    // HTTP request metrics
    lines.push('# HELP fluxhttp_requests_total Total number of HTTP requests');
    lines.push('# TYPE fluxhttp_requests_total counter');
    lines.push(`fluxhttp_requests_total ${perfMetrics.totalRequests}`);

    lines.push('# HELP fluxhttp_requests_successful Total number of successful HTTP requests');
    lines.push('# TYPE fluxhttp_requests_successful counter');
    lines.push(`fluxhttp_requests_successful ${perfMetrics.successfulRequests}`);

    lines.push('# HELP fluxhttp_response_time_seconds HTTP response time in seconds');
    lines.push('# TYPE fluxhttp_response_time_seconds summary');
    lines.push(`fluxhttp_response_time_seconds{quantile="0.5"} ${perfMetrics.medianResponseTime / 1000}`);
    lines.push(`fluxhttp_response_time_seconds{quantile="0.95"} ${perfMetrics.p95ResponseTime / 1000}`);
    lines.push(`fluxhttp_response_time_seconds{quantile="0.99"} ${perfMetrics.p99ResponseTime / 1000}`);

    // Status code distribution
    for (const [status, count] of Object.entries(perfMetrics.statusCodeDistribution)) {
      lines.push(`fluxhttp_requests_total{status="${status}"} ${count}`);
    }

    return lines.join('\n');
  }
}

/**
 * Built-in health checks
 */
export class DefaultHealthChecks {
  /**
   * Memory usage health check
   */
  static memoryUsage(threshold = 0.9): () => Promise<HealthCheckResult> {
    return async () => {
      const start = Date.now();
      
      if (typeof process === 'undefined' || !process.memoryUsage) {
        return {
          name: 'memory-usage',
          status: 'degraded',
          duration: Date.now() - start,
          timestamp: Date.now(),
          details: { reason: 'Memory usage not available in this environment' }
        };
      }

      const usage = process.memoryUsage();
      const usageRatio = usage.heapUsed / usage.heapTotal;

      return {
        name: 'memory-usage',
        status: usageRatio > threshold ? 'unhealthy' : 'healthy',
        duration: Date.now() - start,
        timestamp: Date.now(),
        details: {
          heapUsed: usage.heapUsed,
          heapTotal: usage.heapTotal,
          percentage: Math.round(usageRatio * 100),
          threshold: Math.round(threshold * 100)
        }
      };
    };
  }

  /**
   * HTTP endpoint health check
   */
  static httpEndpoint(url: string, timeout = 5000): () => Promise<HealthCheckResult> {
    return async () => {
      const start = Date.now();
      
      try {
        // This would use the FluxHTTP client in real implementation
        const response = await fetch(url, {
          method: 'GET',
          signal: AbortSignal.timeout(timeout)
        });

        return {
          name: `http-${url}`,
          status: response.ok ? 'healthy' : 'unhealthy',
          duration: Date.now() - start,
          timestamp: Date.now(),
          details: {
            status: response.status,
            statusText: response.statusText
          }
        };
      } catch (error) {
        return {
          name: `http-${url}`,
          status: 'unhealthy',
          duration: Date.now() - start,
          timestamp: Date.now(),
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    };
  }

  /**
   * Disk space health check (Node.js only)
   */
  static diskSpace(path = '/', threshold = 0.9): () => Promise<HealthCheckResult> {
    return async () => {
      const start = Date.now();
      
      try {
        // This would require fs.statSync in Node.js
        // Simplified implementation
        return {
          name: 'disk-space',
          status: 'healthy',
          duration: Date.now() - start,
          timestamp: Date.now(),
          details: { note: 'Disk space check not implemented in this example' }
        };
      } catch (error) {
        return {
          name: 'disk-space',
          status: 'unhealthy',
          duration: Date.now() - start,
          timestamp: Date.now(),
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    };
  }
}

export default MetricsCollector;