/**
 * @fileoverview Core plugin registry implementation for FluxHTTP
 * @module @fluxhttp/plugins/core/registry
 */

import type { fluxhttpInstance } from '../../types';
import type {
  Plugin,
  PluginConfig,
  PluginLifecycleState,
  PluginType,
  PluginPriority,
  PluginRegistry as IPluginRegistry,
  PluginRegistryStats,
  PluginHealthStatus,
  PluginContext,
  PluginError,
  PluginErrorType,
  PluginDependency
} from '../types';
import { PluginLifecycleState as State } from '../types';
import { PluginLogger } from './logger';
import { PluginMetrics } from './metrics';
import { PluginCache } from './cache';
import { PluginEventEmitter } from './events';
import { PluginUtils } from './utils';
import { PluginDependencyGraph } from './dependency-graph';
import { PluginValidator } from './validator';

/**
 * Plugin registry configuration
 */
export interface PluginRegistryConfig {
  /** Maximum number of plugins allowed */
  maxPlugins?: number;
  /** Plugin loading timeout in milliseconds */
  loadTimeout?: number;
  /** Plugin startup timeout in milliseconds */
  startupTimeout?: number;
  /** Whether to auto-start plugins after registration */
  autoStart?: boolean;
  /** Whether to enable hot reloading */
  hotReload?: boolean;
  /** Whether to enable plugin sandboxing */
  sandbox?: boolean;
  /** Plugin search paths */
  searchPaths?: string[];
  /** Plugin cache configuration */
  cache?: {
    enabled: boolean;
    ttl?: number;
    maxSize?: number;
  };
  /** Plugin logging configuration */
  logging?: {
    enabled: boolean;
    level?: 'error' | 'warn' | 'info' | 'debug' | 'trace';
    namespace?: string;
  };
  /** Plugin metrics configuration */
  metrics?: {
    enabled: boolean;
    namespace?: string;
  };
  /** Plugin validation configuration */
  validation?: {
    strict: boolean;
    allowUnsigned?: boolean;
    checkDependencies?: boolean;
  };
}

/**
 * Core plugin registry implementation
 */
export class PluginRegistry implements IPluginRegistry {
  private readonly plugins = new Map<string, Plugin>();
  private readonly pluginContexts = new Map<string, PluginContext>();
  private readonly dependencyGraph = new PluginDependencyGraph();
  private readonly logger: PluginLogger;
  private readonly metrics: PluginMetrics;
  private readonly cache: PluginCache;
  private readonly events: PluginEventEmitter;
  private readonly utils: PluginUtils;
  private readonly validator: PluginValidator;
  private fluxhttpInstance?: fluxhttpInstance;
  private disposed = false;

  constructor(private readonly config: PluginRegistryConfig = {}) {
    // Apply default configuration
    this.config = {
      maxPlugins: 100,
      loadTimeout: 30000,
      startupTimeout: 10000,
      autoStart: true,
      hotReload: false,
      sandbox: false,
      searchPaths: [],
      cache: { enabled: true, ttl: 3600000, maxSize: 100 },
      logging: { enabled: true, level: 'info', namespace: 'fluxhttp:plugins' },
      metrics: { enabled: true, namespace: 'fluxhttp.plugins' },
      validation: { strict: true, allowUnsigned: false, checkDependencies: true },
      ...config
    };

    // Initialize components
    this.logger = new PluginLogger(this.config.logging);
    this.metrics = new PluginMetrics(this.config.metrics);
    this.cache = new PluginCache(this.config.cache);
    this.events = new PluginEventEmitter();
    this.utils = new PluginUtils();
    this.validator = new PluginValidator(this.config.validation);

    this.logger.info('Plugin registry initialized', { config: this.config });
  }

  /**
   * Set the FluxHTTP instance
   */
  setFluxHttpInstance(instance: fluxhttpInstance): void {
    this.fluxhttpInstance = instance;
    this.logger.debug('FluxHTTP instance set');
  }

