/**
 * @fileoverview React Context Provider for FluxHTTP
 */

import React, { createContext, useContext, useEffect, useState } from 'react';
import fluxhttp from '../../src/index';
import type { fluxhttpInstance } from '../../src/types';
import type { 
  FluxHttpProviderProps, 
  FluxHttpContextValue, 
  FluxHttpProviderConfig 
} from './types';

/**
 * React Context for FluxHTTP
 */
const FluxHttpContext = createContext<FluxHttpContextValue | null>(null);

/**
 * Hook to access FluxHTTP context
 * @throws {Error} When used outside of FluxHttpProvider
 */
export function useFluxHttpContext(): FluxHttpContextValue {
  const context = useContext(FluxHttpContext);
  if (!context) {
    throw new Error('useFluxHttpContext must be used within a FluxHttpProvider');
  }
  return context;
}

/**
 * Enhanced cache implementation for React
 */
class ReactFluxHttpCache {
  private cache = new Map<string, { data: unknown; timestamp: number; ttl: number }>();
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
 * React Provider component for FluxHTTP
 * 
 * @example
 * ```tsx
 * function App() {
 *   return (
 *     <FluxHttpProvider
 *       defaultConfig={{
 *         baseURL: 'https://api.example.com',
 *         timeout: 10000,
 *         headers: {
 *           'Content-Type': 'application/json',
 *         },
 *       }}
 *       onError={(error) => {
 *         console.error('Global HTTP Error:', error);
 *         // Handle global errors (show toast, redirect to login, etc.)
 *       }}
 *       cache={{
 *         defaultCacheTime: 5 * 60 * 1000, // 5 minutes
 *         defaultStaleTime: 60 * 1000,     // 1 minute
 *         maxSize: 50,
 *       }}
 *       retry={{
 *         attempts: 3,
 *         delay: 1000,
 *       }}
 *     >
 *       <Router>
 *         <Routes>
 *           {/* Your app routes */}
 *         </Routes>
 *       </Router>
 *     </FluxHttpProvider>
 *   );
 * }
 * ```
 */
export function FluxHttpProvider({
  children,
  instance,
  defaultConfig = {},
  onError,
  onLoadingChange,
  cache: cacheConfig = {},
  retry: retryConfig = {},
}: FluxHttpProviderProps): JSX.Element {
  // Create or use provided FluxHTTP instance
  const [client] = useState<fluxhttpInstance>(() => {
    if (instance) return instance;
    return fluxhttp.create(defaultConfig);
  });

  // Global loading state management
  const [isLoading, setIsLoading] = useState(false);
  const [activeRequests, setActiveRequests] = useState(0);

  // Create cache instance
  const [cache] = useState(() => new ReactFluxHttpCache(
    cacheConfig.defaultCacheTime,
    cacheConfig.maxSize
  ));

  // Configuration object
  const [config] = useState<FluxHttpProviderConfig>(() => ({
    defaultConfig,
    onError,
    onLoadingChange,
    cache: cacheConfig,
    retry: retryConfig,
  }));

  // Setup request/response interceptors
  useEffect(() => {
    // Request interceptor to track loading state
    const requestInterceptor = client.interceptors.request.use(
      (config) => {
        setActiveRequests(prev => {
          const newCount = prev + 1;
          if (newCount === 1) {
            setIsLoading(true);
            onLoadingChange?.(true);
          }
          return newCount;
        });
        return config;
      },
      (error) => {
        setActiveRequests(prev => {
          const newCount = Math.max(0, prev - 1);
          if (newCount === 0) {
            setIsLoading(false);
            onLoadingChange?.(false);
          }
          return newCount;
        });
        return Promise.reject(error);
      }
    );

    // Response interceptor to track loading state and handle global errors
    const responseInterceptor = client.interceptors.response.use(
      (response) => {
        setActiveRequests(prev => {
          const newCount = Math.max(0, prev - 1);
          if (newCount === 0) {
            setIsLoading(false);
            onLoadingChange?.(false);
          }
          return newCount;
        });
        return response;
      },
      (error) => {
        setActiveRequests(prev => {
          const newCount = Math.max(0, prev - 1);
          if (newCount === 0) {
            setIsLoading(false);
            onLoadingChange?.(false);
          }
          return newCount;
        });

        // Call global error handler
        onError?.(error);

        return Promise.reject(error);
      }
    );

    // Cleanup interceptors on unmount
    return () => {
      client.interceptors.request.eject(requestInterceptor);
      client.interceptors.response.eject(responseInterceptor);
    };
  }, [client, onError, onLoadingChange]);

  // Cleanup expired cache entries periodically
  useEffect(() => {
    const interval = setInterval(() => {
      cache.cleanup();
    }, 60000); // Clean up every minute

    return () => clearInterval(interval);
  }, [cache]);

  // Context value
  const contextValue: FluxHttpContextValue = {
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

  return (
    <FluxHttpContext.Provider value={contextValue}>
      {children}
    </FluxHttpContext.Provider>
  );
}

/**
 * Higher-order component to inject FluxHTTP client
 * 
 * @example
 * ```tsx
 * const MyComponent = withFluxHttp(({ fluxhttp }) => {
 *   const handleClick = async () => {
 *     const response = await fluxhttp.get('/api/data');
 *     console.log(response.data);
 *   };
 * 
 *   return <button onClick={handleClick}>Fetch Data</button>;
 * });
 * ```
 */
export function withFluxHttp<P extends object>(
  Component: React.ComponentType<P & { fluxhttp: fluxhttpInstance }>
): React.ComponentType<P> {
  const WrappedComponent = (props: P) => {
    const { client } = useFluxHttpContext();
    return <Component {...props} fluxhttp={client} />;
  };

  WrappedComponent.displayName = `withFluxHttp(${Component.displayName || Component.name})`;
  return WrappedComponent;
}

/**
 * Hook to access the FluxHTTP client instance directly
 * 
 * @example
 * ```tsx
 * function MyComponent() {
 *   const client = useFluxHttpClient();
 * 
 *   const handleSubmit = async (data) => {
 *     try {
 *       const response = await client.post('/api/submit', data);
 *       console.log('Success:', response.data);
 *     } catch (error) {
 *       console.error('Error:', error);
 *     }
 *   };
 * 
 *   return (
 *     <form onSubmit={handleSubmit}>
 *       {/* form content */}
 *     </form>
 *   );
 * }
 * ```
 */
export function useFluxHttpClient(): fluxhttpInstance {
  const { client } = useFluxHttpContext();
  return client;
}

/**
 * Hook to access global loading state
 * 
 * @example
 * ```tsx
 * function LoadingIndicator() {
 *   const { isLoading, activeRequests } = useFluxHttpLoading();
 * 
 *   if (!isLoading) return null;
 * 
 *   return (
 *     <div className="loading-indicator">
 *       Loading... ({activeRequests} active requests)
 *     </div>
 *   );
 * }
 * ```
 */
export function useFluxHttpLoading() {
  const { isLoading, activeRequests } = useFluxHttpContext();
  return { isLoading, activeRequests };
}

/**
 * Hook to access cache utilities
 * 
 * @example
 * ```tsx
 * function CacheManager() {
 *   const cache = useFluxHttpCache();
 * 
 *   const clearUserData = () => {
 *     cache.remove('user-profile');
 *     cache.remove('user-settings');
 *   };
 * 
 *   const clearAllCache = () => {
 *     cache.clear();
 *   };
 * 
 *   return (
 *     <div>
 *       <button onClick={clearUserData}>Clear User Data</button>
 *       <button onClick={clearAllCache}>Clear All Cache</button>
 *     </div>
 *   );
 * }
 * ```
 */
export function useFluxHttpCache() {
  const { cache } = useFluxHttpContext();
  return cache;
}