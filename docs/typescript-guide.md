# TypeScript Guide for FluxHTTP

This comprehensive guide covers TypeScript usage with FluxHTTP, including type definitions, generic types for responses, custom configuration types, and best practices.

## Table of Contents

1. [Getting Started with TypeScript](#getting-started-with-typescript)
2. [Core Type Definitions](#core-type-definitions)
3. [Generic Response Types](#generic-response-types)
4. [Request Configuration Types](#request-configuration-types)
5. [Error Handling with Types](#error-handling-with-types)
6. [Custom Types and Interfaces](#custom-types-and-interfaces)
7. [Interceptor Types](#interceptor-types)
8. [Advanced TypeScript Patterns](#advanced-typescript-patterns)
9. [Best Practices](#best-practices)
10. [Common Patterns and Examples](#common-patterns-and-examples)

## Getting Started with TypeScript

FluxHTTP is built with TypeScript and provides comprehensive type definitions out of the box. No additional type packages are needed.

### Installation and Setup

```bash
npm install @fluxhttp/core
```

### Basic TypeScript Configuration

```json
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "lib": ["ES2020", "DOM"],
    "moduleResolution": "node",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  }
}
```

## Core Type Definitions

### Essential Types

```typescript
import fluxhttp, {
  fluxhttpResponse,
  fluxhttpRequestConfig,
  fluxhttpError,
  fluxhttpInstance,
  HttpMethod,
  Headers,
  RequestBody
} from '@fluxhttp/core';

// HTTP Methods
type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS';

// Headers type
type Headers = Record<string, string | string[] | undefined>;

// Request body types
type RequestBody =
  | string
  | Record<string, unknown>
  | FormData
  | URLSearchParams
  | ArrayBuffer
  | Blob
  | ReadableStream
  | null
  | undefined;
```

### Basic Usage with Types

```typescript
import fluxhttp, { fluxhttpResponse } from '@fluxhttp/core';

// Simple typed request
const response: fluxhttpResponse<string> = await fluxhttp.get('/api/status');
console.log(response.data); // TypeScript knows this is a string

// Request with explicit method type
const method: HttpMethod = 'POST';
await fluxhttp.request({ method, url: '/api/data' });
```

## Generic Response Types

### Defining Response Data Types

```typescript
// User interface
interface User {
  id: number;
  name: string;
  email: string;
  createdAt: string;
}

// Paginated response
interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

// API response wrapper
interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  timestamp: string;
}
```

### Using Generic Types with Requests

```typescript
import fluxhttp, { fluxhttpResponse } from '@fluxhttp/core';

// Typed GET request
async function getUser(id: number): Promise<User> {
  const response: fluxhttpResponse<User> = await fluxhttp.get(`/users/${id}`);
  return response.data; // TypeScript knows this is User type
}

// Typed POST request
async function createUser(userData: Omit<User, 'id' | 'createdAt'>): Promise<User> {
  const response: fluxhttpResponse<User> = await fluxhttp.post('/users', userData);
  return response.data;
}

// Paginated response
async function getUsers(page: number = 1): Promise<PaginatedResponse<User>> {
  const response: fluxhttpResponse<PaginatedResponse<User>> = await fluxhttp.get('/users', {
    params: { page, limit: 20 }
  });
  return response.data;
}

// API wrapper response
async function getUsersWithWrapper(): Promise<User[]> {
  const response: fluxhttpResponse<ApiResponse<User[]>> = await fluxhttp.get('/users');
  
  if (response.data.success) {
    return response.data.data; // TypeScript knows this is User[]
  }
  
  throw new Error(response.data.message || 'Request failed');
}
```

### Union Types for Multiple Response Formats

```typescript
// Different response types based on status
type UserResponse = 
  | { success: true; user: User }
  | { success: false; error: string };

async function getUserSafe(id: number): Promise<UserResponse> {
  try {
    const response: fluxhttpResponse<User> = await fluxhttp.get(`/users/${id}`);
    return { success: true, user: response.data };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Usage with type guards
const result = await getUserSafe(123);
if (result.success) {
  console.log(result.user.name); // TypeScript knows user exists
} else {
  console.error(result.error); // TypeScript knows error exists
}
```

## Request Configuration Types

### Typed Configuration Objects

```typescript
import { fluxhttpRequestConfig, Headers } from '@fluxhttp/core';

// Custom headers interface
interface AuthHeaders extends Headers {
  'Authorization': string;
  'X-API-Version': string;
}

// Typed configuration
const config: fluxhttpRequestConfig = {
  baseURL: 'https://api.example.com',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer token123'
  } as AuthHeaders,
  validateStatus: (status: number): boolean => status >= 200 && status < 300
};

// Function with typed config parameter
async function makeAuthenticatedRequest<T>(
  url: string,
  token: string,
  additionalConfig?: Partial<fluxhttpRequestConfig>
): Promise<fluxhttpResponse<T>> {
  const config: fluxhttpRequestConfig = {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    timeout: 5000,
    ...additionalConfig
  };

  return fluxhttp.get<T>(url, config);
}
```

### Custom Configuration Interfaces

```typescript
// Extended configuration for specific use cases
interface ApiClientConfig extends fluxhttpRequestConfig {
  apiKey: string;
  version: string;
  enableLogging?: boolean;
}

class TypedApiClient {
  private config: ApiClientConfig;
  private instance: fluxhttpInstance;

  constructor(config: ApiClientConfig) {
    this.config = config;
    this.instance = fluxhttp.create({
      baseURL: `https://api.example.com/v${config.version}`,
      headers: {
        'X-API-Key': config.apiKey
      },
      ...config
    });

    if (config.enableLogging) {
      this.setupLogging();
    }
  }

  async get<T>(url: string, config?: fluxhttpRequestConfig): Promise<T> {
    const response: fluxhttpResponse<T> = await this.instance.get(url, config);
    return response.data;
  }

  private setupLogging(): void {
    this.instance.interceptors.request.use(config => {
      console.log(`Request: ${config.method?.toUpperCase()} ${config.url}`);
      return config;
    });
  }
}
```

## Error Handling with Types

### Typed Error Handling

```typescript
import fluxhttp, { fluxhttpError, fluxhttpResponse } from '@fluxhttp/core';

// Custom error types
interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

interface ValidationError {
  field: string;
  message: string;
}

// Type-safe error handler
async function handleTypedRequest<T>(
  requestFn: () => Promise<fluxhttpResponse<T>>
): Promise<T | null> {
  try {
    const response = await requestFn();
    return response.data;
  } catch (error) {
    if (fluxhttp.isfluxhttpError(error)) {
      const fluxError = error as fluxhttpError;
      
      if (fluxError.response) {
        const status = fluxError.response.status;
        const errorData = fluxError.response.data as ApiError;
        
        switch (status) {
          case 400:
            console.error('Validation error:', errorData.message);
            break;
          case 401:
            console.error('Authentication failed');
            break;
          case 403:
            console.error('Access denied');
            break;
          case 404:
            console.error('Resource not found');
            break;
          case 500:
            console.error('Server error:', errorData.details);
            break;
          default:
            console.error('HTTP error:', status, errorData.message);
        }
      } else {
        console.error('Network error:', fluxError.message);
      }
    } else {
      console.error('Unknown error:', error);
    }
    
    return null;
  }
}

// Usage
const userData = await handleTypedRequest<User>(() => 
  fluxhttp.get<User>('/users/123')
);

if (userData) {
  console.log('User loaded:', userData.name);
} else {
  console.log('Failed to load user');
}
```

### Custom Error Classes with Types

```typescript
class ApiResponseError extends Error {
  constructor(
    public status: number,
    public data: ApiError,
    public originalError: fluxhttpError
  ) {
    super(`API Error ${status}: ${data.message}`);
    this.name = 'ApiResponseError';
  }
}

async function apiRequest<T>(url: string): Promise<T> {
  try {
    const response: fluxhttpResponse<T> = await fluxhttp.get(url);
    return response.data;
  } catch (error) {
    if (fluxhttp.isfluxhttpError(error) && error.response) {
      throw new ApiResponseError(
        error.response.status,
        error.response.data as ApiError,
        error
      );
    }
    throw error;
  }
}
```

## Custom Types and Interfaces

### Creating Typed API Clients

```typescript
// Resource interfaces
interface Post {
  id: number;
  title: string;
  content: string;
  authorId: number;
  createdAt: string;
  updatedAt: string;
}

interface Comment {
  id: number;
  postId: number;
  content: string;
  authorId: number;
  createdAt: string;
}

// API client with full typing
class BlogApiClient {
  private client: fluxhttpInstance;

  constructor(baseURL: string, apiKey: string) {
    this.client = fluxhttp.create({
      baseURL,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });
  }

  // Posts endpoints
  async getPosts(): Promise<Post[]> {
    const response: fluxhttpResponse<Post[]> = await this.client.get('/posts');
    return response.data;
  }

  async getPost(id: number): Promise<Post> {
    const response: fluxhttpResponse<Post> = await this.client.get(`/posts/${id}`);
    return response.data;
  }

  async createPost(post: Omit<Post, 'id' | 'createdAt' | 'updatedAt'>): Promise<Post> {
    const response: fluxhttpResponse<Post> = await this.client.post('/posts', post);
    return response.data;
  }

  async updatePost(id: number, updates: Partial<Omit<Post, 'id' | 'createdAt' | 'updatedAt'>>): Promise<Post> {
    const response: fluxhttpResponse<Post> = await this.client.put(`/posts/${id}`, updates);
    return response.data;
  }

  async deletePost(id: number): Promise<void> {
    await this.client.delete(`/posts/${id}`);
  }

  // Comments endpoints
  async getPostComments(postId: number): Promise<Comment[]> {
    const response: fluxhttpResponse<Comment[]> = await this.client.get(`/posts/${postId}/comments`);
    return response.data;
  }

  async createComment(comment: Omit<Comment, 'id' | 'createdAt'>): Promise<Comment> {
    const response: fluxhttpResponse<Comment> = await this.client.post('/comments', comment);
    return response.data;
  }
}

// Usage
const blogApi = new BlogApiClient('https://api.blog.com', 'your-api-key');
const posts: Post[] = await blogApi.getPosts();
const newPost: Post = await blogApi.createPost({
  title: 'My New Post',
  content: 'Post content here',
  authorId: 1
});
```

## Interceptor Types

### Typed Interceptors

```typescript
import { fluxhttpRequestConfig, fluxhttpResponse, InterceptorManager } from '@fluxhttp/core';

// Request interceptor with types
const requestInterceptor = (config: fluxhttpRequestConfig): fluxhttpRequestConfig => {
  // Add timestamp to all requests
  config.headers = {
    ...config.headers,
    'X-Request-Timestamp': new Date().toISOString()
  };
  
  return config;
};

// Response interceptor with generic types
const responseInterceptor = <T>(response: fluxhttpResponse<T>): fluxhttpResponse<T> => {
  // Log response time
  const requestTime = response.config.headers?.['X-Request-Timestamp'];
  if (requestTime) {
    const responseTime = Date.now() - new Date(requestTime as string).getTime();
    console.log(`Request took ${responseTime}ms`);
  }
  
  return response;
};

// Setting up typed interceptors
const client = fluxhttp.create();

client.interceptors.request.use(
  requestInterceptor,
  (error: unknown) => Promise.reject(error)
);

client.interceptors.response.use(
  responseInterceptor,
  (error: unknown) => Promise.reject(error)
);
```

### Advanced Interceptor Patterns

```typescript
// Generic data transformation interceptor
function createDataTransformInterceptor<TInput, TOutput>(
  transform: (data: TInput) => TOutput
) {
  return (response: fluxhttpResponse<TInput>): fluxhttpResponse<TOutput> => {
    return {
      ...response,
      data: transform(response.data)
    };
  };
}

// Date string to Date object transformer
interface UserWithDateStrings {
  id: number;
  name: string;
  createdAt: string;
  updatedAt: string;
}

interface UserWithDates {
  id: number;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

const dateTransformInterceptor = createDataTransformInterceptor<UserWithDateStrings, UserWithDates>(
  (user) => ({
    ...user,
    createdAt: new Date(user.createdAt),
    updatedAt: new Date(user.updatedAt)
  })
);

// Use with specific endpoints
const userClient = fluxhttp.create();
userClient.interceptors.response.use(dateTransformInterceptor);
```

## Advanced TypeScript Patterns

### Conditional Types and Utility Types

```typescript
// Conditional response type based on method
type ResponseType<TMethod extends HttpMethod, TData> = 
  TMethod extends 'GET' ? TData :
  TMethod extends 'POST' ? TData :
  TMethod extends 'PUT' ? TData :
  TMethod extends 'DELETE' ? void :
  TData;

// Generic request function with conditional return type
async function typedRequest<TMethod extends HttpMethod, TData = unknown>(
  method: TMethod,
  url: string,
  data?: RequestBody
): Promise<ResponseType<TMethod, TData>> {
  const response = await fluxhttp.request<TData>({ method, url, data });
  
  if (method === 'DELETE') {
    return undefined as ResponseType<TMethod, TData>;
  }
  
  return response.data as ResponseType<TMethod, TData>;
}

// Usage
const userData: User = await typedRequest('GET', '/users/123');
const newUser: User = await typedRequest('POST', '/users', { name: 'John' });
const updatedUser: User = await typedRequest('PUT', '/users/123', { name: 'Jane' });
const deleteResult: void = await typedRequest('DELETE', '/users/123');
```

### Mapped Types for API Endpoints

```typescript
// Define all API endpoints
interface ApiEndpoints {
  '/users': {
    GET: { response: User[] };
    POST: { body: Omit<User, 'id'>; response: User };
  };
  '/users/:id': {
    GET: { response: User };
    PUT: { body: Partial<User>; response: User };
    DELETE: { response: void };
  };
  '/posts': {
    GET: { response: Post[] };
    POST: { body: Omit<Post, 'id'>; response: Post };
  };
}

// Extract response type for endpoint and method
type EndpointResponse<
  TEndpoint extends keyof ApiEndpoints,
  TMethod extends keyof ApiEndpoints[TEndpoint]
> = ApiEndpoints[TEndpoint][TMethod] extends { response: infer TResponse }
  ? TResponse
  : never;

// Extract body type for endpoint and method
type EndpointBody<
  TEndpoint extends keyof ApiEndpoints,
  TMethod extends keyof ApiEndpoints[TEndpoint]
> = ApiEndpoints[TEndpoint][TMethod] extends { body: infer TBody }
  ? TBody
  : never;

// Type-safe API client
class TypeSafeApiClient {
  async get<TEndpoint extends keyof ApiEndpoints>(
    endpoint: TEndpoint
  ): Promise<EndpointResponse<TEndpoint, 'GET'>> {
    const response = await fluxhttp.get(endpoint as string);
    return response.data;
  }

  async post<TEndpoint extends keyof ApiEndpoints>(
    endpoint: TEndpoint,
    body: EndpointBody<TEndpoint, 'POST'>
  ): Promise<EndpointResponse<TEndpoint, 'POST'>> {
    const response = await fluxhttp.post(endpoint as string, body);
    return response.data;
  }
}

// Usage with full type safety
const api = new TypeSafeApiClient();
const users: User[] = await api.get('/users'); // Type is inferred correctly
const newUser: User = await api.post('/users', { name: 'John', email: 'john@example.com' });
```

## Best Practices

### 1. Define Clear Interface Boundaries

```typescript
// Good: Clear separation of concerns
interface CreateUserRequest {
  name: string;
  email: string;
  password: string;
}

interface CreateUserResponse {
  id: number;
  name: string;
  email: string;
  createdAt: string;
}

async function createUser(request: CreateUserRequest): Promise<CreateUserResponse> {
  const response: fluxhttpResponse<CreateUserResponse> = await fluxhttp.post('/users', request);
  return response.data;
}

// Avoid: Mixing internal and external types
// Don't expose fluxhttpResponse in your public API
```

### 2. Use Generic Constraints

```typescript
// Constrain generic types for better type safety
interface Identifiable {
  id: number;
}

async function updateResource<T extends Identifiable>(
  endpoint: string,
  resource: T,
  updates: Partial<Omit<T, 'id'>>
): Promise<T> {
  const response: fluxhttpResponse<T> = await fluxhttp.put(
    `${endpoint}/${resource.id}`,
    updates
  );
  return response.data;
}

// Usage
const updatedUser = await updateResource('/users', user, { name: 'New Name' });
```

### 3. Create Type-Safe Error Boundaries

```typescript
// Result type for error handling
type Result<T, E = Error> = 
  | { success: true; data: T }
  | { success: false; error: E };

async function safeApiCall<T>(
  requestFn: () => Promise<fluxhttpResponse<T>>
): Promise<Result<T, fluxhttpError>> {
  try {
    const response = await requestFn();
    return { success: true, data: response.data };
  } catch (error) {
    if (fluxhttp.isfluxhttpError(error)) {
      return { success: false, error };
    }
    return { success: false, error: new Error('Unknown error') as fluxhttpError };
  }
}

// Usage
const result = await safeApiCall(() => fluxhttp.get<User>('/users/123'));
if (result.success) {
  console.log('User:', result.data.name); // Type-safe access
} else {
  console.error('Error:', result.error.message);
}
```

### 4. Use Branded Types for IDs

```typescript
// Branded types for type safety
type UserId = number & { readonly __brand: 'UserId' };
type PostId = number & { readonly __brand: 'PostId' };

function createUserId(id: number): UserId {
  return id as UserId;
}

function createPostId(id: number): PostId {
  return id as PostId;
}

interface User {
  id: UserId;
  name: string;
}

interface Post {
  id: PostId;
  title: string;
  authorId: UserId; // Type-safe foreign key
}

async function getUser(id: UserId): Promise<User> {
  const response: fluxhttpResponse<User> = await fluxhttp.get(`/users/${id}`);
  return response.data;
}

// This prevents mixing up different ID types
const userId = createUserId(123);
const postId = createPostId(456);

await getUser(userId); // ✅ Correct
// await getUser(postId); // ❌ TypeScript error
```

## Common Patterns and Examples

### 1. Repository Pattern with Types

```typescript
interface Repository<T, TId = number> {
  findAll(): Promise<T[]>;
  findById(id: TId): Promise<T | null>;
  create(entity: Omit<T, 'id'>): Promise<T>;
  update(id: TId, updates: Partial<T>): Promise<T>;
  delete(id: TId): Promise<void>;
}

class HttpRepository<T extends { id: TId }, TId = number> implements Repository<T, TId> {
  constructor(
    private client: fluxhttpInstance,
    private endpoint: string
  ) {}

  async findAll(): Promise<T[]> {
    const response: fluxhttpResponse<T[]> = await this.client.get(this.endpoint);
    return response.data;
  }

  async findById(id: TId): Promise<T | null> {
    try {
      const response: fluxhttpResponse<T> = await this.client.get(`${this.endpoint}/${id}`);
      return response.data;
    } catch (error) {
      if (fluxhttp.isfluxhttpError(error) && error.response?.status === 404) {
        return null;
      }
      throw error;
    }
  }

  async create(entity: Omit<T, 'id'>): Promise<T> {
    const response: fluxhttpResponse<T> = await this.client.post(this.endpoint, entity);
    return response.data;
  }

  async update(id: TId, updates: Partial<T>): Promise<T> {
    const response: fluxhttpResponse<T> = await this.client.put(`${this.endpoint}/${id}`, updates);
    return response.data;
  }

  async delete(id: TId): Promise<void> {
    await this.client.delete(`${this.endpoint}/${id}`);
  }
}

// Usage
const userRepository = new HttpRepository<User>(fluxhttp.create(), '/users');
const users = await userRepository.findAll();
const user = await userRepository.findById(123);
```

### 2. Type-Safe Query Builder

```typescript
interface QueryParams {
  page?: number;
  limit?: number;
  sort?: string;
  filter?: Record<string, unknown>;
}

class TypedQueryBuilder<T> {
  private params: QueryParams = {};

  constructor(private client: fluxhttpInstance, private endpoint: string) {}

  page(page: number): this {
    this.params.page = page;
    return this;
  }

  limit(limit: number): this {
    this.params.limit = limit;
    return this;
  }

  sort(field: keyof T, direction: 'asc' | 'desc' = 'asc'): this {
    this.params.sort = `${String(field)}:${direction}`;
    return this;
  }

  filter(field: keyof T, value: unknown): this {
    this.params.filter = { ...this.params.filter, [field]: value };
    return this;
  }

  async execute(): Promise<T[]> {
    const response: fluxhttpResponse<T[]> = await this.client.get(this.endpoint, {
      params: this.params
    });
    return response.data;
  }
}

// Usage
const users = await new TypedQueryBuilder<User>(fluxhttp.create(), '/users')
  .page(1)
  .limit(10)
  .sort('name', 'asc')
  .filter('active', true)
  .execute();
```

This TypeScript guide provides comprehensive coverage of using TypeScript effectively with FluxHTTP. The type system ensures better code quality, IDE support, and runtime safety while maintaining the flexibility and power of the HTTP client.