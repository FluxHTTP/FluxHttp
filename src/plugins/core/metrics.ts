/**
 * @fileoverview Plugin metrics implementation
 * @module @fluxhttp/plugins/core/metrics
 */

import type { PluginMetrics as IPluginMetrics, PluginTimer } from '../types';

/**
 * Metrics configuration
 */
export interface PluginMetricsConfig {
  enabled?: boolean;
  namespace?: string;
  flushInterval?: number;
  maxMetrics?: number;
  tags?: Record<string, string>;
}

/**
 * Metric types
 */
type MetricType = 'counter' | 'gauge' | 'histogram' | 'timer';

/**
 * Metric entry
 */
interface MetricEntry {
  type: MetricType;
  name: string;
  value: number;
  tags: Record<string, string>;
  timestamp: number;
}

/**
 * Histogram bucket
 */
interface HistogramBucket {
  le: number;
  count: number;
}

/**
 * Histogram data
 */
interface HistogramData {
  count: number;
  sum: number;
  buckets: HistogramBucket[];
  min: number;
  max: number;
  avg: number;
}

/**
 * Plugin timer implementation
 */
class Timer implements PluginTimer {
  private startTime = Date.now();
  private stopped = false;

  constructor(
    private readonly metrics: PluginMetrics,
    private readonly name: string,
    private readonly tags: Record<string, string> = {}
  ) {}

  /**
   * Stop timer and record value
   */
  stop(): void {
    if (this.stopped) {
      return;
    }

    const elapsed = this.elapsed();
    this.metrics.timing(this.name, elapsed, this.tags);
    this.stopped = true;
  }

  /**
   * Get elapsed time without stopping
   */
  elapsed(): number {
    return Date.now() - this.startTime;
  }
}

/**
 * Plugin metrics implementation
 */
export class PluginMetrics implements IPluginMetrics {
  private readonly config: Required<PluginMetricsConfig>;
  private readonly counters = new Map<string, number>();
  private readonly gauges = new Map<string, number>();
  private readonly histograms = new Map<string, HistogramData>();
  private readonly metrics: MetricEntry[] = [];
  private readonly defaultTags: Record<string, string>;
  private flushTimer?: NodeJS.Timeout;

  constructor(config: PluginMetricsConfig = {}) {
    this.config = {
      enabled: true,
      namespace: 'fluxhttp.plugins',
      flushInterval: 60000, // 1 minute
      maxMetrics: 10000,
      tags: {},
      ...config
    };

    this.defaultTags = { ...this.config.tags };

    if (this.config.enabled && this.config.flushInterval > 0) {
      this.startFlushTimer();
    }
  }

  /**
   * Increment a counter
   */
  increment(name: string, value = 1, tags: Record<string, string> = {}): void {
    if (!this.config.enabled) {
      return;
    }

    const fullName = this.getFullName(name);
    const key = this.getMetricKey(fullName, tags);
    
    this.counters.set(key, (this.counters.get(key) || 0) + value);
    this.addMetric('counter', fullName, value, tags);
  }

  /**
   * Decrement a counter
   */
  decrement(name: string, value = 1, tags: Record<string, string> = {}): void {
    this.increment(name, -value, tags);
  }

  /**
   * Record a gauge value
   */
  gauge(name: string, value: number, tags: Record<string, string> = {}): void {
    if (!this.config.enabled) {
      return;
    }

    const fullName = this.getFullName(name);
    const key = this.getMetricKey(fullName, tags);
    
    this.gauges.set(key, value);
    this.addMetric('gauge', fullName, value, tags);
  }

  /**
   * Record a histogram value
   */
  histogram(name: string, value: number, tags: Record<string, string> = {}): void {
    if (!this.config.enabled) {
      return;
    }

    const fullName = this.getFullName(name);
    const key = this.getMetricKey(fullName, tags);
    
    let histogram = this.histograms.get(key);
    if (!histogram) {
      histogram = {
        count: 0,
        sum: 0,
        buckets: this.createHistogramBuckets(),
        min: Infinity,
        max: -Infinity,
        avg: 0
      };
      this.histograms.set(key, histogram);
    }

    // Update histogram
    histogram.count++;
    histogram.sum += value;
    histogram.min = Math.min(histogram.min, value);
    histogram.max = Math.max(histogram.max, value);
    histogram.avg = histogram.sum / histogram.count;

    // Update buckets
    for (const bucket of histogram.buckets) {
      if (value <= bucket.le) {
        bucket.count++;
      }
    }

    this.addMetric('histogram', fullName, value, tags);
  }

