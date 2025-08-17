/**
 * @fileoverview Angular HTTP interceptors for FluxHTTP integration
 */

import { Injectable, Inject, Optional } from '@angular/core';
import { 
  HttpInterceptor, 
  HttpRequest, 
  HttpHandler, 
  HttpEvent, 
  HttpErrorResponse,
  HttpResponse 
} from '@angular/common/http';
import { Observable, throwError, timer, EMPTY } from 'rxjs';
import { 
  catchError, 
  retry, 
  retryWhen, 
  delayWhen, 
  switchMap, 
  tap,
  finalize 
} from 'rxjs/operators';

import { FluxHttpLoadingService, FluxHttpCacheService } from './fluxhttp.service';
import type { 
  FLUXHTTP_CONFIG, 
  FluxHttpConfig, 
  FluxHttpInterceptor 
} from './types';

/**
 * Request interceptor for FluxHTTP
 * Handles request transformation and loading state
 */
@Injectable()
export class FluxHttpRequestInterceptor implements HttpInterceptor {
  constructor(
    @Optional() @Inject(FLUXHTTP_CONFIG) private config: FluxHttpConfig,
    @Optional() private loadingService: FluxHttpLoadingService
  ) {}

  intercept(
    req: HttpRequest<any>, 
    next: HttpHandler
  ): Observable<HttpEvent<any>> {
    // Increment loading state
    this.loadingService?.incrementRequests();

    // Apply default configuration
    let modifiedReq = req;
    
    if (this.config?.defaultConfig) {
      const { baseURL, timeout, headers: defaultHeaders } = this.config.defaultConfig;
      
      // Apply base URL
      if (baseURL && !req.url.startsWith('http')) {
        modifiedReq = req.clone({
          url: `${baseURL.replace(/\/$/, '')}/${req.url.replace(/^\//, '')}`,
        });
      }

      // Apply timeout
      if (timeout) {
        modifiedReq = modifiedReq.clone({
          setHeaders: {
            ...modifiedReq.headers,
            'X-Request-Timeout': timeout.toString(),
          },
        });
      }

      // Apply default headers
      if (defaultHeaders) {
        const headers: Record<string, string> = {};
        Object.entries(defaultHeaders).forEach(([key, value]) => {
          if (typeof value === 'string') {
            headers[key] = value;
          } else if (Array.isArray(value)) {
            headers[key] = value.join(', ');
          }
        });
        
        modifiedReq = modifiedReq.clone({
          setHeaders: headers,
        });
      }
    }

    return next.handle(modifiedReq).pipe(
      finalize(() => {
        this.loadingService?.decrementRequests();
      })
    );
  }
}

/**
 * Response interceptor for FluxHTTP
 * Handles response transformation and success callbacks
 */
@Injectable()
export class FluxHttpResponseInterceptor implements HttpInterceptor {
  constructor(
    @Optional() @Inject(FLUXHTTP_CONFIG) private config: FluxHttpConfig
  ) {}

  intercept(
    req: HttpRequest<any>, 
    next: HttpHandler
  ): Observable<HttpEvent<any>> {
    return next.handle(req).pipe(
      tap(event => {
        if (event instanceof HttpResponse) {
          // Transform response data if needed
          if (this.config?.defaultConfig?.transformResponse) {
            const transformers = this.config.defaultConfig.transformResponse;
            let data = event.body;
            
            for (const transformer of transformers) {
              data = transformer(data);
            }
            
            // Note: In a real implementation, you'd need to clone the response
            // Angular's HttpResponse is immutable
          }
        }
      })
    );
  }
}

/**
 * Error interceptor for FluxHTTP
 * Handles global error handling
 */
@Injectable()
export class FluxHttpErrorInterceptor implements HttpInterceptor {
  constructor(
    @Optional() @Inject(FLUXHTTP_CONFIG) private config: FluxHttpConfig
  ) {}

  intercept(
    req: HttpRequest<any>, 
    next: HttpHandler
  ): Observable<HttpEvent<any>> {
    return next.handle(req).pipe(
      catchError((error: HttpErrorResponse) => {
        // Convert Angular HttpErrorResponse to FluxHTTP error format
        const fluxError = {
          ...error,
          config: {
            url: req.url,
            method: req.method as any,
            headers: this.headersToObject(req.headers),
            data: req.body,
          },
          request: req,
          response: error.error ? {
            data: error.error,
            status: error.status,
            statusText: error.statusText,
            headers: this.headersToObject(error.headers),
            config: {
              url: req.url,
              method: req.method as any,
            },
          } : undefined,
          isfluxhttpError: true,
          toJSON: () => ({
            message: error.message,
            name: error.name,
            config: {
              url: req.url,
              method: req.method,
            },
            code: error.status?.toString(),
          }),
        };

        // Call global error handler
        this.config?.onError?.(fluxError as any);

        return throwError(fluxError);
      })
    );
  }

  private headersToObject(headers: any): Record<string, string> {
    const result: Record<string, string> = {};
    
    if (headers && headers.keys) {
      headers.keys().forEach((key: string) => {
        result[key] = headers.get(key);
      });
    }
    
    return result;
  }
}

