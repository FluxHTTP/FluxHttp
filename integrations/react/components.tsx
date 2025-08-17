/**
 * @fileoverview Ready-to-use React components for FluxHTTP
 */

import React, { Suspense, useCallback, useEffect, useRef } from 'react';
import { useFluxHttp, useFluxHttpMutation } from './useFluxHttp';
import type {
  FetchComponentProps,
  QueryProps,
  MutationProps,
  SuspenseFetchProps,
  ErrorBoundaryFallback,
} from './types';

/**
 * Generic fetch component for declarative data fetching
 * 
 * @example
 * ```tsx
 * <Fetch
 *   url="/api/users"
 *   immediate={true}
 *   fallback={<div>Loading users...</div>}
 *   errorFallback={(error) => <div>Error: {error.message}</div>}
 * >
 *   {({ data, loading, error, refetch }) => {
 *     if (loading) return <div>Loading...</div>;
 *     if (error) return <div>Error: {error.message}</div>;
 *     if (!data) return <div>No data</div>;
 *     
 *     return (
 *       <div>
 *         <ul>
 *           {data.map(user => (
 *             <li key={user.id}>{user.name}</li>
 *           ))}
 *         </ul>
 *         <button onClick={() => refetch()}>Refresh</button>
 *       </div>
 *     );
 *   }}
 * </Fetch>
 * ```
 */
export function Fetch<T = unknown>({
  children,
  fallback,
  errorFallback,
  ...options
}: FetchComponentProps<T>): JSX.Element {
  const state = useFluxHttp<T>(options);

  // Handle loading state
  if (state.loading && fallback) {
    return <>{fallback}</>;
  }

  // Handle error state
  if (state.error && errorFallback) {
    return (
      <>
        {typeof errorFallback === 'function' 
          ? errorFallback(state.error) 
          : errorFallback
        }
      </>
    );
  }

  return <>{children(state)}</>;
}

/**
 * Query component with caching support
 * 
 * @example
 * ```tsx
 * <Query
 *   queryKey={['user', userId]}
 *   url={`/api/users/${userId}`}
 *   immediate={true}
 *   staleTime={5 * 60 * 1000} // 5 minutes
 *   cacheTime={10 * 60 * 1000} // 10 minutes
 *   refetchOnWindowFocus={true}
 * >
 *   {({ data, loading, error, refetch }) => (
 *     <UserProfile 
 *       user={data} 
 *       loading={loading} 
 *       error={error}
 *       onRefresh={refetch}
 *     />
 *   )}
 * </Query>
 * ```
 */
export function Query<T = unknown>({
  queryKey,
  children,
  fallback,
  errorFallback,
  ...options
}: QueryProps<T>): JSX.Element {
  // Generate a stable cache key if provided
  const cacheKey = queryKey ? 
    (Array.isArray(queryKey) ? queryKey.join(':') : queryKey) : 
    undefined;

  const state = useFluxHttp<T>({
    ...options,
    // Use cache key for deduplication if provided
    ...(cacheKey && { dedupingInterval: 5000 }),
  });

  // Handle loading state
  if (state.loading && fallback) {
    return <>{fallback}</>;
  }

  // Handle error state
  if (state.error && errorFallback) {
    return (
      <>
        {typeof errorFallback === 'function' 
          ? errorFallback(state.error) 
          : errorFallback
        }
      </>
    );
  }

  return <>{children(state)}</>;
}

/**
 * Mutation component for handling form submissions and mutations
 * 
 * @example
 * ```tsx
 * <Mutation<User, CreateUserRequest>
 *   onSuccess={(data) => {
 *     toast.success(`User ${data.name} created successfully!`);
 *     navigate(`/users/${data.id}`);
 *   }}
 *   onError={(error) => {
 *     toast.error(`Failed to create user: ${error.message}`);
 *   }}
 * >
 *   {({ mutate, loading, error }) => (
 *     <UserForm
 *       onSubmit={(userData) => {
 *         mutate(userData, {
 *           url: '/api/users',
 *           method: 'POST',
 *         });
 *       }}
 *       loading={loading}
 *       error={error}
 *     />
 *   )}
 * </Mutation>
 * ```
 */
