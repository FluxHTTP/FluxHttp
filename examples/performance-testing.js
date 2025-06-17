/**
 * FluxHTTP Performance Testing Examples
 * Demonstrates performance testing and optimization strategies
 */

const fluxhttp = require('../dist/index.js').default;
const { create } = require('../dist/index.js');

// Performance measurement utility
class PerformanceTimer {
  constructor(name) {
    this.name = name;
    this.startTime = null;
    this.endTime = null;
  }

  start() {
    this.startTime = process.hrtime.bigint();
    return this;
  }

  stop() {
    this.endTime = process.hrtime.bigint();
    return this;
  }

  getDuration() {
    if (!this.startTime || !this.endTime) {
      throw new Error('Timer not properly started or stopped');
    }
    return Number(this.endTime - this.startTime) / 1000000; // Convert to milliseconds
  }

  log() {
    console.log(`${this.name}: ${this.getDuration().toFixed(2)}ms`);
    return this;
  }
}

// Example 1: Single request performance
async function singleRequestPerformance() {
  const timer = new PerformanceTimer('Single GET Request');
  
  timer.start();
  try {
    const response = await fluxhttp.get('https://jsonplaceholder.typicode.com/posts/1');
    timer.stop().log();
    console.log('Response size:', JSON.stringify(response.data).length, 'bytes');
    console.log('Status:', response.status);
  } catch (error) {
    timer.stop();
    console.error('Error:', error.message);
  }
}

// Example 2: Concurrent requests performance
async function concurrentRequestsPerformance() {
  const numRequests = 10;
  const timer = new PerformanceTimer(`${numRequests} Concurrent Requests`);
  
  const requests = Array.from({ length: numRequests }, (_, i) => 
    fluxhttp.get(`https://jsonplaceholder.typicode.com/posts/${i + 1}`)
  );

  timer.start();
  try {
    const responses = await Promise.all(requests);
    timer.stop().log();
    
    console.log('All requests completed successfully');
    console.log('Average response size:', 
      responses.reduce((sum, r) => sum + JSON.stringify(r.data).length, 0) / responses.length, 
      'bytes'
    );
    console.log('Requests per second:', (numRequests / (timer.getDuration() / 1000)).toFixed(2));
  } catch (error) {
    timer.stop();
    console.error('Error in concurrent requests:', error.message);
  }
}

// Example 3: Sequential vs concurrent comparison
async function sequentialVsConcurrentComparison() {
  const urls = [
    'https://jsonplaceholder.typicode.com/posts/1',
    'https://jsonplaceholder.typicode.com/posts/2',
    'https://jsonplaceholder.typicode.com/posts/3',
    'https://jsonplaceholder.typicode.com/posts/4',
    'https://jsonplaceholder.typicode.com/posts/5'
  ];

  // Sequential requests
  const sequentialTimer = new PerformanceTimer('Sequential Requests');
  sequentialTimer.start();
  try {
    const sequentialResults = [];
    for (const url of urls) {
      const response = await fluxhttp.get(url);
      sequentialResults.push(response);
    }
    sequentialTimer.stop();
    console.log('Sequential completed:', sequentialResults.length, 'requests');
  } catch (error) {
    sequentialTimer.stop();
    console.error('Sequential error:', error.message);
  }

  // Concurrent requests
  const concurrentTimer = new PerformanceTimer('Concurrent Requests');
  concurrentTimer.start();
  try {
    const concurrentResults = await Promise.all(urls.map(url => fluxhttp.get(url)));
    concurrentTimer.stop();
    console.log('Concurrent completed:', concurrentResults.length, 'requests');
  } catch (error) {
    concurrentTimer.stop();
    console.error('Concurrent error:', error.message);
  }

  // Comparison
  const sequentialTime = sequentialTimer.getDuration();
  const concurrentTime = concurrentTimer.getDuration();
  const speedup = sequentialTime / concurrentTime;

  console.log('\nPerformance Comparison:');
  console.log(`Sequential: ${sequentialTime.toFixed(2)}ms`);
  console.log(`Concurrent: ${concurrentTime.toFixed(2)}ms`);
  console.log(`Speedup: ${speedup.toFixed(2)}x faster`);
}

