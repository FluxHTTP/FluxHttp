import type { FluxHTTPRequestConfig, FluxHTTPResponse } from '../types';
import { createError, createTimeoutError, createNetworkError, createCancelError } from '../errors';
import { buildURL } from '../utils/url';
import { transformRequestData } from '../utils/data';

export function fetchAdapter<T = unknown>(
  config: FluxHTTPRequestConfig
): Promise<FluxHTTPResponse<T>> {
  return new Promise<FluxHTTPResponse<T>>((resolve, reject) => {
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
      } = config;

      if (!url) {
        return reject(createError('URL is required', config, 'ERR_INVALID_URL'));
      }

      const fullURL = buildURL(url, config.params);
      const controller = new AbortController();
      const fetchSignal = signal || controller.signal;

      const fetchOptions: RequestInit = {
        method: method.toUpperCase(),
        headers: new Headers(headers as HeadersInit),
        signal: fetchSignal,
        credentials: withCredentials ? 'include' : 'same-origin',
      };

      const requestData = transformRequestData(data);
      if (requestData && method !== 'GET' && method !== 'HEAD') {
        fetchOptions.body = requestData as BodyInit;
      }

      let timeoutId: NodeJS.Timeout | undefined;

      if (timeout) {
        timeoutId = setTimeout(() => {
          controller.abort();
          reject(createTimeoutError(config));
        }, timeout);
      }

      try {
        const response = await fetch(fullURL, fetchOptions);

        if (timeoutId) {
          clearTimeout(timeoutId);
        }

        const responseHeaders: Record<string, string> = {};
        response.headers.forEach((value, key) => {
          responseHeaders[key.toLowerCase()] = value;
        });

        let responseData: T;

        if (responseType === 'blob') {
          responseData = (await response.blob()) as T;
        } else if (responseType === 'arraybuffer') {
          responseData = (await response.arrayBuffer()) as T;
        } else if (responseType === 'stream') {
          responseData = response.body as T;
        } else if (responseType === 'json') {
          try {
            responseData = (await response.json()) as T;
          } catch {
            responseData = (await response.text()) as T;
          }
        } else {
          // Default behavior: try to parse JSON if content-type is json
          const contentType = response.headers.get('content-type');
          if (!responseType && contentType && contentType.includes('application/json')) {
            try {
              responseData = (await response.json()) as T;
            } catch {
              responseData = (await response.text()) as T;
            }
          } else {
            responseData = (await response.text()) as T;
          }
        }

        const httpResponse: FluxHTTPResponse<T> = {
          data: responseData,
          status: response.status,
          statusText: response.statusText,
          headers: responseHeaders,
          config,
          request: fetchOptions,
        };

        const validateStatus =
          config.validateStatus || ((status: number): boolean => status >= 200 && status < 300);

        if (validateStatus(response.status)) {
          resolve(httpResponse);
        } else {
          reject(
            createError(
              `Request failed with status code ${response.status}`,
              config,
              'ERR_BAD_RESPONSE',
              fetchOptions,
              httpResponse
            )
          );
        }
      } catch (error) {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }

        if (error instanceof Error) {
          if (error.name === 'AbortError') {
            reject(createCancelError('Request aborted', config));
          } else {
            reject(createNetworkError(error.message, config));
          }
        } else {
          reject(createError('Unknown error occurred', config, 'ERR_UNKNOWN'));
        }
      }
    };

    // Execute the async request
    void executeRequest();
  });
}
