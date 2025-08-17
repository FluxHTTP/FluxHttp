#!/usr/bin/env node

/**
 * @fileoverview Advanced interceptor examples demonstrating request/response transformation
 * @description Shows how to use interceptors for authentication, logging, error handling, and data transformation
 */

const { create } = require('../../dist/index.js');

console.log('🔄 FluxHTTP Advanced Interceptor Examples\n');

/**
 * Example 1: Request interceptor for authentication
 */
async function requestAuthInterceptor() {
  console.log('📋 Example 1: Request interceptor for authentication');
  
  const client = create({
    baseURL: 'https://httpbin.org'
  });

  // Add request interceptor for authentication
  const requestInterceptorId = client.interceptors.request.use(
    config => {
      console.log('🔐 Request interceptor: Adding authentication');
      config.headers = config.headers || {};
      config.headers['Authorization'] = 'Bearer fake-token-123';
      config.headers['X-API-Version'] = '1.0';
      console.log(`📡 Request URL: ${config.baseURL}${config.url}`);
      return config;
    },
    error => {
      console.error('❌ Request interceptor error:', error.message);
      return Promise.reject(error);
    }
  );

  try {
    const response = await client.get('/headers');
    console.log('✅ Response received');
    console.log('📄 Authorization header sent:', response.data.headers.Authorization);
    console.log('📄 API Version header sent:', response.data.headers['X-Api-Version']);
  } catch (error) {
    console.error('❌ Error:', error.message);
  }

  // Clean up interceptor
  client.interceptors.request.eject(requestInterceptorId);
  console.log('🧹 Request interceptor removed');
  console.log();
}

/**
 * Example 2: Response interceptor for data transformation
 */
async function responseTransformInterceptor() {
  console.log('📋 Example 2: Response interceptor for data transformation');
  
  const client = create({
    baseURL: 'https://jsonplaceholder.typicode.com'
  });

  // Add response interceptor for data transformation
  const responseInterceptorId = client.interceptors.response.use(
    response => {
      console.log('🔄 Response interceptor: Transforming data');
      
      // Add metadata to response
      if (response.data && typeof response.data === 'object') {
        response.data = {
          ...response.data,
          __metadata: {
            timestamp: new Date().toISOString(),
            status: response.status,
            processed: true
          }
        };
      }
      
      console.log(`📊 Response status: ${response.status}`);
      console.log(`📄 Data transformed: ${!!response.data.__metadata}`);
      
      return response;
    },
    error => {
      console.error('❌ Response interceptor error:', error.message);
      return Promise.reject(error);
    }
  );

  try {
    const response = await client.get('/posts/1');
    console.log('✅ Response received and transformed');
    console.log('📄 Original post title:', response.data.title);
    console.log('📄 Added metadata:', response.data.__metadata);
  } catch (error) {
    console.error('❌ Error:', error.message);
  }

  // Clean up interceptor
  client.interceptors.response.eject(responseInterceptorId);
  console.log('🧹 Response interceptor removed');
  console.log();
}

/**
 * Example 3: Logging interceptors for request/response monitoring
 */
