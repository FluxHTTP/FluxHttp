/**
 * @fileoverview Vue 3 composables for FluxHTTP integration
 */

import { 
  ref, 
  computed, 
  watch, 
  onBeforeUnmount, 
  unref, 
  isRef,
  toValue,
  nextTick
} from 'vue';
import type { Ref, ComputedRef, WatchSource } from 'vue';
import type { fluxhttpRequestConfig, fluxhttpResponse, fluxhttpError } from '../../src/types';
import { useFluxHttpContext } from './plugin';
import type { 
  UseFluxHttpOptions, 
  UseFluxHttpReturn, 
  UseFluxHttpMutationOptions,
  UseFluxHttpMutationReturn,
  UseQueryOptions,
  UseQueryReturn,
  UseInfiniteQueryOptions,
  UseInfiniteQueryReturn
} from './types';

/**
 * Cache for storing request results
 */
const requestCache = new Map<string, {
  data: unknown;
  timestamp: number;
  promise?: Promise<unknown>;
}>();

/**
 * Generate cache key from request config
 */
function generateCacheKey(config: fluxhttpRequestConfig): string {
  const { url, method = 'GET', params, data } = config;
  return JSON.stringify({ url, method, params, data });
}

/**
 * Vue 3 composable for making HTTP requests with FluxHTTP
 * 
 * @example
 * ```vue
 * <script setup lang="ts">
 * const userId = ref('123');
 * 
 * const { data, loading, error, refetch } = useFluxHttp({
 *   url: computed(() => `/api/users/${userId.value}`),
 *   immediate: true,
 *   watch: [userId],
 *   onSuccess: (data) => console.log('User loaded:', data),
 * });
 * </script>
 * 
 * <template>
 *   <div v-if="loading">Loading...</div>
 *   <div v-else-if="error">Error: {{ error.message }}</div>
 *   <div v-else-if="data">Hello, {{ data.name }}!</div>
 *   <button @click="refetch">Refresh</button>
 * </template>
 * ```
 */
