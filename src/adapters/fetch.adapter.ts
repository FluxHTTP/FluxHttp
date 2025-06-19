import type { fluxhttpRequestConfig, fluxhttpResponse } from '../types';
import {
  createError,
  createTimeoutError,
  createNetworkError,
  createCancelError,
  createResponseError,
} from '../errors';
import { buildURL } from '../utils/url';
import { transformRequestData } from '../utils/data';

// Type guard for validating response data
function validateResponseData<T>(data: unknown, responseType?: string): data is T {
  if (responseType === 'blob') {
    return data instanceof Blob;
  }
  if (responseType === 'arraybuffer') {
    return data instanceof ArrayBuffer;
  }
  if (responseType === 'stream') {
    return data instanceof ReadableStream || data === null;
  }
  // For json and text, we accept any type since they could be anything
  return true;
}

// Helper to safely parse response based on type
async function parseResponse<T>(response: Response, responseType?: string): Promise<T> {
  let data: unknown;

  if (responseType === 'blob') {
    data = await response.blob();
  } else if (responseType === 'arraybuffer') {
    data = await response.arrayBuffer();
  } else if (responseType === 'stream') {
    data = response.body;
  } else if (responseType === 'json') {
    try {
      data = await response.json();
    } catch {
      data = await response.text();
    }
  } else {
    // Default behavior: try to parse JSON if content-type is json
    const contentType = response.headers.get('content-type');
    if (!responseType && contentType && contentType.includes('application/json')) {
      try {
        data = await response.json();
      } catch {
        data = await response.text();
      }
    } else {
      data = await response.text();
    }
  }

  if (!validateResponseData<T>(data, responseType)) {
    throw new Error(`Invalid response data type for responseType: ${responseType || 'default'}`);
  }

  return data;
}

export function fetchAdapter<T = unknown>(
  config: fluxhttpRequestConfig
): Promise<fluxhttpResponse<T>> {
  return new Promise<fluxhttpResponse<T>>((resolve, reject) => {
    const executeRequest = async (): Promise<void> => {
      const {
        data,
        url,
        method = 'GET',
        headers = {},
        timeout,
        withCredentials,
        responseType,
        signal,
        cancelToken,
      } = config;

      if (!url) {
        return reject(createError('URL is required', 'ERR_INVALID_URL', config));
      }

      const fullURL = buildURL(url, config.params);
      const controller = new AbortController();

      // Check if request is already canceled
      if (cancelToken) {
        cancelToken.throwIfRequested();
      }

      const fetchSignal = signal || controller.signal;

      // Convert headers to proper format
      const headersInit: HeadersInit = {};
      Object.entries(headers).forEach(([key, value]) => {
        if (value !== undefined) {
          headersInit[key] = Array.isArray(value) ? value.join(', ') : String(value);
        }
      });

      const fetchOptions: RequestInit = {
        method: method.toUpperCase(),
        headers: new Headers(headersInit),
        signal: fetchSignal,
        credentials: withCredentials ? 'include' : 'same-origin',
      };

      // Transform and set request body
      const requestData = transformRequestData(data);
      if (requestData !== null && !['GET', 'HEAD'].includes(method)) {
        // Validate request body type
        if (
          requestData instanceof FormData ||
          requestData instanceof URLSearchParams ||
          requestData instanceof Blob ||
          requestData instanceof ArrayBuffer ||
          requestData instanceof ReadableStream ||
          typeof requestData === 'string'
        ) {
          fetchOptions.body = requestData;
        } else {
          fetchOptions.body = JSON.stringify(requestData);
        }
      }

      // Set timeout
      let timeoutId: NodeJS.Timeout | undefined;
      if (timeout) {
        timeoutId = setTimeout(() => {
          controller.abort();
          reject(createTimeoutError(config));
        }, timeout);
      }

      // Cancel token subscription
      if (cancelToken) {
        void cancelToken.promise.then((cancel) => {
          controller.abort();
          reject(createCancelError(cancel.message, config));
        });
      }

      try {
        const response = await fetch(fullURL, fetchOptions);

        if (timeoutId) {
          clearTimeout(timeoutId);
        }

        // Parse response data safely
        const responseData = await parseResponse<T>(response, responseType);

        const httpResponse: fluxhttpResponse<T> = {
          data: responseData,
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(Array.from((response.headers as any).entries())),
          config,
          request: response,
        };

        if (config.validateStatus ? config.validateStatus(response.status) : response.ok) {
          resolve(httpResponse);
        } else {
          reject(
            createResponseError(
              `Request failed with status ${response.status}`,
              config,
              httpResponse,
              response
            )
          );
        }
      } catch (error) {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }

        if (error instanceof Error) {
          if (error.name === 'AbortError') {
            reject(createTimeoutError(config));
          } else if (error.message.includes('network')) {
            reject(createNetworkError(error.message, config));
          } else {
            reject(createError(error.message, 'ERR_NETWORK', config));
          }
        } else {
          reject(createError('Unknown error occurred', 'ERR_UNKNOWN', config));
        }
      }
    };

    void executeRequest();
  });
}
