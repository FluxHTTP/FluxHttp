/**
 * @fileoverview Plugin builder utility for creating plugins with fluent API
 * @module @fluxhttp/plugins/pdk/builder
 */

import type {
  Plugin,
  PluginConfig,
  PluginMetadata,
  PluginConfigSchema,
  PluginLifecycleHooks,
  PluginContext,
  PluginRequestInterceptor,
  PluginResponseInterceptor,
  PluginErrorInterceptor,
  fluxhttpRequestConfig,
  fluxhttpResponse,
  fluxhttpError
} from '../types';
import { PluginLifecycleState, PluginType, PluginPriority } from '../types';

/**
 * Plugin builder for creating plugins with fluent API
 */
export class PluginBuilder {
  private metadata: Partial<PluginMetadata> = {};
  private config: Partial<PluginConfig> = { enabled: true, settings: {} };
  private configSchema?: PluginConfigSchema;
  private hooks: PluginLifecycleHooks = {};
  private requestInterceptors: PluginRequestInterceptor[] = [];
  private responseInterceptors: PluginResponseInterceptor[] = [];
  private errorInterceptors: PluginErrorInterceptor[] = [];
  private initFunction?: (context: PluginContext) => Promise<void> | void;
  private startFunction?: (context: PluginContext) => Promise<void> | void;
  private stopFunction?: (context: PluginContext) => Promise<void> | void;
  private destroyFunction?: (context: PluginContext) => Promise<void> | void;

  /**
   * Set plugin metadata
   */
  withMetadata(metadata: Partial<PluginMetadata>): this {
    this.metadata = { ...this.metadata, ...metadata };
    return this;
  }

  /**
   * Set plugin ID
   */
  withId(id: string): this {
    this.metadata.id = id;
    return this;
  }

  /**
   * Set plugin name
   */
  withName(name: string): this {
    this.metadata.name = name;
    return this;
  }

  /**
   * Set plugin version
   */
  withVersion(version: string): this {
    this.metadata.version = version;
    return this;
  }

  /**
   * Set plugin type
   */
  withType(type: PluginType): this {
    this.metadata.type = type;
    return this;
  }

  /**
   * Set plugin description
   */
  withDescription(description: string): this {
    this.metadata.description = description;
    return this;
  }

  /**
   * Set plugin author
   */
  withAuthor(author: { name: string; email?: string; url?: string }): this {
    this.metadata.author = author;
    return this;
  }

  /**
   * Set plugin license
   */
  withLicense(license: string): this {
    this.metadata.license = license;
    return this;
  }

  /**
   * Set plugin keywords
   */
  withKeywords(keywords: string[]): this {
    this.metadata.keywords = keywords;
    return this;
  }

  /**
   * Set plugin capabilities
   */
  withCapabilities(capabilities: Partial<PluginMetadata['capabilities']>): this {
    this.metadata.capabilities = { ...this.metadata.capabilities, ...capabilities };
    return this;
  }

  /**
   * Set plugin priority
   */
  withPriority(priority: PluginPriority): this {
    this.metadata.priority = priority;
    return this;
  }

  /**
   * Set plugin dependencies
   */
  withDependencies(dependencies: PluginMetadata['dependencies']): this {
    this.metadata.dependencies = dependencies;
    return this;
  }

  /**
   * Set plugin configuration
   */
  withConfig(config: Partial<PluginConfig>): this {
    this.config = { ...this.config, ...config };
    return this;
  }

  /**
   * Set plugin configuration schema
   */
  withConfigSchema(schema: PluginConfigSchema): this {
    this.configSchema = schema;
    return this;
  }

  /**
   * Set plugin settings
   */
  withSettings(settings: Record<string, unknown>): this {
    this.config.settings = { ...this.config.settings, ...settings };
    return this;
  }

  /**
   * Add lifecycle hook
   */
  withHook<K extends keyof PluginLifecycleHooks>(
    hook: K,
    handler: NonNullable<PluginLifecycleHooks[K]>
  ): this {
    this.hooks[hook] = handler;
    return this;
  }

  /**
   * Set initialization function
   */
  withInit(initFunction: (context: PluginContext) => Promise<void> | void): this {
    this.initFunction = initFunction;
    return this;
  }