  /**
   * Register a plugin
   */
  async register(plugin: Plugin): Promise<void> {
    if (this.disposed) {
      throw this.createError(
        PluginErrorType.RUNTIME_ERROR,
        plugin.metadata.id,
        'REGISTRY_DISPOSED',
        'Cannot register plugin on disposed registry'
      );
    }

    const { id, name } = plugin.metadata;
    this.logger.info('Registering plugin', { id, name });

    try {
      // Validate plugin
      await this.validator.validatePlugin(plugin);

      // Check if already registered
      if (this.plugins.has(id)) {
        throw this.createError(
          PluginErrorType.CONFIGURATION_ERROR,
          id,
          'PLUGIN_ALREADY_REGISTERED',
          `Plugin '${id}' is already registered`
        );
      }

      // Check registry limits
      if (this.plugins.size >= (this.config.maxPlugins || 100)) {
        throw this.createError(
          PluginErrorType.RUNTIME_ERROR,
          id,
          'REGISTRY_FULL',
          `Plugin registry is full (max: ${this.config.maxPlugins})`
        );
      }

      // Validate dependencies
      await this.validateDependencies(plugin);

      // Add to dependency graph
      this.dependencyGraph.addPlugin(
        id,
        plugin.metadata.dependencies?.map(dep => dep.id) || []
      );

      // Check for circular dependencies
      if (this.dependencyGraph.hasCircularDependency(id)) {
        this.dependencyGraph.removePlugin(id);
        throw this.createError(
          PluginErrorType.DEPENDENCY_ERROR,
          id,
          'CIRCULAR_DEPENDENCY',
          `Circular dependency detected for plugin '${id}'`
        );
      }

      // Set initial state
      plugin.state = State.UNINITIALIZED;

      // Create plugin context
      const context = this.createPluginContext(plugin);
      plugin.context = context;
      this.pluginContexts.set(id, context);

      // Register plugin
      this.plugins.set(id, plugin);

      // Emit registration event
      this.events.emit('plugin:registered', { plugin });
      this.metrics.increment('plugins.registered');

      this.logger.info('Plugin registered successfully', { id, name });

      // Auto-start if enabled
      if (this.config.autoStart && plugin.config.enabled) {
        await this.start(id);
      }

    } catch (error) {
      this.logger.error('Failed to register plugin', { id, name, error });
      this.metrics.increment('plugins.registration.failed');
      throw error;
    }
  }

  /**
   * Unregister a plugin
   */
  async unregister(id: string): Promise<boolean> {
    const plugin = this.plugins.get(id);
    if (!plugin) {
      return false;
    }

    this.logger.info('Unregistering plugin', { id, name: plugin.metadata.name });

    try {
      // Stop plugin if started
      if (plugin.state === State.STARTED) {
        await this.stop(id);
      }

      // Destroy plugin if needed
      if (plugin.state !== State.DESTROYED) {
        await this.destroy(id);
      }

      // Remove from dependency graph
      this.dependencyGraph.removePlugin(id);

      // Remove from registry
      this.plugins.delete(id);
      this.pluginContexts.delete(id);

      // Emit unregistration event
      this.events.emit('plugin:unregistered', { id });
      this.metrics.increment('plugins.unregistered');

      this.logger.info('Plugin unregistered successfully', { id });
      return true;

    } catch (error) {
      this.logger.error('Failed to unregister plugin', { id, error });
      this.metrics.increment('plugins.unregistration.failed');
      throw error;
    }
  }

  /**
   * Get plugin by ID
   */
  get(id: string): Plugin | undefined {
    return this.plugins.get(id);
  }

  /**
   * Get all plugins
   */
  getAll(): Plugin[] {
    return Array.from(this.plugins.values());
  }

  /**
   * Get plugins by type
   */
  getByType(type: PluginType): Plugin[] {
    return Array.from(this.plugins.values()).filter(
      plugin => plugin.metadata.type === type
    );
  }

