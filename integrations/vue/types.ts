/**
 * @fileoverview Vue-specific types for FluxHTTP integration
 */

import type { Ref, ComputedRef } from 'vue';
import type { fluxhttpRequestConfig, fluxhttpResponse, fluxhttpError, fluxhttpInstance } from '../../src/types';

/**
 * Vue composable state for HTTP requests
 */
export interface UseFluxHttpState<T = unknown> {
  /** Response data (reactive) */
  data: Ref<T | null>;
  /** Loading state (reactive) */
  loading: Ref<boolean>;
  /** Error state (reactive) */
  error: Ref<fluxhttpError | null>;
  /** Response object (reactive) */
  response: Ref<fluxhttpResponse<T> | null>;
  /** Request completion status (reactive) */
  success: Ref<boolean>;
}

/**
 * Options for useFluxHttp composable
 */
export interface UseFluxHttpOptions<T = unknown> extends fluxhttpRequestConfig {
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
  /** Watch sources to trigger refetch */
  watch?: Array<Ref<any> | ComputedRef<any> | (() => any)>;
  /** Whether to refetch on window focus */
  refetchOnWindowFocus?: boolean;
  /** Whether to refetch on network reconnect */
  refetchOnReconnect?: boolean;
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
  /** Whether to reset data on parameter change */
  resetOnParameterChange?: boolean;
}

/**
 * Return type for useFluxHttp composable
 */
export interface UseFluxHttpReturn<T = unknown> extends UseFluxHttpState<T> {
  /** Execute the request manually */
  execute: (config?: Partial<fluxhttpRequestConfig>) => Promise<fluxhttpResponse<T>>;
  /** Refetch the request with same parameters */
  refetch: () => Promise<fluxhttpResponse<T>>;
  /** Cancel the current request */
  cancel: () => void;
  /** Reset the composable state */
  reset: () => void;
  /** Mutate cached data */
  mutate: (data: T | ((currentData: T | null) => T), revalidate?: boolean) => void;
  /** Check if request is fresh */
  isFresh: ComputedRef<boolean>;
  /** Check if request is stale */
  isStale: ComputedRef<boolean>;
}

/**
 * Options for useFluxHttpMutation composable
 */