  /**
   * Set start function
   */
  withStart(startFunction: (context: PluginContext) => Promise<void> | void): this {
    this.startFunction = startFunction;
    return this;
  }

  /**
   * Set stop function
   */
  withStop(stopFunction: (context: PluginContext) => Promise<void> | void): this {
    this.stopFunction = stopFunction;
    return this;
  }

  /**
   * Set destroy function
   */
  withDestroy(destroyFunction: (context: PluginContext) => Promise<void> | void): this {
    this.destroyFunction = destroyFunction;
    return this;
  }

  /**
   * Add request interceptor
   */
  withRequestInterceptor(interceptor: PluginRequestInterceptor): this {
    this.requestInterceptors.push(interceptor);
    return this;
  }

  /**
   * Add response interceptor
   */
  withResponseInterceptor(interceptor: PluginResponseInterceptor): this {
    this.responseInterceptors.push(interceptor);
    return this;
  }

  /**
   * Add error interceptor
   */
  withErrorInterceptor(interceptor: PluginErrorInterceptor): this {
    this.errorInterceptors.push(interceptor);
    return this;
  }

  /**
   * Add request modifier (convenience method)
   */
  modifyRequest(modifier: (config: fluxhttpRequestConfig, context: PluginContext) => fluxhttpRequestConfig | Promise<fluxhttpRequestConfig>): this {
    return this.withRequestInterceptor(modifier);
  }

  /**
   * Add response processor (convenience method)
   */
  processResponse(processor: (response: fluxhttpResponse, context: PluginContext) => fluxhttpResponse | Promise<fluxhttpResponse>): this {
    return this.withResponseInterceptor(processor);
  }

  /**
   * Add error handler (convenience method)
   */
  handleError(handler: (error: fluxhttpError, context: PluginContext) => fluxhttpError | fluxhttpResponse | Promise<fluxhttpError | fluxhttpResponse>): this {
    return this.withErrorInterceptor(handler);
  }

  /**
   * Add request header (convenience method)
   */
  addRequestHeader(name: string, value: string | ((config: fluxhttpRequestConfig) => string)): this {
    return this.withRequestInterceptor((config, context) => {
      const headerValue = typeof value === 'function' ? value(config) : value;
      config.headers = { ...config.headers, [name]: headerValue };
      return config;
    });
  }

  /**
   * Add authentication (convenience method)
   */
  withAuth(type: 'bearer' | 'basic' | 'api-key', credentials: string | { username: string; password: string }): this {
    return this.withRequestInterceptor((config, context) => {
      switch (type) {
        case 'bearer':
          config.headers = { ...config.headers, Authorization: `Bearer ${credentials}` };
          break;
        case 'basic':
          if (typeof credentials === 'object') {
            const encoded = btoa(`${credentials.username}:${credentials.password}`);
            config.headers = { ...config.headers, Authorization: `Basic ${encoded}` };
          }
          break;
        case 'api-key':
          config.headers = { ...config.headers, 'X-API-Key': credentials as string };
          break;
      }
      return config;
    });
  }

  /**
   * Add logging (convenience method)
   */
  withLogging(options: { requests?: boolean; responses?: boolean; errors?: boolean } = {}): this {
    const { requests = true, responses = true, errors = true } = options;

    if (requests) {
      this.withRequestInterceptor((config, context) => {
        context.logger.info('Request', {
          method: config.method,
          url: config.url
        });
        return config;
      });
    }

    if (responses) {
      this.withResponseInterceptor((response, context) => {
        context.logger.info('Response', {
          status: response.status,
          url: response.config.url
        });
        return response;
      });
    }

    if (errors) {
      this.withErrorInterceptor((error, context) => {
        context.logger.error('Error', {
          message: error.message,
          url: error.config?.url
        });
        return error;
      });
    }

    return this;
  }

  /**
   * Add metrics collection (convenience method)
   */
  withMetrics(prefix = 'plugin'): this {
    this.withRequestInterceptor((config, context) => {
      context.metrics.increment(`${prefix}.requests.started`);
      return config;
    });

    this.withResponseInterceptor((response, context) => {
      context.metrics.increment(`${prefix}.requests.completed`);
      context.metrics.increment(`${prefix}.responses.${response.status}`);
      return response;
    });

    this.withErrorInterceptor((error, context) => {
      context.metrics.increment(`${prefix}.requests.failed`);
      return error;
    });

    return this;
  }

