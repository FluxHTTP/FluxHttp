/**
 * @fileoverview Core types and interfaces for the FluxHTTP plugin system
 * @module @fluxhttp/plugins/types
 */

import type { 
  fluxhttpInstance, 
  fluxhttpRequestConfig, 
  fluxhttpResponse, 
  fluxhttpError 
} from '../../types';

// Re-export core types for plugin development
export type {
  fluxhttpInstance,
  fluxhttpRequestConfig,
  fluxhttpResponse,
  fluxhttpError,
  Headers,
  HttpMethod,
  RequestBody
} from '../../types';

/**
 * Plugin lifecycle states
 */
export enum PluginLifecycleState {
  UNINITIALIZED = 'uninitialized',
  INITIALIZING = 'initializing',
  INITIALIZED = 'initialized',
  STARTING = 'starting',
  STARTED = 'started',
  STOPPING = 'stopping',
  STOPPED = 'stopped',
  DESTROYED = 'destroyed',
  ERROR = 'error'
}

/**
 * Plugin types categorization
 */
export enum PluginType {
  /** Plugins that modify requests before sending */
  REQUEST = 'request',
  /** Plugins that process responses after receiving */
  RESPONSE = 'response',
  /** Plugins that provide custom transport mechanisms */
  TRANSPORT = 'transport',
  /** Plugins that add new features and capabilities */
  FEATURE = 'feature',
  /** Plugins that provide development tools */
  DEVELOPER = 'developer',
  /** Plugins that handle authentication */
  AUTH = 'auth',
  /** Plugins that manage caching */
  CACHE = 'cache',
  /** Plugins that provide monitoring and metrics */
  MONITORING = 'monitoring'
}

/**
 * Plugin execution priority levels
 */
export enum PluginPriority {
  /** Highest priority - security and validation plugins */
  CRITICAL = 0,
  /** High priority - auth and core functionality */
  HIGH = 100,
  /** Normal priority - most standard plugins */
  NORMAL = 500,
  /** Low priority - optimization and enhancement plugins */
  LOW = 800,
  /** Lowest priority - logging and debugging plugins */
  DEBUG = 1000
}

/**
 * Plugin capability flags
 */
export interface PluginCapabilityFlags {
  /** Can modify request configuration */
  canModifyRequest?: boolean;
  /** Can modify response data */
  canModifyResponse?: boolean;
  /** Can handle errors */
  canHandleErrors?: boolean;
  /** Can provide custom adapters */
  canProvideAdapters?: boolean;
  /** Can cache responses */
  canCache?: boolean;
  /** Can retry requests */
  canRetry?: boolean;
  /** Can authenticate requests */
  canAuthenticate?: boolean;
  /** Can validate requests/responses */
  canValidate?: boolean;
  /** Can mock requests */
  canMock?: boolean;
  /** Can monitor performance */
  canMonitor?: boolean;
}

/**
 * Plugin metadata describing the plugin
 */
export interface PluginMetadata {
  /** Unique plugin identifier */
  id: string;
  /** Human-readable plugin name */
  name: string;
  /** Plugin version following semver */
  version: string;
  /** Plugin type classification */
  type: PluginType;
  /** Brief description of plugin functionality */
  description: string;
  /** Plugin author information */
  author: {
    name: string;
    email?: string;
    url?: string;
  };
  /** Plugin license identifier */
  license: string;
  /** Plugin homepage or repository URL */
  homepage?: string;
  /** Plugin repository information */
  repository?: {
    type: string;
    url: string;
  };
  /** Plugin keywords for discovery */
  keywords: string[];
  /** Plugin capabilities flags */
  capabilities: PluginCapabilityFlags;
  /** Plugin execution priority */
  priority: PluginPriority;
  /** Plugin dependencies */
  dependencies?: PluginDependency[];
  /** Peer dependencies */
  peerDependencies?: PluginDependency[];
  /** Minimum FluxHTTP version required */
  minFluxHttpVersion?: string;
  /** Maximum FluxHTTP version supported */
  maxFluxHttpVersion?: string;
  /** Supported environments */
  environments?: PluginEnvironment[];
  /** Plugin changelog */
  changelog?: PluginChangelogEntry[];
  /** Plugin deprecation information */
  deprecated?: {
    version: string;
    reason: string;
    replacement?: string;
  };
}

