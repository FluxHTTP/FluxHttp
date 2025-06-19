import type { FluxHTTPStatic, FluxHTTPRequestConfig, FluxHTTPInstance } from '../types';
import { FluxHTTP } from './FluxHTTP';
import { FluxHTTPError } from '../errors';
import { mergeConfig } from './mergeConfig';

export function createFluxHTTPInstance(defaultConfig?: FluxHTTPRequestConfig): FluxHTTPStatic {
  const context = new FluxHTTP(defaultConfig);

  const instance = FluxHTTP.prototype.request.bind(context) as unknown as FluxHTTPStatic;

  Object.setPrototypeOf(instance, Object.getPrototypeOf(context) as object);
  Object.keys(context).forEach((key) => {
    if (key in context && typeof context[key as keyof typeof context] !== 'undefined') {
      (instance as unknown as Record<string, unknown>)[key] = context[key as keyof typeof context];
    }
  });

  instance.create = function create(config?: FluxHTTPRequestConfig): FluxHTTPInstance {
    return createFluxHTTPInstance(mergeConfig(defaultConfig, config)) as FluxHTTPInstance;
  };

  instance.isCancel = function isCancel(value: unknown): boolean {
    return Boolean(
      value && typeof value === 'object' && 'code' in value && value.code === 'ERR_CANCELED'
    );
  };

  instance.all = function all<T>(values: Array<T | Promise<T>>): Promise<T[]> {
    return Promise.all(values);
  };

  instance.spread = function spread<T, R>(callback: (...args: T[]) => R): (array: T[]) => R {
    return function wrap(array: T[]): R {
      return callback(...array);
    };
  };

  instance.isFluxHTTPError = FluxHTTPError.isFluxHTTPError.bind(FluxHTTPError);

  return instance;
}
