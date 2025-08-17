/**
 * @fileoverview React example application demonstrating FluxHTTP integration
 */

import React, { useState } from 'react';
import {
  FluxHttpProvider,
  useFluxHttp,
  useFluxHttpMutation,
  Fetch,
  Query,
  Mutation,
  LoadingOverlay,
  FluxHttpErrorBoundary,
} from '../../../integrations/react/index';

// Types
interface User {
  id: number;
  name: string;
  email: string;
  username: string;
}

interface Post {
  id: number;
  title: string;
  body: string;
  userId: number;
}

interface CreatePostData {
  title: string;
  body: string;
  userId: number;
}

/**
 * User Profile Component using useFluxHttp hook
 */
function UserProfile({ userId }: { userId: number }) {
  const { data, loading, error, refetch } = useFluxHttp<User>({
    url: `https://jsonplaceholder.typicode.com/users/${userId}`,
    immediate: true,
    onSuccess: (data) => console.log('User loaded:', data),
    deps: [userId],
  });

  if (loading) return <div className="loading">Loading user...</div>;
  if (error) return <div className="error">Error: {error.message}</div>;
  if (!data) return <div>No user data</div>;

  return (
    <div className="user-profile">
      <h2>{data.name}</h2>
      <p>Email: {data.email}</p>
      <p>Username: {data.username}</p>
      <button onClick={() => refetch()}>Refresh</button>
    </div>
  );
}

/**
 * Posts List Component using Fetch component
 */
function PostsList({ userId }: { userId: number }) {
  return (
    <Fetch<Post[]>
      url={`https://jsonplaceholder.typicode.com/posts?userId=${userId}`}
      immediate={true}
      fallback={<div className="loading">Loading posts...</div>}
      errorFallback={(error) => <div className="error">Error loading posts: {error.message}</div>}
    >
      {({ data, loading, error, refetch }) => {
        if (loading) return <div>Loading...</div>;
        if (error) return <div>Error: {error.message}</div>;
        if (!data) return <div>No posts</div>;

        return (
          <div className="posts-list">
            <div className="posts-header">
              <h3>Posts ({data.length})</h3>
              <button onClick={() => refetch()}>Refresh Posts</button>
            </div>
            <div className="posts">
              {data.map(post => (
                <div key={post.id} className="post">
                  <h4>{post.title}</h4>
                  <p>{post.body}</p>
                </div>
              ))}
            </div>
          </div>
        );
      }}
    </Fetch>
  );
}

/**
 * Create Post Form using Mutation component
 */
function CreatePostForm({ userId, onSuccess }: { userId: number; onSuccess: () => void }) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');

  return (
    <Mutation<Post, CreatePostData>
      onSuccess={(data) => {
        console.log('Post created:', data);
        setTitle('');
        setBody('');
        onSuccess();
      }}
      onError={(error) => {
        console.error('Failed to create post:', error);
      }}
    >
      {({ mutate, loading, error, success }) => (
        <form
          className="create-post-form"
          onSubmit={(e) => {
            e.preventDefault();
            mutate({ title, body, userId }, {
              url: 'https://jsonplaceholder.typicode.com/posts',
              method: 'POST',
            });
          }}
        >
          <h3>Create New Post</h3>
          <div className="form-group">
            <label htmlFor="title">Title:</label>
            <input
              id="title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              disabled={loading}
            />
          </div>
          <div className="form-group">
            <label htmlFor="body">Body:</label>
            <textarea
              id="body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              required
              disabled={loading}
              rows={4}
            />
          </div>
          <button type="submit" disabled={loading || !title || !body}>
            {loading ? 'Creating...' : 'Create Post'}
          </button>
          {error && <div className="error">Error: {error.message}</div>}
          {success && <div className="success">Post created successfully!</div>}
        </form>
      )}
    </Mutation>
  );
}

/**
 * Query-based Users List Component
 */