/**
 * Plugin dependency specification
 */
export interface PluginDependency {
  /** Dependency plugin ID */
  id: string;
  /** Version range specification */
  version: string;
  /** Whether this dependency is optional */
  optional?: boolean;
  /** Reason for this dependency */
  reason?: string;
}

/**
 * Plugin environment specification
 */
export interface PluginEnvironment {
  /** Environment type */
  type: 'browser' | 'node' | 'worker' | 'react-native';
  /** Minimum version requirement */
  minVersion?: string;
  /** Required features */
  features?: string[];
  /** Environment-specific configuration */
  config?: Record<string, unknown>;
}

/**
 * Plugin changelog entry
 */
export interface PluginChangelogEntry {
  /** Version number */
  version: string;
  /** Release date */
  date: string;
  /** Change type */
  type: 'added' | 'changed' | 'deprecated' | 'removed' | 'fixed' | 'security';
  /** Change description */
  description: string;
  /** Breaking change flag */
  breaking?: boolean;
}

/**
 * Plugin configuration schema
 */
export interface PluginConfigSchema {
  /** Schema type */
  type: 'object';
  /** Schema properties */
  properties: Record<string, PluginConfigProperty>;
  /** Required properties */
  required?: string[];
  /** Additional properties allowed */
  additionalProperties?: boolean;
  /** Schema description */
  description?: string;
  /** Schema examples */
  examples?: unknown[];
}

/**
 * Plugin configuration property definition
 */
export interface PluginConfigProperty {
  /** Property type */
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  /** Property description */
  description?: string;
  /** Default value */
  default?: unknown;
  /** Possible values for enum types */
  enum?: unknown[];
  /** Property validation pattern */
  pattern?: string;
  /** Minimum value for numbers */
  minimum?: number;
  /** Maximum value for numbers */
  maximum?: number;
  /** Array item type */
  items?: PluginConfigProperty;
  /** Object properties */
  properties?: Record<string, PluginConfigProperty>;
  /** Examples */
  examples?: unknown[];
}

/**
 * Plugin runtime configuration
 */
export interface PluginConfig {
  /** Whether the plugin is enabled */
  enabled: boolean;
  /** Plugin-specific settings */
  settings: Record<string, unknown>;
  /** Plugin execution priority override */
  priority?: PluginPriority;
  /** Environment-specific configuration */
  environment?: Record<string, unknown>;
  /** Plugin feature flags */
  features?: Record<string, boolean>;
  /** Performance configuration */
  performance?: {
    timeout?: number;
    retries?: number;
    concurrency?: number;
  };
  /** Debug configuration */
  debug?: {
    enabled?: boolean;
    level?: 'error' | 'warn' | 'info' | 'debug' | 'trace';
    namespace?: string;
  };
}

/**
 * Plugin lifecycle hooks
 */
export interface PluginLifecycleHooks {
  /** Called before plugin initialization */
  beforeInit?: PluginHook<void>;
  /** Called after plugin initialization */
  afterInit?: PluginHook<void>;
  /** Called before plugin starts */
  beforeStart?: PluginHook<void>;
  /** Called after plugin starts */
  afterStart?: PluginHook<void>;
  /** Called before plugin stops */
  beforeStop?: PluginHook<void>;
  /** Called after plugin stops */
  afterStop?: PluginHook<void>;
  /** Called before plugin destruction */
  beforeDestroy?: PluginHook<void>;
  /** Called after plugin destruction */
  afterDestroy?: PluginHook<void>;
  /** Called when plugin configuration changes */
  onConfigChange?: PluginHook<{ newConfig: PluginConfig; oldConfig: PluginConfig }>;
  /** Called when plugin encounters an error */
  onError?: PluginHook<{ error: Error; context: unknown }>;
  /** Called before each request */
  beforeRequest?: PluginHook<{ config: fluxhttpRequestConfig }>;
  /** Called after each response */
  afterResponse?: PluginHook<{ response: fluxhttpResponse; config: fluxhttpRequestConfig }>;
  /** Called when request fails */
  onRequestError?: PluginHook<{ error: fluxhttpError; config: fluxhttpRequestConfig }>;
}

