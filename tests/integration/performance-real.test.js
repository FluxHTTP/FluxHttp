const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');

// Import the main library
const fluxhttpModule = require('../../dist/index.js');
const fluxhttp = fluxhttpModule.default || fluxhttpModule;

/**
 * Real Performance Integration Tests
 * Tests performance characteristics with real HTTP endpoints
 * 
 * Note: These tests make real network requests and may be affected by network conditions
 */

/**
 * Helper function to parse JSON response data
 * Handles both string and object responses from different adapters
 */
function parseResponseData(data) {
  if (typeof data === 'string') {
    try {
      return JSON.parse(data);
    } catch {
      return data;
    }
  }
  return data;
}

describe('Real Performance Integration Tests', () => {
  let client;
  const HTTPBIN_BASE = 'https://httpbin.org';
  const REQUEST_TIMEOUT = 30000; // 30 second timeout for performance tests

  beforeEach(() => {
    client = fluxhttp.create({
      baseURL: HTTPBIN_BASE,
      timeout: REQUEST_TIMEOUT,
      headers: {
        'User-Agent': 'FluxHTTP-Performance-Test/1.0.0'
      }
    });
  });

  afterEach(() => {
    if (global.gc) {
      global.gc();
    }
  });

  describe('Request latency and throughput', () => {
    it('should handle single request with acceptable latency', async () => {
      const startTime = Date.now();
      
      const response = await client.get('/get');
      
      const endTime = Date.now();
      const latency = endTime - startTime;
      
      assert.strictEqual(response.status, 200);
      assert(latency < 10000, `Request latency should be reasonable: ${latency}ms`);
      
      console.log(`Single request latency: ${latency}ms`);
    });

    it('should measure request overhead', async () => {
      const measurements = [];
      const iterations = 5;
      
      for (let i = 0; i < iterations; i++) {
        const startTime = process.hrtime.bigint();
        
        const response = await client.get(`/get?iteration=${i}`);
        
        const endTime = process.hrtime.bigint();
        const duration = Number(endTime - startTime) / 1000000; // Convert to milliseconds
        
        measurements.push({
          iteration: i,
          duration,
          status: response.status
        });
        
        assert.strictEqual(response.status, 200);
        
        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      const avgDuration = measurements.reduce((sum, m) => sum + m.duration, 0) / iterations;
      const minDuration = Math.min(...measurements.map(m => m.duration));
      const maxDuration = Math.max(...measurements.map(m => m.duration));
      
      console.log(`Average request duration: ${avgDuration.toFixed(2)}ms`);
      console.log(`Min duration: ${minDuration.toFixed(2)}ms`);
      console.log(`Max duration: ${maxDuration.toFixed(2)}ms`);
      
      assert(avgDuration < 5000, `Average duration should be reasonable: ${avgDuration}ms`);
    });

    it('should handle sequential requests efficiently', async () => {
      const requestCount = 10;
      const startTime = Date.now();
      
      for (let i = 0; i < requestCount; i++) {
        const response = await client.get(`/get?seq=${i}`);
        assert.strictEqual(response.status, 200);
      }
      
      const endTime = Date.now();
      const totalTime = endTime - startTime;
      const avgTimePerRequest = totalTime / requestCount;
      
      console.log(`Sequential requests: ${requestCount} requests in ${totalTime}ms`);
      console.log(`Average time per request: ${avgTimePerRequest.toFixed(2)}ms`);
      
      assert(totalTime < 30000, `Sequential requests should complete in reasonable time: ${totalTime}ms`);
    });

    it('should measure throughput with parallel requests', async () => {
      const requestCount = 20;
      const startTime = Date.now();
      
      const promises = [];
      for (let i = 0; i < requestCount; i++) {
        promises.push(client.get(`/get?parallel=${i}`));
      }
      
      const responses = await Promise.all(promises);
      
      const endTime = Date.now();
      const totalTime = endTime - startTime;
      const requestsPerSecond = (requestCount / totalTime) * 1000;
      
      console.log(`Parallel requests: ${requestCount} requests in ${totalTime}ms`);
      console.log(`Throughput: ${requestsPerSecond.toFixed(2)} requests/second`);
      
      // Verify all responses are successful
      responses.forEach((response, index) => {
        assert.strictEqual(response.status, 200);
        assert.strictEqual(parseResponseData(response.data).args.parallel, String(index));
      });
      
      assert(totalTime < 15000, `Parallel requests should complete faster: ${totalTime}ms`);
      assert(requestsPerSecond > 1, `Should achieve reasonable throughput: ${requestsPerSecond} req/s`);
    });
  });

  describe('Data transfer performance', () => {
    it('should handle small payload efficiently', async () => {
      const payload = { message: 'Hello World', timestamp: Date.now() };
      const startTime = Date.now();
      
      const response = await client.post('/post', payload);
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      assert.strictEqual(response.status, 200);
      assert.deepStrictEqual(parseResponseData(response.data).json, payload);
      
      console.log(`Small payload POST duration: ${duration}ms`);
      assert(duration < 5000, `Small payload should be fast: ${duration}ms`);
    });

    it('should handle medium payload transfer', async () => {
      const mediumData = {
        users: Array.from({ length: 100 }, (_, i) => ({
          id: i,
          name: `User ${i}`,
          email: `user${i}@example.com`,
          metadata: {
            created: new Date().toISOString(),
            active: true,
            preferences: {
              theme: 'dark',
              notifications: true,
              language: 'en'
            }
          }
        }))
      };
      
      const startTime = Date.now();
      
      const response = await client.post('/post', mediumData);
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      const payloadSize = JSON.stringify(mediumData).length;
      
      assert.strictEqual(response.status, 200);
      assert.strictEqual(parseResponseData(response.data).json.users.length, 100);
      
      console.log(`Medium payload (${payloadSize} bytes) duration: ${duration}ms`);
      console.log(`Transfer rate: ${(payloadSize / duration * 1000 / 1024).toFixed(2)} KB/s`);
      
      assert(duration < 10000, `Medium payload should transfer reasonably: ${duration}ms`);
    });

    it('should handle large text payload', async () => {
      const largeText = 'x'.repeat(50000); // 50KB of text
      const startTime = Date.now();
      
      const response = await client.post('/post', largeText, {
        headers: {
          'Content-Type': 'text/plain'
        }
      });
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      const payloadSize = largeText.length;
      
      assert.strictEqual(response.status, 200);
      assert.strictEqual(parseResponseData(response.data).data, largeText);
      
      console.log(`Large text payload (${payloadSize} bytes) duration: ${duration}ms`);
      console.log(`Upload rate: ${(payloadSize / duration * 1000 / 1024).toFixed(2)} KB/s`);
      
      assert(duration < 15000, `Large text should transfer in reasonable time: ${duration}ms`);
    });

    it('should measure download performance', async () => {
      const startTime = Date.now();
      
      // Download a moderately sized response
      const response = await client.get('/stream-bytes/10000'); // 10KB
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      const responseSize = response.data ? parseResponseData(response.data).length || Buffer.byteLength(response.data, 'utf8') : 0;
      
      assert.strictEqual(response.status, 200);
      
      console.log(`Download (${responseSize} bytes) duration: ${duration}ms`);
      if (responseSize > 0) {
        console.log(`Download rate: ${(responseSize / duration * 1000 / 1024).toFixed(2)} KB/s`);
      }
      
      assert(duration < 10000, `Download should complete in reasonable time: ${duration}ms`);
    });
  });

  describe('Memory usage and efficiency', () => {
    it('should not leak memory during multiple requests', async () => {
      const initialMemory = process.memoryUsage();
      
      // Make many requests to test memory stability
      for (let i = 0; i < 50; i++) {
        const response = await client.get(`/get?memory-test=${i}`);
        assert.strictEqual(response.status, 200);
        
        // Periodic garbage collection hint
        if (i % 10 === 0 && global.gc) {
          global.gc();
        }
      }
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
        // Wait a bit for cleanup
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      const finalMemory = process.memoryUsage();
      const heapIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      const heapIncreaseKB = heapIncrease / 1024;
      
      console.log(`Initial heap: ${(initialMemory.heapUsed / 1024).toFixed(2)} KB`);
      console.log(`Final heap: ${(finalMemory.heapUsed / 1024).toFixed(2)} KB`);
      console.log(`Heap increase: ${heapIncreaseKB.toFixed(2)} KB`);
      
      // Memory increase should be reasonable (less than 5MB for 50 requests)
      assert(heapIncrease < 5 * 1024 * 1024, `Memory increase should be minimal: ${heapIncreaseKB.toFixed(2)} KB`);
    });

    it('should handle rapid request creation and cleanup', async () => {
      const initialMemory = process.memoryUsage();
      const requestCount = 100;
      
      // Create many requests rapidly
      const promises = [];
      for (let i = 0; i < requestCount; i++) {
        promises.push(client.get(`/get?rapid=${i}`));
      }
      
      const responses = await Promise.all(promises);
      
      // Verify all succeeded
      responses.forEach((response, index) => {
        assert.strictEqual(response.status, 200);
        assert.strictEqual(parseResponseData(response.data).args.rapid, String(index));
      });
      
      // Force cleanup
      if (global.gc) {
        global.gc();
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      const finalMemory = process.memoryUsage();
      const heapIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      
      console.log(`Rapid requests memory increase: ${(heapIncrease / 1024).toFixed(2)} KB for ${requestCount} requests`);
      
      // Should not use excessive memory for rapid requests
      assert(heapIncrease < 10 * 1024 * 1024, `Memory usage should be reasonable for ${requestCount} requests`);
    });
  });

  describe('Caching and optimization', () => {
    it('should benefit from connection reuse', async () => {
      const persistentClient = fluxhttp.create({
        baseURL: HTTPBIN_BASE,
        timeout: REQUEST_TIMEOUT,
        headers: {
          'User-Agent': 'FluxHTTP-Persistent-Test/1.0.0',
          'Connection': 'keep-alive'
        }
      });

      const requestCount = 10;
      const measurements = [];
      
      for (let i = 0; i < requestCount; i++) {
        const startTime = Date.now();
        
        const response = await persistentClient.get(`/get?persistent=${i}`);
        
        const endTime = Date.now();
        const duration = endTime - startTime;
        
        measurements.push(duration);
        assert.strictEqual(response.status, 200);
        
        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      
      const firstHalf = measurements.slice(0, 5);
      const secondHalf = measurements.slice(5);
      
      const avgFirstHalf = firstHalf.reduce((sum, d) => sum + d, 0) / firstHalf.length;
      const avgSecondHalf = secondHalf.reduce((sum, d) => sum + d, 0) / secondHalf.length;
      
      console.log(`First half average: ${avgFirstHalf.toFixed(2)}ms`);
      console.log(`Second half average: ${avgSecondHalf.toFixed(2)}ms`);
      
      // Later requests should potentially be faster due to connection reuse
      // This is not guaranteed due to network variability, so we just log the results
      console.log('Connection reuse test completed (results may vary due to network conditions)');
    });

    it('should handle concurrent requests to same endpoint efficiently', async () => {
      const endpoint = '/get?concurrent=true';
      const concurrentCount = 15;
      const startTime = Date.now();
      
      const promises = Array.from({ length: concurrentCount }, (_, i) =>
        client.get(`${endpoint}&request=${i}`)
      );
      
      const responses = await Promise.all(promises);
      
      const endTime = Date.now();
      const totalTime = endTime - startTime;
      const avgTimePerRequest = totalTime / concurrentCount;
      
      console.log(`Concurrent requests to same endpoint: ${concurrentCount} requests in ${totalTime}ms`);
      console.log(`Average time per request: ${avgTimePerRequest.toFixed(2)}ms`);
      
      // Verify all responses
      responses.forEach((response, index) => {
        assert.strictEqual(response.status, 200);
        assert.strictEqual(parseResponseData(response.data).args.concurrent, 'true');
        assert.strictEqual(parseResponseData(response.data).args.request, String(index));
      });
      
      // Concurrent requests should be significantly faster than sequential
      const estimatedSequentialTime = concurrentCount * 1000; // Rough estimate
      assert(totalTime < estimatedSequentialTime * 0.8, 'Concurrent requests should be faster than sequential');
    });
  });

  describe('Stress testing', () => {
    it('should handle burst of requests without degradation', async () => {
      const burstSize = 25;
      const measurements = [];
      
      // First burst
      let startTime = Date.now();
      let promises = Array.from({ length: burstSize }, (_, i) =>
        client.get(`/get?burst1=${i}`)
      );
      let responses = await Promise.all(promises);
      let endTime = Date.now();
      
      measurements.push({
        burst: 1,
        time: endTime - startTime,
        avgPerRequest: (endTime - startTime) / burstSize
      });
      
      // Verify responses
      responses.forEach(response => assert.strictEqual(response.status, 200));
      
      // Wait between bursts
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Second burst
      startTime = Date.now();
      promises = Array.from({ length: burstSize }, (_, i) =>
        client.get(`/get?burst2=${i}`)
      );
      responses = await Promise.all(promises);
      endTime = Date.now();
      
      measurements.push({
        burst: 2,
        time: endTime - startTime,
        avgPerRequest: (endTime - startTime) / burstSize
      });
      
      // Verify responses
      responses.forEach(response => assert.strictEqual(response.status, 200));
      
      console.log(`Burst 1: ${measurements[0].time}ms (avg: ${measurements[0].avgPerRequest.toFixed(2)}ms/req)`);
      console.log(`Burst 2: ${measurements[1].time}ms (avg: ${measurements[1].avgPerRequest.toFixed(2)}ms/req)`);
      
      // Performance should not degrade significantly between bursts
      const degradation = measurements[1].avgPerRequest / measurements[0].avgPerRequest;
      console.log(`Performance ratio (burst2/burst1): ${degradation.toFixed(2)}`);
      
      assert(degradation < 2.0, 'Performance should not degrade significantly between bursts');
    });

    it('should maintain performance under sustained load', async () => {
      const sustainedCount = 100;
      const batchSize = 10;
      const measurements = [];
      
      for (let batch = 0; batch < sustainedCount / batchSize; batch++) {
        const startTime = Date.now();
        
        const promises = Array.from({ length: batchSize }, (_, i) =>
          client.get(`/get?sustained=${batch * batchSize + i}`)
        );
        
        const responses = await Promise.all(promises);
        
        const endTime = Date.now();
        const batchTime = endTime - startTime;
        
        measurements.push(batchTime);
        
        // Verify all responses in batch
        responses.forEach(response => assert.strictEqual(response.status, 200));
        
        // Small delay between batches
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      const avgBatchTime = measurements.reduce((sum, time) => sum + time, 0) / measurements.length;
      const firstBatchAvg = measurements.slice(0, 3).reduce((sum, time) => sum + time, 0) / 3;
      const lastBatchAvg = measurements.slice(-3).reduce((sum, time) => sum + time, 0) / 3;
      
      console.log(`Sustained load: ${sustainedCount} requests in ${measurements.length} batches`);
      console.log(`Average batch time: ${avgBatchTime.toFixed(2)}ms`);
      console.log(`First 3 batches avg: ${firstBatchAvg.toFixed(2)}ms`);
      console.log(`Last 3 batches avg: ${lastBatchAvg.toFixed(2)}ms`);
      
      // Performance should remain stable
      const performanceRatio = lastBatchAvg / firstBatchAvg;
      console.log(`Performance stability ratio: ${performanceRatio.toFixed(2)}`);
      
      assert(performanceRatio < 2.0, 'Performance should remain stable under sustained load');
    });
  });

  describe('Resource cleanup and optimization', () => {
    it('should clean up resources properly after errors', async () => {
      const initialMemory = process.memoryUsage();
      const errorCount = 20;
      
      for (let i = 0; i < errorCount; i++) {
        try {
          await client.get('/status/500');
          assert.fail('Should have thrown an error');
        } catch (error) {
          assert.strictEqual(error.response.status, 500);
        }
        
        // Periodic cleanup
        if (i % 5 === 0 && global.gc) {
          global.gc();
        }
      }
      
      // Final cleanup
      if (global.gc) {
        global.gc();
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      const finalMemory = process.memoryUsage();
      const heapIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      
      console.log(`Memory after ${errorCount} errors: ${(heapIncrease / 1024).toFixed(2)} KB increase`);
      
      // Should not leak memory even with errors
      assert(heapIncrease < 3 * 1024 * 1024, 'Should not leak memory during error scenarios');
    });

    it('should handle timeout cleanup efficiently', async () => {
      const initialMemory = process.memoryUsage();
      const timeoutCount = 10;
      
      const shortTimeoutClient = fluxhttp.create({
        baseURL: HTTPBIN_BASE,
        timeout: 500 // Very short timeout
      });
      
      for (let i = 0; i < timeoutCount; i++) {
        try {
          await shortTimeoutClient.get('/delay/2'); // Will timeout
          assert.fail('Should have timed out');
        } catch (error) {
          assert(error.code === 'ECONNABORTED' || error.message.includes('timeout'));
        }
      }
      
      // Cleanup
      if (global.gc) {
        global.gc();
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      const finalMemory = process.memoryUsage();
      const heapIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      
      console.log(`Memory after ${timeoutCount} timeouts: ${(heapIncrease / 1024).toFixed(2)} KB increase`);
      
      // Timeouts should not cause memory leaks
      assert(heapIncrease < 2 * 1024 * 1024, 'Timeouts should not cause memory leaks');
    });
  });
});