/**
 * @fileoverview Svelte integration index - exports all Svelte-specific FluxHTTP stores and actions
 */

// Core stores and configuration
export {
  configureFluxHttp,
  createFluxHttpStore,
  createFluxHttpMutationStore,
  getFluxHttpClient,
  isLoading,
  activeRequests,
} from './stores';

// Actions
export {
  fluxhttp,
  fetch,
  submit,
  infiniteScroll,
} from './actions';

// Components (import from components.svelte)
export { default as FluxHttpFetch } from './components.svelte';
export { default as FluxHttpQuery } from './components.svelte';
export { default as FluxHttpMutation } from './components.svelte';
export { default as FluxHttpInfiniteScroll } from './components.svelte';
export { default as FluxHttpLoadingOverlay } from './components.svelte';

// Types
export type {
  FluxHttpStoreConfig,
  FluxHttpState,
  FluxHttpStoreOptions,
  FluxHttpStore,
  FluxHttpMutationOptions,
  FluxHttpMutationState,
  FluxHttpMutationStore,
} from './stores';

export type {
  FluxHttpActionParams,
  FetchActionParams,
  SubmitActionParams,
  InfiniteScrollActionParams,
} from './actions';

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