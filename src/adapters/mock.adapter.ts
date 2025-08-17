import type { fluxhttpRequestConfig, fluxhttpResponse, HttpMethod } from '../types';
import { fluxhttpError } from '../errors';

/**
 * Mock response configuration
 * @interface MockResponse
 */
export interface MockResponse<T = unknown> {
  /** Response status code */
  status: number;
  /** Response status text */
  statusText?: string;
  /** Response data */
  data: T;
  /** Response headers */
  headers?: Record<string, string>;
  /** Simulated delay in milliseconds */
  delay?: number;
}

/**
 * Mock request matcher configuration
 * @interface MockMatcher
 */
export interface MockMatcher {
  /** HTTP method to match */
  method?: HttpMethod | HttpMethod[];
  /** URL to match (string or regex) */
  url?: string | RegExp;
  /** Query parameters to match */
  params?: Record<string, unknown>;
  /** Request data to match */
  data?: unknown;
  /** Headers to match */
  headers?: Record<string, string>;
}

/**
 * Mock handler configuration
 * @interface MockHandler
 */
export interface MockHandler<T = unknown> {
  /** Request matcher */
  matcher: MockMatcher;
  /** Response configuration or function */
  response: MockResponse<T> | ((config: fluxhttpRequestConfig) => MockResponse<T> | Promise<MockResponse<T>>);
  /** Number of times this handler can be used (0 = unlimited) */
  times?: number;
}

/**
 * Mock adapter state management
 * @class MockAdapter
 */
export class MockAdapter {
  private handlers: MockHandler[] = [];
  private history: fluxhttpRequestConfig[] = [];
  private defaultDelay = 0;

  /**
   * Add a mock handler for requests
   * @param {MockHandler} handler - Mock handler configuration
   * @returns {MockAdapter} This adapter instance for chaining
   */
  addHandler<T = unknown>(handler: MockHandler<T>): MockAdapter {
    this.handlers.push(handler);
    return this;
  }

  /**
   * Mock a GET request
   * @param {string | RegExp} url - URL to match
   * @param {MockResponse} response - Response configuration
   * @param {number} [times] - Number of times to use this handler
   * @returns {MockAdapter} This adapter instance for chaining
   */
  onGet<T = unknown>(url: string | RegExp, response: MockResponse<T>, times?: number): MockAdapter {
    return this.addHandler({
      matcher: { method: 'GET', url },
      response,
      times,
    });
  }

  /**
   * Mock a POST request
   * @param {string | RegExp} url - URL to match
   * @param {unknown} [data] - Request data to match
   * @param {MockResponse} response - Response configuration
   * @param {number} [times] - Number of times to use this handler
   * @returns {MockAdapter} This adapter instance for chaining
   */
  onPost<T = unknown>(url: string | RegExp, data?: unknown, response?: MockResponse<T>, times?: number): MockAdapter {
    // Handle overloaded parameters
    if (typeof data === 'object' && data !== null && 'status' in data && response === undefined) {
      response = data as MockResponse<T>;
      data = undefined;
    }

    return this.addHandler({
      matcher: { method: 'POST', url, data },
      response: response!,
      times,
    });
  }

  /**
   * Mock a PUT request
   * @param {string | RegExp} url - URL to match
   * @param {unknown} [data] - Request data to match
   * @param {MockResponse} response - Response configuration
   * @param {number} [times] - Number of times to use this handler
   * @returns {MockAdapter} This adapter instance for chaining
   */
  onPut<T = unknown>(url: string | RegExp, data?: unknown, response?: MockResponse<T>, times?: number): MockAdapter {
    if (typeof data === 'object' && data !== null && 'status' in data && response === undefined) {
      response = data as MockResponse<T>;
      data = undefined;
    }

    return this.addHandler({
      matcher: { method: 'PUT', url, data },
      response: response!,
      times,
    });
  }

  /**
   * Mock a DELETE request
   * @param {string | RegExp} url - URL to match
   * @param {MockResponse} response - Response configuration
   * @param {number} [times] - Number of times to use this handler
   * @returns {MockAdapter} This adapter instance for chaining
   */
  onDelete<T = unknown>(url: string | RegExp, response: MockResponse<T>, times?: number): MockAdapter {
    return this.addHandler({
      matcher: { method: 'DELETE', url },
      response,
      times,
    });
  }

