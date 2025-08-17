import type { fluxhttpRequestConfig, fluxhttpResponse } from '../types';
import type { InterceptorManager } from './InterceptorManager';
import { fluxhttpError } from '../errors';

// Type guards for interceptor chain values
function isRequestConfig(value: unknown): value is fluxhttpRequestConfig {
  return typeof value === 'object' && value !== null && ('url' in value || 'method' in value);
}

function isResponse<T>(value: unknown): value is fluxhttpResponse<T> {
  return typeof value === 'object' && value !== null && 'status' in value && 'data' in value;
}

export async function dispatchRequest<T = unknown>(
  config: fluxhttpRequestConfig,
  requestInterceptors: InterceptorManager<fluxhttpRequestConfig>,
  responseInterceptors: InterceptorManager<fluxhttpResponse>,
  adapter: (config: fluxhttpRequestConfig) => Promise<fluxhttpResponse<T>>
): Promise<fluxhttpResponse<T>> {
  // Direct execution without deduplication (can be added via interceptors if needed)
  return executeRequest(config, requestInterceptors, responseInterceptors, adapter);
}

// Internal function that handles the actual request execution
async function executeRequest<T = unknown>(
  config: fluxhttpRequestConfig,
  requestInterceptors: InterceptorManager<fluxhttpRequestConfig>,
  responseInterceptors: InterceptorManager<fluxhttpResponse>,
  adapter: (config: fluxhttpRequestConfig) => Promise<fluxhttpResponse<T>>
): Promise<fluxhttpResponse<T>> {
  let modifiedConfig = config;

  // Build request interceptor chain
  const requestInterceptorChain: Array<((value: unknown) => unknown) | undefined> = [];
  let synchronousRequestInterceptors = true;

  requestInterceptors.forEach((interceptor) => {
    if (interceptor.options?.runWhen && !interceptor.options.runWhen(modifiedConfig)) {
      return;
    }

    synchronousRequestInterceptors =
      synchronousRequestInterceptors && (interceptor.options?.synchronous ?? false);

    // Wrap handlers with type validation
    const fulfilledWrapper = interceptor.fulfilled
      ? (value: unknown): unknown => {
          if (!isRequestConfig(value)) {
            throw new fluxhttpError('Invalid request config in interceptor chain');
          }
          return interceptor.fulfilled!(value);
        }
      : undefined;

    requestInterceptorChain.unshift(fulfilledWrapper, interceptor.rejected);
  });

  // Build response interceptor chain
  const responseInterceptorChain: Array<((value: unknown) => unknown) | undefined> = [];
  responseInterceptors.forEach((interceptor) => {
    const fulfilledWrapper = interceptor.fulfilled
      ? (value: unknown): unknown => {
          if (!isResponse(value)) {
            throw new fluxhttpError('Invalid response in interceptor chain');
          }
          return interceptor.fulfilled!(value);
        }
      : undefined;

    responseInterceptorChain.push(fulfilledWrapper, interceptor.rejected);
  });

  let promise: Promise<fluxhttpResponse<T>>;

  if (!synchronousRequestInterceptors) {
    // Async interceptor processing
    const retryAdapter = async (configValue: unknown): Promise<fluxhttpResponse<T>> => {
      if (!isRequestConfig(configValue)) {
        throw new fluxhttpError('Invalid config passed to adapter');
      }
      return adapter(configValue);
    };

    const chain: Array<((value: unknown) => unknown) | undefined> = [
      ...requestInterceptorChain,
      retryAdapter,
      undefined,
      ...responseInterceptorChain,
    ];

    let currentPromise: Promise<unknown> = Promise.resolve(modifiedConfig);

    while (chain.length) {
      const onFulfilled = chain.shift();
      const onRejected = chain.shift();
      currentPromise = currentPromise.then(onFulfilled, onRejected);
    }

    // Final validation and type assertion
    promise = currentPromise.then((result) => {
      if (!isResponse<T>(result)) {
        throw new fluxhttpError('Invalid response from interceptor chain');
      }
      return result;
    });

    return promise;
  }

  // Synchronous request interceptor processing
  const len = requestInterceptorChain.length;
  for (let i = 0; i < len; i += 2) {
    const onFulfilled = requestInterceptorChain[i];
    const onRejected = requestInterceptorChain[i + 1];

    try {
      if (onFulfilled) {
        const result = await onFulfilled(modifiedConfig);
        if (!isRequestConfig(result)) {
          throw new fluxhttpError('Interceptor must return a valid request config');
        }
        modifiedConfig = result;
      }
    } catch (error) {
      if (onRejected) {
        const errorResult = await onRejected(error);
        if (!isRequestConfig(errorResult)) {
          throw new fluxhttpError('Error handler must return a valid request config');
        }
        modifiedConfig = errorResult;
      } else {
        throw error;
      }
    }
  }

  // Execute request
  try {
    promise = adapter(modifiedConfig);
  } catch (error) {
    return Promise.reject(error);
  }

  // Process response interceptors
  const responseLen = responseInterceptorChain.length;
  for (let i = 0; i < responseLen; i += 2) {
    const onFulfilled = responseInterceptorChain[i];
    const onRejected = responseInterceptorChain[i + 1];

    if (onFulfilled || onRejected) {
      promise = promise.then(
        onFulfilled
          ? async (response: unknown): Promise<fluxhttpResponse<T>> => {
              if (!isResponse(response)) {
                throw new fluxhttpError('Invalid response in chain');
              }
              const result = await Promise.resolve(onFulfilled(response));
              if (!isResponse<T>(result)) {
                throw new fluxhttpError('Interceptor returned invalid response type');
              }
              return result;
            }
          : undefined,
        onRejected
      ) as Promise<fluxhttpResponse<T>>;
    }
  }

  return promise;
}

/**
 * Dispatch a request without deduplication
 * @param {fluxhttpRequestConfig} config - Request configuration
 * @param {InterceptorManager} requestInterceptors - Request interceptors
 * @param {InterceptorManager} responseInterceptors - Response interceptors
 * @param {Function} adapter - Adapter function
 * @returns {Promise<fluxhttpResponse>} Response promise
 */
export async function dispatchRequestWithoutDeduplication<T = unknown>(
  config: fluxhttpRequestConfig,
  requestInterceptors: InterceptorManager<fluxhttpRequestConfig>,
  responseInterceptors: InterceptorManager<fluxhttpResponse>,
  adapter: (config: fluxhttpRequestConfig) => Promise<fluxhttpResponse<T>>
): Promise<fluxhttpResponse<T>> {
  return executeRequest(config, requestInterceptors, responseInterceptors, adapter);
}
