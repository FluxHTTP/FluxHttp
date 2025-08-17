/**
 * @fileoverview Plugin architecture for FluxHTTP
 * @module @fluxhttp/core/features/plugins
 */

import type { fluxhttpInstance, fluxhttpRequestConfig } from '../types';
import type { MiddlewarePipeline } from './middleware';

/**
 * Plugin lifecycle states
 */
export enum PluginState {
  UNINITIALIZED = 'uninitialized',
  INITIALIZING = 'initializing',
  INITIALIZED = 'initialized',
  STARTING = 'starting',
  STARTED = 'started',
  STOPPING = 'stopping',
  STOPPED = 'stopped',
  ERROR = 'error'
}

/**
 * Plugin metadata
 */
export interface PluginMetadata {
  /** Plugin name */
  name: string;
  /** Plugin version */
  version: string;
  /** Plugin description */
  description?: string;
  /** Plugin author */
  author?: string;
  /** Plugin dependencies */
  dependencies?: string[];
  /** Plugin tags */
  tags?: string[];
  /** Plugin homepage URL */
  homepage?: string;
  /** Plugin license */
  license?: string;
}

/**
 * Plugin configuration interface
 */
export interface PluginConfig {
  /** Whether the plugin is enabled */
  enabled?: boolean;
  /** Plugin-specific configuration */
  settings?: Record<string, unknown>;
  /** Plugin priority (lower numbers load first) */
  priority?: number;
  /** Whether plugin should auto-start */
  autoStart?: boolean;
  /** Plugin environment requirements */
  environment?: {
    /** Minimum Node.js version */
    nodeVersion?: string;
    /** Required browser features */
    browserFeatures?: string[];
    /** Required environment variables */
    envVars?: string[];
  };
}

/**
 * Plugin lifecycle hooks
 */
export interface PluginLifecycleHooks {
  /** Called when plugin is being initialized */
  onInit?: (registry: PluginRegistry) => Promise<void> | void;
  /** Called when plugin is starting */
  onStart?: (registry: PluginRegistry) => Promise<void> | void;
  /** Called when plugin is stopping */
  onStop?: (registry: PluginRegistry) => Promise<void> | void;
  /** Called when plugin is being disposed */
  onDispose?: (registry: PluginRegistry) => Promise<void> | void;
  /** Called when configuration changes */
  onConfigChange?: (newConfig: PluginConfig, oldConfig: PluginConfig) => Promise<void> | void;
  /** Called on plugin errors */
  onError?: (error: Error) => Promise<void> | void;
}

/**
 * Plugin capabilities interface
 */
export interface PluginCapabilities {
  /** Request transformation */
  transformRequest?: (config: fluxhttpRequestConfig) => fluxhttpRequestConfig | Promise<fluxhttpRequestConfig>;
  /** Response transformation */
  transformResponse?: (response: any) => any | Promise<any>;
  /** Error handling */
  handleError?: (error: Error) => Error | Promise<Error>;
  /** Custom adapters */
  adapters?: Record<string, any>;
  /** Middleware providers */
  middleware?: {
    request?: any[];
    response?: any[];
    error?: any[];
  };
  /** Custom commands */
  commands?: Record<string, (...args: any[]) => any>;
  /** Event handlers */
  events?: Record<string, (...args: any[]) => void>;
}

/**
 * Base plugin interface
 */
export interface Plugin {
  /** Plugin metadata */
  metadata: PluginMetadata;
  /** Plugin configuration */
  config: PluginConfig;
  /** Plugin lifecycle hooks */
  hooks?: PluginLifecycleHooks;
  /** Plugin capabilities */
  capabilities?: PluginCapabilities;
  /** Current plugin state */
  state: PluginState;
  /** Plugin initialization function */
  init?(registry: PluginRegistry): Promise<void> | void;
  /** Plugin startup function */
  start?(registry: PluginRegistry): Promise<void> | void;
  /** Plugin shutdown function */
  stop?(registry: PluginRegistry): Promise<void> | void;
  /** Plugin disposal function */
  dispose?(): Promise<void> | void;
}

/**
 * Plugin factory function
 */
export type PluginFactory = (config?: PluginConfig) => Plugin | Promise<Plugin>;

/**
 * Plugin registry events
 */
export interface PluginRegistryEvents {
  /** Plugin was registered */
  'plugin:registered': (plugin: Plugin) => void;
  /** Plugin was unregistered */
  'plugin:unregistered': (pluginName: string) => void;
  /** Plugin state changed */
  'plugin:state-changed': (pluginName: string, oldState: PluginState, newState: PluginState) => void;
  /** Plugin error occurred */
  'plugin:error': (pluginName: string, error: Error) => void;
  /** Plugin configuration changed */
  'plugin:config-changed': (pluginName: string, newConfig: PluginConfig, oldConfig: PluginConfig) => void;
}

