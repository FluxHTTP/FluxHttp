/**
 * @fileoverview React integration index - exports all React-specific FluxHTTP components and hooks
 */

// Main provider and context
export {
  FluxHttpProvider,
  useFluxHttpContext,
  useFluxHttpClient,
  useFluxHttpLoading,
  useFluxHttpCache,
  withFluxHttp,
} from './FluxHttpProvider';

// Core hooks
export {
  useFluxHttp,
  useFluxHttpMutation,
} from './useFluxHttp';

// Ready-to-use components
export {
  Fetch,
  Query,
  Mutation,
  SuspenseFetch,
  FluxHttpErrorBoundary,
  LoadingOverlay,
  InfiniteScroll,
} from './components';

// Types
export type {
  UseFluxHttpState,
  UseFluxHttpOptions,
  UseFluxHttpReturn,
  UseFluxHttpMutationOptions,
  UseFluxHttpMutationState,
  UseFluxHttpMutationReturn,
  FluxHttpProviderConfig,
  FluxHttpProviderProps,
  FluxHttpContextValue,
  FetchComponentProps,
  QueryProps,
  MutationProps,
  SuspenseFetchProps,
  CacheKeyGenerator,
  ErrorBoundaryFallback,
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