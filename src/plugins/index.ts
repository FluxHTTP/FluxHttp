/**
 * @fileoverview FluxHTTP Plugin System - Main Entry Point
 * @module @fluxhttp/plugins
 * @version 1.0.0
 * 
 * This module provides the complete plugin system for FluxHTTP, including:
 * - Core plugin architecture and registry
 * - Built-in plugin library
 * - Plugin Development Kit (PDK)
 * - Plugin ecosystem features
 * 
 * @example
 * ```typescript
 * import { PluginRegistry, createAuthPlugin, PDK } from '@fluxhttp/plugins';
 * 
 * // Create and register plugins
 * const registry = new PluginRegistry();
 * const authPlugin = createAuthPlugin({ type: 'bearer', token: 'abc123' });
 * await registry.register(authPlugin);
 * 
 * // Use PDK to create custom plugins
 * const customPlugin = PDK.createPlugin()
 *   .withId('my-plugin')
 *   .withName('My Custom Plugin')
 *   .withRequestInterceptor((config) => {
 *     config.headers['X-Custom'] = 'value';
 *     return config;
 *   })
 *   .build();
 * ```
 */

// Core Plugin System
export { PluginRegistry } from './core/registry';
export { PluginLogger } from './core/logger';
export { PluginMetrics } from './core/metrics';
export { PluginCache } from './core/cache';
export { PluginEventEmitter } from './core/events';
export { PluginUtils } from './core/utils';
export { DependencyGraph } from './core/dependency-graph';
export { PluginValidator } from './core/validator';

// Plugin Types and Interfaces
export type * from './types';
export {
  PluginLifecycleState,
  PluginType,
  PluginPriority,
  PluginHealthStatus,
  PluginStorageBackend,
  PluginLogLevel,
  PluginMetricType,
  PluginCacheStrategy,
  PluginAuthType,
  PluginRetryBackoff
} from './types';

// Built-in Plugins
export {
  AuthPlugin,
  createAuthPlugin,
  type AuthPluginConfig
} from './built-in/auth.plugin';

export {
  CachePlugin,
  createCachePlugin,
  type CachePluginConfig
} from './built-in/cache.plugin';

export {
  RetryPlugin,
  createRetryPlugin,
  type RetryPluginConfig
} from './built-in/retry.plugin';

export {
  LoggingPlugin,
  createLoggingPlugin,
  type LoggingPluginConfig
} from './built-in/logging.plugin';

export {
  MetricsPlugin,
  createMetricsPlugin,
  type MetricsPluginConfig
} from './built-in/metrics.plugin';

export {
  MockPlugin,
  createMockPlugin,
  type MockPluginConfig
} from './built-in/mock.plugin';

export {
  DebugPlugin,
  createDebugPlugin,
  type DebugPluginConfig
} from './built-in/debug.plugin';

// Plugin Development Kit (PDK)
export {
  PluginBuilder,
  PluginTemplate,
  PluginValidator as PDKValidator,
  PluginTester,
  PluginGenerator,
  PluginHelper,
  PDK,
  PluginUtils as PDKUtils,
  BestPractices,
  Examples,
  QuickStart,
  Documentation
} from './pdk';

// Plugin Ecosystem
export {
  PluginDiscovery,
  NpmPluginSource,
  GitHubPluginSource,
  defaultDiscovery,
  PluginMarketplace,
  defaultMarketplace,
  PluginVersionManager,
  defaultVersionManager,
  type SemanticVersion,
  PluginEcosystem,
  searchPlugins,
  getPlugin,
  installPlugin,
  checkUpdates,
  getFeaturedPlugins,
  getPluginCollections,
  getRecommendations,
  initializeEcosystem
} from './ecosystem';

/**
 * Plugin System namespace containing all core functionality
 */
export namespace FluxHttpPlugins {
  /**
   * Core plugin registry instance
   */
  export const registry = new PluginRegistry();

  /**
   * Plugin creation utilities
   */
  export const create = {
    /**
     * Create authentication plugin
     */
    auth: createAuthPlugin,
    
    /**
     * Create caching plugin
     */
    cache: createCachePlugin,
    
    /**
     * Create retry plugin
     */
    retry: createRetryPlugin,
    
    /**
     * Create logging plugin
     */
    logging: createLoggingPlugin,
    
    /**
     * Create metrics plugin
     */
    metrics: createMetricsPlugin,
    
    /**
     * Create mock plugin
     */
    mock: createMockPlugin,
    
    /**
     * Create debug plugin
     */
    debug: createDebugPlugin,
    
    /**
     * Create custom plugin using builder
     */
    custom: () => new PluginBuilder()
  };

