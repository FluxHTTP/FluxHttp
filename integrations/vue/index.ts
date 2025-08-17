/**
 * @fileoverview Vue integration index - exports all Vue-specific FluxHTTP components and composables
 */

// Plugin and context
export {
  FluxHttpPlugin,
  useFluxHttpContext,
  useFluxHttpClient,
  useFluxHttpLoading,
  useFluxHttpCache,
  provideFluxHttp,
  FLUXHTTP_KEY,
  defaultKey,
} from './plugin';

// Core composables
export {
  useFluxHttp,
  useFluxHttpMutation,
  useQuery,
  useInfiniteQuery,
} from './useFluxHttp';

// Components (export from components.vue)
export {
  FluxHttpFetch,
  FluxHttpQuery,
  FluxHttpMutation,
  FluxHttpInfiniteScroll,
  FluxHttpLoadingOverlay,
} from './components.vue';

// Types
export type {
  UseFluxHttpState,
  UseFluxHttpOptions,
  UseFluxHttpReturn,
  UseFluxHttpMutationOptions,
  UseFluxHttpMutationState,
  UseFluxHttpMutationReturn,
  FluxHttpPluginOptions,
  FluxHttpGlobalProperties,
  FluxHttpContext,
  UseQueryOptions,
  UseQueryReturn,
  UseInfiniteQueryOptions,
  UseInfiniteQueryReturn,
  CacheKeyGenerator,
  FluxHttpComponentProps,
  FluxHttpDirectiveBinding,
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

// Default export for plugin installation
export default FluxHttpPlugin;