/**
 * Plugin hook function type
 */
export type PluginHook<T = unknown> = (
  context: PluginContext,
  data?: T
) => Promise<void> | void;

/**
 * Plugin context interface
 */
export interface PluginContext {
  /** Plugin instance */
  plugin: Plugin;
  /** FluxHTTP instance */
  fluxhttp: fluxhttpInstance;
  /** Plugin registry */
  registry: PluginRegistry;
  /** Plugin logger */
  logger: PluginLogger;
  /** Plugin metrics */
  metrics: PluginMetrics;
  /** Plugin cache */
  cache: PluginCache;
  /** Plugin events */
  events: PluginEventEmitter;
  /** Plugin utilities */
  utils: PluginUtils;
}

/**
 * Plugin request interceptor function
 */
export type PluginRequestInterceptor = (
  config: fluxhttpRequestConfig,
  context: PluginContext
) => Promise<fluxhttpRequestConfig> | fluxhttpRequestConfig;

/**
 * Plugin response interceptor function
 */
export type PluginResponseInterceptor = (
  response: fluxhttpResponse,
  context: PluginContext
) => Promise<fluxhttpResponse> | fluxhttpResponse;

/**
 * Plugin error interceptor function
 */
export type PluginErrorInterceptor = (
  error: fluxhttpError,
  context: PluginContext
) => Promise<fluxhttpError | fluxhttpResponse> | fluxhttpError | fluxhttpResponse;

/**
 * Plugin adapter function
 */
export type PluginAdapter = (
  config: fluxhttpRequestConfig,
  context: PluginContext
) => Promise<fluxhttpResponse>;

/**
 * Plugin transformation function
 */
export type PluginTransformFunction<T, U> = (
  input: T,
  context: PluginContext
) => Promise<U> | U;

/**
 * Plugin validation function
 */
export type PluginValidationFunction<T> = (
  input: T,
  context: PluginContext
) => Promise<boolean> | boolean;

/**
 * Plugin command handler
 */
export type PluginCommandHandler = (
  args: unknown[],
  context: PluginContext
) => Promise<unknown> | unknown;

/**
 * Plugin event handler
 */
export type PluginEventHandler<T = unknown> = (
  data: T,
  context: PluginContext
) => Promise<void> | void;

/**
 * Plugin middleware function
 */
export type PluginMiddleware<T, U> = (
  input: T,
  next: (input: T) => Promise<U> | U,
  context: PluginContext
) => Promise<U> | U;

/**
 * Plugin logger interface
 */
export interface PluginLogger {
  trace(message: string, ...args: unknown[]): void;
  debug(message: string, ...args: unknown[]): void;
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
  fatal(message: string, ...args: unknown[]): void;
  child(bindings: Record<string, unknown>): PluginLogger;
}

/**
 * Plugin metrics interface
 */
export interface PluginMetrics {
  /** Increment a counter */
  increment(name: string, value?: number, tags?: Record<string, string>): void;
  /** Decrement a counter */
  decrement(name: string, value?: number, tags?: Record<string, string>): void;
  /** Record a gauge value */
  gauge(name: string, value: number, tags?: Record<string, string>): void;
  /** Record a histogram value */
  histogram(name: string, value: number, tags?: Record<string, string>): void;
  /** Record a timing value */
  timing(name: string, value: number, tags?: Record<string, string>): void;
  /** Start a timer */
  timer(name: string, tags?: Record<string, string>): PluginTimer;
  /** Get metric statistics */
  getStats(): Record<string, unknown>;
}

