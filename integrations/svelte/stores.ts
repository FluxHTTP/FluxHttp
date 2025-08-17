/**
 * @fileoverview Svelte stores for FluxHTTP integration
 */

import { writable, derived, readable, get } from 'svelte/store';
import type { Readable, Writable } from 'svelte/store';
import fluxhttp from '../../src/index';
import type { fluxhttpRequestConfig, fluxhttpResponse, fluxhttpError, fluxhttpInstance } from '../../src/types';

/**
 * Configuration for FluxHTTP stores
 */
export interface FluxHttpStoreConfig {
  /** FluxHTTP instance to use globally */
  instance?: fluxhttpInstance;
  /** Default request configuration */
  defaultConfig?: fluxhttpRequestConfig;
  /** Global error handler */
  onError?: (error: fluxhttpError) => void;
  /** Global loading state handler */
  onLoadingChange?: (loading: boolean) => void;
  /** Cache configuration */
  cache?: {
    /** Default cache time in milliseconds */
    defaultCacheTime?: number;
    /** Default stale time in milliseconds */
    defaultStaleTime?: number;
    /** Maximum cache size */
    maxSize?: number;
  };
  /** Retry configuration */
  retry?: {
    /** Default retry attempts */
    attempts?: number;
    /** Default retry delay */
    delay?: number;
  };
}

/**
 * State interface for HTTP requests
 */
export interface FluxHttpState<T = unknown> {
  /** Response data */
  data: T | null;
  /** Loading state */
  loading: boolean;
  /** Error state */
  error: fluxhttpError | null;
  /** Response object */
  response: fluxhttpResponse<T> | null;
  /** Request completion status */
  success: boolean;
}

/**
 * Options for HTTP request stores
 */
export interface FluxHttpStoreOptions<T = unknown> extends fluxhttpRequestConfig {
  /** Whether to execute request immediately */
  immediate?: boolean;
  /** Initial data value */
  initialData?: T | null;
  /** Callback on successful response */
  onSuccess?: (data: T, response: fluxhttpResponse<T>) => void;
  /** Callback on error */
  onError?: (error: fluxhttpError) => void;
  /** Callback when request completes (success or error) */
  onFinally?: () => void;
  /** Stale time in milliseconds */
  staleTime?: number;
  /** Cache time in milliseconds */
  cacheTime?: number;
  /** Enable background refetch */
  refetchInBackground?: boolean;
  /** Retry configuration */
  retry?: boolean | number | ((failureCount: number, error: fluxhttpError) => boolean);
  /** Retry delay function */
  retryDelay?: (attemptIndex: number) => number;
  /** Enable request deduplication */
  dedupingInterval?: number;
  /** Transform response data */
  select?: (data: T) => unknown;
  /** Whether to keep previous data when refetching */
  keepPreviousData?: boolean;
}

/**
 * Return type for HTTP request stores
 */
export interface FluxHttpStore<T = unknown> {
  /** Subscribe to the store state */
  subscribe: Readable<FluxHttpState<T>>['subscribe'];
  /** Execute the request manually */
  execute: (config?: Partial<fluxhttpRequestConfig>) => Promise<fluxhttpResponse<T>>;
  /** Refetch the request with same parameters */
  refetch: () => Promise<fluxhttpResponse<T>>;
  /** Cancel the current request */
  cancel: () => void;
  /** Reset the store state */
  reset: () => void;
  /** Mutate cached data */
  mutate: (data: T | ((currentData: T | null) => T), revalidate?: boolean) => void;
  /** Individual stores for specific properties */
  data: Readable<T | null>;
  loading: Readable<boolean>;
  error: Readable<fluxhttpError | null>;
  success: Readable<boolean>;
}

/**
 * Options for mutation stores
 */
