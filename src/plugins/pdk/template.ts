/**
 * @fileoverview Plugin templates for quick plugin creation
 * @module @fluxhttp/plugins/pdk/template
 */

import type { PluginTemplate, PluginTemplateFile, PluginTemplateVariable, PluginType } from '../types';

/**
 * Plugin template manager
 */
export class PluginTemplate {
  private static templates = new Map<string, PluginTemplate>();

  /**
   * Register a plugin template
   */
  static register(template: PluginTemplate): void {
    this.templates.set(template.name, template);
  }

  /**
   * Get a template by name
   */
  static get(name: string): PluginTemplate | undefined {
    return this.templates.get(name);
  }

  /**
   * Get all available templates
   */
  static getAll(): PluginTemplate[] {
    return Array.from(this.templates.values());
  }

  /**
   * Get templates by type
   */
  static getByType(type: PluginType): PluginTemplate[] {
    return Array.from(this.templates.values()).filter(template => template.type === type);
  }

  /**
   * Generate files from template
   */
  static generate(templateName: string, variables: Record<string, unknown>): PluginTemplateFile[] {
    const template = this.get(templateName);
    if (!template) {
      throw new Error(`Template '${templateName}' not found`);
    }

    return template.files.map(file => ({
      ...file,
      content: this.interpolateTemplate(file.content, variables)
    }));
  }

  /**
   * Interpolate template variables
   */
  private static interpolateTemplate(content: string, variables: Record<string, unknown>): string {
    let result = content;
    
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
      result = result.replace(regex, String(value));
    }
    
    return result;
  }

  /**
   * Validate template variables
   */
  static validateVariables(templateName: string, variables: Record<string, unknown>): string[] {
    const template = this.get(templateName);
    if (!template) {
      throw new Error(`Template '${templateName}' not found`);
    }

    const errors: string[] = [];
    
    for (const variable of template.variables) {
      const value = variables[variable.name];
      
      if (variable.required && (value === undefined || value === null)) {
        errors.push(`Required variable '${variable.name}' is missing`);
        continue;
      }
      
      if (value !== undefined && value !== null) {
        // Type validation
        if (variable.type === 'string' && typeof value !== 'string') {
          errors.push(`Variable '${variable.name}' must be a string`);
        } else if (variable.type === 'number' && typeof value !== 'number') {
          errors.push(`Variable '${variable.name}' must be a number`);
        } else if (variable.type === 'boolean' && typeof value !== 'boolean') {
          errors.push(`Variable '${variable.name}' must be a boolean`);
        } else if (variable.type === 'array' && !Array.isArray(value)) {
          errors.push(`Variable '${variable.name}' must be an array`);
        } else if (variable.type === 'object' && (typeof value !== 'object' || Array.isArray(value))) {
          errors.push(`Variable '${variable.name}' must be an object`);
        }
        
        // Pattern validation
        if (variable.pattern && typeof value === 'string') {
          const regex = new RegExp(variable.pattern);
          if (!regex.test(value)) {
            errors.push(`Variable '${variable.name}' does not match pattern ${variable.pattern}`);
          }
        }
      }
    }
    
    return errors;
  }
}

// Register built-in templates

/**
 * Basic plugin template
 */
