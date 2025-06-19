import { fluxhttpError } from './fluxhttperror';
import type { fluxhttpRequestConfig, fluxhttpResponse } from '../types';

export function createError(
  message: string,
  code?: string,
  config?: fluxhttpRequestConfig,
  request?: unknown,
  response?: fluxhttpResponse
): fluxhttpError {
  return new fluxhttpError(message, code, config, request, response);
}

export function createRequestError(
  message: string,
  config: fluxhttpRequestConfig,
  code?: string,
  request?: unknown
): fluxhttpError {
  return createError(message, code || 'ERR_REQUEST', config, request);
}

export function createResponseError(
  message: string,
  config: fluxhttpRequestConfig,
  response: fluxhttpResponse,
  request?: unknown
): fluxhttpError {
  const code =
    response.status >= 500 ? 'ERR_SERVER' : response.status >= 400 ? 'ERR_CLIENT' : 'ERR_RESPONSE';

  return createError(message, code, config, request, response);
}

export function createTimeoutError(
  config: fluxhttpRequestConfig,
  request?: unknown
): fluxhttpError {
  const message = config.timeout
    ? `Request timeout of ${config.timeout}ms exceeded`
    : 'Request timeout exceeded';

  return createError(message, 'ETIMEDOUT', config, request);
}

export function createNetworkError(
  message: string,
  config: fluxhttpRequestConfig,
  request?: unknown
): fluxhttpError {
  return createError(message, 'ERR_NETWORK', config, request);
}

export function createCancelError(
  message = 'Request canceled',
  config?: fluxhttpRequestConfig
): fluxhttpError {
  return createError(message, 'ERR_CANCELED', config);
}
