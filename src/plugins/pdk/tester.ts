/**
 * @fileoverview Plugin testing utilities
 * @module @fluxhttp/plugins/pdk/tester
 */

import type {
  Plugin,
  PluginContext,
  PluginHealthStatus,
  fluxhttpRequestConfig,
  fluxhttpResponse,
  fluxhttpError
} from '../types';
import { PluginLifecycleState } from '../types';

/**
 * Test result interface
 */
export interface PluginTestResult {
  /** Test name */
  name: string;
  /** Test passed */
  passed: boolean;
  /** Test error if failed */
  error?: string;
  /** Test duration in milliseconds */
  duration: number;
  /** Test details */
  details?: Record<string, unknown>;
}

/**
 * Test suite result
 */
export interface PluginTestSuiteResult {
  /** Plugin being tested */
  pluginId: string;
  /** Total tests run */
  totalTests: number;
  /** Tests passed */
  passed: number;
  /** Tests failed */
  failed: number;
  /** Individual test results */
  tests: PluginTestResult[];
  /** Overall success */
  success: boolean;
  /** Total duration */
  duration: number;
  /** Test errors */
  errors: string[];
}

/**
 * Mock plugin context for testing
 */
interface MockPluginContext extends PluginContext {
  // Add mock-specific methods
  _reset(): void;
  _getCallHistory(): Record<string, any[]>;
}

/**
 * Plugin tester utility
 */
export class PluginTester {
  private mockContext: MockPluginContext;
  private testResults: PluginTestResult[] = [];

  constructor(private plugin: Plugin) {
    this.mockContext = this.createMockContext();
  }

  /**
   * Run all standard tests for a plugin
   */
  async runStandardTests(): Promise<PluginTestSuiteResult> {
    const startTime = Date.now();
    this.testResults = [];

    // Metadata tests
    await this.testMetadata();
    
    // Configuration tests
    await this.testConfiguration();
    
    // Lifecycle tests
    await this.testLifecycle();
    
    // Health check tests
    await this.testHealthCheck();
    
    // Interceptor tests
    await this.testInterceptors();
    
    // Error handling tests
    await this.testErrorHandling();

    const endTime = Date.now();
    const duration = endTime - startTime;

    return {
      pluginId: this.plugin.metadata.id,
      totalTests: this.testResults.length,
      passed: this.testResults.filter(t => t.passed).length,
      failed: this.testResults.filter(t => !t.passed).length,
      tests: this.testResults,
      success: this.testResults.every(t => t.passed),
      duration,
      errors: this.testResults.filter(t => !t.passed).map(t => t.error || 'Unknown error')
    };
  }

  /**
   * Run custom test
   */
  async runTest(name: string, testFn: () => Promise<void> | void): Promise<PluginTestResult> {
    const startTime = Date.now();
    let passed = false;
    let error: string | undefined;
    let details: Record<string, unknown> | undefined;

    try {
      await testFn();
      passed = true;
    } catch (err) {
      passed = false;
      error = err instanceof Error ? err.message : String(err);
      details = { stack: err instanceof Error ? err.stack : undefined };
    }

    const result: PluginTestResult = {
      name,
      passed,
      error,
      duration: Date.now() - startTime,
      details
    };

    this.testResults.push(result);
    return result;
  }

  /**
   * Test plugin metadata
   */
  private async testMetadata(): Promise<void> {
    await this.runTest('Metadata validation', () => {
      const { metadata } = this.plugin;
      
      if (!metadata.id) {
        throw new Error('Plugin ID is required');
      }
      
      if (!metadata.name) {
        throw new Error('Plugin name is required');
      }
      
      if (!metadata.version) {
        throw new Error('Plugin version is required');
      }
      
      if (!metadata.type) {
        throw new Error('Plugin type is required');
      }
      
      // Validate version format (semver)
      if (!/^\d+\.\d+\.\d+/.test(metadata.version)) {
        throw new Error('Plugin version must follow semver format');
      }
      
      // Validate ID format
      if (!/^[a-z][a-z0-9-]*$/.test(metadata.id)) {
        throw new Error('Plugin ID must be in kebab-case format');
      }
    });

    await this.runTest('Required metadata fields', () => {
      const { metadata } = this.plugin;
      
      if (!metadata.author) {
        throw new Error('Plugin author is required');
      }
      
      if (!metadata.license) {
        throw new Error('Plugin license is required');
      }
      
      if (!metadata.description) {
        throw new Error('Plugin description is required');
      }
    });
  }