async function loggingInterceptors() {
  console.log('📋 Example 3: Logging interceptors for request/response monitoring');
  
  const client = create({
    baseURL: 'https://httpbin.org'
  });

  // Request logging interceptor
  const requestLoggerId = client.interceptors.request.use(
    config => {
      const timestamp = new Date().toISOString();
      console.log(`📤 [${timestamp}] ${config.method?.toUpperCase() || 'GET'} ${config.baseURL}${config.url}`);
      
      if (config.headers) {
        console.log('📋 Request Headers:', Object.keys(config.headers).join(', '));
      }
      
      if (config.data) {
        console.log('📦 Request Body Size:', JSON.stringify(config.data).length, 'bytes');
      }
      
      // Add request timing
      config._requestStartTime = Date.now();
      
      return config;
    }
  );

  // Response logging interceptor
  const responseLoggerId = client.interceptors.response.use(
    response => {
      const timestamp = new Date().toISOString();
      const duration = response.config._requestStartTime 
        ? Date.now() - response.config._requestStartTime 
        : 'unknown';
      
      console.log(`📥 [${timestamp}] ${response.status} ${response.statusText} (${duration}ms)`);
      console.log('📋 Response Headers:', Object.keys(response.headers || {}).join(', '));
      
      const responseSize = response.data 
        ? JSON.stringify(response.data).length 
        : 0;
      console.log('📦 Response Body Size:', responseSize, 'bytes');
      
      return response;
    },
    error => {
      const timestamp = new Date().toISOString();
      const duration = error.config?._requestStartTime 
        ? Date.now() - error.config._requestStartTime 
        : 'unknown';
      
      console.log(`❌ [${timestamp}] ${error.message} (${duration}ms)`);
      
      if (error.response) {
        console.log(`📊 Error Status: ${error.response.status} ${error.response.statusText}`);
      }
      
      return Promise.reject(error);
    }
  );

  try {
    await client.post('/post', { message: 'Hello from FluxHTTP!' });
    await client.get('/status/404'); // This will trigger error logging
  } catch (error) {
    // Expected error for demo
  }

  // Clean up interceptors
  client.interceptors.request.eject(requestLoggerId);
  client.interceptors.response.eject(responseLoggerId);
  console.log('🧹 Logging interceptors removed');
  console.log();
}

/**
 * Example 4: Error handling interceptor with retry logic
 */
async function errorHandlingInterceptor() {
  console.log('📋 Example 4: Error handling interceptor with retry logic');
  
  const client = create({
    baseURL: 'https://httpbin.org'
  });

  // Error handling interceptor with retry logic
  const errorInterceptorId = client.interceptors.response.use(
    response => {
      console.log('✅ Request successful, no retry needed');
      return response;
    },
    async error => {
      const config = error.config;
      
      // Initialize retry count
      config._retryCount = config._retryCount || 0;
      const maxRetries = 2;
      
      // Check if we should retry
      const shouldRetry = (
        config._retryCount < maxRetries &&
        error.response &&
        error.response.status >= 500 // Only retry server errors
      );
      
      if (shouldRetry) {
        config._retryCount++;
        const delay = Math.pow(2, config._retryCount - 1) * 1000; // Exponential backoff
        
        console.log(`🔄 Retry attempt ${config._retryCount}/${maxRetries} after ${delay}ms`);
        console.log(`📊 Previous attempt failed with: ${error.response.status} ${error.response.statusText}`);
        
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, delay));
        
        // Retry the request
        return client.request(config);
      }
      
      console.log(`❌ Request failed after ${config._retryCount || 0} retries`);
      return Promise.reject(error);
    }
  );

  try {
    // This should succeed after retry attempts
    await client.get('/status/500');
    console.log('✅ Request eventually succeeded');
  } catch (error) {
    console.log('❌ Request failed after all retries:', error.message);
  }

  // Clean up interceptor
  client.interceptors.response.eject(errorInterceptorId);
  console.log('🧹 Error handling interceptor removed');
  console.log();
}

/**
 * Example 5: Multiple interceptors working together
 */
