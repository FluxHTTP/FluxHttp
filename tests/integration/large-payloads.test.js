const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');

// Import the main library
const fluxhttpModule = require('../../dist/index.js');
const fluxhttp = fluxhttpModule.default || fluxhttpModule;
const { CancelToken } = fluxhttpModule;

/**
 * Large Payloads Integration Tests
 * Tests handling of large data uploads, downloads, and transfers with real endpoints
 * 
 * Note: These tests make real network requests and may be affected by network conditions
 * Some tests may take longer to complete due to large data transfers
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

describe('Large Payloads Integration Tests', () => {
  let client;
  const HTTPBIN_BASE = 'https://httpbin.org';
  const LARGE_REQUEST_TIMEOUT = 60000; // 60 second timeout for large transfers

  beforeEach(() => {
    client = fluxhttp.create({
      baseURL: HTTPBIN_BASE,
      timeout: LARGE_REQUEST_TIMEOUT,
      headers: {
        'User-Agent': 'FluxHTTP-LargePayload-Test/1.0.0'
      }
    });
  });

  afterEach(() => {
    if (global.gc) {
      global.gc();
    }
  });

  describe('Large upload payloads', () => {
    it('should handle 50KB text upload', async () => {
      const largeText = 'A'.repeat(50 * 1024); // 50KB of text
      const startTime = Date.now();
      
      const response = await client.post('/post', largeText, {
        headers: {
          'Content-Type': 'text/plain',
          'X-Test-Size': '50KB'
        }
      });
      
      const endTime = Date.now();
      const uploadTime = endTime - startTime;
      const uploadRate = (50 * 1024 / uploadTime) * 1000 / 1024; // KB/s
      
      assert.strictEqual(response.status, 200);
      assert.strictEqual(parseResponseData(response.data).data, largeText);
      assert.strictEqual(parseResponseData(response.data).headers['Content-Type'], 'text/plain');
      assert.strictEqual(parseResponseData(response.data).headers['X-Test-Size'], '50KB');
      
      console.log(`50KB text upload: ${uploadTime}ms (${uploadRate.toFixed(2)} KB/s)`);
      assert(uploadTime < 30000, `50KB upload should complete in reasonable time: ${uploadTime}ms`);
    });

    it('should handle 100KB JSON payload', async () => {
      // Create a large JSON object
      const largeData = {
        metadata: {
          test: 'large-json-payload',
          size: '100KB',
          timestamp: new Date().toISOString()
        },
        data: Array.from({ length: 1000 }, (_, i) => ({
          id: i,
          name: `Item ${i}`,
          description: `This is a description for item ${i} with additional text to increase size`,
          tags: [`tag-${i % 10}`, `category-${Math.floor(i / 100)}`, 'large-test'],
          properties: {
            value: Math.random() * 1000,
            active: i % 2 === 0,
            nested: {
              level1: `Level 1 data for item ${i}`,
              level2: {
                value: `Nested value ${i}`,
                array: Array.from({ length: 5 }, (_, j) => `nested-${i}-${j}`)
              }
            }
          }
        }))
      };
      
      const jsonString = JSON.stringify(largeData);
      const payloadSize = Buffer.byteLength(jsonString, 'utf8');
      
      console.log(`Actual JSON payload size: ${(payloadSize / 1024).toFixed(2)} KB`);
      
      const startTime = Date.now();
      
      const response = await client.post('/post', largeData, {
        headers: {
          'X-Test-Type': 'large-json',
          'X-Payload-Size': payloadSize.toString()
        }
      });
      
      const endTime = Date.now();
      const uploadTime = endTime - startTime;
      const uploadRate = (payloadSize / uploadTime) * 1000 / 1024; // KB/s
      
      assert.strictEqual(response.status, 200);
      assert.strictEqual(parseResponseData(response.data).json.metadata.test, 'large-json-payload');
      assert.strictEqual(parseResponseData(response.data).json.data.length, 1000);
      assert.strictEqual(parseResponseData(response.data).headers['X-Test-Type'], 'large-json');
      
      console.log(`${(payloadSize / 1024).toFixed(2)}KB JSON upload: ${uploadTime}ms (${uploadRate.toFixed(2)} KB/s)`);
      assert(uploadTime < 45000, `Large JSON upload should complete in reasonable time: ${uploadTime}ms`);
    });

    it('should handle binary data upload', async () => {
      // Create binary data (simulating an image or file)
      const binarySize = 75 * 1024; // 75KB
      const binaryData = Buffer.alloc(binarySize);
      
      // Fill with some pattern to make it more realistic
      for (let i = 0; i < binarySize; i++) {
        binaryData[i] = i % 256;
      }
      
      const startTime = Date.now();
      
      const response = await client.post('/post', binaryData, {
        headers: {
          'Content-Type': 'application/octet-stream',
          'X-Binary-Size': binarySize.toString(),
          'X-Binary-Pattern': 'sequential'
        }
      });
      
      const endTime = Date.now();
      const uploadTime = endTime - startTime;
      const uploadRate = (binarySize / uploadTime) * 1000 / 1024; // KB/s
      
      assert.strictEqual(response.status, 200);
      assert.strictEqual(parseResponseData(response.data).headers['Content-Type'], 'application/octet-stream');
      assert.strictEqual(parseResponseData(response.data).headers['X-Binary-Size'], binarySize.toString());
      
      console.log(`${(binarySize / 1024).toFixed(2)}KB binary upload: ${uploadTime}ms (${uploadRate.toFixed(2)} KB/s)`);
      assert(uploadTime < 45000, `Binary upload should complete in reasonable time: ${uploadTime}ms`);
    });

    it('should handle upload with progress tracking', async () => {
      const payloadSize = 30 * 1024; // 30KB
      const payload = 'X'.repeat(payloadSize);
      const progressEvents = [];
      
      const response = await client.post('/post', payload, {
        headers: {
          'Content-Type': 'text/plain',
          'X-Progress-Test': 'true'
        },
        onUploadProgress: (progressEvent) => {
          progressEvents.push({
            loaded: progressEvent.loaded,
            total: progressEvent.total,
            percentage: progressEvent.progress ? Math.round(progressEvent.progress * 100) : 0,
            timestamp: Date.now()
          });
        }
      });
      
      assert.strictEqual(response.status, 200);
      assert.strictEqual(parseResponseData(response.data).headers['X-Progress-Test'], 'true');
      
      if (progressEvents.length > 0) {
        console.log(`Upload progress events: ${progressEvents.length}`);
        const finalEvent = progressEvents[progressEvents.length - 1];
        console.log(`Final progress: ${finalEvent.percentage}%`);
        
        // Verify progress makes sense
        assert(finalEvent.loaded > 0, 'Should track bytes loaded');
        assert(finalEvent.total > 0, 'Should track total bytes');
        
        // Progress should generally increase
        let lastLoaded = 0;
        progressEvents.forEach(event => {
          assert(event.loaded >= lastLoaded, 'Progress should not go backwards');
          lastLoaded = event.loaded;
        });
      } else {
        console.log('No progress events captured (may be too fast for small payload)');
      }
    });
  });

  describe('Large download payloads', () => {
    it('should handle large response download', async () => {
      const requestedSize = 100 * 1024; // 100KB
      const startTime = Date.now();
      
      try {
        const response = await client.get(`/stream-bytes/${requestedSize}`, {
          headers: {
            'X-Download-Test': 'large-response'
          }
        });
        
        const endTime = Date.now();
        const downloadTime = endTime - startTime;
        const responseSize = response.data ? Buffer.byteLength(response.data) : 0;
        
        assert.strictEqual(response.status, 200);
        
        if (responseSize > 0) {
          const downloadRate = (responseSize / downloadTime) * 1000 / 1024; // KB/s
          console.log(`${(responseSize / 1024).toFixed(2)}KB download: ${downloadTime}ms (${downloadRate.toFixed(2)} KB/s)`);
          
          assert(downloadTime < 30000, `Large download should complete in reasonable time: ${downloadTime}ms`);
          assert(responseSize >= requestedSize * 0.9, 'Should download approximately requested amount');
        } else {
          console.log('Stream-bytes endpoint may not be available or returned empty response');
        }
      } catch (error) {
        if (error.response && error.response.status === 404) {
          console.log('Stream-bytes endpoint not available, skipping large download test');
        } else {
          throw error;
        }
      }
    });

    it('should handle gzipped response decompression', async () => {
      const startTime = Date.now();
      
      const response = await client.get('/gzip', {
        headers: {
          'Accept-Encoding': 'gzip, deflate',
          'X-Compression-Test': 'true'
        }
      });
      
      const endTime = Date.now();
      const requestTime = endTime - startTime;
      
      assert.strictEqual(response.status, 200);
      assert.strictEqual(typeof parseResponseData(response.data), 'object');
      assert.strictEqual(parseResponseData(response.data).gzipped, true);
      
      console.log(`Gzipped response handling: ${requestTime}ms`);
      
      // Should handle compression efficiently
      assert(requestTime < 10000, `Gzipped response should be handled efficiently: ${requestTime}ms`);
    });

    it('should handle JSON response with large data', async () => {
      const response = await client.get('/json');
      
      assert.strictEqual(response.status, 200);
      assert.strictEqual(typeof parseResponseData(response.data), 'object');
      assert(parseResponseData(response.data).slideshow, 'Should parse JSON correctly');
      assert(parseResponseData(response.data).slideshow.slides, 'Should have slides array');
      
      // Verify JSON parsing worked correctly for nested structure
      const slideshow = parseResponseData(response.data).slideshow;
      assert.strictEqual(typeof slideshow.title, 'string');
      assert(Array.isArray(slideshow.slides));
      
      console.log(`JSON response parsed: ${slideshow.slides.length} slides`);
    });
  });

  describe('Memory efficiency with large payloads', () => {
    it('should handle large payload without excessive memory usage', async () => {
      const initialMemory = process.memoryUsage();
      
      // Create a moderately large payload
      const payload = {
        test: 'memory-efficiency',
        largeArray: Array.from({ length: 5000 }, (_, i) => ({
          id: i,
          data: `Item ${i} with some additional data to increase memory usage`,
          values: Array.from({ length: 10 }, (_, j) => Math.random())
        }))
      };
      
      const response = await client.post('/post', payload);
      
      assert.strictEqual(response.status, 200);
      assert.strictEqual(parseResponseData(response.data).json.test, 'memory-efficiency');
      assert.strictEqual(parseResponseData(response.data).json.largeArray.length, 5000);
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      const finalMemory = process.memoryUsage();
      const heapIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      
      console.log(`Memory increase for large payload: ${(heapIncrease / 1024).toFixed(2)} KB`);
      
      // Memory increase should be reasonable (less than 20MB)
      assert(heapIncrease < 20 * 1024 * 1024, `Memory usage should be reasonable: ${(heapIncrease / 1024).toFixed(2)} KB`);
    });

    it('should clean up memory after multiple large requests', async () => {
      const initialMemory = process.memoryUsage();
      
      // Make multiple requests with large payloads
      for (let i = 0; i < 10; i++) {
        const payload = {
          iteration: i,
          data: Array.from({ length: 1000 }, (_, j) => ({
            id: j,
            content: `Large content for iteration ${i}, item ${j}`,
            timestamp: new Date().toISOString()
          }))
        };
        
        const response = await client.post('/post', payload);
        assert.strictEqual(response.status, 200);
        assert.strictEqual(parseResponseData(response.data).json.iteration, i);
        
        // Periodic cleanup
        if (i % 3 === 0 && global.gc) {
          global.gc();
        }
      }
      
      // Final cleanup
      if (global.gc) {
        global.gc();
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      
      const finalMemory = process.memoryUsage();
      const heapIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      
      console.log(`Memory after 10 large requests: ${(heapIncrease / 1024).toFixed(2)} KB increase`);
      
      // Should not accumulate excessive memory
      assert(heapIncrease < 15 * 1024 * 1024, `Memory should not accumulate excessively: ${(heapIncrease / 1024).toFixed(2)} KB`);
    });
  });

  describe('Large payload error scenarios', () => {
    it('should handle timeout during large upload', async () => {
      const shortTimeoutClient = fluxhttp.create({
        baseURL: HTTPBIN_BASE,
        timeout: 2000 // 2 second timeout
      });
      
      const largePayload = 'X'.repeat(100 * 1024); // 100KB payload
      
      try {
        await shortTimeoutClient.post('/delay/5', largePayload); // 5 second delay
        assert.fail('Should have timed out');
      } catch (error) {
        assert(error.code === 'ECONNABORTED' || error.message.includes('timeout'));
        console.log('Large upload timeout handled correctly');
      }
    });

    it('should handle cancellation during large upload', async () => {
      const source = CancelToken.source();
      const largePayload = 'Y'.repeat(80 * 1024); // 80KB payload
      
      const uploadPromise = client.post('/post', largePayload, {
        cancelToken: source.token,
        headers: {
          'X-Cancellation-Test': 'true'
        }
      });
      
      // Cancel after a short delay
      setTimeout(() => {
        source.cancel('Large upload cancelled');
      }, 100);
      
      try {
        await uploadPromise;
        assert.fail('Should have been cancelled');
      } catch (error) {
        assert(fluxhttp.isCancel(error), 'Should be a cancellation error');
        assert.strictEqual(error.message, 'Large upload cancelled');
        console.log('Large upload cancellation handled correctly');
      }
    });

    it('should handle server error during large upload', async () => {
      const largePayload = {
        error: 'trigger-server-error',
        data: Array.from({ length: 2000 }, (_, i) => ({
          id: i,
          content: `Error test data item ${i}`
        }))
      };
      
      try {
        await client.post('/status/500', largePayload);
        assert.fail('Should have thrown server error');
      } catch (error) {
        assert(error.response);
        assert.strictEqual(error.response.status, 500);
        console.log('Server error during large upload handled correctly');
      }
    });
  });

  describe('Streaming and chunked transfer', () => {
    it('should handle chunked transfer encoding', async () => {
      try {
        const response = await client.get('/stream/5', {
          headers: {
            'X-Chunked-Test': 'true'
          }
        });
        
        assert.strictEqual(response.status, 200);
        
        // Response should contain streaming data
        if (typeof response.data === 'string') {
          const lines = parseResponseData(response.data).trim().split('\n');
          console.log(`Received ${lines.length} lines from stream`);
          
          // Each line should be valid JSON
          lines.forEach((line, index) => {
            try {
              const parsed = JSON.parse(line);
              assert(typeof parsed === 'object', `Line ${index} should be valid JSON`);
            } catch (parseError) {
              console.log(`Line ${index} parsing failed, might be partial: ${line.substring(0, 50)}`);
            }
          });
        }
      } catch (error) {
        if (error.response && error.response.status === 404) {
          console.log('Stream endpoint not available, skipping chunked transfer test');
        } else {
          throw error;
        }
      }
    });

    it('should handle large response in chunks', async () => {
      const chunkSize = 1024; // 1KB chunks
      const chunks = [];
      let totalReceived = 0;
      
      try {
        // Note: This test depends on the endpoint supporting chunked responses
        const response = await client.get('/stream-bytes/10240', { // 10KB total
          onDownloadProgress: (progressEvent) => {
            if (progressEvent.loaded > totalReceived) {
              const newData = progressEvent.loaded - totalReceived;
              chunks.push(newData);
              totalReceived = progressEvent.loaded;
            }
          }
        });
        
        assert.strictEqual(response.status, 200);
        
        if (chunks.length > 0) {
          console.log(`Received data in ${chunks.length} chunks`);
          console.log(`Total received: ${totalReceived} bytes`);
          
          // Verify chunked reception
          assert(chunks.length > 1, 'Should receive data in multiple chunks');
          assert(totalReceived > 0, 'Should receive some data');
        } else {
          console.log('No download progress events captured (transfer may be too fast)');
        }
      } catch (error) {
        if (error.response && error.response.status === 404) {
          console.log('Stream-bytes endpoint not available, skipping chunk test');
        } else {
          throw error;
        }
      }
    });
  });

  describe('Large payload performance optimization', () => {
    it('should optimize large JSON serialization', async () => {
      // Create a complex nested structure
      const complexPayload = {
        timestamp: new Date().toISOString(),
        metadata: {
          test: 'performance-optimization',
          version: '1.0.0'
        },
        users: Array.from({ length: 500 }, (_, i) => ({
          id: i,
          username: `user_${i}`,
          profile: {
            firstName: `FirstName${i}`,
            lastName: `LastName${i}`,
            email: `user${i}@example.com`,
            preferences: {
              theme: i % 2 === 0 ? 'dark' : 'light',
              notifications: i % 3 === 0,
              language: ['en', 'es', 'fr'][i % 3]
            },
            activity: Array.from({ length: 20 }, (_, j) => ({
              action: `action_${j}`,
              timestamp: new Date(Date.now() - j * 60000).toISOString(),
              data: { value: Math.random() * 100 }
            }))
          }
        }))
      };
      
      const serializationStart = Date.now();
      const jsonString = JSON.stringify(complexPayload);
      const serializationTime = Date.now() - serializationStart;
      const payloadSize = Buffer.byteLength(jsonString, 'utf8');
      
      console.log(`JSON serialization: ${(payloadSize / 1024).toFixed(2)}KB in ${serializationTime}ms`);
      
      const startTime = Date.now();
      
      const response = await client.post('/post', complexPayload, {
        headers: {
          'X-Performance-Test': 'json-optimization'
        }
      });
      
      const endTime = Date.now();
      const totalTime = endTime - startTime;
      
      assert.strictEqual(response.status, 200);
      assert.strictEqual(parseResponseData(response.data).json.metadata.test, 'performance-optimization');
      assert.strictEqual(parseResponseData(response.data).json.users.length, 500);
      
      console.log(`Total request time: ${totalTime}ms (serialization: ${serializationTime}ms, network: ${totalTime - serializationTime}ms)`);
      
      // Should complete efficiently
      assert(totalTime < 30000, `Complex JSON upload should be efficient: ${totalTime}ms`);
    });

    it('should handle concurrent large uploads efficiently', async () => {
      const uploadCount = 5;
      const payloadSize = 20 * 1024; // 20KB per upload
      
      const uploads = Array.from({ length: uploadCount }, (_, i) => {
        const payload = {
          uploadId: i,
          data: Array.from({ length: 500 }, (_, j) => ({
            id: j,
            content: `Upload ${i}, item ${j}, content with additional text to reach target size`,
            metadata: {
              uploadBatch: i,
              itemIndex: j,
              timestamp: new Date().toISOString()
            }
          }))
        };
        
        return client.post('/post', payload, {
          headers: {
            'X-Upload-ID': i.toString(),
            'X-Concurrent-Test': 'true'
          }
        });
      });
      
      const startTime = Date.now();
      const responses = await Promise.all(uploads);
      const endTime = Date.now();
      const totalTime = endTime - startTime;
      
      // Verify all uploads
      responses.forEach((response, index) => {
        assert.strictEqual(response.status, 200);
        assert.strictEqual(parseResponseData(response.data).json.uploadId, index);
        assert.strictEqual(parseResponseData(response.data).headers['X-Upload-ID'], index.toString());
        assert.strictEqual(parseResponseData(response.data).json.data.length, 500);
      });
      
      const totalDataTransferred = uploadCount * payloadSize;
      const aggregateRate = (totalDataTransferred / totalTime) * 1000 / 1024; // KB/s
      
      console.log(`${uploadCount} concurrent large uploads: ${totalTime}ms`);
      console.log(`Total data: ${(totalDataTransferred / 1024).toFixed(2)}KB, rate: ${aggregateRate.toFixed(2)} KB/s`);
      
      assert(totalTime < 45000, `Concurrent large uploads should be efficient: ${totalTime}ms`);
    });
  });
});