/**
 * Plugin registry configuration
 */
export interface PluginRegistryConfig {
  /** Maximum number of plugins */
  maxPlugins?: number;
  /** Plugin loading timeout */
  loadTimeout?: number;
  /** Whether to auto-start plugins */
  autoStart?: boolean;
  /** Whether to enable hot reloading */
  hotReload?: boolean;
  /** Plugin search paths */
  searchPaths?: string[];
  /** Whether to enable sandbox mode */
  sandbox?: boolean;
}

/**
 * Plugin dependency graph
 */
class PluginDependencyGraph {
  private graph = new Map<string, Set<string>>();
  private inDegree = new Map<string, number>();

  /**
   * Add plugin to dependency graph
   */
  addPlugin(name: string, dependencies: string[] = []): void {
    if (!this.graph.has(name)) {
      this.graph.set(name, new Set());
      this.inDegree.set(name, 0);
    }

    for (const dep of dependencies) {
      if (!this.graph.has(dep)) {
        this.graph.set(dep, new Set());
        this.inDegree.set(dep, 0);
      }
      
      this.graph.get(dep)!.add(name);
      this.inDegree.set(name, (this.inDegree.get(name) || 0) + 1);
    }
  }

  /**
   * Remove plugin from dependency graph
   */
  removePlugin(name: string): void {
    const dependents = this.graph.get(name) || new Set();
    
    for (const dependent of dependents) {
      const currentInDegree = this.inDegree.get(dependent) || 0;
      this.inDegree.set(dependent, Math.max(0, currentInDegree - 1));
    }

    this.graph.delete(name);
    this.inDegree.delete(name);

    // Remove references to this plugin from other plugins
    for (const [, deps] of this.graph) {
      deps.delete(name);
    }
  }

  /**
   * Get topological sort order for plugin loading
   */
  getLoadOrder(): string[] {
    const result: string[] = [];
    const queue: string[] = [];
    const inDegreeMap = new Map(this.inDegree);

    // Find all plugins with no dependencies
    for (const [name, degree] of inDegreeMap) {
      if (degree === 0) {
        queue.push(name);
      }
    }

    while (queue.length > 0) {
      const current = queue.shift()!;
      result.push(current);

      const dependents = this.graph.get(current) || new Set();
      for (const dependent of dependents) {
        const currentDegree = inDegreeMap.get(dependent) || 0;
        const newDegree = currentDegree - 1;
        inDegreeMap.set(dependent, newDegree);

        if (newDegree === 0) {
          queue.push(dependent);
        }
      }
    }

    // Check for circular dependencies
    if (result.length !== this.graph.size) {
      const remaining = Array.from(this.graph.keys()).filter(name => !result.includes(name));
      throw new Error(`Circular dependency detected in plugins: ${remaining.join(', ')}`);
    }

    return result;
  }

  /**
   * Check if plugin has circular dependencies
   */
  hasCircularDependency(name: string, visited = new Set<string>(), recStack = new Set<string>()): boolean {
    if (recStack.has(name)) {
      return true;
    }

    if (visited.has(name)) {
      return false;
    }

    visited.add(name);
    recStack.add(name);

    const dependents = this.graph.get(name) || new Set();
    for (const dependent of dependents) {
      if (this.hasCircularDependency(dependent, visited, recStack)) {
        return true;
      }
    }

    recStack.delete(name);
    return false;
  }
}

/**
 * Event emitter for plugin registry
 */
class PluginEventEmitter {
  private listeners = new Map<string, Function[]>();

  /**
   * Add event listener
   */
  on<K extends keyof PluginRegistryEvents>(event: K, listener: PluginRegistryEvents[K]): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(listener);
  }

  /**
   * Remove event listener
   */
  off<K extends keyof PluginRegistryEvents>(event: K, listener: PluginRegistryEvents[K]): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      const index = eventListeners.indexOf(listener);
      if (index > -1) {
        eventListeners.splice(index, 1);
      }
    }
  }

  /**
   * Emit event
   */
  emit<K extends keyof PluginRegistryEvents>(event: K, ...args: Parameters<PluginRegistryEvents[K]>): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      for (const listener of eventListeners) {
        try {
          listener(...args);
        } catch (error) {
          console.error(`Error in plugin event listener for '${event}':`, error);
        }
      }
    }
  }

  /**
   * Remove all listeners
   */
  removeAllListeners(): void {
    this.listeners.clear();
  }
}

