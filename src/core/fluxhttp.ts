import type {
  fluxhttpInstance,
  fluxhttpRequestConfig,
  fluxhttpResponse,
  RequestBody,
  HttpMethod,
} from '../types';
import { InterceptorManager } from '../interceptors/InterceptorManager';
import { dispatchRequest } from '../interceptors/dispatchRequest';
import { getDefaultAdapter, type Adapter } from '../adapters';
import { mergeConfig } from './mergeConfig-minimal';
import { buildFullPath } from './buildFullPath';
import { defaults } from './defaults';

/**
 * Type guard to validate HTTP method
 * @internal
 * @param {string} method - HTTP method to validate
 * @returns {boolean} True if method is valid HTTP method
 */
function isValidHttpMethod(method: string): method is HttpMethod {
  const validMethods: readonly string[] = [
    'GET',
    'POST',
    'PUT',
    'DELETE',
    'PATCH',
    'HEAD',
    'OPTIONS',
  ];
  return validMethods.includes(method.toUpperCase());
}

/**
 * Main fluxhttp class for making HTTP requests
 * @class fluxhttp
 * @implements {fluxhttpInstance}
 *
 * @example
 * ```typescript
 * const client = new fluxhttp({
 *   baseURL: 'https://api.example.com',
 *   timeout: 5000
 * });
 *
 * const response = await client.get('/users');
 * ```
 */
export class fluxhttp implements fluxhttpInstance {
  /**
   * Default configuration for all requests
   * @type {fluxhttpRequestConfig}
   */
  defaults: fluxhttpRequestConfig;

  /**
   * Request and response interceptor managers
   * @type {Object}
   * @property {InterceptorManager<fluxhttpRequestConfig>} request - Request interceptors
   * @property {InterceptorManager<fluxhttpResponse>} response - Response interceptors
   */
  interceptors: {
    request: InterceptorManager<fluxhttpRequestConfig>;
    response: InterceptorManager<fluxhttpResponse>;
  };

  /**
   * HTTP adapter for making requests
   * @private
   * @type {Adapter}
   */
  private adapter: Adapter;

  /**
   * Whether this instance has been disposed
   * @private
   */
  private disposed = false;

  /**
   * Create a new fluxhttp instance
   * @constructor
   * @param {fluxhttpRequestConfig} [defaultConfig={}] - Default configuration
   */
  constructor(defaultConfig: fluxhttpRequestConfig = {}) {
    // Handle null/undefined config
    const safeConfig = defaultConfig || {};
    this.defaults = mergeConfig(defaults, safeConfig);
    this.interceptors = {
      request: new InterceptorManager<fluxhttpRequestConfig>(),
      response: new InterceptorManager<fluxhttpResponse>(),
    };
    this.adapter = safeConfig.adapter || getDefaultAdapter();
  }

  /**
   * Make an HTTP request
   * @async
   * @template T - Response data type
   * @param {fluxhttpRequestConfig|string} configOrUrl - Request configuration object or URL string
   * @returns {Promise<fluxhttpResponse<T>>} Promise resolving to response
   * @throws {Error} If URL is invalid or missing
   * @throws {Error} If HTTP method is invalid
   * @example
   * ```typescript
   * // Using config object
   * const response = await client.request({
   *   method: 'GET',
   *   url: '/api/users',
   *   params: { page: 1 }
   * });
   *
   * // Using URL string (defaults to GET)
   * const response = await client.request('/api/users');
   * ```
   */
  async request<T = unknown>(config: fluxhttpRequestConfig): Promise<fluxhttpResponse<T>>;
  async request<T = unknown>(url: string): Promise<fluxhttpResponse<T>>;
  async request<T = unknown>(
    configOrUrl: fluxhttpRequestConfig | string
  ): Promise<fluxhttpResponse<T>> {
    let config: fluxhttpRequestConfig;

    if (typeof configOrUrl === 'string') {
      config = { url: configOrUrl };
    } else {
      config = configOrUrl;
    }

    config = mergeConfig(this.defaults, config);

    // Validate URL
    if (!config.url) {
      throw new Error('Request URL is required');
    }

    config.url = buildFullPath(config.baseURL, config.url);

    // Validate final URL
    if (config.url.includes('://') || config.url.startsWith('//')) {
      try {
        new URL(config.url);
      } catch {
        throw new Error(`Invalid URL: ${config.url}`);
      }
    }

    // Additional validation for relative URLs without baseURL
    if (!config.baseURL && !config.url.startsWith('/') && !config.url.includes('://')) {
      throw new Error(`Relative URL requires baseURL: ${config.url}`);
    }

    // Validate and normalize HTTP method
    const method = (config.method || 'GET').toUpperCase();
    if (!isValidHttpMethod(method)) {
      throw new Error(`Invalid HTTP method: ${method}`);
    }
    config.method = method;

    return dispatchRequest<T>(
      config,
      this.interceptors.request,
      this.interceptors.response,
      this.adapter
    );
  }