export function Mutation<TData = unknown, TVariables = unknown>({
  children,
  ...options
}: MutationProps<TData, TVariables>): JSX.Element {
  const state = useFluxHttpMutation<TData, TVariables>(options);
  return <>{children(state)}</>;
}

/**
 * Suspense-compatible fetch component
 * 
 * @example
 * ```tsx
 * <Suspense fallback={<div>Loading...</div>}>
 *   <SuspenseFetch url="/api/data">
 *     {(data, refetch) => (
 *       <div>
 *         <pre>{JSON.stringify(data, null, 2)}</pre>
 *         <button onClick={() => refetch()}>Refresh</button>
 *       </div>
 *     )}
 *   </SuspenseFetch>
 * </Suspense>
 * ```
 */
export function SuspenseFetch<T = unknown>({
  url,
  children,
  ...options
}: SuspenseFetchProps<T>): JSX.Element {
  const promiseRef = useRef<Promise<T> | null>(null);
  const dataRef = useRef<T | null>(null);
  const errorRef = useRef<Error | null>(null);

  const { execute } = useFluxHttp<T>({
    ...options,
    url,
    immediate: false,
  });

  const refetch = useCallback(async () => {
    dataRef.current = null;
    errorRef.current = null;
    
    const promise = execute().then(
      (response) => {
        dataRef.current = response.data;
        return response.data;
      },
      (error) => {
        errorRef.current = error;
        throw error;
      }
    );
    
    promiseRef.current = promise;
    return promise;
  }, [execute]);

  // Initialize data fetching
  if (!promiseRef.current && !dataRef.current && !errorRef.current) {
    promiseRef.current = refetch();
  }

  // Throw error if present
  if (errorRef.current) {
    throw errorRef.current;
  }

  // Throw promise for Suspense if data is not ready
  if (!dataRef.current && promiseRef.current) {
    throw promiseRef.current;
  }

  // Render with data
  return <>{children(dataRef.current!, refetch)}</>;
}

/**
 * Error boundary component for handling FluxHTTP errors
 * 
 * @example
 * ```tsx
 * <FluxHttpErrorBoundary
 *   fallback={({ error, retry, reset }) => (
 *     <div className="error-container">
 *       <h2>Something went wrong!</h2>
 *       <p>{error.message}</p>
 *       <div>
 *         <button onClick={retry}>Try Again</button>
 *         <button onClick={reset}>Reset</button>
 *       </div>
 *     </div>
 *   )}
 *   onError={(error, errorInfo) => {
 *     console.error('HTTP Error caught by boundary:', error, errorInfo);
 *     // Log to error reporting service
 *   }}
 * >
 *   <MyComponent />
 * </FluxHttpErrorBoundary>
 * ```
 */
interface FluxHttpErrorBoundaryProps {
  children: React.ReactNode;
  fallback: ErrorBoundaryFallback;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface FluxHttpErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class FluxHttpErrorBoundary extends React.Component<
  FluxHttpErrorBoundaryProps,
  FluxHttpErrorBoundaryState
> {
  constructor(props: FluxHttpErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): FluxHttpErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.props.onError?.(error, errorInfo);
  }

  retry = () => {
    this.setState({ hasError: false, error: null });
  };

  reset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      return this.props.fallback({
        error: this.state.error as any, // Cast to fluxhttpError for consistency
        retry: this.retry,
        reset: this.reset,
      });
    }

    return this.props.children;
  }
}

/**
 * Loading overlay component
 * 
 * @example
 * ```tsx
 * <LoadingOverlay loading={isLoading} message="Saving changes...">
 *   <UserForm onSubmit={handleSubmit} />
 * </LoadingOverlay>
 * ```
 */