/**
 * Plugin registry for managing plugins
 */
export class PluginRegistry {
  private plugins = new Map<string, Plugin>();
  private pluginFactories = new Map<string, PluginFactory>();
  private dependencyGraph = new PluginDependencyGraph();
  private eventEmitter = new PluginEventEmitter();
  private fluxhttpInstance?: fluxhttpInstance;
  private middlewarePipeline?: MiddlewarePipeline;

  constructor(private config: PluginRegistryConfig = {}) {
    this.config = {
      maxPlugins: 50,
      loadTimeout: 10000,
      autoStart: true,
      hotReload: false,
      searchPaths: [],
      sandbox: false,
      ...config
    };
  }

  /**
   * Set FluxHTTP instance for plugin integration
   */
  setFluxHttpInstance(instance: fluxhttpInstance): void {
    this.fluxhttpInstance = instance;
  }

  /**
   * Set middleware pipeline for plugin integration
   */
  setMiddlewarePipeline(pipeline: MiddlewarePipeline): void {
    this.middlewarePipeline = pipeline;
  }

  /**
   * Register a plugin factory
   */
  registerFactory(name: string, factory: PluginFactory): void {
    if (this.pluginFactories.has(name)) {
      throw new Error(`Plugin factory '${name}' is already registered`);
    }
    
    this.pluginFactories.set(name, factory);
  }

  /**
   * Unregister a plugin factory
   */
  unregisterFactory(name: string): boolean {
    return this.pluginFactories.delete(name);
  }

  /**
   * Register a plugin instance
   */
  async register(plugin: Plugin): Promise<void> {
    const { name } = plugin.metadata;

    if (this.plugins.has(name)) {
      throw new Error(`Plugin '${name}' is already registered`);
    }

    if (this.plugins.size >= (this.config.maxPlugins || 50)) {
      throw new Error(`Maximum plugin limit reached (${this.config.maxPlugins})`);
    }

    // Validate dependencies
    if (plugin.metadata.dependencies) {
      for (const dep of plugin.metadata.dependencies) {
        if (!this.plugins.has(dep)) {
          throw new Error(`Plugin dependency '${dep}' not found for plugin '${name}'`);
        }
      }
    }

    // Add to dependency graph
    this.dependencyGraph.addPlugin(name, plugin.metadata.dependencies || []);

    // Check for circular dependencies
    if (this.dependencyGraph.hasCircularDependency(name)) {
      this.dependencyGraph.removePlugin(name);
      throw new Error(`Circular dependency detected for plugin '${name}'`);
    }

    // Set initial state
    plugin.state = PluginState.UNINITIALIZED;
    this.plugins.set(name, plugin);

    this.eventEmitter.emit('plugin:registered', plugin);

    // Auto-initialize if enabled
    if (this.config.autoStart) {
      await this.initialize(name);
      await this.start(name);
    }
  }

  /**
   * Unregister a plugin
   */
  async unregister(name: string): Promise<boolean> {
    const plugin = this.plugins.get(name);
    if (!plugin) {
      return false;
    }

    // Stop plugin if running
    if (plugin.state === PluginState.STARTED) {
      await this.stop(name);
    }

    // Dispose plugin
    if (plugin.dispose) {
      await plugin.dispose();
    }

    // Remove from dependency graph
    this.dependencyGraph.removePlugin(name);

    // Remove from registry
    this.plugins.delete(name);

    this.eventEmitter.emit('plugin:unregistered', name);
    return true;
  }

  /**
   * Load plugin from factory
   */
  async load(name: string, config?: PluginConfig): Promise<void> {
    const factory = this.pluginFactories.get(name);
    if (!factory) {
      throw new Error(`Plugin factory '${name}' not found`);
    }

    const plugin = await this.executeWithTimeout(
      () => factory(config),
      this.config.loadTimeout || 10000,
      `Plugin '${name}' load timeout`
    );

    await this.register(plugin);
  }