/**
 * Plugin timer interface
 */
export interface PluginTimer {
  /** Stop the timer and record the value */
  stop(): void;
  /** Get elapsed time without stopping */
  elapsed(): number;
}

/**
 * Plugin cache interface
 */
export interface PluginCache {
  /** Get a value from cache */
  get<T = unknown>(key: string): Promise<T | undefined>;
  /** Set a value in cache */
  set<T = unknown>(key: string, value: T, ttl?: number): Promise<void>;
  /** Delete a value from cache */
  delete(key: string): Promise<boolean>;
  /** Check if key exists in cache */
  has(key: string): Promise<boolean>;
  /** Clear all cache entries */
  clear(): Promise<void>;
  /** Get cache statistics */
  getStats(): Promise<Record<string, unknown>>;
}

/**
 * Plugin event emitter interface
 */
export interface PluginEventEmitter {
  /** Emit an event */
  emit<T = unknown>(event: string, data?: T): void;
  /** Listen to an event */
  on<T = unknown>(event: string, handler: PluginEventHandler<T>): void;
  /** Listen to an event once */
  once<T = unknown>(event: string, handler: PluginEventHandler<T>): void;
  /** Remove event listener */
  off<T = unknown>(event: string, handler: PluginEventHandler<T>): void;
  /** Remove all listeners for an event */
  removeAllListeners(event?: string): void;
  /** Get event listener count */
  listenerCount(event: string): number;
  /** Get event names */
  eventNames(): string[];
}

/**
 * Plugin utilities interface
 */
export interface PluginUtils {
  /** Generate unique ID */
  generateId(): string;
  /** Deep clone object */
  deepClone<T>(obj: T): T;
  /** Deep merge objects */
  deepMerge<T>(target: T, ...sources: Partial<T>[]): T;
  /** Check if object is plain object */
  isPlainObject(obj: unknown): obj is Record<string, unknown>;
  /** Throttle function execution */
  throttle<T extends (...args: any[]) => any>(fn: T, wait: number): T;
  /** Debounce function execution */
  debounce<T extends (...args: any[]) => any>(fn: T, wait: number): T;
  /** Validate JSON schema */
  validateSchema(data: unknown, schema: PluginConfigSchema): boolean;
  /** Parse semver version */
  parseVersion(version: string): { major: number; minor: number; patch: number };
  /** Compare semver versions */
  compareVersions(a: string, b: string): -1 | 0 | 1;
  /** Check if version satisfies range */
  satisfiesVersion(version: string, range: string): boolean;
}

/**
 * Core plugin interface
 */
export interface Plugin {
  /** Plugin metadata */
  readonly metadata: PluginMetadata;
  /** Plugin configuration schema */
  readonly configSchema?: PluginConfigSchema;
  /** Current plugin configuration */
  config: PluginConfig;
  /** Current plugin state */
  state: PluginLifecycleState;
  /** Plugin lifecycle hooks */
  hooks?: PluginLifecycleHooks;
  /** Plugin context */
  context?: PluginContext;

  // Lifecycle methods
  /** Initialize the plugin */
  init?(context: PluginContext): Promise<void> | void;
  /** Start the plugin */
  start?(context: PluginContext): Promise<void> | void;
  /** Stop the plugin */
  stop?(context: PluginContext): Promise<void> | void;
  /** Destroy the plugin */
  destroy?(context: PluginContext): Promise<void> | void;

  // Interceptor methods
  /** Request interceptor */
  interceptRequest?(interceptor: PluginRequestInterceptor): void;
  /** Response interceptor */
  interceptResponse?(interceptor: PluginResponseInterceptor): void;
  /** Error interceptor */
  interceptError?(interceptor: PluginErrorInterceptor): void;