// Example 4: Instance creation overhead
async function instanceCreationOverhead() {
  const numInstances = 100;
  
  // Test default instance usage
  const defaultTimer = new PerformanceTimer('Default Instance Usage');
  defaultTimer.start();
  try {
    const promises = Array.from({ length: numInstances }, () => 
      fluxhttp.get('https://jsonplaceholder.typicode.com/posts/1')
    );
    await Promise.all(promises);
    defaultTimer.stop().log();
  } catch (error) {
    defaultTimer.stop();
    console.error('Default instance error:', error.message);
  }

  // Test new instance creation
  const newInstanceTimer = new PerformanceTimer('New Instance Creation');
  newInstanceTimer.start();
  try {
    const promises = Array.from({ length: numInstances }, () => {
      const client = create({ baseURL: 'https://jsonplaceholder.typicode.com' });
      return client.get('/posts/1');
    });
    await Promise.all(promises);
    newInstanceTimer.stop().log();
  } catch (error) {
    newInstanceTimer.stop();
    console.error('New instance error:', error.message);
  }
}

// Example 5: Payload size impact
async function payloadSizeImpact() {
  const baseUrl = 'https://jsonplaceholder.typicode.com/posts';
  
  // Small payload
  const smallPayload = { title: 'Small', body: 'Small body', userId: 1 };
  const smallTimer = new PerformanceTimer('Small Payload POST');
  smallTimer.start();
  try {
    await fluxhttp.post(baseUrl, smallPayload);
    smallTimer.stop().log();
  } catch (error) {
    smallTimer.stop();
    console.error('Small payload error:', error.message);
  }

  // Large payload
  const largePayload = {
    title: 'Large payload test',
    body: 'x'.repeat(10000), // 10KB of data
    userId: 1,
    metadata: Array.from({ length: 100 }, (_, i) => ({
      id: i,
      value: `Item ${i}`,
      data: 'x'.repeat(100)
    }))
  };
  const largeTimer = new PerformanceTimer('Large Payload POST');
  largeTimer.start();
  try {
    await fluxhttp.post(baseUrl, largePayload);
    largeTimer.stop().log();
  } catch (error) {
    largeTimer.stop();
    console.error('Large payload error:', error.message);
  }

  console.log('Small payload size:', JSON.stringify(smallPayload).length, 'bytes');
  console.log('Large payload size:', JSON.stringify(largePayload).length, 'bytes');
}

// Example 6: Interceptor overhead
async function interceptorOverhead() {
  const client = create({
    baseURL: 'https://jsonplaceholder.typicode.com'
  });

  // Test without interceptors
  const noInterceptorTimer = new PerformanceTimer('No Interceptors');
  noInterceptorTimer.start();
  try {
    await Promise.all(Array.from({ length: 10 }, () => client.get('/posts/1')));
    noInterceptorTimer.stop().log();
  } catch (error) {
    noInterceptorTimer.stop();
    console.error('No interceptor error:', error.message);
  }

  // Add multiple interceptors
  const requestInterceptors = [];
  const responseInterceptors = [];

  for (let i = 0; i < 5; i++) {
    requestInterceptors.push(
      client.interceptors.request.use(config => {
        config.headers = config.headers || {};
        config.headers[`X-Interceptor-${i}`] = `value-${i}`;
        return config;
      })
    );

    responseInterceptors.push(
      client.interceptors.response.use(response => {
        response.data.interceptor = response.data.interceptor || [];
        response.data.interceptor.push(`processed-${i}`);
        return response;
      })
    );
  }

  // Test with interceptors
  const withInterceptorTimer = new PerformanceTimer('With 10 Interceptors');
  withInterceptorTimer.start();
  try {
    await Promise.all(Array.from({ length: 10 }, () => client.get('/posts/1')));
    withInterceptorTimer.stop().log();
  } catch (error) {
    withInterceptorTimer.stop();
    console.error('With interceptor error:', error.message);
  }

  // Clean up interceptors
  requestInterceptors.forEach(id => client.interceptors.request.eject(id));
  responseInterceptors.forEach(id => client.interceptors.response.eject(id));

  const overhead = withInterceptorTimer.getDuration() - noInterceptorTimer.getDuration();
  console.log(`Interceptor overhead: ${overhead.toFixed(2)}ms`);
}

// Example 7: Memory and resource monitoring
async function memoryMonitoring() {
  function getMemoryUsage() {
    const usage = process.memoryUsage();
    return {
      heapUsed: Math.round(usage.heapUsed / 1024 / 1024 * 100) / 100,
      heapTotal: Math.round(usage.heapTotal / 1024 / 1024 * 100) / 100,
      external: Math.round(usage.external / 1024 / 1024 * 100) / 100,
      rss: Math.round(usage.rss / 1024 / 1024 * 100) / 100
    };
  }

  console.log('Initial memory usage:', getMemoryUsage());

  // Create many instances and make requests
  const instances = [];
  for (let i = 0; i < 50; i++) {
    instances.push(create({ baseURL: `https://jsonplaceholder.typicode.com` }));
  }

  console.log('After creating 50 instances:', getMemoryUsage());

  // Make requests with all instances
  const promises = instances.map((client, i) => client.get(`/posts/${i % 10 + 1}`));
  await Promise.all(promises);

  console.log('After making 50 requests:', getMemoryUsage());

  // Cleanup
  instances.length = 0;
  if (global.gc) {
    global.gc();
    console.log('After garbage collection:', getMemoryUsage());
  } else {
    console.log('Garbage collection not available (run with --expose-gc)');
  }
}