/**
 * Retry interceptor for FluxHTTP
 * Handles automatic request retries
 */
@Injectable()
export class FluxHttpRetryInterceptor implements HttpInterceptor {
  constructor(
    @Optional() @Inject(FLUXHTTP_CONFIG) private config: FluxHttpConfig
  ) {}

  intercept(
    req: HttpRequest<any>, 
    next: HttpHandler
  ): Observable<HttpEvent<any>> {
    const retryConfig = this.config?.retry;
    
    if (!retryConfig) {
      return next.handle(req);
    }

    const { attempts = 3, delay = 1000 } = retryConfig;

    return next.handle(req).pipe(
      retryWhen(errors =>
        errors.pipe(
          switchMap((error, index) => {
            // Check if we should retry
            if (index >= attempts - 1) {
              return throwError(error);
            }

            // Check if error is retryable (e.g., network errors, 5xx status codes)
            if (error instanceof HttpErrorResponse) {
              const isRetryable = 
                error.status === 0 || // Network error
                error.status >= 500 || // Server error
                error.status === 408 || // Request timeout
                error.status === 429;   // Too many requests

              if (!isRetryable) {
                return throwError(error);
              }
            }

            // Calculate delay (exponential backoff)
            const retryDelay = delay * Math.pow(2, index);
            
            return timer(Math.min(retryDelay, 30000)); // Max 30 seconds
          })
        )
      )
    );
  }
}

/**
 * Cache interceptor for FluxHTTP
 * Handles response caching
 */
@Injectable()
export class FluxHttpCacheInterceptor implements HttpInterceptor {
  constructor(
    @Optional() @Inject(FLUXHTTP_CONFIG) private config: FluxHttpConfig,
    @Optional() private cacheService: FluxHttpCacheService
  ) {}

  intercept(
    req: HttpRequest<any>, 
    next: HttpHandler
  ): Observable<HttpEvent<any>> {
    // Only cache GET requests
    if (req.method !== 'GET' || !this.cacheService) {
      return next.handle(req);
    }

    const cacheConfig = this.config?.cache;
    if (!cacheConfig?.defaultCacheTime) {
      return next.handle(req);
    }

    // Generate cache key
    const cacheKey = this.generateCacheKey(req);
    
    // Check cache first
    const cached = this.cacheService.get<HttpResponse<any>>(cacheKey);
    if (cached) {
      return new Observable(subscriber => {
        subscriber.next(cached);
        subscriber.complete();
      });
    }

    // Make request and cache response
    return next.handle(req).pipe(
      tap(event => {
        if (event instanceof HttpResponse) {
          this.cacheService.set(
            cacheKey, 
            event, 
            cacheConfig.defaultCacheTime
          );
        }
      })
    );
  }

  private generateCacheKey(req: HttpRequest<any>): string {
    return JSON.stringify({
      url: req.url,
      method: req.method,
      params: req.params.toString(),
    });
  }
}

/**
 * Custom interceptor implementation
 * Allows for flexible interceptor patterns
 */
@Injectable()
export class FluxHttpCustomInterceptor implements HttpInterceptor {
  private interceptors: FluxHttpInterceptor[] = [];

  constructor(
    @Optional() @Inject(FLUXHTTP_CONFIG) private config: FluxHttpConfig
  ) {}

  /**
   * Add a custom interceptor
   */
  use(interceptor: FluxHttpInterceptor): void {
    this.interceptors.push(interceptor);
  }

  /**
   * Remove an interceptor
   */
  eject(interceptor: FluxHttpInterceptor): void {
    const index = this.interceptors.indexOf(interceptor);
    if (index > -1) {
      this.interceptors.splice(index, 1);
    }
  }

  intercept(
    req: HttpRequest<any>, 
    next: HttpHandler
  ): Observable<HttpEvent<any>> {
    // Convert Angular request to FluxHTTP config
    const config = {
      url: req.url,
      method: req.method as any,
      headers: this.headersToObject(req.headers),
      data: req.body,
    };

    // Apply custom interceptors
    let currentConfig = config;
    
    for (const interceptor of this.interceptors) {
      // Note: This is a simplified implementation
      // In a real scenario, you'd need to handle async interceptors properly
      try {
        const result = interceptor.intercept(currentConfig, (cfg) => {
          // Create a mock observable for the interceptor chain
          return new Observable(subscriber => {
            // Convert back to Angular request and continue
            const modifiedReq = this.configToRequest(req, cfg);
            next.handle(modifiedReq).subscribe(subscriber);
          });
        });
        
        // Handle the result...
      } catch (error) {
        return throwError(error);
      }
    }

    return next.handle(req);
  }

  private headersToObject(headers: any): Record<string, string> {
    const result: Record<string, string> = {};
    
    if (headers && headers.keys) {
      headers.keys().forEach((key: string) => {
        result[key] = headers.get(key);
      });
    }
    
    return result;
  }

  private configToRequest(originalReq: HttpRequest<any>, config: any): HttpRequest<any> {
    return originalReq.clone({
      url: config.url || originalReq.url,
      method: config.method || originalReq.method,
      body: config.data !== undefined ? config.data : originalReq.body,
      setHeaders: config.headers || {},
    });
  }
}