  /**
   * Plugin validation utilities
   */
  export const validate = {
    /**
     * Validate plugin implementation
     */
    plugin: (plugin: any) => new PluginValidator().validate(plugin),
    
    /**
     * Validate plugin configuration
     */
    config: (plugin: any, config: any) => new PluginValidator().validateConfig(plugin, config),
    
    /**
     * Validate plugin metadata
     */
    metadata: (metadata: any) => new PluginValidator().validateMetadata(metadata)
  };

  /**
   * Plugin testing utilities
   */
  export const test = {
    /**
     * Create plugin tester
     */
    create: (plugin: any) => new PluginTester(plugin),
    
    /**
     * Run standard plugin tests
     */
    standard: (plugin: any) => new PluginTester(plugin).runStandardTests(),
    
    /**
     * Create mock context for testing
     */
    mockContext: () => new PluginHelper().createMockRequest()
  };

  /**
   * Plugin generation utilities
   */
  export const generate = {
    /**
     * Generate plugin from template
     */
    fromTemplate: (template: string, variables: Record<string, unknown>) => 
      new PluginGenerator().fromTemplate(template, variables),
    
    /**
     * Preview plugin generation
     */
    preview: (template: string, variables: Record<string, unknown>) => 
      new PluginGenerator().preview(template, variables),
    
    /**
     * Get available templates
     */
    templates: () => new PluginGenerator().getAvailableTemplates()
  };

  /**
   * Plugin discovery and ecosystem features
   */
  export const ecosystem = {
    /**
     * Search for plugins in registry
     */
    search: (query: string) => registry.search(query),
    
    /**
     * Get plugin statistics
     */
    stats: () => registry.getStats(),
    
    /**
     * Get plugin health status
     */
    health: () => registry.getHealth(),
    
    /**
     * List all registered plugins
     */
    list: () => registry.list()
  };

  /**
   * Plugin system configuration
   */
  export const config = {
    /**
     * Configure plugin system defaults
     */
    defaults: {
      logLevel: 'info' as const,
      enableMetrics: true,
      enableCaching: true,
      maxPlugins: 100,
      timeouts: {
        init: 5000,
        start: 3000,
        stop: 3000,
        destroy: 2000
      }
    },
    
    /**
     * Security settings
     */
    security: {
      allowDynamicLoading: false,
      validateChecksums: true,
      sandboxMode: false,
      trustedSources: ['@fluxhttp/*']
    }
  };
}

/**
 * Quick access to common plugin system operations
 */
export const Plugins = FluxHttpPlugins;

/**
 * Create a new plugin registry instance
 */
export function createPluginRegistry(): PluginRegistry {
  return new PluginRegistry();
}

/**
 * Create a plugin system with default built-in plugins
 */
export async function createDefaultPluginSystem(): Promise<{
  registry: PluginRegistry;
  plugins: {
    auth: AuthPlugin;
    cache: CachePlugin;
    retry: RetryPlugin;
    logging: LoggingPlugin;
    metrics: MetricsPlugin;
    debug: DebugPlugin;
  };
}> {
  const registry = new PluginRegistry();
  
  // Create built-in plugins with default configurations
  const plugins = {
    auth: createAuthPlugin(),
    cache: createCachePlugin(),
    retry: createRetryPlugin(),
    logging: createLoggingPlugin(),
    metrics: createMetricsPlugin(),
    debug: createDebugPlugin()
  };

  // Register all plugins
  for (const [name, plugin] of Object.entries(plugins)) {
    try {
      await registry.register(plugin);
    } catch (error) {
      console.warn(`Failed to register ${name} plugin:`, error);
    }
  }

  return { registry, plugins };
}

/**
 * Plugin system version information
 */
export const VERSION = {
  major: 1,
  minor: 0,
  patch: 0,
  prerelease: null,
  build: null,
  full: '1.0.0'
} as const;

/**
 * Plugin system metadata
 */
export const METADATA = {
  name: 'FluxHTTP Plugin System',
  description: 'Comprehensive plugin architecture for FluxHTTP',
  version: VERSION.full,
  author: 'FluxHTTP Team',
  license: 'MIT',
  homepage: 'https://github.com/fluxhttp/fluxhttp',
  repository: 'https://github.com/fluxhttp/fluxhttp',
  bugs: 'https://github.com/fluxhttp/fluxhttp/issues',
  keywords: [
    'fluxhttp',
    'plugins',
    'http',
    'client',
    'interceptors',
    'middleware',
    'extensions'
  ]
} as const;

