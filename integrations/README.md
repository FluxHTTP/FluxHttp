# FluxHTTP Framework Integrations

This directory contains comprehensive framework integrations for FluxHTTP, providing idiomatic patterns and components for popular frontend frameworks.

## Overview

FluxHTTP integrations bring the power of our zero-dependency HTTP client to your favorite frontend frameworks with:

- **Framework-specific patterns**: Hooks, stores, services, and composables
- **Type safety**: Full TypeScript support with framework-specific types
- **State management**: Built-in loading states, error handling, and caching
- **Ready-to-use components**: Drop-in components for common HTTP patterns
- **SSR support**: Server-side rendering compatibility where applicable
- **Performance optimizations**: Request deduplication, caching, and retry logic

## Framework Support

### React Integration (`/react`)

Full React integration with hooks, context providers, and components.

**Key Features:**
- `useFluxHttp` - Main hook for HTTP requests
- `useFluxHttpMutation` - Hook for mutations (POST, PUT, DELETE)
- `FluxHttpProvider` - Context provider for global configuration
- Ready-to-use components: `Fetch`, `Query`, `Mutation`, `InfiniteScroll`
- Error boundaries and loading states
- Suspense support

**Quick Start:**
```tsx
import { FluxHttpProvider, useFluxHttp } from '@fluxhttp/react';

function App() {
  return (
    <FluxHttpProvider defaultConfig={{ baseURL: 'https://api.example.com' }}>
      <UserProfile />
    </FluxHttpProvider>
  );
}

function UserProfile() {
  const { data, loading, error } = useFluxHttp({
    url: '/api/user',
    immediate: true
  });

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;
  return <div>Hello, {data?.name}!</div>;
}
```

### Vue Integration (`/vue`)

Vue 3 integration with composables, plugins, and components.

**Key Features:**
- `useFluxHttp` - Main composable for HTTP requests
- `useFluxHttpMutation` - Composable for mutations
- `FluxHttpPlugin` - Vue plugin for global configuration
- Ready-to-use components: `FluxHttpFetch`, `FluxHttpQuery`, `FluxHttpMutation`
- Reactive state management
- Query caching and infinite queries

**Quick Start:**
```typescript
// main.ts
import { createApp } from 'vue';
import { FluxHttpPlugin } from '@fluxhttp/vue';
import App from './App.vue';

const app = createApp(App);
app.use(FluxHttpPlugin, {
  defaultConfig: { baseURL: 'https://api.example.com' }
});
app.mount('#app');
```

```vue
<!-- UserProfile.vue -->
<script setup lang="ts">
import { useFluxHttp } from '@fluxhttp/vue';

const { data, loading, error } = useFluxHttp({
  url: '/api/user',
  immediate: true
});
</script>

<template>
  <div v-if="loading">Loading...</div>
  <div v-else-if="error">Error: {{ error.message }}</div>
  <div v-else>Hello, {{ data?.name }}!</div>
</template>
```

### Angular Integration (`/angular`)

Angular integration with services, interceptors, and modules.

**Key Features:**
- `FluxHttpService` - Main service for HTTP requests
- `FluxHttpModule` - Angular module with providers
- Built-in interceptors for loading states, errors, and caching
- Observable-based APIs
- Dependency injection support

**Quick Start:**
```typescript
// app.module.ts
import { NgModule } from '@angular/core';
import { FluxHttpModule } from '@fluxhttp/angular';

@NgModule({
  imports: [
    FluxHttpModule.forRoot({
      defaultConfig: { baseURL: 'https://api.example.com' }
    })
  ],
})
export class AppModule {}
```

```typescript
// user.component.ts
import { Component, OnInit } from '@angular/core';
import { FluxHttpService } from '@fluxhttp/angular';

@Component({
  template: `
    <div *ngIf="userQuery.loading">Loading...</div>
    <div *ngIf="userQuery.error">Error: {{ userQuery.error.message }}</div>
    <div *ngIf="userQuery.data">Hello, {{ userQuery.data.name }}!</div>
  `
})
export class UserComponent implements OnInit {
  userQuery = this.fluxHttp.createQuery({ url: '/api/user' });

  constructor(private fluxHttp: FluxHttpService) {}

  ngOnInit() {
    this.userQuery.execute().subscribe();
  }
}
```

### Svelte Integration (`/svelte`)

Svelte integration with stores, actions, and components.

**Key Features:**
- `createFluxHttpStore` - Store factory for HTTP requests
- `createFluxHttpMutationStore` - Store factory for mutations
- Svelte actions: `use:fluxhttp`, `use:fetch`, `use:submit`
- Ready-to-use components
- Reactive stores

**Quick Start:**
```typescript
// main.ts
import { configureFluxHttp } from '@fluxhttp/svelte';

configureFluxHttp({
  defaultConfig: { baseURL: 'https://api.example.com' }
});
```

```svelte
<!-- UserProfile.svelte -->
<script lang="ts">
  import { createFluxHttpStore } from '@fluxhttp/svelte';
  
  const userStore = createFluxHttpStore({
    url: '/api/user',
    immediate: true
  });
</script>

{#if $userStore.loading}
  <div>Loading...</div>
{:else if $userStore.error}
  <div>Error: {$userStore.error.message}</div>
{:else if $userStore.data}
  <div>Hello, {$userStore.data.name}!</div>
{/if}
```

## Universal Patterns

All integrations support these common patterns:

### Loading States
```typescript
// React
const { loading } = useFluxHttp({ url: '/api/data' });

// Vue
const { loading } = useFluxHttp({ url: '/api/data' });

// Angular
const query = service.createQuery({ url: '/api/data' });
query.loading$ // Observable<boolean>

// Svelte
const store = createFluxHttpStore({ url: '/api/data' });
$store.loading // boolean
```

### Error Handling
```typescript
// Global error handling
{
  onError: (error) => {
    console.error('HTTP Error:', error);
    // Show toast, redirect to login, etc.
  }
}

// Per-request error handling
{
  onError: (error) => {
    // Handle specific request error
  }
}
```

### Caching
```typescript
{
  staleTime: 5 * 60 * 1000,  // 5 minutes
  cacheTime: 10 * 60 * 1000, // 10 minutes
  refetchOnWindowFocus: true,
  refetchOnReconnect: true
}
```

### Request Deduplication
```typescript
{
  dedupingInterval: 2000, // 2 seconds
}
```

### Retry Logic
```typescript
{
  retry: 3, // Number of retries
  retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000)
}
```

### Mutations
```typescript
// React
const { mutate } = useFluxHttpMutation({
  onSuccess: (data) => console.log('Success:', data),
  onError: (error) => console.error('Error:', error)
});

// Vue
const { mutate } = useFluxHttpMutation({
  onSuccess: (data) => console.log('Success:', data)
});

// Angular
const mutation = service.createMutation({
  onSuccess: (data) => console.log('Success:', data)
});

// Svelte
const mutation = createFluxHttpMutationStore({
  onSuccess: (data) => console.log('Success:', data)
});
```

## Authentication Flows

Common authentication patterns:

### Token-based Authentication
```typescript
// Global configuration
{
  defaultConfig: {
    headers: {
      'Authorization': `Bearer ${getToken()}`
    }
  },
  onError: (error) => {
    if (error.response?.status === 401) {
      // Redirect to login
      window.location.href = '/login';
    }
  }
}
```

### Request Interceptors
```typescript
// React/Vue/Svelte
client.interceptors.request.use(config => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Angular (handled by interceptors automatically)
```

## Performance Best Practices

### Request Deduplication
Automatic deduplication of identical requests within a time window.

### Background Refetching
Keep UI responsive while updating data in the background.

### Optimistic Updates
Update UI immediately, rollback on error.

### Infinite Queries
Efficiently handle paginated data with automatic loading.

### Bundle Size Optimization
Tree-shakeable integrations that only include what you use.

## TypeScript Support

All integrations provide full TypeScript support:

```typescript
interface User {
  id: number;
  name: string;
  email: string;
}

// Strongly typed responses
const { data } = useFluxHttp<User>({ url: '/api/user' });
// data is typed as User | null

// Strongly typed mutations
const { mutate } = useFluxHttpMutation<User, CreateUserData>({
  onSuccess: (user: User) => {
    // user is strongly typed
  }
});
```

## Server-Side Rendering (SSR)

### Next.js Support
```typescript
import { useFluxHttp } from '@fluxhttp/react';

function Page({ initialData }) {
  const { data } = useFluxHttp({
    url: '/api/data',
    initialData // Hydrate with SSR data
  });
}

export async function getServerSideProps() {
  const data = await fluxhttp.get('/api/data');
  return { props: { initialData: data.data } };
}
```

### Nuxt.js Support
```vue
<script setup lang="ts">
import { useFluxHttp } from '@fluxhttp/vue';

const { data } = useFluxHttp({
  url: '/api/data',
  immediate: process.client // Only run on client
});
</script>
```

## Examples

Each integration includes complete example applications:

- `/examples/react-app` - Complete React application
- `/examples/vue-app` - Complete Vue 3 application  
- `/examples/angular-app` - Complete Angular application
- `/examples/svelte-app` - Complete Svelte application

## Testing

All integrations provide testing utilities:

```typescript
// React Testing Library
import { render } from '@testing-library/react';
import { FluxHttpProvider } from '@fluxhttp/react';

const mockClient = createMockClient();

render(
  <FluxHttpProvider instance={mockClient}>
    <MyComponent />
  </FluxHttpProvider>
);

// Vue Test Utils
import { mount } from '@vue/test-utils';
import { FluxHttpPlugin } from '@fluxhttp/vue';

const wrapper = mount(MyComponent, {
  global: {
    plugins: [[FluxHttpPlugin, { instance: mockClient }]]
  }
});

// Angular Testing
import { TestBed } from '@angular/core/testing';
import { FluxHttpModule } from '@fluxhttp/angular';

TestBed.configureTestingModule({
  imports: [FluxHttpModule.forRoot({ instance: mockClient })]
});

// Svelte Testing
import { render } from '@testing-library/svelte';
import { configureFluxHttp } from '@fluxhttp/svelte';

configureFluxHttp({ instance: mockClient });
render(MyComponent);
```

## Migration Guides

### From Axios
FluxHTTP integrations provide familiar patterns for Axios users with improved performance and zero dependencies.

### From Fetch
Easy migration path with enhanced features like automatic retries, caching, and request deduplication.

### From Framework HTTP Clients
Direct replacements for Angular HttpClient, Vue axios plugin, etc. with better developer experience.

## Contributing

See the main [CONTRIBUTING.md](../CONTRIBUTING.md) for guidelines on contributing to FluxHTTP integrations.

## License

MIT - see [LICENSE](../LICENSE) for details.