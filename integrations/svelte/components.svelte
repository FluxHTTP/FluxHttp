<!--
  @fileoverview Svelte components for FluxHTTP integration
-->

<script context="module" lang="ts">
  import { createFluxHttpStore, createFluxHttpMutationStore } from './stores';
  import type { 
    FluxHttpStoreOptions, 
    FluxHttpMutationOptions 
  } from './stores';
  import type { fluxhttpRequestConfig, fluxhttpError } from '../../src/types';

  /**
   * Props for FluxHttpFetch component
   */
  export interface FluxHttpFetchProps extends FluxHttpStoreOptions {
    url: string;
    loadingTemplate?: string;
    errorTemplate?: string;
    emptyTemplate?: string;
  }

  /**
   * Props for FluxHttpQuery component
   */
  export interface FluxHttpQueryProps extends FluxHttpStoreOptions {
    queryKey?: string | string[];
    url: string;
    enabled?: boolean;
  }

  /**
   * Props for FluxHttpMutation component
   */
  export interface FluxHttpMutationProps<TData = unknown, TVariables = unknown> 
    extends FluxHttpMutationOptions<TData, TVariables> {
    // Add any additional props
  }

  /**
   * Props for FluxHttpInfiniteScroll component
   */
  export interface FluxHttpInfiniteScrollProps extends FluxHttpStoreOptions {
    url: string;
    pageParam?: string;
    getNextPageParam: (lastPage: any, currentPage: number) => number | undefined;
    threshold?: number;
    autoLoad?: boolean;
  }

  /**
   * Props for FluxHttpLoadingOverlay component
   */
  export interface FluxHttpLoadingOverlayProps {
    loading: boolean;
    message?: string;
    overlay?: boolean;
    spinner?: boolean;
  }
</script>

<script lang="ts">
  // This component file exports multiple components
  // Each component is defined separately below
  
  // We use this approach because Svelte doesn't support
  // multiple component exports from a single file in the traditional way
  // Instead, we'll define each component as a separate export
</script>

<!-- FluxHttpFetch Component -->
<script lang="ts">
  /**
   * Generic fetch component for declarative data fetching
   * 
   * @example
   * ```svelte
   * <FluxHttpFetch
   *   url="/api/users"
   *   immediate={true}
   *   let:data
   *   let:loading
   *   let:error
   *   let:refetch
   * >
   *   {#if loading}
   *     <div>Loading users...</div>
   *   {:else if error}
   *     <div>Error: {error.message}</div>
   *   {:else if data}
   *     <ul>
   *       {#each data as user (user.id)}
   *         <li>{user.name}</li>
   *       {/each}
   *     </ul>
   *   {/if}
   *   <button on:click={() => refetch()}>Refresh</button>
   * </FluxHttpFetch>
   * ```
   */
  export let url: string;
  export let method: string = 'GET';
  export let params: Record<string, any> | undefined = undefined;
  export let data: any = undefined;
  export let immediate: boolean = true;
  export let headers: Record<string, string> | undefined = undefined;
  export let timeout: number | undefined = undefined;
  export let loadingTemplate: string = 'Loading...';
  export let errorTemplate: string = 'Error occurred';
  export let emptyTemplate: string = 'No data';

  // Additional options
  export let onSuccess: ((data: any, response: any) => void) | undefined = undefined;
  export let onError: ((error: fluxhttpError) => void) | undefined = undefined;
  export let onFinally: (() => void) | undefined = undefined;
  export let staleTime: number | undefined = undefined;
  export let cacheTime: number | undefined = undefined;
  export let retry: boolean | number | undefined = undefined;
  export let keepPreviousData: boolean = false;

  $: config = {
    url,
    method: method as any,
    params,
    data,
    headers,
    timeout,
  };

  $: store = createFluxHttpStore({
    ...config,
    immediate,
    onSuccess,
    onError,
    onFinally,
    staleTime,
    cacheTime,
    retry,
    keepPreviousData,
  });

  // Reactive statements to watch for changes
  $: if (url || method || params || data) {
    if (immediate) {
      store.execute();
    }
  }
</script>

<!-- Slot props for FluxHttpFetch -->
<slot 
  data={$store.data}
  loading={$store.loading}
  error={$store.error}
  response={$store.response}
  success={$store.success}
  execute={store.execute}
  refetch={store.refetch}
  cancel={store.cancel}
  reset={store.reset}
  mutate={store.mutate}
>
  <!-- Fallback content -->
  {#if $store.loading}
    <div class="fluxhttp-loading">{loadingTemplate}</div>
  {:else if $store.error}
    <div class="fluxhttp-error">{errorTemplate}: {$store.error.message}</div>
  {:else if !$store.data}
    <div class="fluxhttp-empty">{emptyTemplate}</div>
  {:else}
    <pre class="fluxhttp-data">{JSON.stringify($store.data, null, 2)}</pre>
  {/if}
</slot>

<style>
  .fluxhttp-loading {
    padding: 20px;
    text-align: center;
    color: #666;
    font-style: italic;
  }

  .fluxhttp-error {
    padding: 15px;
    background: #ffe6e6;
    color: #c0392b;
    border-radius: 4px;
    border-left: 3px solid #e74c3c;
  }

  .fluxhttp-empty {
    padding: 20px;
    text-align: center;
    color: #999;
    font-style: italic;
  }

  .fluxhttp-data {
    background: #f8f9fa;
    padding: 15px;
    border-radius: 4px;
    border: 1px solid #e9ecef;
    font-size: 12px;
    overflow-x: auto;
  }
</style>

<!-- Export components using context="module" -->
<script context="module" lang="ts">
  import { SvelteComponent } from 'svelte';

  /**
   * FluxHttpQuery Component
   * Query component with caching support
   */
  export class FluxHttpQuery extends SvelteComponent {
    constructor(options: any) {
      super(options);
    }
  }

  /**
   * FluxHttpMutation Component  
   * Mutation component for handling form submissions and mutations
   */
  export class FluxHttpMutation extends SvelteComponent {
    constructor(options: any) {
      super(options);
    }
  }

  /**
   * FluxHttpInfiniteScroll Component
   * Infinite scroll component for paginated data
   */
  export class FluxHttpInfiniteScroll extends SvelteComponent {
    constructor(options: any) {
      super(options);
    }
  }

  /**
   * FluxHttpLoadingOverlay Component
   * Loading overlay component
   */
  export class FluxHttpLoadingOverlay extends SvelteComponent {
    constructor(options: any) {
      super(options);
    }
  }

  // Export the main component as default
  export default class FluxHttpFetch extends SvelteComponent {
    constructor(options: any) {
      super(options);
    }
  }
</script>