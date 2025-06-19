import * as http from 'http';
import * as https from 'https';
import * as url from 'url';
import * as zlib from 'zlib';
import type { fluxhttpRequestConfig, fluxhttpResponse, FluxProgressEvent } from '../types';
import { createError, createTimeoutError, createNetworkError, createCancelError } from '../errors';
import { buildURL } from '../utils/url';
import { transformRequestData, isStream } from '../utils/data';

// Type-safe JSON parser
function parseJSON(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

// Type guard for validating response data
function validateResponseData<T>(data: unknown, responseType?: string): data is T {
  if (responseType === 'arraybuffer') {
    return data instanceof ArrayBuffer || Buffer.isBuffer(data);
  }
  if (responseType === 'stream') {
    return Boolean(data && typeof data === 'object' && 'pipe' in data);
  }
  // For json and text, we accept any type since they could be anything
  return true;
}

// Helper to safely parse response based on type
function parseResponseData<T>(
  buffer: Buffer,
  responseType?: string,
  res?: http.IncomingMessage
): T {
  let data: unknown;

  if (responseType === 'arraybuffer') {
    data = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
  } else if (responseType === 'stream') {
    data = res;
  } else {
    const text = buffer.toString('utf-8');
    data = responseType === 'json' ? parseJSON(text) : text;
  }

  if (!validateResponseData<T>(data, responseType)) {
    throw new Error(`Invalid response data type for responseType: ${responseType || 'default'}`);
  }

  return data;
}

// Helper to normalize headers to string values
function normalizeHeaders(
  headers: Record<string, string | string[] | undefined>
): Record<string, string> {
  const normalized: Record<string, string> = {};
  Object.entries(headers).forEach(([key, value]) => {
    if (value !== undefined) {
      normalized[key] = Array.isArray(value) ? value.join(', ') : String(value);
    }
  });
  return normalized;
}

export function httpAdapter<T = unknown>(
  config: fluxhttpRequestConfig
): Promise<fluxhttpResponse<T>> {
  return new Promise((resolve, reject) => {
    const {
      data,
      url: requestUrl,
      method = 'GET',
      headers = {},
      timeout,
      auth,
      responseType,
      signal,
      cancelToken,
      onDownloadProgress,
      decompress,
    } = config;

    if (!requestUrl) {
      return reject(createError('URL is required', 'ERR_INVALID_URL', config));
    }

    // Check if request is already canceled
    if (cancelToken) {
      cancelToken.throwIfRequested();
    }

    const fullURL = buildURL(requestUrl, config.params);
    const parsedUrl = new url.URL(fullURL);
    const isHttps = parsedUrl.protocol === 'https:';
    const transport = isHttps ? https : http;

    const options: http.RequestOptions = {
      protocol: parsedUrl.protocol,
      hostname: parsedUrl.hostname,
      port: parsedUrl.port,
      path: parsedUrl.pathname + parsedUrl.search,
      method: method.toUpperCase(),
      headers: normalizeHeaders(headers),
      timeout,
    };

    if (auth) {
      options.auth = `${auth.username}:${auth.password}`;
    }

    const requestData = transformRequestData(data);

    if (requestData && !isStream(requestData)) {
      const dataStr = typeof requestData === 'string' ? requestData : JSON.stringify(requestData);
      const dataBuffer = Buffer.from(dataStr, 'utf-8');
      if (options.headers && typeof options.headers === 'object') {
        (options.headers as Record<string, string>)['Content-Length'] = String(dataBuffer.length);
      }
    }

    const req = transport.request(options, (res) => {
      const responseData: Buffer[] = [];

      const handleResponseEnd = (): void => {
        try {
          const buffer = Buffer.concat(responseData);

          // Parse response data safely
          const body = parseResponseData<T>(buffer, responseType, res);

          const response: fluxhttpResponse<T> = {
            data: body,
            status: res.statusCode || 0,
            statusText: res.statusMessage || '',
            headers: normalizeHeaders(res.headers),
            config,
            request: req,
          };

          const validateStatus =
            config.validateStatus || ((status: number): boolean => status >= 200 && status < 300);

          if (validateStatus(response.status)) {
            resolve(response);
          } else {
            reject(
              createError(
                `Request failed with status ${response.status}`,
                'ERR_BAD_RESPONSE',
                config,
                req,
                response
              )
            );
          }
        } catch (error) {
          reject(
            createError(
              error instanceof Error ? error.message : 'Failed to parse response',
              'ERR_PARSE_RESPONSE',
              config,
              req
            )
          );
        }
      };

      // Handle response streams
      let responseStream: NodeJS.ReadableStream = res;

      if ((decompress ?? true) && res.headers['content-encoding']) {
        const encoding = res.headers['content-encoding'];
        if (encoding === 'gzip') {
          responseStream = res.pipe(zlib.createGunzip());
        } else if (encoding === 'deflate') {
          responseStream = res.pipe(zlib.createInflateRaw());
        } else if (encoding === 'br') {
          responseStream = res.pipe(zlib.createBrotliDecompress());
        }
      }

      // Handle stream response type
      if (responseType === 'stream') {
        const response: fluxhttpResponse<T> = {
          data: responseStream as T,
          status: res.statusCode || 0,
          statusText: res.statusMessage || '',
          headers: normalizeHeaders(res.headers),
          config,
          request: req,
        };
        resolve(response);
        return;
      }

      // Collect response data
      responseStream.on('data', (chunk: Buffer) => {
        responseData.push(chunk);
        if (onDownloadProgress) {
          const loaded = Buffer.concat(responseData).length;
          const total = parseInt(res.headers['content-length'] || '0', 10) || 0;
          const progressEvent: FluxProgressEvent = {
            loaded,
            total,
            lengthComputable: total > 0,
            bytes: loaded,
          };
          onDownloadProgress(progressEvent);
        }
      });

      responseStream.on('end', handleResponseEnd);

      responseStream.on('error', (error: Error) => {
        reject(createNetworkError(error.message, config, req));
      });
    });

    // Handle request errors
    req.on('error', (error: Error) => {
      reject(createNetworkError(error.message, config, req));
    });

    req.on('timeout', () => {
      req.destroy();
      reject(createTimeoutError(config, req));
    });

    // Handle signal abort
    if (signal) {
      signal.addEventListener('abort', () => {
        req.destroy();
        reject(createCancelError('Request aborted', config));
      });
    }

    // Handle cancel token
    if (cancelToken) {
      void cancelToken.promise.then((cancel) => {
        req.destroy();
        reject(createCancelError(cancel.message, config));
      });
    }

    // Write request data
    if (requestData) {
      if (isStream(requestData) && typeof requestData === 'object' && 'pipe' in requestData) {
        (requestData as unknown as NodeJS.ReadableStream).pipe(req);
      } else {
        const dataStr = typeof requestData === 'string' ? requestData : JSON.stringify(requestData);
        req.write(dataStr);
        req.end();
      }
    } else {
      req.end();
    }
  });
}