  /**
   * Add validation (convenience method)
   */
  withValidation(validator: (config: fluxhttpRequestConfig) => boolean | string): this {
    return this.withRequestInterceptor((config, context) => {
      const result = validator(config);
      if (result !== true) {
        const message = typeof result === 'string' ? result : 'Request validation failed';
        throw new Error(message);
      }
      return config;
    });
  }

  /**
   * Add caching (convenience method)
   */
  withCaching(options: { ttl?: number; key?: (config: fluxhttpRequestConfig) => string } = {}): this {
    const { ttl = 300000, key = (config) => `${config.method}:${config.url}` } = options;

    this.withRequestInterceptor(async (config, context) => {
      const cacheKey = key(config);
      const cached = await context.cache.get(cacheKey);
      
      if (cached) {
        // Return cached response (would need to be properly implemented)
        context.logger.debug('Cache hit', { key: cacheKey });
      }
      
      return config;
    });

    this.withResponseInterceptor(async (response, context) => {
      const cacheKey = key(response.config);
      await context.cache.set(cacheKey, response, ttl);
      context.logger.debug('Response cached', { key: cacheKey });
      return response;
    });

    return this;
  }

  /**
   * Add retry logic (convenience method)
   */
  withRetry(options: { attempts?: number; delay?: number; backoff?: 'linear' | 'exponential' } = {}): this {
    const { attempts = 3, delay = 1000, backoff = 'exponential' } = options;

    this.withErrorInterceptor(async (error, context) => {
      const attempt = (error.config as any)?._retryAttempt || 0;
      
      if (attempt < attempts) {
        const nextDelay = backoff === 'exponential' ? delay * Math.pow(2, attempt) : delay * (attempt + 1);
        
        context.logger.info('Retrying request', {
          attempt: attempt + 1,
          maxAttempts: attempts,
          delay: nextDelay
        });

        // Wait and retry (simplified - would need proper implementation)
        await new Promise(resolve => setTimeout(resolve, nextDelay));
        
        // Mark retry attempt
        if (error.config) {
          (error.config as any)._retryAttempt = attempt + 1;
        }
      }
      
      return error;
    });

    return this;
  }