  // Feature methods
  /** Register custom adapter */
  registerAdapter?(name: string, adapter: PluginAdapter): void;
  /** Register transformation function */
  registerTransform?<T, U>(name: string, transform: PluginTransformFunction<T, U>): void;
  /** Register validation function */
  registerValidator?<T>(name: string, validator: PluginValidationFunction<T>): void;
  /** Register command handler */
  registerCommand?(name: string, handler: PluginCommandHandler): void;
  /** Register middleware */
  registerMiddleware?<T, U>(name: string, middleware: PluginMiddleware<T, U>): void;

  // Event methods
  /** Handle plugin events */
  handleEvent?<T>(event: string, handler: PluginEventHandler<T>): void;
  /** Emit plugin event */
  emitEvent?<T>(event: string, data?: T): void;

  // Utility methods
  /** Get plugin health status */
  getHealth?(): Promise<PluginHealthStatus>;
  /** Get plugin metrics */
  getMetrics?(): Promise<Record<string, unknown>>;
  /** Validate plugin configuration */
  validateConfig?(config: PluginConfig): Promise<boolean> | boolean;
  /** Update plugin configuration */
  updateConfig?(config: Partial<PluginConfig>): Promise<void> | void;
}

/**
 * Plugin health status
 */
export interface PluginHealthStatus {
  /** Overall health status */
  status: 'healthy' | 'degraded' | 'unhealthy';
  /** Health check timestamp */
  timestamp: number;
  /** Health check details */
  details: Record<string, unknown>;
  /** Health check errors */
  errors?: string[];
  /** Health check warnings */
  warnings?: string[];
}

/**
 * Plugin factory function
 */
export type PluginFactory = (
  config?: Partial<PluginConfig>
) => Promise<Plugin> | Plugin;

/**
 * Plugin registry interface
 */
export interface PluginRegistry {
  /** Register a plugin */
  register(plugin: Plugin): Promise<void>;
  /** Unregister a plugin */
  unregister(id: string): Promise<boolean>;
  /** Get plugin by ID */
  get(id: string): Plugin | undefined;
  /** Get all plugins */
  getAll(): Plugin[];
  /** Get plugins by type */
  getByType(type: PluginType): Plugin[];
  /** Get plugins by state */
  getByState(state: PluginLifecycleState): Plugin[];
  /** Check if plugin exists */
  has(id: string): boolean;
  /** Start plugin */
  start(id: string): Promise<void>;
  /** Stop plugin */
  stop(id: string): Promise<void>;
  /** Restart plugin */
  restart(id: string): Promise<void>;
  /** Enable plugin */
  enable(id: string): Promise<void>;
  /** Disable plugin */
  disable(id: string): Promise<void>;
  /** Update plugin configuration */
  updateConfig(id: string, config: Partial<PluginConfig>): Promise<void>;
  /** Get plugin health */
  getHealth(id: string): Promise<PluginHealthStatus>;
  /** Get registry statistics */
  getStats(): PluginRegistryStats;
  /** Dispose registry */
  dispose(): Promise<void>;
}

/**
 * Plugin registry statistics
 */
export interface PluginRegistryStats {
  /** Total plugins count */
  total: number;
  /** Plugins by state */
  byState: Record<PluginLifecycleState, number>;
  /** Plugins by type */
  byType: Record<PluginType, number>;
  /** Plugins by priority */
  byPriority: Record<PluginPriority, number>;
  /** Load order */
  loadOrder: string[];
  /** Plugin dependencies */
  dependencies: Record<string, string[]>;
  /** Registry health */
  health: {
    healthy: number;
    degraded: number;
    unhealthy: number;
  };
}

/**
 * Plugin installation options
 */
export interface PluginInstallOptions {
  /** Plugin source (URL, file path, npm package) */
  source: string;
  /** Plugin version */
  version?: string;
  /** Installation configuration */
  config?: Partial<PluginConfig>;
  /** Whether to auto-start after installation */
  autoStart?: boolean;
  /** Installation timeout */
  timeout?: number;
  /** Installation cache options */
  cache?: {
    enabled: boolean;
    ttl?: number;
  };
}