  /**
   * Make a GET request
   * @async
   * @template T - Response data type
   * @param {string} url - Request URL
   * @param {fluxhttpRequestConfig} [config] - Additional configuration
   * @returns {Promise<fluxhttpResponse<T>>} Promise resolving to response
   * @example
   * ```typescript
   * const users = await client.get('/api/users');
   * const user = await client.get('/api/users/123', {
   *   headers: { 'Accept': 'application/json' }
   * });
   * ```
   */
  async get<T = unknown>(
    url: string,
    config?: fluxhttpRequestConfig
  ): Promise<fluxhttpResponse<T>> {
    return this.request<T>(mergeConfig(config || {}, { method: 'GET', url }));
  }

  /**
   * Make a DELETE request
   * @async
   * @template T - Response data type
   * @param {string} url - Request URL
   * @param {fluxhttpRequestConfig} [config] - Additional configuration
   * @returns {Promise<fluxhttpResponse<T>>} Promise resolving to response
   * @example
   * ```typescript
   * await client.delete('/api/users/123');
   * ```
   */
  async delete<T = unknown>(
    url: string,
    config?: fluxhttpRequestConfig
  ): Promise<fluxhttpResponse<T>> {
    return this.request<T>(mergeConfig(config || {}, { method: 'DELETE', url }));
  }

  /**
   * Make a HEAD request
   * @async
   * @template T - Response data type
   * @param {string} url - Request URL
   * @param {fluxhttpRequestConfig} [config] - Additional configuration
   * @returns {Promise<fluxhttpResponse<T>>} Promise resolving to response
   * @example
   * ```typescript
   * const headers = await client.head('/api/resource');
   * ```
   */
  async head<T = unknown>(
    url: string,
    config?: fluxhttpRequestConfig
  ): Promise<fluxhttpResponse<T>> {
    return this.request<T>(mergeConfig(config || {}, { method: 'HEAD', url }));
  }

  /**
   * Make an OPTIONS request
   * @async
   * @template T - Response data type
   * @param {string} url - Request URL
   * @param {fluxhttpRequestConfig} [config] - Additional configuration
   * @returns {Promise<fluxhttpResponse<T>>} Promise resolving to response
   * @example
   * ```typescript
   * const options = await client.options('/api/resource');
   * ```
   */
  async options<T = unknown>(
    url: string,
    config?: fluxhttpRequestConfig
  ): Promise<fluxhttpResponse<T>> {
    return this.request<T>(mergeConfig(config || {}, { method: 'OPTIONS', url }));
  }

  /**
   * Make a POST request
   * @async
   * @template T - Response data type
   * @param {string} url - Request URL
   * @param {RequestBody} [data] - Request body data
   * @param {fluxhttpRequestConfig} [config] - Additional configuration
   * @returns {Promise<fluxhttpResponse<T>>} Promise resolving to response
   * @example
   * ```typescript
   * const newUser = await client.post('/api/users', {
   *   name: 'John Doe',
   *   email: 'john@example.com'
   * });
   * ```
   */
  async post<T = unknown>(
    url: string,
    data?: RequestBody,
    config?: fluxhttpRequestConfig
  ): Promise<fluxhttpResponse<T>> {
    return this.request<T>(mergeConfig(config || {}, { method: 'POST', url, data }));
  }

