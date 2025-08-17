/**
 * @fileoverview React-specific types for FluxHTTP integration
 */

import type { fluxhttpRequestConfig, fluxhttpResponse, fluxhttpError, fluxhttpInstance } from '../../src/types';
import type { ReactNode } from 'react';

/**
 * Hook state for HTTP requests
 */
export interface UseFluxHttpState<T = unknown> {
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
 * Options for useFluxHttp hook
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
  /** Dependencies to trigger refetch */
  deps?: React.DependencyList;
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
}

/**
 * Return type for useFluxHttp hook
 */
export interface UseFluxHttpReturn<T = unknown> extends UseFluxHttpState<T> {
  /** Execute the request manually */
  execute: (config?: Partial<fluxhttpRequestConfig>) => Promise<fluxhttpResponse<T>>;
  /** Refetch the request with same parameters */
  refetch: () => Promise<fluxhttpResponse<T>>;
  /** Cancel the current request */
  cancel: () => void;
  /** Reset the hook state */
  reset: () => void;
  /** Mutate cached data */
  mutate: (data: T | ((currentData: T | null) => T), revalidate?: boolean) => void;
}

/**
 * Configuration for FluxHttpProvider
 */
export interface FluxHttpProviderConfig {
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
 * Props for FluxHttpProvider
 */
export interface FluxHttpProviderProps extends FluxHttpProviderConfig {
  children: ReactNode;
}

/**
 * Context value for FluxHttp
 */
export interface FluxHttpContextValue {
  /** FluxHTTP instance */
  client: fluxhttpInstance;
  /** Provider configuration */
  config: FluxHttpProviderConfig;
  /** Global loading state */
  isLoading: boolean;
  /** Active request count */
  activeRequests: number;
  /** Cache utilities */
  cache: {
    get: <T>(key: string) => T | undefined;
    set: <T>(key: string, data: T, ttl?: number) => void;
    remove: (key: string) => void;
    clear: () => void;
  };
}

/**
 * Options for useFluxHttpMutation hook
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
 * State for mutation hook
 */
export interface UseFluxHttpMutationState<TData = unknown> {
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
 * Return type for useFluxHttpMutation hook
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
 * Options for fetch components
 */
export interface FetchComponentProps<T = unknown> extends UseFluxHttpOptions<T> {
  /** URL to fetch */
  url: string;
  /** Children render function */
  children: (state: UseFluxHttpReturn<T>) => ReactNode;
  /** Loading fallback component */
  fallback?: ReactNode;
  /** Error fallback component */
  errorFallback?: ReactNode | ((error: fluxhttpError) => ReactNode);
}

/**
 * Props for Query component
 */
export interface QueryProps<T = unknown> extends FetchComponentProps<T> {
  /** Query key for caching */
  queryKey?: string | string[];
}

/**
 * Props for Mutation component
 */
export interface MutationProps<TData = unknown, TVariables = unknown> 
  extends UseFluxHttpMutationOptions<TData, TVariables> {
  /** Children render function */
  children: (state: UseFluxHttpMutationReturn<TData, TVariables>) => ReactNode;
}

/**
 * Props for suspense-enabled fetch component
 */
export interface SuspenseFetchProps<T = unknown> extends Omit<UseFluxHttpOptions<T>, 'immediate'> {
  /** URL to fetch */
  url: string;
  /** Children render function */
  children: (data: T, refetch: () => Promise<fluxhttpResponse<T>>) => ReactNode;
}

/**
 * Type for cache key generator
 */
export type CacheKeyGenerator = (config: fluxhttpRequestConfig) => string;

/**
 * Type for error boundary fallback
 */
export type ErrorBoundaryFallback = (props: {
  error: fluxhttpError;
  retry: () => void;
  reset: () => void;
}) => ReactNode;