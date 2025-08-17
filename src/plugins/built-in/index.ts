/**
 * @fileoverview Built-in plugins exports
 * @module @fluxhttp/plugins/built-in
 */

// Authentication plugin
export { AuthPlugin, createAuthPlugin } from './auth.plugin';
export type { AuthPluginConfig, AuthType } from './auth.plugin';

// Cache plugin
export { CachePlugin, createCachePlugin } from './cache.plugin';
export type { 
  CachePluginConfig, 
  CacheStrategy, 
  CacheStorage,
  CacheStorageInterface 
} from './cache.plugin';

// Retry plugin
export { RetryPlugin, createRetryPlugin } from './retry.plugin';
export type { 
  RetryPluginConfig, 
  BackoffStrategy, 
  RetryCondition, 
  DelayCalculator 
} from './retry.plugin';

// Logging plugin
export { LoggingPlugin, createLoggingPlugin } from './logging.plugin';
export type { LoggingPluginConfig, LogLevel, LogFormat } from './logging.plugin';

// Metrics plugin
export { MetricsPlugin, createMetricsPlugin } from './metrics.plugin';
export type { MetricsPluginConfig, MetricsBackend } from './metrics.plugin';

// Mock plugin
export { MockPlugin, createMockPlugin } from './mock.plugin';
export type { MockPluginConfig, MockRule, MockResponse } from './mock.plugin';

// Debug plugin
export { DebugPlugin, createDebugPlugin } from './debug.plugin';
export type { DebugPluginConfig, DebugLevel } from './debug.plugin';

/**
 * Built-in plugin registry
 */
export const BUILTIN_PLUGINS = {
  auth: createAuthPlugin,
  cache: createCachePlugin,
  retry: createRetryPlugin,
  logging: createLoggingPlugin,
  metrics: createMetricsPlugin,
  mock: createMockPlugin,
  debug: createDebugPlugin
} as const;

/**
 * Create all built-in plugins with default configuration
 */
export function createBuiltinPlugins() {
  return {
    auth: createAuthPlugin(),
    cache: createCachePlugin(),
    retry: createRetryPlugin(),
    logging: createLoggingPlugin(),
    metrics: createMetricsPlugin(),
    mock: createMockPlugin(),
    debug: createDebugPlugin()
  };
}

/**
 * Plugin factory type
 */
export type PluginFactory = (...args: any[]) => any;

/**
 * Built-in plugin names
 */
export type BuiltinPluginName = keyof typeof BUILTIN_PLUGINS;