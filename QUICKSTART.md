# FluxHTTP Quick Start Guide

Get up and running with FluxHTTP in minutes! FluxHTTP is a modern, comprehensive HTTP client library for JavaScript/TypeScript with zero dependencies and full TypeScript support.

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

## Basic Usage

### Simple Requests

```typescript
import fluxhttp from 'fluxhttp';

// GET request
const users = await fluxhttp.get('https://api.example.com/users');
console.log(users.data);

// POST request
const newUser = await fluxhttp.post('https://api.example.com/users', {
  name: 'John Doe',
  email: 'john@example.com'
});

// PUT request
const updatedUser = await fluxhttp.put('https://api.example.com/users/1', {
  name: 'Jane Doe'
});

// DELETE request
await fluxhttp.delete('https://api.example.com/users/1');
```

### Creating an Instance

```typescript
import fluxhttp from 'fluxhttp';

// Create a custom instance with default config
const api = fluxhttp.create({
  baseURL: 'https://api.example.com',
  timeout: 10000,
  headers: {
    'Authorization': 'Bearer YOUR_TOKEN_HERE'
  }
});

// Use the instance
const response = await api.get('/users');
const newUser = await api.post('/users', { name: 'John' });
```

### Error Handling

```typescript
import fluxhttp from 'fluxhttp';

try {
  const response = await fluxhttp.get('https://api.example.com/users');
  console.log(response.data);
} catch (error) {
  if (fluxhttp.isFluxHTTPError(error)) {
    // HTTP error (4xx, 5xx)
    console.error('Status:', error.response?.status);
    console.error('Data:', error.response?.data);
  } else {
    // Network or other error
    console.error('Error:', error.message);
  }
}
```

### Request Configuration

```typescript
const response = await fluxhttp.get('/users', {
  // Query parameters
  params: {
    page: 1,
    limit: 10,
    sort: 'name'
  },
  // Custom headers
  headers: {
    'X-Custom-Header': 'value'
  },
  // Request timeout
  timeout: 5000,
  // Response type
  responseType: 'json'
});
```

### Interceptors

```typescript
// Request interceptor
fluxhttp.interceptors.request.use(
  config => {
    // Add auth token to all requests
    config.headers.Authorization = `Bearer ${getToken()}`;
    console.log('Request:', config.method, config.url);
    return config;
  },
  error => {
    return Promise.reject(error);
  }
);

// Response interceptor
fluxhttp.interceptors.response.use(
  response => {
    // Log all responses
    console.log('Response:', response.status);
    return response;
  },
  error => {
    // Handle 401 Unauthorized
    if (error.response?.status === 401) {
      // Redirect to login
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);
```

### TypeScript Support

```typescript
import fluxhttp from 'fluxhttp';
import type { FluxHTTPResponse } from 'fluxhttp';

interface User {
  id: number;
  name: string;
  email: string;
}

// Typed responses
const response = await fluxhttp.get<User>('/users/1');
const user: User = response.data; // Fully typed!

// Custom response wrapper
interface ApiResponse<T> {
  data: T;
  message: string;
  success: boolean;
}

const apiResponse = await fluxhttp.get<ApiResponse<User[]>>('/users');
apiResponse.data.data.forEach(user => {
  console.log(user.name); // TypeScript knows this is a string
});
```

### Concurrent Requests

```typescript
import { all, spread } from 'fluxhttp';

// Using Promise.all wrapper
const [users, posts, comments] = await all([
  fluxhttp.get('/users'),
  fluxhttp.get('/posts'),
  fluxhttp.get('/comments')
]);

// Using spread helper
fluxhttp.all([
  fluxhttp.get('/users'),
  fluxhttp.get('/posts')
]).then(spread((usersResponse, postsResponse) => {
  console.log('Users:', usersResponse.data);
  console.log('Posts:', postsResponse.data);
}));
```

### File Upload

```typescript
const formData = new FormData();
formData.append('file', fileInput.files[0]);
formData.append('description', 'My file');

const response = await fluxhttp.post('/upload', formData, {
  headers: {
    'Content-Type': 'multipart/form-data'
  },
  onUploadProgress: (progressEvent) => {
    const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
    console.log(`Upload Progress: ${progress}%`);
  }
});
```

### Request Cancellation

```typescript
const controller = new AbortController();

// Start request
const promise = fluxhttp.get('/large-data', {
  signal: controller.signal
});

// Cancel after 2 seconds
setTimeout(() => {
  controller.abort();
}, 2000);

try {
  const response = await promise;
  console.log(response.data);
} catch (error) {
  if (fluxhttp.isCancel(error)) {
    console.log('Request cancelled');
  }
}
```

## Common Patterns

### API Client Class

```typescript
import fluxhttp from 'fluxhttp';
import type { FluxHTTPInstance } from 'fluxhttp';

class ApiClient {
  private client: FluxHTTPInstance;

  constructor(baseURL: string, token?: string) {
    this.client = fluxhttp.create({
      baseURL,
      timeout: 10000,
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    });

    this.setupInterceptors();
  }

  private setupInterceptors() {
    this.client.interceptors.response.use(
      response => response,
      error => {
        if (error.response?.status === 401) {
          // Handle token refresh
          this.refreshToken();
        }
        return Promise.reject(error);
      }
    );
  }

  async getUsers() {
    const response = await this.client.get<User[]>('/users');
    return response.data;
  }

  async createUser(user: Omit<User, 'id'>) {
    const response = await this.client.post<User>('/users', user);
    return response.data;
  }
}

// Usage
const api = new ApiClient('https://api.example.com', 'your-token');
const users = await api.getUsers();
```

### React Hook

```typescript
import { useState, useEffect } from 'react';
import fluxhttp from 'fluxhttp';

function useApi<T>(url: string) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function fetchData() {
      try {
        setLoading(true);
        const response = await fluxhttp.get<T>(url, {
          signal: controller.signal
        });
        setData(response.data);
      } catch (err) {
        if (!fluxhttp.isCancel(err)) {
          setError(err as Error);
        }
      } finally {
        setLoading(false);
      }
    }

    fetchData();

    return () => {
      controller.abort();
    };
  }, [url]);

  return { data, loading, error };
}

// Usage
function UserList() {
  const { data: users, loading, error } = useApi<User[]>('/users');

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;
  
  return (
    <ul>
      {users?.map(user => (
        <li key={user.id}>{user.name}</li>
      ))}
    </ul>
  );
}
```

## Next Steps

- Read the [full API documentation](./docs/API.md)
- Check out [more examples](./examples)
- Learn about [advanced features](./docs/API.md#advanced-features)
- [Migrate from Axios](./docs/API.md#migration-from-axios)
- View [comprehensive usage guide](./USAGE.md)

## Need Help?

- 📖 [API Documentation](./docs/API.md)
- 📋 [Usage Guide](./USAGE.md)
- 🔄 [Migration from Axios](./docs/API.md#migration-from-axios)
- 🐛 [Report Issues](https://github.com/fluxhttp/fluxhttp/issues)
- 💬 [Discussions](https://github.com/fluxhttp/fluxhttp/discussions)