# fluxhttp Usage Guide

A comprehensive guide to using fluxhttp in your JavaScript/TypeScript applications. fluxhttp is a modern, zero-dependency HTTP client library with full TypeScript support and 298 comprehensive tests.

## Table of Contents

- [Installation](#installation)
- [Basic Usage](#basic-usage)
- [Configuration](#configuration)
- [Request Methods](#request-methods)
- [Request Config](#request-config)
- [Response Schema](#response-schema)
- [Error Handling](#error-handling)
- [Interceptors](#interceptors)
- [Request Cancellation](#request-cancellation)
- [Authentication](#authentication)
- [File Upload](#file-upload)
- [Progress Tracking](#progress-tracking)
- [TypeScript Usage](#typescript-usage)
- [Testing](#testing)
- [Best Practices](#best-practices)

## Installation

```bash
npm install @fluxhttp/core
# or
yarn add @fluxhttp/core
# or
pnpm add @fluxhttp/core
# or
bun add @fluxhttp/core
```

## Basic Usage

### Simple GET Request

```javascript
import fluxhttp from '@fluxhttp/core';

// Async/await
async function getUsers() {
  try {
    const response = await fluxhttp.get('https://api.example.com/users');
    console.log(response.data);
  } catch (error) {
    console.error('Error:', error);
  }
}

// Promise chains
fluxhttp.get('https://api.example.com/users')
  .then(response => console.log(response.data))
  .catch(error => console.error('Error:', error));
```

### POST Request with Data

```javascript
const userData = {
  name: 'John Doe',
  email: 'john@example.com',
  age: 30
};

const response = await fluxhttp.post('https://api.example.com/users', userData);
console.log('Created user:', response.data);
```

## Configuration

### Global Configuration

```javascript
import fluxhttp from '@fluxhttp/core';

// Set default config values
fluxhttp.defaults.baseURL = 'https://api.example.com';
fluxhttp.defaults.headers.common['Authorization'] = 'Bearer token123';
fluxhttp.defaults.timeout = 10000; // 10 seconds
```

### Creating an Instance

```javascript
const api = fluxhttp.create({
  baseURL: 'https://api.example.com',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
    'X-API-Version': '2.0'
  }
});

// Use the instance
const users = await api.get('/users');
```

### Multiple Instances for Different APIs

```javascript
// Main API
const mainAPI = fluxhttp.create({
  baseURL: 'https://api.example.com',
  headers: { 'Authorization': `Bearer ${mainToken}` }
});

// Analytics API
const analyticsAPI = fluxhttp.create({
  baseURL: 'https://analytics.example.com',
  headers: { 'X-Analytics-Key': analyticsKey }
});

// Auth API
const authAPI = fluxhttp.create({
  baseURL: 'https://auth.example.com',
  withCredentials: true
});
```

## Request Methods

fluxhttp supports all standard HTTP methods:

```javascript
// GET request
const getResponse = await fluxhttp.get('/users');

// POST request
const postResponse = await fluxhttp.post('/users', { name: 'John' });

// PUT request
const putResponse = await fluxhttp.put('/users/1', { name: 'Jane' });

// PATCH request
const patchResponse = await fluxhttp.patch('/users/1', { age: 31 });

// DELETE request
const deleteResponse = await fluxhttp.delete('/users/1');

// HEAD request
const headResponse = await fluxhttp.head('/users');

// OPTIONS request
const optionsResponse = await fluxhttp.options('/users');
```

## Request Config

### Complete Request Configuration

```javascript
const config = {
  // URL parameters
  url: '/users',
  method: 'get',
  baseURL: 'https://api.example.com',
  
  // Query parameters
  params: {
    page: 1,
    limit: 10,
    sort: 'name',
    filter: ['active', 'verified']
  },
  
  // Request headers
  headers: {
    'Content-Type': 'application/json',
    'X-Request-ID': '123456'
  },
  
  // Request body (for POST, PUT, PATCH)
  data: {
    name: 'John Doe',
    email: 'john@example.com'
  },
  
  // Timeout in milliseconds
  timeout: 10000,
  
  // Authentication
  auth: {
    username: 'user',
    password: 'pass'
  },
  
  // Response type
  responseType: 'json', // 'arraybuffer', 'blob', 'document', 'json', 'text', 'stream'
  
  // Progress callbacks
  onUploadProgress: (progressEvent) => {
    const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
    console.log(`Upload: ${percentCompleted}%`);
  },
  
  onDownloadProgress: (progressEvent) => {
    const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
    console.log(`Download: ${percentCompleted}%`);
  },
  
  // Abort signal
  signal: abortController.signal,
  
  // Custom validation
  validateStatus: (status) => {
    return status >= 200 && status < 300; // default
  }
};

const response = await fluxhttp(config);
```

### URL Parameters

```javascript
// Query string parameters
const response = await fluxhttp.get('/users', {
  params: {
    page: 2,
    limit: 20,
    sort: 'created_at',
    order: 'desc',
    filters: {
      status: 'active',
      role: ['admin', 'user']
    }
  }
});
// Results in: /users?page=2&limit=20&sort=created_at&order=desc&filters[status]=active&filters[role][]=admin&filters[role][]=user
```

### Request Headers

```javascript
// Per-request headers
const response = await fluxhttp.get('/users', {
  headers: {
    'Authorization': 'Bearer special-token',
    'Accept-Language': 'en-US',
    'X-Custom-Header': 'value'
  }
});

// Conditional headers
const config = {
  headers: {}
};

if (userToken) {
  config.headers['Authorization'] = `Bearer ${userToken}`;
}

if (sessionId) {
  config.headers['X-Session-ID'] = sessionId;
}

const response = await fluxhttp.get('/protected', config);
```

## Response Schema

All fluxhttp responses follow this structure:

```javascript
{
  // Response data from the server
  data: {},
  
  // HTTP status code
  status: 200,
  
  // HTTP status text
  statusText: 'OK',
  
  // Response headers
  headers: {},
  
  // Request configuration
  config: {},
  
  // Native request object (XMLHttpRequest in browser, ClientRequest in Node.js)
  request: {}
}
```

### Accessing Response Data

```javascript
const response = await fluxhttp.get('/users');

// Response data
console.log(response.data);

// Status code
console.log(response.status); // 200

// Check if successful
if (response.status >= 200 && response.status < 300) {
  console.log('Success!');
}

// Response headers
console.log(response.headers['content-type']);
console.log(response.headers['x-total-count']);

// Get all headers
const allHeaders = response.headers;
```

## Error Handling

### Basic Error Handling

```javascript
try {
  const response = await fluxhttp.get('/users');
  console.log(response.data);
} catch (error) {
  if (fluxhttp.isfluxhttpError(error)) {
    // fluxhttp error (request made, server responded)
    console.error('Response error:', error.response?.status);
    console.error('Response data:', error.response?.data);
    console.error('Request config:', error.config);
  } else if (error.request) {
    // Request made but no response received
    console.error('No response received:', error.request);
  } else {
    // Something else happened
    console.error('Error:', error.message);
  }
}
```

### Error Response Structure

```javascript
{
  // Error message
  message: 'Request failed with status code 404',
  
  // Error name
  name: 'fluxhttpError',
  
  // Error stack trace
  stack: '...',
  
  // Request config
  config: {
    url: '/users/999',
    method: 'get',
    // ...
  },
  
  // Error code
  code: 'ERR_BAD_REQUEST',
  
  // Request object
  request: XMLHttpRequest {},
  
  // Response object (if received)
  response: {
    data: { error: 'User not found' },
    status: 404,
    statusText: 'Not Found',
    headers: {},
    config: {}
  },
  
  // Type guard
  isfluxhttpError: true
}
```

### Common Error Codes

```javascript
// Network errors
'ERR_NETWORK' // Network error occurred
'ETIMEDOUT'   // Request timeout
'ERR_CANCELED' // Request was canceled

// HTTP errors
'ERR_BAD_REQUEST' // 4xx client errors
'ERR_SERVER'      // 5xx server errors

// Client errors
'ERR_INVALID_URL' // Invalid URL provided
'ERR_INVALID_ADAPTER' // Invalid adapter
```

### Custom Error Handling

```javascript
// Global error handler
const api = fluxhttp.create({
  baseURL: 'https://api.example.com'
});

api.interceptors.response.use(
  response => response,
  error => {
    if (error.response) {
      // Server responded with error status
      switch (error.response.status) {
        case 401:
          // Unauthorized - redirect to login
          window.location.href = '/login';
          break;
        case 403:
          // Forbidden
          console.error('Access denied');
          break;
        case 404:
          // Not found
          console.error('Resource not found');
          break;
        case 429:
          // Too many requests
          console.error('Rate limit exceeded');
          break;
        case 500:
          // Server error
          console.error('Server error');
          break;
      }
    }
    return Promise.reject(error);
  }
);
```

## Interceptors

### Request Interceptors

```javascript
// Add a request interceptor
const requestInterceptor = fluxhttp.interceptors.request.use(
  config => {
    // Do something before request is sent
    console.log('Starting request:', config.url);
    
    // Add timestamp
    config.headers['X-Request-Time'] = Date.now();
    
    // Add auth token
    const token = localStorage.getItem('authToken');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    
    return config;
  },
  error => {
    // Do something with request error
    console.error('Request error:', error);
    return Promise.reject(error);
  }
);

// Remove interceptor
fluxhttp.interceptors.request.eject(requestInterceptor);
```

### Response Interceptors

```javascript
// Add a response interceptor
const responseInterceptor = fluxhttp.interceptors.response.use(
  response => {
    // Any status code that lies within the range of 2xx causes this function to trigger
    console.log('Response received:', response.status);
    
    // Calculate request duration
    const requestTime = response.config.headers['X-Request-Time'];
    if (requestTime) {
      const duration = Date.now() - requestTime;
      console.log(`Request took ${duration}ms`);
    }
    
    // Transform response data
    if (response.data && response.data.wrapped) {
      response.data = response.data.data;
    }
    
    return response;
  },
  error => {
    // Any status codes that falls outside the range of 2xx causes this function to trigger
    if (error.response?.status === 401) {
      // Token expired - refresh it
      return refreshToken().then(newToken => {
        // Retry original request with new token
        error.config.headers['Authorization'] = `Bearer ${newToken}`;
        return fluxhttp(error.config);
      });
    }
    
    return Promise.reject(error);
  }
);
```

### Multiple Interceptors

```javascript
// Interceptors are executed in order
const api = fluxhttp.create();

// First interceptor - logging
api.interceptors.request.use(config => {
  console.log('1. Logging interceptor');
  return config;
});

// Second interceptor - authentication
api.interceptors.request.use(config => {
  console.log('2. Auth interceptor');
  config.headers['Authorization'] = 'Bearer token';
  return config;
});

// Third interceptor - timestamps
api.interceptors.request.use(config => {
  console.log('3. Timestamp interceptor');
  config.headers['X-Timestamp'] = Date.now();
  return config;
});

// Execution order: 1 -> 2 -> 3 -> request -> response
```

## Request Cancellation

### Using AbortController

```javascript
// Create controller
const controller = new AbortController();

// Make request with signal
fluxhttp.get('/large-file', {
  signal: controller.signal
})
.then(response => {
  console.log('Download complete:', response.data);
})
.catch(error => {
  if (fluxhttp.isCancel(error)) {
    console.log('Request canceled:', error.message);
  } else {
    console.error('Request failed:', error);
  }
});

// Cancel the request
setTimeout(() => {
  controller.abort();
}, 1000);
```

### Canceling Multiple Requests

```javascript
const controller = new AbortController();

// Start multiple requests with same signal
const requests = [
  fluxhttp.get('/api/data1', { signal: controller.signal }),
  fluxhttp.get('/api/data2', { signal: controller.signal }),
  fluxhttp.get('/api/data3', { signal: controller.signal })
];

// Cancel all requests
controller.abort();

// Handle results
Promise.allSettled(requests).then(results => {
  results.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      console.log(`Request ${index} succeeded:`, result.value.data);
    } else if (fluxhttp.isCancel(result.reason)) {
      console.log(`Request ${index} was canceled`);
    } else {
      console.error(`Request ${index} failed:`, result.reason);
    }
  });
});
```

### Timeout with Cancellation

```javascript
function fetchWithTimeout(url, timeout = 5000) {
  const controller = new AbortController();
  
  // Set timeout
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, timeout);
  
  return fluxhttp.get(url, { signal: controller.signal })
    .then(response => {
      clearTimeout(timeoutId);
      return response;
    })
    .catch(error => {
      clearTimeout(timeoutId);
      if (fluxhttp.isCancel(error)) {
        throw new Error(`Request timeout after ${timeout}ms`);
      }
      throw error;
    });
}

// Usage
try {
  const response = await fetchWithTimeout('/slow-endpoint', 3000);
  console.log(response.data);
} catch (error) {
  console.error('Request failed:', error.message);
}
```

## Authentication

### Basic Authentication

```javascript
const response = await fluxhttp.get('/protected', {
  auth: {
    username: 'user',
    password: 'password'
  }
});
```

### Bearer Token

```javascript
// Global token
fluxhttp.defaults.headers.common['Authorization'] = `Bearer ${token}`;

// Per-request token
const response = await fluxhttp.get('/protected', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
```

### OAuth 2.0 Flow

```javascript
class OAuth2Client {
  constructor(config) {
    this.clientId = config.clientId;
    this.clientSecret = config.clientSecret;
    this.tokenEndpoint = config.tokenEndpoint;
    this.api = fluxhttp.create({
      baseURL: config.apiBaseURL
    });
    
    // Add auth interceptor
    this.api.interceptors.request.use(async (config) => {
      const token = await this.getAccessToken();
      config.headers['Authorization'] = `Bearer ${token}`;
      return config;
    });
    
    // Add token refresh interceptor
    this.api.interceptors.response.use(
      response => response,
      async error => {
        if (error.response?.status === 401) {
          // Token expired, refresh it
          await this.refreshAccessToken();
          // Retry original request
          return this.api(error.config);
        }
        return Promise.reject(error);
      }
    );
  }
  
  async getAccessToken() {
    // Check if token exists and is valid
    if (this.accessToken && this.tokenExpiry > Date.now()) {
      return this.accessToken;
    }
    
    // Get new token
    await this.refreshAccessToken();
    return this.accessToken;
  }
  
  async refreshAccessToken() {
    const response = await fluxhttp.post(this.tokenEndpoint, {
      grant_type: 'client_credentials',
      client_id: this.clientId,
      client_secret: this.clientSecret
    });
    
    this.accessToken = response.data.access_token;
    this.tokenExpiry = Date.now() + (response.data.expires_in * 1000);
  }
  
  // API methods
  async getUser(userId) {
    return this.api.get(`/users/${userId}`);
  }
  
  async updateUser(userId, data) {
    return this.api.put(`/users/${userId}`, data);
  }
}

// Usage
const client = new OAuth2Client({
  clientId: 'your-client-id',
  clientSecret: 'your-client-secret',
  tokenEndpoint: 'https://auth.example.com/token',
  apiBaseURL: 'https://api.example.com'
});

const user = await client.getUser(123);
```

### API Key Authentication

```javascript
// As header
const response = await fluxhttp.get('/data', {
  headers: {
    'X-API-Key': 'your-api-key'
  }
});

// As query parameter
const response = await fluxhttp.get('/data', {
  params: {
    api_key: 'your-api-key'
  }
});
```

## File Upload

### Single File Upload

```javascript
const formData = new FormData();
formData.append('file', fileInput.files[0]);
formData.append('description', 'Profile photo');

const response = await fluxhttp.post('/upload', formData, {
  headers: {
    'Content-Type': 'multipart/form-data'
  },
  onUploadProgress: (progressEvent) => {
    const percentCompleted = Math.round(
      (progressEvent.loaded * 100) / progressEvent.total
    );
    console.log(`Upload Progress: ${percentCompleted}%`);
  }
});
```

### Multiple File Upload

```javascript
const formData = new FormData();

// Add multiple files
for (let i = 0; i < fileInput.files.length; i++) {
  formData.append('files[]', fileInput.files[i]);
}

// Add other data
formData.append('folder', 'images');
formData.append('tags', JSON.stringify(['vacation', 'summer']));

const response = await fluxhttp.post('/upload/multiple', formData, {
  onUploadProgress: (progressEvent) => {
    updateProgressBar(progressEvent.loaded, progressEvent.total);
  }
});
```

### Upload with Preview

```javascript
async function uploadWithPreview(file) {
  // Create preview
  const reader = new FileReader();
  reader.onload = (e) => {
    document.getElementById('preview').src = e.target.result;
  };
  reader.readAsDataURL(file);
  
  // Prepare upload
  const formData = new FormData();
  formData.append('image', file);
  
  try {
    const response = await fluxhttp.post('/upload/image', formData, {
      onUploadProgress: (progressEvent) => {
        const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        document.getElementById('progress').style.width = `${percent}%`;
        document.getElementById('progress-text').textContent = `${percent}%`;
      }
    });
    
    console.log('Upload successful:', response.data);
    return response.data.url;
  } catch (error) {
    console.error('Upload failed:', error);
    throw error;
  }
}
```

## Progress Tracking

### Download Progress

```javascript
async function downloadFile(url, filename) {
  const response = await fluxhttp.get(url, {
    responseType: 'blob',
    onDownloadProgress: (progressEvent) => {
      if (progressEvent.total) {
        const percentCompleted = Math.round(
          (progressEvent.loaded * 100) / progressEvent.total
        );
        console.log(`Download: ${percentCompleted}%`);
        
        // Update UI
        updateProgressBar(percentCompleted);
        updateDownloadSpeed(progressEvent.loaded, progressEvent.total);
      }
    }
  });
  
  // Create download link
  const url = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}
```

### Combined Upload/Download Progress

```javascript
class FileTransferManager {
  constructor() {
    this.transfers = new Map();
  }
  
  async uploadFile(id, file, url) {
    const formData = new FormData();
    formData.append('file', file);
    
    this.transfers.set(id, {
      type: 'upload',
      progress: 0,
      loaded: 0,
      total: file.size,
      speed: 0,
      startTime: Date.now()
    });
    
    try {
      const response = await fluxhttp.post(url, formData, {
        onUploadProgress: (progressEvent) => {
          this.updateProgress(id, progressEvent);
        }
      });
      
      this.transfers.delete(id);
      return response.data;
    } catch (error) {
      this.transfers.delete(id);
      throw error;
    }
  }
  
  async downloadFile(id, url) {
    this.transfers.set(id, {
      type: 'download',
      progress: 0,
      loaded: 0,
      total: 0,
      speed: 0,
      startTime: Date.now()
    });
    
    try {
      const response = await fluxhttp.get(url, {
        responseType: 'blob',
        onDownloadProgress: (progressEvent) => {
          this.updateProgress(id, progressEvent);
        }
      });
      
      this.transfers.delete(id);
      return response.data;
    } catch (error) {
      this.transfers.delete(id);
      throw error;
    }
  }
  
  updateProgress(id, progressEvent) {
    const transfer = this.transfers.get(id);
    if (!transfer) return;
    
    const currentTime = Date.now();
    const elapsedTime = (currentTime - transfer.startTime) / 1000; // seconds
    
    transfer.loaded = progressEvent.loaded;
    transfer.total = progressEvent.total || 0;
    transfer.progress = transfer.total > 0 
      ? Math.round((progressEvent.loaded * 100) / transfer.total)
      : 0;
    transfer.speed = elapsedTime > 0 
      ? progressEvent.loaded / elapsedTime // bytes per second
      : 0;
    
    // Emit progress event
    this.onProgress?.(id, transfer);
  }
  
  getTransferInfo(id) {
    return this.transfers.get(id);
  }
  
  cancelTransfer(id) {
    // Implementation depends on how you store abort controllers
    this.transfers.delete(id);
  }
}

// Usage
const transferManager = new FileTransferManager();

transferManager.onProgress = (id, transfer) => {
  console.log(`${transfer.type} ${id}: ${transfer.progress}% (${formatBytes(transfer.speed)}/s)`);
};

// Upload
await transferManager.uploadFile('upload-1', file, '/api/upload');

// Download  
const blob = await transferManager.downloadFile('download-1', '/api/files/123');
```

## TypeScript Usage

### Basic Types

```typescript
import fluxhttp, { 
  fluxhttpResponse, 
  fluxhttpError,
  fluxhttpRequestConfig 
} from 'fluxhttp';

interface User {
  id: number;
  name: string;
  email: string;
  createdAt: string;
}

interface CreateUserDto {
  name: string;
  email: string;
  password: string;
}

interface ApiResponse<T> {
  data: T;
  message: string;
  timestamp: number;
}

// Typed requests
async function getUser(id: number): Promise<User> {
  const response = await fluxhttp.get<User>(`/users/${id}`);
  return response.data;
}

async function createUser(userData: CreateUserDto): Promise<User> {
  const response = await fluxhttp.post<User>('/users', userData);
  return response.data;
}

// With wrapper types
async function getUsersWrapped(): Promise<User[]> {
  const response = await fluxhttp.get<ApiResponse<User[]>>('/users');
  return response.data.data;
}
```

### Custom Instance Types

```typescript
interface CustomConfig extends fluxhttpRequestConfig {
  retry?: number;
  retryDelay?: number;
}

const createAPIClient = (baseURL: string) => {
  const instance = fluxhttp.create({
    baseURL,
    timeout: 10000
  });
  
  // Add retry logic
  instance.interceptors.response.use(
    response => response,
    async error => {
      const config = error.config as CustomConfig;
      
      if (!config.retry) config.retry = 0;
      if (config.retry >= 3) {
        return Promise.reject(error);
      }
      
      config.retry++;
      
      // Wait before retry
      await new Promise(resolve => 
        setTimeout(resolve, config.retryDelay || 1000)
      );
      
      return instance(config);
    }
  );
  
  return instance;
};
```

### Generic API Client

```typescript
class APIClient<T extends Record<string, any>> {
  private client: fluxhttpInstance;
  private resourcePath: string;
  
  constructor(baseURL: string, resourcePath: string) {
    this.resourcePath = resourcePath;
    this.client = fluxhttp.create({ baseURL });
  }
  
  async getAll(params?: Record<string, any>): Promise<T[]> {
    const response = await this.client.get<T[]>(this.resourcePath, { params });
    return response.data;
  }
  
  async getById(id: string | number): Promise<T> {
    const response = await this.client.get<T>(`${this.resourcePath}/${id}`);
    return response.data;
  }
  
  async create(data: Omit<T, 'id'>): Promise<T> {
    const response = await this.client.post<T>(this.resourcePath, data);
    return response.data;
  }
  
  async update(id: string | number, data: Partial<T>): Promise<T> {
    const response = await this.client.put<T>(`${this.resourcePath}/${id}`, data);
    return response.data;
  }
  
  async delete(id: string | number): Promise<void> {
    await this.client.delete(`${this.resourcePath}/${id}`);
  }
}

// Usage
interface Product {
  id: number;
  name: string;
  price: number;
  description: string;
}

const productAPI = new APIClient<Product>('https://api.example.com', '/products');

const products = await productAPI.getAll({ category: 'electronics' });
const product = await productAPI.getById(123);
const newProduct = await productAPI.create({
  name: 'New Product',
  price: 99.99,
  description: 'Description'
});
```

### Error Handling with Types

```typescript
class APIError extends Error {
  constructor(
    message: string,
    public status?: number,
    public code?: string,
    public details?: any
  ) {
    super(message);
    this.name = 'APIError';
  }
}

async function handleAPICall<T>(
  request: Promise<fluxhttpResponse<T>>
): Promise<T> {
  try {
    const response = await request;
    return response.data;
  } catch (error) {
    if (fluxhttp.isfluxhttpError(error)) {
      const { response } = error;
      
      throw new APIError(
        response?.data?.message || error.message,
        response?.status,
        response?.data?.code,
        response?.data?.details
      );
    }
    
    throw new APIError('Network error', undefined, 'NETWORK_ERROR');
  }
}

// Usage
try {
  const user = await handleAPICall(
    fluxhttp.get<User>('/users/123')
  );
} catch (error) {
  if (error instanceof APIError) {
    console.error(`API Error (${error.status}): ${error.message}`);
    if (error.details) {
      console.error('Details:', error.details);
    }
  }
}
```

## Testing

### Mocking fluxhttp

```javascript
// __mocks__/fluxhttp.js
const fluxhttp = {
  get: jest.fn(() => Promise.resolve({ data: {} })),
  post: jest.fn(() => Promise.resolve({ data: {} })),
  put: jest.fn(() => Promise.resolve({ data: {} })),
  delete: jest.fn(() => Promise.resolve({ data: {} })),
  create: jest.fn(() => fluxhttp),
  interceptors: {
    request: { use: jest.fn() },
    response: { use: jest.fn() }
  },
  defaults: {
    headers: {
      common: {}
    }
  }
};

export default fluxhttp;
```

### Testing with Mock Adapter

```javascript
import fluxhttp from 'fluxhttp';
import MockAdapter from 'fluxhttp-mock-adapter';

describe('UserService', () => {
  let mock;
  
  beforeEach(() => {
    mock = new MockAdapter(fluxhttp);
  });
  
  afterEach(() => {
    mock.restore();
  });
  
  test('should fetch users', async () => {
    const users = [
      { id: 1, name: 'John' },
      { id: 2, name: 'Jane' }
    ];
    
    mock.onGet('/users').reply(200, users);
    
    const response = await fluxhttp.get('/users');
    expect(response.data).toEqual(users);
  });
  
  test('should handle errors', async () => {
    mock.onGet('/users/999').reply(404, {
      message: 'User not found'
    });
    
    await expect(fluxhttp.get('/users/999')).rejects.toThrow();
  });
});
```

### Integration Testing

```javascript
import { createServer } from 'http';
import fluxhttp from 'fluxhttp';

describe('API Integration Tests', () => {
  let server;
  let baseURL;
  
  beforeAll((done) => {
    server = createServer((req, res) => {
      if (req.url === '/users' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify([
          { id: 1, name: 'John' },
          { id: 2, name: 'Jane' }
        ]));
      } else {
        res.writeHead(404);
        res.end();
      }
    });
    
    server.listen(() => {
      const port = server.address().port;
      baseURL = `http://localhost:${port}`;
      done();
    });
  });
  
  afterAll((done) => {
    server.close(done);
  });
  
  test('should fetch users from real server', async () => {
    const response = await fluxhttp.get(`${baseURL}/users`);
    expect(response.status).toBe(200);
    expect(response.data).toHaveLength(2);
  });
});
```

## Best Practices

### 1. Always Handle Errors

```javascript
// ❌ Bad
const data = await fluxhttp.get('/api/data');
console.log(data);

// ✅ Good
try {
  const { data } = await fluxhttp.get('/api/data');
  console.log(data);
} catch (error) {
  if (fluxhttp.isfluxhttpError(error)) {
    // Handle HTTP errors
    console.error('Request failed:', error.response?.status);
  } else {
    // Handle other errors
    console.error('Unexpected error:', error);
  }
}
```

### 2. Use Request/Response Interceptors Wisely

```javascript
// ✅ Good - Centralized error handling
api.interceptors.response.use(
  response => response,
  error => {
    logError(error);
    showErrorNotification(error);
    return Promise.reject(error);
  }
);

// ❌ Bad - Modifying original error
api.interceptors.response.use(
  response => response,
  error => {
    error.message = 'Something went wrong'; // Don't modify original error
    return Promise.reject(error);
  }
);
```

### 3. Set Appropriate Timeouts

```javascript
// ✅ Good - Reasonable timeout
const api = fluxhttp.create({
  timeout: 10000 // 10 seconds
});

// ✅ Better - Different timeouts for different operations
const quickAPI = fluxhttp.create({
  timeout: 5000 // 5 seconds for quick operations
});

const uploadAPI = fluxhttp.create({
  timeout: 300000 // 5 minutes for file uploads
});
```

### 4. Use Abort Controllers for Cleanup

```javascript
// ✅ Good - Cleanup on component unmount
function SearchComponent() {
  useEffect(() => {
    const controller = new AbortController();
    
    async function search() {
      try {
        const response = await fluxhttp.get('/search', {
          params: { q: searchTerm },
          signal: controller.signal
        });
        setResults(response.data);
      } catch (error) {
        if (!fluxhttp.isCancel(error)) {
          setError(error);
        }
      }
    }
    
    search();
    
    return () => {
      controller.abort();
    };
  }, [searchTerm]);
}
```

### 5. Avoid Storing Sensitive Data in URLs

```javascript
// ❌ Bad - Password in URL
await fluxhttp.get(`/login?username=user&password=${password}`);

// ✅ Good - Sensitive data in request body
await fluxhttp.post('/login', {
  username: 'user',
  password: password
});
```

### 6. Use Environment-Specific Configurations

```javascript
// config/api.js
const API_CONFIGS = {
  development: {
    baseURL: 'http://localhost:3000/api',
    timeout: 10000
  },
  staging: {
    baseURL: 'https://staging-api.example.com',
    timeout: 15000
  },
  production: {
    baseURL: 'https://api.example.com',
    timeout: 10000
  }
};

const config = API_CONFIGS[process.env.NODE_ENV] || API_CONFIGS.development;

export const api = fluxhttp.create(config);
```

### 7. Implement Retry Logic for Resilience

```javascript
async function fetchWithRetry(url, options = {}, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fluxhttp.get(url, options);
      return response;
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      
      // Only retry on network errors or 5xx errors
      if (
        error.code === 'ERR_NETWORK' || 
        (error.response && error.response.status >= 500)
      ) {
        // Exponential backoff
        const delay = Math.min(1000 * Math.pow(2, i), 10000);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        throw error;
      }
    }
  }
}
```

### 8. Use Request Deduplication

```javascript
class RequestDeduplicator {
  constructor() {
    this.pending = new Map();
  }
  
  async request(key, requestFn) {
    // Check if request is already pending
    if (this.pending.has(key)) {
      return this.pending.get(key);
    }
    
    // Create new request
    const promise = requestFn()
      .finally(() => {
        this.pending.delete(key);
      });
    
    this.pending.set(key, promise);
    return promise;
  }
}

const deduplicator = new RequestDeduplicator();

// Multiple components requesting same data
async function fetchUserData(userId) {
  return deduplicator.request(
    `user-${userId}`,
    () => fluxhttp.get(`/users/${userId}`)
  );
}
```

## Advanced Patterns

### Request Queue

```javascript
class RequestQueue {
  constructor(maxConcurrent = 5) {
    this.maxConcurrent = maxConcurrent;
    this.running = 0;
    this.queue = [];
  }
  
  async add(requestFn) {
    if (this.running >= this.maxConcurrent) {
      await new Promise(resolve => this.queue.push(resolve));
    }
    
    this.running++;
    
    try {
      const result = await requestFn();
      return result;
    } finally {
      this.running--;
      
      if (this.queue.length > 0) {
        const resolve = this.queue.shift();
        resolve();
      }
    }
  }
}

const queue = new RequestQueue(3);

// Queue multiple requests
const requests = urls.map(url => 
  queue.add(() => fluxhttp.get(url))
);

const results = await Promise.all(requests);
```

### Response Caching

```javascript
class CachedAPI {
  constructor(ttl = 60000) { // 1 minute default
    this.cache = new Map();
    this.ttl = ttl;
  }
  
  async get(url, config = {}) {
    const key = this.getCacheKey(url, config);
    const cached = this.cache.get(key);
    
    if (cached && Date.now() - cached.timestamp < this.ttl) {
      return cached.data;
    }
    
    const response = await fluxhttp.get(url, config);
    
    this.cache.set(key, {
      data: response,
      timestamp: Date.now()
    });
    
    return response;
  }
  
  getCacheKey(url, config) {
    return `${url}:${JSON.stringify(config.params || {})}`;
  }
  
  invalidate(url, config = {}) {
    const key = this.getCacheKey(url, config);
    this.cache.delete(key);
  }
  
  invalidateAll() {
    this.cache.clear();
  }
}
```

### GraphQL Support

```javascript
class GraphQLClient {
  constructor(endpoint, options = {}) {
    this.client = fluxhttp.create({
      baseURL: endpoint,
      ...options
    });
  }
  
  async query(query, variables = {}) {
    const response = await this.client.post('', {
      query,
      variables
    });
    
    if (response.data.errors) {
      throw new Error(response.data.errors[0].message);
    }
    
    return response.data.data;
  }
  
  async mutation(mutation, variables = {}) {
    return this.query(mutation, variables);
  }
}

// Usage
const graphql = new GraphQLClient('https://api.example.com/graphql');

const GET_USER = `
  query GetUser($id: ID!) {
    user(id: $id) {
      id
      name
      email
    }
  }
`;

const user = await graphql.query(GET_USER, { id: '123' });
```

---

This comprehensive guide covers all major aspects of using fluxhttp. For more specific use cases or advanced scenarios, please refer to the [API documentation](./docs/API.md), [examples](./examples) directory, or the [migration guide](./docs/API.md#migration-from-axios) if you're coming from Axios.