import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import type { fluxhttpRequestConfig, fluxhttpResponse } from '../../src/types/core.js';
import { MockAdapter, createMockAdapter } from './mock-adapter.js';

/**
 * Common test utilities and helpers
 */

/**
 * Assertion helpers for better test readability
 */
export const assertions = {
  /**
   * Assert that a value is defined (not null or undefined)
   */
  isDefined<T>(value: T | null | undefined, message?: string): asserts value is T {
    assert(value != null, message || 'Expected value to be defined');
  },

  /**
   * Assert that a function throws an error
   */
  async throws(
    fn: () => Promise<any> | any,
    expectedError?: string | RegExp | Error,
    message?: string
  ): Promise<void> {
    try {
      await fn();
      assert.fail(message || 'Expected function to throw');
    } catch (error) {
      if (expectedError) {
        if (typeof expectedError === 'string') {
          assert(
            error instanceof Error && error.message.includes(expectedError),
            `Expected error message to contain "${expectedError}", got "${(error as Error).message}"`
          );
        } else if (expectedError instanceof RegExp) {
          assert(
            error instanceof Error && expectedError.test(error.message),
            `Expected error message to match ${expectedError}, got "${(error as Error).message}"`
          );
        } else if (expectedError instanceof Error) {
          assert.strictEqual(
            (error as Error).message,
            expectedError.message,
            'Error messages do not match'
          );
        }
      }
    }
  },

  /**
   * Assert that a value is of a specific type
   */
  isType(value: any, expectedType: string, message?: string): void {
    assert.strictEqual(
      typeof value,
      expectedType,
      message || `Expected type ${expectedType}, got ${typeof value}`
    );
  },

  /**
   * Assert that an object has specific properties
   */
  hasProperties(obj: any, properties: string[], message?: string): void {
    for (const prop of properties) {
      assert(
        obj && typeof obj === 'object' && prop in obj,
        message || `Expected object to have property "${prop}"`
      );
    }
  },

  /**
   * Assert that a response matches expected structure
   */
  isValidResponse<T = any>(response: any, message?: string): asserts response is fluxhttpResponse<T> {
    this.hasProperties(
      response,
      ['data', 'status', 'statusText', 'headers', 'config'],
      message || 'Expected valid fluxhttp response structure'
    );
    this.isType(response.status, 'number', 'Response status should be a number');
    this.isType(response.statusText, 'string', 'Response statusText should be a string');
    this.isType(response.headers, 'object', 'Response headers should be an object');
    this.isType(response.config, 'object', 'Response config should be an object');
  },

  /**
   * Assert that a request config is valid
   */
  isValidRequestConfig(config: any, message?: string): asserts config is fluxhttpRequestConfig {
    this.isType(config, 'object', message || 'Request config should be an object');
    if (config.url) {
      this.isType(config.url, 'string', 'Request URL should be a string');
    }
    if (config.method) {
      this.isType(config.method, 'string', 'Request method should be a string');
    }
  }
};

/**
 * Test fixture helpers
 */
export const fixtures = {
  /**
   * Create a basic request config
   */
  createRequestConfig(overrides: Partial<fluxhttpRequestConfig> = {}): fluxhttpRequestConfig {
    return {
      url: '/test',
      method: 'GET',
      headers: {},
      timeout: 5000,
      ...overrides,
    };
  },

  /**
   * Create a basic response
   */
  createResponse<T = any>(
    data: T,
    overrides: Partial<fluxhttpResponse<T>> = {}
  ): fluxhttpResponse<T> {
    return {
      data,
      status: 200,
      statusText: 'OK',
      headers: {},
      config: this.createRequestConfig(),
      request: {},
      ...overrides,
    };
  },

  /**
   * Create common test URLs
   */
  urls: {
    basic: 'https://api.test.com',
    withPath: 'https://api.test.com/path',
    withQuery: 'https://api.test.com/path?param=value',
    withFragment: 'https://api.test.com/path#fragment',
    relative: '/relative/path',
    protocolRelative: '//api.test.com/path',
  },

  /**
   * Create common test data
   */
  data: {
    simple: { message: 'test' },
    complex: {
      id: 1,
      name: 'Test Item',
      tags: ['tag1', 'tag2'],
      metadata: {
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
      },
    },
    array: [1, 2, 3, 4, 5],
    stringData: 'simple string data',
    numberData: 42,
    booleanData: true,
    nullData: null,
  },

  /**
   * Create common test headers
   */
  headers: {
    json: { 'Content-Type': 'application/json' },
    text: { 'Content-Type': 'text/plain' },
    form: { 'Content-Type': 'application/x-www-form-urlencoded' },
    auth: { 'Authorization': 'Bearer token123' },
    custom: { 'X-Custom-Header': 'custom-value' },
    mixed: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer token123',
      'X-Custom-Header': 'custom-value',
    },
  },
};

/**
 * Test environment helpers
 */
export const environment = {
  /**
   * Check if we're in a browser-like environment
   */
  isBrowser(): boolean {
    return typeof window !== 'undefined' && typeof document !== 'undefined';
  },

  /**
   * Check if we're in a Node.js environment
   */
  isNode(): boolean {
    return typeof process !== 'undefined' && process.versions && process.versions.node;
  },

  /**
   * Get the platform identifier
   */
  getPlatform(): 'browser' | 'node' | 'unknown' {
    if (this.isBrowser()) return 'browser';
    if (this.isNode()) return 'node';
    return 'unknown';
  },
};

/**
 * Test timing utilities
 */
export const timing = {
  /**
   * Wait for a specified amount of time
   */
  async wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  },

  /**
   * Measure execution time of a function
   */
  async measure<T>(fn: () => Promise<T> | T): Promise<{ result: T; duration: number }> {
    const start = performance.now();
    const result = await fn();
    const duration = performance.now() - start;
    return { result, duration };
  },

  /**
   * Assert that an operation completes within a time limit
   */
  async withinTime<T>(
    fn: () => Promise<T> | T,
    maxMs: number,
    message?: string
  ): Promise<T> {
    const start = performance.now();
    const result = await fn();
    const duration = performance.now() - start;
    
    assert(
      duration <= maxMs,
      message || `Operation took ${duration}ms, expected <= ${maxMs}ms`
    );
    
    return result;
  },
};

/**
 * Test suite helpers
 */
export const suite = {
  /**
   * Create a test suite with common setup
   */
  create(
    name: string,
    setup?: () => void | Promise<void>,
    teardown?: () => void | Promise<void>
  ) {
    return describe(name, () => {
      if (setup) {
        beforeEach(setup);
      }
      if (teardown) {
        afterEach(teardown);
      }
    });
  },

  /**
   * Create a test with a mock adapter
   */
  withMockAdapter(
    name: string,
    testFn: (adapter: MockAdapter) => void | Promise<void>
  ) {
    return it(name, async () => {
      const adapter = createMockAdapter();
      try {
        await testFn(adapter);
      } finally {
        adapter.reset();
      }
    });
  },
};

/**
 * Export everything for easier importing
 */
export * from './mock-adapter.js';
export { describe, it, beforeEach, afterEach } from 'node:test';
export { default as assert } from 'node:assert';