  /**
   * Make a PUT request
   * @async
   * @template T - Response data type
   * @param {string} url - Request URL
   * @param {RequestBody} [data] - Request body data
   * @param {fluxhttpRequestConfig} [config] - Additional configuration
   * @returns {Promise<fluxhttpResponse<T>>} Promise resolving to response
   * @example
   * ```typescript
   * const updatedUser = await client.put('/api/users/123', {
   *   name: 'Jane Doe',
   *   email: 'jane@example.com'
   * });
   * ```
   */
  async put<T = unknown>(
    url: string,
    data?: RequestBody,
    config?: fluxhttpRequestConfig
  ): Promise<fluxhttpResponse<T>> {
    return this.request<T>(mergeConfig(config || {}, { method: 'PUT', url, data }));
  }

  /**
   * Make a PATCH request
   * @async
   * @template T - Response data type
   * @param {string} url - Request URL
   * @param {RequestBody} [data] - Request body data
   * @param {fluxhttpRequestConfig} [config] - Additional configuration
   * @returns {Promise<fluxhttpResponse<T>>} Promise resolving to response
   * @example
   * ```typescript
   * const partialUpdate = await client.patch('/api/users/123', {
   *   email: 'newemail@example.com'
   * });
   * ```
   */
  async patch<T = unknown>(
    url: string,
    data?: RequestBody,
    config?: fluxhttpRequestConfig
  ): Promise<fluxhttpResponse<T>> {
    return this.request<T>(mergeConfig(config || {}, { method: 'PATCH', url, data }));
  }

  /**
   * Generate the full URI for a request configuration
   * @param {fluxhttpRequestConfig} [config] - Request configuration
   * @returns {string} Full request URI
   * @example
   * ```typescript
   * const uri = client.getUri({ url: '/api/users', params: { page: 1 } });
   * // Returns: 'https://api.example.com/api/users?page=1'
   * ```
   */
  getUri(config?: fluxhttpRequestConfig): string {
    config = mergeConfig(this.defaults, config);
    return buildFullPath(config.baseURL, config.url);
  }

  /**
   * Create a new fluxhttp instance with merged configuration
   * @param {fluxhttpRequestConfig} [config] - Configuration to merge with defaults
   * @returns {fluxhttpInstance} New fluxhttp instance
   * @example
   * ```typescript
   * const apiClient = client.create({
   *   baseURL: 'https://api.example.com/v2',
   *   headers: { 'X-API-Version': '2.0' }
   * });
   * ```
   */
  create(config?: fluxhttpRequestConfig): fluxhttpInstance {
    const mergedConfig = mergeConfig(this.defaults, config);
    return new fluxhttp(mergedConfig);
  }

  /**
   * Dispose of the fluxhttp instance and clean up all resources
   * This includes interceptors, caches, and any background timers
   * @example
   * ```typescript
   * // Clean up when done with the client
   * client.dispose();
   * ```
   */
  dispose(): void {
    if (this.disposed) {
      return;
    }

    this.disposed = true;

    // Dispose interceptor managers
    if (this.interceptors.request && typeof this.interceptors.request.dispose === 'function') {
      this.interceptors.request.dispose();
    }
    if (this.interceptors.response && typeof this.interceptors.response.dispose === 'function') {
      this.interceptors.response.dispose();
    }

    // Clear defaults to help with garbage collection
    this.defaults = {};
  }

  /**
   * Check if the instance has been disposed
   * @returns {boolean} True if disposed
   */
  isDisposed(): boolean {
    return this.disposed;
  }

  /**
   * Get memory usage statistics for this instance
   * @returns {object} Memory usage statistics
   */
  getMemoryStats(): {
    interceptors: {
      request: any;
      response: any;
    };
    disposed: boolean;
  } {
    return {
      interceptors: {
        request: this.interceptors.request && typeof this.interceptors.request.getStats === 'function' 
          ? this.interceptors.request.getStats() 
          : { size: this.interceptors.request?.size || 0 },
        response: this.interceptors.response && typeof this.interceptors.response.getStats === 'function'
          ? this.interceptors.response.getStats()
          : { size: this.interceptors.response?.size || 0 },
      },
      disposed: this.disposed,
    };
  }
}
