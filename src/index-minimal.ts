/**
 * @module @fluxhttp/core - Minimal Build
 * @description Ultra-lightweight HTTP client with essential functionality only
 */

// Minimal types
type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS';
type Headers = Record<string, string>;

interface RequestConfig {
  url?: string;
  method?: HttpMethod;
  baseURL?: string;
  headers?: Headers;
  data?: unknown;
  params?: Record<string, unknown>;
  timeout?: number;
}

interface Response<T = unknown> {
  data: T;
  status: number;
  statusText: string;
  headers: Headers;
  config: RequestConfig;
}

// Minimal error class
class FluxHTTPError extends Error {
  constructor(
    message: string,
    public code?: string,
    public config?: RequestConfig,
    public response?: Response
  ) {
    super(message);
    this.name = 'FluxHTTPError';
  }
}

// Simple URL building
function buildURL(url: string, params?: Record<string, unknown>): string {
  if (!params) return url;
  
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value != null) searchParams.append(key, String(value));
  });
  
  const separator = url.includes('?') ? '&' : '?';
  return url + separator + searchParams.toString();
}

function combineURLs(base: string, url: string): string {
  if (/^https?:\/\//.test(url)) return url;
  const cleanBase = base.replace(/\/+$/, '');
  const cleanUrl = url.replace(/^\/+/, '');
  return `${cleanBase}/${cleanUrl}`;
}

// Fetch adapter
async function fetchAdapter<T>(config: RequestConfig): Promise<Response<T>> {
  const { url = '', method = 'GET', headers = {}, data, timeout = 0, baseURL } = config;
  
  const fullURL = baseURL ? combineURLs(baseURL, url) : url;
  const finalURL = buildURL(fullURL, config.params);
  
  const controller = new AbortController();
  const timeoutId = timeout > 0 ? setTimeout(() => controller.abort(), timeout) : null;
  
  try {
    const response = await fetch(finalURL, {
      method,
      headers,
      body: data ? JSON.stringify(data) : undefined,
      signal: controller.signal,
    });
    
    if (timeoutId) clearTimeout(timeoutId);
    
    const responseHeaders: Headers = {};
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });
    
    let responseData: T;
    const contentType = response.headers.get('content-type') || '';
    
    if (contentType.includes('application/json')) {
      responseData = await response.json();
    } else {
      responseData = (await response.text()) as unknown as T;
    }
    
    return {
      data: responseData,
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
      config,
    };
  } catch (error) {
    if (timeoutId) clearTimeout(timeoutId);
    
    if (error instanceof Error && error.name === 'AbortError') {
      throw new FluxHTTPError('Request timeout', 'TIMEOUT', config);
    }
    
    throw new FluxHTTPError('Network Error', 'NETWORK_ERROR', config);
  }
}

// XHR adapter for older browsers
async function xhrAdapter<T>(config: RequestConfig): Promise<Response<T>> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const { url = '', method = 'GET', headers = {}, data, timeout = 0, baseURL } = config;
    
    const fullURL = baseURL ? combineURLs(baseURL, url) : url;
    const finalURL = buildURL(fullURL, config.params);
    
    xhr.open(method, finalURL);
    xhr.timeout = timeout;
    
    Object.entries(headers).forEach(([key, value]) => {
      xhr.setRequestHeader(key, value);
    });
    
    xhr.onload = () => {
      const responseHeaders: Headers = {};
      xhr.getAllResponseHeaders().split('\r\n').forEach(line => {
        const [key, value] = line.split(': ');
        if (key && value) responseHeaders[key.toLowerCase()] = value;
      });
      
      let responseData: T;
      try {
        responseData = JSON.parse(xhr.responseText);
      } catch {
        responseData = xhr.responseText as unknown as T;
      }
      
      resolve({
        data: responseData,
        status: xhr.status,
        statusText: xhr.statusText,
        headers: responseHeaders,
        config,
      });
    };
    
    xhr.onerror = () => reject(new FluxHTTPError('Network Error', 'NETWORK_ERROR', config));
    xhr.ontimeout = () => reject(new FluxHTTPError('Request timeout', 'TIMEOUT', config));
    
    xhr.send(data ? JSON.stringify(data) : undefined);
  });
}

// Auto-detect adapter
function getAdapter() {
  if (typeof fetch !== 'undefined') return fetchAdapter;
  if (typeof XMLHttpRequest !== 'undefined') return xhrAdapter;
  throw new Error('No suitable HTTP adapter found');
}

// Main client class
class FluxHTTP {
  private adapter = getAdapter();
  private defaults: RequestConfig = {};

  constructor(defaultConfig: RequestConfig = {}) {
    this.defaults = { ...defaultConfig };
  }

  private mergeConfig(config: RequestConfig): RequestConfig {
    return {
      ...this.defaults,
      ...config,
      headers: { ...this.defaults.headers, ...config.headers },
    };
  }

  async request<T = unknown>(config: RequestConfig): Promise<Response<T>> {
    const mergedConfig = this.mergeConfig(config);
    return this.adapter(mergedConfig);
  }

  async get<T = unknown>(url: string, config?: RequestConfig): Promise<Response<T>> {
    return this.request<T>({ ...config, method: 'GET', url });
  }

  async post<T = unknown>(url: string, data?: unknown, config?: RequestConfig): Promise<Response<T>> {
    return this.request<T>({ ...config, method: 'POST', url, data });
  }

  async put<T = unknown>(url: string, data?: unknown, config?: RequestConfig): Promise<Response<T>> {
    return this.request<T>({ ...config, method: 'PUT', url, data });
  }

  async delete<T = unknown>(url: string, config?: RequestConfig): Promise<Response<T>> {
    return this.request<T>({ ...config, method: 'DELETE', url });
  }

  async patch<T = unknown>(url: string, data?: unknown, config?: RequestConfig): Promise<Response<T>> {
    return this.request<T>({ ...config, method: 'PATCH', url, data });
  }

  async head<T = unknown>(url: string, config?: RequestConfig): Promise<Response<T>> {
    return this.request<T>({ ...config, method: 'HEAD', url });
  }

  async options<T = unknown>(url: string, config?: RequestConfig): Promise<Response<T>> {
    return this.request<T>({ ...config, method: 'OPTIONS', url });
  }

  create(config: RequestConfig): FluxHTTP {
    return new FluxHTTP({ ...this.defaults, ...config });
  }
}

// Default instance
const fluxhttp = new FluxHTTP();

// Export default instance
export default fluxhttp;

// Named exports
export const create = (config?: RequestConfig) => new FluxHTTP(config);
export { FluxHTTPError as fluxhttpError };

// Types
export type {
  RequestConfig as fluxhttpRequestConfig,
  Response as fluxhttpResponse,
  HttpMethod,
  Headers,
};