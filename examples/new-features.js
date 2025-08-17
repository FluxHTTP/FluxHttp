#!/usr/bin/env node

/**
 * Example demonstrating the new FluxHTTP features implemented in Phase 3:
 * 1. Mock Adapter
 * 2. Request Deduplication
 * 3. Retry Logic
 * 4. Connection Pooling
 */

const {
  default: fluxhttp,
  createMockAdapter,
  mockAdapter,
  createDeduplicator,
  installRetryInterceptors,
  defaultPoolManager,
  createPoolManager
} = require('../dist/index.js');

async function demonstrateNewFeatures() {
  console.log('🚀 FluxHTTP Phase 3 Features Demo\n');

  // 1. Mock Adapter Demo
  console.log('1. Mock Adapter Demo');
  console.log('===================');
  
  const mock = createMockAdapter();
  
  // Setup mock responses
  mock
    .onGet('/api/users', { status: 200, data: [{ id: 1, name: 'John Doe' }] })
    .onPost('/api/users', { status: 201, data: { id: 2, name: 'Jane Doe' } })
    .onGet(/\/api\/users\/\d+/, { status: 200, data: { id: 1, name: 'John Doe' } });

  // Create client with mock adapter
  const mockClient = fluxhttp.create({ 
    adapter: mockAdapter(mock),
    baseURL: 'https://api.example.com'
  });

  try {
    const users = await mockClient.get('/api/users');
    console.log('✅ Mock GET /api/users:', users.data);

    const newUser = await mockClient.post('/api/users', { name: 'Jane Doe' });
    console.log('✅ Mock POST /api/users:', newUser.data);

    const userDetail = await mockClient.get('/api/users/123');
    console.log('✅ Mock GET /api/users/123:', userDetail.data);
  } catch (error) {
    console.error('❌ Mock adapter error:', error.message);
  }

  // 2. Deduplication Demo
  console.log('\n2. Request Deduplication Demo');
  console.log('=============================');
  
  const deduplicator = createDeduplicator({
    enabled: true,
    maxAge: 5000, // 5 seconds
    shouldDeduplicate: (config) => config.method === 'GET'
  });

  // Setup mock for deduplication test
  mock.reset()
    .onGet('/api/data', { status: 200, data: { timestamp: Date.now() }, delay: 100 });

  const dedupeClient = fluxhttp.create({ 
    adapter: mockAdapter(mock),
    baseURL: 'https://api.example.com'
  });

  try {
    console.log('Making 3 simultaneous requests (should be deduplicated)...');
    const start = Date.now();
    
    const [result1, result2, result3] = await Promise.all([
      deduplicator.deduplicate({ url: '/api/data', method: 'GET' }, () => dedupeClient.get('/api/data')),
      deduplicator.deduplicate({ url: '/api/data', method: 'GET' }, () => dedupeClient.get('/api/data')),
      deduplicator.deduplicate({ url: '/api/data', method: 'GET' }, () => dedupeClient.get('/api/data'))
    ]);
    
    const duration = Date.now() - start;
    console.log('✅ Deduplication test completed in', duration, 'ms');
    console.log('✅ All responses have same timestamp (deduplicated):', 
      result1.data.timestamp === result2.data.timestamp && result2.data.timestamp === result3.data.timestamp);
  } catch (error) {
    console.error('❌ Deduplication error:', error.message);
  }

  // 3. Retry Logic Demo
  console.log('\n3. Retry Logic Demo');
  console.log('===================');
  
  // Setup mock that fails first 2 times, then succeeds
  let attempt = 0;
  mock.reset()
    .onGet('/api/unreliable', () => {
      attempt++;
      if (attempt < 3) {
        return { status: 500, data: { error: 'Server Error' } };
      }
      return { status: 200, data: { success: true, attempt } };
    });

  const retryClient = fluxhttp.create({ 
    adapter: mockAdapter(mock),
    baseURL: 'https://api.example.com',
    retry: {
      attempts: 3,
      delay: 100,
      backoff: 'exponential'
    }
  });

  // Install retry interceptors
  installRetryInterceptors(retryClient);

  try {
    console.log('Making request to unreliable endpoint (will retry)...');
    const result = await retryClient.get('/api/unreliable');
    console.log('✅ Retry logic worked! Success on attempt:', result.data.attempt);
  } catch (error) {
    console.error('❌ Retry logic error:', error.message);
  }

  // 4. Connection Pooling Demo
  console.log('\n4. Connection Pooling Demo');
  console.log('==========================');
  
  // Get pool statistics
  const stats = defaultPoolManager.getStats();
  console.log('✅ Default pool stats:', {
    activeSockets: stats.activeSockets,
    freeSockets: stats.freeSockets,
    totalRequests: stats.totalRequests
  });

  // Create custom pool
  const customPool = createPoolManager({
    maxSockets: 10,
    keepAlive: true,
    timeout: 30000
  });

  const customStats = customPool.getStats();
  console.log('✅ Custom pool created with stats:', {
    activeSockets: customStats.activeSockets,
    freeSockets: customStats.freeSockets,
    totalRequests: customStats.totalRequests
  });

  console.log('\n🎉 All Phase 3 features demonstrated successfully!');
}

// Run the demo
demonstrateNewFeatures().catch(console.error);