/**
 * Plugin marketplace entry
 */
export interface PluginMarketplaceEntry {
  /** Plugin metadata */
  metadata: PluginMetadata;
  /** Download statistics */
  downloads: {
    total: number;
    weekly: number;
    monthly: number;
  };
  /** Plugin rating */
  rating: {
    average: number;
    count: number;
  };
  /** Plugin reviews */
  reviews?: PluginReview[];
  /** Publication date */
  publishedAt: string;
  /** Last update date */
  updatedAt: string;
  /** Plugin size in bytes */
  size: number;
  /** Plugin verification status */
  verified: boolean;
  /** Plugin security scan results */
  security?: {
    scanned: boolean;
    scannedAt?: string;
    issues?: string[];
  };
}

/**
 * Plugin review
 */
export interface PluginReview {
  /** Review ID */
  id: string;
  /** Reviewer name */
  author: string;
  /** Review rating */
  rating: number;
  /** Review title */
  title: string;
  /** Review content */
  content: string;
  /** Review date */
  createdAt: string;
  /** Plugin version reviewed */
  version: string;
}

/**
 * Plugin template
 */
export interface PluginTemplate {
  /** Template name */
  name: string;
  /** Template description */
  description: string;
  /** Template type */
  type: PluginType;
  /** Template files */
  files: PluginTemplateFile[];
  /** Template variables */
  variables: PluginTemplateVariable[];
  /** Template examples */
  examples?: string[];
}

/**
 * Plugin template file
 */
export interface PluginTemplateFile {
  /** File path */
  path: string;
  /** File content template */
  content: string;
  /** Whether file is executable */
  executable?: boolean;
}

/**
 * Plugin template variable
 */
export interface PluginTemplateVariable {
  /** Variable name */
  name: string;
  /** Variable type */
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  /** Variable description */
  description: string;
  /** Default value */
  default?: unknown;
  /** Whether variable is required */
  required?: boolean;
  /** Variable validation pattern */
  pattern?: string;
}

/**
 * Plugin error types
 */
export enum PluginErrorType {
  INITIALIZATION_ERROR = 'initialization_error',
  CONFIGURATION_ERROR = 'configuration_error',
  DEPENDENCY_ERROR = 'dependency_error',
  RUNTIME_ERROR = 'runtime_error',
  VALIDATION_ERROR = 'validation_error',
  PERMISSION_ERROR = 'permission_error',
  TIMEOUT_ERROR = 'timeout_error',
  NETWORK_ERROR = 'network_error',
  COMPATIBILITY_ERROR = 'compatibility_error'
}

/**
 * Plugin error interface
 */
export interface PluginError extends Error {
  /** Error type */
  type: PluginErrorType;
  /** Plugin ID that caused the error */
  pluginId: string;
  /** Error code */
  code: string;
  /** Error context */
  context?: Record<string, unknown>;
  /** Original error */
  cause?: Error;
  /** Error timestamp */
  timestamp: number;
}

// ===== PLUGIN ECOSYSTEM TYPES =====

/**
 * Plugin search query
 */
export interface PluginSearchQuery {
  /** Search text */
  text?: string;
  /** Sort field */
  sortBy?: 'name' | 'downloads' | 'rating' | 'updated' | 'published' | 'trending';
  /** Sort order */
  sortOrder?: 'asc' | 'desc';
  /** Search filters */
  filters?: {
    /** Plugin type */
    type?: PluginType;
    /** Plugin category */
    category?: string;
    /** Author name */
    author?: string;
    /** License type */
    license?: string;
    /** Minimum downloads */
    minDownloads?: number;
    /** Maximum age in days */
    maxAge?: number;
    /** Time frame for trending */
    timeframe?: 'day' | 'week' | 'month';
  };
}

/**
 * Plugin search result
 */
