import type { fluxhttpRequestConfig, fluxhttpResponse } from '../types';
import type { fluxhttpError } from '../errors';
import { executeWithRetry, ExponentialBackoffStrategy, type RetryStrategy } from '../core/retry';

/**
 * Create a retry request interceptor
 * @param {RetryStrategy} [strategy] - Custom retry strategy
 * @returns {Function} Retry interceptor function
 * 
 * @example
 * ```typescript
 * import { createRetryInterceptor } from '@fluxhttp/core';
 * 
 * const retryInterceptor = createRetryInterceptor();
 * fluxhttp.interceptors.request.use(retryInterceptor);
 * ```
 */
export function createRetryInterceptor(strategy?: RetryStrategy) {
  return function retryInterceptor(config: fluxhttpRequestConfig): fluxhttpRequestConfig {
    // Mark config as having retry interceptor
    (config as any).__hasRetryInterceptor = true;
    (config as any).__retryStrategy = strategy || new ExponentialBackoffStrategy();
    return config;
  };
}

/**
 * Create a retry response interceptor that handles failed requests
 * @param {RetryStrategy} [strategy] - Custom retry strategy
 * @returns {Object} Interceptor object with success and error handlers
 * 
 * @example
 * ```typescript
 * import { createRetryResponseInterceptor } from '@fluxhttp/core';
 * 
 * const retryResponseInterceptor = createRetryResponseInterceptor();
 * fluxhttp.interceptors.response.use(
 *   retryResponseInterceptor.onFulfilled,
 *   retryResponseInterceptor.onRejected
 * );
 * ```
 */
export function createRetryResponseInterceptor(strategy?: RetryStrategy) {
  const retryStrategy = strategy || new ExponentialBackoffStrategy();

  return {
    onFulfilled: <T>(response: fluxhttpResponse<T>): fluxhttpResponse<T> => {
      // Reset retry count on successful response
      if (response.config && (response.config as any).__retryCount) {
        delete (response.config as any).__retryCount;
      }
      return response;
    },

    onRejected: async <T>(error: fluxhttpError): Promise<fluxhttpResponse<T>> => {
      const config = error.config;
      
      if (!config || !config.retry || !(config as any).__hasRetryInterceptor) {
        throw error;
      }

      const retryConfig = config.retry;
      const currentAttempt = (config as any).__retryCount || 0;
      const maxAttempts = retryConfig.attempts || 3;

      // Check if we should retry
      if (currentAttempt >= maxAttempts) {
        throw error;
      }

      const shouldRetry = retryStrategy.shouldRetry(error, currentAttempt, retryConfig);
      if (!shouldRetry) {
        throw error;
      }

      // Calculate delay
      const delay = retryStrategy.getDelay(currentAttempt, retryConfig, error);

      // Wait for the delay
      await new Promise((resolve) => setTimeout(resolve, delay));

      // Increment retry count
      (config as any).__retryCount = currentAttempt + 1;

      // Import dispatchRequest to retry the request
      const { dispatchRequestWithoutDeduplication } = await import('./dispatchRequest');
      
      try {
        // Create a simple adapter that just calls the original adapter
        const adapter = (config.adapter || ((await import('../adapters')).getDefaultAdapter()));
        return await dispatchRequestWithoutDeduplication<T>(
          config,
          { forEach: () => {}, use: () => 0, eject: () => {}, clear: () => {} } as any,
          { forEach: () => {}, use: () => 0, eject: () => {}, clear: () => {} } as any,
          adapter
        );
      } catch (retryError) {
        // If retry fails, throw the original error for the final attempt
        if ((config as any).__retryCount >= maxAttempts) {
          throw retryError;
        }
        throw retryError;
      }
    },
  };
}

/**
 * Default retry interceptor with exponential backoff strategy
 */
export const defaultRetryInterceptor = createRetryInterceptor();

/**
 * Default retry response interceptor with exponential backoff strategy
 */
export const defaultRetryResponseInterceptor = createRetryResponseInterceptor();

/**
 * Install retry interceptors on a fluxhttp instance
 * @param {any} instance - fluxhttp instance
 * @param {RetryStrategy} [strategy] - Custom retry strategy
 * 
 * @example
 * ```typescript
 * import fluxhttp, { installRetryInterceptors } from '@fluxhttp/core';
 * 
 * // Install on default instance
 * installRetryInterceptors(fluxhttp);
 * 
 * // Install on custom instance
 * const api = fluxhttp.create();
 * installRetryInterceptors(api);
 * ```
 */
export function installRetryInterceptors(instance: any, strategy?: RetryStrategy): void {
  const requestInterceptor = createRetryInterceptor(strategy);
  const responseInterceptor = createRetryResponseInterceptor(strategy);

  instance.interceptors.request.use(requestInterceptor);
  instance.interceptors.response.use(
    responseInterceptor.onFulfilled,
    responseInterceptor.onRejected
  );
}

/**
 * Wrapper function to execute a request with retry logic
 * This is an alternative to using interceptors
 * @param {Function} requestFunction - Function that executes the request
 * @param {fluxhttpRequestConfig} config - Request configuration
 * @param {RetryStrategy} [strategy] - Custom retry strategy
 * @returns {Promise<fluxhttpResponse>} Response promise
 * 
 * @example
 * ```typescript
 * import { withRetry } from '@fluxhttp/core';
 * 
 * const response = await withRetry(
 *   () => fluxhttp.get('/api/data'),
 *   { retry: { attempts: 5, delay: 2000 } }
 * );
 * ```
 */
export async function withRetry<T = unknown>(
  requestFunction: () => Promise<fluxhttpResponse<T>>,
  config: fluxhttpRequestConfig,
  strategy?: RetryStrategy
): Promise<fluxhttpResponse<T>> {
  return executeWithRetry(requestFunction, config, strategy);
}

/**
 * Higher-order function to wrap any request function with retry logic
 * @param {RetryStrategy} [strategy] - Custom retry strategy
 * @returns {Function} Function wrapper that adds retry logic
 * 
 * @example
 * ```typescript
 * import { createRetryWrapper } from '@fluxhttp/core';
 * 
 * const withRetry = createRetryWrapper();
 * 
 * const retryableGet = withRetry((url, config) => fluxhttp.get(url, config));
 * 
 * const response = await retryableGet('/api/data', {
 *   retry: { attempts: 3, delay: 1000 }
 * });
 * ```
 */
export function createRetryWrapper(strategy?: RetryStrategy) {
  return function retryWrapper<T = unknown>(
    requestFunction: (...args: any[]) => Promise<fluxhttpResponse<T>>
  ) {
    return async function wrappedRequest(
      ...args: any[]
    ): Promise<fluxhttpResponse<T>> {
      // Extract config from arguments (usually the last parameter)
      const config = args[args.length - 1] as fluxhttpRequestConfig;
      
      if (!config || !config.retry) {
        return requestFunction(...args);
      }

      return executeWithRetry(() => requestFunction(...args), config, strategy);
    };
  };
}