export interface FluxHttpMutationOptions<TData = unknown, TVariables = unknown> {
  /** Callback on successful mutation */
  onSuccess?: (data: TData, variables: TVariables, response: fluxhttpResponse<TData>) => void;
  /** Callback on error */
  onError?: (error: fluxhttpError, variables: TVariables) => void;
  /** Callback when mutation settles (success or error) */
  onSettled?: (data: TData | undefined, error: fluxhttpError | null, variables: TVariables) => void;
  /** Callback on mutation start */
  onMutate?: (variables: TVariables) => Promise<unknown> | unknown;
  /** Enable mutation retry */
  retry?: boolean | number | ((failureCount: number, error: fluxhttpError) => boolean);
  /** Retry delay function */
  retryDelay?: (attemptIndex: number) => number;
  /** Transform response data */
  select?: (data: TData) => unknown;
}

/**
 * State interface for mutations
 */
export interface FluxHttpMutationState<TData = unknown> {
  /** Mutation data */
  data: TData | null;
  /** Loading state */
  loading: boolean;
  /** Error state */
  error: fluxhttpError | null;
  /** Response object */
  response: fluxhttpResponse<TData> | null;
  /** Success state */
  success: boolean;
  /** Variables used in the last mutation */
  variables: unknown;
}

/**
 * Return type for mutation stores
 */
export interface FluxHttpMutationStore<TData = unknown, TVariables = unknown> {
  /** Subscribe to the store state */
  subscribe: Readable<FluxHttpMutationState<TData>>['subscribe'];
  /** Execute the mutation */
  mutate: (variables: TVariables, options?: Partial<fluxhttpRequestConfig>) => Promise<TData>;
  /** Execute mutation asynchronously */
  mutateAsync: (variables: TVariables, options?: Partial<fluxhttpRequestConfig>) => Promise<TData>;
  /** Reset mutation state */
  reset: () => void;
  /** Individual stores for specific properties */
  data: Readable<TData | null>;
  loading: Readable<boolean>;
  error: Readable<fluxhttpError | null>;
  success: Readable<boolean>;
}

/**
 * Cache implementation for Svelte
 */
class SvelteFluxHttpCache {
  private cache = new Map<string, { data: unknown; timestamp: number; ttl: number }>();
  private defaultTTL: number;
  private maxSize: number;

  constructor(defaultTTL = 5 * 60 * 1000, maxSize = 100) {
    this.defaultTTL = defaultTTL;
    this.maxSize = maxSize;
  }

  get<T>(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;

    // Check if expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return undefined;
    }

    return entry.data as T;
  }

  set<T>(key: string, data: T, ttl?: number): void {
    // Evict oldest entries if cache is full
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttl ?? this.defaultTTL,
    });
  }

  remove(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
      }
    }
  }
}

// Global configuration and client
let globalConfig: FluxHttpStoreConfig = {};
let globalClient: fluxhttpInstance = fluxhttp;
let globalCache: SvelteFluxHttpCache;

// Global loading state
export const isLoading = writable(false);
export const activeRequests = writable(0);

/**
 * Configure FluxHTTP for Svelte
 * 
 * @example
 * ```typescript
 * import { configureFluxHttp } from '@fluxhttp/svelte';
 * 
 * configureFluxHttp({
 *   defaultConfig: {
 *     baseURL: 'https://api.example.com',
 *     timeout: 10000,
 *   },
 *   onError: (error) => {
 *     console.error('Global HTTP Error:', error);
 *   },
 *   cache: {
 *     defaultCacheTime: 5 * 60 * 1000,
 *     maxSize: 50,
 *   },
 * });
 * ```
 */
export function configureFluxHttp(config: FluxHttpStoreConfig): void {
  globalConfig = config;
  globalClient = config.instance || fluxhttp.create(config.defaultConfig);
  globalCache = new SvelteFluxHttpCache(
    config.cache?.defaultCacheTime,
    config.cache?.maxSize
  );

  // Setup interceptors for global loading state
  globalClient.interceptors.request.use(
    (requestConfig) => {
      activeRequests.update(count => {
        const newCount = count + 1;
        if (newCount === 1) {
          isLoading.set(true);
          config.onLoadingChange?.(true);
        }
        return newCount;
      });
      return requestConfig;
    },
    (error) => {
      activeRequests.update(count => {
        const newCount = Math.max(0, count - 1);
        if (newCount === 0) {
          isLoading.set(false);
          config.onLoadingChange?.(false);
        }
        return newCount;
      });
      return Promise.reject(error);
    }
  );

  globalClient.interceptors.response.use(
    (response) => {
      activeRequests.update(count => {
        const newCount = Math.max(0, count - 1);
        if (newCount === 0) {
          isLoading.set(false);
          config.onLoadingChange?.(false);
        }
        return newCount;
      });
      return response;
    },
    (error) => {
      activeRequests.update(count => {
        const newCount = Math.max(0, count - 1);
        if (newCount === 0) {
          isLoading.set(false);
          config.onLoadingChange?.(false);
        }
        return newCount;
      });

      config.onError?.(error);
      return Promise.reject(error);
    }
  );

  // Periodic cache cleanup
  if (typeof setInterval !== 'undefined') {
    setInterval(() => {
      globalCache?.cleanup();
    }, 60000);
  }
}

