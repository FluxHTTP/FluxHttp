/**
 * @fileoverview Svelte actions for FluxHTTP integration
 */

import type { ActionReturn } from 'svelte/action';
import { createFluxHttpStore, getFluxHttpClient } from './stores';
import type { fluxhttpRequestConfig, fluxhttpError } from '../../src/types';

/**
 * Parameters for the fluxhttp action
 */
export interface FluxHttpActionParams {
  /** Request configuration */
  config?: fluxhttpRequestConfig;
  /** Success callback */
  onSuccess?: (data: any, element: HTMLElement) => void;
  /** Error callback */
  onError?: (error: fluxhttpError, element: HTMLElement) => void;
  /** Loading callback */
  onLoading?: (loading: boolean, element: HTMLElement) => void;
  /** Auto-execute on mount */
  immediate?: boolean;
  /** Event to trigger request */
  trigger?: string | string[];
  /** Loading template */
  loadingTemplate?: string;
  /** Error template */
  errorTemplate?: string;
  /** Success template */
  successTemplate?: string;
  /** Whether to show loading state */
  showLoading?: boolean;
  /** Whether to show error state */
  showError?: boolean;
  /** CSS classes for different states */
  classes?: {
    loading?: string;
    error?: string;
    success?: string;
  };
}

/**
 * Svelte action for handling HTTP requests declaratively
 * 
 * @example
 * ```svelte
 * <script>
 *   import { fluxhttp } from '@fluxhttp/svelte';
 * 
 *   let userElement;
 * 
 *   function handleUserSuccess(data, element) {
 *     console.log('User loaded:', data);
 *     element.innerHTML = `<h1>Hello, ${data.name}!</h1>`;
 *   }
 * 
 *   function handleUserError(error, element) {
 *     console.error('Error loading user:', error);
 *     element.innerHTML = `<div class="error">Error: ${error.message}</div>`;
 *   }
 * </script>
 * 
 * <div
 *   bind:this={userElement}
 *   use:fluxhttp={{
 *     config: { url: '/api/user' },
 *     immediate: true,
 *     onSuccess: handleUserSuccess,
 *     onError: handleUserError,
 *     loadingTemplate: '<div>Loading user...</div>',
 *     classes: {
 *       loading: 'loading-state',
 *       error: 'error-state',
 *       success: 'success-state'
 *     }
 *   }}
 * ></div>
 * ```
 */
export function fluxhttp(
  element: HTMLElement,
  params: FluxHttpActionParams = {}
): ActionReturn<FluxHttpActionParams> {
  const {
    config = {},
    onSuccess,
    onError,
    onLoading,
    immediate = false,
    trigger = [],
    loadingTemplate = 'Loading...',
    errorTemplate = 'Error occurred',
    successTemplate = '',
    showLoading = true,
    showError = true,
    classes = {},
  } = params;

  let store = createFluxHttpStore({
    ...config,
    immediate,
    onSuccess: (data, response) => {
      if (onSuccess) {
        onSuccess(data, element);
      } else if (successTemplate) {
        element.innerHTML = successTemplate;
      }
      
      if (classes.success) {
        element.classList.add(classes.success);
      }
      if (classes.loading) {
        element.classList.remove(classes.loading);
      }
      if (classes.error) {
        element.classList.remove(classes.error);
      }
    },
    onError: (error) => {
      if (onError) {
        onError(error, element);
      } else if (showError) {
        element.innerHTML = errorTemplate;
      }
      
      if (classes.error) {
        element.classList.add(classes.error);
      }
      if (classes.loading) {
        element.classList.remove(classes.loading);
      }
      if (classes.success) {
        element.classList.remove(classes.success);
      }
    }
  });

  let unsubscribe: (() => void) | null = null;

  // Setup loading state handling
  if (showLoading || onLoading || classes.loading) {
    unsubscribe = store.loading.subscribe(loading => {
      if (onLoading) {
        onLoading(loading, element);
      } else if (showLoading && loading) {
        element.innerHTML = loadingTemplate;
      }
      
      if (classes.loading) {
        if (loading) {
          element.classList.add(classes.loading);
        } else {
          element.classList.remove(classes.loading);
        }
      }
    });
  }

  // Setup event listeners for triggers
  const eventListeners: Array<[string, EventListener]> = [];
  const triggerEvents = Array.isArray(trigger) ? trigger : [trigger].filter(Boolean);
  
  for (const event of triggerEvents) {
    const listener = (e: Event) => {
      e.preventDefault();
      store.execute();
    };
    element.addEventListener(event, listener);
    eventListeners.push([event, listener]);
  }

  return {
    update(newParams: FluxHttpActionParams) {
      // Clean up old store
      unsubscribe?.();
      
      // Remove old event listeners
      for (const [event, listener] of eventListeners) {
        element.removeEventListener(event, listener);
      }
      eventListeners.length = 0;

      // Create new store with updated params
      const updatedParams = { ...params, ...newParams };
      
      store = createFluxHttpStore({
        ...updatedParams.config,
        immediate: false, // Don't auto-execute on update
        onSuccess: (data, response) => {
          if (updatedParams.onSuccess) {
            updatedParams.onSuccess(data, element);
          } else if (updatedParams.successTemplate) {
            element.innerHTML = updatedParams.successTemplate;
          }
        },
        onError: (error) => {
          if (updatedParams.onError) {
            updatedParams.onError(error, element);
          } else if (updatedParams.showError) {
            element.innerHTML = updatedParams.errorTemplate || errorTemplate;
          }
        }
      });

      // Setup new loading state handling
      if (updatedParams.showLoading || updatedParams.onLoading) {
        unsubscribe = store.loading.subscribe(loading => {
          if (updatedParams.onLoading) {
            updatedParams.onLoading(loading, element);
          } else if (updatedParams.showLoading && loading) {
            element.innerHTML = updatedParams.loadingTemplate || loadingTemplate;
          }
        });
      }

      // Setup new event listeners
      const newTriggerEvents = Array.isArray(updatedParams.trigger) 
        ? updatedParams.trigger 
        : [updatedParams.trigger].filter(Boolean);
      
      for (const event of newTriggerEvents) {
        const listener = (e: Event) => {
          e.preventDefault();
          store.execute();
        };
        element.addEventListener(event, listener);
        eventListeners.push([event, listener]);
      }
    },

    destroy() {
      unsubscribe?.();
      
      // Remove event listeners
      for (const [event, listener] of eventListeners) {
        element.removeEventListener(event, listener);
      }
      
      // Cancel any ongoing requests
      store.cancel();
    }
  };
}

