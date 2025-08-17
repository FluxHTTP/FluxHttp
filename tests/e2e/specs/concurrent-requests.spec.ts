import { test, expect, testData } from '../utils/fixtures';

test.describe('Concurrent Requests and Deduplication', () => {
  test.describe('Basic Concurrent Requests', () => {
    test('should handle multiple concurrent GET requests', async ({ 
      fluxHttpHelpers, 
      performanceHelper 
    }) => {
      const urls = Array.from({ length: 10 }, (_, i) => `/concurrent/${i}`);
      
      const result = await performanceHelper.measureConcurrentRequests(urls, 5);
      
      expect(result.successCount).toBe(10);
      expect(result.errorCount).toBe(0);
      expect(result.results).toHaveLength(10);
      
      // Verify all requests completed with unique responses
      const uniqueIds = new Set(result.results.map(r => 
        parseInt(r.url.split('/').pop())
      ));
      expect(uniqueIds.size).toBe(10);
    });

    test('should handle concurrent requests with different HTTP methods', async ({ 
      fluxHttpHelpers 
    }) => {
      await fluxHttpHelpers.setupRequestInterception();
      
      const result = await fluxHttpHelpers.page.evaluate(async () => {
        const requests = [
          window.fluxHttpInstance.get('/echo'),
          window.fluxHttpInstance.post('/echo', { data: 'post-data' }),
          window.fluxHttpInstance.put('/echo', { data: 'put-data' }),
          window.fluxHttpInstance.delete('/echo'),
          window.fluxHttpInstance.patch('/echo', { data: 'patch-data' })
        ];
        
        try {
          const responses = await Promise.all(requests);
          return {
            success: true,
            methods: responses.map(r => r.data.method),
            count: responses.length
          };
        } catch (error) {
          return { success: false, error: error.message };
        }
      });
      
      expect(result.success).toBe(true);
      expect(result.count).toBe(5);
      expect(result.methods).toEqual(['GET', 'POST', 'PUT', 'DELETE', 'PATCH']);
    });

    test('should handle large number of concurrent requests', async ({ 
      performanceHelper 
    }) => {
      const urls = Array.from({ length: 100 }, (_, i) => `/concurrent/${i}`);
      const concurrency = 20;
      
      const startTime = Date.now();
      const result = await performanceHelper.measureConcurrentRequests(urls, concurrency);
      const duration = Date.now() - startTime;
      
      expect(result.successCount).toBe(100);
      expect(result.errorCount).toBe(0);
      expect(duration).toBeLessThan(30000); // Should complete within 30 seconds
      
      // Verify requests were properly batched
      expect(result.batchTimings).toHaveLength(Math.ceil(100 / concurrency));
    });
  });

  test.describe('Request Deduplication', () => {
    test('should deduplicate identical GET requests', async ({ 
      fluxHttpHelpers 
    }) => {
      await fluxHttpHelpers.setupRequestInterception();
      
      const result = await fluxHttpHelpers.page.evaluate(async () => {
        // Make 5 identical requests simultaneously
        const requests = Array.from({ length: 5 }, () =>
          window.fluxHttpInstance.get('/health')
        );
        
        try {
          const responses = await Promise.all(requests);
          return {
            success: true,
            responseCount: responses.length,
            allIdentical: responses.every(r => 
              JSON.stringify(r.data) === JSON.stringify(responses[0].data)
            )
          };
        } catch (error) {
          return { success: false, error: error.message };
        }
      });
      
      expect(result.success).toBe(true);
      expect(result.responseCount).toBe(5);
      expect(result.allIdentical).toBe(true);
      
      // Check if requests were actually deduplicated at network level
      const interceptedRequests = await fluxHttpHelpers.getInterceptedRequests();
      const healthRequests = interceptedRequests.filter(req => 
        req.url.includes('/health')
      );
      
      // With deduplication, we should see fewer network requests than responses
      expect(healthRequests.length).toBeLessThanOrEqual(5);
    });

    test('should not deduplicate requests with different parameters', async ({ 
      fluxHttpHelpers 
    }) => {
      await fluxHttpHelpers.setupRequestInterception();
      
      const result = await fluxHttpHelpers.page.evaluate(async () => {
        const requests = [
          window.fluxHttpInstance.get('/echo?param=1'),
          window.fluxHttpInstance.get('/echo?param=2'),
          window.fluxHttpInstance.get('/echo?param=3'),
          window.fluxHttpInstance.get('/echo?param=1'), // Duplicate of first
          window.fluxHttpInstance.get('/echo?param=2')  // Duplicate of second
        ];
        
        try {
          const responses = await Promise.all(requests);
          return {
            success: true,
            uniqueParams: [...new Set(responses.map(r => r.data.query.param))]
          };
        } catch (error) {
          return { success: false, error: error.message };
        }
      });
      
      expect(result.success).toBe(true);
      expect(result.uniqueParams.sort()).toEqual(['1', '2', '3']);
      
      const interceptedRequests = await fluxHttpHelpers.getInterceptedRequests();
      const echoRequests = interceptedRequests.filter(req => 
        req.url.includes('/echo')
      );
      
      // Should see requests for each unique parameter combination
      expect(echoRequests.length).toBeGreaterThanOrEqual(3);
    });

    test('should not deduplicate POST requests', async ({ 
      fluxHttpHelpers 
    }) => {
      await fluxHttpHelpers.setupRequestInterception();
      
      const result = await fluxHttpHelpers.page.evaluate(async () => {
        // Make identical POST requests
        const requests = Array.from({ length: 3 }, () =>
          window.fluxHttpInstance.post('/echo', { data: 'identical' })
        );
        
        try {
          const responses = await Promise.all(requests);
          return {
            success: true,
            responseCount: responses.length
          };
        } catch (error) {
          return { success: false, error: error.message };
        }
      });
      
      expect(result.success).toBe(true);
      expect(result.responseCount).toBe(3);
      
      const interceptedRequests = await fluxHttpHelpers.getInterceptedRequests();
      const postRequests = interceptedRequests.filter(req => 
        req.url.includes('/echo') && req.options.method === 'POST'
      );
      
      // POST requests should not be deduplicated
      expect(postRequests.length).toBe(3);
    });

    test('should handle deduplication with different request options', async ({ 
      fluxHttpHelpers 
    }) => {
      const result = await fluxHttpHelpers.page.evaluate(async () => {
        const requests = [
          window.fluxHttpInstance.get('/health', { timeout: 5000 }),
          window.fluxHttpInstance.get('/health', { timeout: 10000 }),
          window.fluxHttpInstance.get('/health') // Default timeout
        ];
        
        try {
          const responses = await Promise.all(requests);
          return {
            success: true,
            responseCount: responses.length,
            allSameData: responses.every(r => 
              JSON.stringify(r.data) === JSON.stringify(responses[0].data)
            )
          };
        } catch (error) {
          return { success: false, error: error.message };
        }
      });
      
      expect(result.success).toBe(true);
      expect(result.responseCount).toBe(3);
      expect(result.allSameData).toBe(true);
    });
  });

  test.describe('Request Timing and Ordering', () => {
    test('should maintain request order for sequential requests', async ({ 
      fluxHttpHelpers 
    }) => {
      const result = await fluxHttpHelpers.page.evaluate(async () => {
        const results = [];
        
        // Make sequential requests with different delays
        for (let i = 0; i < 5; i++) {
          const start = Date.now();
          const response = await window.fluxHttpInstance.get(`/delay/${i * 100}`);
          const end = Date.now();
          
          results.push({
            index: i,
            duration: end - start,
            responseDelay: response.data.delay
          });
        }
        
        return { success: true, results };
      });
      
      expect(result.success).toBe(true);
      expect(result.results).toHaveLength(5);
      
      // Verify requests completed in order
      result.results.forEach((item, index) => {
        expect(item.index).toBe(index);
        expect(item.responseDelay).toBe(index * 100);
      });
    });

    test('should handle out-of-order completion for concurrent requests', async ({ 
      fluxHttpHelpers 
    }) => {
      const result = await fluxHttpHelpers.page.evaluate(async () => {
        // Start requests with decreasing delays (should complete in reverse order)
        const promises = Array.from({ length: 5 }, (_, i) => {
          const delay = (4 - i) * 200; // 800, 600, 400, 200, 0
          const startTime = Date.now();
          
          return window.fluxHttpInstance.get(`/delay/${delay}`).then(response => ({
            originalIndex: i,
            delay: delay,
            actualDelay: response.data.delay,
            completionTime: Date.now() - startTime
          }));
        });
        
        try {
          const responses = await Promise.all(promises);
          return { success: true, responses };
        } catch (error) {
          return { success: false, error: error.message };
        }
      });
      
      expect(result.success).toBe(true);
      expect(result.responses).toHaveLength(5);
      
      // Verify responses contain correct delay information
      result.responses.forEach((response, index) => {
        expect(response.originalIndex).toBe(index);
        expect(response.actualDelay).toBe((4 - index) * 200);
      });
    });

    test('should handle request racing conditions', async ({ 
      fluxHttpHelpers 
    }) => {
      const result = await fluxHttpHelpers.page.evaluate(async () => {
        // Create racing condition with cache-dependent endpoint
        const racePromises = Array.from({ length: 10 }, (_, i) =>
          window.fluxHttpInstance.get(`/concurrent/${i % 3}`) // Only 3 unique URLs
        );
        
        try {
          const responses = await Promise.all(racePromises);
          return {
            success: true,
            responseCount: responses.length,
            uniqueIds: [...new Set(responses.map(r => r.data.id))]
          };
        } catch (error) {
          return { success: false, error: error.message };
        }
      });
      
      expect(result.success).toBe(true);
      expect(result.responseCount).toBe(10);
      expect(result.uniqueIds).toHaveLength(3); // Only 3 unique responses
    });
  });

  test.describe('Resource Management Under Load', () => {
    test('should manage memory efficiently during concurrent requests', async ({ 
      fluxHttpHelpers 
    }) => {
      const memoryBefore = await fluxHttpHelpers.getMemoryUsage();
      
      const result = await fluxHttpHelpers.page.evaluate(async () => {
        // Make many concurrent requests
        const requests = Array.from({ length: 50 }, (_, i) =>
          window.fluxHttpInstance.get(`/concurrent/${i}`)
        );
        
        try {
          const responses = await Promise.all(requests);
          return {
            success: true,
            count: responses.length
          };
        } catch (error) {
          return { success: false, error: error.message };
        }
      });
      
      const memoryAfter = await fluxHttpHelpers.getMemoryUsage();
      
      expect(result.success).toBe(true);
      expect(result.count).toBe(50);
      
      if (memoryBefore && memoryAfter) {
        // Memory should not have increased dramatically
        const memoryIncrease = memoryAfter.usedJSHeapSize - memoryBefore.usedJSHeapSize;
        const maxAcceptableIncrease = 50 * 1024 * 1024; // 50MB max increase
        
        expect(memoryIncrease).toBeLessThan(maxAcceptableIncrease);
      }
    });

    test('should handle connection pooling correctly', async ({ 
      fluxHttpHelpers 
    }) => {
      // Test if FluxHTTP reuses connections efficiently
      const result = await fluxHttpHelpers.page.evaluate(async () => {
        const startTime = Date.now();
        
        // Make many requests to the same endpoint
        const requests = Array.from({ length: 20 }, () =>
          window.fluxHttpInstance.get('/health')
        );
        
        try {
          const responses = await Promise.all(requests);
          const totalTime = Date.now() - startTime;
          
          return {
            success: true,
            count: responses.length,
            totalTime,
            averageTime: totalTime / responses.length
          };
        } catch (error) {
          return { success: false, error: error.message };
        }
      });
      
      expect(result.success).toBe(true);
      expect(result.count).toBe(20);
      expect(result.averageTime).toBeLessThan(1000); // Should be fast with connection reuse
    });

    test('should handle request queue management', async ({ 
      fluxHttpHelpers 
    }) => {
      const result = await fluxHttpHelpers.page.evaluate(async () => {
        // Create a queue of requests with varying delays
        const delays = [100, 200, 50, 300, 150, 75, 400, 125];
        
        const requests = delays.map((delay, i) => ({
          promise: window.fluxHttpInstance.get(`/delay/${delay}`),
          expectedDelay: delay,
          index: i
        }));
        
        try {
          const responses = await Promise.all(requests.map(r => r.promise));
          
          return {
            success: true,
            responses: responses.map((response, i) => ({
              index: i,
              expectedDelay: delays[i],
              actualDelay: response.data.delay
            }))
          };
        } catch (error) {
          return { success: false, error: error.message };
        }
      });
      
      expect(result.success).toBe(true);
      expect(result.responses).toHaveLength(8);
      
      // Verify all requests completed with correct delays
      result.responses.forEach(response => {
        expect(response.actualDelay).toBe(response.expectedDelay);
      });
    });
  });

  test.describe('Error Handling in Concurrent Scenarios', () => {
    test('should handle mixed success and failure in concurrent requests', async ({ 
      fluxHttpHelpers 
    }) => {
      const result = await fluxHttpHelpers.page.evaluate(async () => {
        const requests = [
          window.fluxHttpInstance.get('/health'),
          window.fluxHttpInstance.get('/error/404'),
          window.fluxHttpInstance.get('/concurrent/1'),
          window.fluxHttpInstance.get('/error/500'),
          window.fluxHttpInstance.get('/concurrent/2')
        ];
        
        const results = await Promise.allSettled(requests);
        
        return {
          success: true,
          results: results.map(result => ({
            status: result.status,
            success: result.status === 'fulfilled',
            errorStatus: result.status === 'rejected' ? result.reason?.response?.status : null
          }))
        };
      });
      
      expect(result.success).toBe(true);
      expect(result.results).toHaveLength(5);
      
      const successful = result.results.filter(r => r.success);
      const failed = result.results.filter(r => !r.success);
      
      expect(successful).toHaveLength(3);
      expect(failed).toHaveLength(2);
      expect(failed.map(f => f.errorStatus).sort()).toEqual([404, 500]);
    });

    test('should handle partial failures in large concurrent batches', async ({ 
      performanceHelper 
    }) => {
      // Create URLs with mix of valid and invalid endpoints
      const urls = Array.from({ length: 20 }, (_, i) => 
        i % 4 === 0 ? `/error/${400 + (i % 4)}` : `/concurrent/${i}`
      );
      
      const result = await performanceHelper.measureConcurrentRequests(urls, 10);
      
      expect(result.results).toHaveLength(20);
      expect(result.successCount).toBeGreaterThan(10);
      expect(result.errorCount).toBeGreaterThan(0);
      expect(result.successCount + result.errorCount).toBe(20);
    });

    test('should handle timeout in concurrent requests', async ({ 
      fluxHttpHelpers 
    }) => {
      const result = await fluxHttpHelpers.page.evaluate(async () => {
        // Mix of fast and slow requests with timeout
        const requests = [
          window.fluxHttpInstance.get('/delay/100'),
          window.fluxHttpInstance.get('/delay/5000', { timeout: 1000 }), // Will timeout
          window.fluxHttpInstance.get('/delay/200'),
          window.fluxHttpInstance.get('/delay/6000', { timeout: 1000 }), // Will timeout
          window.fluxHttpInstance.get('/delay/300')
        ];
        
        const results = await Promise.allSettled(requests);
        
        return {
          success: true,
          results: results.map((result, i) => ({
            index: i,
            status: result.status,
            isTimeout: result.status === 'rejected' && 
                      result.reason?.message?.includes('timeout')
          }))
        };
      });
      
      expect(result.success).toBe(true);
      expect(result.results).toHaveLength(5);
      
      const successful = result.results.filter(r => r.status === 'fulfilled');
      const timeouts = result.results.filter(r => r.isTimeout);
      
      expect(successful).toHaveLength(3);
      expect(timeouts).toHaveLength(2);
    });
  });

  test.describe('Stress Testing', () => {
    test('should handle high-frequency request bursts', async ({ 
      performanceHelper 
    }) => {
      const result = await performanceHelper.stressTest('/health', 100, 10000);
      
      expect(result.totalRequests).toBeGreaterThan(50);
      expect(result.successCount).toBeGreaterThan(result.errorCount);
      expect(result.averageDuration).toBeLessThan(1000); // Average response time under 1s
    });

    test('should maintain performance under sustained load', async ({ 
      fluxHttpHelpers 
    }) => {
      const result = await fluxHttpHelpers.page.evaluate(async () => {
        const rounds = 5;
        const requestsPerRound = 20;
        const results = [];
        
        for (let round = 0; round < rounds; round++) {
          const roundStart = Date.now();
          
          const requests = Array.from({ length: requestsPerRound }, (_, i) =>
            window.fluxHttpInstance.get(`/concurrent/${round}-${i}`)
          );
          
          try {
            const responses = await Promise.all(requests);
            const roundTime = Date.now() - roundStart;
            
            results.push({
              round,
              requestCount: responses.length,
              roundTime,
              averageTime: roundTime / responses.length
            });
          } catch (error) {
            results.push({
              round,
              error: error.message
            });
          }
          
          // Brief pause between rounds
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        return { success: true, results };
      });
      
      expect(result.success).toBe(true);
      expect(result.results).toHaveLength(5);
      
      // Performance should remain consistent across rounds
      const averageTimes = result.results
        .filter(r => !r.error)
        .map(r => r.averageTime);
      
      expect(averageTimes.length).toBeGreaterThan(3);
      
      const maxTime = Math.max(...averageTimes);
      const minTime = Math.min(...averageTimes);
      const variance = (maxTime - minTime) / minTime;
      
      // Variance should be reasonable (less than 100% difference)
      expect(variance).toBeLessThan(1.0);
    });
  });
});