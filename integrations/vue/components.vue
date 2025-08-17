<!--
  @fileoverview Vue 3 components for FluxHTTP
-->

<template>
  <!-- This file exports multiple components via script setup -->
  <div>
    <!-- Components are exported via script, not template -->
  </div>
</template>

<script setup lang="ts">
/**
 * Vue 3 components for FluxHTTP integration
 * 
 * This file provides ready-to-use components for common HTTP patterns:
 * - FluxHttpFetch: Generic fetch component
 * - FluxHttpQuery: Query component with caching
 * - FluxHttpMutation: Mutation component for forms
 * - FluxHttpInfiniteScroll: Infinite scrolling component
 * - FluxHttpLoadingOverlay: Loading state overlay
 */

import { 
  defineComponent, 
  h, 
  ref, 
  computed, 
  watch, 
  onMounted, 
  onBeforeUnmount,
  Fragment
} from 'vue';
import { useFluxHttp, useFluxHttpMutation, useInfiniteQuery } from './useFluxHttp';
import type { 
  fluxhttpRequestConfig, 
  fluxhttpError 
} from '../../src/types';

/**
 * Generic fetch component for declarative data fetching
 * 
 * @example
 * ```vue
 * <FluxHttpFetch
 *   url="/api/users"
 *   :immediate="true"
 *   v-slot="{ data, loading, error, refetch }"
 * >
 *   <div v-if="loading">Loading users...</div>
 *   <div v-else-if="error">Error: {{ error.message }}</div>
 *   <ul v-else-if="data">
 *     <li v-for="user in data" :key="user.id">{{ user.name }}</li>
 *   </ul>
 *   <button @click="refetch">Refresh</button>
 * </FluxHttpFetch>
 * ```
 */
export const FluxHttpFetch = defineComponent({
  name: 'FluxHttpFetch',
  props: {
    url: String,
    method: {
      type: String,
      default: 'GET'
    },
    params: Object,
    data: null,
    immediate: {
      type: Boolean,
      default: true
    },
    headers: Object,
    timeout: Number,
    loadingTemplate: String,
    errorTemplate: String,
    emptyTemplate: String,
  },
  setup(props, { slots }) {
    const config = computed((): fluxhttpRequestConfig => ({
      url: props.url,
      method: props.method as any,
      params: props.params,
      data: props.data,
      headers: props.headers,
      timeout: props.timeout,
    }));

    const state = useFluxHttp({
      ...config.value,
      immediate: props.immediate,
    });

    // Watch for prop changes
    watch(
      () => [props.url, props.method, props.params, props.data],
      () => {
        if (props.immediate && props.url) {
          state.execute();
        }
      },
      { deep: true }
    );

    return () => {
      const slotProps = {
        data: state.data.value,
        loading: state.loading.value,
        error: state.error.value,
        response: state.response.value,
        success: state.success.value,
        execute: state.execute,
        refetch: state.refetch,
        cancel: state.cancel,
        reset: state.reset,
        mutate: state.mutate,
      };

      // Use default slot if provided
      if (slots.default) {
        return slots.default(slotProps);
      }

      // Fallback rendering
      if (state.loading.value) {
        return h('div', { class: 'fluxhttp-loading' }, props.loadingTemplate || 'Loading...');
      }

      if (state.error.value) {
        return h('div', { class: 'fluxhttp-error' }, 
          props.errorTemplate || `Error: ${state.error.value.message}`
        );
      }

      if (!state.data.value) {
        return h('div', { class: 'fluxhttp-empty' }, props.emptyTemplate || 'No data');
      }

      return h('pre', JSON.stringify(state.data.value, null, 2));
    };
  },
});

/**
 * Query component with caching support
 * 
 * @example
 * ```vue
 * <FluxHttpQuery
 *   :query-key="['user', userId]"
 *   :url="`/api/users/${userId}`"
 *   :stale-time="5 * 60 * 1000"
 *   :cache-time="10 * 60 * 1000"
 *   :refetch-on-window-focus="true"
 *   v-slot="{ data, loading, error, refetch }"
 * >
 *   <UserProfile 
 *     :user="data" 
 *     :loading="loading" 
 *     :error="error"
 *     @refresh="refetch"
 *   />
 * </FluxHttpQuery>
 * ```
 */