/**
 * Parameters for the fetch action
 */
export interface FetchActionParams {
  /** URL to fetch */
  url: string;
  /** HTTP method */
  method?: string;
  /** Request data */
  data?: any;
  /** Request parameters */
  params?: Record<string, any>;
  /** Success callback */
  onSuccess?: (data: any, element: HTMLElement) => void;
  /** Error callback */
  onError?: (error: fluxhttpError, element: HTMLElement) => void;
  /** Auto-execute on mount */
  immediate?: boolean;
  /** Event to trigger request */
  trigger?: string | string[];
}

/**
 * Simplified fetch action for basic HTTP requests
 * 
 * @example
 * ```svelte
 * <div
 *   use:fetch={{
 *     url: '/api/data',
 *     immediate: true,
 *     onSuccess: (data, element) => {
 *       element.innerHTML = `<pre>${JSON.stringify(data, null, 2)}</pre>`;
 *     }
 *   }}
 * ></div>
 * ```
 */
export function fetch(
  element: HTMLElement,
  params: FetchActionParams
): ActionReturn<FetchActionParams> {
  const { url, method = 'GET', data, params: queryParams, ...rest } = params;
  
  return fluxhttp(element, {
    config: {
      url,
      method: method as any,
      data,
      params: queryParams,
    },
    ...rest,
  });
}

/**
 * Parameters for the submit action
 */
export interface SubmitActionParams {
  /** URL to submit to */
  url: string;
  /** HTTP method */
  method?: string;
  /** Success callback */
  onSuccess?: (data: any, element: HTMLElement) => void;
  /** Error callback */
  onError?: (error: fluxhttpError, element: HTMLElement) => void;
  /** Form data transformer */
  transform?: (formData: FormData) => any;
  /** Whether to prevent default form submission */
  preventDefault?: boolean;
}

/**
 * Form submission action
 * 
 * @example
 * ```svelte
 * <form
 *   use:submit={{
 *     url: '/api/users',
 *     method: 'POST',
 *     onSuccess: (data) => {
 *       alert(`User ${data.name} created successfully!`);
 *     },
 *     onError: (error) => {
 *       alert(`Error: ${error.message}`);
 *     }
 *   }}
 * >
 *   <input name="name" placeholder="Name" required />
 *   <input name="email" type="email" placeholder="Email" required />
 *   <button type="submit">Create User</button>
 * </form>
 * ```
 */
