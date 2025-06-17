import { describe, it, expect, beforeAll } from 'vitest';
import fluxhttp from '../../src';
import type { FluxHTTPInstance } from '../../src';

describe('Performance Tests', () => {
  let apiClient: FluxHTTPInstance;
  const testBaseURL = 'https://jsonplaceholder.typicode.com';

  beforeAll(() => {
    apiClient = fluxhttp.create({
      baseURL: testBaseURL,
      timeout: 30000,
    });
  });

  describe('Response time benchmarks', () => {
    it('should complete single requests within acceptable time', async () => {
      const startTime = performance.now();
      
      const response = await apiClient.get('/posts/1');
      
      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(response.status).toBe(200);
      expect(duration).toBeLessThan(2000); // Should complete within 2 seconds
      
      console.log(`Single request completed in ${duration.toFixed(2)}ms`);
    });

    it('should handle concurrent requests efficiently', async () => {
      const numRequests = 10;
      const startTime = performance.now();
      
      const requests = Array.from({ length: numRequests }, (_, i) => 
        apiClient.get(`/posts/${i + 1}`)
      );
      
      const responses = await Promise.all(requests);
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      const avgTimePerRequest = duration / numRequests;

      expect(responses).toHaveLength(numRequests);
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });
      
      // Concurrent requests should be faster than sequential
      expect(avgTimePerRequest).toBeLessThan(500); // Average should be under 500ms
      
      console.log(`${numRequests} concurrent requests completed in ${duration.toFixed(2)}ms`);
      console.log(`Average time per request: ${avgTimePerRequest.toFixed(2)}ms`);
    });

    it('should demonstrate concurrency advantage', async () => {
      const numRequests = 5;
      
      // Sequential requests
      const sequentialStart = performance.now();
      const sequentialResponses = [];
      for (let i = 1; i <= numRequests; i++) {
        const response = await apiClient.get(`/posts/${i}`);
        sequentialResponses.push(response);
      }
      const sequentialDuration = performance.now() - sequentialStart;

      // Concurrent requests
      const concurrentStart = performance.now();
      const concurrentRequests = Array.from({ length: numRequests }, (_, i) => 
        apiClient.get(`/posts/${i + 1}`)
      );
      const concurrentResponses = await Promise.all(concurrentRequests);
      const concurrentDuration = performance.now() - concurrentStart;

      expect(sequentialResponses).toHaveLength(numRequests);
      expect(concurrentResponses).toHaveLength(numRequests);
      
      // Concurrent should be significantly faster
      const speedup = sequentialDuration / concurrentDuration;
      expect(speedup).toBeGreaterThan(1.5); // At least 1.5x faster
      
      console.log(`Sequential: ${sequentialDuration.toFixed(2)}ms`);
      console.log(`Concurrent: ${concurrentDuration.toFixed(2)}ms`);
      console.log(`Speedup: ${speedup.toFixed(2)}x`);
    });
  });

  describe('Memory efficiency', () => {
    it('should handle large payloads efficiently', async () => {
      // Create a large payload
      const largeArray = Array.from({ length: 1000 }, (_, i) => ({
        id: i,
        title: `Item ${i}`,
        description: 'x'.repeat(100),
      }));

      const startMemory = process.memoryUsage().heapUsed;
      const startTime = performance.now();

      const response = await apiClient.post('/posts', {
        title: 'Large payload test',
        body: JSON.stringify(largeArray),
        userId: 1,
      });

      const endTime = performance.now();
      const endMemory = process.memoryUsage().heapUsed;

      expect(response.status).toBe(201);
      
      const duration = endTime - startTime;
      const memoryIncrease = (endMemory - startMemory) / 1024 / 1024; // MB
      
      console.log(`Large payload request completed in ${duration.toFixed(2)}ms`);
      console.log(`Memory increase: ${memoryIncrease.toFixed(2)}MB`);
      
      // Should not use excessive memory
      expect(memoryIncrease).toBeLessThan(50); // Less than 50MB increase
    });
  });

  describe('Instance creation performance', () => {
    it('should create instances quickly', () => {
      const iterations = 1000;
      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        fluxhttp.create({
          baseURL: 'https://example.com',
          timeout: 5000,
        });
      }

      const endTime = performance.now();
      const duration = endTime - startTime;
      const avgTimePerInstance = duration / iterations;

      console.log(`Created ${iterations} instances in ${duration.toFixed(2)}ms`);
      console.log(`Average time per instance: ${avgTimePerInstance.toFixed(4)}ms`);

      // Should be very fast
      expect(avgTimePerInstance).toBeLessThan(0.1); // Less than 0.1ms per instance
    });

    it('should reuse default instance efficiently', async () => {
      const iterations = 100;
      const startTime = performance.now();

      // Using default instance
      for (let i = 0; i < iterations; i++) {
        fluxhttp.defaults.timeout = 5000 + i;
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      console.log(`Modified defaults ${iterations} times in ${duration.toFixed(2)}ms`);
      
      expect(duration).toBeLessThan(10); // Should be very fast
    });
  });

  describe('Interceptor performance', () => {
    it('should handle multiple interceptors efficiently', async () => {
      const client = fluxhttp.create({ baseURL: testBaseURL });
      const numInterceptors = 10;

      // Add multiple request interceptors
      for (let i = 0; i < numInterceptors; i++) {
        client.interceptors.request.use(config => {
          config.headers = config.headers || {};
          config.headers[`X-Interceptor-${i}`] = `value-${i}`;
          return config;
        });
      }

      // Add multiple response interceptors
      for (let i = 0; i < numInterceptors; i++) {
        client.interceptors.response.use(response => {
          response.data[`interceptor${i}`] = true;
          return response;
        });
      }

      const startTime = performance.now();
      const response = await client.get('/posts/1');
      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(response.status).toBe(200);
      
      // Check that all interceptors ran
      for (let i = 0; i < numInterceptors; i++) {
        expect(response.config.headers?.[`X-Interceptor-${i}`]).toBe(`value-${i}`);
        expect(response.data[`interceptor${i}`]).toBe(true);
      }

      console.log(`Request with ${numInterceptors * 2} interceptors completed in ${duration.toFixed(2)}ms`);
      
      // Should still be reasonably fast
      expect(duration).toBeLessThan(3000);
    });
  });

  describe('Error handling performance', () => {
    it('should handle errors efficiently', async () => {
      const numErrors = 50;
      const startTime = performance.now();

      const errorRequests = Array.from({ length: numErrors }, () => 
        apiClient.get('/posts/999999').catch(error => error)
      );

      const errors = await Promise.all(errorRequests);
      
      const endTime = performance.now();
      const duration = endTime - startTime;

      errors.forEach(error => {
        expect(error.response?.status).toBe(404);
      });

      console.log(`Handled ${numErrors} errors in ${duration.toFixed(2)}ms`);
      console.log(`Average time per error: ${(duration / numErrors).toFixed(2)}ms`);

      // Error handling should be fast
      expect(duration / numErrors).toBeLessThan(100); // Less than 100ms per error
    });
  });

  describe('Data transformation performance', () => {
    it('should transform data efficiently', async () => {
      const client = fluxhttp.create({
        baseURL: testBaseURL,
        transformRequest: [
          (data) => {
            if (data && typeof data === 'object') {
              return { ...data, transformed: true };
            }
            return data;
          },
          (data) => {
            if (data && typeof data === 'object') {
              return JSON.stringify(data);
            }
            return data;
          },
        ],
        transformResponse: [
          (data) => {
            if (typeof data === 'string') {
              try {
                return JSON.parse(data);
              } catch {
                return data;
              }
            }
            return data;
          },
          (data) => {
            if (data && typeof data === 'object') {
              return { ...data, responseTransformed: true };
            }
            return data;
          },
        ],
      });

      const startTime = performance.now();
      
      const response = await client.post('/posts', {
        title: 'Transform test',
        body: 'Testing transformation performance',
        userId: 1,
      });

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(response.status).toBe(201);
      expect(response.data.responseTransformed).toBe(true);

      console.log(`Request with transformations completed in ${duration.toFixed(2)}ms`);
      
      // Transformations should not add significant overhead
      expect(duration).toBeLessThan(2000);
    });
  });

  describe('Stress testing', () => {
    it('should handle burst of requests', async () => {
      const burstSize = 20;
      const startTime = performance.now();

      const requests = Array.from({ length: burstSize }, (_, i) => 
        apiClient.get(`/posts/${(i % 10) + 1}`).catch(error => ({ error }))
      );

      const results = await Promise.all(requests);
      
      const endTime = performance.now();
      const duration = endTime - startTime;

      const successful = results.filter(r => !('error' in r)).length;
      const failed = results.filter(r => 'error' in r).length;

      console.log(`Burst of ${burstSize} requests completed in ${duration.toFixed(2)}ms`);
      console.log(`Successful: ${successful}, Failed: ${failed}`);
      console.log(`Requests per second: ${(burstSize / (duration / 1000)).toFixed(2)}`);

      // Most requests should succeed
      expect(successful).toBeGreaterThan(burstSize * 0.8);
    });

    it('should maintain performance under sustained load', async () => {
      const rounds = 5;
      const requestsPerRound = 10;
      const durations: number[] = [];

      for (let round = 0; round < rounds; round++) {
        const startTime = performance.now();
        
        const requests = Array.from({ length: requestsPerRound }, (_, i) => 
          apiClient.get(`/posts/${(i % 10) + 1}`)
        );

        await Promise.all(requests);
        
        const duration = performance.now() - startTime;
        durations.push(duration);
        
        console.log(`Round ${round + 1}: ${duration.toFixed(2)}ms`);
      }

      // Performance should not degrade significantly
      const firstRound = durations[0];
      const lastRound = durations[durations.length - 1];
      const degradation = (lastRound - firstRound) / firstRound;

      console.log(`Performance degradation: ${(degradation * 100).toFixed(2)}%`);
      
      // Should not degrade more than 50%
      expect(degradation).toBeLessThan(0.5);
    });
  });
});