export const FluxHttpQuery = defineComponent({
  name: 'FluxHttpQuery',
  props: {
    queryKey: [String, Array],
    url: String,
    method: {
      type: String,
      default: 'GET'
    },
    params: Object,
    data: null,
    immediate: {
      type: Boolean,
      default: true
    },
    enabled: {
      type: Boolean,
      default: true
    },
    staleTime: Number,
    cacheTime: Number,
    refetchOnWindowFocus: Boolean,
    refetchOnReconnect: Boolean,
    keepPreviousData: Boolean,
  },
  setup(props, { slots }) {
    const config = computed((): fluxhttpRequestConfig => ({
      url: props.url,
      method: props.method as any,
      params: props.params,
      data: props.data,
    }));

    const state = useFluxHttp({
      ...config.value,
      immediate: props.immediate && props.enabled,
      staleTime: props.staleTime,
      cacheTime: props.cacheTime,
      refetchOnWindowFocus: props.refetchOnWindowFocus,
      refetchOnReconnect: props.refetchOnReconnect,
      keepPreviousData: props.keepPreviousData,
    });

    // Watch enabled state
    watch(() => props.enabled, (enabled) => {
      if (enabled && !state.data.value && !state.loading.value) {
        state.execute();
      }
    });

    return () => {
      const slotProps = {
        data: state.data.value,
        loading: state.loading.value,
        error: state.error.value,
        response: state.response.value,
        success: state.success.value,
        execute: state.execute,
        refetch: state.refetch,
        cancel: state.cancel,
        reset: state.reset,
        mutate: state.mutate,
        isFresh: state.isFresh.value,
        isStale: state.isStale.value,
      };

      return slots.default?.(slotProps) || null;
    };
  },
});

/**
 * Mutation component for handling form submissions and mutations
 * 
 * @example
 * ```vue
 * <FluxHttpMutation
 *   @success="onUserCreated"
 *   @error="onError"
 *   v-slot="{ mutate, loading, error }"
 * >
 *   <UserForm
 *     @submit="(userData) => mutate(userData, { url: '/api/users', method: 'POST' })"
 *     :loading="loading"
 *     :error="error"
 *   />
 * </FluxHttpMutation>
 * ```
 */
export const FluxHttpMutation = defineComponent({
  name: 'FluxHttpMutation',
  emits: ['success', 'error', 'settled', 'mutate'],
  setup(props, { slots, emit }) {
    const state = useFluxHttpMutation({
      onSuccess: (data, variables, response) => {
        emit('success', data, variables, response);
      },
      onError: (error, variables) => {
        emit('error', error, variables);
      },
      onSettled: (data, error, variables) => {
        emit('settled', data, error, variables);
      },
      onMutate: (variables) => {
        emit('mutate', variables);
      },
    });

    return () => {
      const slotProps = {
        data: state.data.value,
        loading: state.loading.value,
        error: state.error.value,
        response: state.response.value,
        success: state.success.value,
        variables: state.variables.value,
        mutate: state.mutate,
        mutateAsync: state.mutateAsync,
        reset: state.reset,
      };

      return slots.default?.(slotProps) || null;
    };
  },
});

/**
 * Infinite scroll component for paginated data
 * 
 * @example
 * ```vue
 * <FluxHttpInfiniteScroll
 *   url="/api/posts"
 *   page-param="page"
 *   :get-next-page-param="(data, page) => data.hasMore ? page + 1 : undefined"
 *   v-slot="{ data, loading, hasNextPage, fetchNextPage }"
 * >
 *   <PostCard v-for="post in data" :key="post.id" :post="post" />
 *   <button 
 *     v-if="hasNextPage" 
 *     @click="fetchNextPage"
 *     :disabled="loading"
 *   >
 *     Load More
 *   </button>
 * </FluxHttpInfiniteScroll>
 * ```
 */
