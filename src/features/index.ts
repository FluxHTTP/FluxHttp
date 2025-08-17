/**
 * @fileoverview FluxHTTP Enterprise Features
 * @module @fluxhttp/core/features
 */

// Streaming Support
export {
  StreamingFeature,
  StreamingResponseReader,
  StreamingRequestWriter,
  StreamingUtils,
  type StreamChunk,
  type StreamConfig,
  type StreamProgress,
  type StreamEventHandlers,
  type StreamingRequestConfig,
  type StreamingResponse
} from './streaming';

// WebSocket Integration
export {
  FluxWebSocket,
  WebSocketIntegration,
  UnifiedClient,
  WebSocketState,
  type WebSocketMessage,
  type WebSocketConfig,
  type WebSocketEventHandlers
} from './websocket';

// Circuit Breaker & Advanced Retry
export {
  CircuitBreaker,
  AdvancedRetryMechanism,
  CircuitState,
  type CircuitBreakerConfig,
  type CircuitBreakerStats,
  type AdvancedRetryConfig,
  type RetryAttempt
} from './circuit-breaker';

// Middleware System
export {
  MiddlewarePipeline,
  MiddlewareComposer,
  type Middleware,
  type RequestMiddleware,
  type ResponseMiddleware,
  type ErrorMiddleware,
  type MiddlewareContext,
  type MiddlewareConditions,
  type MiddlewarePipelineConfig,
  type MiddlewareExecutionResult,
  type MiddlewareExecutionStats,
  type MiddlewareMetrics
} from './middleware';

// Plugin Architecture
export {
  PluginRegistry,
  PluginBuilder,
  PluginState,
  type Plugin,
  type PluginFactory,
  type PluginMetadata,
  type PluginConfig,
  type PluginLifecycleHooks,
  type PluginCapabilities,
  type PluginRegistryEvents,
  type PluginRegistryConfig
} from './plugins';

// Advanced Caching
export {
  AdvancedHttpCache,
  MemoryCacheStorage,
  LocalStorageCacheStorage,
  CacheControlParser,
  InvalidationStrategy,
  createDefaultAdvancedCacheConfig,
  defaultCacheKeyGenerator,
  type CacheEntry,
  type CacheEntryMetadata,
  type CacheStorage,
  type AdvancedCacheConfig,
  type CacheStats
} from './cache-advanced';

// Metrics & Observability
export {
  MetricsCollector,
  DefaultHealthChecks,
  type RequestMetrics,
  type PerformanceMetrics,
  type TraceSpan,
  type HealthCheckResult,
  type SystemHealth,
  type MetricsConfig,
  type RequestTimings
} from './metrics';

/**
 * Enterprise features configuration
 */
export interface EnterpriseConfig {
  /** Streaming configuration */
  streaming?: {
    enabled: boolean;
    chunkSize?: number;
    backpressure?: boolean;
  };
  
  /** WebSocket configuration */
  websocket?: {
    enabled: boolean;
    connections?: Record<string, any>;
  };
  
  /** Circuit breaker configuration */
  circuitBreaker?: {
    enabled: boolean;
    defaultConfig?: Partial<import('./circuit-breaker').CircuitBreakerConfig>;
  };
  
  /** Middleware configuration */
  middleware?: {
    enabled: boolean;
    config?: Partial<import('./middleware').MiddlewarePipelineConfig>;
  };
  
  /** Plugin system configuration */
  plugins?: {
    enabled: boolean;
    autoStart?: boolean;
    maxPlugins?: number;
  };
  
  /** Advanced caching configuration */
  caching?: {
    enabled: boolean;
    storage?: 'memory' | 'localStorage';
    defaultTtl?: number;
  };
  
  /** Metrics and observability configuration */
  metrics?: {
    enabled: boolean;
    sampleRate?: number;
    collectTimings?: boolean;
  };
}

/**
 * Default enterprise configuration
 */
export const defaultEnterpriseConfig: EnterpriseConfig = {
  streaming: {
    enabled: true,
    chunkSize: 8192,
    backpressure: true
  },
  websocket: {
    enabled: false
  },
  circuitBreaker: {
    enabled: false
  },
  middleware: {
    enabled: true
  },
  plugins: {
    enabled: true,
    autoStart: true,
    maxPlugins: 50
  },
  caching: {
    enabled: true,
    storage: 'memory',
    defaultTtl: 300000 // 5 minutes
  },
  metrics: {
    enabled: true,
    sampleRate: 1.0,
    collectTimings: true
  }
};

/**
 * Enterprise features manager
 */
export class EnterpriseFeatures {
  private config: EnterpriseConfig;
  private features = new Map<string, any>();

  constructor(config: Partial<EnterpriseConfig> = {}) {
    this.config = { ...defaultEnterpriseConfig, ...config };
  }

  /**
   * Initialize all enabled features
   */
  async initialize(): Promise<void> {
    // Initialize streaming
    if (this.config.streaming?.enabled) {
      this.features.set('streaming', new StreamingFeature());
    }

    // Initialize WebSocket integration
    if (this.config.websocket?.enabled) {
      this.features.set('websocket', new WebSocketIntegration());
    }

    // Initialize circuit breaker
    if (this.config.circuitBreaker?.enabled) {
      this.features.set('circuitBreaker', new AdvancedRetryMechanism());
    }

    // Initialize middleware pipeline
    if (this.config.middleware?.enabled) {
      this.features.set('middleware', new MiddlewarePipeline(this.config.middleware.config));
    }

    // Initialize plugin registry
    if (this.config.plugins?.enabled) {
      this.features.set('plugins', new PluginRegistry({
        autoStart: this.config.plugins.autoStart,
        maxPlugins: this.config.plugins.maxPlugins
      }));
    }

    // Initialize advanced caching
    if (this.config.caching?.enabled) {
      const cacheConfig = createDefaultAdvancedCacheConfig();
      if (this.config.caching.storage === 'localStorage') {
        cacheConfig.storage = new LocalStorageCacheStorage();
      }
      if (this.config.caching.defaultTtl) {
        cacheConfig.defaultTtl = this.config.caching.defaultTtl;
      }
      this.features.set('cache', new AdvancedHttpCache(cacheConfig));
    }

    // Initialize metrics collector
    if (this.config.metrics?.enabled) {
      this.features.set('metrics', new MetricsCollector({
        enabled: true,
        sampleRate: this.config.metrics.sampleRate,
        collectTimings: this.config.metrics.collectTimings
      }));
    }
  }

  /**
   * Get a feature by name
   */
  getFeature<T = any>(name: string): T | undefined {
    return this.features.get(name);
  }

  /**
   * Check if a feature is enabled
   */
  isFeatureEnabled(name: string): boolean {
    return this.features.has(name);
  }

  /**
   * Get all enabled features
   */
  getEnabledFeatures(): string[] {
    return Array.from(this.features.keys());
  }

  /**
   * Dispose all features
   */
  async dispose(): Promise<void> {
    for (const [name, feature] of this.features) {
      if (typeof feature.dispose === 'function') {
        await feature.dispose();
      }
    }
    this.features.clear();
  }

  /**
   * Get feature statistics
   */
  getStats(): Record<string, any> {
    const stats: Record<string, any> = {};

    for (const [name, feature] of this.features) {
      if (typeof feature.getStats === 'function') {
        stats[name] = feature.getStats();
      }
    }

    return stats;
  }
}

export default EnterpriseFeatures;