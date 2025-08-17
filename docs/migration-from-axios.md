# Migration Guide: From Axios to FluxHTTP

This guide provides step-by-step instructions for migrating from Axios to FluxHTTP, including API differences, common patterns translation, and breaking changes.

## Table of Contents

1. [Quick Migration Overview](#quick-migration-overview)
2. [Installation](#installation)
3. [Basic API Changes](#basic-api-changes)
4. [Common Patterns Translation](#common-patterns-translation)
5. [Advanced Features Migration](#advanced-features-migration)
6. [Breaking Changes](#breaking-changes)
7. [Migration Examples](#migration-examples)
8. [Troubleshooting](#troubleshooting)

## Quick Migration Overview

FluxHTTP is designed to be largely compatible with Axios, making migration straightforward for most use cases. The core API is very similar, with some improvements and simplifications.

### Key Similarities
- Same request methods: `get()`, `post()`, `put()`, `delete()`, etc.
- Same instance creation pattern with `create()`
- Same interceptor system for requests and responses
- Same configuration options for most common use cases
- Same error handling patterns

### Key Differences
- Zero dependencies (vs Axios's dependencies)
- Smaller bundle size (2.7KB vs 13KB+)
- Built-in TypeScript support
- Simplified configuration options
- Enhanced security features built-in
- Modern ES modules support

## Installation

### Remove Axios and Install FluxHTTP

```bash
# Remove axios
npm uninstall axios

# Install fluxhttp
npm install @fluxhttp/core
```

### Update Import Statements

```javascript
// Before (Axios)
import axios from 'axios';

// After (FluxHTTP)
import fluxhttp from '@fluxhttp/core';
```

## Basic API Changes

### Default Import Usage

```javascript
// Before (Axios)
import axios from 'axios';

const response = await axios.get('https://api.example.com/data');
const result = await axios.post('/users', userData);

// After (FluxHTTP) - Identical!
import fluxhttp from '@fluxhttp/core';

const response = await fluxhttp.get('https://api.example.com/data');
const result = await fluxhttp.post('/users', userData);
```

### Named Import Pattern

```javascript
// Before (Axios)
import axios, { AxiosResponse, AxiosError } from 'axios';

// After (FluxHTTP)
import fluxhttp, { fluxhttpResponse, fluxhttpError } from '@fluxhttp/core';
```

### Instance Creation

```javascript
// Before (Axios)
import axios from 'axios';

const apiClient = axios.create({
  baseURL: 'https://api.example.com',
  timeout: 10000,
  headers: {
    'Authorization': 'Bearer token'
  }
});

// After (FluxHTTP) - Identical!
import { create } from '@fluxhttp/core';

const apiClient = create({
  baseURL: 'https://api.example.com',
  timeout: 10000,
  headers: {
    'Authorization': 'Bearer token'
  }
});
```

## Common Patterns Translation

### 1. Basic HTTP Requests

```javascript
// Before (Axios)
const response = await axios.get('/users');
const user = await axios.get('/users/123');
const created = await axios.post('/users', { name: 'John' });
const updated = await axios.put('/users/123', { name: 'Jane' });
const deleted = await axios.delete('/users/123');

// After (FluxHTTP) - Identical!
const response = await fluxhttp.get('/users');
const user = await fluxhttp.get('/users/123');
const created = await fluxhttp.post('/users', { name: 'John' });
const updated = await fluxhttp.put('/users/123', { name: 'Jane' });
const deleted = await fluxhttp.delete('/users/123');
```

### 2. Request Configuration

```javascript
// Before (Axios)
const response = await axios.get('/users', {
  params: { page: 1, limit: 10 },
  headers: { 'Accept': 'application/json' },
  timeout: 5000
});

// After (FluxHTTP) - Identical!
const response = await fluxhttp.get('/users', {
  params: { page: 1, limit: 10 },
  headers: { 'Accept': 'application/json' },
  timeout: 5000
});
```

### 3. Error Handling

```javascript
// Before (Axios)
import axios from 'axios';

try {
  const response = await axios.get('/users');
} catch (error) {
  if (axios.isAxiosError(error)) {
    console.log('Status:', error.response?.status);
    console.log('Data:', error.response?.data);
  }
}

// After (FluxHTTP)
import fluxhttp from '@fluxhttp/core';

try {
  const response = await fluxhttp.get('/users');
} catch (error) {
  if (fluxhttp.isfluxhttpError(error)) {
    console.log('Status:', error.response?.status);
    console.log('Data:', error.response?.data);
  }
}
```

### 4. Interceptors

```javascript
// Before (Axios)
// Request interceptor
axios.interceptors.request.use(
  config => {
    config.headers.Authorization = `Bearer ${getToken()}`;
    return config;
  },
  error => Promise.reject(error)
);

// Response interceptor
axios.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401) {
      redirectToLogin();
    }
    return Promise.reject(error);
  }
);

// After (FluxHTTP) - Identical!
// Request interceptor
fluxhttp.interceptors.request.use(
  config => {
    config.headers.Authorization = `Bearer ${getToken()}`;
    return config;
  },
  error => Promise.reject(error)
);

// Response interceptor
fluxhttp.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401) {
      redirectToLogin();
    }
    return Promise.reject(error);
  }
);
```

### 5. Request Cancellation

```javascript
// Before (Axios)
import axios from 'axios';

const source = axios.CancelToken.source();

const request = axios.get('/users', {
  cancelToken: source.token
});

source.cancel('Operation cancelled');

try {
  await request;
} catch (error) {
  if (axios.isCancel(error)) {
    console.log('Request cancelled');
  }
}

// After (FluxHTTP) - Very similar!
import fluxhttp, { CancelToken } from '@fluxhttp/core';

const source = CancelToken.source();

const request = fluxhttp.get('/users', {
  cancelToken: source.token
});

source.cancel('Operation cancelled');

try {
  await request;
} catch (error) {
  if (fluxhttp.isCancel(error)) {
    console.log('Request cancelled');
  }
}
```

## Advanced Features Migration

### 1. Default Configuration

```javascript
// Before (Axios)
axios.defaults.baseURL = 'https://api.example.com';
axios.defaults.headers.common['Authorization'] = 'Bearer token';
axios.defaults.timeout = 10000;

// After (FluxHTTP) - Same pattern!
fluxhttp.defaults.baseURL = 'https://api.example.com';
fluxhttp.defaults.headers.common['Authorization'] = 'Bearer token';
fluxhttp.defaults.timeout = 10000;
```

### 2. Concurrent Requests

```javascript
// Before (Axios)
import axios from 'axios';

const responses = await axios.all([
  axios.get('/users'),
  axios.get('/posts'),
  axios.get('/comments')
]);

// After (FluxHTTP)
import fluxhttp from '@fluxhttp/core';

const responses = await fluxhttp.all([
  fluxhttp.get('/users'),
  fluxhttp.get('/posts'),
  fluxhttp.get('/comments')
]);

// Or use native Promise.all (recommended)
const responses = await Promise.all([
  fluxhttp.get('/users'),
  fluxhttp.get('/posts'),
  fluxhttp.get('/comments')
]);
```

### 3. Form Data and File Uploads

```javascript
// Before (Axios)
const formData = new FormData();
formData.append('file', fileInput.files[0]);
formData.append('description', 'My file');

const response = await axios.post('/upload', formData, {
  headers: {
    'Content-Type': 'multipart/form-data'
  }
});

// After (FluxHTTP) - Identical!
const formData = new FormData();
formData.append('file', fileInput.files[0]);
formData.append('description', 'My file');

const response = await fluxhttp.post('/upload', formData, {
  headers: {
    'Content-Type': 'multipart/form-data'
  }
});
```

### 4. Response Transformation

```javascript
// Before (Axios)
const apiClient = axios.create({
  transformResponse: [
    (data) => {
      if (typeof data === 'string') {
        try {
          return JSON.parse(data);
        } catch (e) {
          return data;
        }
      }
      return data;
    }
  ]
});

// After (FluxHTTP) - Use interceptors instead
const apiClient = create();

apiClient.interceptors.response.use(
  response => {
    if (typeof response.data === 'string') {
      try {
        response.data = JSON.parse(response.data);
      } catch (e) {
        // Keep as string if not valid JSON
      }
    }
    return response;
  }
);
```

## Breaking Changes

### 1. Configuration Options

Some less common configuration options have been simplified or removed:

```javascript
// These Axios options are NOT supported in FluxHTTP:
const config = {
  transformRequest: [...],    // Use request interceptors instead
  transformResponse: [...],   // Use response interceptors instead
  adapter: customAdapter,     // Different adapter system
  auth: { username, password }, // Use Authorization header instead
  responseType: 'arraybuffer', // Limited response type support
  validateStatus: (status) => status < 300, // Use response interceptors
  maxRedirects: 5,           // Handled automatically
  socketPath: '/socket',     // Not supported
  httpAgent: agent,          // Different agent configuration
  httpsAgent: agent,         // Different agent configuration
  proxy: {...},              // Different proxy configuration
  decompress: true           // Handled automatically
};
```

### 2. Response Object Differences

```javascript
// Axios response object
{
  data: {...},
  status: 200,
  statusText: 'OK',
  headers: {...},
  config: {...},
  request: XMLHttpRequest // Browser specific
}

// FluxHTTP response object (similar but streamlined)
{
  data: {...},
  status: 200,
  statusText: 'OK',
  headers: {...},
  config: {...}
  // No 'request' property
}
```

### 3. Error Object Differences

```javascript
// Axios error properties
error.isAxiosError     // Boolean flag
error.config          // Request configuration
error.request         // Request object
error.response        // Response object (if available)
error.toJSON()        // Method to serialize error

// FluxHTTP error properties (similar)
fluxhttp.isfluxhttpError(error) // Function to check
error.config          // Request configuration
error.request         // Request object
error.response        // Response object (if available)
// No toJSON method
```

## Migration Examples

### Example 1: Complete API Client Migration

```javascript
// Before (Axios)
import axios from 'axios';

class ApiClient {
  constructor(baseURL, token) {
    this.client = axios.create({
      baseURL,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    this.client.interceptors.request.use(config => {
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });

    this.client.interceptors.response.use(
      response => response,
      error => {
        if (error.response?.status === 401) {
          this.handleUnauthorized();
        }
        return Promise.reject(error);
      }
    );
  }

  async getUsers() {
    const response = await this.client.get('/users');
    return response.data;
  }

  async createUser(userData) {
    const response = await this.client.post('/users', userData);
    return response.data;
  }

  handleUnauthorized() {
    window.location.href = '/login';
  }
}

// After (FluxHTTP) - Almost identical!
import { create } from '@fluxhttp/core';

class ApiClient {
  constructor(baseURL, token) {
    this.client = create({
      baseURL,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    this.client.interceptors.request.use(config => {
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });

    this.client.interceptors.response.use(
      response => response,
      error => {
        if (error.response?.status === 401) {
          this.handleUnauthorized();
        }
        return Promise.reject(error);
      }
    );
  }

  async getUsers() {
    const response = await this.client.get('/users');
    return response.data;
  }

  async createUser(userData) {
    const response = await this.client.post('/users', userData);
    return response.data;
  }

  handleUnauthorized() {
    window.location.href = '/login';
  }
}
```

### Example 2: Testing Migration

```javascript
// Before (Axios with axios-mock-adapter)
import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';

const mock = new MockAdapter(axios);
mock.onGet('/users').reply(200, [{ id: 1, name: 'John' }]);

// After (FluxHTTP with built-in mock support)
import { create } from '@fluxhttp/core';

// Create a simple mock adapter
const mockAdapter = {
  async request(config) {
    if (config.method === 'GET' && config.url === '/users') {
      return {
        data: [{ id: 1, name: 'John' }],
        status: 200,
        statusText: 'OK',
        headers: {},
        config
      };
    }
    throw new Error('Mock not found');
  }
};

const client = create({
  adapter: mockAdapter.request
});
```

### Example 3: TypeScript Migration

```typescript
// Before (Axios with TypeScript)
import axios, { AxiosResponse, AxiosError } from 'axios';

interface User {
  id: number;
  name: string;
  email: string;
}

async function getUser(id: number): Promise<User> {
  try {
    const response: AxiosResponse<User> = await axios.get(`/users/${id}`);
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(`Failed to get user: ${error.message}`);
    }
    throw error;
  }
}

// After (FluxHTTP with TypeScript)
import fluxhttp, { fluxhttpResponse, fluxhttpError } from '@fluxhttp/core';

interface User {
  id: number;
  name: string;
  email: string;
}

async function getUser(id: number): Promise<User> {
  try {
    const response: fluxhttpResponse<User> = await fluxhttp.get(`/users/${id}`);
    return response.data;
  } catch (error) {
    if (fluxhttp.isfluxhttpError(error)) {
      throw new Error(`Failed to get user: ${error.message}`);
    }
    throw error;
  }
}
```

## Troubleshooting

### Common Issues and Solutions

#### 1. Import Errors

**Problem**: `Cannot find module '@fluxhttp/core'`

**Solution**: 
```bash
npm install @fluxhttp/core
```

#### 2. Type Errors in TypeScript

**Problem**: Type errors when migrating from Axios types

**Solution**: Update type imports and ensure proper generic typing:
```typescript
// Update imports
import fluxhttp, { fluxhttpResponse, fluxhttpError } from '@fluxhttp/core';

// Update type annotations
const response: fluxhttpResponse<MyDataType> = await fluxhttp.get('/api/data');
```

#### 3. Unsupported Configuration Options

**Problem**: Some Axios configuration options don't work

**Solution**: Replace with FluxHTTP equivalents:
- `transformRequest/transformResponse` → Use interceptors
- `auth` → Use Authorization header
- `validateStatus` → Use response interceptors

#### 4. Different Error Handling

**Problem**: Error checking function has changed name

**Solution**: 
```javascript
// Before
if (axios.isAxiosError(error)) { ... }

// After
if (fluxhttp.isfluxhttpError(error)) { ... }
```

#### 5. Bundle Size Issues

**Problem**: Bundle analyzer showing multiple HTTP client libraries

**Solution**: Ensure Axios is completely removed:
```bash
npm uninstall axios
npm ls axios  # Should show no results
```

### Migration Checklist

- [ ] Remove Axios from dependencies
- [ ] Install FluxHTTP
- [ ] Update import statements
- [ ] Replace `axios` with `fluxhttp` in code
- [ ] Update error checking functions
- [ ] Replace unsupported configuration options
- [ ] Update TypeScript types if using TypeScript
- [ ] Test all HTTP requests work correctly
- [ ] Test error handling still works
- [ ] Test interceptors still work
- [ ] Test request cancellation if used
- [ ] Update tests to use FluxHTTP
- [ ] Verify bundle size reduction

### Performance Comparison

| Metric | Axios | FluxHTTP | Improvement |
|--------|-------|----------|-------------|
| Bundle Size (min+gzip) | ~13KB | ~2.7KB | 79% smaller |
| Dependencies | 4+ | 0 | Zero deps |
| TypeScript Support | External types | Built-in | Native TS |
| Tree Shaking | Partial | Full | Better optimization |

## Need Help?

If you encounter issues during migration:

1. Check the [FluxHTTP Documentation](../README.md)
2. Review the [API Reference](./API.md)
3. Look at [Example Code](../examples/)
4. Create an issue on [GitHub Issues](https://github.com/fluxhttp/core/issues)

The migration should be straightforward for most applications, as FluxHTTP maintains API compatibility with the most commonly used Axios features while providing better performance and developer experience.