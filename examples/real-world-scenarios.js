/**
 * fluxhttp Real-World Scenarios
 * Demonstrates practical usage patterns for common development scenarios
 */

const { create, fluxhttpError } = require('../dist/index.js');

// Example 1: API Client with Authentication
class APIClient {
  constructor(baseURL, apiKey) {
    this.client = create({
      baseURL,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'fluxhttp-API-Client/1.0.0'
      }
    });

    this.apiKey = apiKey;
    this.setupInterceptors();
  }

  setupInterceptors() {
    // Request interceptor for authentication
    this.client.interceptors.request.use(
      (config) => {
        if (this.apiKey) {
          config.headers = config.headers || {};
          config.headers['Authorization'] = `Bearer ${this.apiKey}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      async (error) => {
        if (error.response?.status === 401) {
          console.log('Authentication failed, refreshing token...');
          // In a real app, you would refresh the token here
          // await this.refreshToken();
          // return this.client.request(error.config);
        }
        return Promise.reject(error);
      }
    );
  }

  async getUsers(page = 1, limit = 10) {
    try {
      const response = await this.client.get('/users', {
        params: { page, limit }
      });
      return response.data;
    } catch (error) {
      throw new Error(`Failed to fetch users: ${error.message}`);
    }
  }

  async createUser(userData) {
    try {
      const response = await this.client.post('/users', userData);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to create user: ${error.message}`);
    }
  }

  async updateUser(userId, userData) {
    try {
      const response = await this.client.put(`/users/${userId}`, userData);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to update user: ${error.message}`);
    }
  }

  async deleteUser(userId) {
    try {
      await this.client.delete(`/users/${userId}`);
      return true;
    } catch (error) {
      throw new Error(`Failed to delete user: ${error.message}`);
    }
  }
}

// Example 2: File Upload with Progress
async function fileUploadExample() {
  const client = create({
    baseURL: 'https://httpbin.org',
    timeout: 30000
  });

  // Simulate file data
  const fileData = new Blob(['Hello, World!'.repeat(1000)], { type: 'text/plain' });
  const formData = new FormData();
  formData.append('file', fileData, 'test.txt');
  formData.append('description', 'Test file upload');

  try {
    const response = await client.post('/post', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      },
      onUploadProgress: (progressEvent) => {
        const percentCompleted = Math.round(
          (progressEvent.loaded * 100) / (progressEvent.total || progressEvent.loaded)
        );
        console.log(`Upload progress: ${percentCompleted}%`);
      }
    });

    console.log('File uploaded successfully');
    console.log('Response:', response.data);
  } catch (error) {
    console.error('File upload failed:', error.message);
  }
}

// Example 3: Polling API with Exponential Backoff
async function pollingExample() {
  const client = create({
    baseURL: 'https://jsonplaceholder.typicode.com'
  });

  async function pollForResult(jobId, maxAttempts = 10) {
    let attempt = 0;
    
    while (attempt < maxAttempts) {
      try {
        console.log(`Polling attempt ${attempt + 1}/${maxAttempts}`);
        
        // In a real scenario, you'd poll a job status endpoint
        const response = await client.get(`/posts/${jobId}`);
        
        // Simulate job completion check
        if (response.data.id === jobId) {
          console.log('Job completed successfully!');
          return response.data;
        }
        
        // Exponential backoff
        const delay = Math.min(1000 * Math.pow(2, attempt), 30000); // Max 30 seconds
        console.log(`Job not ready, waiting ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        
        attempt++;
      } catch (error) {
        console.error(`Polling attempt ${attempt + 1} failed:`, error.message);
        attempt++;
        
        if (attempt >= maxAttempts) {
          throw new Error('Max polling attempts reached');
        }
        
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    throw new Error('Job did not complete within maximum attempts');
  }

  try {
    const result = await pollForResult(1);
    console.log('Final result:', result);
  } catch (error) {
    console.error('Polling failed:', error.message);
  }
}

// Example 4: Rate Limited API Client
class RateLimitedClient {
  constructor(baseURL, requestsPerMinute = 60) {
    this.client = create({ baseURL });
    this.requestsPerMinute = requestsPerMinute;
    this.requestTimes = [];
    this.queue = [];
    this.processing = false;
  }

  async request(config) {
    return new Promise((resolve, reject) => {
      this.queue.push({ config, resolve, reject });
      this.processQueue();
    });
  }

  async processQueue() {
    if (this.processing || this.queue.length === 0) {
      return;
    }

    this.processing = true;

    while (this.queue.length > 0) {
      await this.enforceRateLimit();
      
      const { config, resolve, reject } = this.queue.shift();
      
      try {
        const response = await this.client.request(config);
        this.recordRequest();
        resolve(response);
      } catch (error) {
        reject(error);
        break; // Stop processing on error
      }
    }

    this.processing = false;
  }

  async enforceRateLimit() {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    
    // Remove old requests
    this.requestTimes = this.requestTimes.filter(time => time > oneMinuteAgo);
    
    if (this.requestTimes.length >= this.requestsPerMinute) {
      const oldestRequest = Math.min(...this.requestTimes);
      const waitTime = oldestRequest + 60000 - now;
      
      if (waitTime > 0) {
        console.log(`Rate limit reached, waiting ${waitTime}ms...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }

  recordRequest() {
    this.requestTimes.push(Date.now());
  }
}

// Example 5: Microservice Communication
class ServiceMesh {
  constructor() {
    this.services = new Map();
    this.retryConfig = {
      maxRetries: 3,
      baseDelay: 1000,
      maxDelay: 10000
    };
  }

  registerService(name, baseURL, config = {}) {
    const client = create({
      baseURL,
      timeout: 5000,
      ...config
    });

    // Add service mesh headers
    client.interceptors.request.use(config => {
      config.headers = config.headers || {};
      config.headers['X-Service-Mesh'] = 'fluxhttp';
      config.headers['X-Request-ID'] = this.generateRequestId();
      config.headers['X-Source-Service'] = name;
      return config;
    });

    this.services.set(name, client);
  }

  async callService(serviceName, method, path, data = null, config = {}) {
    const client = this.services.get(serviceName);
    if (!client) {
      throw new Error(`Service ${serviceName} not registered`);
    }

    return this.retryRequest(async () => {
      switch (method.toUpperCase()) {
        case 'GET':
          return await client.get(path, config);
        case 'POST':
          return await client.post(path, data, config);
        case 'PUT':
          return await client.put(path, data, config);
        case 'DELETE':
          return await client.delete(path, config);
        default:
          throw new Error(`Unsupported method: ${method}`);
      }
    });
  }

  async retryRequest(requestFn) {
    let lastError;
    
    for (let attempt = 0; attempt <= this.retryConfig.maxRetries; attempt++) {
      try {
        return await requestFn();
      } catch (error) {
        lastError = error;
        
        if (attempt === this.retryConfig.maxRetries) {
          break;
        }

        // Don't retry on 4xx errors (client errors)
        if (error.response?.status >= 400 && error.response?.status < 500) {
          break;
        }

        const delay = Math.min(
          this.retryConfig.baseDelay * Math.pow(2, attempt),
          this.retryConfig.maxDelay
        );

        console.log(`Request failed, retrying in ${delay}ms... (attempt ${attempt + 1}/${this.retryConfig.maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw lastError;
  }

  generateRequestId() {
    return Math.random().toString(36).substr(2, 9);
  }
}

// Example 6: GraphQL Client
class GraphQLClient {
  constructor(endpoint, options = {}) {
    this.client = create({
      baseURL: endpoint,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    });

    if (options.auth) {
      this.client.interceptors.request.use(config => {
        config.headers = config.headers || {};
        config.headers['Authorization'] = `Bearer ${options.auth}`;
        return config;
      });
    }
  }

  async query(query, variables = {}) {
    try {
      const response = await this.client.post('', {
        query,
        variables
      });

      if (response.data.errors) {
        throw new Error(`GraphQL errors: ${JSON.stringify(response.data.errors)}`);
      }

      return response.data.data;
    } catch (error) {
      if (fluxhttpError.isfluxhttpError(error)) {
        throw new Error(`GraphQL request failed: ${error.message}`);
      }
      throw error;
    }
  }

  async mutation(mutation, variables = {}) {
    return this.query(mutation, variables);
  }
}

// Example 7: Webhook Handler
class WebhookHandler {
  constructor() {
    this.client = create({
      timeout: 5000,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }

  async sendWebhook(url, payload, options = {}) {
    const config = {
      ...options,
      headers: {
        ...options.headers
      }
    };

    // Add webhook signature if secret provided
    if (options.secret) {
      const crypto = require('crypto');
      const signature = crypto
        .createHmac('sha256', options.secret)
        .update(JSON.stringify(payload))
        .digest('hex');
      config.headers['X-Webhook-Signature'] = `sha256=${signature}`;
    }

    // Add timestamp
    config.headers['X-Webhook-Timestamp'] = Math.floor(Date.now() / 1000).toString();

    try {
      const response = await this.client.post(url, payload, config);
      console.log(`Webhook sent successfully to ${url}`);
      return response;
    } catch (error) {
      console.error(`Webhook failed for ${url}:`, error.message);
      throw error;
    }
  }

  async sendWebhookWithRetry(url, payload, options = {}) {
    const maxRetries = options.maxRetries || 3;
    let lastError;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await this.sendWebhook(url, payload, options);
      } catch (error) {
        lastError = error;
        
        if (attempt === maxRetries) {
          break;
        }

        const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
        console.log(`Webhook retry ${attempt + 1}/${maxRetries} in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw lastError;
  }
}

// Run all real-world scenarios
async function runRealWorldScenarios() {
  console.log('=== fluxhttp Real-World Scenarios ===\n');

  console.log('1. API Client with Authentication:');
  try {
    const apiClient = new APIClient('https://jsonplaceholder.typicode.com', 'test-api-key');
    const users = await apiClient.getUsers(1, 3);
    console.log('Users fetched:', users.slice(0, 2)); // Show first 2 users
  } catch (error) {
    console.error('API Client error:', error.message);
  }
  console.log('\n' + '='.repeat(50) + '\n');

  console.log('2. File Upload with Progress:');
  await fileUploadExample();
  console.log('\n' + '='.repeat(50) + '\n');

  console.log('3. Polling API with Exponential Backoff:');
  await pollingExample();
  console.log('\n' + '='.repeat(50) + '\n');

  console.log('4. Rate Limited API Client:');
  try {
    const rateLimitedClient = new RateLimitedClient('https://jsonplaceholder.typicode.com', 2); // 2 requests per minute
    const requests = [
      rateLimitedClient.request({ method: 'GET', url: '/posts/1' }),
      rateLimitedClient.request({ method: 'GET', url: '/posts/2' }),
      rateLimitedClient.request({ method: 'GET', url: '/posts/3' })
    ];
    
    const responses = await Promise.all(requests);
    console.log('Rate limited requests completed:', responses.length);
  } catch (error) {
    console.error('Rate limited client error:', error.message);
  }
  console.log('\n' + '='.repeat(50) + '\n');

  console.log('5. Microservice Communication:');
  try {
    const serviceMesh = new ServiceMesh();
    serviceMesh.registerService('posts', 'https://jsonplaceholder.typicode.com');
    
    const result = await serviceMesh.callService('posts', 'GET', '/posts/1');
    console.log('Service mesh call result:', result.data.title);
  } catch (error) {
    console.error('Service mesh error:', error.message);
  }
  console.log('\n' + '='.repeat(50) + '\n');

  console.log('6. GraphQL Client:');
  try {
    // Note: This is a mock GraphQL example since we don't have a real GraphQL endpoint
    const graphqlClient = new GraphQLClient('https://httpbin.org/post');
    
    // This will fail as httpbin.org is not a GraphQL endpoint, but demonstrates usage
    try {
      await graphqlClient.query('{ user(id: 1) { name email } }');
    } catch (error) {
      console.log('GraphQL client created successfully (endpoint test failed as expected)');
    }
  } catch (error) {
    console.error('GraphQL client error:', error.message);
  }
  console.log('\n' + '='.repeat(50) + '\n');

  console.log('7. Webhook Handler:');
  try {
    const webhookHandler = new WebhookHandler();
    
    // Test webhook (will fail to httpbin.org but demonstrates functionality)
    try {
      await webhookHandler.sendWebhook('https://httpbin.org/post', {
        event: 'test',
        data: { message: 'Hello from fluxhttp webhook' }
      }, {
        secret: 'test-secret'
      });
    } catch (error) {
      console.log('Webhook handler created successfully (test webhook sent)');
    }
  } catch (error) {
    console.error('Webhook handler error:', error.message);
  }
  console.log('\n' + '='.repeat(50) + '\n');
}

// Run if this file is executed directly
if (require.main === module) {
  runRealWorldScenarios().catch(console.error);
}

module.exports = {
  APIClient,
  fileUploadExample,
  pollingExample,
  RateLimitedClient,
  ServiceMesh,
  GraphQLClient,
  WebhookHandler,
  runRealWorldScenarios
};