async function multipleInterceptors() {
  console.log('📋 Example 5: Multiple interceptors working together');
  
  const client = create({
    baseURL: 'https://httpbin.org'
  });

  // Interceptor 1: Add request ID
  const requestIdInterceptor = client.interceptors.request.use(config => {
    config.headers = config.headers || {};
    config.headers['X-Request-ID'] = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    console.log('🏷️  Added request ID:', config.headers['X-Request-ID']);
    return config;
  });

  // Interceptor 2: Add timestamp
  const timestampInterceptor = client.interceptors.request.use(config => {
    config.headers = config.headers || {};
    config.headers['X-Timestamp'] = new Date().toISOString();
    console.log('⏰ Added timestamp:', config.headers['X-Timestamp']);
    return config;
  });

  // Interceptor 3: Log request summary
  const summaryInterceptor = client.interceptors.request.use(config => {
    console.log('📋 Request Summary:');
    console.log(`   Method: ${config.method?.toUpperCase() || 'GET'}`);
    console.log(`   URL: ${config.baseURL}${config.url}`);
    console.log(`   Headers: ${Object.keys(config.headers || {}).length} total`);
    return config;
  });

  // Response interceptor: Extract and log custom headers
  const responseHeaderInterceptor = client.interceptors.response.use(response => {
    console.log('📥 Response Summary:');
    console.log(`   Status: ${response.status} ${response.statusText}`);
    console.log(`   Request ID echoed: ${response.data?.headers?.['X-Request-Id']}`);
    console.log(`   Timestamp echoed: ${response.data?.headers?.['X-Timestamp']}`);
    return response;
  });

  try {
    await client.get('/headers');
    console.log('✅ Request completed with all interceptors');
  } catch (error) {
    console.error('❌ Error:', error.message);
  }

  // Clean up all interceptors
  client.interceptors.request.eject(requestIdInterceptor);
  client.interceptors.request.eject(timestampInterceptor);
  client.interceptors.request.eject(summaryInterceptor);
  client.interceptors.response.eject(responseHeaderInterceptor);
  console.log('🧹 All interceptors removed');
  console.log();
}

/**
 * Example 6: Conditional interceptors based on URL patterns
 */
async function conditionalInterceptors() {
  console.log('📋 Example 6: Conditional interceptors based on URL patterns');
  
  const client = create({
    baseURL: 'https://jsonplaceholder.typicode.com'
  });

  // Conditional interceptor: Only apply to certain endpoints
  const conditionalInterceptor = client.interceptors.request.use(config => {
    const url = config.url || '';
    
    // Apply special headers only to posts endpoints
    if (url.includes('/posts')) {
      console.log('📝 Applying posts-specific configuration');
      config.headers = config.headers || {};
      config.headers['X-Content-Type'] = 'posts';
      config.headers['X-Cache-Strategy'] = 'aggressive';
    }
    
    // Apply auth headers only to users endpoints
    if (url.includes('/users')) {
      console.log('👤 Applying users-specific configuration');
      config.headers = config.headers || {};
      config.headers['Authorization'] = 'Bearer user-token';
      config.headers['X-Privacy-Level'] = 'high';
    }
    
    // Apply rate limiting headers to all endpoints
    console.log('⚡ Applying global rate limiting headers');
    config.headers = config.headers || {};
    config.headers['X-Rate-Limit-Client'] = 'fluxhttp-example';
    
    return config;
  });

  try {
    console.log('🔍 Making request to posts endpoint...');
    await client.get('/posts/1');
    
    console.log('🔍 Making request to users endpoint...');
    await client.get('/users/1');
    
    console.log('🔍 Making request to comments endpoint...');
    await client.get('/comments/1');
    
    console.log('✅ All conditional requests completed');
  } catch (error) {
    console.error('❌ Error:', error.message);
  }

  // Clean up interceptor
  client.interceptors.request.eject(conditionalInterceptor);
  console.log('🧹 Conditional interceptor removed');
  console.log();
}

/**
 * Run all examples
 */
async function runAllExamples() {
  console.log('🚀 Running all interceptor examples...\n');
  
  await requestAuthInterceptor();
  await responseTransformInterceptor();
  await loggingInterceptors();
  await errorHandlingInterceptor();
  await multipleInterceptors();
  await conditionalInterceptors();
  
  console.log('✨ All interceptor examples completed!');
}

// Run examples if this file is executed directly
if (require.main === module) {
  runAllExamples().catch(error => {
    console.error('💥 Fatal error:', error);
    process.exit(1);
  });
}

module.exports = {
  requestAuthInterceptor,
  responseTransformInterceptor,
  loggingInterceptors,
  errorHandlingInterceptor,
  multipleInterceptors,
  conditionalInterceptors,
  runAllExamples
};