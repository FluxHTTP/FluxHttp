/**
 * FluxHTTP Advanced Configuration Examples
 * Demonstrates custom instances, interceptors, and advanced features
 */

const { fluxhttp, create, FluxHTTPError } = require('../dist/index.js');

// Example 1: Creating a custom FluxHTTP instance
function createCustomInstance() {
  const apiClient = create({
    baseURL: 'https://jsonplaceholder.typicode.com',
    timeout: 10000,
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'FluxHTTP-Advanced-Example/1.0.0'
    },
    validateStatus: (status) => status >= 200 && status < 300
  });

  return apiClient;
}

// Example 2: Request interceptors
async function requestInterceptorExample() {
  const client = createCustomInstance();

  // Add a request interceptor to log requests
  const requestInterceptorId = client.interceptors.request.use(
    (config) => {
      console.log(`Making ${config.method?.toUpperCase()} request to: ${config.url}`);
      config.headers = config.headers || {};
      config.headers['X-Request-ID'] = Math.random().toString(36).substr(2, 9);
      return config;
    },
    (error) => {
      console.error('Request interceptor error:', error);
      return Promise.reject(error);
    }
  );

  // Add auth interceptor
  const authInterceptorId = client.interceptors.request.use((config) => {
    // Simulate adding auth token
    config.headers = config.headers || {};
    config.headers['Authorization'] = 'Bearer simulated-token-123';
    return config;
  });

  try {
    const response = await client.get('/posts/1');
    console.log('Request Interceptor Example - Response:', response.data);
  } catch (error) {
    console.error('Error:', error.message);
  }

  // Clean up interceptors
  client.interceptors.request.eject(requestInterceptorId);
  client.interceptors.request.eject(authInterceptorId);
}

// Example 3: Response interceptors
async function responseInterceptorExample() {
  const client = createCustomInstance();

  // Add response interceptor for data transformation
  const responseInterceptorId = client.interceptors.response.use(
    (response) => {
      console.log(`Response received with status: ${response.status}`);
      
      // Transform response data
      if (response.data && typeof response.data === 'object') {
        response.data.timestamp = new Date().toISOString();
        response.data.processedBy = 'FluxHTTP-Advanced';
      }
      
      return response;
    },
    (error) => {
      console.error('Response interceptor error:', error.message);
      
      // Enhanced error handling
      if (error.response) {
        console.log('Error Status:', error.response.status);
        console.log('Error Data:', error.response.data);
      }
      
      return Promise.reject(error);
    }
  );

  try {
    const response = await client.get('/posts/1');
    console.log('Response Interceptor Example - Enhanced Data:', response.data);
  } catch (error) {
    console.error('Error:', error.message);
  }

  // Clean up
  client.interceptors.response.eject(responseInterceptorId);
}

// Example 4: Multiple instances with different configurations
async function multipleInstancesExample() {
  // API client for JSONPlaceholder
  const jsonClient = create({
    baseURL: 'https://jsonplaceholder.typicode.com',
    timeout: 5000,
    headers: {
      'Accept': 'application/json'
    }
  });

  // API client for a different service (simulated)
  const otherClient = create({
    baseURL: 'https://httpbin.org',
    timeout: 8000,
    headers: {
      'Accept': 'application/json',
      'X-Client': 'FluxHTTP-Other'
    }
  });

  try {
    // Make requests with different clients
    const [jsonResponse, httpbinResponse] = await Promise.all([
      jsonClient.get('/posts/1'),
      otherClient.get('/get?test=multiple-instances')
    ]);

    console.log('JSON Client Response:', jsonResponse.data);
    console.log('HTTPBin Client Response:', httpbinResponse.data);
  } catch (error) {
    console.error('Multiple instances error:', error.message);
  }
}

