#!/usr/bin/env node

/**
 * @fileoverview Mock testing examples demonstrating how to use the mock adapter for testing
 * @description Shows how to set up mock responses for unit testing and development
 */

const { create } = require('../../dist/index.js');

console.log('🎭 FluxHTTP Advanced Mock Testing Examples\n');

/**
 * Example 1: Basic mock setup and testing
 */
async function basicMockSetup() {
  console.log('📋 Example 1: Basic mock setup and testing');
  
  // Create a mock adapter for testing
  class SimpleMockAdapter {
    constructor() {
      this.mocks = new Map();
    }
    
    mock(method, url, response) {
      const key = `${method.toUpperCase()} ${url}`;
      this.mocks.set(key, response);
      console.log(`🎭 Mocked: ${key}`);
    }
    
    async request(config) {
      const key = `${(config.method || 'GET').toUpperCase()} ${config.url}`;
      const mockResponse = this.mocks.get(key);
      
      if (mockResponse) {
        console.log(`✅ Using mock response for: ${key}`);
        
        // Simulate network delay
        if (mockResponse.delay) {
          await new Promise(resolve => setTimeout(resolve, mockResponse.delay));
        }
        
        return {
          data: mockResponse.data,
          status: mockResponse.status || 200,
          statusText: mockResponse.statusText || 'OK',
          headers: mockResponse.headers || {},
          config
        };
      }
      
      throw new Error(`No mock found for: ${key}`);
    }
  }
  
  const mockAdapter = new SimpleMockAdapter();
  
  // Set up mocks
  mockAdapter.mock('GET', '/api/users', {
    status: 200,
    data: [
      { id: 1, name: 'John Doe', email: 'john@example.com' },
      { id: 2, name: 'Jane Smith', email: 'jane@example.com' }
    ],
    delay: 100
  });
  
  mockAdapter.mock('POST', '/api/users', {
    status: 201,
    data: { id: 3, name: 'New User', email: 'new@example.com' },
    headers: { 'Location': '/api/users/3' }
  });
  
  // Create client with mock adapter
  const client = create({
    baseURL: 'https://api.example.com',
    adapter: mockAdapter.request.bind(mockAdapter)
  });
  
  try {
    console.log('📡 Testing GET /api/users');
    const users = await client.get('/api/users');
    console.log('📄 Received users:', users.data.length);
    console.log('📄 First user:', users.data[0].name);
    
    console.log('📡 Testing POST /api/users');
    const newUser = await client.post('/api/users', {
      name: 'Test User',
      email: 'test@example.com'
    });
    console.log('📄 Created user ID:', newUser.data.id);
    console.log('📄 Location header:', newUser.headers.Location);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
  console.log();
}

/**
 * Example 2: Advanced mock patterns and matchers
 */
async function advancedMockPatterns() {
  console.log('📋 Example 2: Advanced mock patterns and matchers');
  
  class AdvancedMockAdapter {
    constructor() {
      this.handlers = [];
    }
    
    addHandler(pattern, response) {
      this.handlers.push({ pattern, response });
      console.log(`🎭 Added handler for pattern:`, pattern);
    }
    
    async request(config) {
      console.log(`📡 Mock adapter processing: ${config.method?.toUpperCase() || 'GET'} ${config.url}`);
      
      for (const handler of this.handlers) {
        if (this.matchesPattern(config, handler.pattern)) {
          console.log('✅ Pattern matched, generating response');
          
          const response = typeof handler.response === 'function' 
            ? handler.response(config)
            : handler.response;
          
          // Simulate delay
          if (response.delay) {
            await new Promise(resolve => setTimeout(resolve, response.delay));
          }
          
          return {
            data: response.data,
            status: response.status || 200,
            statusText: response.statusText || 'OK',
            headers: response.headers || {},
            config
          };
        }
      }
      
      throw new Error(`No mock handler found for: ${config.method?.toUpperCase() || 'GET'} ${config.url}`);
    }
    
    matchesPattern(config, pattern) {
      // Method matching
      if (pattern.method) {
        const methods = Array.isArray(pattern.method) ? pattern.method : [pattern.method];
        if (!methods.includes(config.method?.toUpperCase() || 'GET')) {
          return false;
        }
      }
      
      // URL matching (string or regex)
      if (pattern.url) {
        if (pattern.url instanceof RegExp) {
          if (!pattern.url.test(config.url)) return false;
        } else {
          if (config.url !== pattern.url) return false;
        }
      }
      
      return true;
    }
  }
  
  const mockAdapter = new AdvancedMockAdapter();
  
  // Pattern-based handlers
  mockAdapter.addHandler(
    { method: 'GET', url: /\\/api\\/users\\/\\d+/ },
    (config) => {
      const userId = config.url.match(/\\/api\\/users\\/(\\d+)/)[1];
      return {
        status: 200,
        data: {
          id: parseInt(userId),
          name: `User ${userId}`,
          email: `user${userId}@example.com`
        }
      };
    }
  );
  
  mockAdapter.addHandler(
    { method: ['POST', 'PUT'], url: /\\/api\\/.*/ },
    (config) => {
      return {
        status: config.method === 'POST' ? 201 : 200,
        data: {
          ...config.data,
          id: Math.floor(Math.random() * 1000),
          createdAt: new Date().toISOString()
        }
      };
    }
  );
  
  mockAdapter.addHandler(
    { method: 'DELETE', url: /\\/api\\/.*/ },
    {
      status: 204,
      data: null
    }
  );
  
  const client = create({
    baseURL: 'https://api.example.com',
    adapter: mockAdapter.request.bind(mockAdapter)
  });
  
  try {
    console.log('📡 Testing dynamic user endpoint');
    const user = await client.get('/api/users/42');
    console.log('📄 User data:', user.data);
    
    console.log('📡 Testing POST to API');
    const created = await client.post('/api/posts', {
      title: 'Test Post',
      content: 'This is a test post'
    });
    console.log('📄 Created:', created.data);
    
    console.log('📡 Testing DELETE');
    const deleted = await client.delete('/api/posts/123');
    console.log('📄 Delete status:', deleted.status);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
  console.log();
}

/**
 * Example 3: Simulating network conditions and errors
 */
async function networkConditionSimulation() {
  console.log('📋 Example 3: Simulating network conditions and errors');
  
  class NetworkMockAdapter {
    constructor() {
      this.scenarios = new Map();
      this.requestCount = 0;
    }
    
    addScenario(name, config) {
      this.scenarios.set(name, config);
      console.log(`🌐 Added network scenario: ${name}`);
    }
    
    async request(config) {
      this.requestCount++;
      const scenario = config.networkScenario || 'default';
      const scenarioConfig = this.scenarios.get(scenario);
      
      if (!scenarioConfig) {
        throw new Error(`Unknown network scenario: ${scenario}`);
      }
      
      console.log(`🌐 Simulating "${scenario}" network conditions (request #${this.requestCount})`);
      
      // Simulate different network conditions
      if (scenarioConfig.packetLoss && Math.random() < scenarioConfig.packetLoss) {
        console.log('📡 Simulating packet loss');
        throw new Error('Network error: Packet loss');
      }
      
      if (scenarioConfig.timeout && Math.random() < scenarioConfig.timeout) {
        console.log('⏰ Simulating timeout');
        throw new Error('Request timeout');
      }
      
      // Simulate variable latency
      const latency = scenarioConfig.baseLatency || 100;
      const jitter = scenarioConfig.jitter || 0;
      const actualLatency = latency + (Math.random() - 0.5) * 2 * jitter;
      
      console.log(`⏱️  Simulating ${Math.round(actualLatency)}ms latency`);
      await new Promise(resolve => setTimeout(resolve, actualLatency));
      
      // Simulate intermittent errors
      if (scenarioConfig.errorRate && Math.random() < scenarioConfig.errorRate) {
        const errorCodes = scenarioConfig.errorCodes || [500];
        const errorCode = errorCodes[Math.floor(Math.random() * errorCodes.length)];
        
        console.log(`❌ Simulating HTTP ${errorCode} error`);
        const error = new Error(`HTTP Error ${errorCode}`);
        error.response = { status: errorCode };
        throw error;
      }
      
      return {
        data: { message: 'Success', requestId: this.requestCount },
        status: 200,
        statusText: 'OK',
        headers: { 'X-Request-ID': this.requestCount.toString() },
        config
      };
    }
  }
  
  const networkMock = new NetworkMockAdapter();
  
  // Define network scenarios
  networkMock.addScenario('good', {
    baseLatency: 50,
    jitter: 10,
    packetLoss: 0,
    timeout: 0,
    errorRate: 0
  });
  
  networkMock.addScenario('poor', {
    baseLatency: 300,
    jitter: 100,
    packetLoss: 0.1,
    timeout: 0.05,
    errorRate: 0.2,
    errorCodes: [500, 502, 503]
  });
  
  networkMock.addScenario('mobile', {
    baseLatency: 200,
    jitter: 150,
    packetLoss: 0.02,
    timeout: 0.01,
    errorRate: 0.05
  });
  
  const createClient = (scenario) => create({
    baseURL: 'https://api.example.com',
    adapter: networkMock.request.bind(networkMock),
    networkScenario: scenario
  });
  
  const scenarios = ['good', 'mobile', 'poor'];
  
  for (const scenario of scenarios) {
    console.log(`🧪 Testing "${scenario}" network conditions:`);
    const client = createClient(scenario);
    
    let successes = 0;
    let failures = 0;
    
    for (let i = 0; i < 5; i++) {
      try {
        await client.get('/test');
        successes++;
      } catch (error) {
        failures++;
        console.log(`   ⚠️  Request ${i + 1} failed: ${error.message}`);
      }
    }
    
    console.log(`📊 Scenario "${scenario}": ${successes} successes, ${failures} failures`);
    console.log();
  }
}

/**
 * Example 4: Testing with stateful mocks
 */
async function statefulMockTesting() {
  console.log('📋 Example 4: Testing with stateful mocks');
  
  class StatefulMockAdapter {
    constructor() {
      this.state = {
        users: [
          { id: 1, name: 'John Doe', email: 'john@example.com' },
          { id: 2, name: 'Jane Smith', email: 'jane@example.com' }
        ],
        nextId: 3
      };
    }
    
    async request(config) {
      const method = config.method?.toUpperCase() || 'GET';
      const url = config.url;
      
      console.log(`📡 Stateful mock: ${method} ${url}`);
      
      // GET /users
      if (method === 'GET' && url === '/users') {
        return this.createResponse(this.state.users);
      }
      
      // GET /users/:id
      if (method === 'GET' && url.match(/\\/users\\/\\d+/)) {
        const id = parseInt(url.match(/\\/users\\/(\\d+)/)[1]);
        const user = this.state.users.find(u => u.id === id);
        
        if (user) {
          return this.createResponse(user);
        } else {
          throw this.createError(404, 'User not found');
        }
      }
      
      // POST /users
      if (method === 'POST' && url === '/users') {
        const newUser = {
          id: this.state.nextId++,
          ...config.data
        };
        
        this.state.users.push(newUser);
        console.log(`📄 Created user with ID ${newUser.id}`);
        
        return this.createResponse(newUser, 201);
      }
      
      // PUT /users/:id
      if (method === 'PUT' && url.match(/\\/users\\/\\d+/)) {
        const id = parseInt(url.match(/\\/users\\/(\\d+)/)[1]);
        const userIndex = this.state.users.findIndex(u => u.id === id);
        
        if (userIndex !== -1) {
          this.state.users[userIndex] = { id, ...config.data };
          console.log(`📄 Updated user with ID ${id}`);
          return this.createResponse(this.state.users[userIndex]);
        } else {
          throw this.createError(404, 'User not found');
        }
      }
      
      // DELETE /users/:id
      if (method === 'DELETE' && url.match(/\\/users\\/\\d+/)) {
        const id = parseInt(url.match(/\\/users\\/(\\d+)/)[1]);
        const userIndex = this.state.users.findIndex(u => u.id === id);
        
        if (userIndex !== -1) {
          this.state.users.splice(userIndex, 1);
          console.log(`📄 Deleted user with ID ${id}`);
          return this.createResponse(null, 204);
        } else {
          throw this.createError(404, 'User not found');
        }
      }
      
      throw this.createError(404, 'Endpoint not found');
    }
    
    createResponse(data, status = 200) {
      return {
        data,
        status,
        statusText: status === 200 ? 'OK' : status === 201 ? 'Created' : 'No Content',
        headers: {},
        config: {}
      };
    }
    
    createError(status, message) {
      const error = new Error(message);
      error.response = { status, data: { error: message } };
      return error;
    }
  }
  
  const statefulMock = new StatefulMockAdapter();
  const client = create({
    baseURL: 'https://api.example.com',
    adapter: statefulMock.request.bind(statefulMock)
  });
  
  try {
    console.log('📡 Getting initial users list');
    let users = await client.get('/users');
    console.log(`📄 Found ${users.data.length} users`);
    
    console.log('📡 Creating a new user');
    const newUser = await client.post('/users', {
      name: 'Alice Johnson',
      email: 'alice@example.com'
    });
    console.log(`📄 Created user: ${newUser.data.name} (ID: ${newUser.data.id})`);
    
    console.log('📡 Getting updated users list');
    users = await client.get('/users');
    console.log(`📄 Now have ${users.data.length} users`);
    
    console.log('📡 Updating the new user');
    const updatedUser = await client.put(`/users/${newUser.data.id}`, {
      name: 'Alice Johnson-Smith',
      email: 'alice.smith@example.com'
    });
    console.log(`📄 Updated user name: ${updatedUser.data.name}`);
    
    console.log('📡 Deleting the user');
    await client.delete(`/users/${newUser.data.id}`);
    console.log('📄 User deleted successfully');
    
    console.log('📡 Getting final users list');
    users = await client.get('/users');
    console.log(`📄 Back to ${users.data.length} users`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
  console.log();
}

/**
 * Example 5: Testing error scenarios and edge cases
 */
async function errorScenarioTesting() {
  console.log('📋 Example 5: Testing error scenarios and edge cases');
  
  class ErrorMockAdapter {
    constructor() {
      this.requestCount = 0;
    }
    
    async request(config) {
      this.requestCount++;
      const url = config.url;
      
      console.log(`📡 Error mock: ${config.method?.toUpperCase() || 'GET'} ${url} (request #${this.requestCount})`);
      
      // Simulate rate limiting
      if (url.includes('/rate-limited')) {
        if (this.requestCount % 3 === 0) {
          const error = new Error('Too Many Requests');
          error.response = {
            status: 429,
            headers: { 'Retry-After': '5' },
            data: { error: 'Rate limit exceeded' }
          };
          throw error;
        }
      }
      
      // Simulate authentication errors
      if (url.includes('/protected')) {
        if (!config.headers?.Authorization) {
          const error = new Error('Unauthorized');
          error.response = {
            status: 401,
            data: { error: 'Authentication required' }
          };
          throw error;
        }
        
        if (config.headers.Authorization === 'Bearer invalid-token') {
          const error = new Error('Forbidden');
          error.response = {
            status: 403,
            data: { error: 'Invalid token' }
          };
          throw error;
        }
      }
      
      // Simulate validation errors
      if (url.includes('/validate') && config.data) {
        const errors = [];
        
        if (!config.data.email || !config.data.email.includes('@')) {
          errors.push('Invalid email format');
        }
        
        if (!config.data.name || config.data.name.length < 2) {
          errors.push('Name must be at least 2 characters');
        }
        
        if (errors.length > 0) {
          const error = new Error('Validation failed');
          error.response = {
            status: 400,
            data: { errors }
          };
          throw error;
        }
      }
      
      // Simulate server errors
      if (url.includes('/server-error')) {
        const error = new Error('Internal Server Error');
        error.response = {
          status: 500,
          data: { error: 'Something went wrong on our end' }
        };
        throw error;
      }
      
      return {
        data: { message: 'Success', url },
        status: 200,
        statusText: 'OK',
        headers: {},
        config
      };
    }
  }
  
  const errorMock = new ErrorMockAdapter();
  const client = create({
    baseURL: 'https://api.example.com',
    adapter: errorMock.request.bind(errorMock)
  });
  
  // Test rate limiting
  console.log('🧪 Testing rate limiting:');
  for (let i = 1; i <= 4; i++) {
    try {
      await client.get('/rate-limited');
      console.log(`✅ Request ${i} succeeded`);
    } catch (error) {
      console.log(`❌ Request ${i} failed: ${error.message}`);
      if (error.response?.headers?.['Retry-After']) {
        console.log(`   Retry-After: ${error.response.headers['Retry-After']}s`);
      }
    }
  }
  console.log();
  
  // Test authentication
  console.log('🧪 Testing authentication:');
  try {
    await client.get('/protected');
  } catch (error) {
    console.log(`❌ No auth: ${error.message}`);
  }
  
  try {
    await client.get('/protected', {
      headers: { Authorization: 'Bearer invalid-token' }
    });
  } catch (error) {
    console.log(`❌ Invalid token: ${error.message}`);
  }
  
  try {
    await client.get('/protected', {
      headers: { Authorization: 'Bearer valid-token' }
    });
    console.log('✅ Valid token succeeded');
  } catch (error) {
    console.log(`❌ Valid token failed: ${error.message}`);
  }
  console.log();
  
  // Test validation
  console.log('🧪 Testing validation:');
  try {
    await client.post('/validate', {
      name: 'A',
      email: 'invalid-email'
    });
  } catch (error) {
    console.log(`❌ Validation failed: ${error.response.data.errors.join(', ')}`);
  }
  
  try {
    await client.post('/validate', {
      name: 'Valid Name',
      email: 'valid@example.com'
    });
    console.log('✅ Validation passed');
  } catch (error) {
    console.log(`❌ Validation unexpectedly failed: ${error.message}`);
  }
  console.log();
}

/**
 * Run all examples
 */
async function runAllExamples() {
  console.log('🚀 Running all mock testing examples...\n');
  
  await basicMockSetup();
  await advancedMockPatterns();
  await networkConditionSimulation();
  await statefulMockTesting();
  await errorScenarioTesting();
  
  console.log('✨ All mock testing examples completed!');
}

// Run examples if this file is executed directly
if (require.main === module) {
  runAllExamples().catch(error => {
    console.error('💥 Fatal error:', error);
    process.exit(1);
  });
}

module.exports = {
  basicMockSetup,
  advancedMockPatterns,
  networkConditionSimulation,
  statefulMockTesting,
  errorScenarioTesting,
  runAllExamples
};