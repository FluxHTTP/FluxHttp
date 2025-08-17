const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');

// Import the main library
const fluxhttpModule = require('../../dist/index.js');
const fluxhttp = fluxhttpModule.default || fluxhttpModule;
const { CancelToken, isCancel } = fluxhttpModule;

/**
 * Concurrent Requests Integration Tests
 * Tests parallel request handling with real HTTP endpoints
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

describe('Concurrent Requests Integration Tests', () => {
  let client;
  const HTTPBIN_BASE = 'https://httpbin.org';
  const REQUEST_TIMEOUT = 30000; // 30 second timeout for concurrent tests

  beforeEach(() => {
    client = fluxhttp.create({
      baseURL: HTTPBIN_BASE,
      timeout: REQUEST_TIMEOUT,
      headers: {
        'User-Agent': 'FluxHTTP-Concurrent-Test/1.0.0'
      }
    });
  });

  afterEach(() => {
    if (global.gc) {
      global.gc();
    }
  });

  describe('Basic concurrent requests', () => {
    it('should handle multiple GET requests concurrently', async () => {
      const requestCount = 10;
      const startTime = Date.now();
      
      const promises = Array.from({ length: requestCount }, (_, i) =>
        client.get(`/get?concurrent=true&id=${i}`)
      );
      
      const responses = await Promise.all(promises);
      const endTime = Date.now();
      const totalTime = endTime - startTime;
      
      // Verify all responses
      assert.strictEqual(responses.length, requestCount);
      responses.forEach((response, index) => {
        assert.strictEqual(response.status, 200);
        assert.strictEqual(parseResponseData(response.data).args.concurrent, 'true');
        assert.strictEqual(parseResponseData(response.data).args.id, String(index));
      });
      
      console.log(`${requestCount} concurrent GET requests completed in ${totalTime}ms`);
      
      // Concurrent requests should be faster than sequential
      const maxSequentialTime = requestCount * 2000; // Generous estimate
      assert(totalTime < maxSequentialTime, `Concurrent requests should be efficient: ${totalTime}ms`);
    });

    it('should handle mixed HTTP methods concurrently', async () => {
      const testData = { name: 'Test User', email: 'test@example.com' };
      
      const promises = [
        client.get('/get?method=get'),
        client.post('/post', testData),
        client.put('/put', { ...testData, updated: true }),
        client.patch('/patch', { status: 'active' }),
        client.delete('/delete?method=delete'),
        client.get('/json'),
        client.get('/headers')
      ];
      
      const responses = await Promise.all(promises);
      
      // Verify each response type
      assert.strictEqual(responses[0].status, 200); // GET
      assert.strictEqual(responses[0].data.args.method, 'get');
      
      assert.strictEqual(responses[1].status, 200); // POST
      assert.deepStrictEqual(responses[1].data.json, testData);
      
      assert.strictEqual(responses[2].status, 200); // PUT
      assert.strictEqual(responses[2].data.json.updated, true);
      
      assert.strictEqual(responses[3].status, 200); // PATCH
      assert.strictEqual(responses[3].data.json.status, 'active');
      
      assert.strictEqual(responses[4].status, 200); // DELETE
      assert.strictEqual(responses[4].data.args.method, 'delete');
      
      assert.strictEqual(responses[5].status, 200); // JSON endpoint
      assert(responses[5].data.slideshow, 'Should have JSON data');
      
      assert.strictEqual(responses[6].status, 200); // Headers endpoint
      assert(responses[6].data.headers, 'Should have headers data');
    });

    it('should handle concurrent requests with different configurations', async () => {
      const promises = [
        client.get('/get', {
          headers: { 'X-Config': 'config1' },
          params: { test: 'param1' }
        }),
        client.get('/get', {
          headers: { 'X-Config': 'config2' },
          params: { test: 'param2' },
          timeout: 10000
        }),
        client.get('/get', {
          headers: { 'X-Config': 'config3', 'Authorization': 'Bearer token123' },
          params: { test: 'param3', extra: 'data' }
        })
      ];
      
      const responses = await Promise.all(promises);
      
      // Verify each request preserved its unique configuration
      assert.strictEqual(responses[0].data.headers['X-Config'], 'config1');
      assert.strictEqual(responses[0].data.args.test, 'param1');
      
      assert.strictEqual(responses[1].data.headers['X-Config'], 'config2');
      assert.strictEqual(responses[1].data.args.test, 'param2');
      
      assert.strictEqual(responses[2].data.headers['X-Config'], 'config3');
      assert.strictEqual(responses[2].data.headers['Authorization'], 'Bearer token123');
      assert.strictEqual(responses[2].data.args.test, 'param3');
      assert.strictEqual(responses[2].data.args.extra, 'data');
    });
  });

  describe('High-volume concurrent requests', () => {
    it('should handle 50 concurrent requests', async () => {
      const requestCount = 50;
      const startTime = Date.now();
      
      const promises = Array.from({ length: requestCount }, (_, i) =>
        client.get(`/get?volume=high&request=${i}&batch=${Math.floor(i / 10)}`)
      );
      
      const responses = await Promise.all(promises);
      const endTime = Date.now();
      const totalTime = endTime - startTime;
      
      // Verify all responses
      assert.strictEqual(responses.length, requestCount);
      responses.forEach((response, index) => {
        assert.strictEqual(response.status, 200);
        assert.strictEqual(parseResponseData(response.data).args.volume, 'high');
        assert.strictEqual(parseResponseData(response.data).args.request, String(index));
      });
      
      const avgResponseTime = totalTime / requestCount;
      console.log(`${requestCount} concurrent requests: ${totalTime}ms total, ${avgResponseTime.toFixed(2)}ms average`);
      
      // Should complete efficiently
      assert(totalTime < 20000, `High volume requests should complete efficiently: ${totalTime}ms`);
    });

    it('should handle concurrent requests with varying delays', async () => {
      const delays = [0, 0.5, 1, 1.5, 0, 0.5, 1, 0];
      const startTime = Date.now();
      
      const promises = delays.map((delay, index) =>
        client.get(`/delay/${delay}?index=${index}`)
      );
      
      const responses = await Promise.all(promises);
      const endTime = Date.now();
      const totalTime = endTime - startTime;
      
      // Verify all responses
      responses.forEach((response, index) => {
        assert.strictEqual(response.status, 200);
        assert.strictEqual(parseResponseData(response.data).args.index, String(index));
      });
      
      console.log(`Varying delay concurrent requests completed in ${totalTime}ms`);
      
      // Should complete roughly in time of longest delay (plus network overhead)
      const maxDelay = Math.max(...delays) * 1000;
      assert(totalTime < maxDelay + 5000, `Should complete near longest delay time: ${totalTime}ms vs max ${maxDelay}ms`);
    });

    it('should handle concurrent requests to different endpoints', async () => {
      const endpoints = [
        '/get',
        '/json',
        '/headers',
        '/user-agent',
        '/ip',
        '/uuid',
        '/base64/SGVsbG8gV29ybGQ%3D',
        '/status/200'
      ];
      
      const promises = endpoints.map((endpoint, index) =>
        client.get(`${endpoint}${endpoint.includes('?') ? '&' : '?'}concurrent=${index}`)
      );
      
      const responses = await Promise.all(promises);
      
      // Verify all responses are successful
      responses.forEach((response, index) => {
        assert.strictEqual(response.status, 200);
        console.log(`Endpoint ${endpoints[index]}: ${response.status}`);
      });
      
      // Verify specific endpoint responses
      assert(responses[1].data.slideshow, 'JSON endpoint should return slideshow data');
      assert(responses[2].data.headers, 'Headers endpoint should return headers');
      assert(responses[4].data.origin, 'IP endpoint should return origin');
    });
  });

  describe('Error handling in concurrent requests', () => {
    it('should handle mixed success and error responses', async () => {
      const promises = [
        client.get('/get?success=1'),
        client.get('/status/404'),
        client.get('/get?success=2'),
        client.get('/status/500'),
        client.get('/get?success=3'),
        client.get('/status/401'),
        client.get('/get?success=4')
      ];
      
      const results = await Promise.allSettled(promises);
      
      // Check results
      assert.strictEqual(results.length, 7);
      
      // Successful requests
      assert.strictEqual(results[0].status, 'fulfilled');
      assert.strictEqual(results[0].value.data.args.success, '1');
      
      assert.strictEqual(results[2].status, 'fulfilled');
      assert.strictEqual(results[2].value.data.args.success, '2');
      
      assert.strictEqual(results[4].status, 'fulfilled');
      assert.strictEqual(results[4].value.data.args.success, '3');
      
      assert.strictEqual(results[6].status, 'fulfilled');
      assert.strictEqual(results[6].value.data.args.success, '4');
      
      // Failed requests
      assert.strictEqual(results[1].status, 'rejected');
      assert.strictEqual(results[1].reason.response.status, 404);
      
      assert.strictEqual(results[3].status, 'rejected');
      assert.strictEqual(results[3].reason.response.status, 500);
      
      assert.strictEqual(results[5].status, 'rejected');
      assert.strictEqual(results[5].reason.response.status, 401);
    });

    it('should handle concurrent timeouts gracefully', async () => {
      const shortTimeoutClient = fluxhttp.create({
        baseURL: HTTPBIN_BASE,
        timeout: 1000 // 1 second timeout
      });
      
      const promises = [
        shortTimeoutClient.get('/get?fast=true'),
        shortTimeoutClient.get('/delay/2'), // Will timeout
        shortTimeoutClient.get('/get?fast=true'),
        shortTimeoutClient.get('/delay/3'), // Will timeout
        shortTimeoutClient.get('/get?fast=true')
      ];
      
      const results = await Promise.allSettled(promises);
      
      // Check that fast requests succeeded and slow ones timed out
      assert.strictEqual(results[0].status, 'fulfilled');
      assert.strictEqual(results[0].value.data.args.fast, 'true');
      
      assert.strictEqual(results[1].status, 'rejected');
      assert(results[1].reason.code === 'ECONNABORTED' || results[1].reason.message.includes('timeout'));
      
      assert.strictEqual(results[2].status, 'fulfilled');
      assert.strictEqual(results[2].value.data.args.fast, 'true');
      
      assert.strictEqual(results[3].status, 'rejected');
      assert(results[3].reason.code === 'ECONNABORTED' || results[3].reason.message.includes('timeout'));
      
      assert.strictEqual(results[4].status, 'fulfilled');
      assert.strictEqual(results[4].value.data.args.fast, 'true');
    });

    it('should handle network errors in concurrent requests', async () => {
      const promises = [
        client.get('/get?network=good'),
        fluxhttp.create({ baseURL: 'https://invalid-domain-12345.com', timeout: 2000 }).get('/test'),
        client.get('/get?network=good'),
        fluxhttp.create({ baseURL: 'http://localhost:99999', timeout: 2000 }).get('/test'),
        client.get('/get?network=good')
      ];
      
      const results = await Promise.allSettled(promises);
      
      // Good requests should succeed
      assert.strictEqual(results[0].status, 'fulfilled');
      assert.strictEqual(results[0].value.data.args.network, 'good');
      
      assert.strictEqual(results[2].status, 'fulfilled');
      assert.strictEqual(results[2].value.data.args.network, 'good');
      
      assert.strictEqual(results[4].status, 'fulfilled');
      assert.strictEqual(results[4].value.data.args.network, 'good');
      
      // Network error requests should fail
      assert.strictEqual(results[1].status, 'rejected');
      assert(!results[1].reason.response, 'Network errors should not have response');
      
      assert.strictEqual(results[3].status, 'rejected');
      assert(!results[3].reason.response, 'Connection errors should not have response');
    });
  });

  describe('Cancellation in concurrent requests', () => {
    it('should cancel multiple requests with single token', async () => {
      const source = CancelToken.source();
      
      const promises = [
        client.get('/delay/3', { cancelToken: source.token }),
        client.get('/delay/4', { cancelToken: source.token }),
        client.get('/delay/5', { cancelToken: source.token }),
        client.get('/get?immediate=true'), // No cancel token
        client.get('/delay/3', { cancelToken: source.token })
      ];
      
      // Cancel after a short delay
      setTimeout(() => {
        source.cancel('Bulk cancellation test');
      }, 500);
      
      const results = await Promise.allSettled(promises);
      
      // Cancelled requests should be rejected with cancel error
      assert.strictEqual(results[0].status, 'rejected');
      assert(isCancel(results[0].reason));
      assert.strictEqual(results[0].reason.message, 'Bulk cancellation test');
      
      assert.strictEqual(results[1].status, 'rejected');
      assert(isCancel(results[1].reason));
      
      assert.strictEqual(results[2].status, 'rejected');
      assert(isCancel(results[2].reason));
      
      assert.strictEqual(results[4].status, 'rejected');
      assert(isCancel(results[4].reason));
      
      // Non-cancelled request should succeed
      assert.strictEqual(results[3].status, 'fulfilled');
      assert.strictEqual(results[3].value.data.args.immediate, 'true');
    });

    it('should handle individual request cancellation', async () => {
      const sources = [
        CancelToken.source(),
        CancelToken.source(),
        CancelToken.source()
      ];
      
      const promises = [
        client.get('/delay/3', { cancelToken: sources[0].token }),
        client.get('/delay/3', { cancelToken: sources[1].token }),
        client.get('/delay/3', { cancelToken: sources[2].token }),
        client.get('/get?no-cancel=true') // No cancel token
      ];
      
      // Cancel only the second request
      setTimeout(() => {
        sources[1].cancel('Individual cancellation');
      }, 300);
      
      const results = await Promise.allSettled(promises);
      
      // First request should succeed (or timeout)
      assert(results[0].status === 'fulfilled' || results[0].reason.code === 'ECONNABORTED');
      
      // Second request should be cancelled
      assert.strictEqual(results[1].status, 'rejected');
      assert(isCancel(results[1].reason));
      assert.strictEqual(results[1].reason.message, 'Individual cancellation');
      
      // Third request should succeed (or timeout)
      assert(results[2].status === 'fulfilled' || results[2].reason.code === 'ECONNABORTED');
      
      // Fourth request should succeed
      assert.strictEqual(results[3].status, 'fulfilled');
      assert.strictEqual(results[3].value.data.args['no-cancel'], 'true');
    });
  });

  describe('Resource management during concurrent requests', () => {
    it('should manage memory efficiently during concurrent requests', async () => {
      const initialMemory = process.memoryUsage();
      const requestCount = 30;
      
      // Create concurrent requests
      const promises = Array.from({ length: requestCount }, (_, i) =>
        client.get(`/get?memory-test=${i}&data=${'x'.repeat(100)}`)
      );
      
      const responses = await Promise.all(promises);
      
      // Verify all responses
      responses.forEach((response, index) => {
        assert.strictEqual(response.status, 200);
        assert.strictEqual(parseResponseData(response.data).args['memory-test'], String(index));
      });
      
      // Force garbage collection
      if (global.gc) {
        global.gc();
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      const finalMemory = process.memoryUsage();
      const heapIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      
      console.log(`Memory usage for ${requestCount} concurrent requests: ${(heapIncrease / 1024).toFixed(2)} KB`);
      
      // Memory increase should be reasonable
      assert(heapIncrease < 5 * 1024 * 1024, `Memory usage should be reasonable: ${(heapIncrease / 1024).toFixed(2)} KB`);
    });

    it('should handle connection limits gracefully', async () => {
      const connectionTestCount = 100; // High number to test connection pooling
      
      const startTime = Date.now();
      
      // Create many concurrent requests
      const promises = Array.from({ length: connectionTestCount }, (_, i) =>
        client.get(`/get?connection-test=${i}`)
      );
      
      const responses = await Promise.all(promises);
      
      const endTime = Date.now();
      const totalTime = endTime - startTime;
      
      // Verify all responses
      assert.strictEqual(responses.length, connectionTestCount);
      responses.forEach((response, index) => {
        assert.strictEqual(response.status, 200);
        assert.strictEqual(parseResponseData(response.data).args['connection-test'], String(index));
      });
      
      console.log(`${connectionTestCount} concurrent requests completed in ${totalTime}ms`);
      
      // Should complete in reasonable time despite connection limits
      assert(totalTime < 60000, `Connection pooling should handle high concurrency: ${totalTime}ms`);
    });
  });

  describe('Real-world concurrent scenarios', () => {
    it('should handle mixed workload simulation', async () => {
      // Simulate a mixed workload: reads, writes, and long-running requests
      const workload = [
        // Fast reads
        ...Array.from({ length: 10 }, (_, i) => ({ type: 'read', id: i })),
        // Writes with data
        ...Array.from({ length: 5 }, (_, i) => ({ type: 'write', id: i })),
        // Slow operations
        ...Array.from({ length: 3 }, (_, i) => ({ type: 'slow', id: i }))
      ];
      
      const startTime = Date.now();
      
      const promises = workload.map(task => {
        switch (task.type) {
          case 'read':
            return client.get(`/get?workload=read&id=${task.id}`);
          case 'write':
            return client.post('/post', { 
              workload: 'write', 
              id: task.id, 
              data: Array.from({ length: 50 }, (_, i) => `item-${i}`)
            });
          case 'slow':
            return client.get(`/delay/1?workload=slow&id=${task.id}`);
          default:
            throw new Error(`Unknown task type: ${task.type}`);
        }
      });
      
      const responses = await Promise.all(promises);
      const endTime = Date.now();
      const totalTime = endTime - startTime;
      
      // Verify all responses
      assert.strictEqual(responses.length, workload.length);
      
      // Check read responses
      const reads = responses.slice(0, 10);
      reads.forEach((response, index) => {
        assert.strictEqual(response.status, 200);
        assert.strictEqual(parseResponseData(response.data).args.workload, 'read');
        assert.strictEqual(parseResponseData(response.data).args.id, String(index));
      });
      
      // Check write responses
      const writes = responses.slice(10, 15);
      writes.forEach((response, index) => {
        assert.strictEqual(response.status, 200);
        assert.strictEqual(parseResponseData(response.data).json.workload, 'write');
        assert.strictEqual(parseResponseData(response.data).json.id, index);
        assert.strictEqual(parseResponseData(response.data).json.data.length, 50);
      });
      
      // Check slow responses
      const slows = responses.slice(15);
      slows.forEach((response, index) => {
        assert.strictEqual(response.status, 200);
        assert.strictEqual(parseResponseData(response.data).args.workload, 'slow');
        assert.strictEqual(parseResponseData(response.data).args.id, String(index));
      });
      
      console.log(`Mixed workload (${workload.length} requests) completed in ${totalTime}ms`);
      
      // Should complete efficiently despite mixed request types
      assert(totalTime < 15000, `Mixed workload should complete efficiently: ${totalTime}ms`);
    });

    it('should handle concurrent file upload simulation', async () => {
      const uploadCount = 8;
      const fileSize = 5000; // 5KB files
      
      const promises = Array.from({ length: uploadCount }, (_, i) => {
        const fileData = Buffer.from('x'.repeat(fileSize));
        return client.post('/post', fileData, {
          headers: {
            'Content-Type': 'application/octet-stream',
            'X-Upload-ID': `upload-${i}`,
            'X-File-Size': fileSize.toString()
          }
        });
      });
      
      const startTime = Date.now();
      const responses = await Promise.all(promises);
      const endTime = Date.now();
      const totalTime = endTime - startTime;
      
      // Verify all uploads
      responses.forEach((response, index) => {
        assert.strictEqual(response.status, 200);
        assert.strictEqual(parseResponseData(response.data).headers['X-Upload-ID'], `upload-${index}`);
        assert.strictEqual(parseResponseData(response.data).headers['X-File-Size'], fileSize.toString());
      });
      
      const totalDataTransferred = uploadCount * fileSize;
      const transferRate = (totalDataTransferred / totalTime) * 1000 / 1024; // KB/s
      
      console.log(`${uploadCount} concurrent uploads (${totalDataTransferred} bytes) in ${totalTime}ms`);
      console.log(`Aggregate transfer rate: ${transferRate.toFixed(2)} KB/s`);
      
      assert(totalTime < 20000, `Concurrent uploads should complete efficiently: ${totalTime}ms`);
    });
  });
});