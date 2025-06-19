import type { InterceptorManager as IInterceptorManager, InterceptorOptions } from '../types';

interface Interceptor<T> {
  fulfilled?: (value: T) => T | Promise<T>;
  rejected?: (error: unknown) => unknown;
  options?: InterceptorOptions;
}

export class InterceptorManager<T> implements IInterceptorManager<T> {
  private interceptors: Map<number, Interceptor<T>> = new Map();
  private currentId = 0;

  use(
    onFulfilled?: (value: T) => T | Promise<T>,
    onRejected?: (error: unknown) => unknown,
    options?: InterceptorOptions
  ): number {
    const id = this.currentId++;
    this.interceptors.set(id, {
      fulfilled: onFulfilled,
      rejected: onRejected,
      options,
    });
    return id;
  }

  eject(id: number): void {
    this.interceptors.delete(id);
  }

  clear(): void {
    this.interceptors.clear();
  }

  forEach(callback: (interceptor: Interceptor<T>) => void): void {
    this.interceptors.forEach((interceptor) => {
      if (interceptor !== null) {
        callback(interceptor);
      }
    });
  }

  *[Symbol.iterator](): IterableIterator<Interceptor<T>> {
    for (const interceptor of Array.from(this.interceptors.values())) {
      yield interceptor;
    }
  }

  get size(): number {
    return this.interceptors.size;
  }
}