PluginTemplate.register({
  name: 'basic',
  description: 'A basic plugin template with minimal functionality',
  type: 'feature' as PluginType,
  variables: [
    {
      name: 'pluginId',
      type: 'string',
      description: 'Plugin identifier (kebab-case)',
      required: true,
      pattern: '^[a-z][a-z0-9-]*$'
    },
    {
      name: 'pluginName',
      type: 'string',
      description: 'Plugin display name',
      required: true
    },
    {
      name: 'pluginDescription',
      type: 'string',
      description: 'Plugin description',
      required: true
    },
    {
      name: 'authorName',
      type: 'string',
      description: 'Author name',
      required: true
    },
    {
      name: 'authorEmail',
      type: 'string',
      description: 'Author email',
      required: false
    },
    {
      name: 'license',
      type: 'string',
      description: 'Plugin license',
      default: 'MIT'
    },
    {
      name: 'className',
      type: 'string',
      description: 'Plugin class name (PascalCase)',
      required: true,
      pattern: '^[A-Z][a-zA-Z0-9]*Plugin$'
    }
  ],
  files: [
    {
      path: 'src/{{pluginId}}.plugin.ts',
      content: `/**
 * @fileoverview {{pluginDescription}}
 * @module {{pluginId}}
 */

import type {
  Plugin,
  PluginConfig,
  PluginContext,
  PluginMetadata,
  PluginConfigSchema,
  fluxhttpRequestConfig,
  fluxhttpResponse
} from '@fluxhttp/plugins';
import { PluginLifecycleState, PluginType, PluginPriority } from '@fluxhttp/plugins';

/**
 * {{pluginName}} configuration
 */
export interface {{className}}Config extends PluginConfig {
  settings: {
    // Add your plugin settings here
    enabled?: boolean;
  };
}

/**
 * {{pluginName}} implementation
 */
export class {{className}} implements Plugin {
  readonly metadata: PluginMetadata = {
    id: '{{pluginId}}',
    name: '{{pluginName}}',
    version: '1.0.0',
    type: PluginType.FEATURE,
    description: '{{pluginDescription}}',
    author: {
      name: '{{authorName}}'{{#if authorEmail}},
      email: '{{authorEmail}}'{{/if}}
    },
    license: '{{license}}',
    keywords: ['{{pluginId}}'],
    capabilities: {},
    priority: PluginPriority.NORMAL
  };

  readonly configSchema: PluginConfigSchema = {
    type: 'object',
    properties: {
      enabled: { type: 'boolean', default: true },
      settings: {
        type: 'object',
        properties: {
          enabled: { type: 'boolean', default: true }
        }
      }
    }
  };

  state = PluginLifecycleState.UNINITIALIZED;
  config: {{className}}Config;
  context?: PluginContext;

  constructor(config: Partial<{{className}}Config> = {}) {
    this.config = {
      enabled: true,
      settings: {
        enabled: true,
        ...config.settings
      },
      ...config
    } as {{className}}Config;
  }

  /**
   * Initialize plugin
   */
  async init(context: PluginContext): Promise<void> {
    this.context = context;
    
    // Register interceptors
    this.interceptRequest(this.handleRequest.bind(this));
    this.interceptResponse(this.handleResponse.bind(this));
    
    context.logger.info('{{pluginName}} initialized');
  }

  /**
   * Register request interceptor
   */
  interceptRequest(interceptor: (config: fluxhttpRequestConfig, context: PluginContext) => Promise<fluxhttpRequestConfig> | fluxhttpRequestConfig): void {
    if (this.context?.fluxhttp.interceptors.request) {
      this.context.fluxhttp.interceptors.request.use(
        (config) => interceptor(config, this.context!),
        undefined,
        { runWhen: () => this.config.enabled }
      );
    }
  }

  /**
   * Register response interceptor
   */
  interceptResponse(interceptor: (response: fluxhttpResponse, context: PluginContext) => Promise<fluxhttpResponse> | fluxhttpResponse): void {
    if (this.context?.fluxhttp.interceptors.response) {
      this.context.fluxhttp.interceptors.response.use(
        (response) => interceptor(response, this.context!),
        undefined,
        { runWhen: () => this.config.enabled }
      );
    }
  }

  /**
   * Handle request
   */
  private handleRequest(config: fluxhttpRequestConfig): fluxhttpRequestConfig {
    // Add your request handling logic here
    this.context?.logger.debug('Processing request', {
      method: config.method,
      url: config.url
    });
    
    return config;
  }

  /**
   * Handle response
   */
  private handleResponse(response: fluxhttpResponse): fluxhttpResponse {
    // Add your response handling logic here
    this.context?.logger.debug('Processing response', {
      status: response.status,
      url: response.config.url
    });
    
    return response;
  }

  /**
   * Update configuration
   */
  async updateConfig(config: Partial<{{className}}Config>): Promise<void> {
    this.config = { ...this.config, ...config };
    this.context?.logger.info('{{pluginName}} configuration updated');
  }

  /**
   * Get plugin health status
   */
  async getHealth() {
    return {
      status: this.config.enabled ? 'healthy' as const : 'degraded' as const,
      timestamp: Date.now(),
      details: {
        enabled: this.config.enabled
      }
    };
  }

  /**
   * Get plugin metrics
   */
  async getMetrics() {
    return {
      enabled: this.config.enabled
    };
  }
}

/**
 * {{pluginName}} factory
 */
export function create{{className}}(config?: Partial<{{className}}Config>): {{className}} {
  return new {{className}}(config);
}
`
    },
    {
      path: 'src/types.ts',
      content: `/**
 * @fileoverview Types for {{pluginName}}
 */

// Add your plugin-specific types here
export interface {{className}}Options {
  // Plugin options
}

export interface {{className}}Settings {
  enabled: boolean;
  // Additional settings
}
`
    },
    {
      path: 'tests/{{pluginId}}.test.ts',
      content: `/**
 * @fileoverview Tests for {{pluginName}}
 */

import { {{className}}, create{{className}} } from '../src/{{pluginId}}.plugin';
import type { PluginContext } from '@fluxhttp/plugins';

describe('{{className}}', () => {
  let plugin: {{className}};
  let mockContext: PluginContext;

  beforeEach(() => {
    plugin = create{{className}}();
    mockContext = {
      plugin,
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
    };
  });

  describe('constructor', () => {
    test('should create plugin with default config', () => {
      expect(plugin).toBeDefined();
      expect(plugin.config.enabled).toBe(true);
      expect(plugin.metadata.id).toBe('{{pluginId}}');
      expect(plugin.metadata.name).toBe('{{pluginName}}');
    });

    test('should accept custom config', () => {
      const customPlugin = create{{className}}({
        enabled: false,
        settings: { enabled: false }
      });
      
      expect(customPlugin.config.enabled).toBe(false);
      expect(customPlugin.config.settings.enabled).toBe(false);
    });
  });

  describe('init', () => {
    test('should initialize successfully', async () => {
      await plugin.init(mockContext);
      
      expect(plugin.context).toBe(mockContext);
      expect(mockContext.logger.info).toHaveBeenCalledWith('{{pluginName}} initialized');
    });
  });

  describe('getHealth', () => {
    test('should return healthy status when enabled', async () => {
      plugin.config.enabled = true;
      
      const health = await plugin.getHealth();
      
      expect(health.status).toBe('healthy');
      expect(health.details.enabled).toBe(true);
    });

    test('should return degraded status when disabled', async () => {
      plugin.config.enabled = false;
      
      const health = await plugin.getHealth();
      
      expect(health.status).toBe('degraded');
      expect(health.details.enabled).toBe(false);
    });
  });

  describe('getMetrics', () => {
    test('should return plugin metrics', async () => {
      const metrics = await plugin.getMetrics();
      
      expect(metrics).toEqual({
        enabled: plugin.config.enabled
      });
    });
  });

  describe('updateConfig', () => {
    test('should update configuration', async () => {
      await plugin.updateConfig({
        enabled: false,
        settings: { enabled: false }
      });
      
      expect(plugin.config.enabled).toBe(false);
      expect(plugin.config.settings.enabled).toBe(false);
    });
  });
});
`
    },
    {
      path: 'README.md',
      content: `# {{pluginName}}

{{pluginDescription}}

## Installation

\`\`\`bash
npm install {{pluginId}}
\`\`\`

## Usage

\`\`\`typescript
import { create{{className}} } from '{{pluginId}}';
import { fluxhttp } from '@fluxhttp/core';

// Create plugin instance
const {{pluginId}}Plugin = create{{className}}({
  settings: {
    enabled: true
  }
});

// Register with FluxHTTP
const client = fluxhttp.create();
await client.plugins.register({{pluginId}}Plugin);
\`\`\`

## Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| \`enabled\` | boolean | \`true\` | Whether the plugin is enabled |

## API Reference

### \`{{className}}\`

Main plugin class.

#### Methods

- \`init(context: PluginContext): Promise<void>\` - Initialize the plugin
- \`getHealth(): Promise<PluginHealthStatus>\` - Get plugin health status
- \`getMetrics(): Promise<object>\` - Get plugin metrics
- \`updateConfig(config: Partial<{{className}}Config>): Promise<void>\` - Update plugin configuration

## License

{{license}}
`
    },
    {
      path: 'package.json',
      content: `{
  "name": "{{pluginId}}",
  "version": "1.0.0",
  "description": "{{pluginDescription}}",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "files": [
    "dist"
  ],
  "scripts": {
    "build": "tsc",
    "test": "jest",
    "test:watch": "jest --watch",
    "lint": "eslint src/**/*.ts",
    "lint:fix": "eslint src/**/*.ts --fix"
  },
  "keywords": [
    "fluxhttp",
    "plugin",
    "{{pluginId}}"
  ],
  "author": "{{authorName}}{{#if authorEmail}} <{{authorEmail}}>{{/if}}",
  "license": "{{license}}",
  "peerDependencies": {
    "@fluxhttp/core": "^1.0.0"
  },
  "devDependencies": {
    "@types/jest": "^29.0.0",
    "@typescript-eslint/eslint-plugin": "^6.0.0",
    "@typescript-eslint/parser": "^6.0.0",
    "eslint": "^8.0.0",
    "jest": "^29.0.0",
    "typescript": "^5.0.0"
  }
}
`
    }
  ],
  examples: [
    'Basic plugin with request/response interceptors',
    'Plugin with configuration validation',
    'Plugin with lifecycle hooks'
  ]
});