function UsersQuery() {
  return (
    <Query<User[]>
      queryKey={['users']}
      url="https://jsonplaceholder.typicode.com/users"
      immediate={true}
      staleTime={5 * 60 * 1000} // 5 minutes
      cacheTime={10 * 60 * 1000} // 10 minutes
      refetchOnWindowFocus={true}
    >
      {({ data, loading, error, refetch, isFresh, isStale }) => (
        <div className="users-query">
          <div className="query-header">
            <h3>All Users</h3>
            <div className="query-status">
              <span className={`status ${isFresh ? 'fresh' : 'stale'}`}>
                {isFresh ? 'Fresh' : 'Stale'}
              </span>
              <button onClick={() => refetch()}>Refresh</button>
            </div>
          </div>
          
          {loading && <div className="loading">Loading users...</div>}
          {error && <div className="error">Error: {error.message}</div>}
          {data && (
            <div className="users-grid">
              {data.map(user => (
                <div key={user.id} className="user-card">
                  <h4>{user.name}</h4>
                  <p>{user.email}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Query>
  );
}

/**
 * Mutation Hook Example
 */
function MutationHookExample() {
  const { mutate, loading, error, success, data } = useFluxHttpMutation<Post, CreatePostData>({
    onSuccess: (data) => {
      console.log('Post created via hook:', data);
    },
    onError: (error) => {
      console.error('Failed to create post via hook:', error);
    },
  });

  const handleCreatePost = () => {
    mutate({
      title: 'New Post from Hook',
      body: 'This post was created using the useFluxHttpMutation hook.',
      userId: 1,
    }, {
      url: 'https://jsonplaceholder.typicode.com/posts',
      method: 'POST',
    });
  };

  return (
    <div className="mutation-hook-example">
      <h3>Mutation Hook Example</h3>
      <button onClick={handleCreatePost} disabled={loading}>
        {loading ? 'Creating...' : 'Create Post with Hook'}
      </button>
      {error && <div className="error">Error: {error.message}</div>}
      {success && data && (
        <div className="success">
          <p>Post created successfully!</p>
          <p>Title: {data.title}</p>
          <p>ID: {data.id}</p>
        </div>
      )}
    </div>
  );
}

/**
 * Main App Component
 */
function AppContent() {
  const [selectedUserId, setSelectedUserId] = useState(1);
  const [refreshKey, setRefreshKey] = useState(0);

  const handlePostCreated = () => {
    setRefreshKey(prev => prev + 1);
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>FluxHTTP React Integration Example</h1>
        <div className="user-selector">
          <label htmlFor="userId">Select User:</label>
          <select
            id="userId"
            value={selectedUserId}
            onChange={(e) => setSelectedUserId(Number(e.target.value))}
          >
            {[1, 2, 3, 4, 5].map(id => (
              <option key={id} value={id}>User {id}</option>
            ))}
          </select>
        </div>
      </header>

      <main className="app-main">
        <div className="column">
          <LoadingOverlay loading={false}>
            <UserProfile userId={selectedUserId} />
          </LoadingOverlay>
          
          <div key={refreshKey}>
            <PostsList userId={selectedUserId} />
          </div>
        </div>

        <div className="column">
          <CreatePostForm 
            userId={selectedUserId} 
            onSuccess={handlePostCreated}
          />
          
          <MutationHookExample />
        </div>

        <div className="column">
          <UsersQuery />
        </div>
      </main>
    </div>
  );
}

/**
 * Root App Component with Provider
 */
export default function App() {
  return (
    <FluxHttpProvider
      defaultConfig={{
        timeout: 10000,
        headers: {
          'Content-Type': 'application/json',
        },
      }}
      onError={(error) => {
        console.error('Global HTTP Error:', error);
      }}
      onLoadingChange={(loading) => {
        console.log('Global loading state:', loading);
      }}
      cache={{
        defaultCacheTime: 5 * 60 * 1000, // 5 minutes
        defaultStaleTime: 60 * 1000,     // 1 minute
        maxSize: 50,
      }}
      retry={{
        attempts: 3,
        delay: 1000,
      }}
    >
      <FluxHttpErrorBoundary
        fallback={({ error, retry, reset }) => (
          <div className="error-boundary">
            <h2>Something went wrong!</h2>
            <p>{error.message}</p>
            <div className="error-actions">
              <button onClick={retry}>Try Again</button>
              <button onClick={reset}>Reset</button>
            </div>
          </div>
        )}
        onError={(error, errorInfo) => {
          console.error('Error caught by boundary:', error, errorInfo);
        }}
      >
        <AppContent />
      </FluxHttpErrorBoundary>
    </FluxHttpProvider>
  );
}