export interface PluginSearchResult {
  /** Plugin metadata */
  metadata: PluginMetadata;
  /** Source where plugin was found */
  source: string;
  /** Package name in the source */
  packageName: string;
  /** Plugin version */
  version: string;
  /** Publication date */
  publishedAt: string;
  /** Last update date */
  updatedAt: string;
  /** Plugin statistics */
  stats?: {
    downloads?: number;
    rating?: number;
    trendingScore?: number;
  };
}

/**
 * Plugin discovery options
 */
export interface PluginDiscoveryOptions {
  /** Use cache for search results */
  useCache?: boolean;
  /** Cache TTL in milliseconds */
  cacheTtl?: number;
  /** Sources to search */
  sources?: string[];
  /** Maximum number of results */
  maxResults?: number;
  /** Include prerelease versions */
  includePrerelease?: boolean;
}

/**
 * Plugin source interface
 */
export interface PluginSource {
  /** Source ID */
  readonly id: string;
  /** Source name */
  readonly name: string;
  /** Source URL */
  readonly url: string;
  /** Search plugins in this source */
  search(query: PluginSearchQuery, options?: PluginDiscoveryOptions): Promise<PluginSearchResult[]>;
  /** Get plugin details */
  getPluginDetails(pluginId: string): Promise<PluginPackageInfo | null>;
  /** Get available categories */
  getCategories(): Promise<string[]>;
}

/**
 * Plugin package information
 */
export interface PluginPackageInfo {
  /** Plugin ID */
  id: string;
  /** Plugin name */
  name: string;
  /** Plugin description */
  description: string;
  /** Available versions */
  versions: string[];
  /** Latest version */
  latestVersion: string;
  /** Plugin author */
  author: string;
  /** Plugin license */
  license: string;
  /** Homepage URL */
  homepage?: string;
  /** Repository URL */
  repository?: string;
  /** Plugin keywords */
  keywords: string[];
  /** Dependencies */
  dependencies: Record<string, string>;
  /** Peer dependencies */
  peerDependencies: Record<string, string>;
  /** Source where plugin is hosted */
  source: string;
  /** Package name in source */
  packageName: string;
  /** Publication date */
  publishedAt: string;
  /** Last update date */
  updatedAt: string;
  /** Plugin statistics */
  stats?: {
    downloads?: number;
    rating?: number;
    trendingScore?: number;
  };
}

/**
 * Plugin collection
 */
export interface PluginCollection {
  /** Collection ID */
  id: string;
  /** Collection name */
  name: string;
  /** Collection description */
  description: string;
  /** Collection author */
  author: string;
  /** Plugin IDs in collection */
  plugins: string[];
  /** Collection tags */
  tags: string[];
  /** Whether collection is official */
  isOfficial: boolean;
  /** Whether collection is public */
  isPublic: boolean;
  /** Creation date */
  createdAt: string;
  /** Last update date */
  updatedAt: string;
}

/**
 * Plugin marketplace entry
 */
export interface PluginMarketplaceEntry {
  /** Plugin package info */
  plugin: PluginPackageInfo;
  /** Whether plugin is verified */
  isVerified: boolean;
  /** Whether plugin is featured */
  isFeatured: boolean;
  /** Plugin rating information */
  rating: {
    average: number;
    count: number;
    distribution: Record<number, number>;
  };
  /** Plugin reviews */
  reviews: PluginReview[];
  /** Download statistics */
  downloadStats: {
    total: number;
    weekly: number;
    monthly: number;
  };
  /** Collections containing this plugin */
  collections: string[];
  /** Compatibility information */
  compatibilityInfo: PluginCompatibilityResult;
  /** Security information */
  securityInfo: {
    hasVulnerabilities: boolean;
    lastSecurityAudit: string;
    trustScore: number;
  };
}

/**
 * Plugin marketplace options
 */