  /**
   * Build the plugin
   */
  build(): Plugin {
    // Validate required metadata
    if (!this.metadata.id) {
      throw new Error('Plugin ID is required');
    }
    if (!this.metadata.name) {
      throw new Error('Plugin name is required');
    }
    if (!this.metadata.version) {
      throw new Error('Plugin version is required');
    }
    if (!this.metadata.type) {
      throw new Error('Plugin type is required');
    }

    // Set defaults
    const metadata: PluginMetadata = {
      description: '',
      author: { name: 'Unknown' },
      license: 'MIT',
      keywords: [],
      capabilities: {},
      priority: PluginPriority.NORMAL,
      ...this.metadata
    } as PluginMetadata;

    const config: PluginConfig = {
      enabled: true,
      settings: {},
      ...this.config
    };

    // Create plugin class
    class GeneratedPlugin implements Plugin {
      readonly metadata = metadata;
      readonly configSchema = this.configSchema;
      
      state = PluginLifecycleState.UNINITIALIZED;
      config = config;
      context?: PluginContext;
      hooks = this.hooks;

      constructor(private builder: PluginBuilder) {}

      async init(context: PluginContext): Promise<void> {
        this.context = context;

        // Register interceptors
        for (const interceptor of this.builder.requestInterceptors) {
          this.interceptRequest(interceptor);
        }

        for (const interceptor of this.builder.responseInterceptors) {
          this.interceptResponse(interceptor);
        }

        for (const interceptor of this.builder.errorInterceptors) {
          this.interceptError(interceptor);
        }

        // Call custom init function
        if (this.builder.initFunction) {
          await this.builder.initFunction(context);
        }

        // Call init hook
        if (this.hooks.afterInit) {
          await this.hooks.afterInit(context);
        }
      }

      async start(context: PluginContext): Promise<void> {
        if (this.builder.startFunction) {
          await this.builder.startFunction(context);
        }

        if (this.hooks.afterStart) {
          await this.hooks.afterStart(context);
        }
      }

      async stop(context: PluginContext): Promise<void> {
        if (this.builder.stopFunction) {
          await this.builder.stopFunction(context);
        }

        if (this.hooks.afterStop) {
          await this.hooks.afterStop(context);
        }
      }

      async destroy(context: PluginContext): Promise<void> {
        if (this.builder.destroyFunction) {
          await this.builder.destroyFunction(context);
        }

        if (this.hooks.afterDestroy) {
          await this.hooks.afterDestroy(context);
        }
      }

      interceptRequest(interceptor: PluginRequestInterceptor): void {
        if (this.context?.fluxhttp.interceptors.request) {
          this.context.fluxhttp.interceptors.request.use(
            (config) => interceptor(config, this.context!),
            undefined,
            { runWhen: () => this.config.enabled }
          );
        }
      }

      interceptResponse(interceptor: PluginResponseInterceptor): void {
        if (this.context?.fluxhttp.interceptors.response) {
          this.context.fluxhttp.interceptors.response.use(
            (response) => interceptor(response, this.context!),
            undefined,
            { runWhen: () => this.config.enabled }
          );
        }
      }

      interceptError(interceptor: PluginErrorInterceptor): void {
        if (this.context?.fluxhttp.interceptors.response) {
          this.context.fluxhttp.interceptors.response.use(
            undefined,
            (error) => {
              const result = interceptor(error, this.context!);
              return Promise.reject(result);
            },
            { runWhen: () => this.config.enabled }
          );
        }
      }

      async getHealth() {
        return {
          status: this.config.enabled ? 'healthy' as const : 'degraded' as const,
          timestamp: Date.now(),
          details: {
            enabled: this.config.enabled,
            state: this.state
          }
        };
      }

      async getMetrics() {
        return {
          enabled: this.config.enabled,
          state: this.state
        };
      }
    }

    return new GeneratedPlugin(this);
  }

  /**
   * Build and create factory function
   */
  buildFactory(): (config?: Partial<PluginConfig>) => Plugin {
    const PluginClass = this.build().constructor as new (builder: PluginBuilder) => Plugin;
    
    return (config?: Partial<PluginConfig>) => {
      const builder = new PluginBuilder();
      
      // Copy all properties from this builder
      builder.metadata = { ...this.metadata };
      builder.config = { ...this.config, ...config };
      builder.configSchema = this.configSchema;
      builder.hooks = { ...this.hooks };
      builder.requestInterceptors = [...this.requestInterceptors];
      builder.responseInterceptors = [...this.responseInterceptors];
      builder.errorInterceptors = [...this.errorInterceptors];
      builder.initFunction = this.initFunction;
      builder.startFunction = this.startFunction;
      builder.stopFunction = this.stopFunction;
      builder.destroyFunction = this.destroyFunction;
      
      return new PluginClass(builder);
    };
  }

  /**
   * Reset builder to initial state
   */
  reset(): this {
    this.metadata = {};
    this.config = { enabled: true, settings: {} };
    this.configSchema = undefined;
    this.hooks = {};
    this.requestInterceptors = [];
    this.responseInterceptors = [];
    this.errorInterceptors = [];
    this.initFunction = undefined;
    this.startFunction = undefined;
    this.stopFunction = undefined;
    this.destroyFunction = undefined;
    return this;
  }

  /**
   * Clone builder
   */
  clone(): PluginBuilder {
    const newBuilder = new PluginBuilder();
    newBuilder.metadata = { ...this.metadata };
    newBuilder.config = { ...this.config };
    newBuilder.configSchema = this.configSchema;
    newBuilder.hooks = { ...this.hooks };
    newBuilder.requestInterceptors = [...this.requestInterceptors];
    newBuilder.responseInterceptors = [...this.responseInterceptors];
    newBuilder.errorInterceptors = [...this.errorInterceptors];
    newBuilder.initFunction = this.initFunction;
    newBuilder.startFunction = this.startFunction;
    newBuilder.stopFunction = this.stopFunction;
    newBuilder.destroyFunction = this.destroyFunction;
    return newBuilder;
  }
}