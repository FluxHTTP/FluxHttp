/**
 * @fileoverview Angular-specific types for FluxHTTP integration
 */

import { Observable } from 'rxjs';
import { InjectionToken } from '@angular/core';
import type { fluxhttpRequestConfig, fluxhttpResponse, fluxhttpError, fluxhttpInstance } from '../../src/types';

/**
 * Configuration for FluxHttp Angular module
 */
export interface FluxHttpConfig {
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
 * Injection token for FluxHttp configuration
 */
export const FLUXHTTP_CONFIG = new InjectionToken<FluxHttpConfig>('FLUXHTTP_CONFIG');

/**
 * Injection token for FluxHttp instance
 */
export const FLUXHTTP_INSTANCE = new InjectionToken<fluxhttpInstance>('FLUXHTTP_INSTANCE');

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
 * Options for HTTP requests
 */
export interface FluxHttpRequestOptions<T = unknown> extends fluxhttpRequestConfig {
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
 * Result interface for HTTP requests
 */
export interface FluxHttpResult<T = unknown> extends FluxHttpState<T> {
  /** Execute the request manually */
  execute(config?: Partial<fluxhttpRequestConfig>): Observable<fluxhttpResponse<T>>;
  /** Refetch the request with same parameters */
  refetch(): Observable<fluxhttpResponse<T>>;
  /** Cancel the current request */
  cancel(): void;
  /** Reset the state */
  reset(): void;
  /** Mutate cached data */
  mutate(data: T | ((currentData: T | null) => T), revalidate?: boolean): void;
  /** Observable of the current state */
  state$: Observable<FluxHttpState<T>>;
  /** Observable of the data */
  data$: Observable<T | null>;
  /** Observable of the loading state */
  loading$: Observable<boolean>;
  /** Observable of the error state */
  error$: Observable<fluxhttpError | null>;
  /** Observable of the success state */
  success$: Observable<boolean>;
}

/**
 * Options for mutation requests
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
 * Result interface for mutations
 */
export interface FluxHttpMutationResult<TData = unknown, TVariables = unknown> 
  extends FluxHttpMutationState<TData> {
  /** Execute the mutation */
  mutate(variables: TVariables, options?: Partial<fluxhttpRequestConfig>): Observable<TData>;
  /** Execute mutation asynchronously */
  mutateAsync(variables: TVariables, options?: Partial<fluxhttpRequestConfig>): Promise<TData>;
  /** Reset mutation state */
  reset(): void;
  /** Observable of the current state */
  state$: Observable<FluxHttpMutationState<TData>>;
}

/**
 * Options for query observables
 */
export interface QueryOptions<T = unknown> extends FluxHttpRequestOptions<T> {
  /** Query key for caching */
  queryKey?: string | string[];
  /** Enable query */
  enabled?: boolean;
  /** Query function */
  queryFn?: () => Observable<T>;
}

/**
 * Result interface for queries
 */
export interface QueryResult<T = unknown> extends FluxHttpResult<T> {
  /** Query key */
  queryKey: string;
  /** Whether query is enabled */
  enabled: boolean;
}

/**
 * Options for infinite queries
 */
export interface InfiniteQueryOptions<T = unknown> extends FluxHttpRequestOptions<T> {
  /** Query key for caching */
  queryKey?: string | string[];
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
 * Result interface for infinite queries
 */
export interface InfiniteQueryResult<T = unknown> {
  /** All page data */
  data: T[];
  /** Loading state */
  loading: boolean;
  /** Error state */
  error: fluxhttpError | null;
  /** Success state */
  success: boolean;
  /** Whether there's a next page */
  hasNextPage: boolean;
  /** Whether there's a previous page */
  hasPreviousPage: boolean;
  /** Whether fetching next page */
  isFetchingNextPage: boolean;
  /** Whether fetching previous page */
  isFetchingPreviousPage: boolean;
  /** Fetch next page */
  fetchNextPage(): Observable<fluxhttpResponse<T> | undefined>;
  /** Fetch previous page */
  fetchPreviousPage(): Observable<fluxhttpResponse<T> | undefined>;
  /** Refetch all pages */
  refetch(): Observable<fluxhttpResponse<T>[]>;
  /** Reset query state */
  reset(): void;
  /** Observable streams */
  data$: Observable<T[]>;
  loading$: Observable<boolean>;
  error$: Observable<fluxhttpError | null>;
  success$: Observable<boolean>;
  hasNextPage$: Observable<boolean>;
  hasPreviousPage$: Observable<boolean>;
}

/**
 * Interface for HTTP interceptor
 */
export interface FluxHttpInterceptor {
  /** Intercept request */
  intercept(
    config: fluxhttpRequestConfig,
    next: (config: fluxhttpRequestConfig) => Observable<fluxhttpResponse>
  ): Observable<fluxhttpResponse>;
}

/**
 * Type for cache key generator
 */
export type CacheKeyGenerator = (config: fluxhttpRequestConfig) => string;

/**
 * Interface for loading state service
 */
export interface LoadingState {
  /** Whether any requests are loading */
  isLoading: boolean;
  /** Number of active requests */
  activeRequests: number;
  /** Loading state observable */
  loading$: Observable<boolean>;
  /** Active requests count observable */
  activeRequests$: Observable<number>;
}

/**
 * Interface for error handling service
 */
export interface ErrorHandler {
  /** Handle HTTP error */
  handleError(error: fluxhttpError): void;
  /** Error stream */
  errors$: Observable<fluxhttpError>;
}

/**
 * Interface for cache service
 */
export interface CacheService {
  /** Get cached data */
  get<T>(key: string): T | undefined;
  /** Set cached data */
  set<T>(key: string, data: T, ttl?: number): void;
  /** Remove cached data */
  remove(key: string): void;
  /** Clear all cached data */
  clear(): void;
  /** Check if key exists in cache */
  has(key: string): boolean;
  /** Get cache size */
  size(): number;
}

/**
 * Module configuration for forRoot
 */
export interface FluxHttpModuleConfig extends FluxHttpConfig {
  /** Whether to provide interceptors */
  provideInterceptors?: boolean;
  /** Whether to provide error handler */
  provideErrorHandler?: boolean;
  /** Whether to provide loading state service */
  provideLoadingState?: boolean;
  /** Whether to provide cache service */
  provideCacheService?: boolean;
}

/**
 * Options for directive
 */
export interface FluxHttpDirectiveOptions {
  /** Request configuration */
  config?: fluxhttpRequestConfig;
  /** Success callback */
  onSuccess?: (data: any, element: HTMLElement) => void;
  /** Error callback */
  onError?: (error: fluxhttpError, element: HTMLElement) => void;
  /** Loading callback */
  onLoading?: (loading: boolean, element: HTMLElement) => void;
  /** Auto-execute on init */
  immediate?: boolean;
  /** Event to trigger request */
  trigger?: string | string[];
  /** Loading template */
  loadingTemplate?: string;
  /** Error template */
  errorTemplate?: string;
}