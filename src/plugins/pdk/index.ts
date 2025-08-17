/**
 * @fileoverview Plugin Development Kit (PDK) for FluxHTTP
 * @module @fluxhttp/plugins/pdk
 */

export { PluginBuilder } from './builder';
export { PluginTemplate } from './template';
export { PluginValidator } from './validator';
export { PluginTester } from './tester';
export { PluginGenerator } from './generator';
export { PluginHelper } from './helper';

// Re-export core types for plugin development
export type * from '../types';
export type * from '../core';

// Export built-in plugins as examples
export * from '../built-in';

/**
 * Plugin Development Kit namespace
 */
export namespace PDK {
  /**
   * Create a new plugin using the builder pattern
   */
  export function createPlugin() {
    return new PluginBuilder();
  }

  /**
   * Generate a plugin from template
   */
  export function generateFromTemplate(templateName: string, options: any) {
    return new PluginGenerator().fromTemplate(templateName, options);
  }

  /**
   * Validate a plugin
   */
  export function validatePlugin(plugin: any) {
    return new PluginValidator().validate(plugin);
  }

  /**
   * Test a plugin
   */
  export function testPlugin(plugin: any) {
    return new PluginTester(plugin);
  }

  /**
   * Get plugin development helpers
   */
  export function getHelpers() {
    return new PluginHelper();
  }
}

/**
 * Plugin development utilities
 */
export const PluginUtils = {
  /**
   * Common plugin patterns and examples
   */
  patterns: {
    /**
     * Request interceptor pattern
     */
    requestInterceptor: `
interceptRequest(async (config, context) => {
  // Modify request config
  config.headers = { ...config.headers, 'X-Custom-Header': 'value' };
  return config;
});`,

    /**
     * Response interceptor pattern
     */
    responseInterceptor: `
interceptResponse(async (response, context) => {
  // Process response
  context.logger.info('Response received', { status: response.status });
  return response;
});`,

    /**
     * Error handler pattern
     */
    errorHandler: `
interceptError(async (error, context) => {
  // Handle error
  context.logger.error('Request failed', { error: error.message });
  return error;
});`,

    /**
     * Plugin lifecycle pattern
     */
    lifecycle: `
async init(context) {
  this.context = context;
  // Initialize plugin resources
}

async start(context) {
  // Start plugin operations
}

async stop(context) {
  // Clean up plugin resources
}`
  },

  /**
   * Common plugin configurations
   */
  configs: {
    /**
     * Basic plugin configuration
     */
    basic: {
      enabled: true,
      settings: {}
    },

    /**
     * Authentication plugin configuration
     */
    auth: {
      enabled: true,
      settings: {
        type: 'bearer',
        token: 'your-token-here'
      }
    },

    /**
     * Cache plugin configuration
     */
    cache: {
      enabled: true,
      settings: {
        strategy: 'cache-first',
        defaultTtl: 300000,
        storage: 'memory'
      }
    },

    /**
     * Retry plugin configuration
     */
    retry: {
      enabled: true,
      settings: {
        maxAttempts: 3,
        backoff: 'exponential',
        baseDelay: 1000
      }
    }
  },

  /**
   * Plugin testing utilities
   */
  testing: {
    /**
     * Create mock plugin context
     */
    createMockContext: () => ({
      plugin: {} as any,
      fluxhttp: {} as any,
      registry: {} as any,
      logger: {
        trace: jest.fn(),
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        fatal: jest.fn(),
        child: jest.fn(() => this)
      },
      metrics: {
        increment: jest.fn(),
        decrement: jest.fn(),
        gauge: jest.fn(),
        histogram: jest.fn(),
        timing: jest.fn(),
        timer: jest.fn(),
        getStats: jest.fn()
      },
      cache: {
        get: jest.fn(),
        set: jest.fn(),
        delete: jest.fn(),
        has: jest.fn(),
        clear: jest.fn(),
        getStats: jest.fn()
      },
      events: {
        emit: jest.fn(),
        on: jest.fn(),
        once: jest.fn(),
        off: jest.fn(),
        removeAllListeners: jest.fn(),
        listenerCount: jest.fn(),
        eventNames: jest.fn()
      },
      utils: {
        generateId: jest.fn(),
        deepClone: jest.fn(),
        deepMerge: jest.fn(),
        isPlainObject: jest.fn(),
        throttle: jest.fn(),
        debounce: jest.fn(),
        validateSchema: jest.fn(),
        parseVersion: jest.fn(),
        compareVersions: jest.fn(),
        satisfiesVersion: jest.fn()
      }
    }),

    /**
     * Create mock FluxHTTP instance
     */
    createMockFluxHttp: () => ({
      defaults: {},
      interceptors: {
        request: {
          use: jest.fn(),
          eject: jest.fn(),
          clear: jest.fn()
        },
        response: {
          use: jest.fn(),
          eject: jest.fn(),
          clear: jest.fn()
        }
      },
      request: jest.fn(),
      get: jest.fn(),
      post: jest.fn(),
      put: jest.fn(),
      patch: jest.fn(),
      delete: jest.fn(),
      head: jest.fn(),
      options: jest.fn(),
      getUri: jest.fn(),
      create: jest.fn(),
      dispose: jest.fn(),
      isDisposed: jest.fn(),
      getMemoryStats: jest.fn()
    })
  }
};