export const FluxHttpInfiniteScroll = defineComponent({
  name: 'FluxHttpInfiniteScroll',
  props: {
    url: {
      type: String,
      required: true
    },
    pageParam: {
      type: String,
      default: 'page'
    },
    getNextPageParam: {
      type: Function,
      required: true
    },
    getPreviousPageParam: Function,
    initialPageParam: {
      default: 1
    },
    maxPages: {
      type: Number,
      default: Infinity
    },
    threshold: {
      type: Number,
      default: 100
    },
    autoLoad: {
      type: Boolean,
      default: true
    },
    immediate: {
      type: Boolean,
      default: true
    },
  },
  setup(props, { slots }) {
    const state = useInfiniteQuery({
      url: props.url,
      getNextPageParam: props.getNextPageParam,
      getPreviousPageParam: props.getPreviousPageParam,
      initialPageParam: props.initialPageParam,
      maxPages: props.maxPages,
      immediate: props.immediate,
    });

    const sentinel = ref<HTMLElement>();
    const observer = ref<IntersectionObserver>();

    onMounted(() => {
      if (props.autoLoad && sentinel.value) {
        observer.value = new IntersectionObserver(
          (entries) => {
            if (entries[0].isIntersecting && state.hasNextPage.value && !state.isFetchingNextPage.value) {
              state.fetchNextPage();
            }
          },
          { threshold: 0.1 }
        );
        observer.value.observe(sentinel.value);
      }
    });

    onBeforeUnmount(() => {
      if (observer.value) {
        observer.value.disconnect();
      }
    });

    return () => {
      const slotProps = {
        data: state.data.value,
        loading: state.loading.value,
        error: state.error.value,
        success: state.success.value,
        hasNextPage: state.hasNextPage.value,
        hasPreviousPage: state.hasPreviousPage.value,
        isFetchingNextPage: state.isFetchingNextPage.value,
        isFetchingPreviousPage: state.isFetchingPreviousPage.value,
        fetchNextPage: state.fetchNextPage,
        fetchPreviousPage: state.fetchPreviousPage,
        refetch: state.refetch,
        reset: state.reset,
      };

      const children = [
        slots.default?.(slotProps),
      ];

      // Add sentinel for auto-loading
      if (props.autoLoad && state.hasNextPage.value) {
        children.push(
          h('div', {
            ref: sentinel,
            style: { height: '1px' }
          })
        );
      }

      return h(Fragment, children);
    };
  },
});

/**
 * Loading overlay component
 * 
 * @example
 * ```vue
 * <FluxHttpLoadingOverlay 
 *   :loading="isLoading" 
 *   message="Saving changes..."
 *   :overlay="true"
 * >
 *   <UserForm @submit="handleSubmit" />
 * </FluxHttpLoadingOverlay>
 * ```
 */
export const FluxHttpLoadingOverlay = defineComponent({
  name: 'FluxHttpLoadingOverlay',
  props: {
    loading: {
      type: Boolean,
      default: false
    },
    message: {
      type: String,
      default: 'Loading...'
    },
    overlay: {
      type: Boolean,
      default: true
    },
    spinner: {
      type: Boolean,
      default: true
    },
  },
  setup(props, { slots }) {
    const defaultSpinner = () => h('div', {
      class: 'fluxhttp-spinner',
      style: {
        width: '24px',
        height: '24px',
        border: '2px solid #f3f3f3',
        borderTop: '2px solid #3498db',
        borderRadius: '50%',
        animation: 'fluxhttp-spin 1s linear infinite',
      }
    });

    return () => {
      const children = [slots.default?.()];

      if (props.loading) {
        const loadingContent = [
          props.spinner && (slots.spinner?.() || defaultSpinner()),
          props.message && h('div', { class: 'fluxhttp-loading-message' }, props.message),
        ].filter(Boolean);

        children.push(
          h('div', {
            class: 'fluxhttp-loading-overlay',
            style: {
              position: props.overlay ? 'absolute' : 'static',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: props.overlay ? 'rgba(255, 255, 255, 0.8)' : 'transparent',
              zIndex: 1000,
              gap: '12px',
            }
          }, loadingContent)
        );
      }

      return h('div', {
        class: 'fluxhttp-loading-container',
        style: { position: 'relative' }
      }, children);
    };
  },
});

// CSS for animations
const style = document.createElement('style');
style.textContent = `
  @keyframes fluxhttp-spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;
document.head.appendChild(style);
</script>

<style scoped>
.fluxhttp-loading {
  padding: 20px;
  text-align: center;
  color: #666;
}

.fluxhttp-error {
  padding: 20px;
  text-align: center;
  color: #e74c3c;
  background-color: #fdf2f2;
  border: 1px solid #f1c1c1;
  border-radius: 4px;
}

.fluxhttp-empty {
  padding: 20px;
  text-align: center;
  color: #999;
  font-style: italic;
}

.fluxhttp-loading-container {
  position: relative;
}

.fluxhttp-loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background-color: rgba(255, 255, 255, 0.8);
  z-index: 1000;
}

.fluxhttp-spinner {
  width: 24px;
  height: 24px;
  border: 2px solid #f3f3f3;
  border-top: 2px solid #3498db;
  border-radius: 50%;
  animation: fluxhttp-spin 1s linear infinite;
}

.fluxhttp-loading-message {
  margin-top: 12px;
  color: #666;
  font-size: 14px;
}

@keyframes fluxhttp-spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
</style>