  /**
   * Get plugins by state
   */
  getByState(state: PluginLifecycleState): Plugin[] {
    return Array.from(this.plugins.values()).filter(
      plugin => plugin.state === state
    );
  }

  /**
   * Check if plugin exists
   */
  has(id: string): boolean {
    return this.plugins.has(id);
  }

  /**
   * Start a plugin
   */
  async start(id: string): Promise<void> {
    const plugin = this.plugins.get(id);
    if (!plugin) {
      throw this.createError(
        PluginErrorType.RUNTIME_ERROR,
        id,
        'PLUGIN_NOT_FOUND',
        `Plugin '${id}' not found`
      );
    }

    if (plugin.state === State.STARTED) {
      return; // Already started
    }

    if (!plugin.config.enabled) {
      throw this.createError(
        PluginErrorType.CONFIGURATION_ERROR,
        id,
        'PLUGIN_DISABLED',
        `Plugin '${id}' is disabled`
      );
    }

    this.logger.info('Starting plugin', { id, name: plugin.metadata.name });

    try {
      // Initialize if needed
      if (plugin.state === State.UNINITIALIZED) {
        await this.initialize(id);
      }

      // Start dependencies first
      await this.startDependencies(plugin);

      // Set starting state
      await this.setState(plugin, State.STARTING);

      // Call before start hook
      if (plugin.hooks?.beforeStart) {
        await this.executeWithTimeout(
          () => plugin.hooks!.beforeStart!(plugin.context!),
          this.config.startupTimeout || 10000,
          'beforeStart hook timeout'
        );
      }

      // Call plugin start method
      if (plugin.start) {
        await this.executeWithTimeout(
          () => plugin.start!(plugin.context!),
          this.config.startupTimeout || 10000,
          'Plugin start timeout'
        );
      }

      // Set started state
      await this.setState(plugin, State.STARTED);

      // Call after start hook
      if (plugin.hooks?.afterStart) {
        await plugin.hooks.afterStart(plugin.context!);
      }

      // Emit start event
      this.events.emit('plugin:started', { plugin });
      this.metrics.increment('plugins.started');

      this.logger.info('Plugin started successfully', { id });

    } catch (error) {
      await this.setState(plugin, State.ERROR);
      this.logger.error('Failed to start plugin', { id, error });
      this.metrics.increment('plugins.start.failed');
      throw error;
    }
  }

  /**
   * Stop a plugin
   */
  async stop(id: string): Promise<void> {
    const plugin = this.plugins.get(id);
    if (!plugin) {
      throw this.createError(
        PluginErrorType.RUNTIME_ERROR,
        id,
        'PLUGIN_NOT_FOUND',
        `Plugin '${id}' not found`
      );
    }

    if (plugin.state !== State.STARTED) {
      return; // Not started
    }

    this.logger.info('Stopping plugin', { id, name: plugin.metadata.name });

    try {
      // Set stopping state
      await this.setState(plugin, State.STOPPING);

      // Call before stop hook
      if (plugin.hooks?.beforeStop) {
        await plugin.hooks.beforeStop(plugin.context!);
      }

      // Call plugin stop method
      if (plugin.stop) {
        await this.executeWithTimeout(
          () => plugin.stop!(plugin.context!),
          this.config.startupTimeout || 10000,
          'Plugin stop timeout'
        );
      }

      // Set stopped state
      await this.setState(plugin, State.STOPPED);

      // Call after stop hook
      if (plugin.hooks?.afterStop) {
        await plugin.hooks.afterStop(plugin.context!);
      }

      // Emit stop event
      this.events.emit('plugin:stopped', { plugin });
      this.metrics.increment('plugins.stopped');

      this.logger.info('Plugin stopped successfully', { id });

    } catch (error) {
      await this.setState(plugin, State.ERROR);
      this.logger.error('Failed to stop plugin', { id, error });
      this.metrics.increment('plugins.stop.failed');
      throw error;
    }
  }

