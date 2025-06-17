import { FluxHTTPError } from './FluxHTTPError';
import type { FluxHTTPRequestConfig, FluxHTTPResponse } from '../types';

export function createError(
  message: string,
  config?: FluxHTTPRequestConfig,
  code?: string,
  request?: unknown,
  response?: FluxHTTPResponse
): FluxHTTPError {
  return new FluxHTTPError(message, code, config, request, response);
}

export function createRequestError(
  message: string,
  config: FluxHTTPRequestConfig,
  code?: string,
  request?: unknown
): FluxHTTPError {
  return createError(message, config, code || 'ERR_REQUEST', request);
}

export function createResponseError(
  message: string,
  config: FluxHTTPRequestConfig,
  response: FluxHTTPResponse,
  request?: unknown
): FluxHTTPError {
  const code =
    response.status >= 500 ? 'ERR_SERVER' : response.status >= 400 ? 'ERR_CLIENT' : 'ERR_RESPONSE';

  return createError(message, config, code, request, response);
}

export function createTimeoutError(
  config: FluxHTTPRequestConfig,
  request?: unknown
): FluxHTTPError {
  const message = config.timeout
    ? `Request timeout of ${config.timeout}ms exceeded`
    : 'Request timeout exceeded';

  return createError(message, config, 'ETIMEDOUT', request);
}

export function createNetworkError(
  message: string,
  config: FluxHTTPRequestConfig,
  request?: unknown
): FluxHTTPError {
  return createError(message, config, 'ERR_NETWORK', request);
}

export function createCancelError(
  message = 'Request canceled',
  config?: FluxHTTPRequestConfig
): FluxHTTPError {
  return createError(message, config, 'ERR_CANCELED');
}