interface LoadingOverlayProps {
  loading: boolean;
  message?: string;
  children: React.ReactNode;
  overlay?: boolean;
  spinner?: React.ReactNode;
}

export function LoadingOverlay({
  loading,
  message = 'Loading...',
  children,
  overlay = true,
  spinner,
}: LoadingOverlayProps): JSX.Element {
  const defaultSpinner = (
    <div 
      style={{
        width: '24px',
        height: '24px',
        border: '2px solid #f3f3f3',
        borderTop: '2px solid #3498db',
        borderRadius: '50%',
        animation: 'spin 1s linear infinite',
      }}
    />
  );

  return (
    <div style={{ position: 'relative' }}>
      {children}
      {loading && (
        <div
          style={{
            position: overlay ? 'absolute' : 'static',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: overlay ? 'rgba(255, 255, 255, 0.8)' : 'transparent',
            zIndex: 1000,
            gap: '12px',
          }}
        >
          {spinner || defaultSpinner}
          {message && <div>{message}</div>}
        </div>
      )}
      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

/**
 * Infinite scroll component for paginated data
 * 
 * @example
 * ```tsx
 * <InfiniteScroll
 *   url="/api/posts"
 *   pageParam="page"
 *   hasNextPage={(data) => data.hasMore}
 *   getNextPageParam={(data, page) => data.hasMore ? page + 1 : undefined}
 *   renderItem={(item) => <PostCard key={item.id} post={item} />}
 *   renderLoading={() => <div>Loading more posts...</div>}
 *   renderError={(error) => <div>Error: {error.message}</div>}
 * />
 * ```
 */
interface InfiniteScrollProps<T> {
  url: string;
  pageParam?: string;
  hasNextPage: (data: any) => boolean;
  getNextPageParam: (data: any, currentPage: number) => number | undefined;
  renderItem: (item: T) => React.ReactNode;
  renderLoading?: () => React.ReactNode;
  renderError?: (error: any) => React.ReactNode;
  threshold?: number;
}

export function InfiniteScroll<T>({
  url,
  pageParam = 'page',
  hasNextPage,
  getNextPageParam,
  renderItem,
  renderLoading,
  renderError,
  threshold = 100,
}: InfiniteScrollProps<T>): JSX.Element {
  const [page, setPage] = React.useState(1);
  const [allData, setAllData] = React.useState<T[]>([]);
  const [hasMore, setHasMore] = React.useState(true);
  const loadingRef = useRef<HTMLDivElement>(null);

  const { data, loading, error, execute } = useFluxHttp({
    url,
    params: { [pageParam]: page },
    immediate: false,
    onSuccess: (data) => {
      if (page === 1) {
        setAllData(data.items || []);
      } else {
        setAllData(prev => [...prev, ...(data.items || [])]);
      }
      setHasMore(hasNextPage(data));
    },
  });

  // Load initial data
  useEffect(() => {
    execute();
  }, [execute]);

  // Load next page when page changes
  useEffect(() => {
    if (page > 1) {
      execute();
    }
  }, [page, execute]);

  // Intersection observer for infinite scroll
  useEffect(() => {
    if (!hasMore || loading) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          const nextPage = getNextPageParam(data, page);
          if (nextPage) {
            setPage(nextPage);
          }
        }
      },
      { threshold: 0.1 }
    );

    if (loadingRef.current) {
      observer.observe(loadingRef.current);
    }

    return () => observer.disconnect();
  }, [hasMore, loading, data, page, getNextPageParam]);

  if (page === 1 && loading) {
    return <>{renderLoading?.() || <div>Loading...</div>}</>;
  }

  if (page === 1 && error) {
    return <>{renderError?.(error) || <div>Error: {error.message}</div>}</>;
  }

  return (
    <div>
      {allData.map(renderItem)}
      {hasMore && (
        <div ref={loadingRef} style={{ padding: '20px', textAlign: 'center' }}>
          {loading && (renderLoading?.() || <div>Loading more...</div>)}
        </div>
      )}
    </div>
  );
}