export function useFluxHttp<T = unknown>(
  options: UseFluxHttpOptions<T> = {}
): UseFluxHttpReturn<T> {
  const { client, config: globalConfig } = useFluxHttpContext();
  
  const {
    immediate = false,
    initialData = null,
    onSuccess,
    onError,
    onFinally,
    watch: watchSources = [],
    refetchOnWindowFocus = false,
    refetchOnReconnect = false,
    staleTime = 0,
    cacheTime = 5 * 60 * 1000, // 5 minutes
    refetchInBackground = false,
    retry = false,
    retryDelay = (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    dedupingInterval = 2000,
    select,
    keepPreviousData = false,
    resetOnParameterChange = true,
    ...requestConfig
  } = { ...globalConfig?.defaultConfig, ...options };

  // Reactive state
  const data = ref<T | null>(initialData);
  const loading = ref(false);
  const error = ref<fluxhttpError | null>(null);
  const response = ref<fluxhttpResponse<T> | null>(null);
  const success = ref(false);

  // Internal state
  const abortController = ref<AbortController | null>(null);
  const retryTimeout = ref<NodeJS.Timeout | null>(null);
  const lastRequestId = ref<string>('');
  const lastFetchTime = ref<number>(0);

  // Computed properties
  const isFresh = computed(() => {
    return staleTime > 0 && Date.now() - lastFetchTime.value < staleTime;
  });

  const isStale = computed(() => !isFresh.value);

  // Generate cache key
  const cacheKey = computed(() => generateCacheKey(toValue(requestConfig) as fluxhttpRequestConfig));

  // Cleanup function
  const cleanup = () => {
    if (abortController.value) {
      abortController.value.abort();
      abortController.value = null;
    }
    if (retryTimeout.value) {
      clearTimeout(retryTimeout.value);
      retryTimeout.value = null;
    }
  };

  // Execute request function
  const executeRequest = async (
    config: Partial<fluxhttpRequestConfig> = {}
  ): Promise<fluxhttpResponse<T>> => {
    const requestId = Date.now().toString();
    lastRequestId.value = requestId;

    // Check cache first
    const cached = requestCache.get(cacheKey.value);
    if (cached && Date.now() - cached.timestamp < staleTime) {
      const cachedData = select ? select(cached.data as T) : cached.data;
      data.value = cachedData as T;
      loading.value = false;
      error.value = null;
      success.value = true;
      return cached.data as fluxhttpResponse<T>;
    }

    // Check for deduplication
    if (cached?.promise && Date.now() - cached.timestamp < dedupingInterval) {
      return cached.promise as Promise<fluxhttpResponse<T>>;
    }

    cleanup();
    abortController.value = new AbortController();

    loading.value = true;
    error.value = null;
    
    if (!keepPreviousData) {
      data.value = null;
      response.value = null;
      success.value = false;
    }

    const finalConfig: fluxhttpRequestConfig = {
      ...toValue(requestConfig),
      ...config,
      signal: abortController.value.signal,
    };

    const executeWithRetry = async (attemptCount: number = 0): Promise<fluxhttpResponse<T>> => {
      try {
        const res = await client.request<T>(finalConfig);
        
        // Check if this is still the latest request
        if (lastRequestId.value !== requestId) {
          return res;
        }

        const responseData = select ? select(res.data) : res.data;

        // Cache the response
        requestCache.set(cacheKey.value, {
          data: res,
          timestamp: Date.now(),
        });

        data.value = responseData as T;
        loading.value = false;
        error.value = null;
        response.value = res;
        success.value = true;
        lastFetchTime.value = Date.now();

        onSuccess?.(res.data, res);
        onFinally?.();

        return res;
      } catch (err) {
        const fluxError = err as fluxhttpError;
        
        // Check if this is still the latest request
        if (lastRequestId.value !== requestId) {
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

        if (shouldRetry && !abortController.value?.signal.aborted) {
          const delay = retryDelay(attemptCount);
          return new Promise((resolve, reject) => {
            retryTimeout.value = setTimeout(() => {
              executeWithRetry(attemptCount + 1).then(resolve).catch(reject);
            }, delay);
          });
        }

        loading.value = false;
        error.value = fluxError;
        success.value = false;

        onError?.(fluxError);
        onFinally?.();

        return Promise.reject(fluxError);
      }
    };

    const promise = executeWithRetry();
    
    // Cache the promise for deduplication
    requestCache.set(cacheKey.value, {
      data: cached?.data,
      timestamp: Date.now(),
      promise,
    });

    return promise;
  };

  // Refetch function
  const refetch = () => executeRequest();

  // Cancel function
  const cancel = () => {
    cleanup();
    loading.value = false;
  };

  // Reset function
  const reset = () => {
    cleanup();
    data.value = initialData;
    loading.value = false;
    error.value = null;
    response.value = null;
    success.value = false;
    requestCache.delete(cacheKey.value);
  };

  // Mutate function
  const mutate = (
    newData: T | ((currentData: T | null) => T),
    revalidate: boolean = true
  ) => {
    const updatedData = typeof newData === 'function' 
      ? (newData as (currentData: T | null) => T)(data.value)
      : newData;

    data.value = updatedData;

    // Update cache
    const cached = requestCache.get(cacheKey.value);
    if (cached) {
      requestCache.set(cacheKey.value, {
        ...cached,
        data: { ...cached.data, data: updatedData },
      });
    }

    if (revalidate) {
      nextTick(() => {
        refetch();
      });
    }
  };

  // Watch for parameter changes
  if (watchSources.length > 0) {
    watch(
      watchSources as WatchSource[],
      () => {
        if (resetOnParameterChange) {
          reset();
        }
        if (immediate) {
          executeRequest();
        }
      },
      { deep: true }
    );
  }

  // Execute on mount if immediate is true
  if (immediate && toValue(requestConfig).url) {
    nextTick(() => {
      executeRequest();
    });
  }

  // Handle window focus refetch
  if (refetchOnWindowFocus) {
    const handleFocus = () => {
      if (data.value && !loading.value) {
        refetch();
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('focus', handleFocus);
      onBeforeUnmount(() => {
        window.removeEventListener('focus', handleFocus);
      });
    }
  }

  // Handle network reconnect refetch
  if (refetchOnReconnect) {
    const handleOnline = () => {
      if (data.value && !loading.value) {
        refetch();
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('online', handleOnline);
      onBeforeUnmount(() => {
        window.removeEventListener('online', handleOnline);
      });
    }
  }

  // Cleanup on unmount
  onBeforeUnmount(cleanup);

  return {
    data,
    loading,
    error,
    response,
    success,
    execute: executeRequest,
    refetch,
    cancel,
    reset,
    mutate,
    isFresh,
    isStale,
  };
}

/**
 * Vue 3 composable for HTTP mutations (POST, PUT, DELETE, etc.)
 * 
 * @example
 * ```vue
 * <script setup lang="ts">
 * const { mutate, loading, error, success } = useFluxHttpMutation<User, CreateUserData>({
 *   onSuccess: (data) => console.log('User created:', data),
 *   onError: (error) => console.error('Failed to create user:', error),
 * });
 * 
 * const handleSubmit = (userData: CreateUserData) => {
 *   mutate(userData, {
 *     url: '/api/users',
 *     method: 'POST',
 *   });
 * };
 * </script>
 * 
 * <template>
 *   <form @submit.prevent="handleSubmit">
 *     <!-- form fields -->
 *     <button type="submit" :disabled="loading">
 *       {{ loading ? 'Creating...' : 'Create User' }}
 *     </button>
 *     <div v-if="error" class="error">{{ error.message }}</div>
 *     <div v-if="success" class="success">User created successfully!</div>
 *   </form>
 * </template>
 * ```
 */
export function useFluxHttpMutation<TData = unknown, TVariables = unknown>(
  options: UseFluxHttpMutationOptions<TData, TVariables> = {}
): UseFluxHttpMutationReturn<TData, TVariables> {
  const { client } = useFluxHttpContext();
  
  const {
    onSuccess,
    onError,
    onSettled,
    onMutate,
    retry = false,
    retryDelay = (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    select,
  } = options;

  // Reactive state
  const data = ref<TData | null>(null);
  const loading = ref(false);
  const error = ref<fluxhttpError | null>(null);
  const response = ref<fluxhttpResponse<TData> | null>(null);
  const success = ref(false);
  const variables = ref<TVariables | null>(null);

  // Internal state
  const abortController = ref<AbortController | null>(null);
  const retryTimeout = ref<NodeJS.Timeout | null>(null);

  const cleanup = () => {
    if (abortController.value) {
      abortController.value.abort();
      abortController.value = null;
    }
    if (retryTimeout.value) {
      clearTimeout(retryTimeout.value);
      retryTimeout.value = null;
    }
  };

  const mutate = async (
    vars: TVariables,
    config: Partial<fluxhttpRequestConfig> = {}
  ): Promise<TData> => {
    cleanup();
    abortController.value = new AbortController();

    loading.value = true;
    error.value = null;
    success.value = false;
    variables.value = vars;

    try {
      // Call onMutate callback
      await onMutate?.(vars);

      const finalConfig: fluxhttpRequestConfig = {
        ...config,
        signal: abortController.value.signal,
        data: vars,
      };

      const executeWithRetry = async (attemptCount: number = 0): Promise<fluxhttpResponse<TData>> => {
        try {
          const res = await client.request<TData>(finalConfig);
          return res;
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

          if (shouldRetry && !abortController.value?.signal.aborted) {
            const delay = retryDelay(attemptCount);
            return new Promise((resolve, reject) => {
              retryTimeout.value = setTimeout(() => {
                executeWithRetry(attemptCount + 1).then(resolve).catch(reject);
              }, delay);
            });
          }

          throw fluxError;
        }
      };

      const res = await executeWithRetry();
      const responseData = select ? select(res.data) : res.data;

      data.value = responseData as TData;
      loading.value = false;
      error.value = null;
      response.value = res;
      success.value = true;

      onSuccess?.(res.data, vars, res);
      onSettled?.(res.data, null, vars);

      return res.data;
    } catch (err) {
      const fluxError = err as fluxhttpError;

      loading.value = false;
      error.value = fluxError;
      success.value = false;

      onError?.(fluxError, vars);
      onSettled?.(undefined, fluxError, vars);

      throw fluxError;
    }
  };

  const mutateAsync = async (
    vars: TVariables,
    config: Partial<fluxhttpRequestConfig> = {}
  ): Promise<TData> => {
    return mutate(vars, config);
  };

  const reset = () => {
    cleanup();
    data.value = null;
    loading.value = false;
    error.value = null;
    response.value = null;
    success.value = false;
    variables.value = null;
  };

  // Cleanup on unmount
  onBeforeUnmount(cleanup);

  return {
    data,
    loading,
    error,
    response,
    success,
    variables,
    mutate,
    mutateAsync,
    reset,
  };
}

/**
 * Vue 3 composable for queries with advanced caching
 * 
 * @example
 * ```vue
 * <script setup lang="ts">
 * const userId = ref('123');
 * const enabled = ref(true);
 * 
 * const { data, loading, error } = useQuery({
 *   queryKey: ['user', userId],
 *   url: computed(() => `/api/users/${userId.value}`),
 *   enabled,
 *   staleTime: 5 * 60 * 1000, // 5 minutes
 * });
 * </script>
 * ```
 */
export function useQuery<T = unknown>(
  options: UseQueryOptions<T>
): UseQueryReturn<T> {
  const {
    queryKey: queryKeyOption,
    enabled: enabledOption = true,
    queryFn,
    ...restOptions
  } = options;

  const queryKey = computed(() => {
    const key = toValue(queryKeyOption);
    return Array.isArray(key) ? key.join(':') : (key || '');
  });

  const enabled = computed(() => toValue(enabledOption));

  const fluxHttpOptions = computed(() => ({
    ...restOptions,
    immediate: enabled.value && restOptions.immediate !== false,
  }));

  const result = useFluxHttp<T>(fluxHttpOptions.value);

  // Watch enabled state
  watch(enabled, (newEnabled) => {
    if (newEnabled && !result.data.value && !result.loading.value) {
      result.execute();
    }
  });

  return {
    ...result,
    queryKey,
    enabled,
  };
}

/**
 * Vue 3 composable for infinite queries with pagination
 * 
 * @example
 * ```vue
 * <script setup lang="ts">
 * const { 
 *   data, 
 *   loading, 
 *   hasNextPage, 
 *   fetchNextPage 
 * } = useInfiniteQuery({
 *   queryKey: ['posts'],
 *   url: '/api/posts',
 *   getNextPageParam: (lastPage) => lastPage.hasMore ? lastPage.nextCursor : undefined,
 *   initialPageParam: 1,
 * });
 * </script>
 * ```
 */
export function useInfiniteQuery<T = unknown>(
  options: UseInfiniteQueryOptions<T>
): UseInfiniteQueryReturn<T> {
  const {
    queryKey: queryKeyOption,
    getNextPageParam,
    getPreviousPageParam,
    initialPageParam = 1,
    maxPages = Infinity,
    ...restOptions
  } = options;

  // Reactive state
  const data = ref<T[]>([]);
  const loading = ref(false);
  const error = ref<fluxhttpError | null>(null);
  const success = ref(false);
  const isFetchingNextPage = ref(false);
  const isFetchingPreviousPage = ref(false);

  // Internal state
  const pages = ref<T[]>([]);
  const pageParams = ref<unknown[]>([initialPageParam]);
  const currentPageParam = ref(initialPageParam);

  // Computed properties
  const hasNextPage = computed(() => {
    if (!getNextPageParam || pages.value.length === 0) return false;
    const lastPage = pages.value[pages.value.length - 1];
    const nextParam = getNextPageParam(lastPage, pages.value);
    return nextParam !== undefined && pages.value.length < maxPages;
  });

  const hasPreviousPage = computed(() => {
    if (!getPreviousPageParam || pages.value.length === 0) return false;
    const firstPage = pages.value[0];
    const prevParam = getPreviousPageParam(firstPage, pages.value);
    return prevParam !== undefined;
  });

  // Create base query for individual pages
  const { client } = useFluxHttpContext();

  const fetchPage = async (pageParam: unknown): Promise<fluxhttpResponse<T>> => {
    const config: fluxhttpRequestConfig = {
      ...restOptions,
      params: {
        ...restOptions.params,
        page: pageParam,
      },
    };

    return client.request<T>(config);
  };

  const fetchNextPage = async (): Promise<fluxhttpResponse<T> | undefined> => {
    if (!hasNextPage.value || isFetchingNextPage.value) return;

    isFetchingNextPage.value = true;
    error.value = null;

    try {
      const lastPage = pages.value[pages.value.length - 1];
      const nextParam = getNextPageParam!(lastPage, pages.value);
      
      if (nextParam === undefined) return;

      const response = await fetchPage(nextParam);
      
      pages.value.push(response.data);
      pageParams.value.push(nextParam);
      data.value = [...pages.value];
      
      return response;
    } catch (err) {
      error.value = err as fluxhttpError;
      throw err;
    } finally {
      isFetchingNextPage.value = false;
    }
  };

  const fetchPreviousPage = async (): Promise<fluxhttpResponse<T> | undefined> => {
    if (!hasPreviousPage.value || isFetchingPreviousPage.value) return;

    isFetchingPreviousPage.value = true;
    error.value = null;

    try {
      const firstPage = pages.value[0];
      const prevParam = getPreviousPageParam!(firstPage, pages.value);
      
      if (prevParam === undefined) return;

      const response = await fetchPage(prevParam);
      
      pages.value.unshift(response.data);
      pageParams.value.unshift(prevParam);
      data.value = [...pages.value];
      
      return response;
    } catch (err) {
      error.value = err as fluxhttpError;
      throw err;
    } finally {
      isFetchingPreviousPage.value = false;
    }
  };

  const refetch = async (): Promise<fluxhttpResponse<T>[]> => {
    loading.value = true;
    error.value = null;

    try {
      const responses = await Promise.all(
        pageParams.value.map(param => fetchPage(param))
      );
      
      pages.value = responses.map(r => r.data);
      data.value = [...pages.value];
      success.value = true;
      
      return responses;
    } catch (err) {
      error.value = err as fluxhttpError;
      throw err;
    } finally {
      loading.value = false;
    }
  };

  const reset = () => {
    data.value = [];
    pages.value = [];
    pageParams.value = [initialPageParam];
    loading.value = false;
    error.value = null;
    success.value = false;
    isFetchingNextPage.value = false;
    isFetchingPreviousPage.value = false;
  };

  // Initial load
  if (restOptions.immediate !== false) {
    nextTick(() => {
      fetchPage(initialPageParam).then(response => {
        pages.value = [response.data];
        data.value = [...pages.value];
        success.value = true;
      }).catch(err => {
        error.value = err;
      });
    });
  }

  return {
    data,
    loading,
    error,
    success,
    hasNextPage,
    hasPreviousPage,
    isFetchingNextPage,
    isFetchingPreviousPage,
    fetchNextPage,
    fetchPreviousPage,
    refetch,
    reset,
  };
}