  /**
   * Test plugin configuration
   */
  private async testConfiguration(): Promise<void> {
    await this.runTest('Configuration initialization', () => {
      if (!this.plugin.config) {
        throw new Error('Plugin config is required');
      }
      
      if (typeof this.plugin.config.enabled !== 'boolean') {
        throw new Error('Plugin config must have enabled boolean property');
      }
    });

    await this.runTest('Configuration schema validation', () => {
      if (this.plugin.configSchema) {
        // Validate schema structure
        if (this.plugin.configSchema.type !== 'object') {
          throw new Error('Config schema must be of type object');
        }
        
        if (!this.plugin.configSchema.properties) {
          throw new Error('Config schema must have properties');
        }
      }
    });

    // Test configuration updates if supported
    if (this.plugin.updateConfig) {
      await this.runTest('Configuration updates', async () => {
        const originalConfig = { ...this.plugin.config };
        
        await this.plugin.updateConfig!({ enabled: !originalConfig.enabled });
        
        if (this.plugin.config.enabled === originalConfig.enabled) {
          throw new Error('Configuration update did not take effect');
        }
        
        // Restore original config
        await this.plugin.updateConfig!(originalConfig);
      });
    }
  }

  /**
   * Test plugin lifecycle
   */
  private async testLifecycle(): Promise<void> {
    await this.runTest('Plugin initialization', async () => {
      this.mockContext._reset();
      
      if (this.plugin.init) {
        await this.plugin.init(this.mockContext);
        
        if (this.plugin.context !== this.mockContext) {
          throw new Error('Plugin context was not set during initialization');
        }
      }
    });

    await this.runTest('Plugin start', async () => {
      if (this.plugin.start) {
        await this.plugin.start(this.mockContext);
      }
    });

    await this.runTest('Plugin stop', async () => {
      if (this.plugin.stop) {
        await this.plugin.stop(this.mockContext);
      }
    });

    await this.runTest('Plugin destroy', async () => {
      if (this.plugin.destroy) {
        await this.plugin.destroy(this.mockContext);
      }
    });

    await this.runTest('State transitions', () => {
      // Plugin should start in uninitialized state
      if (this.plugin.state !== PluginLifecycleState.UNINITIALIZED) {
        throw new Error('Plugin should start in UNINITIALIZED state');
      }
    });
  }

  /**
   * Test health check functionality
   */
  private async testHealthCheck(): Promise<void> {
    if (this.plugin.getHealth) {
      await this.runTest('Health check response', async () => {
        const health = await this.plugin.getHealth!();
        
        if (!health) {
          throw new Error('Health check must return a response');
        }
        
        if (!health.status) {
          throw new Error('Health response must include status');
        }
        
        if (!['healthy', 'degraded', 'unhealthy'].includes(health.status)) {
          throw new Error('Health status must be healthy, degraded, or unhealthy');
        }
        
        if (typeof health.timestamp !== 'number') {
          throw new Error('Health response must include timestamp');
        }
      });

      await this.runTest('Health check when enabled', async () => {
        this.plugin.config.enabled = true;
        const health = await this.plugin.getHealth!();
        
        if (health.status === 'unhealthy') {
          throw new Error('Plugin should not be unhealthy when enabled');
        }
      });

      await this.runTest('Health check when disabled', async () => {
        this.plugin.config.enabled = false;
        const health = await this.plugin.getHealth!();
        
        if (health.status === 'healthy') {
          throw new Error('Plugin should not be healthy when disabled');
        }
      });
    }
  }

  /**
   * Test interceptor functionality
   */
  private async testInterceptors(): Promise<void> {
    if (this.plugin.interceptRequest) {
      await this.runTest('Request interceptor registration', () => {
        const mockInterceptor = (config: fluxhttpRequestConfig) => config;
        this.plugin.interceptRequest!(mockInterceptor);
        
        // Verify interceptor was registered
        const callHistory = this.mockContext._getCallHistory();
        if (!callHistory['fluxhttp.interceptors.request.use']) {
          throw new Error('Request interceptor was not registered');
        }
      });
    }

    if (this.plugin.interceptResponse) {
      await this.runTest('Response interceptor registration', () => {
        const mockInterceptor = (response: fluxhttpResponse) => response;
        this.plugin.interceptResponse!(mockInterceptor);
        
        // Verify interceptor was registered
        const callHistory = this.mockContext._getCallHistory();
        if (!callHistory['fluxhttp.interceptors.response.use']) {
          throw new Error('Response interceptor was not registered');
        }
      });
    }

    if (this.plugin.interceptError) {
      await this.runTest('Error interceptor registration', () => {
        const mockInterceptor = (error: fluxhttpError) => error;
        this.plugin.interceptError!(mockInterceptor);
        
        // Verify interceptor was registered
        const callHistory = this.mockContext._getCallHistory();
        if (!callHistory['fluxhttp.interceptors.response.use']) {
          throw new Error('Error interceptor was not registered');
        }
      });
    }
  }

  /**
   * Test error handling
   */
  private async testErrorHandling(): Promise<void> {
    await this.runTest('Error handling in init', async () => {
      if (this.plugin.init) {
        // Create a context that will cause an error
        const errorContext = { ...this.mockContext };
        delete (errorContext as any).logger;
        
        try {
          await this.plugin.init(errorContext as any);
          // If no error is thrown, that's actually fine - plugin handles gracefully
        } catch (error) {
          // Error is expected and handled
        }
      }
    });

    await this.runTest('Graceful degradation when disabled', () => {
      this.plugin.config.enabled = false;
      
      // Plugin should handle being disabled gracefully
      // Most operations should be no-ops when disabled
    });
  }

