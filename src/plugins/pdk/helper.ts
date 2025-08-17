/**
 * @fileoverview Plugin development helper utilities
 * @module @fluxhttp/plugins/pdk/helper
 */

import type {
  Plugin,
  PluginConfig,
  PluginMetadata,
  fluxhttpRequestConfig,
  fluxhttpResponse,
  fluxhttpError
} from '../types';

/**
 * Plugin development helper utilities
 */
export class PluginHelper {
  /**
   * Create request configuration for testing
   */
  createMockRequest(overrides: Partial<fluxhttpRequestConfig> = {}): fluxhttpRequestConfig {
    return {
      method: 'GET',
      url: '/test',
      headers: {},
      params: {},
      timeout: 5000,
      ...overrides
    };
  }

  /**
   * Create response for testing
   */
  createMockResponse(overrides: Partial<fluxhttpResponse> = {}): fluxhttpResponse {
    const config = this.createMockRequest(overrides.config);
    
    return {
      data: { success: true },
      status: 200,
      statusText: 'OK',
      headers: {},
      config,
      ...overrides
    };
  }

  /**
   * Create error for testing
   */
  createMockError(overrides: Partial<fluxhttpError> = {}): fluxhttpError {
    const config = this.createMockRequest(overrides.config);
    
    const error = new Error(overrides.message || 'Mock error') as fluxhttpError;
    error.config = config;
    error.code = overrides.code || 'MOCK_ERROR';
    error.isfluxhttpError = true;
    error.toJSON = () => ({
      message: error.message,
      code: error.code,
      config: error.config
    });
    
    if (overrides.response) {
      error.response = overrides.response;
    }
    
    return error;
  }

  /**
   * Validate plugin metadata
   */
  validatePluginMetadata(metadata: PluginMetadata): string[] {
    const errors: string[] = [];

    // Required fields
    if (!metadata.id) errors.push('Plugin ID is required');
    if (!metadata.name) errors.push('Plugin name is required');
    if (!metadata.version) errors.push('Plugin version is required');
    if (!metadata.type) errors.push('Plugin type is required');

    // Format validation
    if (metadata.id && !/^[a-z][a-z0-9-]*$/.test(metadata.id)) {
      errors.push('Plugin ID must be in kebab-case format');
    }

    if (metadata.version && !/^\d+\.\d+\.\d+/.test(metadata.version)) {
      errors.push('Plugin version must follow semver format');
    }

    // Optional but recommended fields
    if (!metadata.description) errors.push('Plugin description is recommended');
    if (!metadata.author) errors.push('Plugin author is recommended');
    if (!metadata.license) errors.push('Plugin license is recommended');

    return errors;
  }

  /**
   * Generate plugin skeleton
   */
  generatePluginSkeleton(metadata: Partial<PluginMetadata>): string {
    const className = this.generateClassName(metadata.id || 'MyPlugin');
    
    return `/**
 * @fileoverview ${metadata.description || 'Plugin description'}
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

export interface ${className}Config extends PluginConfig {
  settings: {
    // Add your plugin settings here
  };
}

export class ${className} implements Plugin {
  readonly metadata: PluginMetadata = {
    id: '${metadata.id || 'my-plugin'}',
    name: '${metadata.name || 'My Plugin'}',
    version: '${metadata.version || '1.0.0'}',
    type: PluginType.FEATURE,
    description: '${metadata.description || 'Plugin description'}',
    author: {
      name: '${metadata.author?.name || 'Author'}'
    },
    license: '${metadata.license || 'MIT'}',
    keywords: [],
    capabilities: {},
    priority: PluginPriority.NORMAL
  };

  state = PluginLifecycleState.UNINITIALIZED;
  config: ${className}Config;
  context?: PluginContext;

  constructor(config: Partial<${className}Config> = {}) {
    this.config = {
      enabled: true,
      settings: {},
      ...config
    } as ${className}Config;
  }

  async init(context: PluginContext): Promise<void> {
    this.context = context;
    // Initialize your plugin here
  }

  // Add your plugin methods here
}

export function create${className}(config?: Partial<${className}Config>): ${className} {
  return new ${className}(config);
}
`;
  }