/**
 * Generate cache key from request config
 */
function generateCacheKey(config: fluxhttpRequestConfig): string {
  const { url, method = 'GET', params, data } = config;
  return JSON.stringify({ url, method, params, data });
}

/**
 * Create an HTTP request store
 * 
 * @example
 * ```svelte
 * <script>
 *   import { createFluxHttpStore } from '@fluxhttp/svelte';
 * 
 *   const userStore = createFluxHttpStore({
 *     url: '/api/user',
 *     immediate: true,
 *     onSuccess: (data) => console.log('User loaded:', data),
 *   });
 * 
 *   function refetchUser() {
 *     userStore.refetch();
 *   }
 * </script>
 * 
 * {#if $userStore.loading}
 *   <div>Loading...</div>
 * {:else if $userStore.error}
 *   <div>Error: {$userStore.error.message}</div>
 * {:else if $userStore.data}
 *   <div>Hello, {$userStore.data.name}!</div>
 * {/if}
 * 
 * <button on:click={refetchUser}>Refresh</button>
 * ```
 */
export function createFluxHttpStore<T = unknown>(
  options: FluxHttpStoreOptions<T> = {}
): FluxHttpStore<T> {
  const {
    immediate = false,
    initialData = null,
    onSuccess,
    onError,
    onFinally,
    staleTime = 0,
    cacheTime = 5 * 60 * 1000,
    refetchInBackground = false,
    retry = false,
    retryDelay = (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    dedupingInterval = 2000,
    select,
    keepPreviousData = false,
    ...requestConfig
  } = { ...globalConfig.defaultConfig, ...options };

  // Create the main state store
  const state = writable<FluxHttpState<T>>({
    data: initialData,
    loading: false,
    error: null,
    response: null,
    success: false,
  });

  // Individual property stores
  const data = derived(state, $state => $state.data);
  const loading = derived(state, $state => $state.loading);
  const error = derived(state, $state => $state.error);
  const success = derived(state, $state => $state.success);

  let abortController: AbortController | null = null;
  let retryTimeout: NodeJS.Timeout | null = null;
  let lastRequestId = '';

  const cacheKey = generateCacheKey(requestConfig as fluxhttpRequestConfig);

  // Cleanup function
  const cleanup = () => {
    if (abortController) {
      abortController.abort();
      abortController = null;
    }
    if (retryTimeout) {
      clearTimeout(retryTimeout);
      retryTimeout = null;
    }
  };

  // Execute request function
  const executeRequest = async (
    config: Partial<fluxhttpRequestConfig> = {}
  ): Promise<fluxhttpResponse<T>> => {
    const requestId = Date.now().toString();
    lastRequestId = requestId;

    // Check cache first
    if (globalCache) {
      const cached = globalCache.get<fluxhttpResponse<T>>(cacheKey);
      if (cached && Date.now() - (cached as any).timestamp < staleTime) {
        const cachedData = select ? select(cached.data) : cached.data;
        state.set({
          data: cachedData as T,
          loading: false,
          error: null,
          response: cached,
          success: true,
        });
        return cached;
      }
    }

    cleanup();
    abortController = new AbortController();

    state.update(prev => ({
      ...prev,
      loading: true,
      error: null,
      ...(keepPreviousData ? {} : { data: null, response: null, success: false }),
    }));

    const finalConfig: fluxhttpRequestConfig = {
      ...requestConfig,
      ...config,
      signal: abortController.signal,
    };

    const executeWithRetry = async (attemptCount: number = 0): Promise<fluxhttpResponse<T>> => {
      try {
        const response = await globalClient.request<T>(finalConfig);
        
        // Check if this is still the latest request
        if (lastRequestId !== requestId) {
          return response;
        }

        const responseData = select ? select(response.data) : response.data;

        // Cache the response
        if (globalCache) {
          globalCache.set(cacheKey, {
            ...response,
            timestamp: Date.now(),
          }, cacheTime);
        }

        state.set({
          data: responseData as T,
          loading: false,
          error: null,
          response,
          success: true,
        });

        onSuccess?.(response.data, response);
        onFinally?.();

        return response;
      } catch (err) {
        const fluxError = err as fluxhttpError;
        
        // Check if this is still the latest request
        if (lastRequestId !== requestId) {
          return Promise.reject(fluxError);
        }

        // Handle retry logic
        let shouldRetry = false;
        if (retry) {
          if (typeof retry === 'boolean') {
            shouldRetry = attemptCount < 3;
          } else if (typeof retry === 'number') {
            shouldRetry = attemptCount < retry;
          } else if (typeof retry === 'function') {
            shouldRetry = retry(attemptCount, fluxError);
          }
        }

        if (shouldRetry && !abortController?.signal.aborted) {
          const delay = retryDelay(attemptCount);
          return new Promise((resolve, reject) => {
            retryTimeout = setTimeout(() => {
              executeWithRetry(attemptCount + 1).then(resolve).catch(reject);
            }, delay);
          });
        }

        state.update(prev => ({
          ...prev,
          loading: false,
          error: fluxError,
          success: false,
        }));

        onError?.(fluxError);
        onFinally?.();

        return Promise.reject(fluxError);
      }
    };

    return executeWithRetry();
  };

  // Refetch function
  const refetch = () => executeRequest();

  // Cancel function
  const cancel = () => {
    cleanup();
    state.update(prev => ({ ...prev, loading: false }));
  };

  // Reset function
  const reset = () => {
    cleanup();
    state.set({
      data: initialData,
      loading: false,
      error: null,
      response: null,
      success: false,
    });
    globalCache?.remove(cacheKey);
  };

  // Mutate function
  const mutate = (
    newData: T | ((currentData: T | null) => T),
    revalidate: boolean = true
  ) => {
    const currentState = get(state);
    const updatedData = typeof newData === 'function' 
      ? (newData as (currentData: T | null) => T)(currentState.data)
      : newData;

    state.update(prev => ({ ...prev, data: updatedData }));

    // Update cache
    if (globalCache) {
      const cached = globalCache.get(cacheKey);
      if (cached) {
        globalCache.set(cacheKey, {
          ...cached,
          data: updatedData,
        });
      }
    }

    if (revalidate) {
      setTimeout(() => refetch(), 0);
    }
  };

  // Execute immediately if requested
  if (immediate && requestConfig.url) {
    setTimeout(() => executeRequest(), 0);
  }

  return {
    subscribe: state.subscribe,
    execute: executeRequest,
    refetch,
    cancel,
    reset,
    mutate,
    data,
    loading,
    error,
    success,
  };
}

/**
 * Create a mutation store for data modification
 * 
 * @example
 * ```svelte
 * <script>
 *   import { createFluxHttpMutationStore } from '@fluxhttp/svelte';
 * 
 *   const createUserMutation = createFluxHttpMutationStore({
 *     onSuccess: (data) => console.log('User created:', data),
 *     onError: (error) => console.error('Failed to create user:', error),
 *   });
 * 
 *   function handleSubmit(userData) {
 *     createUserMutation.mutate(userData, {
 *       url: '/api/users',
 *       method: 'POST',
 *     });
 *   }
 * </script>
 * 
 * <form on:submit|preventDefault={handleSubmit}>
 *   <!-- form fields -->
 *   <button type="submit" disabled={$createUserMutation.loading}>
 *     {$createUserMutation.loading ? 'Creating...' : 'Create User'}
 *   </button>
 * </form>
 * 
 * {#if $createUserMutation.error}
 *   <div class="error">{$createUserMutation.error.message}</div>
 * {/if}
 * 
 * {#if $createUserMutation.success}
 *   <div class="success">User created successfully!</div>
 * {/if}
 * ```
 */
export function createFluxHttpMutationStore<TData = unknown, TVariables = unknown>(
  options: FluxHttpMutationOptions<TData, TVariables> = {}
): FluxHttpMutationStore<TData, TVariables> {
  const {
    onSuccess,
    onError,
    onSettled,
    onMutate,
    retry = false,
    retryDelay = (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    select,
  } = options;

  // Create the main state store
  const state = writable<FluxHttpMutationState<TData>>({
    data: null,
    loading: false,
    error: null,
    response: null,
    success: false,
    variables: null,
  });

  // Individual property stores
  const data = derived(state, $state => $state.data);
  const loading = derived(state, $state => $state.loading);
  const error = derived(state, $state => $state.error);
  const success = derived(state, $state => $state.success);

  let abortController: AbortController | null = null;
  let retryTimeout: NodeJS.Timeout | null = null;

  const cleanup = () => {
    if (abortController) {
      abortController.abort();
      abortController = null;
    }
    if (retryTimeout) {
      clearTimeout(retryTimeout);
      retryTimeout = null;
    }
  };

  const mutate = async (
    variables: TVariables,
    config: Partial<fluxhttpRequestConfig> = {}
  ): Promise<TData> => {
    cleanup();
    abortController = new AbortController();

    state.update(prev => ({
      ...prev,
      loading: true,
      error: null,
      success: false,
      variables,
    }));

    try {
      // Call onMutate callback
      await onMutate?.(variables);

      const finalConfig: fluxhttpRequestConfig = {
        ...config,
        signal: abortController.signal,
        data: variables,
      };

      const executeWithRetry = async (attemptCount: number = 0): Promise<fluxhttpResponse<TData>> => {
        try {
          const response = await globalClient.request<TData>(finalConfig);
          return response;
        } catch (err) {
          const fluxError = err as fluxhttpError;
          
          // Handle retry logic
          let shouldRetry = false;
          if (retry) {
            if (typeof retry === 'boolean') {
              shouldRetry = attemptCount < 3;
            } else if (typeof retry === 'number') {
              shouldRetry = attemptCount < retry;
            } else if (typeof retry === 'function') {
              shouldRetry = retry(attemptCount, fluxError);
            }
          }

          if (shouldRetry && !abortController?.signal.aborted) {
            const delay = retryDelay(attemptCount);
            return new Promise((resolve, reject) => {
              retryTimeout = setTimeout(() => {
                executeWithRetry(attemptCount + 1).then(resolve).catch(reject);
              }, delay);
            });
          }

          throw fluxError;
        }
      };

      const response = await executeWithRetry();
      const responseData = select ? select(response.data) : response.data;

      state.set({
        data: responseData as TData,
        loading: false,
        error: null,
        response,
        success: true,
        variables,
      });

      onSuccess?.(response.data, variables, response);
      onSettled?.(response.data, null, variables);

      return response.data;
    } catch (err) {
      const fluxError = err as fluxhttpError;

      state.update(prev => ({
        ...prev,
        loading: false,
        error: fluxError,
        success: false,
      }));

      onError?.(fluxError, variables);
      onSettled?.(undefined, fluxError, variables);

      throw fluxError;
    }
  };

  const mutateAsync = async (
    variables: TVariables,
    config: Partial<fluxhttpRequestConfig> = {}
  ): Promise<TData> => {
    return mutate(variables, config);
  };

  const reset = () => {
    cleanup();
    state.set({
      data: null,
      loading: false,
      error: null,
      response: null,
      success: false,
      variables: null,
    });
  };

  return {
    subscribe: state.subscribe,
    mutate,
    mutateAsync,
    reset,
    data,
    loading,
    error,
    success,
  };
}

/**
 * Get the global FluxHTTP client instance
 */
export function getFluxHttpClient(): fluxhttpInstance {
  return globalClient;
}