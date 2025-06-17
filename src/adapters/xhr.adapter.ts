import type { FluxHTTPRequestConfig, FluxHTTPResponse } from '../types';
import { createError, createTimeoutError, createNetworkError, createCancelError } from '../errors';
import { buildURL } from '../utils/url';
import { transformRequestData } from '../utils/data';

export function xhrAdapter<T = unknown>(
  config: FluxHTTPRequestConfig
): Promise<FluxHTTPResponse<T>> {
  return new Promise((resolve, reject) => {
    const {
      data,
      url,
      method = 'GET',
      headers = {},
      timeout,
      withCredentials,
      responseType,
      onDownloadProgress,
      onUploadProgress,
      signal,
    } = config;

    const xhr = new XMLHttpRequest();
    const fullURL = buildURL(url || '', config.params);

    xhr.open(method.toUpperCase(), fullURL, true);

    xhr.timeout = timeout || 0;
    xhr.withCredentials = withCredentials || false;

    if (responseType && responseType !== 'json') {
      xhr.responseType = responseType as XMLHttpRequestResponseType;
    }

    Object.entries(headers).forEach(([key, value]) => {
      if (value !== undefined) {
        xhr.setRequestHeader(key, String(value));
      }
    });

    xhr.onloadend = (): void => {
      if (!xhr) return;

      const responseHeaders: Record<string, string> = {};
      const headerLines = xhr.getAllResponseHeaders().split('\r\n');

      headerLines.forEach((line) => {
        const [key, ...values] = line.split(':');
        if (key) {
          responseHeaders[key.trim().toLowerCase()] = values.join(':').trim();
        }
      });

      const response: FluxHTTPResponse<T> = {
        data: (responseType === 'json' ? parseJSON(xhr.responseText) : xhr.response) as T,
        status: xhr.status,
        statusText: xhr.statusText,
        headers: responseHeaders,
        config,
        request: xhr,
      };

      const validateStatus =
        config.validateStatus || ((status: number): boolean => status >= 200 && status < 300);

      if (validateStatus(xhr.status)) {
        resolve(response);
      } else {
        reject(
          createError(
            `Request failed with status code ${xhr.status}`,
            config,
            'ERR_BAD_RESPONSE',
            xhr,
            response
          )
        );
      }
    };

    xhr.onerror = (): void => {
      reject(createNetworkError('Network Error', config, xhr));
    };

    xhr.ontimeout = (): void => {
      reject(createTimeoutError(config, xhr));
    };

    if (signal) {
      signal.addEventListener('abort', () => {
        xhr.abort();
        reject(createCancelError('Request aborted', config));
      });
    }

    if (onDownloadProgress) {
      xhr.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          onDownloadProgress({
            loaded: e.loaded,
            total: e.total,
            progress: e.total > 0 ? e.loaded / e.total : 0,
            bytes: e.loaded,
          });
        }
      });
    }

    if (onUploadProgress && xhr.upload) {
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          onUploadProgress({
            loaded: e.loaded,
            total: e.total,
            progress: e.total > 0 ? e.loaded / e.total : 0,
            bytes: e.loaded,
            upload: true,
          });
        }
      });
    }

    const requestData = transformRequestData(data);
    xhr.send(requestData as XMLHttpRequestBodyInit);
  });
}

function parseJSON(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
