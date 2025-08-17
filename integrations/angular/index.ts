/**
 * @fileoverview Angular integration index - exports all Angular-specific FluxHTTP services and modules
 */

// Core services
export { FluxHttpService } from './fluxhttp.service';
export { FluxHttpCacheService } from './fluxhttp.service';
export { FluxHttpLoadingService } from './fluxhttp.service';

// Module
export { FluxHttpModule } from './module';

// Interceptors
export {
  FluxHttpRequestInterceptor,
  FluxHttpResponseInterceptor,
  FluxHttpErrorInterceptor,
  FluxHttpRetryInterceptor,
  FluxHttpCacheInterceptor,
} from './interceptors';

// Types and tokens
export {
  FLUXHTTP_CONFIG,
  FLUXHTTP_INSTANCE,
} from './types';

export type {
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
  FluxHttpInterceptor,
  CacheKeyGenerator,
  LoadingState,
  ErrorHandler,
  CacheService,
  FluxHttpModuleConfig,
  FluxHttpDirectiveOptions,
} from './types';

// Re-export core FluxHTTP types for convenience
export type {
  fluxhttpRequestConfig,
  fluxhttpResponse,
  fluxhttpError,
  fluxhttpInstance,
  HttpMethod,
  Headers,
  RequestBody,
  QueryParams,
} from '../../src/types';