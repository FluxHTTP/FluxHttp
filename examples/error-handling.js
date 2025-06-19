/**
 * fluxhttp Error Handling Examples
 * Demonstrates comprehensive error handling strategies
 */

const fluxhttp = require('../dist/index.js').default;
const { create, fluxhttpError } = require('../dist/index.js');

// Example 1: Basic error handling
async function basicErrorHandling() {
  try {
    // This will likely fail due to non-existent domain
    const response = await fluxhttp.get('https://non-existent-domain-12345.com');
    console.log('Response:', response.data);
  } catch (error) {
    if (fluxhttpError.isfluxhttpError(error)) {
      console.log('fluxhttp Error caught:');
      console.log('- Message:', error.message);
      console.log('- Code:', error.code);
      console.log('- Is fluxhttp Error:', error.isfluxhttpError);
    } else {
      console.log('Non-fluxhttp error:', error.message);
    }
  }
}

// Example 2: HTTP status code errors
async function statusCodeErrorHandling() {
  try {
    // This should return 404
    const response = await fluxhttp.get('https://jsonplaceholder.typicode.com/posts/999999');
    console.log('Response:', response.data);
  } catch (error) {
    if (fluxhttpError.isfluxhttpError(error)) {
      console.log('HTTP Status Error:');
      console.log('- Status Code:', error.response?.status);
      console.log('- Status Text:', error.response?.statusText);
      console.log('- Response Data:', error.response?.data);
      console.log('- Error Code:', error.code);
    }
  }
}

// Example 3: Timeout errors
async function timeoutErrorHandling() {
  try {
    // Set a very short timeout to force timeout error
    const response = await fluxhttp.get('https://jsonplaceholder.typicode.com/posts', {
      timeout: 1 // 1ms timeout - will definitely timeout
    });
    console.log('Response:', response.data);
  } catch (error) {
    if (error.code === 'ETIMEDOUT') {
      console.log('Timeout Error:');
      console.log('- Message:', error.message);
      console.log('- Timeout was:', error.config?.timeout, 'ms');
    } else {
      console.log('Other error:', error.message, error.code);
    }
  }
}

// Example 4: Network errors
async function networkErrorHandling() {
  try {
    // Try to connect to a local server that doesn't exist
    const response = await fluxhttp.get('http://localhost:99999');
    console.log('Response:', response.data);
  } catch (error) {
    if (error.code === 'ERR_NETWORK') {
      console.log('Network Error:');
      console.log('- Message:', error.message);
      console.log('- Code:', error.code);
      console.log('- Config URL:', error.config?.url);
    } else {
      console.log('Other network error:', error.message, error.code);
    }
  }
}

// Example 5: Request cancellation
async function requestCancellationHandling() {
  const controller = new AbortController();
  
  // Cancel the request after 100ms
  setTimeout(() => {
    controller.abort();
  }, 100);

  try {
    const response = await fluxhttp.get('https://jsonplaceholder.typicode.com/posts', {
      signal: controller.signal
    });
    console.log('Response:', response.data);
  } catch (error) {
    if (error.code === 'ERR_CANCELED') {
      console.log('Request Cancelled:');
      console.log('- Message:', error.message);
      console.log('- Code:', error.code);
    } else {
      console.log('Other cancellation error:', error.message, error.code);
    }
  }
}

// Example 6: Custom error handling with interceptors
async function interceptorErrorHandling() {
  const client = create({
    baseURL: 'https://jsonplaceholder.typicode.com'
  });

  // Add error handling interceptor
  client.interceptors.response.use(
    (response) => response,
    (error) => {
      console.log('Interceptor caught error:');
      
      if (error.response) {
        // Server responded with error status
        const { status, data } = error.response;
        console.log(`- Server Error: ${status}`);
        
        switch (status) {
          case 404:
            error.message = 'Resource not found. Please check the URL.';
            break;
          case 401:
            error.message = 'Authentication required. Please login.';
            break;
          case 403:
            error.message = 'Access forbidden. Insufficient permissions.';
            break;
          case 500:
            error.message = 'Server error. Please try again later.';
            break;
          default:
            error.message = `Server returned ${status}: ${data}`;
        }
      } else if (error.request) {
        // Request was made but no response received
        error.message = 'No response received. Check your internet connection.';
      } else {
        // Something else happened
        error.message = 'Request setup failed: ' + error.message;
      }
      
      return Promise.reject(error);
    }
  );

  try {
    const response = await client.get('/posts/999999');
    console.log('Response:', response.data);
  } catch (error) {
    console.log('Enhanced error message:', error.message);
  }
}

