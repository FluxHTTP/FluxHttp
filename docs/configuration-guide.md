# Configuration Guide for FluxHTTP

This comprehensive guide covers all configuration options available in FluxHTTP, including common patterns, environment-specific configurations, and performance tuning strategies.

## Table of Contents

1. [Overview](#overview)
2. [Basic Configuration](#basic-configuration)
3. [Request Configuration Options](#request-configuration-options)
4. [Instance Configuration](#instance-configuration)
5. [Advanced Configuration](#advanced-configuration)
6. [Environment-Specific Configuration](#environment-specific-configuration)
7. [Performance Tuning](#performance-tuning)
8. [Security Configuration](#security-configuration)
9. [Configuration Patterns](#configuration-patterns)
10. [Best Practices](#best-practices)

## Overview

FluxHTTP provides flexible configuration options at multiple levels:

- **Global defaults**: Configuration applied to all requests
- **Instance configuration**: Configuration for specific client instances
- **Request-level configuration**: Configuration for individual requests

Configuration follows a hierarchy where more specific settings override general ones:
`Request Config > Instance Config > Global Defaults`

## Basic Configuration

### Global Configuration

```javascript
import fluxhttp from '@fluxhttp/core';

// Set global defaults
fluxhttp.defaults.baseURL = 'https://api.example.com';
fluxhttp.defaults.timeout = 10000;
fluxhttp.defaults.headers.common['Authorization'] = 'Bearer token';

// All requests will use these defaults
const response = await fluxhttp.get('/users'); // Requests https://api.example.com/users
```

### Instance Configuration

```javascript
import { create } from '@fluxhttp/core';

const apiClient = create({
  baseURL: 'https://api.example.com',
  timeout: 5000,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  }
});
```

### Request-Level Configuration

```javascript
const response = await fluxhttp.get('/users', {
  timeout: 3000, // Override instance/global timeout
  headers: {
    'Accept': 'application/xml' // Override instance/global header
  }
});
```

## Request Configuration Options

### Core Options

```javascript
const config = {
  // Request URL (can be relative if baseURL is set)
  url: '/api/users',
  
  // HTTP method
  method: 'GET', // 'GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'
  
  // Base URL prepended to url (unless url is absolute)
  baseURL: 'https://api.example.com',
  
  // Request headers
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer token123',
    'Accept': 'application/json',
    'User-Agent': 'MyApp/1.0'
  },
  
  // URL query parameters
  params: {
    page: 1,
    limit: 20,
    sort: 'name',
    active: true
  },
  
  // Request body data
  data: {
    name: 'John Doe',
    email: 'john@example.com'
  },
  
  // Request timeout in milliseconds (0 = no timeout)
  timeout: 10000
};
```

### Advanced Options

```javascript
const advancedConfig = {
  // Custom adapter function
  adapter: customAdapter,
  
  // Cross-site request credentials
  withCredentials: true,
  
  // Basic authentication
  auth: {
    username: 'user',
    password: 'pass'
  },
  
  // Response data type
  responseType: 'json', // 'json', 'text', 'blob', 'arraybuffer', 'stream'
  
  // Response encoding (Node.js only)
  responseEncoding: 'utf8',
  
  // Custom status validation
  validateStatus: (status) => status >= 200 && status < 300,
  
  // Maximum redirects to follow
  maxRedirects: 5,
  
  // Maximum response content length
  maxContentLength: 2000,
  
  // Maximum request body length
  maxBodyLength: 2000,
  
  // Response decompression
  decompress: true,
  
  // AbortController signal
  signal: abortController.signal,
  
  // Legacy cancel token
  cancelToken: source.token,
  
  // Progress callbacks
  onUploadProgress: (progressEvent) => {
    console.log('Upload progress:', progressEvent.loaded / progressEvent.total);
  },
  
  onDownloadProgress: (progressEvent) => {
    console.log('Download progress:', progressEvent.loaded / progressEvent.total);
  }
};
```

## Instance Configuration

### Creating Configured Instances

```javascript
import { create } from '@fluxhttp/core';

// API client for external service
const externalApi = create({
  baseURL: 'https://external-api.com/v1',
  timeout: 15000,
  headers: {
    'API-Key': process.env.EXTERNAL_API_KEY,
    'Content-Type': 'application/json'
  }
});

// Internal service client
const internalApi = create({
  baseURL: 'http://internal-service:3000',
  timeout: 5000,
  headers: {
    'Service-Token': process.env.SERVICE_TOKEN
  }
});

// File upload client
const uploadClient = create({
  baseURL: 'https://upload.example.com',
  timeout: 60000, // Longer timeout for uploads
  maxContentLength: 100 * 1024 * 1024, // 100MB
  headers: {
    'Content-Type': 'multipart/form-data'
  }
});
```

### Instance Defaults

```javascript
const client = create({
  baseURL: 'https://api.example.com'
});

// Modify instance defaults after creation
client.defaults.timeout = 8000;
client.defaults.headers.common['X-Client-Version'] = '1.2.3';
client.defaults.headers.get['Accept'] = 'application/json';
client.defaults.headers.post['Content-Type'] = 'application/json';
```

## Advanced Configuration

### Retry Configuration

```javascript
const clientWithRetry = create({
  baseURL: 'https://api.example.com',
  retry: {
    attempts: 3,           // Maximum retry attempts
    delay: 1000,          // Initial delay in ms
    maxDelay: 10000,      // Maximum delay in ms
    backoff: 'exponential', // 'exponential', 'linear', 'constant'
    retryCondition: (error) => {
      // Custom retry logic
      return error.response?.status >= 500 || error.code === 'ECONNRESET';
    }
  }
});
```

### Cache Configuration

```javascript
const clientWithCache = create({
  baseURL: 'https://api.example.com',
  cache: {
    enabled: true,
    ttl: 300000,          // 5 minutes in ms
    storage: 'memory',    // 'memory', 'localStorage', 'sessionStorage'
    excludeHeaders: ['authorization', 'x-request-id'],
    key: (config) => {
      // Custom cache key generator
      return `${config.method}:${config.url}:${JSON.stringify(config.params)}`;
    }
  }
});
```

### Security Configuration

```javascript
const secureClient = create({
  baseURL: 'https://api.example.com',
  security: {
    csrf: {
      enabled: true,
      headerName: 'X-CSRF-Token',
      cookieName: '_csrf',
      tokenRefreshInterval: 300000
    },
    rateLimit: {
      enabled: true,
      maxRequests: 100,
      windowMs: 60000, // 1 minute
      skipSuccessfulRequests: false
    },
    contentValidation: {
      enabled: true,
      maxContentLength: 1024 * 1024, // 1MB
      allowedContentTypes: [
        'application/json',
        'application/x-www-form-urlencoded',
        'multipart/form-data'
      ]
    }
  }
});
```

### Request Deduplication

```javascript
const clientWithDedup = create({
  baseURL: 'https://api.example.com',
  deduplication: {
    enabled: true,
    maxAge: 5000,         // Keep pending requests for 5 seconds
    includeHeaders: ['authorization'],
    keyGenerator: (config) => {
      // Custom key generation for deduplication
      return `${config.method}:${config.url}:${config.data ? JSON.stringify(config.data) : ''}`;
    },
    shouldDeduplicate: (config) => {
      // Only deduplicate GET requests
      return config.method === 'GET';
    }
  }
});
```

## Environment-Specific Configuration

### Development Configuration

```javascript
// config/development.js
export const developmentConfig = {
  baseURL: 'http://localhost:3000/api',
  timeout: 30000, // Longer timeout for debugging
  headers: {
    'X-Environment': 'development'
  },
  // Enable detailed logging
  interceptors: {
    request: [(config) => {
      console.log('Request:', config.method, config.url);
      return config;
    }],
    response: [(response) => {
      console.log('Response:', response.status, response.config.url);
      return response;
    }]
  }
};
```

### Production Configuration

```javascript
// config/production.js
export const productionConfig = {
  baseURL: 'https://api.production.com',
  timeout: 10000,
  headers: {
    'X-Environment': 'production'
  },
  retry: {
    attempts: 3,
    delay: 1000,
    backoff: 'exponential'
  },
  cache: {
    enabled: true,
    ttl: 300000 // 5 minutes
  },
  security: {
    csrf: { enabled: true },
    rateLimit: { enabled: true }
  }
};
```

### Testing Configuration

```javascript
// config/testing.js
export const testingConfig = {
  baseURL: 'http://mock-server:3000',
  timeout: 5000,
  adapter: mockAdapter, // Use mock adapter for tests
  headers: {
    'X-Environment': 'testing'
  }
};
```

### Configuration Factory

```javascript
// config/index.js
const configs = {
  development: developmentConfig,
  production: productionConfig,
  testing: testingConfig
};

export function createApiClient(environment = process.env.NODE_ENV) {
  const config = configs[environment] || configs.development;
  const client = create(config);
  
  // Apply interceptors if specified
  if (config.interceptors?.request) {
    config.interceptors.request.forEach(interceptor => {
      client.interceptors.request.use(interceptor);
    });
  }
  
  if (config.interceptors?.response) {
    config.interceptors.response.forEach(interceptor => {
      client.interceptors.response.use(interceptor);
    });
  }
  
  return client;
}
```

## Performance Tuning

### Connection Optimization

```javascript
const optimizedClient = create({
  baseURL: 'https://api.example.com',
  
  // Optimize timeouts
  timeout: 5000,           // Reasonable timeout
  
  // Limit content sizes
  maxContentLength: 10 * 1024 * 1024, // 10MB
  maxBodyLength: 10 * 1024 * 1024,    // 10MB
  
  // Enable compression
  decompress: true,
  
  // Optimize headers
  headers: {
    'Accept-Encoding': 'gzip, deflate',
    'Connection': 'keep-alive'
  }
});
```

### Caching Strategy

```javascript
const cachedClient = create({
  baseURL: 'https://api.example.com',
  cache: {
    enabled: true,
    ttl: 300000, // 5 minutes for most data
    storage: 'memory',
    key: (config) => {
      // Include user ID in cache key for user-specific data
      const userId = config.headers['X-User-ID'];
      return `${config.method}:${config.url}:${userId}:${JSON.stringify(config.params)}`;
    }
  }
});

// Different cache settings for different endpoints
const userClient = create({
  baseURL: 'https://api.example.com',
  cache: {
    enabled: true,
    ttl: 600000 // 10 minutes for user data
  }
});

const realtimeClient = create({
  baseURL: 'https://api.example.com',
  cache: {
    enabled: false // No caching for real-time data
  }
});
```

### Request Batching

```javascript
class BatchingClient {
  constructor(config) {
    this.client = create(config);
    this.batchQueue = [];
    this.batchTimeout = null;
  }
  
  async batchRequest(config) {
    return new Promise((resolve, reject) => {
      this.batchQueue.push({ config, resolve, reject });
      
      if (!this.batchTimeout) {
        this.batchTimeout = setTimeout(() => {
          this.processBatch();
        }, 50); // 50ms batch window
      }
    });
  }
  
  async processBatch() {
    const batch = this.batchQueue.splice(0);
    this.batchTimeout = null;
    
    if (batch.length === 0) return;
    
    try {
      const promises = batch.map(({ config }) => this.client.request(config));
      const responses = await Promise.allSettled(promises);
      
      responses.forEach((result, index) => {
        const { resolve, reject } = batch[index];
        if (result.status === 'fulfilled') {
          resolve(result.value);
        } else {
          reject(result.reason);
        }
      });
    } catch (error) {
      batch.forEach(({ reject }) => reject(error));
    }
  }
}
```

## Security Configuration

### CSRF Protection

```javascript
const csrfProtectedClient = create({
  baseURL: 'https://api.example.com',
  security: {
    csrf: {
      enabled: true,
      headerName: 'X-CSRF-Token',
      cookieName: '_csrf_token',
      tokenRefreshInterval: 300000, // 5 minutes
      tokenRefreshEndpoint: '/auth/csrf-token'
    }
  }
});
```

### Rate Limiting

```javascript
const rateLimitedClient = create({
  baseURL: 'https://api.example.com',
  security: {
    rateLimit: {
      enabled: true,
      maxRequests: 100,
      windowMs: 60000, // 1 minute
      skipSuccessfulRequests: false,
      skipFailedRequests: true,
      keyGenerator: (config) => {
        // Rate limit per user
        return config.headers['X-User-ID'] || 'anonymous';
      }
    }
  }
});
```

### Content Validation

```javascript
const validatedClient = create({
  baseURL: 'https://api.example.com',
  security: {
    contentValidation: {
      enabled: true,
      maxContentLength: 1024 * 1024, // 1MB
      allowedContentTypes: [
        'application/json',
        'application/x-www-form-urlencoded',
        'text/plain'
      ],
      customValidator: (data, contentType) => {
        // Custom validation logic
        if (contentType === 'application/json') {
          try {
            JSON.parse(data);
            return true;
          } catch {
            return false;
          }
        }
        return true;
      }
    }
  }
});
```

## Configuration Patterns

### Configuration Builder Pattern

```javascript
class FluxHttpConfigBuilder {
  constructor() {
    this.config = {};
  }
  
  baseURL(url) {
    this.config.baseURL = url;
    return this;
  }
  
  timeout(ms) {
    this.config.timeout = ms;
    return this;
  }
  
  headers(headers) {
    this.config.headers = { ...this.config.headers, ...headers };
    return this;
  }
  
  auth(username, password) {
    this.config.auth = { username, password };
    return this;
  }
  
  retry(attempts = 3, delay = 1000) {
    this.config.retry = { attempts, delay, backoff: 'exponential' };
    return this;
  }
  
  cache(ttl = 300000) {
    this.config.cache = { enabled: true, ttl };
    return this;
  }
  
  security(options = {}) {
    this.config.security = options;
    return this;
  }
  
  build() {
    return create(this.config);
  }
}

// Usage
const client = new FluxHttpConfigBuilder()
  .baseURL('https://api.example.com')
  .timeout(10000)
  .headers({ 'Content-Type': 'application/json' })
  .retry(3, 1000)
  .cache(600000)
  .security({ csrf: { enabled: true } })
  .build();
```

### Configuration Composition

```javascript
// Base configurations
const baseConfig = {
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  }
};

const authConfig = {
  headers: {
    'Authorization': `Bearer ${getToken()}`
  },
  interceptors: {
    request: [addAuthHeader],
    response: [handleAuthErrors]
  }
};

const retryConfig = {
  retry: {
    attempts: 3,
    delay: 1000,
    backoff: 'exponential'
  }
};

// Compose configurations
function createClient(configs) {
  const merged = configs.reduce((acc, config) => ({
    ...acc,
    ...config,
    headers: { ...acc.headers, ...config.headers }
  }), {});
  
  return create(merged);
}

const client = createClient([baseConfig, authConfig, retryConfig]);
```

### Configuration Presets

```javascript
// Predefined configuration presets
export const presets = {
  // Fast, minimal configuration
  fast: {
    timeout: 3000,
    cache: { enabled: false },
    retry: { attempts: 1 }
  },
  
  // Reliable configuration with retries and caching
  reliable: {
    timeout: 10000,
    retry: { attempts: 3, delay: 1000, backoff: 'exponential' },
    cache: { enabled: true, ttl: 300000 }
  },
  
  // Secure configuration
  secure: {
    timeout: 15000,
    security: {
      csrf: { enabled: true },
      rateLimit: { enabled: true },
      contentValidation: { enabled: true }
    },
    retry: { attempts: 2 }
  },
  
  // File upload configuration
  upload: {
    timeout: 60000,
    maxContentLength: 100 * 1024 * 1024, // 100MB
    maxBodyLength: 100 * 1024 * 1024,
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  }
};

export function createClientWithPreset(preset, customConfig = {}) {
  const presetConfig = presets[preset] || presets.reliable;
  return create({ ...presetConfig, ...customConfig });
}

// Usage
const apiClient = createClientWithPreset('reliable', {
  baseURL: 'https://api.example.com'
});

const uploadClient = createClientWithPreset('upload', {
  baseURL: 'https://upload.example.com'
});
```

## Best Practices

### 1. Use Environment Variables

```javascript
const config = {
  baseURL: process.env.API_BASE_URL || 'http://localhost:3000',
  timeout: parseInt(process.env.API_TIMEOUT) || 10000,
  headers: {
    'API-Key': process.env.API_KEY,
    'Client-Version': process.env.npm_package_version
  }
};
```

### 2. Validate Configuration

```javascript
function validateConfig(config) {
  if (!config.baseURL) {
    throw new Error('baseURL is required');
  }
  
  if (config.timeout && config.timeout < 0) {
    throw new Error('timeout must be positive');
  }
  
  if (config.retry?.attempts && config.retry.attempts > 10) {
    console.warn('High retry attempts may cause performance issues');
  }
  
  return config;
}

const client = create(validateConfig(config));
```

### 3. Document Configuration

```javascript
/**
 * Create API client with standardized configuration
 * @param {Object} options - Configuration options
 * @param {string} options.baseURL - API base URL
 * @param {string} options.apiKey - API authentication key
 * @param {number} [options.timeout=10000] - Request timeout in ms
 * @param {boolean} [options.enableRetry=true] - Enable automatic retries
 * @param {boolean} [options.enableCache=false] - Enable response caching
 * @returns {fluxhttpInstance} Configured client instance
 */
export function createApiClient({
  baseURL,
  apiKey,
  timeout = 10000,
  enableRetry = true,
  enableCache = false
}) {
  const config = {
    baseURL,
    timeout,
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    }
  };
  
  if (enableRetry) {
    config.retry = { attempts: 3, delay: 1000 };
  }
  
  if (enableCache) {
    config.cache = { enabled: true, ttl: 300000 };
  }
  
  return create(config);
}
```

### 4. Configuration Testing

```javascript
// Test configuration validity
describe('API Configuration', () => {
  test('should create client with valid config', () => {
    const config = {
      baseURL: 'https://api.example.com',
      timeout: 5000
    };
    
    expect(() => create(config)).not.toThrow();
  });
  
  test('should apply default values', () => {
    const client = create({ baseURL: 'https://api.example.com' });
    
    expect(client.defaults.timeout).toBe(10000); // Default timeout
  });
  
  test('should merge configurations correctly', () => {
    const client = create({
      baseURL: 'https://api.example.com',
      headers: { 'X-Custom': 'value' }
    });
    
    client.defaults.headers.common['Authorization'] = 'Bearer token';
    
    expect(client.defaults.headers.common['Authorization']).toBe('Bearer token');
    expect(client.defaults.headers['X-Custom']).toBe('value');
  });
});
```

This configuration guide provides comprehensive coverage of FluxHTTP's configuration system, enabling you to optimize your HTTP client for specific use cases and environments.