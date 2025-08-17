/**
 * @fileoverview React hook for FluxHTTP integration
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { fluxhttpRequestConfig, fluxhttpResponse, fluxhttpError } from '../../src/types';
import { useFluxHttpContext } from './FluxHttpProvider';
import type { 
  UseFluxHttpOptions, 
  UseFluxHttpReturn, 
  UseFluxHttpMutationOptions,
  UseFluxHttpMutationReturn
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
 * React hook for making HTTP requests with FluxHTTP
 * 
 * @example
 * ```tsx
 * function UserProfile({ userId }: { userId: string }) {
 *   const { data, loading, error, refetch } = useFluxHttp({
 *     url: `/api/users/${userId}`,
 *     immediate: true,
 *     onSuccess: (data) => console.log('User loaded:', data),
 *     deps: [userId]
 *   });
 * 
 *   if (loading) return <div>Loading...</div>;
 *   if (error) return <div>Error: {error.message}</div>;
 *   if (!data) return <div>No data</div>;
 * 
 *   return <div>Hello, {data.name}!</div>;
 * }
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
    deps = [],
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
    ...requestConfig
  } = { ...globalConfig?.defaultConfig, ...options };

  const [state, setState] = useState<{
    data: T | null;
    loading: boolean;
    error: fluxhttpError | null;
    response: fluxhttpResponse<T> | null;
    success: boolean;
  }>({
    data: initialData,
    loading: false,
    error: null,
    response: null,
    success: false,
  });

  const abortControllerRef = useRef<AbortController | null>(null);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastRequestRef = useRef<string>('');
  const retryCountRef = useRef(0);

  const cacheKey = generateCacheKey(requestConfig as fluxhttpRequestConfig);

  // Cleanup function
  const cleanup = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
  }, []);

  // Execute request function
  const executeRequest = useCallback(async (
    config: Partial<fluxhttpRequestConfig> = {}
  ): Promise<fluxhttpResponse<T>> => {
    const requestId = Date.now().toString();
    lastRequestRef.current = requestId;

    // Check cache first
    const cached = requestCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < staleTime) {
      const cachedData = select ? select(cached.data as T) : cached.data;
      setState(prev => ({
        ...prev,
        data: cachedData as T,
        loading: false,
        error: null,
        success: true,
      }));
      return cached.data as fluxhttpResponse<T>;
    }

    // Check for deduplication
    if (cached?.promise && Date.now() - cached.timestamp < dedupingInterval) {
      return cached.promise as Promise<fluxhttpResponse<T>>;
    }

    cleanup();
    abortControllerRef.current = new AbortController();

    setState(prev => ({
      ...prev,
      loading: true,
      error: null,
      ...(keepPreviousData ? {} : { data: null, response: null, success: false }),
    }));

    const finalConfig: fluxhttpRequestConfig = {
      ...requestConfig,
      ...config,
      signal: abortControllerRef.current.signal,
    };

    const executeWithRetry = async (attemptCount: number = 0): Promise<fluxhttpResponse<T>> => {
      try {
        const response = await client.request<T>(finalConfig);
        
        // Check if this is still the latest request
        if (lastRequestRef.current !== requestId) {
          return response;
        }

        const responseData = select ? select(response.data) : response.data;

        // Cache the response
        requestCache.set(cacheKey, {
          data: response,
          timestamp: Date.now(),
        });

        setState({
          data: responseData as T,
          loading: false,
          error: null,
          response,
          success: true,
        });

        onSuccess?.(response.data, response);
        onFinally?.();
        retryCountRef.current = 0;

        return response;
      } catch (error) {
        const fluxError = error as fluxhttpError;
        
        // Check if this is still the latest request
        if (lastRequestRef.current !== requestId) {
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

        if (shouldRetry && !abortControllerRef.current?.signal.aborted) {
          const delay = retryDelay(attemptCount);
          return new Promise((resolve, reject) => {
            retryTimeoutRef.current = setTimeout(() => {
              executeWithRetry(attemptCount + 1).then(resolve).catch(reject);
            }, delay);
          });
        }

        setState(prev => ({
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

    const promise = executeWithRetry();
    
    // Cache the promise for deduplication
    requestCache.set(cacheKey, {
      data: cached?.data,
      timestamp: Date.now(),
      promise,
    });

    return promise;
  }, [
    client,
    requestConfig,
    cacheKey,
    staleTime,
    dedupingInterval,
    keepPreviousData,
    select,
    retry,
    retryDelay,
    onSuccess,
    onError,
    onFinally,
    cleanup
  ]);

  // Refetch function
  const refetch = useCallback(() => {
    return executeRequest();
  }, [executeRequest]);

  // Cancel function
  const cancel = useCallback(() => {
    cleanup();
    setState(prev => ({
      ...prev,
      loading: false,
    }));
  }, [cleanup]);

  // Reset function
  const reset = useCallback(() => {
    cleanup();
    setState({
      data: initialData,
      loading: false,
      error: null,
      response: null,
      success: false,
    });
    requestCache.delete(cacheKey);
  }, [initialData, cacheKey, cleanup]);

  // Mutate function
  const mutate = useCallback((
    data: T | ((currentData: T | null) => T),
    revalidate: boolean = true
  ) => {
    const newData = typeof data === 'function' 
      ? (data as (currentData: T | null) => T)(state.data)
      : data;

    setState(prev => ({
      ...prev,
      data: newData,
    }));

    // Update cache
    const cached = requestCache.get(cacheKey);
    if (cached) {
      requestCache.set(cacheKey, {
        ...cached,
        data: { ...cached.data, data: newData },
      });
    }

    if (revalidate) {
      refetch();
    }
  }, [state.data, cacheKey, refetch]);

  // Execute on mount if immediate is true
  useEffect(() => {
    if (immediate && requestConfig.url) {
      executeRequest();
    }
  }, [immediate, ...deps]);

  // Handle window focus refetch
  useEffect(() => {
    if (!refetchOnWindowFocus) return;

    const handleFocus = () => {
      if (state.data && !state.loading) {
        refetch();
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [refetchOnWindowFocus, state.data, state.loading, refetch]);

  // Handle network reconnect refetch
  useEffect(() => {
    if (!refetchOnReconnect) return;

    const handleOnline = () => {
      if (state.data && !state.loading) {
        refetch();
      }
    };

    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [refetchOnReconnect, state.data, state.loading, refetch]);

  // Cleanup on unmount
  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  return {
    ...state,
    execute: executeRequest,
    refetch,
    cancel,
    reset,
    mutate,
  };
}

/**
 * React hook for HTTP mutations (POST, PUT, DELETE, etc.)
 * 
 * @example
 * ```tsx
 * function CreateUser() {
 *   const { mutate, loading, error, success } = useFluxHttpMutation<User, CreateUserData>({
 *     onSuccess: (data) => console.log('User created:', data),
 *     onError: (error) => console.error('Failed to create user:', error),
 *   });
 * 
 *   const handleSubmit = (userData: CreateUserData) => {
 *     mutate(userData, {
 *       url: '/api/users',
 *       method: 'POST',
 *     });
 *   };
 * 
 *   return (
 *     <form onSubmit={handleSubmit}>
 *       {/* form fields */}
 *       <button type="submit" disabled={loading}>
 *         {loading ? 'Creating...' : 'Create User'}
 *       </button>
 *       {error && <div className="error">{error.message}</div>}
 *       {success && <div className="success">User created successfully!</div>}
 *     </form>
 *   );
 * }
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

  const [state, setState] = useState<{
    data: TData | null;
    loading: boolean;
    error: fluxhttpError | null;
    response: fluxhttpResponse<TData> | null;
    success: boolean;
    variables: TVariables | null;
  }>({
    data: null,
    loading: false,
    error: null,
    response: null,
    success: false,
    variables: null,
  });

  const abortControllerRef = useRef<AbortController | null>(null);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const cleanup = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
  }, []);

  const mutate = useCallback(async (
    variables: TVariables,
    config: Partial<fluxhttpRequestConfig> = {}
  ): Promise<TData> => {
    cleanup();
    abortControllerRef.current = new AbortController();

    setState(prev => ({
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
        signal: abortControllerRef.current.signal,
        data: variables,
      };

      const executeWithRetry = async (attemptCount: number = 0): Promise<fluxhttpResponse<TData>> => {
        try {
          const response = await client.request<TData>(finalConfig);
          return response;
        } catch (error) {
          const fluxError = error as fluxhttpError;
          
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

          if (shouldRetry && !abortControllerRef.current?.signal.aborted) {
            const delay = retryDelay(attemptCount);
            return new Promise((resolve, reject) => {
              retryTimeoutRef.current = setTimeout(() => {
                executeWithRetry(attemptCount + 1).then(resolve).catch(reject);
              }, delay);
            });
          }

          throw fluxError;
        }
      };

      const response = await executeWithRetry();
      const responseData = select ? select(response.data) : response.data;

      setState({
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
    } catch (error) {
      const fluxError = error as fluxhttpError;

      setState(prev => ({
        ...prev,
        loading: false,
        error: fluxError,
        success: false,
      }));

      onError?.(fluxError, variables);
      onSettled?.(undefined, fluxError, variables);

      throw fluxError;
    }
  }, [client, onMutate, onSuccess, onError, onSettled, retry, retryDelay, select, cleanup]);

  const mutateAsync = useCallback(async (
    variables: TVariables,
    config: Partial<fluxhttpRequestConfig> = {}
  ): Promise<TData> => {
    return mutate(variables, config);
  }, [mutate]);

  const reset = useCallback(() => {
    cleanup();
    setState({
      data: null,
      loading: false,
      error: null,
      response: null,
      success: false,
      variables: null,
    });
  }, [cleanup]);

  // Cleanup on unmount
  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  return {
    ...state,
    mutate,
    mutateAsync,
    reset,
  };
}