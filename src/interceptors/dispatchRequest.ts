import type { FluxHTTPRequestConfig, FluxHTTPResponse } from '../types';
import type { InterceptorManager } from './InterceptorManager';

export async function dispatchRequest<T = unknown>(
  config: FluxHTTPRequestConfig,
  requestInterceptors: InterceptorManager<FluxHTTPRequestConfig>,
  responseInterceptors: InterceptorManager<FluxHTTPResponse>,
  adapter: (config: FluxHTTPRequestConfig) => Promise<FluxHTTPResponse<T>>
): Promise<FluxHTTPResponse<T>> {
  let modifiedConfig = config;

  const requestInterceptorChain: Array<((value: unknown) => unknown) | undefined> = [];
  let synchronousRequestInterceptors = true;

  requestInterceptors.forEach((interceptor) => {
    if (interceptor.options?.runWhen && !interceptor.options.runWhen(modifiedConfig)) {
      return;
    }

    synchronousRequestInterceptors =
      synchronousRequestInterceptors && (interceptor.options?.synchronous ?? false);
    requestInterceptorChain.unshift(
      interceptor.fulfilled as ((value: unknown) => unknown) | undefined,
      interceptor.rejected
    );
  });

  const responseInterceptorChain: Array<((value: unknown) => unknown) | undefined> = [];
  responseInterceptors.forEach((interceptor) => {
    responseInterceptorChain.push(
      interceptor.fulfilled as ((value: unknown) => unknown) | undefined,
      interceptor.rejected
    );
  });

  let promise: Promise<unknown>;

  if (!synchronousRequestInterceptors) {
    const chain: Array<((value: unknown) => unknown) | undefined> = [
      ...requestInterceptorChain,
      adapter as (value: unknown) => unknown,
      undefined,
      ...responseInterceptorChain,
    ];

    promise = Promise.resolve(modifiedConfig);
    while (chain.length) {
      const onFulfilled = chain.shift();
      const onRejected = chain.shift();
      promise = promise.then(onFulfilled, onRejected);
    }

    return promise as Promise<FluxHTTPResponse<T>>;
  }

  let len = requestInterceptorChain.length;
  for (let i = 0; i < len; i += 2) {
    const onFulfilled = requestInterceptorChain[i];
    const onRejected = requestInterceptorChain[i + 1];

    try {
      modifiedConfig = onFulfilled
        ? ((await onFulfilled(modifiedConfig)) as FluxHTTPRequestConfig)
        : modifiedConfig;
    } catch (error) {
      if (onRejected) {
        modifiedConfig = (await onRejected(error)) as FluxHTTPRequestConfig;
      } else {
        throw error;
      }
    }
  }

  try {
    promise = adapter(modifiedConfig);
  } catch (error) {
    return Promise.reject(error);
  }

  len = responseInterceptorChain.length;
  for (let i = 0; i < len; i += 2) {
    const onFulfilled = responseInterceptorChain[i];
    const onRejected = responseInterceptorChain[i + 1];
    promise = promise.then(onFulfilled, onRejected);
  }

  return promise as Promise<FluxHTTPResponse<T>>;
}
