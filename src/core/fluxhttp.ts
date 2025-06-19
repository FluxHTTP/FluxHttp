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
import { mergeConfig } from './mergeConfig';
import { buildFullPath } from '../utils/url';
import { defaults } from './defaults';

// Type guard to validate HTTP method
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

export class fluxhttp implements fluxhttpInstance {
  defaults: fluxhttpRequestConfig;
  interceptors: {
    request: InterceptorManager<fluxhttpRequestConfig>;
    response: InterceptorManager<fluxhttpResponse>;
  };
  private adapter: Adapter;

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

  async get<T = unknown>(
    url: string,
    config?: fluxhttpRequestConfig
  ): Promise<fluxhttpResponse<T>> {
    return this.request<T>(mergeConfig(config || {}, { method: 'GET', url }));
  }

  async delete<T = unknown>(
    url: string,
    config?: fluxhttpRequestConfig
  ): Promise<fluxhttpResponse<T>> {
    return this.request<T>(mergeConfig(config || {}, { method: 'DELETE', url }));
  }

  async head<T = unknown>(
    url: string,
    config?: fluxhttpRequestConfig
  ): Promise<fluxhttpResponse<T>> {
    return this.request<T>(mergeConfig(config || {}, { method: 'HEAD', url }));
  }

  async options<T = unknown>(
    url: string,
    config?: fluxhttpRequestConfig
  ): Promise<fluxhttpResponse<T>> {
    return this.request<T>(mergeConfig(config || {}, { method: 'OPTIONS', url }));
  }

  async post<T = unknown>(
    url: string,
    data?: RequestBody,
    config?: fluxhttpRequestConfig
  ): Promise<fluxhttpResponse<T>> {
    return this.request<T>(mergeConfig(config || {}, { method: 'POST', url, data }));
  }

  async put<T = unknown>(
    url: string,
    data?: RequestBody,
    config?: fluxhttpRequestConfig
  ): Promise<fluxhttpResponse<T>> {
    return this.request<T>(mergeConfig(config || {}, { method: 'PUT', url, data }));
  }

  async patch<T = unknown>(
    url: string,
    data?: RequestBody,
    config?: fluxhttpRequestConfig
  ): Promise<fluxhttpResponse<T>> {
    return this.request<T>(mergeConfig(config || {}, { method: 'PATCH', url, data }));
  }

  getUri(config?: fluxhttpRequestConfig): string {
    config = mergeConfig(this.defaults, config);
    return buildFullPath(config.baseURL, config.url);
  }

  create(config?: fluxhttpRequestConfig): fluxhttpInstance {
    const mergedConfig = mergeConfig(this.defaults, config);
    return new fluxhttp(mergedConfig);
  }
}