// Example 7: Error recovery and retry logic
async function errorRecoveryExample() {
  const client = create({
    baseURL: 'https://jsonplaceholder.typicode.com'
  });

  async function makeRequestWithRetry(url, maxRetries = 3) {
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`Attempt ${attempt} of ${maxRetries}`);
        const response = await client.get(url);
        console.log(`Success on attempt ${attempt}`);
        return response;
      } catch (error) {
        lastError = error;
        console.log(`Attempt ${attempt} failed:`, error.message);
        
        // Don't retry on certain errors
        if (error.response?.status === 404 || error.code === 'ERR_CANCELED') {
          console.log('Non-retryable error, stopping retries');
          break;
        }
        
        // Wait before retrying (exponential backoff)
        if (attempt < maxRetries) {
          const delay = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s...
          console.log(`Waiting ${delay}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    throw lastError;
  }

  try {
    // This should succeed immediately
    const response = await makeRequestWithRetry('/posts/1');
    console.log('Final response:', response.data.title);
  } catch (error) {
    console.log('All retries failed:', error.message);
  }
}

// Example 8: Comprehensive error information
async function comprehensiveErrorInfo() {
  try {
    const response = await fluxhttp.post('https://jsonplaceholder.typicode.com/posts/invalid', {
      title: 'Test'
    });
    console.log('Response:', response.data);
  } catch (error) {
    console.log('Comprehensive Error Information:');
    console.log('- Error Type:', error.constructor.name);
    console.log('- Is fluxhttp Error:', fluxhttpError.isfluxhttpError(error));
    console.log('- Message:', error.message);
    console.log('- Code:', error.code);
    console.log('- Stack:', error.stack?.split('\n')[0]);
    
    if (error.config) {
      console.log('- Request Config:');
      console.log('  - Method:', error.config.method);
      console.log('  - URL:', error.config.url);
      console.log('  - Headers:', Object.keys(error.config.headers || {}));
    }
    
    if (error.response) {
      console.log('- Response:');
      console.log('  - Status:', error.response.status);
      console.log('  - Status Text:', error.response.statusText);
      console.log('  - Headers:', Object.keys(error.response.headers || {}));
    }
    
    // Test error serialization
    console.log('- Serialized Error:', JSON.stringify(error.toJSON(), null, 2));
  }
}

// Run all error handling examples
async function runErrorHandlingExamples() {
  console.log('=== fluxhttp Error Handling Examples ===\n');

  console.log('1. Basic Error Handling:');
  await basicErrorHandling();
  console.log('\n' + '='.repeat(50) + '\n');

  console.log('2. HTTP Status Code Errors:');
  await statusCodeErrorHandling();
  console.log('\n' + '='.repeat(50) + '\n');

  console.log('3. Timeout Errors:');
  await timeoutErrorHandling();
  console.log('\n' + '='.repeat(50) + '\n');

  console.log('4. Network Errors:');
  await networkErrorHandling();
  console.log('\n' + '='.repeat(50) + '\n');

  console.log('5. Request Cancellation:');
  await requestCancellationHandling();
  console.log('\n' + '='.repeat(50) + '\n');

  console.log('6. Interceptor Error Handling:');
  await interceptorErrorHandling();
  console.log('\n' + '='.repeat(50) + '\n');

  console.log('7. Error Recovery with Retry:');
  await errorRecoveryExample();
  console.log('\n' + '='.repeat(50) + '\n');

  console.log('8. Comprehensive Error Information:');
  await comprehensiveErrorInfo();
  console.log('\n' + '='.repeat(50) + '\n');
}

// Run if this file is executed directly
if (require.main === module) {
  runErrorHandlingExamples().catch(console.error);
}

module.exports = {
  basicErrorHandling,
  statusCodeErrorHandling,
  timeoutErrorHandling,
  networkErrorHandling,
  requestCancellationHandling,
  interceptorErrorHandling,
  errorRecoveryExample,
  comprehensiveErrorInfo,
  runErrorHandlingExamples
};