  /**
   * Record a timing value
   */
  timing(name: string, value: number, tags: Record<string, string> = {}): void {
    this.histogram(`${name}.duration`, value, tags);
  }

  /**
   * Start a timer
   */
  timer(name: string, tags: Record<string, string> = {}): PluginTimer {
    return new Timer(this, name, tags);
  }

  /**
   * Get metric statistics
   */
  getStats(): Record<string, unknown> {
    const stats: Record<string, unknown> = {
      counters: Object.fromEntries(this.counters),
      gauges: Object.fromEntries(this.gauges),
      histograms: {},
      metricCount: this.metrics.length,
      enabled: this.config.enabled
    };

    // Format histogram data
    const histograms: Record<string, any> = {};
    for (const [key, histogram] of this.histograms) {
      histograms[key] = {
        count: histogram.count,
        sum: histogram.sum,
        min: histogram.min,
        max: histogram.max,
        avg: histogram.avg,
        buckets: histogram.buckets.map(bucket => ({
          le: bucket.le,
          count: bucket.count
        }))
      };
    }
    stats.histograms = histograms;

    return stats;
  }

  /**
   * Create child metrics instance
   */
  child(namespace: string, tags: Record<string, string> = {}): PluginMetrics {
    const childConfig = {
      ...this.config,
      namespace: `${this.config.namespace}.${namespace}`,
      tags: { ...this.config.tags, ...tags }
    };
    return new PluginMetrics(childConfig);
  }

  /**
   * Flush metrics
   */
  flush(): void {
    if (!this.config.enabled) {
      return;
    }

    // In a real implementation, this would send metrics to a backend
    // For now, we'll just clear old metrics
    const cutoff = Date.now() - (this.config.flushInterval * 2);
    for (let i = this.metrics.length - 1; i >= 0; i--) {
      if (this.metrics[i].timestamp < cutoff) {
        this.metrics.splice(i, 1);
      }
    }

    // Enforce max metrics limit
    if (this.metrics.length > this.config.maxMetrics) {
      this.metrics.splice(0, this.metrics.length - this.config.maxMetrics);
    }
  }

  /**
   * Dispose metrics
   */
  dispose(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = undefined;
    }
    
    this.counters.clear();
    this.gauges.clear();
    this.histograms.clear();
    this.metrics.length = 0;
  }

  // Private methods

  /**
   * Get full metric name with namespace
   */
  private getFullName(name: string): string {
    return `${this.config.namespace}.${name}`;
  }

  /**
   * Get metric key including tags
   */
  private getMetricKey(name: string, tags: Record<string, string>): string {
    const allTags = { ...this.defaultTags, ...tags };
    const tagString = Object.keys(allTags)
      .sort()
      .map(key => `${key}=${allTags[key]}`)
      .join(',');
    
    return tagString ? `${name}{${tagString}}` : name;
  }

  /**
   * Add metric entry
   */
  private addMetric(
    type: MetricType,
    name: string,
    value: number,
    tags: Record<string, string>
  ): void {
    const allTags = { ...this.defaultTags, ...tags };
    
    this.metrics.push({
      type,
      name,
      value,
      tags: allTags,
      timestamp: Date.now()
    });

    // Enforce max metrics limit
    if (this.metrics.length > this.config.maxMetrics) {
      this.metrics.shift();
    }
  }

  /**
   * Create histogram buckets
   */
  private createHistogramBuckets(): HistogramBucket[] {
    const buckets = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, Infinity];
    return buckets.map(le => ({ le, count: 0 }));
  }

  /**
   * Start flush timer
   */
  private startFlushTimer(): void {
    this.flushTimer = setInterval(() => {
      this.flush();
    }, this.config.flushInterval);

    // Don't prevent process exit
    if (this.flushTimer.unref) {
      this.flushTimer.unref();
    }
  }
}