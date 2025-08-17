import type { fluxhttpStatic, fluxhttpRequestConfig, fluxhttpInstance } from '../types';
import { fluxhttp } from './fluxhttp';
import { fluxhttpError } from '../errors';
import { mergeConfig } from './mergeConfig-minimal';
import { isCancel as isCancelToken } from './canceltoken-minimal';

// Type guard to check if a key is a valid fluxhttp property
function isFluxhttpKey(key: string | symbol | number, obj: fluxhttp): key is keyof fluxhttp {
  return typeof key === 'string' && key in obj;
}

export function createfluxhttpInstance(defaultConfig?: fluxhttpRequestConfig): fluxhttpStatic {
  const context = new fluxhttp(defaultConfig);

  // Create the instance function by binding the request method
  const instance = fluxhttp.prototype.request.bind(context);

  // Set up proper prototype chain
  const contextPrototype = Object.getPrototypeOf(context) as object | null;
  if (contextPrototype !== null) {
    Object.setPrototypeOf(instance, contextPrototype);
  }

  // Copy properties from context to instance in a type-safe way
  const descriptors = Object.getOwnPropertyDescriptors(context);
  Object.keys(descriptors).forEach((key) => {
    if (isFluxhttpKey(key, context)) {
      const value = context[key];
      if (value !== undefined) {
        Object.defineProperty(instance, key, {
          value,
          writable: true,
          enumerable: true,
          configurable: true,
        });
      }
    }
  });

  // Safely extend the instance with static methods
  // SAFETY: Create a properly typed static instance interface
  const staticInstance = instance as unknown as fluxhttpStatic;

  staticInstance.create = function create(config?: fluxhttpRequestConfig): fluxhttpInstance {
    return createfluxhttpInstance(mergeConfig(defaultConfig, config));
  };

  staticInstance.isCancel = function isCancel(value: unknown): boolean {
    // Check for cancel token
    if (isCancelToken(value)) {
      return true;
    }
    // Check for fluxhttpError with cancel code
    return Boolean(
      value && typeof value === 'object' && 'code' in value && value.code === 'ECONNABORTED'
    );
  };

  staticInstance.all = function all<T>(values: Array<T | Promise<T>>): Promise<T[]> {
    return Promise.all(values);
  };

  staticInstance.spread = function spread<T, R>(callback: (...args: T[]) => R): (array: T[]) => R {
    return function wrap(array: T[]): R {
      return callback(...array);
    };
  };

  staticInstance.isfluxhttpError = fluxhttpError.isfluxhttpError.bind(fluxhttpError);

  return staticInstance;
}
