/**
 * fluxhttp Basic Usage Examples
 * Demonstrates fundamental HTTP operations
 */

const fluxhttp = require('../dist/index.js').default;

// Example 1: Simple GET request
async function basicGet() {
  try {
    const response = await fluxhttp.get('https://jsonplaceholder.typicode.com/posts/1');
    console.log('GET Response:', response.data);
    console.log('Status:', response.status);
    console.log('Headers:', response.headers);
  } catch (error) {
    console.error('Error:', error.message);
  }
}

// Example 2: POST request with data
async function basicPost() {
  try {
    const postData = {
      title: 'fluxhttp Test Post',
      body: 'This is a test post created with fluxhttp',
      userId: 1
    };

    const response = await fluxhttp.post('https://jsonplaceholder.typicode.com/posts', postData);
    console.log('POST Response:', response.data);
    console.log('Status:', response.status);
  } catch (error) {
    console.error('Error:', error.message);
  }
}

// Example 3: PUT request to update data
async function basicPut() {
  try {
    const updateData = {
      id: 1,
      title: 'Updated fluxhttp Post',
      body: 'This post has been updated using fluxhttp PUT method',
      userId: 1
    };

    const response = await fluxhttp.put('https://jsonplaceholder.typicode.com/posts/1', updateData);
    console.log('PUT Response:', response.data);
  } catch (error) {
    console.error('Error:', error.message);
  }
}

// Example 4: DELETE request
async function basicDelete() {
  try {
    const response = await fluxhttp.delete('https://jsonplaceholder.typicode.com/posts/1');
    console.log('DELETE Response Status:', response.status);
    console.log('DELETE Response:', response.data);
  } catch (error) {
    console.error('Error:', error.message);
  }
}

// Example 5: Request with custom headers
async function requestWithHeaders() {
  try {
    const config = {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer your-token-here',
        'X-Custom-Header': 'fluxhttp-Example'
      }
    };

    const response = await fluxhttp.get('https://jsonplaceholder.typicode.com/posts', config);
    console.log('Headers Example - Response:', response.data.slice(0, 2)); // Show first 2 posts
  } catch (error) {
    console.error('Error:', error.message);
  }
}

// Example 6: Request with query parameters
async function requestWithParams() {
  try {
    const config = {
      params: {
        userId: 1,
        _limit: 3
      }
    };

    const response = await fluxhttp.get('https://jsonplaceholder.typicode.com/posts', config);
    console.log('Query Params Example - Response:', response.data);
  } catch (error) {
    console.error('Error:', error.message);
  }
}

// Example 7: Request with timeout
async function requestWithTimeout() {
  try {
    const config = {
      timeout: 5000 // 5 second timeout
    };

    const response = await fluxhttp.get('https://jsonplaceholder.typicode.com/posts/1', config);
    console.log('Timeout Example - Response:', response.data);
  } catch (error) {
    if (error.code === 'ETIMEDOUT') {
      console.log('Request timed out after 5 seconds');
    } else {
      console.error('Error:', error.message);
    }
  }
}

// Run all examples
async function runBasicExamples() {
  console.log('=== fluxhttp Basic Usage Examples ===\n');

  console.log('1. Basic GET Request:');
  await basicGet();
  console.log('\n' + '='.repeat(50) + '\n');

  console.log('2. Basic POST Request:');
  await basicPost();
  console.log('\n' + '='.repeat(50) + '\n');

  console.log('3. Basic PUT Request:');
  await basicPut();
  console.log('\n' + '='.repeat(50) + '\n');

  console.log('4. Basic DELETE Request:');
  await basicDelete();
  console.log('\n' + '='.repeat(50) + '\n');

  console.log('5. Request with Custom Headers:');
  await requestWithHeaders();
  console.log('\n' + '='.repeat(50) + '\n');

  console.log('6. Request with Query Parameters:');
  await requestWithParams();
  console.log('\n' + '='.repeat(50) + '\n');

  console.log('7. Request with Timeout:');
  await requestWithTimeout();
  console.log('\n' + '='.repeat(50) + '\n');
}

// Run if this file is executed directly
if (require.main === module) {
  runBasicExamples().catch(console.error);
}

module.exports = {
  basicGet,
  basicPost,
  basicPut,
  basicDelete,
  requestWithHeaders,
  requestWithParams,
  requestWithTimeout,
  runBasicExamples
};