#!/usr/bin/env node

/**
 * @fileoverview Basic POST request examples with different data types
 * @description Shows how to make POST requests with various data formats using fluxhttp
 */

const fluxhttp = require('../../dist/index.js').default;

console.log('📬 FluxHTTP Basic POST Request Examples\n');

/**
 * Example 1: Simple POST request with JSON data
 */
async function simplePostRequest() {
  console.log('📋 Example 1: Simple POST request with JSON data');
  try {
    const postData = {
      title: 'My New Post',
      body: 'This is the content of my new post.',
      userId: 1
    };

    const response = await fluxhttp.post('https://jsonplaceholder.typicode.com/posts', postData);
    console.log('✅ Status:', response.status);
    console.log('📄 Created post ID:', response.data.id);
    console.log('📄 Response data:', response.data);
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
  console.log();
}

/**
 * Example 2: POST request with custom headers
 */
async function postWithHeaders() {
  console.log('📋 Example 2: POST request with custom headers');
  try {
    const userData = {
      name: 'John Doe',
      email: 'john.doe@example.com',
      company: 'FluxHTTP Corp'
    };

    const response = await fluxhttp.post('https://httpbin.org/post', userData, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer fake-token-123',
        'X-API-Version': '1.0',
        'User-Agent': 'FluxHTTP-Example/1.0'
      }
    });

    console.log('✅ Status:', response.status);
    console.log('📄 Server received data:', response.data.json);
    console.log('📄 Server received headers:', response.data.headers);
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
  console.log();
}

/**
 * Example 3: POST request with form data (URL-encoded)
 */
async function postFormData() {
  console.log('📋 Example 3: POST request with form data (URL-encoded)');
  try {
    const formData = new URLSearchParams();
    formData.append('username', 'johndoe');
    formData.append('email', 'john@example.com');
    formData.append('age', '30');
    formData.append('preferences', 'newsletter');
    formData.append('preferences', 'updates');

    const response = await fluxhttp.post('https://httpbin.org/post', formData, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    console.log('✅ Status:', response.status);
    console.log('📄 Server received form:', response.data.form);
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
  console.log();
}

/**
 * Example 4: POST request with plain text data
 */
async function postTextData() {
  console.log('📋 Example 4: POST request with plain text data');
  try {
    const textData = `
This is a plain text message
that will be sent as the request body.
It can contain multiple lines
and special characters: !@#$%^&*()
    `.trim();

    const response = await fluxhttp.post('https://httpbin.org/post', textData, {
      headers: {
        'Content-Type': 'text/plain'
      }
    });

    console.log('✅ Status:', response.status);
    console.log('📄 Server received text:', response.data.data);
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
  console.log();
}

/**
 * Example 5: POST request with timeout and error handling
 */
async function postWithTimeout() {
  console.log('📋 Example 5: POST request with timeout (2 seconds)');
  try {
    const delayData = { message: 'This request should complete quickly' };
    
    const response = await fluxhttp.post('https://httpbin.org/delay/1', delayData, {
      timeout: 2000, // 2 seconds
      headers: {
        'Content-Type': 'application/json'
      }
    });

    console.log('✅ Status:', response.status);
    console.log('📄 Request completed within timeout');
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
 * Example 6: POST request with response validation
 */
async function postWithValidation() {
  console.log('📋 Example 6: POST request with response validation');
  try {
    const newUser = {
      name: 'Jane Smith',
      username: 'janesmith',
      email: 'jane.smith@example.com',
      phone: '555-0123',
      website: 'https://janesmith.dev',
      company: {
        name: 'TechCorp',
        catchPhrase: 'Innovative solutions'
      }
    };

    const response = await fluxhttp.post('https://jsonplaceholder.typicode.com/users', newUser);
    
    // Validate response
    if (response.status === 201 && response.data && response.data.id) {
      console.log('✅ User created successfully');
      console.log('📄 New user ID:', response.data.id);
      console.log('📄 User name:', response.data.name);
      console.log('📄 User email:', response.data.email);
    } else {
      console.log('⚠️  Unexpected response format');
      console.log('📄 Response:', response.data);
    }
  } catch (error) {
    console.error('❌ Error creating user:', error.message);
    if (error.response) {
      console.error('📄 Error details:', error.response.data);
    }
  }
  console.log();
}

/**
 * Example 7: POST request with nested JSON data
 */
async function postNestedJson() {
  console.log('📋 Example 7: POST request with nested JSON data');
  try {
    const complexData = {
      user: {
        profile: {
          firstName: 'Alice',
          lastName: 'Johnson',
          dateOfBirth: '1990-05-15'
        },
        preferences: {
          theme: 'dark',
          notifications: {
            email: true,
            push: false,
            sms: true
          },
          privacy: {
            profileVisible: true,
            searchable: false
          }
        },
        metadata: {
          createdAt: new Date().toISOString(),
          source: 'api',
          version: '1.0'
        }
      },
      tags: ['developer', 'javascript', 'node.js'],
      settings: {
        autoSave: true,
        maxRetries: 3
      }
    };

    const response = await fluxhttp.post('https://httpbin.org/post', complexData);
    
    console.log('✅ Status:', response.status);
    console.log('📄 Data structure preserved:', typeof response.data.json === 'object');
    console.log('📄 User first name:', response.data.json.user.profile.firstName);
    console.log('📄 Tags count:', response.data.json.tags.length);
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
  console.log();
}

/**
 * Example 8: Multiple concurrent POST requests
 */
async function concurrentPostRequests() {
  console.log('📋 Example 8: Multiple concurrent POST requests');
  try {
    const posts = [
      { title: 'First Post', body: 'Content of first post', userId: 1 },
      { title: 'Second Post', body: 'Content of second post', userId: 2 },
      { title: 'Third Post', body: 'Content of third post', userId: 3 }
    ];

    const startTime = Date.now();
    const responses = await Promise.all(
      posts.map(post => 
        fluxhttp.post('https://jsonplaceholder.typicode.com/posts', post)
      )
    );
    const endTime = Date.now();

    console.log(`✅ Created ${responses.length} posts in ${endTime - startTime}ms`);
    responses.forEach((response, index) => {
      console.log(`📄 Post ${index + 1} ID: ${response.data.id}, Title: "${response.data.title}"`);
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
  console.log('🚀 Running all POST request examples...\n');
  
  await simplePostRequest();
  await postWithHeaders();
  await postFormData();
  await postTextData();
  await postWithTimeout();
  await postWithValidation();
  await postNestedJson();
  await concurrentPostRequests();
  
  console.log('✨ All POST request examples completed!');
}

// Run examples if this file is executed directly
if (require.main === module) {
  runAllExamples().catch(error => {
    console.error('💥 Fatal error:', error);
    process.exit(1);
  });
}

module.exports = {
  simplePostRequest,
  postWithHeaders,
  postFormData,
  postTextData,
  postWithTimeout,
  postWithValidation,
  postNestedJson,
  concurrentPostRequests,
  runAllExamples
};