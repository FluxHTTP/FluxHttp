import { fluxhttp } from './src/index';

// Basic GET request
async function basicExample() {
  try {
    const response = await fluxhttp.get('https://jsonplaceholder.typicode.com/posts/1');
    console.log('Response:', response.data);
  } catch (error) {
    console.error('Error:', error);
  }
}

// Creating an instance with custom config
async function instanceExample() {
  const client = fluxhttp.create({
    baseURL: 'https://jsonplaceholder.typicode.com',
    timeout: 5000,
    headers: {
      'X-Custom-Header': 'FluxHTTP',
    },
  });

  // Add request interceptor
  client.interceptors.request.use(
    (config) => {
      console.log('Request:', config.method, config.url);
      return config;
    },
    (error) => {
      console.error('Request error:', error);
      return Promise.reject(error);
    }
  );

  // Add response interceptor
  client.interceptors.response.use(
    (response) => {
      console.log('Response status:', response.status);
      return response;
    },
    (error) => {
      console.error('Response error:', error);
      return Promise.reject(error);
    }
  );

  // Make requests
  const posts = await client.get('/posts', { params: { _limit: 5 } });
  console.log('Posts:', posts.data);

  const newPost = await client.post('/posts', {
    title: 'FluxHTTP Test',
    body: 'This is a test post created with FluxHTTP',
    userId: 1,
  });
  console.log('Created post:', newPost.data);
}

// Error handling example
async function errorHandlingExample() {
  try {
    await fluxhttp.get('https://jsonplaceholder.typicode.com/invalid-endpoint');
  } catch (error) {
    if (fluxhttp.isFluxHTTPError(error)) {
      console.log('FluxHTTP error details:');
      console.log('- Status:', error.response?.status);
      console.log('- Status Text:', error.response?.statusText);
      console.log('- Config:', error.config);
    }
  }
}

// Run examples
(async () => {
  console.log('=== Basic Example ===');
  await basicExample();
  
  console.log('\n=== Instance Example ===');
  await instanceExample();
  
  console.log('\n=== Error Handling Example ===');
  await errorHandlingExample();
})();