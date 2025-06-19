# fluxhttp Examples

This directory contains comprehensive examples demonstrating fluxhttp's capabilities and usage patterns.

## Examples Overview

### 1. Basic Usage (`basic-usage.js`)
Demonstrates fundamental HTTP operations:
- Simple GET, POST, PUT, DELETE requests
- Request configuration with headers
- Query parameters
- Timeout handling
- Basic error handling

**Run:** `node examples/basic-usage.js`

### 2. Advanced Configuration (`advanced-configuration.js`)
Shows advanced features and configuration options:
- Custom fluxhttp instances
- Request and response interceptors
- Multiple instances with different configurations
- Custom validation logic
- Concurrent request handling
- Request/response transformation

**Run:** `node examples/advanced-configuration.js`

### 3. Error Handling (`error-handling.js`)
Comprehensive error handling strategies:
- Different types of HTTP errors
- Network and timeout errors
- Request cancellation
- Error recovery with retry logic
- Custom error handling with interceptors
- Error information extraction

**Run:** `node examples/error-handling.js`

### 4. Performance Testing (`performance-testing.js`)
Performance measurement and optimization:
- Single request benchmarking
- Concurrent vs sequential request comparison
- Instance creation overhead analysis
- Payload size impact measurement
- Interceptor overhead testing
- Memory usage monitoring
- Comprehensive performance benchmarks

**Run:** `node examples/performance-testing.js`

### 5. Real-World Scenarios (`real-world-scenarios.js`)
Practical usage patterns for common development scenarios:
- API client with authentication
- File upload with progress tracking
- Polling APIs with exponential backoff
- Rate-limited API client
- Microservice communication
- GraphQL client wrapper
- Webhook handling

**Run:** `node examples/real-world-scenarios.js`

## Quick Start

To run all examples:

```bash
# Install dependencies (if not already done)
npm install

# Run individual examples
node examples/basic-usage.js
node examples/advanced-configuration.js
node examples/error-handling.js
node examples/performance-testing.js
node examples/real-world-scenarios.js

# Or run all examples with the demo script
node examples/run-all-examples.js
```

## Example Categories

### Basic Operations
- GET requests with query parameters
- POST requests with JSON data
- PUT requests for updates
- DELETE requests
- Custom headers
- Timeout configuration

### Advanced Features
- Instance creation and configuration
- Request/response interceptors
- Multiple concurrent requests
- Custom validation functions
- Data transformation
- Error handling strategies

### Performance Optimization
- Concurrent request patterns
- Memory usage optimization
- Request batching
- Connection reuse
- Performance benchmarking

### Real-World Patterns
- Authentication handling
- API rate limiting
- File uploads
- Webhook processing
- Service mesh communication
- GraphQL integration

## Configuration Examples

### Basic Configuration
```javascript
const fluxhttp = require('fluxhttp');

// Simple GET request
const response = await fluxhttp.get('https://api.example.com/data');
```

### Advanced Configuration
```javascript
const { create } = require('fluxhttp');

// Custom instance with configuration
const apiClient = create({
  baseURL: 'https://api.example.com',
  timeout: 10000,
  headers: {
    'Authorization': 'Bearer token',
    'Content-Type': 'application/json'
  }
});
```

### With Interceptors
```javascript
// Request interceptor
apiClient.interceptors.request.use(config => {
  config.headers['X-Request-ID'] = generateId();
  return config;
});

// Response interceptor
apiClient.interceptors.response.use(
  response => response,
  error => {
    console.error('Request failed:', error.message);
    return Promise.reject(error);
  }
);
```

## Error Handling Patterns

### Basic Error Handling
```javascript
try {
  const response = await fluxhttp.get('/api/data');
  console.log(response.data);
} catch (error) {
  if (fluxhttpError.isfluxhttpError(error)) {
    console.log('Status:', error.response?.status);
    console.log('Message:', error.message);
  }
}
```

### Retry Logic
```javascript
async function makeRequestWithRetry(url, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fluxhttp.get(url);
    } catch (error) {
      if (attempt === maxRetries) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }
  }
}
```

## Performance Tips

1. **Reuse Instances**: Create fluxhttp instances once and reuse them
2. **Concurrent Requests**: Use `Promise.all()` for concurrent requests
3. **Proper Timeouts**: Set appropriate timeout values
4. **Memory Management**: Clean up interceptors when no longer needed
5. **Connection Pooling**: Let the adapter handle connection reuse

## Testing Your Code

These examples include both successful and error scenarios to help you understand:
- How fluxhttp behaves under different conditions
- Proper error handling patterns
- Performance characteristics
- Memory usage patterns

## Contributing

If you have additional examples or improvements, please:
1. Follow the existing code style
2. Include comprehensive error handling
3. Add documentation comments
4. Test with real endpoints where possible

## Support

For questions about these examples or fluxhttp usage:
- Check the main README.md
- Review the TypeScript definitions
- Run the examples to see fluxhttp in action
- Create issues for bugs or feature requests