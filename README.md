# FluxHTTP

[![npm version](https://badge.fury.io/js/fluxhttp.svg)](https://badge.fury.io/js/fluxhttp)
[![npm downloads](https://img.shields.io/npm/dm/fluxhttp.svg)](https://www.npmjs.com/package/fluxhttp)
[![bundle size](https://img.shields.io/bundlephobia/minzip/fluxhttp)](https://bundlephobia.com/package/fluxhttp)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Test Coverage](https://img.shields.io/badge/coverage-85%25-brightgreen.svg)](./tests)
[![Tests](https://img.shields.io/badge/tests-298%20passing-brightgreen.svg)](./tests)

> 🚀 The Future of HTTP Clients - Smart, Fast, Adaptive

<div align="center">
  <img src="https://fluxhttp.com/fluxHTTP.png" alt="FluxHTTP Logo" width="200" />
  
  **FluxHTTP** is a next-generation HTTP client for JavaScript/TypeScript that combines the simplicity you love with the performance you need. Zero dependencies, full TypeScript support, and a tiny footprint.
  
  [Documentation](https://fluxhttp.com/docs) • [API Reference](./docs/API.md) • [Examples](./examples) • [Contributing](./CONTRIBUTING.md)
</div>

---

## 🌟 Why FluxHTTP?

FluxHTTP is not just another HTTP client. It's a complete rethinking of how HTTP clients should work in modern JavaScript applications:

- **🎯 Zero Dependencies**: No bloat, no security vulnerabilities from third-party packages
- **📦 Tiny Bundle**: ~12KB ESM / ~16KB CJS (52% smaller than Axios)
- **⚡ Lightning Fast**: Optimized for performance with smart connection reuse
- **🔒 Type-Safe**: Built with TypeScript from the ground up
- **🌐 Universal**: Works everywhere - Node.js, browsers, Deno, Bun, and edge runtimes
- **🧩 Extensible**: Powerful plugin system for custom functionality
- **🛡️ Secure**: Built-in XSS protection, CSRF tokens, and security best practices

## 📋 Table of Contents

- [FluxHTTP](#fluxhttp)
  - [🌟 Why FluxHTTP?](#-why-fluxhttp)
  - [📋 Table of Contents](#-table-of-contents)
  - [🚀 Quick Start](#-quick-start)
  - [💎 Features](#-features)
    - [Core Features](#core-features)
    - [Advanced Features](#advanced-features)
  - [📦 Installation](#-installation)
  - [🎯 Basic Usage](#-basic-usage)
  - [🔧 Advanced Usage](#-advanced-usage)
    - [Creating Custom Instances](#creating-custom-instances)
    - [Interceptors](#interceptors)
    - [Request Cancellation](#request-cancellation)
  - [🎨 TypeScript](#-typescript)
  - [🔄 Migration from Axios](#-migration-from-axios)
  - [⚡ Performance](#-performance)
  - [🌐 Browser Support](#-browser-support)
  - [🤝 Contributing](#-contributing)
    - [Development Setup](#development-setup)
  - [📄 License](#-license)
  - [🙏 Acknowledgments](#-acknowledgments)

## 🚀 Quick Start

```bash
npm install fluxhttp
```

```typescript
import fluxhttp from 'fluxhttp';

// Make a GET request
const response = await fluxhttp.get('https://api.example.com/users');
console.log(response.data);
```

That's it! No configuration needed. FluxHTTP works out of the box with sensible defaults.

## 💎 Features

### Core Features
- ✅ **All HTTP Methods**: GET, POST, PUT, DELETE, PATCH, HEAD, OPTIONS
- ✅ **Request/Response Interceptors**: Transform requests or responses
- ✅ **Automatic JSON Transformation**: Seamless JSON parsing/stringification
- ✅ **Error Handling**: Comprehensive error information with retry support
- ✅ **Request Cancellation**: AbortController support
- ✅ **Timeout Support**: Global and per-request timeouts
- ✅ **Progress Tracking**: Upload/download progress events
- ✅ **XSRF Protection**: Built-in CSRF token support

### Advanced Features
- 🔥 **Smart Retry Logic**: Exponential backoff with jitter
- 🔥 **Request Deduplication**: Automatic duplicate request prevention
- 🔥 **Connection Pooling**: Efficient connection reuse
- 🔥 **Response Caching**: Intelligent cache management
- 🔥 **Stream Support**: Handle large files efficiently
- 🔥 **Plugin System**: Extend functionality with custom plugins
- 🔥 **Metrics & Monitoring**: Built-in performance tracking
- 🔥 **Mock Adapter**: Testing made easy

## 📦 Installation

```bash
# npm
npm install fluxhttp

# yarn
yarn add fluxhttp

# pnpm
pnpm add fluxhttp

# bun
bun add fluxhttp
```

## 🎯 Basic Usage

```typescript
import fluxhttp from 'fluxhttp';

// GET request
const { data } = await fluxhttp.get('https://api.example.com/users');

// POST request
const newUser = await fluxhttp.post('https://api.example.com/users', {
  name: 'John Doe',
  email: 'john@example.com'
});

// PUT request
await fluxhttp.put(`/users/${userId}`, { name: 'Jane Doe' });

// DELETE request
await fluxhttp.delete(`/users/${userId}`);
```

[See more examples →](./USAGE.md)

## 🔧 Advanced Usage

### Creating Custom Instances

```typescript
const api = fluxhttp.create({
  baseURL: 'https://api.example.com',
  timeout: 10000,
  headers: {
    'Authorization': `Bearer ${token}`
  }
});

// Use the custom instance
const users = await api.get('/users');
```

### Interceptors

```typescript
// Add request interceptor
api.interceptors.request.use(config => {
  console.log('Starting request:', config.url);
  return config;
});

// Add response interceptor
api.interceptors.response.use(
  response => {
    console.log('Response received:', response.status);
    return response;
  },
  error => {
    if (error.response?.status === 401) {
      // Handle authentication error
      redirectToLogin();
    }
    return Promise.reject(error);
  }
);
```

### Request Cancellation

```typescript
const controller = new AbortController();

// Start request
const promise = fluxhttp.get('/large-data', {
  signal: controller.signal
});

// Cancel request
controller.abort();
```

[Full API documentation →](./docs/API.md)

## 🎨 TypeScript

FluxHTTP is written in TypeScript and provides complete type safety:

```typescript
import fluxhttp, { FluxHTTPResponse, FluxHTTPError } from 'fluxhttp';

interface User {
  id: number;
  name: string;
  email: string;
}

try {
  const response: FluxHTTPResponse<User> = await fluxhttp.get('/user/1');
  const user: User = response.data;
} catch (error) {
  if (fluxhttp.isFluxHTTPError(error)) {
    console.error('HTTP Error:', error.response?.status);
  }
}
```

## 🔄 Migration from Axios

FluxHTTP provides a nearly identical API to Axios, making migration straightforward:

```typescript
// Axios
import axios from 'axios';
const response = await axios.get('/users');

// FluxHTTP (no changes needed!)
import fluxhttp from 'fluxhttp';
const response = await fluxhttp.get('/users');
```

[See migration guide →](./docs/API.md#migration-from-axios)

## ⚡ Performance

FluxHTTP is designed for maximum performance:

- **52% smaller** bundle size than Axios
- **30% faster** request processing
- **Zero dependencies** means faster installation
- **Smart connection pooling** for better throughput
- **Automatic request deduplication** reduces network load

[See benchmarks →](./benchmarks)

## 🌐 Browser Support

| Browser | Version |
|---------|---------|
| Chrome | 90+ |
| Firefox | 88+ |
| Safari | 14+ |
| Edge | 90+ |
| Node.js | 16+ |

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](./CONTRIBUTING.md) for details.

### Development Setup

```bash
# Clone the repository
git clone https://github.com/fluxhttp/fluxhttp.git
cd fluxhttp

# Install dependencies
npm install

# Run tests
npm test

# Build the project
npm run build
```

## 📄 License

FluxHTTP is [MIT licensed](./LICENSE).

## 🙏 Acknowledgments

FluxHTTP is inspired by the excellent work of the Axios team and the broader JavaScript community. We stand on the shoulders of giants.

---

<div align="center">
  <p>Built with ❤️ by the <a href="https://github.com/fluxhttp">FluxHTTP Team</a></p>
  <p>
    <a href="https://fluxhttp.com">Website</a> •
    <a href="https://github.com/fluxhttp/fluxhttp">GitHub</a>
  </p>
</div>