/**
 * Plugin development best practices
 */
export const BestPractices = {
  /**
   * Plugin naming conventions
   */
  naming: {
    /**
     * Plugin ID should be kebab-case
     */
    id: 'my-awesome-plugin',
    
    /**
     * Plugin name should be Title Case
     */
    name: 'My Awesome Plugin',
    
    /**
     * Plugin class should be PascalCase with Plugin suffix
     */
    className: 'MyAwesomePlugin'
  },

  /**
   * Plugin structure guidelines
   */
  structure: {
    /**
     * Recommended file structure
     */
    files: [
      'src/my-plugin.ts',           // Main plugin class
      'src/types.ts',               // Plugin-specific types
      'src/config.ts',              // Default configuration
      'src/utils.ts',               // Utility functions
      'tests/my-plugin.test.ts',    // Unit tests
      'README.md',                  // Documentation
      'package.json'                // Package metadata
    ],

    /**
     * Plugin class structure
     */
    classStructure: `
export class MyPlugin implements Plugin {
  readonly metadata: PluginMetadata = { /* ... */ };
  readonly configSchema: PluginConfigSchema = { /* ... */ };
  
  state = PluginLifecycleState.UNINITIALIZED;
  config: MyPluginConfig;
  context?: PluginContext;

  constructor(config?: Partial<MyPluginConfig>) {
    // Initialize plugin
  }

  async init(context: PluginContext): Promise<void> {
    // Plugin initialization
  }

  // Plugin implementation
}`
  },

  /**
   * Performance considerations
   */
  performance: [
    'Use lazy loading for heavy resources',
    'Implement proper cleanup in stop() method',
    'Avoid blocking the main thread',
    'Use efficient data structures',
    'Implement proper error handling',
    'Consider memory usage and leaks',
    'Use appropriate log levels',
    'Implement graceful degradation'
  ],

  /**
   * Security considerations
   */
  security: [
    'Validate all input data',
    'Sanitize sensitive information in logs',
    'Use secure defaults',
    'Implement proper authentication checks',
    'Avoid exposing internal APIs',
    'Use HTTPS for external communications',
    'Implement rate limiting where appropriate',
    'Handle errors securely'
  ],

  /**
   * Testing recommendations
   */
  testing: [
    'Write unit tests for all public methods',
    'Test plugin lifecycle methods',
    'Test configuration validation',
    'Test error scenarios',
    'Test plugin interactions',
    'Use mocks for external dependencies',
    'Test performance characteristics',
    'Implement integration tests'
  ]
};

/**
 * Plugin examples and templates
 */
export const Examples = {
  /**
   * Minimal plugin example
   */
  minimal: `
import { Plugin, PluginConfig, PluginContext, PluginMetadata } from '@fluxhttp/plugins';

export interface MinimalPluginConfig extends PluginConfig {
  settings: {
    message?: string;
  };
}

export class MinimalPlugin implements Plugin {
  readonly metadata: PluginMetadata = {
    id: 'minimal',
    name: 'Minimal Plugin',
    version: '1.0.0',
    type: PluginType.FEATURE,
    description: 'A minimal plugin example',
    author: { name: 'Developer' },
    license: 'MIT',
    keywords: ['example'],
    capabilities: {},
    priority: PluginPriority.NORMAL
  };

  state = PluginLifecycleState.UNINITIALIZED;
  config: MinimalPluginConfig;
  context?: PluginContext;

  constructor(config: Partial<MinimalPluginConfig> = {}) {
    this.config = {
      enabled: true,
      settings: {
        message: 'Hello from minimal plugin!',
        ...config.settings
      },
      ...config
    } as MinimalPluginConfig;
  }

  async init(context: PluginContext): Promise<void> {
    this.context = context;
    context.logger.info(this.config.settings.message || 'Plugin initialized');
  }
}

export function createMinimalPlugin(config?: Partial<MinimalPluginConfig>): MinimalPlugin {
  return new MinimalPlugin(config);
}`,

  /**
   * Advanced plugin example with interceptors
   */
  advanced: `
import { 
  Plugin, 
  PluginConfig, 
  PluginContext, 
  PluginMetadata,
  fluxhttpRequestConfig,
  fluxhttpResponse 
} from '@fluxhttp/plugins';

export class AdvancedPlugin implements Plugin {
  // ... metadata and config ...

  async init(context: PluginContext): Promise<void> {
    this.context = context;
    
    // Register request interceptor
    this.interceptRequest(this.handleRequest.bind(this));
    
    // Register response interceptor
    this.interceptResponse(this.handleResponse.bind(this));
    
    context.logger.info('Advanced plugin initialized');
  }

  private async handleRequest(config: fluxhttpRequestConfig): Promise<fluxhttpRequestConfig> {
    // Add custom header
    config.headers = {
      ...config.headers,
      'X-Plugin': 'advanced'
    };
    
    // Log request
    this.context?.logger.debug('Request intercepted', {
      method: config.method,
      url: config.url
    });
    
    return config;
  }

  private async handleResponse(response: fluxhttpResponse): Promise<fluxhttpResponse> {
    // Log response
    this.context?.logger.debug('Response intercepted', {
      status: response.status,
      url: response.config.url
    });
    
    // Update metrics
    this.context?.metrics.increment('requests.total');
    
    return response;
  }
  
  // Implementation of interceptor registration methods...
}`
};

