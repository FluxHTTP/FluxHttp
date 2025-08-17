/**
 * @module @fluxhttp/core/enterprise
 * @description Enterprise features for FluxHTTP - advanced functionality for production applications
 *
 * @example
 * ```typescript
 * import fluxhttp from '@fluxhttp/core';
 * import { 
 *   EnterpriseFeatures, 
 *   MetricsCollector, 
 *   AdvancedHttpCache,
 *   PluginRegistry 
 * } from '@fluxhttp/core/enterprise';
 *
 * // Initialize enterprise features
 * const enterprise = new EnterpriseFeatures({
 *   metrics: { enabled: true, sampleRate: 1.0 },
 *   caching: { enabled: true, storage: 'memory' },
 *   plugins: { enabled: true, autoStart: true }
 * });
 *
 * await enterprise.initialize();
 *
 * // Use with FluxHTTP instance
 * const client = fluxhttp.create({
 *   baseURL: 'https://api.example.com',
 *   timeout: 10000
 * });
 *
 * // Access enterprise features
 * const metrics = enterprise.getFeature<MetricsCollector>('metrics');
 * const cache = enterprise.getFeature<AdvancedHttpCache>('cache');
 * ```
 */

// Re-export all enterprise features
export * from './features';

// Main enterprise features manager
export { EnterpriseFeatures as default } from './features';

/**
 * Enterprise feature integrations with FluxHTTP core
 */
export interface FluxHttpEnterpriseOptions {
  /** Enable automatic metrics collection */
  metrics?: boolean | import('./features/metrics').MetricsConfig;
  /** Enable advanced caching */
  caching?: boolean | import('./features/cache-advanced').AdvancedCacheConfig;
  /** Enable circuit breaker */
  circuitBreaker?: boolean | import('./features/circuit-breaker').CircuitBreakerConfig;
  /** Enable request/response middleware */
  middleware?: boolean | import('./features/middleware').MiddlewarePipelineConfig;
  /** Enable plugin system */
  plugins?: boolean | import('./features/plugins').PluginRegistryConfig;
  /** Enable streaming support */
  streaming?: boolean | import('./features/streaming').StreamConfig;
  /** Enable WebSocket integration */
  websocket?: boolean | Record<string, import('./features/websocket').WebSocketConfig>;
}

/**
 * Enhanced FluxHTTP instance with enterprise features
 */
export interface FluxHttpEnterprise extends import('./types').fluxhttpInstance {
  /** Enterprise features manager */
  enterprise: import('./features').EnterpriseFeatures;
  /** Metrics collector */
  metrics?: import('./features/metrics').MetricsCollector;
  /** Advanced cache */
  cache?: import('./features/cache-advanced').AdvancedHttpCache;
  /** Plugin registry */
  plugins?: import('./features/plugins').PluginRegistry;
  /** Middleware pipeline */
  middleware?: import('./features/middleware').MiddlewarePipeline;
  /** Circuit breaker mechanism */
  circuitBreaker?: import('./features/circuit-breaker').AdvancedRetryMechanism;
  /** WebSocket integration */
  websocket?: import('./features/websocket').WebSocketIntegration;
}

/**
 * Create enhanced FluxHTTP instance with enterprise features
 */
export async function createEnterpriseInstance(
  config: import('./types').fluxhttpRequestConfig & { enterprise?: FluxHttpEnterpriseOptions } = {}
): Promise<FluxHttpEnterprise> {
  const { createfluxhttpInstance, defaults } = await import('./core');
  const { EnterpriseFeatures } = await import('./features');
  
  // Extract enterprise config
  const { enterprise: enterpriseConfig, ...coreConfig } = config;
  
  // Create core instance
  const instance = createfluxhttpInstance({ ...defaults, ...coreConfig }) as FluxHttpEnterprise;
  
  // Initialize enterprise features
  const enterpriseFeatures = new EnterpriseFeatures();
  await enterpriseFeatures.initialize();
  
  // Attach enterprise features to instance
  instance.enterprise = enterpriseFeatures;
  
  // Attach individual features for convenience
  if (enterpriseFeatures.isFeatureEnabled('metrics')) {
    instance.metrics = enterpriseFeatures.getFeature('metrics');
  }
  
  if (enterpriseFeatures.isFeatureEnabled('cache')) {
    instance.cache = enterpriseFeatures.getFeature('cache');
  }
  
  if (enterpriseFeatures.isFeatureEnabled('plugins')) {
    instance.plugins = enterpriseFeatures.getFeature('plugins');
  }
  
  if (enterpriseFeatures.isFeatureEnabled('middleware')) {
    instance.middleware = enterpriseFeatures.getFeature('middleware');
  }
  
  if (enterpriseFeatures.isFeatureEnabled('circuitBreaker')) {
    instance.circuitBreaker = enterpriseFeatures.getFeature('circuitBreaker');
  }
  
  if (enterpriseFeatures.isFeatureEnabled('websocket')) {
    instance.websocket = enterpriseFeatures.getFeature('websocket');
  }
  
  return instance;
}

/**
 * Enterprise feature presets for common use cases
 */