/**
 * Authentication plugin template
 */
PluginTemplate.register({
  name: 'auth',
  description: 'Authentication plugin template',
  type: 'auth' as PluginType,
  variables: [
    {
      name: 'pluginId',
      type: 'string',
      description: 'Plugin identifier',
      required: true,
      pattern: '^[a-z][a-z0-9-]*$'
    },
    {
      name: 'authType',
      type: 'string',
      description: 'Authentication type (bearer, basic, oauth2)',
      default: 'bearer'
    },
    {
      name: 'className',
      type: 'string',
      description: 'Plugin class name',
      required: true
    }
  ],
  files: [
    {
      path: 'src/{{pluginId}}.plugin.ts',
      content: `// Authentication plugin implementation
// Supports {{authType}} authentication
export class {{className}} implements Plugin {
  // Implementation with {{authType}} support
}`
    }
  ]
});

/**
 * Cache plugin template
 */
PluginTemplate.register({
  name: 'cache',
  description: 'Cache plugin template',
  type: 'cache' as PluginType,
  variables: [
    {
      name: 'pluginId',
      type: 'string',
      description: 'Plugin identifier',
      required: true
    },
    {
      name: 'cacheStrategy',
      type: 'string',
      description: 'Cache strategy (cache-first, network-first)',
      default: 'cache-first'
    },
    {
      name: 'className',
      type: 'string',
      description: 'Plugin class name',
      required: true
    }
  ],
  files: [
    {
      path: 'src/{{pluginId}}.plugin.ts',
      content: `// Cache plugin implementation
// Uses {{cacheStrategy}} strategy
export class {{className}} implements Plugin {
  // Implementation with {{cacheStrategy}} caching
}`
    }
  ]
});

/**
 * Logging plugin template
 */
PluginTemplate.register({
  name: 'logging',
  description: 'Logging plugin template',
  type: 'developer' as PluginType,
  variables: [
    {
      name: 'pluginId',
      type: 'string',
      description: 'Plugin identifier',
      required: true
    },
    {
      name: 'logLevel',
      type: 'string',
      description: 'Default log level',
      default: 'info'
    },
    {
      name: 'className',
      type: 'string',
      description: 'Plugin class name',
      required: true
    }
  ],
  files: [
    {
      path: 'src/{{pluginId}}.plugin.ts',
      content: `// Logging plugin implementation
// Default log level: {{logLevel}}
export class {{className}} implements Plugin {
  // Implementation with {{logLevel}} logging
}`
    }
  ]
});

export default PluginTemplate;