  /**
   * Restart a plugin
   */
  async restart(id: string): Promise<void> {
    await this.stop(id);
    await this.start(id);
  }

  /**
   * Enable a plugin
   */
  async enable(id: string): Promise<void> {
    const plugin = this.plugins.get(id);
    if (!plugin) {
      throw this.createError(
        PluginErrorType.RUNTIME_ERROR,
        id,
        'PLUGIN_NOT_FOUND',
        `Plugin '${id}' not found`
      );
    }

    if (plugin.config.enabled) {
      return; // Already enabled
    }

    plugin.config.enabled = true;
    
    // Emit config change event
    this.events.emit('plugin:config-changed', { 
      plugin, 
      newConfig: plugin.config,
      oldConfig: { ...plugin.config, enabled: false }
    });

    // Auto-start if configured
    if (this.config.autoStart && plugin.state !== State.STARTED) {
      await this.start(id);
    }

    this.logger.info('Plugin enabled', { id });
  }

  /**
   * Disable a plugin
   */
  async disable(id: string): Promise<void> {
    const plugin = this.plugins.get(id);
    if (!plugin) {
      throw this.createError(
        PluginErrorType.RUNTIME_ERROR,
        id,
        'PLUGIN_NOT_FOUND',
        `Plugin '${id}' not found`
      );
    }

    if (!plugin.config.enabled) {
      return; // Already disabled
    }

    // Stop if started
    if (plugin.state === State.STARTED) {
      await this.stop(id);
    }

    plugin.config.enabled = false;
    
    // Emit config change event
    this.events.emit('plugin:config-changed', { 
      plugin, 
      newConfig: plugin.config,
      oldConfig: { ...plugin.config, enabled: true }
    });

    this.logger.info('Plugin disabled', { id });
  }

  /**
   * Update plugin configuration
   */
  async updateConfig(id: string, config: Partial<PluginConfig>): Promise<void> {
    const plugin = this.plugins.get(id);
    if (!plugin) {
      throw this.createError(
        PluginErrorType.RUNTIME_ERROR,
        id,
        'PLUGIN_NOT_FOUND',
        `Plugin '${id}' not found`
      );
    }

    const oldConfig = { ...plugin.config };
    const newConfig = { ...plugin.config, ...config };

    // Validate new configuration
    if (plugin.validateConfig) {
      const isValid = await plugin.validateConfig(newConfig);
      if (!isValid) {
        throw this.createError(
          PluginErrorType.VALIDATION_ERROR,
          id,
          'INVALID_CONFIG',
          'Plugin configuration validation failed'
        );
      }
    }

    plugin.config = newConfig;

    // Call config change hook
    if (plugin.hooks?.onConfigChange) {
      await plugin.hooks.onConfigChange(plugin.context!, { newConfig, oldConfig });
    }

    // Update plugin if applicable
    if (plugin.updateConfig) {
      await plugin.updateConfig(config);
    }

    // Emit config change event
    this.events.emit('plugin:config-changed', { plugin, newConfig, oldConfig });

    this.logger.info('Plugin configuration updated', { id, config });
  }

  /**
   * Get plugin health
   */
  async getHealth(id: string): Promise<PluginHealthStatus> {
    const plugin = this.plugins.get(id);
    if (!plugin) {
      throw this.createError(
        PluginErrorType.RUNTIME_ERROR,
        id,
        'PLUGIN_NOT_FOUND',
        `Plugin '${id}' not found`
      );
    }

    if (plugin.getHealth) {
      return await plugin.getHealth();
    }

    // Default health check based on state
    const status = plugin.state === State.STARTED ? 'healthy' : 
                  plugin.state === State.ERROR ? 'unhealthy' : 'degraded';

    return {
      status,
      timestamp: Date.now(),
      details: {
        state: plugin.state,
        enabled: plugin.config.enabled
      }
    };
  }