export const EnterprisePresets = {
  /**
   * Development preset - all features enabled with verbose logging
   */
  development: {
    metrics: { enabled: true, sampleRate: 1.0, collectTimings: true },
    caching: { enabled: true, storage: 'memory' as const, defaultTtl: 60000 },
    middleware: { enabled: true, enableProfiling: true },
    plugins: { enabled: true, autoStart: true },
    circuitBreaker: { enabled: false },
    streaming: { enabled: true },
    websocket: { enabled: false }
  },

  /**
   * Production preset - optimized for performance and reliability
   */
  production: {
    metrics: { enabled: true, sampleRate: 0.1, collectTimings: false },
    caching: { enabled: true, storage: 'memory' as const, defaultTtl: 300000 },
    middleware: { enabled: true, enableProfiling: false },
    plugins: { enabled: true, autoStart: true },
    circuitBreaker: { enabled: true },
    streaming: { enabled: true },
    websocket: { enabled: false }
  },

  /**
   * High-performance preset - minimal overhead
   */
  performance: {
    metrics: { enabled: true, sampleRate: 0.01, collectTimings: false },
    caching: { enabled: true, storage: 'memory' as const, defaultTtl: 600000 },
    middleware: { enabled: false },
    plugins: { enabled: false },
    circuitBreaker: { enabled: true },
    streaming: { enabled: true },
    websocket: { enabled: false }
  },

  /**
   * Observability preset - maximum monitoring and tracing
   */
  observability: {
    metrics: { enabled: true, sampleRate: 1.0, collectTimings: true },
    caching: { enabled: true, storage: 'memory' as const, defaultTtl: 300000 },
    middleware: { enabled: true, enableProfiling: true },
    plugins: { enabled: true, autoStart: true },
    circuitBreaker: { enabled: true },
    streaming: { enabled: true },
    websocket: { enabled: false }
  }
};

/**
 * Quick setup functions for common scenarios
 */
export class QuickSetup {
  /**
   * Setup FluxHTTP for microservices
   */
  static async microservices(baseURL: string, options: Partial<FluxHttpEnterpriseOptions> = {}): Promise<FluxHttpEnterprise> {
    return createEnterpriseInstance({
      baseURL,
      timeout: 30000,
      enterprise: {
        ...EnterprisePresets.production,
        ...options,
        circuitBreaker: { enabled: true },
        metrics: { enabled: true, sampleRate: 0.1 }
      }
    });
  }

  /**
   * Setup FluxHTTP for API gateway
   */
  static async apiGateway(options: Partial<FluxHttpEnterpriseOptions> = {}): Promise<FluxHttpEnterprise> {
    return createEnterpriseInstance({
      timeout: 60000,
      enterprise: {
        ...EnterprisePresets.observability,
        ...options,
        middleware: { enabled: true, enableProfiling: true },
        plugins: { enabled: true, autoStart: true }
      }
    });
  }

  /**
   * Setup FluxHTTP for real-time applications
   */
  static async realTime(options: Partial<FluxHttpEnterpriseOptions> = {}): Promise<FluxHttpEnterprise> {
    return createEnterpriseInstance({
      timeout: 10000,
      enterprise: {
        ...EnterprisePresets.development,
        ...options,
        websocket: { enabled: true },
        streaming: { enabled: true }
      }
    });
  }

  /**
   * Setup FluxHTTP for high-load applications
   */
  static async highLoad(options: Partial<FluxHttpEnterpriseOptions> = {}): Promise<FluxHttpEnterprise> {
    return createEnterpriseInstance({
      timeout: 15000,
      enterprise: {
        ...EnterprisePresets.performance,
        ...options,
        caching: { enabled: true, storage: 'memory', defaultTtl: 900000 }, // 15 minutes
        circuitBreaker: { enabled: true }
      }
    });
  }
}

/**
 * Enterprise utilities and helpers
 */
export namespace EnterpriseUtils {
  /**
   * Create a health check endpoint handler
   */
  export function createHealthCheckHandler(enterprise: import('./features').EnterpriseFeatures) {
    return async (req: any, res: any) => {
      try {
        const metrics = enterprise.getFeature<import('./features/metrics').MetricsCollector>('metrics');
        if (!metrics) {
          return res.status(503).json({ status: 'unhealthy', error: 'Metrics not available' });
        }

        const health = await metrics.performHealthChecks();
        const statusCode = health.status === 'healthy' ? 200 : 
                          health.status === 'degraded' ? 200 : 503;
        
        res.status(statusCode).json(health);
      } catch (error) {
        res.status(503).json({ 
          status: 'unhealthy', 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
      }
    };
  }

  /**
   * Create a metrics endpoint handler
   */
  export function createMetricsHandler(enterprise: import('./features').EnterpriseFeatures, format: 'json' | 'prometheus' = 'json') {
    return async (req: any, res: any) => {
      try {
        const metrics = enterprise.getFeature<import('./features/metrics').MetricsCollector>('metrics');
        if (!metrics) {
          return res.status(404).json({ error: 'Metrics not available' });
        }

        const data = metrics.exportMetrics(format);
        const contentType = format === 'prometheus' ? 'text/plain' : 'application/json';
        
        res.setHeader('Content-Type', contentType);
        res.send(data);
      } catch (error) {
        res.status(500).json({ 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
      }
    };
  }

  /**
   * Create performance monitoring middleware
   */
  export function createPerformanceMiddleware(enterprise: import('./features').EnterpriseFeatures) {
    const metrics = enterprise.getFeature<import('./features/metrics').MetricsCollector>('metrics');
    
    return {
      name: 'enterprise-performance',
      execute: async (context: import('./features/middleware').MiddlewareContext) => {
        if (metrics) {
          const requestId = metrics.startRequest(context.config);
          context.metadata.set('requestId', requestId);
        }
        return context;
      }
    };
  }
}

/**
 * Version information for enterprise features
 */
export const ENTERPRISE_VERSION = '1.0.0';
export const ENTERPRISE_FEATURES = [
  'streaming',
  'websocket',
  'circuit-breaker',
  'middleware',
  'plugins',
  'cache-advanced',
  'metrics'
] as const;

export type EnterpriseFeatureName = typeof ENTERPRISE_FEATURES[number];