export interface PluginMarketplaceOptions {
  /** API base URL */
  apiUrl?: string;
  /** API authentication token */
  token?: string;
  /** Request timeout */
  timeout?: number;
  /** Use cache */
  useCache?: boolean;
  /** Cache TTL */
  cacheTtl?: number;
}

/**
 * Plugin install options
 */
export interface PluginInstallOptions {
  /** Plugin version to install */
  version?: string;
  /** Plugin source */
  source?: string;
  /** Skip dependency installation */
  skipDependencies?: boolean;
  /** Force install even if incompatible */
  force?: boolean;
  /** Installation timeout */
  timeout?: number;
}

/**
 * Plugin publish options
 */
export interface PluginPublishOptions {
  /** Target source/registry */
  source?: string;
  /** Make plugin public */
  makePublic?: boolean;
  /** Request verification */
  requestVerification?: boolean;
  /** Publish timeout */
  timeout?: number;
}

/**
 * Plugin rating
 */
export interface PluginRating {
  /** Rating ID */
  id: string;
  /** User who gave the rating */
  userId: string;
  /** Rating value (1-5) */
  rating: number;
  /** Optional comment */
  comment?: string;
  /** Plugin version rated */
  version: string;
  /** Rating date */
  createdAt: string;
}

/**
 * Plugin review
 */
export interface PluginReview {
  /** Review ID */
  id: string;
  /** Reviewer user ID */
  userId: string;
  /** Reviewer display name */
  userName: string;
  /** Review title */
  title: string;
  /** Review content */
  content: string;
  /** Review rating */
  rating: number;
  /** Plugin version reviewed */
  version: string;
  /** Review date */
  createdAt: string;
  /** Helpful votes count */
  helpfulVotes?: number;
}

/**
 * Plugin version information
 */
export interface PluginVersionInfo {
  /** Version string */
  version: string;
  /** Release date */
  releaseDate: string;
  /** Changelog */
  changelog: string;
  /** Whether version is stable */
  isStable: boolean;
  /** Whether version is prerelease */
  isPrerelease: boolean;
  /** Whether version is deprecated */
  isDeprecated: boolean;
  /** Download count for this version */
  downloadCount: number;
  /** Dependencies */
  dependencies: Record<string, string>;
  /** Peer dependencies */
  peerDependencies: Record<string, string>;
}

/**
 * Plugin compatibility result
 */
export interface PluginCompatibilityResult {
  /** Whether plugin is compatible */
  compatible: boolean;
  /** Compatibility issues */
  issues: string[];
  /** Compatibility warnings */
  warnings: string[];
  /** Compatibility recommendations */
  recommendations: string[];
}

/**
 * Plugin update result
 */
export interface PluginUpdateResult {
  /** Whether updates are available */
  hasUpdates: boolean;
  /** Current version */
  currentVersion: string;
  /** Latest available version */
  latestVersion: string;
  /** Available update versions */
  availableUpdates: PluginVersionInfo[];
  /** Type of update */
  updateType: 'major' | 'minor' | 'patch' | 'none';
  /** Whether migration is required */
  migrationRequired: boolean;
}

/**
 * Plugin version constraint
 */
export interface PluginVersionConstraint {
  /** Plugin ID */
  pluginId: string;
  /** Version constraint string */
  constraint: string;
  /** Whether constraint is required */
  required: boolean;
  /** Constraint type */
  type: 'dependency' | 'peer' | 'optional';
}

/**
 * Plugin migration information
 */
export interface PluginMigrationInfo {
  /** Whether migration is required */
  required: boolean;
  /** Whether migration has breaking changes */
  breaking: boolean;
  /** Migration steps */
  steps: string[];
  /** Configuration changes needed */
  configChanges: Array<{
    path: string;
    oldValue: unknown;
    newValue: unknown;
    description: string;
  }>;
  /** API changes */
  apiChanges: Array<{
    type: 'added' | 'removed' | 'changed';
    method: string;
    description: string;
  }>;
  /** Migration documentation URL */
  documentation?: string;
}