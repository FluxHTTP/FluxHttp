# @fluxhttp/core  

[![npm version](https://img.shields.io/npm/v/@fluxhttp/core.svg)](https://www.npmjs.com/package/@fluxhttp/core)
[![npm downloads](https://img.shields.io/npm/dm/@fluxhttp/core.svg)](https://www.npmjs.com/package/@fluxhttp/core)
[![bundle size](https://img.shields.io/badge/bundle%20size-1.2KB%20gzipped-brightgreen)](https://bundlephobia.com/package/@fluxhttp/core)

[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Zero Dependencies](https://img.shields.io/badge/Dependencies-0-brightgreen)](./package.json)
[![Node.js](https://img.shields.io/badge/Node.js-16%2B-green)](https://nodejs.org/)

<div align="center">
  
  **@fluxhttp/core** is a modern, lightweight HTTP client for JavaScript/TypeScript with zero dependencies, full TypeScript support, and universal compatibility.
  
  [Quick Start](#-quick-start) • [API Reference](./docs/API.md) • [Examples](./examples) • [Migration Guide](./docs/migration-from-axios.md)
</div>

---

## 🌟 Why @fluxhttp/core?

**FluxHTTP is a powerful, lightweight HTTP client designed for modern applications**:

✨ **Key Advantages**:
- **🎯 Zero Dependencies**: No third-party packages, reducing security vulnerabilities
- **📦 Ultra-Light**: Only 1.2KB gzipped (minimal build) - 95% smaller than Axios
- **🔒 Type-Safe**: Full TypeScript support with comprehensive type definitions
- **🌐 Universal**: Works in Node.js, browsers, and edge runtimes
- **⚡ High Performance**: Built-in caching, retry logic, and request deduplication
- **🛡️ Security First**: CSRF protection, rate limiting, and content validation
- **🔄 Axios Compatible**: Easy migration with familiar API

**Production Ready Features**:
- All HTTP methods (GET, POST, PUT, DELETE, PATCH, HEAD, OPTIONS)
- Request/Response interceptors
- Advanced retry logic with exponential backoff
- Request cancellation (AbortController + CancelToken)
- Response caching with TTL
- Request deduplication
- Security features (CSRF, rate limiting, validation)
- Mock adapter for testing

## 📋 Table of Contents

- [🌟 Why @fluxhttp/core?](#-why-fluxhttpcore)
- [🚀 Quick Start](#-quick-start)
- [📦 Installation](#-installation)
- [🎯 Basic Usage](#-basic-usage)
- [🔧 Advanced Usage](#-advanced-usage)
- [💎 Features](#-features)
- [🎨 TypeScript](#-typescript)
- [🔄 Migration from Axios](#-migration-from-axios)
- [📚 Documentation](#-documentation)
- [⚡ Performance](#-performance)
- [🌐 Browser Support](#-browser-support)
- [🤝 Contributing](#-contributing)

## 🚀 Quick Start

```bash
npm install @fluxhttp/core
```

```typescript
import fluxhttp from '@fluxhttp/core';

// Make a GET request
const response = await fluxhttp.get('https://api.example.com/users');
console.log(response.data);

// POST with automatic JSON serialization
const newUser = await fluxhttp.post('https://api.example.com/users', {
  name: 'John Doe',
  email: 'john@example.com'
});

// Create a configured instance
const api = fluxhttp.create({
  baseURL: 'https://api.example.com',
  headers: { 'Authorization': 'Bearer your-token' }
});

const users = await api.get('/users');
```

That's it! FluxHTTP works out of the box with sensible defaults and provides a familiar, Axios-compatible API.

## 💎 Features

### 🏆 Production Ready
- ✅ **All HTTP Methods**: GET, POST, PUT, DELETE, PATCH, HEAD, OPTIONS with full TypeScript support
- ✅ **Request/Response Interceptors**: Transform requests and responses with async support
- ✅ **Advanced Error Handling**: Comprehensive error information and type-safe error checking
- ✅ **Smart Retry Logic**: Exponential backoff, jitter, and customizable retry conditions
- ✅ **Request Cancellation**: Both modern AbortController and legacy CancelToken support
- ✅ **Response Caching**: Memory/localStorage caching with TTL and custom key generation
- ✅ **Request Deduplication**: Prevent duplicate requests automatically
- ✅ **Security Features**: CSRF protection, rate limiting, and content validation
- ✅ **Mock Adapter**: Full testing support with stateful mocks and network simulation

### 🔧 Developer Experience
- ✅ **TypeScript First**: Complete type definitions with generics and utility types
- ✅ **Automatic JSON**: Smart JSON parsing/stringification based on content type
- ✅ **Progress Tracking**: Upload/download progress events
- ✅ **Timeout Management**: Global, instance, and request-level timeout configuration
- ✅ **Flexible Configuration**: Hierarchical config system (global → instance → request)
- ✅ **Universal Compatibility**: Works in Node.js, browsers, and edge runtimes
- ✅ **Zero Dependencies**: No external packages or security vulnerabilities

## 📦 Installation

```bash
# npm
npm install @fluxhttp/core

# yarn
yarn add @fluxhttp/core

# pnpm
pnpm add @fluxhttp/core

# bun
bun add @fluxhttp/core
```

## 🎯 Basic Usage

```typescript
import fluxhttp from '@fluxhttp/core';

// GET request with query parameters
const { data } = await fluxhttp.get('https://api.example.com/users', {
  params: { page: 1, limit: 10 }
});

// POST request with automatic JSON serialization
const newUser = await fluxhttp.post('https://api.example.com/users', {
  name: 'John Doe',
  email: 'john@example.com'
});

// PUT request with custom headers
await fluxhttp.put(`/users/${userId}`, 
  { name: 'Jane Doe' },
  { headers: { 'If-Match': '"etag-value"' } }
);

// DELETE request
await fluxhttp.delete(`/users/${userId}`);

// File upload with progress tracking
const formData = new FormData();
formData.append('file', file);

await fluxhttp.post('/upload', formData, {
  headers: { 'Content-Type': 'multipart/form-data' },
  onUploadProgress: (progressEvent) => {
    const progress = (progressEvent.loaded / progressEvent.total) * 100;
    console.log(`Upload progress: ${progress}%`);
  }
});
```

[📖 See all examples →](./examples/README.md)

## 🔧 Advanced Usage

### Creating Custom Instances

```typescript
import { create } from '@fluxhttp/core';

const api = create({
  baseURL: 'https://api.example.com',
  timeout: 10000,
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  retry: {
    attempts: 3,
    delay: 1000,
    backoff: 'exponential'
  },
  cache: {
    enabled: true,
    ttl: 300000 // 5 minutes
  }
});
```

### Interceptors

```typescript
// Request interceptor with async operations
api.interceptors.request.use(async config => {
  // Refresh token if needed
  if (await isTokenExpired()) {
    config.headers.Authorization = `Bearer ${await refreshToken()}`;
  }
  
  // Add request timestamp
  config.headers['X-Request-Time'] = new Date().toISOString();
  return config;
});

// Response interceptor with error handling
api.interceptors.response.use(
  response => {
    // Transform response data
    if (response.data?.items) {
      response.data.items = response.data.items.map(item => ({
        ...item,
        createdAt: new Date(item.createdAt)
      }));
    }
    return response;
  },
  async error => {
    if (error.response?.status === 401) {
      await handleAuthError();
      // Retry request with new token
      return api.request(error.config);
    }
    return Promise.reject(error);
  }
);
```

### Request Cancellation

```typescript
import { CancelToken } from '@fluxhttp/core';

// Modern AbortController
const controller = new AbortController();
const request = fluxhttp.get('/data', { signal: controller.signal });
controller.abort(); // Cancel request

// Legacy CancelToken (Axios-compatible)
const source = CancelToken.source();
const request2 = fluxhttp.get('/data', { cancelToken: source.token });
source.cancel('Operation cancelled by user');

// Race condition handling
const fastestResponse = await Promise.race([
  fluxhttp.get('/api1/data'),
  fluxhttp.get('/api2/data'),
  fluxhttp.get('/api3/data')
]);
```

### Error Handling

```typescript
import { fluxhttpError } from '@fluxhttp/core';

try {
  const response = await api.get('/users');
} catch (error) {
  if (fluxhttp.isfluxhttpError(error)) {
    if (error.response) {
      // Server responded with error status
      console.log('Status:', error.response.status);
      console.log('Data:', error.response.data);
    } else if (error.request) {
      // Request made but no response received
      console.log('Network error:', error.message);
    } else {
      // Request configuration error
      console.log('Config error:', error.message);
    }
  }
}
```

[📚 Full API documentation →](./docs/API.md) | [🎯 TypeScript Guide →](./docs/typescript-guide.md) | [⚙️ Configuration Guide →](./docs/configuration-guide.md)

## 🎨 TypeScript

FluxHTTP is built with TypeScript and provides comprehensive type safety out of the box:

```typescript
import fluxhttp, { fluxhttpResponse, fluxhttpError } from '@fluxhttp/core';

// Define your data types
interface User {
  id: number;
  name: string;
  email: string;
  createdAt: string;
}

interface ApiResponse<T> {
  data: T;
  total: number;
  page: number;
}

// Fully typed requests and responses
async function getUsers(): Promise<User[]> {
  const response: fluxhttpResponse<ApiResponse<User[]>> = await fluxhttp.get('/users');
  return response.data.data; // TypeScript knows this is User[]
}

async function createUser(userData: Omit<User, 'id' | 'createdAt'>): Promise<User> {
  const response: fluxhttpResponse<User> = await fluxhttp.post('/users', userData);
  return response.data; // TypeScript knows this is User
}

// Type-safe error handling
try {
  const user = await getUsers();
} catch (error) {
  if (fluxhttp.isfluxhttpError(error)) {
    // TypeScript knows the error structure
    if (error.response) {
      console.error('API Error:', error.response.status, error.response.data);
    } else if (error.request) {
      console.error('Network Error:', error.message);
    }
  }
}

// Generic API client with full type safety
class ApiClient<T> {
  private client = fluxhttp.create({ baseURL: '/api' });

  async findAll(): Promise<T[]> {
    const response: fluxhttpResponse<T[]> = await this.client.get('/items');
    return response.data;
  }

  async findById(id: number): Promise<T> {
    const response: fluxhttpResponse<T> = await this.client.get(`/items/${id}`);
    return response.data;
  }
}

const userApi = new ApiClient<User>();
const users: User[] = await userApi.findAll(); // Fully typed!
```

[📖 Complete TypeScript Guide →](./docs/typescript-guide.md)

## 🔄 Migration from Axios

FluxHTTP provides an Axios-compatible API, making migration straightforward in most cases:

```javascript
// Before (Axios)
import axios from 'axios';

const api = axios.create({
  baseURL: 'https://api.example.com',
  timeout: 5000
});

api.interceptors.request.use(config => {
  config.headers.Authorization = `Bearer ${token}`;
  return config;
});

const response = await api.get('/users');

// After (FluxHTTP) - Nearly identical!
import { create } from '@fluxhttp/core';

const api = create({
  baseURL: 'https://api.example.com',
  timeout: 5000
});

api.interceptors.request.use(config => {
  config.headers.Authorization = `Bearer ${token}`;
  return config;
});

const response = await api.get('/users');
```

### Key Changes

```javascript
// Import changes
import axios from 'axios';                    // Before
import fluxhttp from '@fluxhttp/core';        // After

// Error checking
axios.isAxiosError(error)                     // Before  
fluxhttp.isfluxhttpError(error)               // After

// Bundle size reduction
// Axios: ~13KB gzipped
// FluxHTTP: ~1.2KB gzipped (95% smaller!)
```

[📖 Complete Migration Guide →](./docs/migration-from-axios.md)

## 📚 Documentation

Comprehensive guides and references to get you up and running:

### 🚀 Getting Started
- [📖 Basic Examples](./examples/basic/) - Simple GET, POST, error handling
- [🔧 Advanced Examples](./examples/advanced/) - Interceptors, cancellation, retry logic, testing
- [⚙️ Configuration Guide](./docs/configuration-guide.md) - All configuration options explained

### 📘 Guides  
- [🎯 TypeScript Guide](./docs/typescript-guide.md) - Type definitions, generics, best practices
- [🔄 Migration from Axios](./docs/migration-from-axios.md) - Step-by-step migration instructions
- [📚 API Reference](./docs/API.md) - Complete API documentation

### 💡 Examples
- [Basic Usage](./examples/basic/) - GET, POST, error handling examples
- [Advanced Features](./examples/advanced/) - Interceptors, cancellation, retry, mocking
- [Real-world Patterns](./examples/) - Authentication, file uploads, API clients

## ⚡ Performance

FluxHTTP is designed for optimal performance and minimal overhead:

### Bundle Size Comparison
| Library | Minified + Gzipped | Improvement |
|---------|-------------------|-------------|
| **FluxHTTP** | **1.2KB** | **baseline** |
| Axios | 13.2KB | 95% smaller |
| Fetch (+ polyfills) | 8.5KB | 86% smaller |
| node-fetch | 4.2KB | 71% smaller |

### Performance Features
- **🚀 Zero dependencies**: No dependency resolution overhead  
- **⚡ Tree-shakable**: Import only what you need
- **🧠 Smart caching**: Automatic response caching with TTL
- **🔄 Request deduplication**: Prevent duplicate concurrent requests  
- **🛜 Connection reuse**: Built-in connection pooling (Node.js)
- **📊 Minimal overhead**: Lightweight interceptor pipeline

## 🌐 Browser Support

FluxHTTP works in all modern environments with native fetch support:

| Environment | Version | Adapter |
|-------------|---------|---------|
| **Chrome** | 90+ | fetch |
| **Firefox** | 88+ | fetch | 
| **Safari** | 14+ | fetch |
| **Edge** | 90+ | fetch |
| **Node.js** | 16+ | http/https |
| **Deno** | 1.20+ | fetch |
| **Bun** | 0.6+ | fetch |
| **Cloudflare Workers** | Latest | fetch |
| **Vercel Edge** | Latest | fetch |

### Legacy Support
For older browsers, use with a fetch polyfill:
```javascript
import 'whatwg-fetch'; // Add fetch polyfill
import fluxhttp from '@fluxhttp/core';
```

## 🤝 Contributing

We welcome contributions! FluxHTTP is built with modern tooling and comprehensive testing.

### Quick Start
```bash
# Clone and setup
git clone https://github.com/fluxhttp/core.git
cd core
npm install

# Development workflow  
npm run dev        # Build in watch mode
npm run test       # Run tests
npm run test:watch # Test in watch mode
npm run lint       # Check code style
npm run typecheck  # Verify TypeScript

# Testing examples
npm run examples:basic    # Run basic examples  
npm run examples:advanced # Run advanced examples
```

### What We're Looking For
- 🐛 **Bug reports** with clear reproduction steps
- 📝 **Documentation** improvements and examples  
- ✨ **Feature requests** that align with our goals
- 🧪 **Test coverage** improvements
- ⚡ **Performance** optimizations

[📖 Contributing Guide](./CONTRIBUTING.md) | [🐛 Report Issues](https://github.com/fluxhttp/core/issues) | [💬 Discussions](https://github.com/fluxhttp/core/discussions)

## 📄 License

FluxHTTP is [MIT licensed](./LICENSE).

---

<div align="center">
  
  **Built with ❤️ by the FluxHTTP Team**
  
  [GitHub](https://github.com/fluxhttp/core) • [Documentation](./docs/) • [Examples](./examples/) • [Changelog](./CHANGELOG.md)
  
  **Star ⭐ this repo if FluxHTTP helps you build better applications!**
  
</div>