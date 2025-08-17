/**
 * @fileoverview Angular service for FluxHTTP integration
 */

import { Injectable, Inject, Optional } from '@angular/core';
import { BehaviorSubject, Observable, Subject, throwError, timer, EMPTY } from 'rxjs';
import { 
  map, 
  catchError, 
  finalize, 
  tap, 
  switchMap, 
  retry, 
  retryWhen, 
  delayWhen,
  shareReplay,
  startWith,
  distinctUntilChanged
} from 'rxjs/operators';
import fluxhttp from '../../src/index';
import type { fluxhttpInstance, fluxhttpRequestConfig, fluxhttpResponse, fluxhttpError } from '../../src/types';
import type { 
  FLUXHTTP_CONFIG, 
  FLUXHTTP_INSTANCE, 
  FluxHttpConfig,
  FluxHttpState,
  FluxHttpResult,
  FluxHttpRequestOptions,
  FluxHttpMutationOptions,
  FluxHttpMutationResult,
  QueryOptions,
  QueryResult,
  InfiniteQueryOptions,
  InfiniteQueryResult,
  LoadingState,
  CacheService
} from './types';

/**
 * Cache implementation for Angular
 */
@Injectable({
  providedIn: 'root'
})
export class FluxHttpCacheService implements CacheService {
  private cache = new Map<string, { data: unknown; timestamp: number; ttl: number }>();
  private defaultTTL = 5 * 60 * 1000; // 5 minutes
  private maxSize = 100;

  constructor(@Optional() @Inject(FLUXHTTP_CONFIG) config?: FluxHttpConfig) {
    if (config?.cache) {
      this.defaultTTL = config.cache.defaultCacheTime ?? this.defaultTTL;
      this.maxSize = config.cache.maxSize ?? this.maxSize;
    }
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

  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    
    // Check if expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return false;
    }
    