// Example 8: Comprehensive performance benchmark
async function performanceBenchmark() {
  console.log('Running FluxHTTP Performance Benchmark...\n');

  const testSuites = [
    {
      name: 'Single Request',
      test: () => fluxhttp.get('https://jsonplaceholder.typicode.com/posts/1'),
      iterations: 10
    },
    {
      name: 'Concurrent Requests (5x)',
      test: () => Promise.all([
        fluxhttp.get('https://jsonplaceholder.typicode.com/posts/1'),
        fluxhttp.get('https://jsonplaceholder.typicode.com/posts/2'),
        fluxhttp.get('https://jsonplaceholder.typicode.com/posts/3'),
        fluxhttp.get('https://jsonplaceholder.typicode.com/posts/4'),
        fluxhttp.get('https://jsonplaceholder.typicode.com/posts/5')
      ]),
      iterations: 5
    },
    {
      name: 'POST Request',
      test: () => fluxhttp.post('https://jsonplaceholder.typicode.com/posts', {
        title: 'Test Post',
        body: 'Test body',
        userId: 1
      }),
      iterations: 5
    }
  ];

  for (const suite of testSuites) {
    console.log(`\n${suite.name}:`);
    const times = [];

    for (let i = 0; i < suite.iterations; i++) {
      const timer = new PerformanceTimer(`Iteration ${i + 1}`);
      timer.start();
      try {
        await suite.test();
        timer.stop();
        times.push(timer.getDuration());
      } catch (error) {
        timer.stop();
        console.error(`Iteration ${i + 1} failed:`, error.message);
        times.push(null);
      }
    }

    const validTimes = times.filter(t => t !== null);
    if (validTimes.length > 0) {
      const avg = validTimes.reduce((sum, time) => sum + time, 0) / validTimes.length;
      const min = Math.min(...validTimes);
      const max = Math.max(...validTimes);

      console.log(`Average: ${avg.toFixed(2)}ms`);
      console.log(`Min: ${min.toFixed(2)}ms`);
      console.log(`Max: ${max.toFixed(2)}ms`);
      console.log(`Success rate: ${(validTimes.length / suite.iterations * 100).toFixed(1)}%`);
    } else {
      console.log('All iterations failed');
    }
  }
}

// Run all performance examples
async function runPerformanceExamples() {
  console.log('=== FluxHTTP Performance Testing Examples ===\n');

  console.log('1. Single Request Performance:');
  await singleRequestPerformance();
  console.log('\n' + '='.repeat(50) + '\n');

  console.log('2. Concurrent Requests Performance:');
  await concurrentRequestsPerformance();
  console.log('\n' + '='.repeat(50) + '\n');

  console.log('3. Sequential vs Concurrent Comparison:');
  await sequentialVsConcurrentComparison();
  console.log('\n' + '='.repeat(50) + '\n');

  console.log('4. Instance Creation Overhead:');
  await instanceCreationOverhead();
  console.log('\n' + '='.repeat(50) + '\n');

  console.log('5. Payload Size Impact:');
  await payloadSizeImpact();
  console.log('\n' + '='.repeat(50) + '\n');

  console.log('6. Interceptor Overhead:');
  await interceptorOverhead();
  console.log('\n' + '='.repeat(50) + '\n');

  console.log('7. Memory Monitoring:');
  await memoryMonitoring();
  console.log('\n' + '='.repeat(50) + '\n');

  console.log('8. Comprehensive Benchmark:');
  await performanceBenchmark();
  console.log('\n' + '='.repeat(50) + '\n');
}

// Run if this file is executed directly
if (require.main === module) {
  runPerformanceExamples().catch(console.error);
}

module.exports = {
  PerformanceTimer,
  singleRequestPerformance,
  concurrentRequestsPerformance,
  sequentialVsConcurrentComparison,
  instanceCreationOverhead,
  payloadSizeImpact,
  interceptorOverhead,
  memoryMonitoring,
  performanceBenchmark,
  runPerformanceExamples
};