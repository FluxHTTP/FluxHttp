import type { FluxHTTPRequestConfig, FluxHTTPResponse } from '../types';

export type Adapter = <T = unknown>(config: FluxHTTPRequestConfig) => Promise<FluxHTTPResponse<T>>;

export { xhrAdapter } from './xhr.adapter';
export { httpAdapter } from './http.adapter';
export { fetchAdapter } from './fetch.adapter';

export function getDefaultAdapter(): Adapter {
  let adapter: Adapter;

  if (typeof XMLHttpRequest !== 'undefined') {
    // Browser environment
    adapter = async function xhrAdapterWrapper<T = unknown>(
      config: FluxHTTPRequestConfig
    ): Promise<FluxHTTPResponse<T>> {
      const { xhrAdapter } = await import('./xhr.adapter');
      return xhrAdapter<T>(config);
    };
  } else if (typeof process !== 'undefined' && process.versions && process.versions.node) {
    // Node.js environment
    adapter = async function httpAdapterWrapper<T = unknown>(
      config: FluxHTTPRequestConfig
    ): Promise<FluxHTTPResponse<T>> {
      const { httpAdapter } = await import('./http.adapter');
      return httpAdapter<T>(config);
    };
  } else if (typeof fetch !== 'undefined') {
    // Modern runtime environment
    adapter = async function fetchAdapterWrapper<T = unknown>(
      config: FluxHTTPRequestConfig
    ): Promise<FluxHTTPResponse<T>> {
      const { fetchAdapter } = await import('./fetch.adapter');
      return fetchAdapter<T>(config);
    };
  } else {
    throw new Error('No suitable adapter found for the current environment');
  }

  return adapter;
}