  /**
   * Generate test skeleton
   */
  generateTestSkeleton(metadata: Partial<PluginMetadata>): string {
    const className = this.generateClassName(metadata.id || 'MyPlugin');
    
    return `/**
 * @fileoverview Tests for ${metadata.name || 'Plugin'}
 */

import { ${className}, create${className} } from '../src/${metadata.id || 'my-plugin'}.plugin';
import { PluginTester } from '@fluxhttp/plugins/pdk';

describe('${className}', () => {
  let plugin: ${className};
  let tester: PluginTester;

  beforeEach(() => {
    plugin = create${className}();
    tester = new PluginTester(plugin);
  });

  describe('Standard Tests', () => {
    test('should pass all standard plugin tests', async () => {
      const result = await tester.runStandardTests();
      
      if (!result.success) {
        console.error('Test failures:', result.errors);
      }
      
      expect(result.success).toBe(true);
      expect(result.failed).toBe(0);
    });
  });

  describe('Custom Tests', () => {
    test('should initialize with default config', () => {
      expect(plugin.config.enabled).toBe(true);
      expect(plugin.metadata.id).toBe('${metadata.id || 'my-plugin'}');
    });

    // Add your custom tests here
  });
});
`;
  }

  /**
   * Generate class name from plugin ID
   */
  generateClassName(pluginId: string): string {
    return pluginId
      .split('-')
      .map(part => part.charAt(0).toUpperCase() + part.slice(1))
      .join('') + 'Plugin';
  }

  /**
   * Analyze plugin for common issues
   */
  analyzePlugin(plugin: Plugin): { issues: string[]; suggestions: string[] } {
    const issues: string[] = [];
    const suggestions: string[] = [];

    // Check metadata
    const metadataErrors = this.validatePluginMetadata(plugin.metadata);
    issues.push(...metadataErrors);

    // Check configuration
    if (!plugin.config) {
      issues.push('Plugin must have a config property');
    } else {
      if (typeof plugin.config.enabled !== 'boolean') {
        issues.push('Plugin config must have an enabled boolean property');
      }
    }

    // Check lifecycle methods
    if (!plugin.init) {
      suggestions.push('Consider implementing an init method for plugin initialization');
    }

    if (!plugin.getHealth) {
      suggestions.push('Consider implementing getHealth method for monitoring');
    }

    if (!plugin.getMetrics) {
      suggestions.push('Consider implementing getMetrics method for observability');
    }

    // Check interceptor methods
    if (!plugin.interceptRequest && !plugin.interceptResponse && !plugin.interceptError) {
      suggestions.push('Plugin should implement at least one interceptor method');
    }

    // Check configuration schema
    if (!plugin.configSchema) {
      suggestions.push('Consider providing a configuration schema for validation');
    }

    // Check hooks
    if (!plugin.hooks || Object.keys(plugin.hooks).length === 0) {
      suggestions.push('Consider implementing lifecycle hooks for better integration');
    }

    return { issues, suggestions };
  }

  /**
   * Generate documentation for plugin
   */
  generatePluginDocs(plugin: Plugin): string {
    const { metadata, configSchema } = plugin;
    
    return `# ${metadata.name}

${metadata.description}

## Installation

\`\`\`bash
npm install ${metadata.id}
\`\`\`

## Usage

\`\`\`typescript
import { create${this.generateClassName(metadata.id)} } from '${metadata.id}';

const plugin = create${this.generateClassName(metadata.id)}({
  enabled: true,
  settings: {
    // Configure your plugin
  }
});

// Register with FluxHTTP
client.plugins.register(plugin);
\`\`\`

## Configuration

${this.generateConfigDocs(configSchema)}

## API Reference

### Methods

- \`init(context: PluginContext): Promise<void>\` - Initialize the plugin
- \`getHealth(): Promise<PluginHealthStatus>\` - Get plugin health status  
- \`getMetrics(): Promise<object>\` - Get plugin metrics

### Metadata

- **ID**: ${metadata.id}
- **Version**: ${metadata.version}
- **Type**: ${metadata.type}
- **Author**: ${metadata.author?.name}${metadata.author?.email ? ` <${metadata.author.email}>` : ''}
- **License**: ${metadata.license}

## Keywords

${metadata.keywords?.join(', ') || 'None'}

## Dependencies

${metadata.dependencies?.map(dep => `- ${dep.id}@${dep.version}`).join('\n') || 'None'}
`;
  }