// Example 5: Custom validation and error handling
async function customValidationExample() {
  const client = create({
    baseURL: 'https://jsonplaceholder.typicode.com',
    validateStatus: (status) => {
      // Custom validation: accept 200-299 and 404 as valid
      return (status >= 200 && status < 300) || status === 404;
    }
  });

  try {
    // This should succeed even if it returns 404
    const response = await client.get('/posts/999999'); // Non-existent post
    console.log('Custom Validation - Status:', response.status);
    console.log('Custom Validation - Data:', response.data);
  } catch (error) {
    if (FluxHTTPError.isFluxHTTPError(error)) {
      console.log('FluxHTTP Error Details:');
      console.log('- Message:', error.message);
      console.log('- Code:', error.code);
      console.log('- Status:', error.response?.status);
    } else {
      console.error('Unknown error:', error);
    }
  }
}

// Example 6: Concurrent requests with different configurations
async function concurrentRequestsExample() {
  const client = createCustomInstance();

  // Add request timing interceptor
  client.interceptors.request.use((config) => {
    config.metadata = { startTime: Date.now() };
    return config;
  });

  client.interceptors.response.use((response) => {
    const duration = Date.now() - response.config.metadata.startTime;
    console.log(`Request to ${response.config.url} took ${duration}ms`);
    return response;
  });

  try {
    const requests = [
      client.get('/posts/1'),
      client.get('/posts/2'),
      client.get('/posts/3'),
      client.get('/users/1'),
      client.get('/albums/1')
    ];

    const responses = await Promise.all(requests);
    console.log('Concurrent Requests - All completed successfully');
    console.log('Response count:', responses.length);
    
    // Show summary
    responses.forEach((response, index) => {
      console.log(`Response ${index + 1}: ${response.status} - ${response.config.url}`);
    });
  } catch (error) {
    console.error('Concurrent requests error:', error.message);
  }
}

// Example 7: Request transformation
async function requestTransformationExample() {
  const client = create({
    baseURL: 'https://jsonplaceholder.typicode.com',
    transformRequest: [
      (data, headers) => {
        // Add metadata to all requests
        if (data && typeof data === 'object') {
          data.metadata = {
            clientVersion: '1.0.0',
            timestamp: new Date().toISOString(),
            requestId: Math.random().toString(36).substr(2, 9)
          };
        }
        return JSON.stringify(data);
      }
    ],
    transformResponse: [
      (data) => {
        // Parse and enhance response data
        if (typeof data === 'string') {
          try {
            data = JSON.parse(data);
          } catch (e) {
            return data;
          }
        }
        
        if (data && typeof data === 'object') {
          data.processedAt = new Date().toISOString();
        }
        
        return data;
      }
    ]
  });

  try {
    const postData = {
      title: 'Transformed Post',
      body: 'This post data will be transformed',
      userId: 1
    };

    const response = await client.post('/posts', postData);
    console.log('Request Transformation Example - Response:', response.data);
  } catch (error) {
    console.error('Error:', error.message);
  }
}

// Run all advanced examples
async function runAdvancedExamples() {
  console.log('=== FluxHTTP Advanced Configuration Examples ===\n');

  console.log('1. Request Interceptors:');
  await requestInterceptorExample();
  console.log('\n' + '='.repeat(50) + '\n');

  console.log('2. Response Interceptors:');
  await responseInterceptorExample();
  console.log('\n' + '='.repeat(50) + '\n');

  console.log('3. Multiple Instances:');
  await multipleInstancesExample();
  console.log('\n' + '='.repeat(50) + '\n');

  console.log('4. Custom Validation:');
  await customValidationExample();
  console.log('\n' + '='.repeat(50) + '\n');

  console.log('5. Concurrent Requests:');
  await concurrentRequestsExample();
  console.log('\n' + '='.repeat(50) + '\n');

  console.log('6. Request Transformation:');
  await requestTransformationExample();
  console.log('\n' + '='.repeat(50) + '\n');
}

// Run if this file is executed directly
if (require.main === module) {
  runAdvancedExamples().catch(console.error);
}

module.exports = {
  createCustomInstance,
  requestInterceptorExample,
  responseInterceptorExample,
  multipleInstancesExample,
  customValidationExample,
  concurrentRequestsExample,
  requestTransformationExample,
  runAdvancedExamples
};