export interface UseFluxHttpMutationOptions<TData = unknown, TVariables = unknown> {
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
 * State for mutation composable
 */
export interface UseFluxHttpMutationState<TData = unknown> {
  /** Mutation data (reactive) */
  data: Ref<TData | null>;
  /** Loading state (reactive) */
  loading: Ref<boolean>;
  /** Error state (reactive) */
  error: Ref<fluxhttpError | null>;
  /** Response object (reactive) */
  response: Ref<fluxhttpResponse<TData> | null>;
  /** Success state (reactive) */
  success: Ref<boolean>;
  /** Variables used in the last mutation (reactive) */
  variables: Ref<unknown>;
}

/**
 * Return type for useFluxHttpMutation composable
 */
export interface UseFluxHttpMutationReturn<TData = unknown, TVariables = unknown> 
  extends UseFluxHttpMutationState<TData> {
  /** Execute the mutation */
  mutate: (variables: TVariables, options?: Partial<fluxhttpRequestConfig>) => Promise<TData>;
  /** Execute mutation asynchronously */
  mutateAsync: (variables: TVariables, options?: Partial<fluxhttpRequestConfig>) => Promise<TData>;
  /** Reset mutation state */
  reset: () => void;
}

/**
 * Configuration for FluxHttp Vue plugin
 */
export interface FluxHttpPluginOptions {
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
  /** Plugin name for provide/inject */
  key?: string | symbol;
}

/**
 * Global properties added to Vue app instance
 */
export interface FluxHttpGlobalProperties {
  /** FluxHTTP client instance */
  $fluxhttp: fluxhttpInstance;
}

/**
 * Context value for FluxHttp injection
 */
export interface FluxHttpContext {
  /** FluxHTTP instance */
  client: fluxhttpInstance;
  /** Plugin configuration */
  config: FluxHttpPluginOptions;
  /** Global loading state */
  isLoading: Ref<boolean>;
  /** Active request count */
  activeRequests: Ref<number>;
  /** Cache utilities */
  cache: {
    get: <T>(key: string) => T | undefined;
    set: <T>(key: string, data: T, ttl?: number) => void;
    remove: (key: string) => void;
    clear: () => void;
  };
}

/**
 * Options for query composable
 */
export interface UseQueryOptions<T = unknown> extends UseFluxHttpOptions<T> {
  /** Query key for caching */
  queryKey?: string | string[] | Ref<string | string[]>;
  /** Enable query */
  enabled?: boolean | Ref<boolean>;
  /** Query function */
  queryFn?: () => Promise<T>;
}

/**
 * Return type for query composable
 */
export interface UseQueryReturn<T = unknown> extends UseFluxHttpReturn<T> {
  /** Query key (computed) */
  queryKey: ComputedRef<string>;
  /** Whether query is enabled (computed) */
  enabled: ComputedRef<boolean>;
}

/**
 * Options for infinite query composable
 */
export interface UseInfiniteQueryOptions<T = unknown> extends UseFluxHttpOptions<T> {
  /** Query key for caching */
  queryKey?: string | string[] | Ref<string | string[]>;
  /** Function to get next page parameter */
  getNextPageParam?: (lastPage: T, allPages: T[]) => unknown;
  /** Function to get previous page parameter */
  getPreviousPageParam?: (firstPage: T, allPages: T[]) => unknown;
  /** Initial page parameter */
  initialPageParam?: unknown;
  /** Maximum number of pages to fetch */
  maxPages?: number;
}

/**
 * Return type for infinite query composable
 */
export interface UseInfiniteQueryReturn<T = unknown> {
  /** All page data (reactive) */
  data: Ref<T[]>;
  /** Loading state (reactive) */
  loading: Ref<boolean>;
  /** Error state (reactive) */
  error: Ref<fluxhttpError | null>;
  /** Success state (reactive) */
  success: Ref<boolean>;
  /** Whether there's a next page */
  hasNextPage: ComputedRef<boolean>;
  /** Whether there's a previous page */
  hasPreviousPage: ComputedRef<boolean>;
  /** Whether fetching next page */
  isFetchingNextPage: Ref<boolean>;
  /** Whether fetching previous page */
  isFetchingPreviousPage: Ref<boolean>;
  /** Fetch next page */
  fetchNextPage: () => Promise<fluxhttpResponse<T> | undefined>;
  /** Fetch previous page */
  fetchPreviousPage: () => Promise<fluxhttpResponse<T> | undefined>;
  /** Refetch all pages */
  refetch: () => Promise<fluxhttpResponse<T>[]>;
  /** Reset query state */
  reset: () => void;
}

/**
 * Type for cache key generator
 */
export type CacheKeyGenerator = (config: fluxhttpRequestConfig) => string;

/**
 * Type for Vue component props with FluxHTTP support
 */
export interface FluxHttpComponentProps {
  /** Request URL */
  url?: string;
  /** HTTP method */
  method?: string;
  /** Request parameters */
  params?: Record<string, any>;
  /** Request data */
  data?: any;
  /** Whether to execute immediately */
  immediate?: boolean;
  /** Loading template */
  loadingTemplate?: string;
  /** Error template */
  errorTemplate?: string;
  /** Success template */
  successTemplate?: string;
}

/**
 * Directive binding value for v-fluxhttp
 */
export interface FluxHttpDirectiveBinding {
  /** Request configuration */
  config?: fluxhttpRequestConfig;
  /** Success callback */
  onSuccess?: (data: any, element: HTMLElement) => void;
  /** Error callback */
  onError?: (error: fluxhttpError, element: HTMLElement) => void;
  /** Loading callback */
  onLoading?: (loading: boolean, element: HTMLElement) => void;
  /** Auto-execute on mount */
  immediate?: boolean;
  /** Event to trigger request */
  trigger?: string | string[];
}