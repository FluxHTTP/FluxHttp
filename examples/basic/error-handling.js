#!/usr/bin/env node

/**
 * @fileoverview Basic error handling examples demonstrating different error scenarios
 * @description Shows how to properly handle various types of errors with fluxhttp
 */

const fluxhttp = require('../../dist/index.js').default;

console.log('🛡️  FluxHTTP Basic Error Handling Examples\n');

/**
 * Example 1: Handling HTTP error status codes (4xx, 5xx)
 */
async function handleHttpErrors() {
  console.log('📋 Example 1: Handling HTTP error status codes');
  
  const errorUrls = [
    { url: 'https://httpbin.org/status/404', description: '404 Not Found' },
    { url: 'https://httpbin.org/status/401', description: '401 Unauthorized' },
    { url: 'https://httpbin.org/status/500', description: '500 Internal Server Error' },
    { url: 'https://httpbin.org/status/503', description: '503 Service Unavailable' }
  ];

  for (const { url, description } of errorUrls) {
    try {
      const response = await fluxhttp.get(url);
      console.log(`✅ ${description}: Unexpected success`);
    } catch (error) {
      if (error.response) {
        // Server responded with error status
        console.log(`⚠️  ${description}:`);
        console.log(`   Status: ${error.response.status}`);
        console.log(`   Status Text: ${error.response.statusText}`);
        console.log(`   Message: ${error.message}`);
      } else {
        console.error(`❌ ${description}: ${error.message}`);
      }
    }
  }
  console.log();
}

/**
 * Example 2: Handling network errors and timeouts
 */
async function handleNetworkErrors() {
  console.log('📋 Example 2: Handling network errors and timeouts');
  
  // Test timeout error
  try {
    console.log('Testing timeout (should timeout in 1 second)...');
    await fluxhttp.get('https://httpbin.org/delay/5', { timeout: 1000 });
    console.log('✅ Request completed (unexpected)');
  } catch (error) {
    if (error.code === 'ECONNABORTED') {
      console.log('⏰ Timeout error handled correctly');
      console.log(`   Message: ${error.message}`);
    } else {
      console.error(`❌ Unexpected error: ${error.message}`);
    }
  }

  // Test invalid hostname
  try {
    console.log('Testing invalid hostname...');
    await fluxhttp.get('https://this-domain-does-not-exist-12345.com');
    console.log('✅ Request completed (unexpected)');
  } catch (error) {
    if (error.code === 'ENOTFOUND' || error.code === 'EAI_FAIL') {
      console.log('🌐 DNS resolution error handled correctly');
      console.log(`   Code: ${error.code}`);
      console.log(`   Message: ${error.message}`);
    } else {
      console.log(`⚠️  Network error: ${error.message}`);
    }
  }
  console.log();
}

/**
 * Example 3: Using fluxhttpError helper to identify error types
 */
async function useFluxHttpErrorHelper() {
  console.log('📋 Example 3: Using fluxhttpError helper to identify error types');
  
  try {
    await fluxhttp.get('https://httpbin.org/status/400');
  } catch (error) {
    console.log('🔍 Error analysis:');
    console.log(`   Is FluxHTTP Error: ${fluxhttp.isfluxhttpError(error)}`);
    
    if (fluxhttp.isfluxhttpError(error)) {
      console.log(`   Has Response: ${!!error.response}`);
      console.log(`   Has Request: ${!!error.request}`);
      
      if (error.response) {
        console.log(`   Response Status: ${error.response.status}`);
        console.log(`   Response Status Text: ${error.response.statusText}`);
        console.log(`   Response Headers: ${JSON.stringify(error.response.headers, null, 2)}`);
      }
      
      if (error.request && !error.response) {
        console.log('   This is a request error (no response received)');
      }
      
      if (!error.request && !error.response) {
        console.log('   This is a config/setup error');
      }
    }
  }
  console.log();
}

/**
 * Example 4: Graceful error handling with fallback strategies
 */
async function gracefulErrorHandling() {
  console.log('📋 Example 4: Graceful error handling with fallback strategies');
  
  // Primary and fallback endpoints
  const endpoints = [
    'https://httpbin.org/status/500', // This will fail
    'https://jsonplaceholder.typicode.com/posts/1' // This should work
  ];
  
  let result = null;
  let lastError = null;
  
  for (let i = 0; i < endpoints.length; i++) {
    const endpoint = endpoints[i];
    try {
      console.log(`📡 Trying endpoint ${i + 1}: ${endpoint}`);
      const response = await fluxhttp.get(endpoint);
      console.log(`✅ Success with endpoint ${i + 1}`);
      result = response.data;
      break;
    } catch (error) {
      console.log(`⚠️  Endpoint ${i + 1} failed: ${error.message}`);
      lastError = error;
      
      if (i < endpoints.length - 1) {
        console.log('🔄 Trying next endpoint...');
      }
    }
  }
  
  if (result) {
    console.log('📄 Successfully retrieved data:', typeof result);
  } else {
    console.error('❌ All endpoints failed. Last error:', lastError.message);
  }
  console.log();
}