  /**
   * Generate configuration documentation
   */
  private generateConfigDocs(schema?: any): string {
    if (!schema || !schema.properties) {
      return 'No configuration options documented.';
    }

    const docs: string[] = [];
    docs.push('| Option | Type | Default | Description |');
    docs.push('|--------|------|---------|-------------|');

    for (const [key, prop] of Object.entries(schema.properties)) {
      const p = prop as any;
      docs.push(`| \`${key}\` | ${p.type} | \`${p.default || 'undefined'}\` | ${p.description || 'No description'} |`);
    }

    return docs.join('\n');
  }

  /**
   * Check plugin compatibility with FluxHTTP version
   */
  checkCompatibility(plugin: Plugin, fluxhttpVersion: string): { compatible: boolean; issues: string[] } {
    const issues: string[] = [];
    const { metadata } = plugin;

    if (metadata.minFluxHttpVersion) {
      if (this.compareVersions(fluxhttpVersion, metadata.minFluxHttpVersion) < 0) {
        issues.push(`Plugin requires FluxHTTP ${metadata.minFluxHttpVersion} or higher, but ${fluxhttpVersion} is installed`);
      }
    }

    if (metadata.maxFluxHttpVersion) {
      if (this.compareVersions(fluxhttpVersion, metadata.maxFluxHttpVersion) > 0) {
        issues.push(`Plugin supports FluxHTTP up to ${metadata.maxFluxHttpVersion}, but ${fluxhttpVersion} is installed`);
      }
    }

    return {
      compatible: issues.length === 0,
      issues
    };
  }

  /**
   * Compare semver versions
   */
  private compareVersions(a: string, b: string): number {
    const parseVersion = (version: string) => {
      const parts = version.split('.').map(Number);
      return { major: parts[0] || 0, minor: parts[1] || 0, patch: parts[2] || 0 };
    };

    const versionA = parseVersion(a);
    const versionB = parseVersion(b);

    if (versionA.major !== versionB.major) {
      return versionA.major > versionB.major ? 1 : -1;
    }

    if (versionA.minor !== versionB.minor) {
      return versionA.minor > versionB.minor ? 1 : -1;
    }

    if (versionA.patch !== versionB.patch) {
      return versionA.patch > versionB.patch ? 1 : -1;
    }

    return 0;
  }

  /**
   * Common plugin patterns and recipes
   */
  getCommonPatterns(): Record<string, string> {
    return {
      'Basic Request Interceptor': `
interceptRequest((config, context) => {
  // Modify request
  config.headers = { ...config.headers, 'X-Custom': 'value' };
  return config;
});`,

      'Response Processing': `
interceptResponse((response, context) => {
  // Process response
  context.logger.info('Response received', { status: response.status });
  return response;
});`,

      'Error Handling': `
interceptError((error, context) => {
  // Handle errors
  context.logger.error('Request failed', { error: error.message });
  return error;
});`,

      'Configuration Validation': `
validateConfig(config) {
  if (!config.settings.apiKey) {
    throw new Error('API key is required');
  }
  return true;
}`,

      'Health Check': `
async getHealth() {
  return {
    status: this.config.enabled ? 'healthy' : 'degraded',
    timestamp: Date.now(),
    details: { enabled: this.config.enabled }
  };
}`,

      'Metrics Collection': `
// In interceptors
context.metrics.increment('requests.total');
context.metrics.timing('requests.duration', duration);`,

      'Caching Pattern': `
// Check cache first
const cached = await context.cache.get(cacheKey);
if (cached) return cached;

// Cache result
await context.cache.set(cacheKey, response, ttl);`,

      'Event Handling': `
// Emit events
context.events.emit('plugin:event', data);

// Listen to events
context.events.on('fluxhttp:request', this.handleRequest);`
    };
  }

  /**
   * Get plugin development tips
   */
  getDevelopmentTips(): string[] {
    return [
      'Always validate plugin configuration in the constructor',
      'Use lifecycle hooks for proper resource management',
      'Implement health checks for monitoring',
      'Add comprehensive logging for debugging',
      'Use metrics to track plugin performance',
      'Handle errors gracefully and provide meaningful messages',
      'Follow semantic versioning for plugin releases',
      'Write comprehensive tests including edge cases',
      'Document configuration options clearly',
      'Consider backward compatibility when updating',
      'Use TypeScript for better type safety',
      'Implement proper cleanup in stop/destroy methods',
      'Cache expensive operations when possible',
      'Use events for loose coupling between components',
      'Validate dependencies and check compatibility'
    ];
  }
}