/**
 * Quick start guide for plugin development
 */
export const QuickStart = {
  /**
   * Step-by-step plugin creation guide
   */
  steps: [
    {
      step: 1,
      title: 'Create Plugin Class',
      description: 'Implement the Plugin interface with required metadata and lifecycle methods',
      code: `
export class MyPlugin implements Plugin {
  readonly metadata: PluginMetadata = {
    id: 'my-plugin',
    name: 'My Plugin',
    version: '1.0.0',
    // ... other metadata
  };
  
  // ... implementation
}`
    },
    {
      step: 2,
      title: 'Define Configuration',
      description: 'Create configuration interface and schema for your plugin',
      code: `
export interface MyPluginConfig extends PluginConfig {
  settings: {
    apiKey?: string;
    timeout?: number;
    enabled?: boolean;
  };
}

readonly configSchema: PluginConfigSchema = {
  type: 'object',
  properties: {
    // ... schema definition
  }
};`
    },
    {
      step: 3,
      title: 'Implement Lifecycle',
      description: 'Add initialization, start, and stop methods',
      code: `
async init(context: PluginContext): Promise<void> {
  this.context = context;
  // Initialize plugin resources
}

async start(context: PluginContext): Promise<void> {
  // Start plugin operations
}

async stop(context: PluginContext): Promise<void> {
  // Clean up resources
}`
    },
    {
      step: 4,
      title: 'Add Functionality',
      description: 'Implement your plugin\'s core functionality using interceptors',
      code: `
// Register interceptors in init method
this.interceptRequest(this.handleRequest.bind(this));
this.interceptResponse(this.handleResponse.bind(this));

private async handleRequest(config: fluxhttpRequestConfig): Promise<fluxhttpRequestConfig> {
  // Your request handling logic
  return config;
}`
    },
    {
      step: 5,
      title: 'Create Factory Function',
      description: 'Provide a factory function for easy plugin instantiation',
      code: `
export function createMyPlugin(config?: Partial<MyPluginConfig>): MyPlugin {
  return new MyPlugin(config);
}`
    },
    {
      step: 6,
      title: 'Write Tests',
      description: 'Create comprehensive tests for your plugin',
      code: `
describe('MyPlugin', () => {
  let plugin: MyPlugin;
  let mockContext: PluginContext;

  beforeEach(() => {
    plugin = createMyPlugin();
    mockContext = PluginUtils.testing.createMockContext();
  });

  test('should initialize correctly', async () => {
    await plugin.init(mockContext);
    expect(plugin.state).toBe(PluginLifecycleState.INITIALIZED);
  });
});`
    }
  ],

  /**
   * Common patterns and recipes
   */
  patterns: {
    /**
     * Authentication plugin pattern
     */
    auth: 'Add authentication headers to requests',
    
    /**
     * Caching plugin pattern
     */
    caching: 'Cache responses for improved performance',
    
    /**
     * Logging plugin pattern
     */
    logging: 'Log requests and responses for debugging',
    
    /**
     * Retry plugin pattern
     */
    retry: 'Retry failed requests with backoff strategy',
    
    /**
     * Metrics plugin pattern
     */
    metrics: 'Collect and report performance metrics'
  }
};

/**
 * Plugin development documentation links
 */
export const Documentation = {
  /**
   * Core concepts
   */
  concepts: {
    'Plugin Architecture': '/docs/plugins/architecture',
    'Plugin Lifecycle': '/docs/plugins/lifecycle',
    'Plugin Configuration': '/docs/plugins/configuration',
    'Plugin Testing': '/docs/plugins/testing'
  },

  /**
   * API Reference
   */
  api: {
    'Plugin Interface': '/docs/api/plugin',
    'Plugin Context': '/docs/api/plugin-context',
    'Plugin Registry': '/docs/api/plugin-registry',
    'Plugin Types': '/docs/api/plugin-types'
  },

  /**
   * Examples and tutorials
   */
  examples: {
    'Getting Started': '/docs/examples/getting-started',
    'Built-in Plugins': '/docs/examples/built-in-plugins',
    'Custom Plugins': '/docs/examples/custom-plugins',
    'Plugin Templates': '/docs/examples/templates'
  }
};

// Default export
export default PDK;