/**
 * Default export - Plugin Development Kit
 */
export default PDK;

/**
 * Plugin system feature flags
 */
export const FEATURES = {
  PLUGIN_REGISTRY: true,
  BUILT_IN_PLUGINS: true,
  PLUGIN_DEVELOPMENT_KIT: true,
  PLUGIN_TEMPLATES: true,
  PLUGIN_VALIDATION: true,
  PLUGIN_TESTING: true,
  PLUGIN_METRICS: true,
  PLUGIN_CACHING: true,
  PLUGIN_EVENTS: true,
  PLUGIN_DEPENDENCIES: true,
  PLUGIN_LIFECYCLE: true,
  PLUGIN_DISCOVERY: true,
  PLUGIN_MARKETPLACE: false, // Future feature
  PLUGIN_VERSIONING: true,
  PLUGIN_SECURITY: true
} as const;

/**
 * Plugin system compatibility information
 */
export const COMPATIBILITY = {
  fluxhttp: {
    min: '1.0.0',
    max: '2.0.0'
  },
  node: {
    min: '16.0.0'
  },
  typescript: {
    min: '4.5.0'
  }
} as const;

/**
 * Plugin system performance metrics
 */
export const PERFORMANCE = {
  maxInitTime: 5000,      // Maximum plugin initialization time (ms)
  maxStartTime: 3000,     // Maximum plugin start time (ms)
  maxStopTime: 3000,      // Maximum plugin stop time (ms)
  maxMemoryUsage: 50,     // Maximum memory usage per plugin (MB)
  maxRegistrySize: 100,   // Maximum number of plugins in registry
  maxDependencyDepth: 10  // Maximum dependency chain depth
} as const;

/**
 * Plugin system error codes
 */
export const ERROR_CODES = {
  PLUGIN_NOT_FOUND: 'PLUGIN_NOT_FOUND',
  PLUGIN_ALREADY_REGISTERED: 'PLUGIN_ALREADY_REGISTERED',
  PLUGIN_VALIDATION_FAILED: 'PLUGIN_VALIDATION_FAILED',
  PLUGIN_INIT_FAILED: 'PLUGIN_INIT_FAILED',
  PLUGIN_START_FAILED: 'PLUGIN_START_FAILED',
  PLUGIN_STOP_FAILED: 'PLUGIN_STOP_FAILED',
  PLUGIN_DESTROY_FAILED: 'PLUGIN_DESTROY_FAILED',
  PLUGIN_DEPENDENCY_NOT_FOUND: 'PLUGIN_DEPENDENCY_NOT_FOUND',
  PLUGIN_CIRCULAR_DEPENDENCY: 'PLUGIN_CIRCULAR_DEPENDENCY',
  PLUGIN_VERSION_MISMATCH: 'PLUGIN_VERSION_MISMATCH',
  PLUGIN_CONFIG_INVALID: 'PLUGIN_CONFIG_INVALID',
  PLUGIN_TIMEOUT: 'PLUGIN_TIMEOUT',
  PLUGIN_MEMORY_LIMIT: 'PLUGIN_MEMORY_LIMIT',
  PLUGIN_SECURITY_VIOLATION: 'PLUGIN_SECURITY_VIOLATION'
} as const;

/**
 * Plugin system events
 */
export const EVENTS = {
  PLUGIN_REGISTERED: 'plugin:registered',
  PLUGIN_UNREGISTERED: 'plugin:unregistered',
  PLUGIN_INITIALIZED: 'plugin:initialized',
  PLUGIN_STARTED: 'plugin:started',
  PLUGIN_STOPPED: 'plugin:stopped',
  PLUGIN_DESTROYED: 'plugin:destroyed',
  PLUGIN_ERROR: 'plugin:error',
  PLUGIN_CONFIG_UPDATED: 'plugin:config:updated',
  REGISTRY_READY: 'registry:ready',
  REGISTRY_SHUTDOWN: 'registry:shutdown'
} as const;

/**
 * Plugin system status
 */
export const STATUS = {
  INITIALIZING: 'initializing',
  READY: 'ready',
  ERROR: 'error',
  SHUTTING_DOWN: 'shutting_down',
  SHUTDOWN: 'shutdown'
} as const;