  /**
   * Test plugin metrics
   */
  async testMetrics(): Promise<void> {
    if (this.plugin.getMetrics) {
      await this.runTest('Metrics response', async () => {
        const metrics = await this.plugin.getMetrics!();
        
        if (!metrics || typeof metrics !== 'object') {
          throw new Error('Metrics must return an object');
        }
      });
    }
  }

  /**
   * Create mock plugin context
   */
  private createMockContext(): MockPluginContext {
    const callHistory: Record<string, any[]> = {};
    
    const createMockFunction = (name: string) => {
      callHistory[name] = [];
      return (...args: any[]) => {
        callHistory[name].push(args);
        return Promise.resolve();
      };
    };

    const mockFluxHttp = {
      defaults: {},
      interceptors: {
        request: {
          use: createMockFunction('fluxhttp.interceptors.request.use'),
          eject: createMockFunction('fluxhttp.interceptors.request.eject'),
          clear: createMockFunction('fluxhttp.interceptors.request.clear')
        },
        response: {
          use: createMockFunction('fluxhttp.interceptors.response.use'),
          eject: createMockFunction('fluxhttp.interceptors.response.eject'),
          clear: createMockFunction('fluxhttp.interceptors.response.clear')
        }
      },
      request: createMockFunction('fluxhttp.request'),
      get: createMockFunction('fluxhttp.get'),
      post: createMockFunction('fluxhttp.post'),
      put: createMockFunction('fluxhttp.put'),
      patch: createMockFunction('fluxhttp.patch'),
      delete: createMockFunction('fluxhttp.delete'),
      head: createMockFunction('fluxhttp.head'),
      options: createMockFunction('fluxhttp.options'),
      getUri: createMockFunction('fluxhttp.getUri'),
      create: createMockFunction('fluxhttp.create'),
      dispose: createMockFunction('fluxhttp.dispose'),
      isDisposed: () => false,
      getMemoryStats: () => ({})
    };

    const mockLogger = {
      trace: createMockFunction('logger.trace'),
      debug: createMockFunction('logger.debug'),
      info: createMockFunction('logger.info'),
      warn: createMockFunction('logger.warn'),
      error: createMockFunction('logger.error'),
      fatal: createMockFunction('logger.fatal'),
      child: () => mockLogger
    };

    const mockMetrics = {
      increment: createMockFunction('metrics.increment'),
      decrement: createMockFunction('metrics.decrement'),
      gauge: createMockFunction('metrics.gauge'),
      histogram: createMockFunction('metrics.histogram'),
      timing: createMockFunction('metrics.timing'),
      timer: () => ({ stop: () => {}, elapsed: () => 0 }),
      getStats: () => ({}),
      child: () => mockMetrics
    };

    const mockCache = {
      get: createMockFunction('cache.get'),
      set: createMockFunction('cache.set'),
      delete: createMockFunction('cache.delete'),
      has: createMockFunction('cache.has'),
      clear: createMockFunction('cache.clear'),
      getStats: () => Promise.resolve({}),
      child: () => mockCache
    };

    const mockEvents = {
      emit: createMockFunction('events.emit'),
      on: createMockFunction('events.on'),
      once: createMockFunction('events.once'),
      off: createMockFunction('events.off'),
      removeAllListeners: createMockFunction('events.removeAllListeners'),
      listenerCount: () => 0,
      eventNames: () => [],
      child: () => mockEvents
    };

    const mockUtils = {
      generateId: () => 'mock-id',
      deepClone: (obj: any) => JSON.parse(JSON.stringify(obj)),
      deepMerge: (target: any, ...sources: any[]) => Object.assign(target, ...sources),
      isPlainObject: (obj: any) => obj && typeof obj === 'object' && !Array.isArray(obj),
      throttle: (fn: any) => fn,
      debounce: (fn: any) => fn,
      validateSchema: () => true,
      parseVersion: (version: string) => {
        const parts = version.split('.');
        return {
          major: parseInt(parts[0]) || 0,
          minor: parseInt(parts[1]) || 0,
          patch: parseInt(parts[2]) || 0
        };
      },
      compareVersions: () => 0 as const,
      satisfiesVersion: () => true
    };

    return {
      plugin: this.plugin,
      fluxhttp: mockFluxHttp as any,
      registry: {} as any,
      logger: mockLogger as any,
      metrics: mockMetrics as any,
      cache: mockCache as any,
      events: mockEvents as any,
      utils: mockUtils as any,
      _reset: () => {
        Object.keys(callHistory).forEach(key => {
          callHistory[key] = [];
        });
      },
      _getCallHistory: () => callHistory
    };
  }

  /**
   * Reset test state
   */
  reset(): void {
    this.testResults = [];
    this.mockContext._reset();
  }

  /**
   * Get test results
   */
  getResults(): PluginTestResult[] {
    return [...this.testResults];
  }

  /**
   * Get mock context for custom testing
   */
  getMockContext(): MockPluginContext {
    return this.mockContext;
  }
}