    return true;
  }

  size(): number {
    return this.cache.size;
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

/**
 * Loading state service for tracking global loading state
 */
@Injectable({
  providedIn: 'root'
})
export class FluxHttpLoadingService implements LoadingState {
  private readonly _activeRequests = new BehaviorSubject<number>(0);
  private readonly _isLoading = new BehaviorSubject<boolean>(false);

  get activeRequests(): number {
    return this._activeRequests.value;
  }

  get isLoading(): boolean {
    return this._isLoading.value;
  }

  get activeRequests$(): Observable<number> {
    return this._activeRequests.asObservable();
  }

  get loading$(): Observable<boolean> {
    return this._isLoading.asObservable();
  }

  incrementRequests(): void {
    const newCount = this._activeRequests.value + 1;
    this._activeRequests.next(newCount);
    if (newCount === 1) {
      this._isLoading.next(true);
    }
  }

  decrementRequests(): void {
    const newCount = Math.max(0, this._activeRequests.value - 1);
    this._activeRequests.next(newCount);
    if (newCount === 0) {
      this._isLoading.next(false);
    }
  }
}

/**
 * Main FluxHTTP service for Angular applications
 * 
 * @example
 * ```typescript
 * @Component({
 *   template: `
 *     <div *ngIf="userQuery.loading">Loading...</div>
 *     <div *ngIf="userQuery.error">Error: {{ userQuery.error.message }}</div>
 *     <div *ngIf="userQuery.data">Hello, {{ userQuery.data.name }}!</div>
 *     <button (click)="userQuery.refetch()">Refresh</button>
 *   `
 * })
 * export class UserComponent implements OnInit {
 *   userQuery!: FluxHttpResult<User>;
 * 
 *   constructor(private fluxHttp: FluxHttpService) {}
 * 
 *   ngOnInit() {
 *     this.userQuery = this.fluxHttp.createQuery<User>({
 *       url: '/api/user',
 *       immediate: true
 *     });
 *   }
 * }
 * ```
 */
@Injectable({
  providedIn: 'root'
})
export class FluxHttpService {
  private readonly client: fluxhttpInstance;
  private readonly config: FluxHttpConfig;
  private readonly errorSubject = new Subject<fluxhttpError>();

  constructor(
    @Optional() @Inject(FLUXHTTP_INSTANCE) instance?: fluxhttpInstance,
    @Optional() @Inject(FLUXHTTP_CONFIG) config?: FluxHttpConfig,
    private loadingService?: FluxHttpLoadingService,
    private cacheService?: FluxHttpCacheService
  ) {
    this.config = config || {};
    this.client = instance || fluxhttp.create(this.config.defaultConfig);
    this.setupInterceptors();
  }

  /**
   * Get the FluxHTTP client instance
   */
  get instance(): fluxhttpInstance {
    return this.client;
  }

  /**
   * Observable of HTTP errors
   */
  get errors$(): Observable<fluxhttpError> {
    return this.errorSubject.asObservable();
  }

  /**
   * Setup request/response interceptors
   */
  private setupInterceptors(): void {
    // Request interceptor
    this.client.interceptors.request.use(
      (config) => {
        this.loadingService?.incrementRequests();
        return config;
      },
      (error) => {
        this.loadingService?.decrementRequests();
        return Promise.reject(error);
      }
    );

    // Response interceptor
    this.client.interceptors.response.use(
      (response) => {
        this.loadingService?.decrementRequests();
        return response;
      },
      (error) => {
        this.loadingService?.decrementRequests();
        this.errorSubject.next(error);
        this.config.onError?.(error);
        return Promise.reject(error);
      }
    );
  }

  /**
   * Generate cache key from request config
   */
  private generateCacheKey(config: fluxhttpRequestConfig): string {
    const { url, method = 'GET', params, data } = config;
    return JSON.stringify({ url, method, params, data });
  }

  /**
   * Create an HTTP request observable
   */
  createRequest<T = unknown>(
    config: fluxhttpRequestConfig,
    options: FluxHttpRequestOptions<T> = {}
  ): Observable<fluxhttpResponse<T>> {
    const {
      retry: retryConfig = false,
      retryDelay = (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      staleTime = 0,
      cacheTime = 5 * 60 * 1000,
    } = { ...this.config, ...options };

    // Check cache first
    const cacheKey = this.generateCacheKey(config);
    const cached = this.cacheService?.get<fluxhttpResponse<T>>(cacheKey);
    
    if (cached && staleTime > 0) {
      const cachedTime = (cached as any).timestamp || 0;
      if (Date.now() - cachedTime < staleTime) {
        return new Observable(subscriber => {
          subscriber.next(cached);
          subscriber.complete();
        });
      }
    }

    return new Observable<fluxhttpResponse<T>>(subscriber => {
      const abortController = new AbortController();
      
      const request = this.client.request<T>({
        ...config,
        signal: abortController.signal,
      });

      request
        .then(response => {
          // Cache the response
          if (this.cacheService && cacheTime > 0) {
            this.cacheService.set(cacheKey, {
              ...response,
              timestamp: Date.now(),
            }, cacheTime);
          }

          subscriber.next(response);
          subscriber.complete();
        })
        .catch(error => {
          subscriber.error(error);
        });

      // Return cleanup function
      return () => {
        abortController.abort();
      };
    }).pipe(
      // Add retry logic if configured
      retryConfig ? this.addRetryLogic(retryConfig, retryDelay) : tap(),
      shareReplay(1)
    );
  }

  /**
   * Add retry logic to observable
   */
  private addRetryLogic<T>(
    retryConfig: boolean | number | ((failureCount: number, error: fluxhttpError) => boolean),
    retryDelay: (attemptIndex: number) => number
  ) {
    return retryWhen<T>((errors: Observable<fluxhttpError>) =>
      errors.pipe(
        switchMap((error, index) => {
          let shouldRetry = false;
          
          if (typeof retryConfig === 'boolean') {
            shouldRetry = retryConfig && index < 3;
          } else if (typeof retryConfig === 'number') {
            shouldRetry = index < retryConfig;
          } else if (typeof retryConfig === 'function') {
            shouldRetry = retryConfig(index, error);
          }

          if (shouldRetry) {
            const delay = retryDelay(index);
            return timer(delay);
          } else {
            return throwError(error);
          }
        })
      )
    );
  }

  /**
   * Create a query with state management
   */
  createQuery<T = unknown>(options: FluxHttpRequestOptions<T>): FluxHttpResult<T> {
    const {
      immediate = false,
      initialData = null,
      onSuccess,
      onError,
      onFinally,
      select,
      keepPreviousData = false,
      ...requestConfig
    } = options;

    // State subjects
    const dataSubject = new BehaviorSubject<T | null>(initialData);
    const loadingSubject = new BehaviorSubject<boolean>(false);
    const errorSubject = new BehaviorSubject<fluxhttpError | null>(null);
    const responseSubject = new BehaviorSubject<fluxhttpResponse<T> | null>(null);
    const successSubject = new BehaviorSubject<boolean>(false);

    // Combined state observable
    const stateSubject = new BehaviorSubject<FluxHttpState<T>>({
      data: initialData,
      loading: false,
      error: null,
      response: null,
      success: false,
    });

    let currentRequest$: Observable<fluxhttpResponse<T>> | null = null;

    const updateState = (updates: Partial<FluxHttpState<T>>) => {
      const currentState = stateSubject.value;
      const newState = { ...currentState, ...updates };
      stateSubject.next(newState);
      
      dataSubject.next(newState.data);
      loadingSubject.next(newState.loading);
      errorSubject.next(newState.error);
      responseSubject.next(newState.response);
      successSubject.next(newState.success);
    };

    const execute = (config?: Partial<fluxhttpRequestConfig>): Observable<fluxhttpResponse<T>> => {
      const finalConfig = { ...requestConfig, ...config };
      
      updateState({ 
        loading: true, 
        error: null, 
        ...(keepPreviousData ? {} : { data: null, response: null, success: false })
      });

      currentRequest$ = this.createRequest<T>(finalConfig, options).pipe(
        tap(response => {
          const responseData = select ? select(response.data) : response.data;
          updateState({
            data: responseData as T,
            loading: false,
            error: null,
            response,
            success: true,
          });
          onSuccess?.(response.data, response);
          onFinally?.();
        }),
        catchError(error => {
          updateState({
            loading: false,
            error,
            success: false,
          });
          onError?.(error);
          onFinally?.();
          return throwError(error);
        }),
        finalize(() => {
          currentRequest$ = null;
        })
      );

      return currentRequest$;
    };

    const refetch = (): Observable<fluxhttpResponse<T>> => {
      return execute();
    };

    const cancel = (): void => {
      // Note: Cancellation is handled by the AbortController in createRequest
      updateState({ loading: false });
    };

    const reset = (): void => {
      updateState({
        data: initialData,
        loading: false,
        error: null,
        response: null,
        success: false,
      });
    };

    const mutate = (
      data: T | ((currentData: T | null) => T),
      revalidate: boolean = true
    ): void => {
      const newData = typeof data === 'function' 
        ? (data as (currentData: T | null) => T)(dataSubject.value)
        : data;

      updateState({ data: newData });

      if (revalidate) {
        setTimeout(() => refetch().subscribe(), 0);
      }
    };

    // Execute immediately if requested
    if (immediate && requestConfig.url) {
      setTimeout(() => execute().subscribe(), 0);
    }

    return {
      // Current state
      get data() { return dataSubject.value; },
      get loading() { return loadingSubject.value; },
      get error() { return errorSubject.value; },
      get response() { return responseSubject.value; },
      get success() { return successSubject.value; },

      // Methods
      execute,
      refetch,
      cancel,
      reset,
      mutate,

      // Observables
      state$: stateSubject.asObservable(),
      data$: dataSubject.asObservable(),
      loading$: loadingSubject.asObservable(),
      error$: errorSubject.asObservable(),
      success$: successSubject.asObservable(),
    };
  }

  /**
   * Create a mutation for data modification
   */
  createMutation<TData = unknown, TVariables = unknown>(
    options: FluxHttpMutationOptions<TData, TVariables> = {}
  ): FluxHttpMutationResult<TData, TVariables> {
    const {
      onSuccess,
      onError,
      onSettled,
      onMutate,
      retry: retryConfig = false,
      retryDelay = (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      select,
    } = options;

    // State subjects
    const dataSubject = new BehaviorSubject<TData | null>(null);
    const loadingSubject = new BehaviorSubject<boolean>(false);
    const errorSubject = new BehaviorSubject<fluxhttpError | null>(null);
    const responseSubject = new BehaviorSubject<fluxhttpResponse<TData> | null>(null);
    const successSubject = new BehaviorSubject<boolean>(false);
    const variablesSubject = new BehaviorSubject<TVariables | null>(null);

    // Combined state observable
    const stateSubject = new BehaviorSubject<FluxHttpMutationResult<TData, TVariables>>({
      data: null,
      loading: false,
      error: null,
      response: null,
      success: false,
      variables: null,
      mutate: () => EMPTY, // Will be overridden
      mutateAsync: () => Promise.reject(new Error('Not implemented')), // Will be overridden
      reset: () => {}, // Will be overridden
      state$: EMPTY, // Will be overridden
    });

    const updateState = (updates: Partial<FluxHttpMutationResult<TData, TVariables>>) => {
      const currentState = stateSubject.value;
      const newState = { ...currentState, ...updates };
      stateSubject.next(newState);
      
      if (updates.data !== undefined) dataSubject.next(updates.data);
      if (updates.loading !== undefined) loadingSubject.next(updates.loading);
      if (updates.error !== undefined) errorSubject.next(updates.error);
      if (updates.response !== undefined) responseSubject.next(updates.response);
      if (updates.success !== undefined) successSubject.next(updates.success);
      if (updates.variables !== undefined) variablesSubject.next(updates.variables as TVariables);
    };

    const mutate = (
      variables: TVariables,
      config: Partial<fluxhttpRequestConfig> = {}
    ): Observable<TData> => {
      updateState({
        loading: true,
        error: null,
        success: false,
        variables,
      });

      const finalConfig: fluxhttpRequestConfig = {
        ...config,
        data: variables,
      };

      // Call onMutate callback
      if (onMutate) {
        Promise.resolve(onMutate(variables)).catch(() => {});
      }

      return this.createRequest<TData>(finalConfig, { retry: retryConfig, retryDelay }).pipe(
        map(response => {
          const responseData = select ? select(response.data) : response.data;
          
          updateState({
            data: responseData as TData,
            loading: false,
            error: null,
            response,
            success: true,
          });

          onSuccess?.(response.data, variables, response);
          onSettled?.(response.data, null, variables);

          return response.data;
        }),
        catchError(error => {
          updateState({
            loading: false,
            error,
            success: false,
          });

          onError?.(error, variables);
          onSettled?.(undefined, error, variables);

          return throwError(error);
        })
      );
    };

    const mutateAsync = async (
      variables: TVariables,
      config: Partial<fluxhttpRequestConfig> = {}
    ): Promise<TData> => {
      return mutate(variables, config).toPromise() as Promise<TData>;
    };

    const reset = (): void => {
      updateState({
        data: null,
        loading: false,
        error: null,
        response: null,
        success: false,
        variables: null,
      });
    };

    return {
      // Current state
      get data() { return dataSubject.value; },
      get loading() { return loadingSubject.value; },
      get error() { return errorSubject.value; },
      get response() { return responseSubject.value; },
      get success() { return successSubject.value; },
      get variables() { return variablesSubject.value; },

      // Methods
      mutate,
      mutateAsync,
      reset,

      // Observables
      state$: stateSubject.asObservable(),
    };
  }

  /**
   * Make a simple GET request
   */
  get<T = unknown>(url: string, config?: fluxhttpRequestConfig): Observable<fluxhttpResponse<T>> {
    return this.createRequest<T>({ ...config, url, method: 'GET' });
  }

  /**
   * Make a simple POST request
   */
  post<T = unknown>(url: string, data?: any, config?: fluxhttpRequestConfig): Observable<fluxhttpResponse<T>> {
    return this.createRequest<T>({ ...config, url, method: 'POST', data });
  }

  /**
   * Make a simple PUT request
   */
  put<T = unknown>(url: string, data?: any, config?: fluxhttpRequestConfig): Observable<fluxhttpResponse<T>> {
    return this.createRequest<T>({ ...config, url, method: 'PUT', data });
  }

  /**
   * Make a simple DELETE request
   */
  delete<T = unknown>(url: string, config?: fluxhttpRequestConfig): Observable<fluxhttpResponse<T>> {
    return this.createRequest<T>({ ...config, url, method: 'DELETE' });
  }

  /**
   * Make a simple PATCH request
   */
  patch<T = unknown>(url: string, data?: any, config?: fluxhttpRequestConfig): Observable<fluxhttpResponse<T>> {
    return this.createRequest<T>({ ...config, url, method: 'PATCH', data });
  }
}