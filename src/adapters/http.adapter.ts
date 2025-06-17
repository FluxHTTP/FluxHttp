import * as http from 'http';
import * as https from 'https';
import * as url from 'url';
import * as zlib from 'zlib';
import type { FluxHTTPRequestConfig, FluxHTTPResponse } from '../types';
import { createError, createTimeoutError, createNetworkError, createCancelError } from '../errors';
import { buildURL } from '../utils/url';
import { transformRequestData, isStream } from '../utils/data';

export function httpAdapter<T = unknown>(
  config: FluxHTTPRequestConfig
): Promise<FluxHTTPResponse<T>> {
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
      onDownloadProgress,
      decompress = true,
    } = config;

    if (!requestUrl) {
      return reject(createError('URL is required', config, 'ERR_INVALID_URL'));
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
      headers: { ...headers },
      timeout,
    };

    if (auth) {
      options.auth = `${auth.username}:${auth.password}`;
    }

    const requestData = transformRequestData(data);

    if (requestData && !isStream(requestData)) {
      const dataStr = typeof requestData === 'string' ? requestData : JSON.stringify(requestData);
      const dataBuffer = Buffer.from(dataStr, 'utf-8');

      if (!options.headers) options.headers = {};
      (options.headers as Record<string, string>)['content-length'] = String(dataBuffer.length);

      if (!(options.headers as Record<string, string>)['content-type']) {
        (options.headers as Record<string, string>)['content-type'] = 'application/json';
      }
    }

    const req = transport.request(options, (res) => {
      if (req.destroyed) return;

      const responseData: Buffer[] = [];
      let downloadedBytes = 0;

      const handleResponseEnd = (): void => {
        let body: T;
        const buffer = Buffer.concat(responseData);

        if (responseType === 'arraybuffer') {
          body = buffer as unknown as T;
        } else if (responseType === 'stream') {
          body = res as unknown as T;
        } else {
          const text = buffer.toString('utf-8');
          body = (responseType === 'json' ? parseJSON(text) : text) as T;
        }

        const response: FluxHTTPResponse<T> = {
          data: body,
          status: res.statusCode || 0,
          statusText: res.statusMessage || '',
          headers: res.headers as Record<string, string>,
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
              `Request failed with status code ${response.status}`,
              config,
              'ERR_BAD_RESPONSE',
              req,
              response
            )
          );
        }
      };

      if (responseType === 'stream') {
        handleResponseEnd();
        return;
      }

      let stream: NodeJS.ReadableStream = res;

      if (decompress && res.headers['content-encoding']) {
        const encoding = res.headers['content-encoding'];
        if (encoding === 'gzip') {
          stream = stream.pipe(zlib.createGunzip());
        } else if (encoding === 'deflate') {
          stream = stream.pipe(zlib.createInflate());
        } else if (encoding === 'br') {
          stream = stream.pipe(zlib.createBrotliDecompress());
        }
      }

      stream.on('data', (chunk: Buffer) => {
        responseData.push(chunk);
        downloadedBytes += chunk.length;

        if (onDownloadProgress) {
          const contentLength = parseInt(res.headers['content-length'] || '0', 10);
          onDownloadProgress({
            loaded: downloadedBytes,
            total: contentLength || undefined,
            progress: contentLength > 0 ? downloadedBytes / contentLength : undefined,
            bytes: chunk.length,
          });
        }
      });

      stream.on('end', handleResponseEnd);
      stream.on('error', (err: Error) => {
        reject(createNetworkError(err.message, config, req));
      });
    });

    req.on('error', (err) => {
      reject(createNetworkError(err.message, config, req));
    });

    if (timeout) {
      req.setTimeout(timeout, () => {
        req.destroy();
        reject(createTimeoutError(config, req));
      });
    }

    if (signal) {
      signal.addEventListener('abort', () => {
        req.destroy();
        reject(createCancelError('Request aborted', config));
      });
    }

    if (requestData) {
      if (isStream(requestData)) {
        void (requestData as ReadableStream).pipeTo(
          new WritableStream({
            write(chunk): void {
              req.write(chunk);
            },
            close(): void {
              req.end();
            },
            abort(err?: Error): void {
              req.destroy(err);
            },
          })
        );
      } else {
        req.write(requestData);
        req.end();
      }
    } else {
      req.end();
    }
  });
}

function parseJSON(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