  /**
   * Initialize a plugin
   */
  async initialize(name: string): Promise<void> {
    const plugin = this.plugins.get(name);
    if (!plugin) {
      throw new Error(`Plugin '${name}' not found`);
    }

    if (plugin.state !== PluginState.UNINITIALIZED) {
      return; // Already initialized
    }

    try {
      this.setState(plugin, PluginState.INITIALIZING);

      // Initialize dependencies first
      if (plugin.metadata.dependencies) {
        for (const dep of plugin.metadata.dependencies) {
          await this.initialize(dep);
        }
      }

      // Call init hook
      if (plugin.hooks?.onInit) {
        await plugin.hooks.onInit(this);
      }

      // Call plugin init method
      if (plugin.init) {
        await plugin.init(this);
      }

      this.setState(plugin, PluginState.INITIALIZED);

    } catch (error) {
      this.setState(plugin, PluginState.ERROR);
      this.eventEmitter.emit('plugin:error', name, error as Error);
      throw error;
    }
  }

  /**
   * Start a plugin
   */
  async start(name: string): Promise<void> {
    const plugin = this.plugins.get(name);
    if (!plugin) {
      throw new Error(`Plugin '${name}' not found`);
    }

    if (plugin.state === PluginState.STARTED) {
      return; // Already started
    }

    if (plugin.state !== PluginState.INITIALIZED) {
      await this.initialize(name);
    }

    try {
      this.setState(plugin, PluginState.STARTING);

      // Start dependencies first
      if (plugin.metadata.dependencies) {
        for (const dep of plugin.metadata.dependencies) {
          await this.start(dep);
        }
      }

      // Call start hook
      if (plugin.hooks?.onStart) {
        await plugin.hooks.onStart(this);
      }

      // Call plugin start method
      if (plugin.start) {
        await plugin.start(this);
      }

      // Integrate plugin capabilities
      this.integratePlugin(plugin);

      this.setState(plugin, PluginState.STARTED);

    } catch (error) {
      this.setState(plugin, PluginState.ERROR);
      this.eventEmitter.emit('plugin:error', name, error as Error);
      throw error;
    }
  }

  /**
   * Stop a plugin
   */
  async stop(name: string): Promise<void> {
    const plugin = this.plugins.get(name);
    if (!plugin) {
      throw new Error(`Plugin '${name}' not found`);
    }

    if (plugin.state !== PluginState.STARTED) {
      return; // Not started
    }

    try {
      this.setState(plugin, PluginState.STOPPING);

      // Call stop hook
      if (plugin.hooks?.onStop) {
        await plugin.hooks.onStop(this);
      }

      // Call plugin stop method
      if (plugin.stop) {
        await plugin.stop(this);
      }

      this.setState(plugin, PluginState.STOPPED);

    } catch (error) {
      this.setState(plugin, PluginState.ERROR);
      this.eventEmitter.emit('plugin:error', name, error as Error);
      throw error;
    }
  }

  /**
   * Integrate plugin capabilities with FluxHTTP
   */
  private integratePlugin(plugin: Plugin): void {
    const { capabilities } = plugin;
    if (!capabilities) return;

    // Integrate middleware
    if (capabilities.middleware && this.middlewarePipeline) {
      if (capabilities.middleware.request) {
        for (const middleware of capabilities.middleware.request) {
          this.middlewarePipeline.addRequestMiddleware(middleware);
        }
      }

      if (capabilities.middleware.response) {
        for (const middleware of capabilities.middleware.response) {
          this.middlewarePipeline.addResponseMiddleware(middleware);
        }
      }

      if (capabilities.middleware.error) {
        for (const middleware of capabilities.middleware.error) {
          this.middlewarePipeline.addErrorMiddleware(middleware);
        }
      }
    }

    // Add event handlers
    if (capabilities.events) {
      for (const [event, handler] of Object.entries(capabilities.events)) {
        this.eventEmitter.on(event as any, handler);
      }
    }
  }

