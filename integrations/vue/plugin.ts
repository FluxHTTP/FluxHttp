/**
 * @fileoverview Vue 3 plugin for FluxHTTP integration
 */

import { inject, provide, ref, reactive, App, Plugin } from 'vue';
import fluxhttp from '../../src/index';
import type { fluxhttpInstance } from '../../src/types';
import type { 
  FluxHttpPluginOptions, 
  FluxHttpContext, 
  FluxHttpGlobalProperties 
} from './types';

/**
 * Default injection key for FluxHTTP
 */
export const FLUXHTTP_KEY = Symbol('fluxhttp');

/**
 * Enhanced cache implementation for Vue
 */
class VueFluxHttpCache {
  private cache = reactive(new Map<string, { data: unknown; timestamp: number; ttl: number }>());
  private defaultTTL: number;
  private maxSize: number;

  constructor(defaultTTL = 5 * 60 * 1000, maxSize = 100) {
    this.defaultTTL = defaultTTL;
    this.maxSize = maxSize;
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

  // Cleanup expired entries
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
 * Vue 3 plugin for FluxHTTP
 * 
 * @example
 * ```typescript
 * import { createApp } from 'vue';
 * import { FluxHttpPlugin } from '@fluxhttp/vue';
 * import App from './App.vue';
 * 
 * const app = createApp(App);
 * 
 * app.use(FluxHttpPlugin, {
 *   defaultConfig: {
 *     baseURL: 'https://api.example.com',
 *     timeout: 10000,
 *   },
 *   onError: (error) => {
 *     console.error('Global HTTP Error:', error);
 *     // Handle global errors
 *   },
 *   cache: {
 *     defaultCacheTime: 5 * 60 * 1000,
 *     maxSize: 50,
 *   },
 * });
 * 
 * app.mount('#app');
 * ```
 */
export const FluxHttpPlugin: Plugin = {
  install(app: App, options: FluxHttpPluginOptions = {}) {
    const {
      instance,
      defaultConfig = {},
      onError,
      onLoadingChange,
      cache: cacheConfig = {},
      retry: retryConfig = {},
      key = FLUXHTTP_KEY,
    } = options;

    // Create or use provided FluxHTTP instance
    const client = instance || fluxhttp.create(defaultConfig);

    // Global loading state
    const isLoading = ref(false);
    const activeRequests = ref(0);

    // Create cache instance
    const cache = new VueFluxHttpCache(
      cacheConfig.defaultCacheTime,
      cacheConfig.maxSize
    );

    // Configuration object
    const config: FluxHttpPluginOptions = {
      defaultConfig,
      onError,
      onLoadingChange,
      cache: cacheConfig,
      retry: retryConfig,
    };

    // Setup request/response interceptors
    const requestInterceptor = client.interceptors.request.use(
      (config) => {
        activeRequests.value++;
        if (activeRequests.value === 1) {
          isLoading.value = true;
          onLoadingChange?.(true);
        }
        return config;
      },
      (error) => {
        activeRequests.value = Math.max(0, activeRequests.value - 1);
        if (activeRequests.value === 0) {
          isLoading.value = false;
          onLoadingChange?.(false);
        }
        return Promise.reject(error);
      }
    );

    const responseInterceptor = client.interceptors.response.use(
      (response) => {
        activeRequests.value = Math.max(0, activeRequests.value - 1);
        if (activeRequests.value === 0) {
          isLoading.value = false;
          onLoadingChange?.(false);
        }
        return response;
      },
      (error) => {
        activeRequests.value = Math.max(0, activeRequests.value - 1);
        if (activeRequests.value === 0) {
          isLoading.value = false;
          onLoadingChange?.(false);
        }

        // Call global error handler
        onError?.(error);

        return Promise.reject(error);
      }
    );

    // Create context value
    const contextValue: FluxHttpContext = {
      client,
      config,
      isLoading,
      activeRequests,
      cache: {
        get: cache.get.bind(cache),
        set: cache.set.bind(cache),
        remove: cache.remove.bind(cache),
        clear: cache.clear.bind(cache),
      },
    };

    // Provide context
    app.provide(key, contextValue);

    // Add global properties
    const globalProperties: FluxHttpGlobalProperties = {
      $fluxhttp: client,
    };

    Object.assign(app.config.globalProperties, globalProperties);

    // Cleanup on app unmount
    app.mixin({
      beforeUnmount() {
        // Only cleanup when the root app is unmounted
        if (this.$root === this) {
          client.interceptors.request.eject(requestInterceptor);
          client.interceptors.response.eject(responseInterceptor);
        }
      },
    });

    // Periodic cache cleanup
    const cleanupInterval = setInterval(() => {
      cache.cleanup();
    }, 60000); // Clean up every minute

    // Clear interval when app is unmounted
    app.mixin({
      beforeUnmount() {
        if (this.$root === this) {
          clearInterval(cleanupInterval);
        }
      },
    });
  },
};

/**
 * Hook to access FluxHTTP context
 * @param key - Injection key (default: FLUXHTTP_KEY)
 * @throws {Error} When used outside of app with FluxHttpPlugin
 */
export function useFluxHttpContext(key: string | symbol = FLUXHTTP_KEY): FluxHttpContext {
  const context = inject<FluxHttpContext>(key);
  if (!context) {
    throw new Error('useFluxHttpContext must be used within an app that has FluxHttpPlugin installed');
  }
  return context;
}

/**
 * Hook to access the FluxHTTP client instance directly
 * 
 * @example
 * ```vue
 * <script setup lang="ts">
 * const client = useFluxHttpClient();
 * 
 * const handleSubmit = async (data) => {
 *   try {
 *     const response = await client.post('/api/submit', data);
 *     console.log('Success:', response.data);
 *   } catch (error) {
 *     console.error('Error:', error);
 *   }
 * };
 * </script>
 * ```
 */
export function useFluxHttpClient(key: string | symbol = FLUXHTTP_KEY): fluxhttpInstance {
  const { client } = useFluxHttpContext(key);
  return client;
}

/**
 * Hook to access global loading state
 * 
 * @example
 * ```vue
 * <script setup lang="ts">
 * const { isLoading, activeRequests } = useFluxHttpLoading();
 * </script>
 * 
 * <template>
 *   <div v-if="isLoading" class="loading-indicator">
 *     Loading... ({{ activeRequests }} active requests)
 *   </div>
 * </template>
 * ```
 */
export function useFluxHttpLoading(key: string | symbol = FLUXHTTP_KEY) {
  const { isLoading, activeRequests } = useFluxHttpContext(key);
  return { isLoading, activeRequests };
}

/**
 * Hook to access cache utilities
 * 
 * @example
 * ```vue
 * <script setup lang="ts">
 * const cache = useFluxHttpCache();
 * 
 * const clearUserData = () => {
 *   cache.remove('user-profile');
 *   cache.remove('user-settings');
 * };
 * 
 * const clearAllCache = () => {
 *   cache.clear();
 * };
 * </script>
 * ```
 */
export function useFluxHttpCache(key: string | symbol = FLUXHTTP_KEY) {
  const { cache } = useFluxHttpContext(key);
  return cache;
}

/**
 * Provide FluxHTTP context manually (useful for testing)
 * 
 * @example
 * ```typescript
 * import { provideFluxHttp } from '@fluxhttp/vue';
 * import { createApp } from 'vue';
 * 
 * const app = createApp(MyComponent);
 * 
 * provideFluxHttp(app, {
 *   defaultConfig: { baseURL: 'https://test-api.com' }
 * });
 * ```
 */
export function provideFluxHttp(
  app: App, 
  options: FluxHttpPluginOptions = {},
  key: string | symbol = FLUXHTTP_KEY
): void {
  app.use(FluxHttpPlugin, { ...options, key });
}

// Re-export for convenience
export { FLUXHTTP_KEY as defaultKey };
export default FluxHttpPlugin;