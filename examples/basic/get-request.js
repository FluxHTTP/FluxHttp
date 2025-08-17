#!/usr/bin/env node

/**
 * @fileoverview Basic GET request examples demonstrating different patterns
 * @description Shows how to make simple GET requests with fluxhttp
 */

const fluxhttp = require('../../dist/index.js').default;

console.log('🌐 FluxHTTP Basic GET Request Examples\n');

/**
 * Example 1: Simple GET request
 */
async function simpleGetRequest() {
  console.log('📋 Example 1: Simple GET request');
  try {
    const response = await fluxhttp.get('https://jsonplaceholder.typicode.com/posts/1');
    console.log('✅ Status:', response.status);
    console.log('📄 Data:', response.data);
    console.log('📊 Headers:', response.headers);
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
  console.log();
}

/**
 * Example 2: GET request with query parameters
 */
async function getWithQueryParams() {
  console.log('📋 Example 2: GET request with query parameters');
  try {
    const response = await fluxhttp.get('https://jsonplaceholder.typicode.com/posts', {
      params: {
        userId: 1,
        _limit: 3
      }
    });
    console.log('✅ Status:', response.status);
    console.log('📄 Posts count:', response.data.length);
    console.log('📄 First post:', response.data[0]);
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
  console.log();
}

/**
 * Example 3: GET request with custom headers
 */
async function getWithHeaders() {
  console.log('📋 Example 3: GET request with custom headers');
  try {
    const response = await fluxhttp.get('https://httpbin.org/headers', {
      headers: {
        'User-Agent': 'FluxHTTP-Example/1.0',
        'X-Custom-Header': 'custom-value',
        'Accept': 'application/json'
      }
    });
    console.log('✅ Status:', response.status);
    console.log('📄 Server received headers:', response.data.headers);
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
  console.log();
}

/**
 * Example 4: GET request with timeout
 */
async function getWithTimeout() {
  console.log('📋 Example 4: GET request with timeout (3 seconds)');
  try {
    const response = await fluxhttp.get('https://httpbin.org/delay/1', {
      timeout: 3000 // 3 seconds
    });
    console.log('✅ Status:', response.status);
    console.log('📄 Response time within timeout');
  } catch (error) {
    if (error.code === 'ECONNABORTED') {
      console.error('⏰ Request timed out');
    } else {
      console.error('❌ Error:', error.message);
    }
  }
  console.log();
}

/**
 * Example 5: GET request to API that returns different status codes
 */
async function getWithStatusCodes() {
  console.log('📋 Example 5: Testing different HTTP status codes');
  
  const statusCodes = [200, 404, 500];
  
  for (const code of statusCodes) {
    try {
      const response = await fluxhttp.get(`https://httpbin.org/status/${code}`);
      console.log(`✅ Status ${code}: Success`);
    } catch (error) {
      if (error.response) {
        console.log(`⚠️  Status ${code}: ${error.response.status} - ${error.message}`);
      } else {
        console.error(`❌ Status ${code}: ${error.message}`);
      }
    }
  }
  console.log();
}

/**
 * Example 6: GET request with response interceptor simulation
 */
async function getWithResponseValidation() {
  console.log('📋 Example 6: GET request with response validation');
  try {
    const response = await fluxhttp.get('https://jsonplaceholder.typicode.com/users/1');
    
    // Validate response structure
    if (response.data && typeof response.data === 'object') {
      console.log('✅ Response validation passed');
      console.log('📄 User name:', response.data.name);
      console.log('📄 User email:', response.data.email);
      console.log('📄 User website:', response.data.website);
    } else {
      console.log('⚠️  Unexpected response format');
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
  console.log();
}

/**
 * Example 7: Multiple concurrent GET requests
 */
async function concurrentGetRequests() {
  console.log('📋 Example 7: Multiple concurrent GET requests');
  try {
    const urls = [
      'https://jsonplaceholder.typicode.com/posts/1',
      'https://jsonplaceholder.typicode.com/posts/2',
      'https://jsonplaceholder.typicode.com/posts/3'
    ];

    const startTime = Date.now();
    const responses = await Promise.all(
      urls.map(url => fluxhttp.get(url))
    );
    const endTime = Date.now();

    console.log(`✅ Completed ${responses.length} requests in ${endTime - startTime}ms`);
    responses.forEach((response, index) => {
      console.log(`📄 Post ${index + 1} title: "${response.data.title}"`);
    });
  } catch (error) {
    console.error('❌ Error in concurrent requests:', error.message);
  }
  console.log();
}

/**
 * Run all examples
 */
async function runAllExamples() {
  console.log('🚀 Running all GET request examples...\n');
  
  await simpleGetRequest();
  await getWithQueryParams();
  await getWithHeaders();
  await getWithTimeout();
  await getWithStatusCodes();
  await getWithResponseValidation();
  await concurrentGetRequests();
  
  console.log('✨ All GET request examples completed!');
}

// Run examples if this file is executed directly
if (require.main === module) {
  runAllExamples().catch(error => {
    console.error('💥 Fatal error:', error);
    process.exit(1);
  });
}

module.exports = {
  simpleGetRequest,
  getWithQueryParams,
  getWithHeaders,
  getWithTimeout,
  getWithStatusCodes,
  getWithResponseValidation,
  concurrentGetRequests,
  runAllExamples
};