/**
 * Example 5: Error handling with exponential backoff retry
 */
async function errorHandlingWithRetry() {
  console.log('📋 Example 5: Error handling with exponential backoff retry');
  
  async function requestWithRetry(url, maxRetries = 3) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`📡 Attempt ${attempt}/${maxRetries}: ${url}`);
        const response = await fluxhttp.get(url, { timeout: 2000 });
        console.log(`✅ Success on attempt ${attempt}`);
        return response;
      } catch (error) {
        console.log(`⚠️  Attempt ${attempt} failed: ${error.message}`);
        
        if (attempt === maxRetries) {
          console.error(`❌ All ${maxRetries} attempts failed`);
          throw error;
        }
        
        // Exponential backoff: 1s, 2s, 4s...
        const delay = Math.pow(2, attempt - 1) * 1000;
        console.log(`⏱️  Waiting ${delay}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  try {
    // This URL returns 500 50% of the time, so retries might help
    await requestWithRetry('https://httpbin.org/status/200');
  } catch (error) {
    console.error('💥 Final error after all retries:', error.message);
  }
  console.log();
}

/**
 * Example 6: Handling malformed response data
 */
async function handleMalformedData() {
  console.log('📋 Example 6: Handling malformed response data');
  
  try {
    // Request HTML content but expect JSON
    const response = await fluxhttp.get('https://httpbin.org/html');
    
    console.log('📄 Response received, checking data format...');
    console.log(`   Content-Type: ${response.headers['content-type']}`);
    console.log(`   Data type: ${typeof response.data}`);
    
    // Try to parse as JSON
    if (typeof response.data === 'string') {
      try {
        const parsed = JSON.parse(response.data);
        console.log('✅ Data successfully parsed as JSON');
      } catch (parseError) {
        console.log('⚠️  Data is not valid JSON, treating as text');
        console.log(`   First 100 characters: ${response.data.substring(0, 100)}...`);
      }
    } else {
      console.log('✅ Data is already parsed');
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
  console.log();
}

/**
 * Example 7: Error boundary pattern for multiple requests
 */
async function errorBoundaryPattern() {
  console.log('📋 Example 7: Error boundary pattern for multiple requests');
  
  const requests = [
    { name: 'Valid Request 1', url: 'https://jsonplaceholder.typicode.com/posts/1' },
    { name: 'Invalid Request', url: 'https://httpbin.org/status/404' },
    { name: 'Valid Request 2', url: 'https://jsonplaceholder.typicode.com/posts/2' },
    { name: 'Timeout Request', url: 'https://httpbin.org/delay/10', timeout: 1000 }
  ];
  
  const results = await Promise.allSettled(
    requests.map(async (req) => {
      try {
        const response = await fluxhttp.get(req.url, { timeout: req.timeout });
        return {
          name: req.name,
          status: 'success',
          data: response.data
        };
      } catch (error) {
        return {
          name: req.name,
          status: 'error',
          error: error.message,
          code: error.code
        };
      }
    })
  );
  
  console.log('📊 Results summary:');
  results.forEach((result, index) => {
    const req = requests[index];
    if (result.status === 'fulfilled') {
      const data = result.value;
      if (data.status === 'success') {
        console.log(`✅ ${data.name}: Success`);
      } else {
        console.log(`❌ ${data.name}: ${data.error}`);
      }
    } else {
      console.log(`💥 ${req.name}: Promise rejected - ${result.reason}`);
    }
  });
  
  const successful = results.filter(r => r.status === 'fulfilled' && r.value.status === 'success').length;
  const failed = results.length - successful;
  console.log(`📈 Summary: ${successful} successful, ${failed} failed`);
  console.log();
}

/**
 * Run all examples
 */
async function runAllExamples() {
  console.log('🚀 Running all error handling examples...\n');
  
  await handleHttpErrors();
  await handleNetworkErrors();
  await useFluxHttpErrorHelper();
  await gracefulErrorHandling();
  await errorHandlingWithRetry();
  await handleMalformedData();
  await errorBoundaryPattern();
  
  console.log('✨ All error handling examples completed!');
}

// Run examples if this file is executed directly
if (require.main === module) {
  runAllExamples().catch(error => {
    console.error('💥 Fatal error:', error);
    process.exit(1);
  });
}

module.exports = {
  handleHttpErrors,
  handleNetworkErrors,
  useFluxHttpErrorHelper,
  gracefulErrorHandling,
  errorHandlingWithRetry,
  handleMalformedData,
  errorBoundaryPattern,
  runAllExamples
};