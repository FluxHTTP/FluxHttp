import type { fluxhttpRequestConfig, fluxhttpResponse, FluxProgressEvent } from '../types';
import { createError, createTimeoutError, createNetworkError, createCancelError } from '../errors';
import { buildURL } from '../utils/url';
import { transformRequestData } from '../utils/data';

// Type-safe JSON parser
function parseJSON(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

// Type guard for validating response type
function isValidResponseType(responseType?: string): responseType is XMLHttpRequestResponseType {
  const validTypes: readonly string[] = ['', 'arraybuffer', 'blob', 'document', 'json', 'text'];
  return responseType === undefined || validTypes.includes(responseType);
}

// Type guard for validating response data
function validateResponseData<T>(data: unknown, responseType?: string): data is T {
  if (responseType === 'arraybuffer') {
    return data instanceof ArrayBuffer;
  }
  if (responseType === 'blob') {
    return data instanceof Blob;
  }
  if (responseType === 'document') {
    return data instanceof Document || data === null;
  }
  // For json and text, we accept any type since they could be anything
  return true;
}

// Helper to safely get response data
function getResponseData<T>(xhr: XMLHttpRequest, responseType?: string): T {
  let data: unknown;

  if (responseType === 'json') {
    // For JSON, we parse the text ourselves to handle errors gracefully
    data = parseJSON(xhr.responseText);
  } else {
    // For other types, use xhr.response
    data = xhr.response;
  }

  if (!validateResponseData<T>(data, responseType)) {
    throw new Error(`Invalid response data type for responseType: ${responseType || 'default'}`);
  }

  return data;
}

// Helper to parse headers safely
function parseResponseHeaders(headerString: string): Record<string, string> {
  const headers: Record<string, string> = {};

  if (!headerString) {
    return headers;
  }

  const headerLines = headerString.split(/\r?\n/);

  headerLines.forEach((line) => {
    const trimmedLine = line.trim();
    if (!trimmedLine) return;

    const colonIndex = trimmedLine.indexOf(':');
    if (colonIndex === -1) return;

    const key = trimmedLine.substring(0, colonIndex).trim().toLowerCase();
    const value = trimmedLine.substring(colonIndex + 1).trim();

    if (key) {
      headers[key] = value;
    }
  });

  return headers;
}

// Type guard for XMLHttpRequestBodyInit
function isValidRequestBody(data: unknown): data is XMLHttpRequestBodyInit {
  return (
    data === null ||
    data === undefined ||
    typeof data === 'string' ||
    data instanceof FormData ||
    data instanceof URLSearchParams ||
    data instanceof Blob ||
    data instanceof ArrayBuffer ||
    (typeof data === 'object' && data !== null && 'buffer' in data) // Buffer-like
  );
}

// SECURITY: Validate HTTP header names (RFC 7230)
function isValidHeaderName(name: string): boolean {
  if (!name || typeof name !== 'string') {
    return false;
  }

  // RFC 7230 token characters
  const tokenRegex = /^[!#$%&'*+\-.0-9A-Z^_`a-z|~]+$/;
  return tokenRegex.test(name);
}

// SECURITY: Validate HTTP header values (RFC 7230)
function isValidHeaderValue(value: string): boolean {
  if (typeof value !== 'string') {
    return false;
  }

  // Check for control characters that could cause header injection
  const controlChars = /[\x00-\x1F\x7F]/;
  if (controlChars.test(value)) {
    return false;
  }

  // Check for CRLF sequences that could cause response splitting
  if (value.includes('\r') || value.includes('\n')) {
    return false;
  }

  // Check for suspicious patterns
  const suspiciousPatterns = [
    /HTTP\/\d\.\d/,        // HTTP response line
    /:\s*[\r\n]/,          // Header field ending
    /\r\n\r\n/,            // End of headers
  ];

  return !suspiciousPatterns.some(pattern => pattern.test(value));
}

export function xhrAdapter<T = unknown>(
  config: fluxhttpRequestConfig
): Promise<fluxhttpResponse<T>> {
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
      cancelToken,
    } = config;

    // Check if request is already canceled
    if (cancelToken) {
      cancelToken.throwIfRequested();
    }

    const xhr = new XMLHttpRequest();
    const fullURL = buildURL(url || '', config.params);

    xhr.open(method.toUpperCase(), fullURL, true);

    xhr.timeout = timeout || 0;
    xhr.withCredentials = withCredentials || false;

    // Set response type safely
    if (responseType && responseType !== 'json' && isValidResponseType(responseType)) {
      xhr.responseType = responseType;
    }

    // Set headers safely with validation
    Object.entries(headers).forEach(([key, value]) => {
      if (value !== undefined) {
        // SECURITY: Validate header name and value
        if (!isValidHeaderName(key)) {
          throw new Error(`Invalid header name: ${key}`);
        }
        
        const headerValue = Array.isArray(value) ? value.join(', ') : String(value);
        
        if (!isValidHeaderValue(headerValue)) {
          throw new Error(`Invalid header value for ${key}: ${headerValue}`);
        }
        
        xhr.setRequestHeader(key, headerValue);
      }
    });

    // BUG-007 FIX: Declare cleanup wrappers before using them
    let resolveWithCleanup: (response: fluxhttpResponse<T>) => void;
    let rejectWithCleanup: (error: unknown) => void;

    xhr.onloadend = (): void => {
      if (!xhr) return;

      try {
        const responseHeaders = parseResponseHeaders(xhr.getAllResponseHeaders());
        const responseData = getResponseData<T>(xhr, responseType);

        const response: fluxhttpResponse<T> = {
          data: responseData,
          status: xhr.status,
          statusText: xhr.statusText,
          headers: responseHeaders,
          config,
          request: xhr,
        };

        const validateStatus =
          config.validateStatus || ((status: number): boolean => status >= 200 && status < 300);

        if (validateStatus(xhr.status)) {
          resolveWithCleanup(response);
        } else {
          rejectWithCleanup(
            createError(
              `Request failed with status ${xhr.status}`,
              'ERR_BAD_RESPONSE',
              config,
              xhr,
              response
            )
          );
        }
      } catch (error) {
        rejectWithCleanup(
          createError(
            error instanceof Error ? error.message : 'Failed to parse response',
            'ERR_PARSE_RESPONSE',
            config,
            xhr
          )
        );
      }
    };

    xhr.onerror = (): void => {
      rejectWithCleanup(createNetworkError('Network Error', config, xhr));
    };

    xhr.ontimeout = (): void => {
      rejectWithCleanup(createTimeoutError(config, xhr));
    };

    // Progress handlers
    if (onDownloadProgress) {
      xhr.onprogress = (event: ProgressEvent<EventTarget>): void => {
        const progressEvent: FluxProgressEvent = {
          loaded: event.loaded,
          total: event.total,
          lengthComputable: event.lengthComputable,
          bytes: event.loaded,
        };
        onDownloadProgress(progressEvent);
      };
    }

    if (onUploadProgress && xhr.upload) {
      xhr.upload.onprogress = (event: ProgressEvent<EventTarget>): void => {
        const progressEvent: FluxProgressEvent = {
          loaded: event.loaded,
          total: event.total,
          lengthComputable: event.lengthComputable,
          bytes: event.loaded,
        };
        onUploadProgress(progressEvent);
      };
    }

    // BUG-007 FIX: Create cleanup function to remove event listeners and prevent memory leaks
    const abortHandlers: Array<() => void> = [];
    let isRequestComplete = false;

    const cleanup = (): void => {
      isRequestComplete = true;
      // Remove all abort handlers
      abortHandlers.forEach(handler => handler());
      abortHandlers.length = 0;
    };

    // Wrap resolve/reject to ensure cleanup
    resolveWithCleanup = (response: fluxhttpResponse<T>): void => {
      cleanup();
      resolve(response);
    };

    rejectWithCleanup = (error: unknown): void => {
      cleanup();
      reject(error);
    };

    // Handle signal abort
    if (signal) {
      const abortHandler = (): void => {
        xhr.abort();
        rejectWithCleanup(createCancelError('Request aborted', config));
      };
      signal.addEventListener('abort', abortHandler);
      abortHandlers.push(() => signal.removeEventListener('abort', abortHandler));
    }

    // Handle cancel token
    if (cancelToken) {
      const cancelPromise = cancelToken.promise.then((cancel) => {
        xhr.abort();
        rejectWithCleanup(createCancelError(cancel.message, config));
      });
      // Store promise for potential cleanup (though promises can't be truly cancelled)
      void cancelPromise;
    }

    // Transform and send request data
    const requestData = transformRequestData(data);

    if (requestData !== null && !['GET', 'HEAD'].includes(method.toUpperCase())) {
      if (isValidRequestBody(requestData)) {
        xhr.send(requestData);
      } else {
        // Convert to string if not a valid body type
        xhr.send(JSON.stringify(requestData));
      }
    } else {
      xhr.send();
    }
  });
}
