import type {
  FluxHTTPInstance,
  FluxHTTPRequestConfig,
  FluxHTTPResponse,
  RequestBody,
} from '../types';
import { InterceptorManager } from '../interceptors/InterceptorManager';
import { dispatchRequest } from '../interceptors/dispatchRequest';
import { getDefaultAdapter, type Adapter } from '../adapters';
import { mergeConfig } from './mergeConfig';
import { buildFullPath } from './buildFullPath';

export class FluxHTTP implements FluxHTTPInstance {
  defaults: FluxHTTPRequestConfig;
  interceptors: {
    request: InterceptorManager<FluxHTTPRequestConfig>;
    response: InterceptorManager<FluxHTTPResponse>;
  };
  private adapter: Adapter;

  constructor(defaultConfig: FluxHTTPRequestConfig = {}) {
    this.defaults = defaultConfig;
    this.interceptors = {
      request: new InterceptorManager<FluxHTTPRequestConfig>(),
      response: new InterceptorManager<FluxHTTPResponse>(),
    };
    this.adapter = defaultConfig.adapter || getDefaultAdapter();
  }

  async request<T = unknown>(config: FluxHTTPRequestConfig): Promise<FluxHTTPResponse<T>> {
    config = mergeConfig(this.defaults, config);

    config.url = buildFullPath(config.baseURL, config.url);

    config.method = (config.method || 'GET').toUpperCase() as FluxHTTPRequestConfig['method'];

    return dispatchRequest<T>(
      config,
      this.interceptors.request,
      this.interceptors.response,
      this.adapter
    );
  }

  async get<T = unknown>(
    url: string,
    config?: FluxHTTPRequestConfig
  ): Promise<FluxHTTPResponse<T>> {
    return this.request<T>(mergeConfig(config || {}, { method: 'GET', url }));
  }

  async delete<T = unknown>(
    url: string,
    config?: FluxHTTPRequestConfig
  ): Promise<FluxHTTPResponse<T>> {
    return this.request<T>(mergeConfig(config || {}, { method: 'DELETE', url }));
  }

  async head<T = unknown>(
    url: string,
    config?: FluxHTTPRequestConfig
  ): Promise<FluxHTTPResponse<T>> {
    return this.request<T>(mergeConfig(config || {}, { method: 'HEAD', url }));
  }

  async options<T = unknown>(
    url: string,
    config?: FluxHTTPRequestConfig
  ): Promise<FluxHTTPResponse<T>> {
    return this.request<T>(mergeConfig(config || {}, { method: 'OPTIONS', url }));
  }

  async post<T = unknown>(
    url: string,
    data?: RequestBody,
    config?: FluxHTTPRequestConfig
  ): Promise<FluxHTTPResponse<T>> {
    return this.request<T>(mergeConfig(config || {}, { method: 'POST', url, data }));
  }

  async put<T = unknown>(
    url: string,
    data?: RequestBody,
    config?: FluxHTTPRequestConfig
  ): Promise<FluxHTTPResponse<T>> {
    return this.request<T>(mergeConfig(config || {}, { method: 'PUT', url, data }));
  }

  async patch<T = unknown>(
    url: string,
    data?: RequestBody,
    config?: FluxHTTPRequestConfig
  ): Promise<FluxHTTPResponse<T>> {
    return this.request<T>(mergeConfig(config || {}, { method: 'PATCH', url, data }));
  }

  getUri(config?: FluxHTTPRequestConfig): string {
    config = mergeConfig(this.defaults, config);
    return buildFullPath(config.baseURL, config.url);
  }
}