  /**
   * Get registry statistics
   */
  getStats(): PluginRegistryStats {
    const plugins = Array.from(this.plugins.values());
    
    // Count by state
    const byState = {} as Record<PluginLifecycleState, number>;
    Object.values(State).forEach(state => {
      byState[state] = 0;
    });
    plugins.forEach(plugin => {
      byState[plugin.state]++;
    });

    // Count by type
    const byType = {} as Record<PluginType, number>;
    plugins.forEach(plugin => {
      byType[plugin.metadata.type] = (byType[plugin.metadata.type] || 0) + 1;
    });

    // Count by priority
    const byPriority = {} as Record<PluginPriority, number>;
    plugins.forEach(plugin => {
      byPriority[plugin.metadata.priority] = (byPriority[plugin.metadata.priority] || 0) + 1;
    });

    // Get load order
    const loadOrder = this.dependencyGraph.getLoadOrder();

    // Get dependencies
    const dependencies = {} as Record<string, string[]>;
    plugins.forEach(plugin => {
      dependencies[plugin.metadata.id] = plugin.metadata.dependencies?.map(dep => dep.id) || [];
    });

    // Health statistics
    const health = { healthy: 0, degraded: 0, unhealthy: 0 };
    plugins.forEach(plugin => {
      if (plugin.state === State.STARTED) {
        health.healthy++;
      } else if (plugin.state === State.ERROR) {
        health.unhealthy++;
      } else {
        health.degraded++;
      }
    });

    return {
      total: plugins.length,
      byState,
      byType,
      byPriority,
      loadOrder,
      dependencies,
      health
    };
  }

  /**
   * Dispose registry
   */
  async dispose(): Promise<void> {
    if (this.disposed) {
      return;
    }

    this.logger.info('Disposing plugin registry');

    try {
      // Stop all plugins
      const startedPlugins = this.getByState(State.STARTED);
      await Promise.all(startedPlugins.map(plugin => this.stop(plugin.metadata.id)));

      // Destroy all plugins
      const plugins = Array.from(this.plugins.values());
      await Promise.all(plugins.map(plugin => this.destroy(plugin.metadata.id)));

      // Dispose components
      await this.cache.dispose();
      this.events.removeAllListeners();
      this.metrics.dispose();

      // Clear collections
      this.plugins.clear();
      this.pluginContexts.clear();

      this.disposed = true;
      this.logger.info('Plugin registry disposed');

    } catch (error) {
      this.logger.error('Error disposing plugin registry', { error });
      throw error;
    }
  }

  // Private methods

  /**
   * Initialize a plugin
   */
  private async initialize(id: string): Promise<void> {
    const plugin = this.plugins.get(id)!;
    
    if (plugin.state !== State.UNINITIALIZED) {
      return;
    }

    await this.setState(plugin, State.INITIALIZING);

    try {
      // Initialize dependencies first
      await this.initializeDependencies(plugin);

      // Call before init hook
      if (plugin.hooks?.beforeInit) {
        await plugin.hooks.beforeInit(plugin.context!);
      }

      // Call plugin init method
      if (plugin.init) {
        await this.executeWithTimeout(
          () => plugin.init!(plugin.context!),
          this.config.loadTimeout || 30000,
          'Plugin initialization timeout'
        );
      }

      // Set initialized state
      await this.setState(plugin, State.INITIALIZED);

      // Call after init hook
      if (plugin.hooks?.afterInit) {
        await plugin.hooks.afterInit(plugin.context!);
      }

      this.metrics.increment('plugins.initialized');

    } catch (error) {
      await this.setState(plugin, State.ERROR);
      throw error;
    }
  }