  /**
   * Set plugin state and emit event
   */
  private setState(plugin: Plugin, newState: PluginState): void {
    const oldState = plugin.state;
    plugin.state = newState;
    
    if (oldState !== newState) {
      this.eventEmitter.emit('plugin:state-changed', plugin.metadata.name, oldState, newState);
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
   * Get plugin by name
   */
  getPlugin(name: string): Plugin | undefined {
    return this.plugins.get(name);
  }

  /**
   * Get all registered plugins
   */
  getAllPlugins(): Plugin[] {
    return Array.from(this.plugins.values());
  }

  /**
   * Get plugins by state
   */
  getPluginsByState(state: PluginState): Plugin[] {
    return Array.from(this.plugins.values()).filter(plugin => plugin.state === state);
  }

  /**
   * Start all plugins in dependency order
   */
  async startAll(): Promise<void> {
    const loadOrder = this.dependencyGraph.getLoadOrder();
    
    for (const name of loadOrder) {
      const plugin = this.plugins.get(name);
      if (plugin && plugin.config.enabled !== false) {
        await this.start(name);
      }
    }
  }

  /**
   * Stop all plugins
   */
  async stopAll(): Promise<void> {
    const plugins = Array.from(this.plugins.keys()).reverse(); // Stop in reverse order
    
    for (const name of plugins) {
      await this.stop(name);
    }
  }

  /**
   * Update plugin configuration
   */
  async updateConfig(name: string, newConfig: Partial<PluginConfig>): Promise<void> {
    const plugin = this.plugins.get(name);
    if (!plugin) {
      throw new Error(`Plugin '${name}' not found`);
    }

    const oldConfig = { ...plugin.config };
    plugin.config = { ...plugin.config, ...newConfig };

    // Call config change hook
    if (plugin.hooks?.onConfigChange) {
      await plugin.hooks.onConfigChange(plugin.config, oldConfig);
    }

    this.eventEmitter.emit('plugin:config-changed', name, plugin.config, oldConfig);
  }

  /**
   * Execute plugin command
   */
  async executeCommand(pluginName: string, command: string, ...args: any[]): Promise<any> {
    const plugin = this.plugins.get(pluginName);
    if (!plugin) {
      throw new Error(`Plugin '${pluginName}' not found`);
    }

    const commandFn = plugin.capabilities?.commands?.[command];
    if (!commandFn) {
      throw new Error(`Command '${command}' not found in plugin '${pluginName}'`);
    }

    return commandFn(...args);
  }

  /**
   * Get registry statistics
   */
  getStats(): {
    totalPlugins: number;
    pluginsByState: Record<PluginState, number>;
    loadOrder: string[];
  } {
    const pluginsByState: Record<PluginState, number> = {
      [PluginState.UNINITIALIZED]: 0,
      [PluginState.INITIALIZING]: 0,
      [PluginState.INITIALIZED]: 0,
      [PluginState.STARTING]: 0,
      [PluginState.STARTED]: 0,
      [PluginState.STOPPING]: 0,
      [PluginState.STOPPED]: 0,
      [PluginState.ERROR]: 0
    };

    for (const plugin of this.plugins.values()) {
      pluginsByState[plugin.state]++;
    }

    return {
      totalPlugins: this.plugins.size,
      pluginsByState,
      loadOrder: this.dependencyGraph.getLoadOrder()
    };
  }

  /**
   * Add event listener
   */
  on<K extends keyof PluginRegistryEvents>(event: K, listener: PluginRegistryEvents[K]): void {
    this.eventEmitter.on(event, listener);
  }

  /**
   * Remove event listener
   */
  off<K extends keyof PluginRegistryEvents>(event: K, listener: PluginRegistryEvents[K]): void {
    this.eventEmitter.off(event, listener);
  }

  /**
   * Dispose registry and all plugins
   */
  async dispose(): Promise<void> {
    await this.stopAll();
    
    for (const plugin of this.plugins.values()) {
      if (plugin.dispose) {
        await plugin.dispose();
      }
    }

    this.plugins.clear();
    this.pluginFactories.clear();
    this.eventEmitter.removeAllListeners();
  }
}

/**
 * Plugin builder utility for creating plugins
 */
export class PluginBuilder {
  private metadata: Partial<PluginMetadata> = {};
  private config: PluginConfig = {};
  private hooks: PluginLifecycleHooks = {};
  private capabilities: PluginCapabilities = {};

  /**
   * Set plugin metadata
   */
  setMetadata(metadata: PluginMetadata): this {
    this.metadata = metadata;
    return this;
  }

  /**
   * Set plugin configuration
   */
  setConfig(config: PluginConfig): this {
    this.config = config;
    return this;
  }

  /**
   * Add lifecycle hook
   */
  addHook<K extends keyof PluginLifecycleHooks>(
    hook: K,
    handler: NonNullable<PluginLifecycleHooks[K]>
  ): this {
    this.hooks[hook] = handler;
    return this;
  }

  /**
   * Add capability
   */
  addCapability<K extends keyof PluginCapabilities>(
    capability: K,
    implementation: PluginCapabilities[K]
  ): this {
    this.capabilities[capability] = implementation;
    return this;
  }

  /**
   * Build the plugin
   */
  build(): Plugin {
    if (!this.metadata.name) {
      throw new Error('Plugin name is required');
    }

    if (!this.metadata.version) {
      throw new Error('Plugin version is required');
    }

    return {
      metadata: this.metadata as PluginMetadata,
      config: this.config,
      hooks: this.hooks,
      capabilities: this.capabilities,
      state: PluginState.UNINITIALIZED
    };
  }
}

export default PluginRegistry;