  /**
   * Mock a PATCH request
   * @param {string | RegExp} url - URL to match
   * @param {unknown} [data] - Request data to match
   * @param {MockResponse} response - Response configuration
   * @param {number} [times] - Number of times to use this handler
   * @returns {MockAdapter} This adapter instance for chaining
   */
  onPatch<T = unknown>(url: string | RegExp, data?: unknown, response?: MockResponse<T>, times?: number): MockAdapter {
    if (typeof data === 'object' && data !== null && 'status' in data && response === undefined) {
      response = data as MockResponse<T>;
      data = undefined;
    }

    return this.addHandler({
      matcher: { method: 'PATCH', url, data },
      response: response!,
      times,
    });
  }

  /**
   * Mock a HEAD request
   * @param {string | RegExp} url - URL to match
   * @param {MockResponse} response - Response configuration
   * @param {number} [times] - Number of times to use this handler
   * @returns {MockAdapter} This adapter instance for chaining
   */
  onHead<T = unknown>(url: string | RegExp, response: MockResponse<T>, times?: number): MockAdapter {
    return this.addHandler({
      matcher: { method: 'HEAD', url },
      response,
      times,
    });
  }

  /**
   * Mock an OPTIONS request
   * @param {string | RegExp} url - URL to match
   * @param {MockResponse} response - Response configuration
   * @param {number} [times] - Number of times to use this handler
   * @returns {MockAdapter} This adapter instance for chaining
   */
  onOptions<T = unknown>(url: string | RegExp, response: MockResponse<T>, times?: number): MockAdapter {
    return this.addHandler({
      matcher: { method: 'OPTIONS', url },
      response,
      times,
    });
  }

  /**
   * Mock any request
   * @param {MockMatcher} matcher - Request matcher
   * @param {MockResponse} response - Response configuration
   * @param {number} [times] - Number of times to use this handler
   * @returns {MockAdapter} This adapter instance for chaining
   */
  onAny<T = unknown>(matcher: MockMatcher, response: MockResponse<T>, times?: number): MockAdapter {
    return this.addHandler({
      matcher,
      response,
      times,
    });
  }

  /**
   * Set default delay for all responses
   * @param {number} delay - Delay in milliseconds
   * @returns {MockAdapter} This adapter instance for chaining
   */
  setDefaultDelay(delay: number): MockAdapter {
    this.defaultDelay = delay;
    return this;
  }

  /**
   * Clear all handlers and history
   * @returns {MockAdapter} This adapter instance for chaining
   */
  reset(): MockAdapter {
    this.handlers = [];
    this.history = [];
    return this;
  }

  /**
   * Clear only handlers, keep history
   * @returns {MockAdapter} This adapter instance for chaining
   */
  resetHandlers(): MockAdapter {
    this.handlers = [];
    return this;
  }

  /**
   * Clear only history, keep handlers
   * @returns {MockAdapter} This adapter instance for chaining
   */
  resetHistory(): MockAdapter {
    this.history = [];
    return this;
  }

  /**
   * Get request history
   * @returns {fluxhttpRequestConfig[]} Array of request configurations
   */
  getHistory(): fluxhttpRequestConfig[] {
    return [...this.history];
  }

  /**
   * Get the last request from history
   * @returns {fluxhttpRequestConfig | undefined} Last request configuration
   */
  getLastRequest(): fluxhttpRequestConfig | undefined {
    return this.history[this.history.length - 1];
  }