export function submit(
  element: HTMLFormElement,
  params: SubmitActionParams
): ActionReturn<SubmitActionParams> {
  const {
    url,
    method = 'POST',
    onSuccess,
    onError,
    transform,
    preventDefault = true,
  } = params;

  const client = getFluxHttpClient();

  const handleSubmit = async (event: SubmitEvent) => {
    if (preventDefault) {
      event.preventDefault();
    }

    try {
      const formData = new FormData(element);
      const data = transform ? transform(formData) : Object.fromEntries(formData.entries());

      const response = await client.request({
        url,
        method: method as any,
        data,
      });

      onSuccess?.(response.data, element);
    } catch (error) {
      onError?.(error as fluxhttpError, element);
    }
  };

  element.addEventListener('submit', handleSubmit);

  return {
    update(newParams: SubmitActionParams) {
      // Remove old listener
      element.removeEventListener('submit', handleSubmit);
      
      // Setup with new params
      const result = submit(element, newParams);
      return result;
    },

    destroy() {
      element.removeEventListener('submit', handleSubmit);
    }
  };
}

/**
 * Parameters for the infinite scroll action
 */
export interface InfiniteScrollActionParams {
  /** URL pattern (can include {page} placeholder) */
  url: string;
  /** Function to get next page parameter */
  getNextPageParam?: (lastPage: any, currentPage: number) => number | undefined;
  /** Threshold for triggering load (in pixels from bottom) */
  threshold?: number;
  /** Success callback for each page */
  onPageLoad?: (data: any, page: number, element: HTMLElement) => void;
  /** Error callback */
  onError?: (error: fluxhttpError, element: HTMLElement) => void;
  /** Whether to auto-start loading */
  immediate?: boolean;
}

/**
 * Infinite scroll action
 * 
 * @example
 * ```svelte
 * <div
 *   use:infiniteScroll={{
 *     url: '/api/posts?page={page}',
 *     threshold: 200,
 *     onPageLoad: (data, page, element) => {
 *       const posts = data.posts || [];
 *       posts.forEach(post => {
 *         const div = document.createElement('div');
 *         div.innerHTML = `<h3>${post.title}</h3><p>${post.body}</p>`;
 *         element.appendChild(div);
 *       });
 *     }
 *   }}
 * ></div>
 * ```
 */
export function infiniteScroll(
  element: HTMLElement,
  params: InfiniteScrollActionParams
): ActionReturn<InfiniteScrollActionParams> {
  const {
    url,
    getNextPageParam = (lastPage, currentPage) => lastPage.hasMore ? currentPage + 1 : undefined,
    threshold = 100,
    onPageLoad,
    onError,
    immediate = true,
  } = params;

  const client = getFluxHttpClient();
  let currentPage = 1;
  let loading = false;
  let hasMore = true;
  let observer: IntersectionObserver | null = null;
  let sentinel: HTMLElement | null = null;

  const loadPage = async (page: number) => {
    if (loading || !hasMore) return;

    loading = true;
    
    try {
      const pageUrl = url.replace('{page}', page.toString());
      const response = await client.request({ url: pageUrl });
      
      onPageLoad?.(response.data, page, element);
      
      // Check if there are more pages
      const nextPage = getNextPageParam(response.data, page);
      hasMore = nextPage !== undefined;
      currentPage = nextPage || page;
    } catch (error) {
      onError?.(error as fluxhttpError, element);
    } finally {
      loading = false;
    }
  };

  const createSentinel = () => {
    sentinel = document.createElement('div');
    sentinel.style.height = '1px';
    sentinel.style.visibility = 'hidden';
    element.appendChild(sentinel);

    observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading) {
          loadPage(currentPage);
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(sentinel);
  };

  // Initial setup
  if (immediate) {
    loadPage(1).then(() => {
      if (hasMore) {
        createSentinel();
      }
    });
  } else {
    createSentinel();
  }

  return {
    update(newParams: InfiniteScrollActionParams) {
      // Clean up old observer
      if (observer) {
        observer.disconnect();
        observer = null;
      }
      if (sentinel) {
        element.removeChild(sentinel);
        sentinel = null;
      }

      // Reset state
      currentPage = 1;
      loading = false;
      hasMore = true;

      // Setup with new params
      const result = infiniteScroll(element, newParams);
      return result;
    },

    destroy() {
      if (observer) {
        observer.disconnect();
      }
      if (sentinel && element.contains(sentinel)) {
        element.removeChild(sentinel);
      }
    }
  };
}