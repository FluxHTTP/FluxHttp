import type { fluxhttpRequestConfig, fluxhttpResponse } from '../types';

export type Adapter = <T = unknown>(config: fluxhttpRequestConfig) => Promise<fluxhttpResponse<T>>;

export { xhrAdapter } from './xhr.adapter';
export { httpAdapter } from './http.adapter';
export { fetchAdapter } from './fetch.adapter';
export { mockAdapter, createMockAdapter, MockAdapter } from './mock.adapter';

export function getDefaultAdapter(): Adapter {
  let adapter: Adapter;

  if (typeof XMLHttpRequest !== 'undefined') {
    // Browser environment
    adapter = async function xhrAdapterWrapper<T = unknown>(
      config: fluxhttpRequestConfig
    ): Promise<fluxhttpResponse<T>> {
      const { xhrAdapter } = await import('./xhr.adapter');
      return xhrAdapter<T>(config);
    };
  } else if (typeof process !== 'undefined' && process && typeof process.versions === 'object' && process.versions && process.versions.node) {
    // Node.js environment
    adapter = async function httpAdapterWrapper<T = unknown>(
      config: fluxhttpRequestConfig
    ): Promise<fluxhttpResponse<T>> {
      const { httpAdapter } = await import('./http.adapter');
      return httpAdapter<T>(config);
    };
  } else if (typeof fetch !== 'undefined') {
    // Modern runtime environment
    adapter = async function fetchAdapterWrapper<T = unknown>(
      config: fluxhttpRequestConfig
    ): Promise<fluxhttpResponse<T>> {
      const { fetchAdapter } = await import('./fetch.adapter');
      return fetchAdapter<T>(config);
    };
  } else {
    throw new Error('No suitable adapter found for the current environment');
  }

  return adapter;
}
