# fluxhttp API Documentation

fluxhttp is a modern, comprehensive HTTP client library for JavaScript/TypeScript that rivals and surpasses Axios with zero dependencies, full TypeScript support, and isomorphic capabilities. With 298 comprehensive tests and 85% coverage, fluxhttp provides a reliable foundation for all your HTTP needs.

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [Core API](#core-api)
- [Configuration](#configuration)
- [Interceptors](#interceptors)
- [Error Handling](#error-handling)
- [Adapters](#adapters)
- [TypeScript Support](#typescript-support)
- [Advanced Features](#advanced-features)
- [Migration from Axios](#migration-from-axios)

## Installation

```bash
npm install fluxhttp
# or
yarn add fluxhttp
# or
pnpm add fluxhttp
# or
bun add fluxhttp
```

## Quick Start

### Basic Usage

```typescript
import fluxhttp from 'fluxhttp';

// GET request
const response = await fluxhttp.get('https://api.example.com/users');
console.log(response.data);

// POST request
const user = await fluxhttp.post('https://api.example.com/users', {
  name: 'John Doe',
  email: 'john@example.com'
});

// With async/await
try {
  const response = await fluxhttp.get('/users/1');
  console.log(response.data);
} catch (error) {
  console.error('Error:', error.message);
}
```

### Creating Custom Instance

```typescript
import { create } from 'fluxhttp';

const apiClient = create({
  baseURL: 'https://api.example.com',
  timeout: 10000,
  headers: {
    'Authorization': 'Bearer your-token-here',
    'Content-Type': 'application/json'
  }
});

const users = await apiClient.get('/users');
```

## Core API

### fluxhttp Instance Methods

#### `request<T>(config: fluxhttpRequestConfig): Promise<fluxhttpResponse<T>>`

Generic request method that all other methods use internally.

```typescript
const response = await fluxhttp.request({
  method: 'GET',
  url: '/users',
  headers: { 'Accept': 'application/json' }
});
```

#### `get<T>(url: string, config?: fluxhttpRequestConfig): Promise<fluxhttpResponse<T>>`

Performs a GET request.

```typescript
// Simple GET
const users = await fluxhttp.get('/users');

// GET with query parameters
const filteredUsers = await fluxhttp.get('/users', {
  params: { status: 'active', page: 1 }
});

// GET with custom headers
const user = await fluxhttp.get('/users/1', {
  headers: { 'Accept': 'application/vnd.api+json' }
});
```

#### `post<T>(url: string, data?: RequestBody, config?: fluxhttpRequestConfig): Promise<fluxhttpResponse<T>>`

Performs a POST request.

```typescript
// JSON POST
const newUser = await fluxhttp.post('/users', {
  name: 'John Doe',
  email: 'john@example.com'
});

// Form data POST
const formData = new FormData();
formData.append('file', fileBlob);
const upload = await fluxhttp.post('/upload', formData);

// URL-encoded POST
const params = new URLSearchParams();
params.append('username', 'johndoe');
params.append('password', 'secret');
const login = await fluxhttp.post('/login', params);
```

#### `put<T>(url: string, data?: RequestBody, config?: fluxhttpRequestConfig): Promise<fluxhttpResponse<T>>`

Performs a PUT request.

```typescript
const updatedUser = await fluxhttp.put('/users/1', {
  name: 'Jane Doe',
  email: 'jane@example.com'
});
```

#### `patch<T>(url: string, data?: RequestBody, config?: fluxhttpRequestConfig): Promise<fluxhttpResponse<T>>`

Performs a PATCH request.

```typescript
const partialUpdate = await fluxhttp.patch('/users/1', {
  email: 'newemail@example.com'
});
```

#### `delete<T>(url: string, config?: fluxhttpRequestConfig): Promise<fluxhttpResponse<T>>`

Performs a DELETE request.

```typescript
await fluxhttp.delete('/users/1');
```

#### `head<T>(url: string, config?: fluxhttpRequestConfig): Promise<fluxhttpResponse<T>>`

Performs a HEAD request.

```typescript
const headers = await fluxhttp.head('/users/1');
console.log(headers.headers['last-modified']);
```

#### `options<T>(url: string, config?: fluxhttpRequestConfig): Promise<fluxhttpResponse<T>>`

Performs an OPTIONS request.

```typescript
const options = await fluxhttp.options('/api');
console.log(options.headers['allow']);
```

### Static Methods

#### `create(config?: fluxhttpRequestConfig): fluxhttpInstance`

Creates a new fluxhttp instance with custom configuration.

```typescript
import { create } from 'fluxhttp';

const apiClient = create({
  baseURL: 'https://api.example.com',
  timeout: 10000
});
```

#### `all<T>(values: Array<T | Promise<T>>): Promise<T[]>`

Helper for executing multiple requests concurrently.

```typescript
import { all } from 'fluxhttp';

const [users, posts, comments] = await all([
  fluxhttp.get('/users'),
  fluxhttp.get('/posts'),
  fluxhttp.get('/comments')
]);
```

#### `spread<T, R>(callback: (...args: T[]) => R): (array: T[]) => R`

Helper for spreading array results to function arguments.

```typescript
import { spread } from 'fluxhttp';

fluxhttp.all([
  fluxhttp.get('/users'),
  fluxhttp.get('/posts')
]).then(spread((users, posts) => {
  console.log('Users:', users.data);
  console.log('Posts:', posts.data);
}));
```

#### `isfluxhttpError(value: unknown): value is fluxhttpError`

Type guard to check if an error is an fluxhttp error.

```typescript
import { isfluxhttpError } from 'fluxhttp';

try {
  await fluxhttp.get('/api/data');
} catch (error) {
  if (isfluxhttpError(error)) {
    console.log('Status:', error.response?.status);
    console.log('Message:', error.message);
  }
}
```

#### `isCancel(value: unknown): boolean`

Checks if an error was caused by request cancellation.

```typescript
import { isCancel } from 'fluxhttp';

try {
  await fluxhttp.get('/api/data');
} catch (error) {
  if (isCancel(error)) {
    console.log('Request was cancelled');
  }
}
```

## Configuration

### fluxhttpRequestConfig

Complete configuration interface for customizing requests:

```typescript
interface fluxhttpRequestConfig {
  // Core options
  url?: string;
  method?: HttpMethod;
  baseURL?: string;
  headers?: Headers;
  params?: QueryParams;
  data?: RequestBody;
  
  // Network options
  timeout?: number;
  withCredentials?: boolean;
  auth?: {
    username: string;
    password: string;
  };
  
  // Response options
  responseType?: 'json' | 'text' | 'blob' | 'arraybuffer' | 'stream';
  responseEncoding?: string;
  validateStatus?: (status: number) => boolean;
  
  // Advanced options
  maxRedirects?: number;
  maxContentLength?: number;
  maxBodyLength?: number;
  decompress?: boolean;
  signal?: AbortSignal;
  
  // Progress tracking
  onUploadProgress?: (progressEvent: ProgressEvent) => void;
  onDownloadProgress?: (progressEvent: ProgressEvent) => void;
  
  // Retry configuration
  retry?: RetryConfig;
  
  // Cache configuration
  cache?: CacheConfig;
  
  // Data transformation
  transformRequest?: Array<(data: unknown, headers?: Headers) => unknown>;
  transformResponse?: Array<(data: unknown) => unknown>;
  
  // Custom adapter
  adapter?: <T = unknown>(config: fluxhttpRequestConfig) => Promise<fluxhttpResponse<T>>;
}
```

### Default Configuration

```typescript
const defaults = {
  timeout: 0, // No timeout
  headers: {
    'Accept': 'application/json, text/plain, */*',
    'User-Agent': 'fluxhttp/0.1.0'
  },
  validateStatus: (status: number) => status >= 200 && status < 300,
  transformRequest: [
    (data, headers) => {
      if (isFormData(data) || isURLSearchParams(data)) {
        return data;
      }
      if (isPlainObject(data)) {
        headers['content-type'] = 'application/json';
        return JSON.stringify(data);
      }
      return data;
    }
  ],
  transformResponse: [
    (data) => {
      if (typeof data === 'string') {
        try {
          return JSON.parse(data);
        } catch {
          return data;
        }
      }
      return data;
    }
  ]
};
```

### Configuration Examples

```typescript
// Timeout configuration
const client = create({
  timeout: 5000 // 5 seconds
});

// Authentication
const authClient = create({
  auth: {
    username: 'user',
    password: 'pass'
  }
});

// Custom headers
const apiClient = create({
  headers: {
    'Authorization': 'Bearer token',
    'X-API-Version': '2.0'
  }
});

// Response validation
const strictClient = create({
  validateStatus: (status) => status === 200
});
```

## Interceptors

Interceptors allow you to transform requests and responses globally.

### Request Interceptors

```typescript
// Add a request interceptor
fluxhttp.interceptors.request.use(
  (config) => {
    // Add auth token to all requests
    config.headers = config.headers || {};
    config.headers['Authorization'] = `Bearer ${getToken()}`;
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Conditional interceptor
fluxhttp.interceptors.request.use(
  (config) => {
    // Only add timestamp to POST requests
    if (config.method === 'POST') {
      config.data = {
        ...config.data,
        timestamp: Date.now()
      };
    }
    return config;
  },
  undefined,
  {
    runWhen: (config) => config.method === 'POST'
  }
);
```

### Response Interceptors

```typescript
// Add a response interceptor
fluxhttp.interceptors.response.use(
  (response) => {
    // Transform all responses
    console.log('Response received:', response.status);
    return response;
  },
  (error) => {
    // Handle errors globally
    if (error.response?.status === 401) {
      // Redirect to login
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Data transformation interceptor
fluxhttp.interceptors.response.use(
  (response) => {
    // Add metadata to all responses
    response.data = {
      ...response.data,
      meta: {
        timestamp: Date.now(),
        source: 'fluxhttp'
      }
    };
    return response;
  }
);
```

### Managing Interceptors

```typescript
// Remove interceptor
const interceptorId = fluxhttp.interceptors.request.use(config => config);
fluxhttp.interceptors.request.eject(interceptorId);

// Clear all interceptors
fluxhttp.interceptors.request.clear();
fluxhttp.interceptors.response.clear();

// Multiple interceptors
const requestId1 = fluxhttp.interceptors.request.use(addAuth);
const requestId2 = fluxhttp.interceptors.request.use(addTimestamp);
const responseId1 = fluxhttp.interceptors.response.use(logResponse);
```

## Error Handling

### fluxhttpError

fluxhttp provides a comprehensive error interface:

```typescript
interface fluxhttpError extends Error {
  config?: fluxhttpRequestConfig;
  code?: string;
  request?: unknown;
  response?: fluxhttpResponse;
  isfluxhttpError: boolean;
  toJSON: () => Record<string, unknown>;
}
```

### Error Types

```typescript
// Network errors
try {
  await fluxhttp.get('https://unreachable.com');
} catch (error) {
  if (error.code === 'ERR_NETWORK') {
    console.log('Network error occurred');
  }
}

// Timeout errors
try {
  await fluxhttp.get('/slow-endpoint', { timeout: 1000 });
} catch (error) {
  if (error.code === 'ETIMEDOUT') {
    console.log('Request timed out');
  }
}

// HTTP status errors
try {
  await fluxhttp.get('/not-found');
} catch (error) {
  if (error.response?.status === 404) {
    console.log('Resource not found');
  }
}

// Cancelled requests
try {
  const controller = new AbortController();
  setTimeout(() => controller.abort(), 100);
  
  await fluxhttp.get('/data', { signal: controller.signal });
} catch (error) {
  if (error.code === 'ERR_CANCELED') {
    console.log('Request was cancelled');
  }
}
```

### Error Response Structure

```typescript
try {
  await fluxhttp.get('/api/users/invalid');
} catch (error: fluxhttpError) {
  console.log({
    message: error.message,
    status: error.response?.status,
    statusText: error.response?.statusText,
    data: error.response?.data,
    headers: error.response?.headers,
    config: {
      url: error.config?.url,
      method: error.config?.method,
      headers: error.config?.headers
    }
  });
}
```

## Adapters

fluxhttp automatically selects the appropriate adapter based on the environment:

### Browser Environment
- **XMLHttpRequest**: Primary adapter for browsers
- **Fetch**: Fallback adapter for modern browsers

### Node.js Environment
- **HTTP/HTTPS**: Native Node.js adapter with full feature support

### Custom Adapters

```typescript
// Custom adapter implementation
const customAdapter = async (config: fluxhttpRequestConfig) => {
  // Your custom HTTP implementation
  const response = await fetch(config.url!, {
    method: config.method,
    headers: config.headers as HeadersInit,
    body: config.data as BodyInit
  });
  
  return {
    data: await response.json(),
    status: response.status,
    statusText: response.statusText,
    headers: Object.fromEntries(response.headers.entries()),
    config,
    request: undefined
  };
};

// Use custom adapter
const client = create({
  adapter: customAdapter
});
```

## TypeScript Support

fluxhttp is built with TypeScript and provides complete type safety:

### Generic Response Types

```typescript
interface User {
  id: number;
  name: string;
  email: string;
}

interface ApiResponse<T> {
  data: T;
  message: string;
  success: boolean;
}

// Typed responses
const user = await fluxhttp.get<ApiResponse<User>>('/users/1');
console.log(user.data.data.name); // Fully typed

const users = await fluxhttp.get<ApiResponse<User[]>>('/users');
users.data.data.forEach(user => {
  console.log(user.email); // Type-safe access
});
```

### Custom Configuration Types

```typescript
interface CustomConfig extends fluxhttpRequestConfig {
  customProperty?: string;
}

const customClient = create<CustomConfig>({
  baseURL: 'https://api.example.com',
  customProperty: 'value'
});
```

### Type Guards

```typescript
import { isfluxhttpError, fluxhttpError } from 'fluxhttp';

async function fetchUser(id: number) {
  try {
    const response = await fluxhttp.get<User>(`/users/${id}`);
    return response.data;
  } catch (error: unknown) {
    if (isfluxhttpError(error)) {
      // error is now typed as fluxhttpError
      console.log('Status:', error.response?.status);
      console.log('Config:', error.config?.url);
    }
    throw error;
  }
}
```

## Advanced Features

### Request/Response Transformation

```typescript
const client = create({
  transformRequest: [
    (data, headers) => {
      // Add API version to all requests
      if (data && typeof data === 'object') {
        return { ...data, apiVersion: '2.0' };
      }
      return data;
    },
    (data) => {
      // Convert to JSON
      return JSON.stringify(data);
    }
  ],
  transformResponse: [
    (data) => {
      // Parse JSON
      if (typeof data === 'string') {
        try {
          return JSON.parse(data);
        } catch {
          return data;
        }
      }
      return data;
    },
    (data) => {
      // Add client-side metadata
      if (data && typeof data === 'object') {
        return {
          ...data,
          clientTimestamp: Date.now()
        };
      }
      return data;
    }
  ]
});
```

### Progress Tracking

```typescript
// Upload progress
await fluxhttp.post('/upload', formData, {
  onUploadProgress: (progressEvent) => {
    const progress = (progressEvent.loaded / progressEvent.total!) * 100;
    console.log(`Upload: ${progress.toFixed(2)}%`);
  }
});

// Download progress
await fluxhttp.get('/large-file', {
  onDownloadProgress: (progressEvent) => {
    const progress = (progressEvent.loaded / progressEvent.total!) * 100;
    console.log(`Download: ${progress.toFixed(2)}%`);
  }
});
```

### Request Cancellation

```typescript
// Using AbortController
const controller = new AbortController();

const promise = fluxhttp.get('/data', {
  signal: controller.signal
});

// Cancel after 5 seconds
setTimeout(() => controller.abort(), 5000);

try {
  const response = await promise;
} catch (error) {
  if (isCancel(error)) {
    console.log('Request cancelled');
  }
}
```

### Concurrent Requests

```typescript
// Promise.all with fluxhttp.all
const responses = await fluxhttp.all([
  fluxhttp.get('/users'),
  fluxhttp.get('/posts'),
  fluxhttp.get('/comments')
]);

// Using Promise.allSettled for mixed results
const results = await Promise.allSettled([
  fluxhttp.get('/endpoint1'),
  fluxhttp.get('/endpoint2'),
  fluxhttp.get('/endpoint3')
]);

results.forEach((result, index) => {
  if (result.status === 'fulfilled') {
    console.log(`Request ${index} succeeded:`, result.value.data);
  } else {
    console.log(`Request ${index} failed:`, result.reason.message);
  }
});
```

### Response Caching

```typescript
const cache = new Map();

const cachedClient = create({
  baseURL: 'https://api.example.com'
});

cachedClient.interceptors.request.use(config => {
  const key = `${config.method}:${config.url}`;
  const cached = cache.get(key);
  
  if (cached && Date.now() - cached.timestamp < 300000) { // 5 minutes
    config.cached = cached.data;
  }
  
  return config;
});

cachedClient.interceptors.response.use(response => {
  const key = `${response.config.method}:${response.config.url}`;
  cache.set(key, {
    data: response.data,
    timestamp: Date.now()
  });
  
  return response;
});
```

## Migration from Axios

fluxhttp provides a nearly identical API to Axios, making migration straightforward:

### Basic Migration

```typescript
// Axios
import axios from 'axios';

// fluxhttp
import fluxhttp from 'fluxhttp';

// Most code works without changes
const response = await fluxhttp.get('/users');
const newUser = await fluxhttp.post('/users', userData);
```

### Instance Creation

```typescript
// Axios
const apiClient = axios.create({
  baseURL: 'https://api.example.com',
  timeout: 10000
});

// fluxhttp
const apiClient = fluxhttp.create({
  baseURL: 'https://api.example.com',
  timeout: 10000
});
```

### Interceptors

```typescript
// Axios interceptors work the same in fluxhttp
apiClient.interceptors.request.use(config => {
  config.headers.Authorization = `Bearer ${token}`;
  return config;
});

apiClient.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401) {
      // Handle auth error
    }
    return Promise.reject(error);
  }
);
```

### Key Differences

1. **Zero Dependencies**: fluxhttp has no dependencies vs Axios's several
2. **TypeScript First**: Better TypeScript support out of the box
3. **Modern Standards**: Built for modern JavaScript/TypeScript
4. **Smaller Bundle**: Significantly smaller bundle size
5. **Tree Shaking**: Better support for tree shaking

### Features Not in Axios

- **Native ESM**: Full ESM support
- **Modern Error Handling**: Enhanced error objects
- **Better TypeScript**: Improved type inference
- **Platform Detection**: Automatic adapter selection

## Best Practices

### Error Handling

```typescript
// Always use try-catch with async/await
try {
  const response = await fluxhttp.get('/api/data');
  return response.data;
} catch (error) {
  if (isfluxhttpError(error)) {
    // Handle HTTP errors
    console.error('HTTP Error:', error.response?.status);
  } else {
    // Handle other errors
    console.error('Unknown Error:', error);
  }
  throw error;
}
```

### Configuration

```typescript
// Create separate clients for different APIs
const apiClient = fluxhttp.create({
  baseURL: 'https://api.example.com',
  timeout: 10000
});

const authClient = fluxhttp.create({
  baseURL: 'https://auth.example.com',
  timeout: 5000
});
```

### Type Safety

```typescript
// Always define response types
interface ApiResponse<T> {
  data: T;
  success: boolean;
  message: string;
}

const fetchUsers = async (): Promise<User[]> => {
  const response = await fluxhttp.get<ApiResponse<User[]>>('/users');
  return response.data.data;
};
```

### Performance

```typescript
// Use concurrent requests for independent data
const [users, posts, settings] = await Promise.all([
  fluxhttp.get('/users'),
  fluxhttp.get('/posts'),
  fluxhttp.get('/settings')
]);

// Cancel requests when components unmount
useEffect(() => {
  const controller = new AbortController();
  
  fluxhttp.get('/data', { signal: controller.signal })
    .then(setData)
    .catch(error => {
      if (!isCancel(error)) {
        setError(error);
      }
    });
  
  return () => controller.abort();
}, []);
```

This completes the comprehensive API documentation for fluxhttp. The library provides a modern, type-safe, and feature-rich HTTP client that can serve as a drop-in replacement for Axios with additional benefits.