  /**
   * Destroy a plugin
   */
  private async destroy(id: string): Promise<void> {
    const plugin = this.plugins.get(id)!;
    
    if (plugin.state === State.DESTROYED) {
      return;
    }

    try {
      // Call before destroy hook
      if (plugin.hooks?.beforeDestroy) {
        await plugin.hooks.beforeDestroy(plugin.context!);
      }

      // Call plugin destroy method
      if (plugin.destroy) {
        await plugin.destroy(plugin.context!);
      }

      // Set destroyed state
      await this.setState(plugin, State.DESTROYED);

      // Call after destroy hook
      if (plugin.hooks?.afterDestroy) {
        await plugin.hooks.afterDestroy(plugin.context!);
      }

      this.metrics.increment('plugins.destroyed');

    } catch (error) {
      await this.setState(plugin, State.ERROR);
      throw error;
    }
  }

  /**
   * Create plugin context
   */
  private createPluginContext(plugin: Plugin): PluginContext {
    return {
      plugin,
      fluxhttp: this.fluxhttpInstance!,
      registry: this,
      logger: this.logger.child({ pluginId: plugin.metadata.id }),
      metrics: this.metrics.child(plugin.metadata.id),
      cache: this.cache.child(plugin.metadata.id),
      events: this.events.child(plugin.metadata.id),
      utils: this.utils
    };
  }

  /**
   * Set plugin state
   */
  private async setState(plugin: Plugin, newState: PluginLifecycleState): Promise<void> {
    const oldState = plugin.state;
    plugin.state = newState;

    if (oldState !== newState) {
      this.events.emit('plugin:state-changed', { 
        plugin, 
        oldState, 
        newState 
      });

      this.metrics.increment('plugins.state.transitions', 1, {
        from: oldState,
        to: newState,
        plugin: plugin.metadata.id
      });
    }
  }

  /**
   * Validate plugin dependencies
   */
  private async validateDependencies(plugin: Plugin): Promise<void> {
    if (!plugin.metadata.dependencies) {
      return;
    }

    for (const dependency of plugin.metadata.dependencies) {
      await this.validateDependency(plugin.metadata.id, dependency);
    }
  }

  /**
   * Validate single dependency
   */
  private async validateDependency(pluginId: string, dependency: PluginDependency): Promise<void> {
    const dependencyPlugin = this.plugins.get(dependency.id);
    
    if (!dependencyPlugin && !dependency.optional) {
      throw this.createError(
        PluginErrorType.DEPENDENCY_ERROR,
        pluginId,
        'MISSING_DEPENDENCY',
        `Required dependency '${dependency.id}' not found`
      );
    }

    if (dependencyPlugin) {
      // Check version compatibility
      const isCompatible = this.utils.satisfiesVersion(
        dependencyPlugin.metadata.version,
        dependency.version
      );

      if (!isCompatible) {
        throw this.createError(
          PluginErrorType.DEPENDENCY_ERROR,
          pluginId,
          'INCOMPATIBLE_DEPENDENCY',
          `Dependency '${dependency.id}' version ${dependencyPlugin.metadata.version} does not satisfy ${dependency.version}`
        );
      }
    }
  }

  /**
   * Initialize plugin dependencies
   */
  private async initializeDependencies(plugin: Plugin): Promise<void> {
    if (!plugin.metadata.dependencies) {
      return;
    }

    for (const dependency of plugin.metadata.dependencies) {
      if (!dependency.optional) {
        await this.initialize(dependency.id);
      }
    }
  }

  /**
   * Start plugin dependencies
   */
  private async startDependencies(plugin: Plugin): Promise<void> {
    if (!plugin.metadata.dependencies) {
      return;
    }

    for (const dependency of plugin.metadata.dependencies) {
      if (!dependency.optional) {
        await this.start(dependency.id);
      }
    }
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
   * Create plugin error
   */
  private createError(
    type: PluginErrorType,
    pluginId: string,
    code: string,
    message: string,
    cause?: Error
  ): PluginError {
    const error = new Error(message) as PluginError;
    error.type = type;
    error.pluginId = pluginId;
    error.code = code;
    error.cause = cause;
    error.timestamp = Date.now();
    return error;
  }
}