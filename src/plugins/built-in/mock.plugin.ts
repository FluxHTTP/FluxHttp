/**
 * @fileoverview Mock plugin for FluxHTTP
 * @module @fluxhttp/plugins/built-in/mock
 */

import type {
  Plugin,
  PluginConfig,
  PluginContext,
  PluginMetadata,
  PluginConfigSchema,
  fluxhttpRequestConfig,
  fluxhttpResponse,
  Headers
} from '../types';
import { PluginLifecycleState, PluginType, PluginPriority } from '../types';

/**
 * Mock response configuration
 */
export interface MockResponse {
  /** Response status code */
  status?: number;
  /** Response status text */
  statusText?: string;
  /** Response headers */
  headers?: Headers;
  /** Response data */
  data?: unknown;
  /** Response delay in milliseconds */
  delay?: number;
  /** Probability of this response (0-1) */
  probability?: number;
  /** Response function for dynamic mocking */
  response?: (config: fluxhttpRequestConfig) => MockResponse | Promise<MockResponse>;
}

/**
 * Mock rule configuration
 */
export interface MockRule {
  /** Rule name for debugging */
  name?: string;
  /** URL pattern to match (string or regex) */
  url?: string | RegExp;
  /** HTTP method to match */
  method?: string | string[];
  /** Headers to match */
  headers?: Record<string, string | RegExp>;
  /** Query parameters to match */
  params?: Record<string, string | RegExp | number>;
  /** Request body to match */
  body?: unknown;
  /** Custom matcher function */
  matcher?: (config: fluxhttpRequestConfig) => boolean;
  /** Mock response configuration */
  response: MockResponse | MockResponse[];
  /** Rule enabled */
  enabled?: boolean;
  /** Rule priority (higher numbers have priority) */
  priority?: number;
  /** Rule times to use before disabling */
  times?: number;
  /** Rule tags for organization */
  tags?: string[];
  /** Rule description */
  description?: string;
}

/**
 * Mock scenario configuration
 */
export interface MockScenario {
  /** Scenario name */
  name: string;
  /** Scenario description */
  description?: string;
  /** Rules in this scenario */
  rules: MockRule[];
  /** Scenario enabled */
  enabled?: boolean;
  /** Scenario tags */
  tags?: string[];
}

/**
 * Mock plugin configuration
 */
export interface MockPluginConfig extends PluginConfig {
  settings: {
    /** Global mock enabled */
    enabled?: boolean;
    /** Mock rules */
    rules?: MockRule[];
    /** Mock scenarios */
    scenarios?: MockScenario[];
    /** Active scenario name */
    activeScenario?: string;
    /** Passthrough unmatched requests */
    passthrough?: boolean;
    /** Default delay for all mocks */
    defaultDelay?: number;
    /** Default response for unmatched requests */
    defaultResponse?: MockResponse;
    /** Record real requests for mock generation */
    recording?: {
      enabled: boolean;
      outputFile?: string;
      maxRecords?: number;
      includeHeaders?: boolean;
      includeBody?: boolean;
    };
    /** Proxy configuration for passthrough requests */
    proxy?: {
      enabled: boolean;
      target: string;
      changeOrigin?: boolean;
      pathRewrite?: Record<string, string>;
    };
    /** Mock statistics */
    stats?: {
      enabled: boolean;
      detailed: boolean;
    };
    /** Development helpers */
    dev?: {
      /** Log matched rules */
      logMatches: boolean;
      /** Log unmatched requests */
      logUnmatched: boolean;
      /** Validate response schemas */
      validateResponses: boolean;
    };
  };
}

/**
 * Mock statistics
 */
interface MockStats {
  /** Total requests processed */
  totalRequests: number;
  /** Total mocked requests */
  mockedRequests: number;
  /** Total passthrough requests */
  passthroughRequests: number;
  /** Mock hit rate */
  hitRate: number;
  /** Rule usage statistics */
  ruleStats: Record<string, {
    hits: number;
    lastUsed: number;
    averageDelay: number;
  }>;
}