  /**
   * Check if a request matches a matcher
   * @private
   * @param {fluxhttpRequestConfig} config - Request configuration
   * @param {MockMatcher} matcher - Matcher configuration
   * @returns {boolean} True if request matches
   */
  private matchesRequest(config: fluxhttpRequestConfig, matcher: MockMatcher): boolean {
    // Match method
    if (matcher.method) {
      const methods = Array.isArray(matcher.method) ? matcher.method : [matcher.method];
      if (!methods.includes(config.method || 'GET')) {
        return false;
      }
    }

    // Match URL
    if (matcher.url) {
      let url = config.url || '';
      
      // If there's a baseURL, construct the full URL for matching
      if (config.baseURL && !url.includes('://')) {
        url = config.baseURL.replace(/\/$/, '') + '/' + url.replace(/^\//, '');
      }
      
      if (matcher.url instanceof RegExp) {
        if (!matcher.url.test(url)) {
          return false;
        }
      } else {
        const matchUrl = String(matcher.url);
        if (url !== matchUrl && !url.endsWith(matchUrl)) {
          return false;
        }
      }
    }

    // Match data
    if (matcher.data !== undefined) {
      if (JSON.stringify(config.data) !== JSON.stringify(matcher.data)) {
        return false;
      }
    }

    // Match params
    if (matcher.params) {
      if (!config.params) {
        return false;
      }
      for (const [key, value] of Object.entries(matcher.params)) {
        if (config.params[key] !== value) {
          return false;
        }
      }
    }

    // Match headers
    if (matcher.headers) {
      if (!config.headers) {
        return false;
      }
      for (const [key, value] of Object.entries(matcher.headers)) {
        if (config.headers[key] !== value) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Handle a request and return a mocked response
   * @param {fluxhttpRequestConfig} config - Request configuration
   * @returns {Promise<fluxhttpResponse>} Mocked response
   * @throws {fluxhttpError} If no matching handler is found
   */
  async handle<T = unknown>(config: fluxhttpRequestConfig): Promise<fluxhttpResponse<T>> {
    // Add to history
    this.history.push(config);

    // Find matching handler
    let handlerIndex = -1;
    let handler: MockHandler<T> | undefined;

    for (let i = 0; i < this.handlers.length; i++) {
      const h = this.handlers[i] as MockHandler<T>;
      if (this.matchesRequest(config, h.matcher)) {
        handler = h;
        handlerIndex = i;
        break;
      }
    }

    if (!handler) {
      const error = new Error(`No mock handler found for ${config.method || 'GET'} ${config.url || ''}`) as fluxhttpError;
      error.config = config;
      error.code = 'ERR_MOCK_NOT_FOUND';
      error.isfluxhttpError = true;
      error.toJSON = () => ({ message: error.message, code: error.code });
      throw error;
    }

    // Decrement handler usage if limited
    if (handler.times !== undefined && handler.times > 0) {
      handler.times--;
      if (handler.times === 0) {
        this.handlers.splice(handlerIndex, 1);
      }
    }

    // Get response
    let mockResponse: MockResponse<T>;
    if (typeof handler.response === 'function') {
      mockResponse = await handler.response(config);
    } else {
      mockResponse = handler.response;
    }

    // Apply delay
    const delay = mockResponse.delay ?? this.defaultDelay;
    if (delay > 0) {
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    // Check for error status
    if (mockResponse.status >= 400) {
      const error = new Error(mockResponse.statusText || `Request failed with status ${mockResponse.status}`) as fluxhttpError;
      error.config = config;
      error.code = 'ERR_BAD_REQUEST';
      error.isfluxhttpError = true;
      error.toJSON = () => ({ message: error.message, code: error.code });
      error.response = {
        data: mockResponse.data,
        status: mockResponse.status,
        statusText: mockResponse.statusText || '',
        headers: mockResponse.headers || {},
        config,
      };
      throw error;
    }

    // Return successful response
    return {
      data: mockResponse.data,
      status: mockResponse.status,
      statusText: mockResponse.statusText || 'OK',
      headers: mockResponse.headers || {},
      config,
    };
  }
}

/**
 * Create a mock adapter instance
 * @returns {MockAdapter} New mock adapter instance
 */
export function createMockAdapter(): MockAdapter {
  return new MockAdapter();
}

/**
 * Mock adapter function for use with fluxhttp
 * @param {MockAdapter} mockAdapter - Mock adapter instance
 * @returns {Function} Adapter function
 */
export function mockAdapter(mockAdapter: MockAdapter) {
  return function adapter<T = unknown>(config: fluxhttpRequestConfig): Promise<fluxhttpResponse<T>> {
    return mockAdapter.handle<T>(config);
  };
}