/**
 * Recorded request for mock generation
 */
interface RecordedRequest {
  /** Request configuration */
  config: fluxhttpRequestConfig;
  /** Response data */
  response: fluxhttpResponse;
  /** Timestamp */
  timestamp: number;
  /** Request ID */
  id: string;
}

/**
 * Mock plugin implementation
 */
export class MockPlugin implements Plugin {
  readonly metadata: PluginMetadata = {
    id: 'mock',
    name: 'Mock Plugin',
    version: '1.0.0',
    type: PluginType.DEVELOPER,
    description: 'Provides HTTP request mocking capabilities for development and testing',
    author: {
      name: 'FluxHTTP Team',
      email: 'team@fluxhttp.dev'
    },
    license: 'MIT',
    keywords: ['mock', 'testing', 'development', 'stub', 'fake'],
    capabilities: {
      canModifyRequest: true,
      canModifyResponse: true,
      canMock: true
    },
    priority: PluginPriority.HIGH // High priority to intercept before real requests
  };

  readonly configSchema: PluginConfigSchema = {
    type: 'object',
    properties: {
      enabled: { type: 'boolean', default: true },
      settings: {
        type: 'object',
        properties: {
          enabled: { type: 'boolean', default: true },
          passthrough: { type: 'boolean', default: false },
          defaultDelay: { type: 'number', default: 100, minimum: 0 },
          rules: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                url: { type: 'string' },
                method: { type: 'string' },
                enabled: { type: 'boolean', default: true },
                priority: { type: 'number', default: 0 },
                times: { type: 'number', minimum: 1 }
              }
            }
          },
          recording: {
            type: 'object',
            properties: {
              enabled: { type: 'boolean', default: false },
              maxRecords: { type: 'number', default: 1000 },
              includeHeaders: { type: 'boolean', default: true },
              includeBody: { type: 'boolean', default: true }
            }
          },
          stats: {
            type: 'object',
            properties: {
              enabled: { type: 'boolean', default: true },
              detailed: { type: 'boolean', default: false }
            }
          },
          dev: {
            type: 'object',
            properties: {
              logMatches: { type: 'boolean', default: true },
              logUnmatched: { type: 'boolean', default: true },
              validateResponses: { type: 'boolean', default: false }
            }
          }
        }
      }
    }
  };

  state = PluginLifecycleState.UNINITIALIZED;
  config: MockPluginConfig;
  context?: PluginContext;

  private stats: MockStats = {
    totalRequests: 0,
    mockedRequests: 0,
    passthroughRequests: 0,
    hitRate: 0,
    ruleStats: {}
  };

  private recordedRequests: RecordedRequest[] = [];
  private ruleUsageCount = new Map<string, number>();

  constructor(config: Partial<MockPluginConfig> = {}) {
    this.config = {
      enabled: true,
      settings: {
        enabled: true,
        rules: [],
        scenarios: [],
        passthrough: false,
        defaultDelay: 100,
        recording: {
          enabled: false,
          maxRecords: 1000,
          includeHeaders: true,
          includeBody: true
        },
        proxy: {
          enabled: false,
          target: '',
          changeOrigin: true,
          pathRewrite: {}
        },
        stats: {
          enabled: true,
          detailed: false
        },
        dev: {
          logMatches: true,
          logUnmatched: true,
          validateResponses: false
        },
        ...config.settings
      },
      ...config
    } as MockPluginConfig;
  }

  /**
   * Initialize plugin
   */
  async init(context: PluginContext): Promise<void> {
    this.context = context;
    
    // Register request interceptor with high priority
    this.interceptRequest(this.handleMockRequest.bind(this));
    
    // Register response interceptor for recording
    if (this.config.settings.recording?.enabled) {
      this.interceptResponse(this.handleRecording.bind(this));
    }
    
    context.logger.info('Mock plugin initialized', {
      rules: this.config.settings.rules?.length || 0,
      scenarios: this.config.settings.scenarios?.length || 0,
      recording: this.config.settings.recording?.enabled,
      passthrough: this.config.settings.passthrough
    });
  }

  /**
   * Register request interceptor
   */
  interceptRequest(interceptor: (config: fluxhttpRequestConfig, context: PluginContext) => Promise<fluxhttpRequestConfig> | fluxhttpRequestConfig): void {
    if (this.context?.fluxhttp.interceptors.request) {
      this.context.fluxhttp.interceptors.request.use(
        (config) => interceptor(config, this.context!),
        undefined,
        { runWhen: () => this.config.enabled && this.config.settings.enabled }
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
   * Handle mock request logic
   */
  private async handleMockRequest(config: fluxhttpRequestConfig): Promise<fluxhttpRequestConfig> {
    this.stats.totalRequests++;
    
    try {
      // Find matching rule
      const matchedRule = this.findMatchingRule(config);
      
      if (matchedRule) {
        // Generate mock response
        const mockResponse = await this.generateMockResponse(config, matchedRule);
        
        // Update statistics
        this.stats.mockedRequests++;
        this.updateRuleStats(matchedRule);
        this.updateStats();
        
        if (this.config.settings.dev?.logMatches) {
          this.context?.logger.info('Mock rule matched', {
            rule: matchedRule.name || 'unnamed',
            method: config.method,
            url: config.url,
            status: mockResponse.status
          });
        }
        
        // Apply delay if specified
        const delay = mockResponse.delay || matchedRule.response.delay || this.config.settings.defaultDelay || 0;
        if (delay > 0) {
          await this.sleep(delay);
        }
        
        // Throw mock response to interrupt request flow
        throw new MockedResponse(mockResponse);
        
      } else {
        // No matching rule found
        if (this.config.settings.dev?.logUnmatched) {
          this.context?.logger.debug('No mock rule matched', {
            method: config.method,
            url: config.url
          });
        }
        
        // Check if we should use default response
        if (this.config.settings.defaultResponse && !this.config.settings.passthrough) {
          this.stats.mockedRequests++;
          this.updateStats();
          
          const defaultResponse = await this.createResponse(config, this.config.settings.defaultResponse);
          throw new MockedResponse(defaultResponse);
        }
        
        // Allow passthrough if enabled
        if (this.config.settings.passthrough) {
          this.stats.passthroughRequests++;
          this.updateStats();
          return config;
        }
        
        // No mock and no passthrough - could throw error or allow through
        return config;
      }
    } catch (error) {
      if (error instanceof MockedResponse) {
        throw error;
      }
      
      this.context?.logger.error('Mock request handling failed', { error });
      return config;
    }
  }

  /**
   * Handle response recording
   */
  private handleRecording(response: fluxhttpResponse): fluxhttpResponse {
    const recordingConfig = this.config.settings.recording;
    
    if (!recordingConfig?.enabled) {
      return response;
    }

    // Check if we've reached max records
    if (this.recordedRequests.length >= (recordingConfig.maxRecords || 1000)) {
      // Remove oldest record
      this.recordedRequests.shift();
    }

    // Create recorded request
    const recordedRequest: RecordedRequest = {
      config: this.sanitizeConfig(response.config, recordingConfig),
      response: this.sanitizeResponse(response, recordingConfig),
      timestamp: Date.now(),
      id: this.generateRequestId()
    };

    this.recordedRequests.push(recordedRequest);
    
    this.context?.logger.debug('Request recorded', {
      id: recordedRequest.id,
      method: response.config.method,
      url: response.config.url,
      status: response.status
    });

    return response;
  }

  /**
   * Find matching mock rule
   */
  private findMatchingRule(config: fluxhttpRequestConfig): MockRule | null {
    // Get all applicable rules
    let rules = this.getAllRules();
    
    // Filter enabled rules
    rules = rules.filter(rule => rule.enabled !== false);
    
    // Filter rules that have remaining uses
    rules = rules.filter(rule => {
      if (rule.times === undefined) return true;
      const usageCount = this.ruleUsageCount.get(this.getRuleId(rule)) || 0;
      return usageCount < rule.times;
    });
    
    // Find matching rules
    const matchingRules = rules.filter(rule => this.isRuleMatching(config, rule));
    
    if (matchingRules.length === 0) {
      return null;
    }
    
    // Sort by priority (higher numbers first)
    matchingRules.sort((a, b) => (b.priority || 0) - (a.priority || 0));
    
    return matchingRules[0];
  }

  /**
   * Get all applicable rules
   */
  private getAllRules(): MockRule[] {
    const rules: MockRule[] = [];
    
    // Add direct rules
    if (this.config.settings.rules) {
      rules.push(...this.config.settings.rules);
    }
    
    // Add scenario rules if active scenario is set
    if (this.config.settings.activeScenario && this.config.settings.scenarios) {
      const activeScenario = this.config.settings.scenarios.find(
        scenario => scenario.name === this.config.settings.activeScenario && scenario.enabled !== false
      );
      
      if (activeScenario) {
        rules.push(...activeScenario.rules);
      }
    }
    
    return rules;
  }

  /**
   * Check if rule matches request
   */
  private isRuleMatching(config: fluxhttpRequestConfig, rule: MockRule): boolean {
    // Custom matcher takes precedence
    if (rule.matcher) {
      return rule.matcher(config);
    }
    
    // Check URL pattern
    if (rule.url) {
      if (!this.matchesPattern(config.url || '', rule.url)) {
        return false;
      }
    }
    
    // Check HTTP method
    if (rule.method) {
      const methods = Array.isArray(rule.method) ? rule.method : [rule.method];
      const requestMethod = (config.method || 'GET').toUpperCase();
      if (!methods.map(m => m.toUpperCase()).includes(requestMethod)) {
        return false;
      }
    }
    
    // Check headers
    if (rule.headers && config.headers) {
      for (const [key, pattern] of Object.entries(rule.headers)) {
        const headerValue = config.headers[key] as string;
        if (!headerValue || !this.matchesPattern(headerValue, pattern)) {
          return false;
        }
      }
    }
    
    // Check query parameters
    if (rule.params && config.params) {
      for (const [key, pattern] of Object.entries(rule.params)) {
        const paramValue = config.params[key];
        if (paramValue === undefined || !this.matchesPattern(String(paramValue), pattern)) {
          return false;
        }
      }
    }
    
    // Check request body
    if (rule.body !== undefined) {
      if (!this.deepEqual(config.data, rule.body)) {
        return false;
      }
    }
    
    return true;
  }

  /**
   * Check if value matches pattern
   */
  private matchesPattern(value: string, pattern: string | RegExp | number): boolean {
    if (pattern instanceof RegExp) {
      return pattern.test(value);
    }
    
    if (typeof pattern === 'number') {
      return value === String(pattern);
    }
    
    // String pattern - support wildcards
    const regexPattern = pattern
      .replace(/[.*+?^${}()|[\]\\]/g, '\\$&') // Escape regex chars
      .replace(/\\\*/g, '.*') // Convert * to .*
      .replace(/\\\?/g, '.'); // Convert ? to .
    
    return new RegExp(`^${regexPattern}$`).test(value);
  }

  /**
   * Deep equality check
   */
  private deepEqual(a: unknown, b: unknown): boolean {
    if (a === b) return true;
    
    if (a === null || b === null) return a === b;
    if (typeof a !== typeof b) return false;
    
    if (typeof a === 'object') {
      if (Array.isArray(a) !== Array.isArray(b)) return false;
      
      if (Array.isArray(a)) {
        if (a.length !== (b as unknown[]).length) return false;
        return a.every((item, index) => this.deepEqual(item, (b as unknown[])[index]));
      }
      
      const keysA = Object.keys(a as object);
      const keysB = Object.keys(b as object);
      
      if (keysA.length !== keysB.length) return false;
      
      return keysA.every(key => 
        keysB.includes(key) && 
        this.deepEqual((a as any)[key], (b as any)[key])
      );
    }
    
    return false;
  }

  /**
   * Generate mock response
   */
  private async generateMockResponse(config: fluxhttpRequestConfig, rule: MockRule): Promise<fluxhttpResponse> {
    let responseConfig: MockResponse;
    
    if (Array.isArray(rule.response)) {
      // Multiple responses - select based on probability
      responseConfig = this.selectResponseByProbability(rule.response);
    } else {
      responseConfig = rule.response;
    }
    
    // Handle dynamic response function
    if (responseConfig.response) {
      responseConfig = await responseConfig.response(config);
    }
    
    return this.createResponse(config, responseConfig);
  }

  /**
   * Select response based on probability
   */
  private selectResponseByProbability(responses: MockResponse[]): MockResponse {
    const random = Math.random();
    let cumulative = 0;
    
    for (const response of responses) {
      cumulative += response.probability || (1 / responses.length);
      if (random <= cumulative) {
        return response;
      }
    }
    
    // Fallback to first response
    return responses[0];
  }

  /**
   * Create mock response
   */
  private createResponse(config: fluxhttpRequestConfig, responseConfig: MockResponse): fluxhttpResponse {
    return {
      data: responseConfig.data || null,
      status: responseConfig.status || 200,
      statusText: responseConfig.statusText || 'OK',
      headers: responseConfig.headers || {},
      config,
      request: undefined
    };
  }

  /**
   * Update rule usage statistics
   */
  private updateRuleStats(rule: MockRule): void {
    const ruleId = this.getRuleId(rule);
    const currentCount = this.ruleUsageCount.get(ruleId) || 0;
    this.ruleUsageCount.set(ruleId, currentCount + 1);
    
    if (this.config.settings.stats?.enabled) {
      if (!this.stats.ruleStats[ruleId]) {
        this.stats.ruleStats[ruleId] = {
          hits: 0,
          lastUsed: 0,
          averageDelay: 0
        };
      }
      
      this.stats.ruleStats[ruleId].hits++;
      this.stats.ruleStats[ruleId].lastUsed = Date.now();
    }
  }

  /**
   * Update overall statistics
   */
  private updateStats(): void {
    const total = this.stats.totalRequests;
    this.stats.hitRate = total > 0 ? this.stats.mockedRequests / total : 0;
  }

  /**
   * Get unique rule ID
   */
  private getRuleId(rule: MockRule): string {
    return rule.name || `${rule.method || 'ANY'}_${rule.url || 'ANY'}`;
  }

  /**
   * Sanitize config for recording
   */
  private sanitizeConfig(config: fluxhttpRequestConfig, recordingConfig: any): fluxhttpRequestConfig {
    const sanitized: fluxhttpRequestConfig = {
      method: config.method,
      url: config.url,
      baseURL: config.baseURL
    };
    
    if (recordingConfig.includeHeaders && config.headers) {
      // Exclude sensitive headers
      const sensitiveHeaders = ['authorization', 'cookie', 'x-api-key'];
      sanitized.headers = {};
      
      for (const [key, value] of Object.entries(config.headers)) {
        if (!sensitiveHeaders.includes(key.toLowerCase())) {
          sanitized.headers[key] = value;
        }
      }
    }
    
    if (recordingConfig.includeBody && config.data) {
      sanitized.data = config.data;
    }
    
    if (config.params) {
      sanitized.params = config.params;
    }
    
    return sanitized;
  }

  /**
   * Sanitize response for recording
   */
  private sanitizeResponse(response: fluxhttpResponse, recordingConfig: any): fluxhttpResponse {
    const sanitized: fluxhttpResponse = {
      status: response.status,
      statusText: response.statusText,
      config: response.config,
      data: null,
      headers: {}
    };
    
    if (recordingConfig.includeHeaders && response.headers) {
      // Exclude sensitive headers
      const sensitiveHeaders = ['set-cookie', 'authorization'];
      
      for (const [key, value] of Object.entries(response.headers)) {
        if (!sensitiveHeaders.includes(key.toLowerCase())) {
          sanitized.headers[key] = value;
        }
      }
    }
    
    if (recordingConfig.includeBody) {
      sanitized.data = response.data;
    }
    
    return sanitized;
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `rec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Add mock rule
   */
  addRule(rule: MockRule): void {
    if (!this.config.settings.rules) {
      this.config.settings.rules = [];
    }
    
    this.config.settings.rules.push(rule);
    
    this.context?.logger.info('Mock rule added', {
      name: rule.name,
      url: rule.url,
      method: rule.method
    });
  }

  /**
   * Remove mock rule
   */
  removeRule(name: string): boolean {
    if (!this.config.settings.rules) {
      return false;
    }
    
    const index = this.config.settings.rules.findIndex(rule => rule.name === name);
    if (index >= 0) {
      this.config.settings.rules.splice(index, 1);
      this.context?.logger.info('Mock rule removed', { name });
      return true;
    }
    
    return false;
  }

  /**
   * Clear all mock rules
   */
  clearRules(): void {
    this.config.settings.rules = [];
    this.ruleUsageCount.clear();
    this.context?.logger.info('All mock rules cleared');
  }

  /**
   * Set active scenario
   */
  setActiveScenario(scenarioName: string): boolean {
    if (!this.config.settings.scenarios) {
      return false;
    }
    
    const scenario = this.config.settings.scenarios.find(s => s.name === scenarioName);
    if (scenario) {
      this.config.settings.activeScenario = scenarioName;
      this.context?.logger.info('Active scenario changed', { scenario: scenarioName });
      return true;
    }
    
    return false;
  }

  /**
   * Export recorded requests as mock rules
   */
  exportRecordings(): MockRule[] {
    return this.recordedRequests.map((record, index) => ({
      name: `recorded_${index}`,
      url: record.config.url,
      method: record.config.method,
      response: {
        status: record.response.status,
        statusText: record.response.statusText,
        headers: record.response.headers,
        data: record.response.data
      },
      description: `Auto-generated from recording at ${new Date(record.timestamp).toISOString()}`
    }));
  }

  /**
   * Get mock statistics
   */
  getStats(): MockStats {
    return { ...this.stats };
  }

  /**
   * Clear statistics
   */
  clearStats(): void {
    this.stats = {
      totalRequests: 0,
      mockedRequests: 0,
      passthroughRequests: 0,
      hitRate: 0,
      ruleStats: {}
    };
    this.ruleUsageCount.clear();
  }

  /**
   * Update configuration
   */
  async updateConfig(config: Partial<MockPluginConfig>): Promise<void> {
    this.config = { ...this.config, ...config };
    this.context?.logger.info('Mock plugin configuration updated');
  }

  /**
   * Get plugin health status
   */
  async getHealth() {
    const status = this.config.enabled ? 'healthy' : 'degraded';
    
    return {
      status,
      timestamp: Date.now(),
      details: {
        enabled: this.config.enabled,
        mockingEnabled: this.config.settings.enabled,
        rulesCount: this.config.settings.rules?.length || 0,
        scenariosCount: this.config.settings.scenarios?.length || 0,
        activeScenario: this.config.settings.activeScenario,
        recordingsCount: this.recordedRequests.length,
        stats: this.stats
      }
    };
  }

  /**
   * Get plugin metrics
   */
  async getMetrics() {
    return {
      enabled: this.config.settings.enabled,
      rulesCount: this.config.settings.rules?.length || 0,
      recordingsCount: this.recordedRequests.length,
      ...this.stats
    };
  }
}

/**
 * Mocked response class for interrupting request flow
 */
class MockedResponse extends Error {
  constructor(public readonly response: fluxhttpResponse) {
    super('Mocked response available');
    this.name = 'MockedResponse';
  }
}

/**
 * Mock plugin factory
 */
export function createMockPlugin(config?: Partial<MockPluginConfig>): MockPlugin {
  return new MockPlugin(config);
}