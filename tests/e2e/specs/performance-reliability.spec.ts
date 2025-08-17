import { test, expect, testData } from '../utils/fixtures';

test.describe('Performance and Reliability Tests', () => {
  test.describe('Load Testing', () => {
    test('should handle high request volume', async ({ 
      performanceHelper, 
      fluxHttpHelpers 
    }) => {
      const url = '/health';
      const requestCount = 100;
      const maxDuration = 30000; // 30 seconds
      
      const result = await performanceHelper.stressTest(url, requestCount, maxDuration);
      
      expect(result.totalRequests).toBeGreaterThan(50);
      expect(result.successCount).toBeGreaterThan(result.errorCount);
      expect(result.averageDuration).toBeLessThan(2000); // Average < 2s
      expect(result.totalDuration).toBeLessThan(maxDuration);
    });

    test('should maintain performance under sustained load', async ({ 
      performanceHelper,
      fluxHttpHelpers 
    }) => {
      const rounds = 5;
      const requestsPerRound = 20;
      const results = [];
      
      for (let round = 0; round < rounds; round++) {
        const urls = Array.from({ length: requestsPerRound }, (_, i) => 
          `/concurrent/${round}-${i}`
        );
        
        const startTime = Date.now();
        const roundResult = await performanceHelper.measureConcurrentRequests(urls, 10);
        const endTime = Date.now();
        
        results.push({
          round,
          successCount: roundResult.successCount,
          duration: endTime - startTime,
          averageTime: (endTime - startTime) / roundResult.successCount
        });
        
        // Brief pause between rounds
        await fluxHttpHelpers.page.waitForTimeout(500);
      }
      
      // Verify all rounds succeeded
      expect(results.every(r => r.successCount === requestsPerRound)).toBe(true);
      
      // Verify performance consistency (variance should be reasonable)
      const averageTimes = results.map(r => r.averageTime);
      const maxTime = Math.max(...averageTimes);
      const minTime = Math.min(...averageTimes);
      const variance = (maxTime - minTime) / minTime;
      
      expect(variance).toBeLessThan(2.0); // Less than 200% variance
    });

    test('should handle burst traffic patterns', async ({ 
      fluxHttpHelpers 
    }) => {
      const result = await fluxHttpHelpers.page.evaluate(async () => {
        const bursts = [];
        
        // Simulate 3 bursts of 50 requests each
        for (let burst = 0; burst < 3; burst++) {
          const burstStart = Date.now();
          
          const requests = Array.from({ length: 50 }, (_, i) =>
            window.fluxHttpInstance.get(`/concurrent/${burst}-${i}`)
          );
          
          try {
            const responses = await Promise.all(requests);
            const burstEnd = Date.now();
            
            bursts.push({
              burst,
              successCount: responses.length,
              duration: burstEnd - burstStart,
              requestsPerSecond: responses.length / ((burstEnd - burstStart) / 1000)
            });
          } catch (error) {
            bursts.push({
              burst,
              error: error.message
            });
          }
          
          // Wait between bursts
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
        
        return { success: true, bursts };
      });
      
      expect(result.success).toBe(true);
      expect(result.bursts).toHaveLength(3);
      
      // All bursts should succeed
      const successfulBursts = result.bursts.filter(b => !b.error);
      expect(successfulBursts.length).toBe(3);
      
      // Each burst should handle reasonable throughput
      successfulBursts.forEach(burst => {
        expect(burst.successCount).toBe(50);
        expect(burst.requestsPerSecond).toBeGreaterThan(5); // At least 5 req/sec
      });
    });
  });

  test.describe('Throughput Testing', () => {
    test('should achieve acceptable throughput for small payloads', async ({ 
      fluxHttpHelpers 
    }) => {
      const result = await fluxHttpHelpers.page.evaluate(async () => {
        const testDuration = 10000; // 10 seconds
        const startTime = Date.now();
        let completedRequests = 0;
        const errors = [];
        
        // Keep sending requests for the duration
        while (Date.now() - startTime < testDuration) {
          try {
            await window.fluxHttpInstance.get('/health');
            completedRequests++;
          } catch (error) {
            errors.push(error.message);
          }
        }
        
        const actualDuration = Date.now() - startTime;
        const throughput = completedRequests / (actualDuration / 1000);
        
        return {
          completedRequests,
          duration: actualDuration,
          throughput,
          errorCount: errors.length,
          successRate: completedRequests / (completedRequests + errors.length)
        };
      });
      
      expect(result.completedRequests).toBeGreaterThan(50); // At least 50 requests in 10s
      expect(result.throughput).toBeGreaterThan(5); // At least 5 req/sec
      expect(result.successRate).toBeGreaterThan(0.95); // 95% success rate
    });

    test('should handle varying payload sizes efficiently', async ({ 
      fluxHttpHelpers 
    }) => {
      const payloadSizes = [
        { name: 'small', size: 1000 },      // 1KB
        { name: 'medium', size: 10000 },    // 10KB
        { name: 'large', size: 100000 },    // 100KB
        { name: 'xlarge', size: 500000 }    // 500KB
      ];
      
      const results = [];
      
      for (const payload of payloadSizes) {
        const result = await fluxHttpHelpers.page.evaluate(async (payload) => {
          const data = { payload: 'x'.repeat(payload.size) };
          const iterations = payload.size > 100000 ? 5 : 10; // Fewer iterations for large payloads
          const timings = [];
          
          for (let i = 0; i < iterations; i++) {
            const start = performance.now();
            try {
              await window.fluxHttpInstance.post('/data/large', data);
              const end = performance.now();
              timings.push(end - start);
            } catch (error) {
              timings.push(null);
            }
          }
          
          const validTimings = timings.filter(t => t !== null);
          const avgTime = validTimings.reduce((a, b) => a + b, 0) / validTimings.length;
          
          return {
            size: payload.size,
            iterations,
            successCount: validTimings.length,
            averageTime: avgTime,
            throughputKBps: (payload.size / 1024) / (avgTime / 1000)
          };
        }, payload);
        
        results.push({ ...payload, ...result });
      }
      
      // Verify all payload sizes were handled
      expect(results).toHaveLength(4);
      
      // All should have reasonable success rates
      results.forEach(result => {
        expect(result.successCount).toBeGreaterThan(result.iterations * 0.8); // 80% success
        expect(result.averageTime).toBeLessThan(10000); // Under 10 seconds
      });
      
      // Throughput should scale reasonably with payload size
      const smallThroughput = results[0].throughputKBps;
      const largeThroughput = results[2].throughputKBps;
      
      // Large payloads might be slower, but not orders of magnitude
      expect(largeThroughput).toBeGreaterThan(smallThroughput / 10);
    });
  });

  test.describe('Memory Management', () => {
    test('should not leak memory during extended usage', async ({ 
      fluxHttpHelpers 
    }) => {
      const memoryTest = await fluxHttpHelpers.page.evaluate(async () => {
        if (!performance.memory) {
          return { available: false };
        }
        
        const measurements = [];
        const iterations = 10;
        
        // Baseline measurement
        measurements.push({
          iteration: 0,
          memory: performance.memory.usedJSHeapSize
        });
        
        // Perform memory-intensive operations
        for (let i = 1; i <= iterations; i++) {
          // Create multiple instances and make requests
          const instances = Array.from({ length: 10 }, () => 
            window.fluxhttp.create({ baseURL: 'http://localhost:3000' })
          );
          
          const requests = instances.map(instance =>
            instance.get('/data/large?size=1000')
          );
          
          await Promise.all(requests);
          
          // Force garbage collection if available
          if (window.gc) {
            window.gc();
          }
          
          measurements.push({
            iteration: i,
            memory: performance.memory.usedJSHeapSize
          });
          
          // Brief pause
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        return {
          available: true,
          measurements,
          memoryIncrease: measurements[measurements.length - 1].memory - measurements[0].memory
        };
      });
      
      if (memoryTest.available) {
        // Memory increase should be reasonable (less than 50MB)
        expect(memoryTest.memoryIncrease).toBeLessThan(50 * 1024 * 1024);
        
        // Memory should not continuously increase
        const firstHalf = memoryTest.measurements.slice(0, 5);
        const secondHalf = memoryTest.measurements.slice(5);
        
        const firstHalfAvg = firstHalf.reduce((sum, m) => sum + m.memory, 0) / firstHalf.length;
        const secondHalfAvg = secondHalf.reduce((sum, m) => sum + m.memory, 0) / secondHalf.length;
        
        // Second half shouldn't be dramatically higher than first half
        const increase = (secondHalfAvg - firstHalfAvg) / firstHalfAvg;
        expect(increase).toBeLessThan(0.5); // Less than 50% increase
      }
    });

    test('should handle large concurrent request volumes without memory issues', async ({ 
      fluxHttpHelpers 
    }) => {
      const result = await fluxHttpHelpers.page.evaluate(async () => {
        const memBefore = performance.memory ? performance.memory.usedJSHeapSize : 0;
        
        // Create a large number of concurrent requests
        const batchSize = 20;
        const batches = 5;
        
        for (let batch = 0; batch < batches; batch++) {
          const requests = Array.from({ length: batchSize }, (_, i) =>
            window.fluxHttpInstance.get(`/concurrent/${batch}-${i}`)
          );
          
          await Promise.all(requests);
          
          // Brief pause between batches
          await new Promise(resolve => setTimeout(resolve, 200));
        }
        
        const memAfter = performance.memory ? performance.memory.usedJSHeapSize : 0;
        
        return {
          totalRequests: batchSize * batches,
          memoryIncrease: memAfter - memBefore,
          memoryAvailable: !!performance.memory
        };
      });
      
      expect(result.totalRequests).toBe(100);
      
      if (result.memoryAvailable) {
        // Memory increase should be reasonable for 100 requests
        expect(result.memoryIncrease).toBeLessThan(20 * 1024 * 1024); // Less than 20MB
      }
    });
  });

  test.describe('Network Condition Resilience', () => {
    test('should handle slow network conditions gracefully', async ({ 
      fluxHttpHelpers 
    }) => {
      // Simulate slow 3G conditions
      await fluxHttpHelpers.simulateNetworkConditions(testData.networkConditions.mobile3G);
      
      const result = await fluxHttpHelpers.measureRequestTiming(async () => {
        return await fluxHttpHelpers.executeRequest('get', '/health');
      });
      
      expect(result.result.success).toBe(true);
      expect(result.duration).toBeGreaterThan(200); // Should take longer due to slow network
      expect(result.duration).toBeLessThan(30000); // But still complete within 30s
      
      // Restore normal network
      await fluxHttpHelpers.simulateNetworkConditions(testData.networkConditions.fast);
    });

    test('should recover from network interruptions', async ({ 
      fluxHttpHelpers 
    }) => {
      const results = [];
      
      // Test sequence: online -> offline -> online
      const networkStates = [false, true, false]; // false = online, true = offline
      
      for (let i = 0; i < networkStates.length; i++) {
        await fluxHttpHelpers.simulateNetworkConditions({ 
          offline: networkStates[i] 
        });
        
        // Wait for network state to settle
        await fluxHttpHelpers.page.waitForTimeout(500);
        
        const result = await fluxHttpHelpers.executeRequest('get', '/health');
        results.push({
          phase: i,
          offline: networkStates[i],
          success: result.success
        });
        
        // Wait between phases
        await fluxHttpHelpers.page.waitForTimeout(1000);
      }
      
      // Verify expected pattern: success -> failure -> success
      expect(results[0].success).toBe(true);  // Online
      expect(results[1].success).toBe(false); // Offline
      expect(results[2].success).toBe(true);  // Online again
    });

    test('should handle variable latency conditions', async ({ 
      fluxHttpHelpers 
    }) => {
      const latencyConditions = [
        { name: 'fast', latency: 20 },
        { name: 'medium', latency: 100 },
        { name: 'slow', latency: 500 }
      ];
      
      const results = [];
      
      for (const condition of latencyConditions) {
        await fluxHttpHelpers.simulateNetworkConditions({
          downloadThroughput: 1000000, // 1Mbps
          uploadThroughput: 1000000,
          latency: condition.latency
        });
        
        const timing = await fluxHttpHelpers.measureRequestTiming(async () => {
          return await fluxHttpHelpers.executeRequest('get', '/health');
        });
        
        results.push({
          ...condition,
          duration: timing.duration,
          success: timing.result.success
        });
      }
      
      // All should succeed
      expect(results.every(r => r.success)).toBe(true);
      
      // Duration should generally increase with latency
      expect(results[2].duration).toBeGreaterThan(results[0].duration);
      
      // Restore normal conditions
      await fluxHttpHelpers.simulateNetworkConditions(testData.networkConditions.fast);
    });
  });

  test.describe('Resource Limits', () => {
    test('should handle maximum concurrent connections', async ({ 
      fluxHttpHelpers 
    }) => {
      // Test with a large number of concurrent connections
      const connectionCount = 50;
      
      const result = await fluxHttpHelpers.page.evaluate(async (connectionCount) => {
        const startTime = Date.now();
        
        // Create requests that will hold connections open
        const requests = Array.from({ length: connectionCount }, (_, i) =>
          window.fluxHttpInstance.get(`/delay/1000?id=${i}`)
        );
        
        try {
          const responses = await Promise.all(requests);
          const endTime = Date.now();
          
          return {
            success: true,
            connectionCount,
            completedCount: responses.length,
            duration: endTime - startTime,
            averageTime: (endTime - startTime) / responses.length
          };
        } catch (error) {
          return {
            success: false,
            error: error.message,
            connectionCount
          };
        }
      }, connectionCount);
      
      if (result.success) {
        expect(result.completedCount).toBe(connectionCount);
        expect(result.averageTime).toBeLessThan(5000); // Should complete reasonably fast
      } else {
        // If it fails, it should be due to resource limits, not other errors
        expect(result.error).toMatch(/(limit|connection|resource)/i);
      }
    });

    test('should handle request timeout scenarios efficiently', async ({ 
      fluxHttpHelpers 
    }) => {
      const timeoutTests = [
        { timeout: 1000, delay: 2000, shouldTimeout: true },
        { timeout: 3000, delay: 1000, shouldTimeout: false },
        { timeout: 500, delay: 1500, shouldTimeout: true }
      ];
      
      const results = [];
      
      for (const testCase of timeoutTests) {
        const result = await fluxHttpHelpers.page.evaluate(async (testCase) => {
          const start = Date.now();
          
          try {
            await window.fluxHttpInstance.get(`/delay/${testCase.delay}`, {
              timeout: testCase.timeout
            });
            
            return {
              ...testCase,
              success: true,
              duration: Date.now() - start
            };
          } catch (error) {
            return {
              ...testCase,
              success: false,
              duration: Date.now() - start,
              error: error.message,
              isTimeout: error.message.includes('timeout') || error.code === 'ECONNABORTED'
            };
          }
        }, testCase);
        
        results.push(result);
      }
      
      // Verify timeout behavior
      results.forEach(result => {
        if (result.shouldTimeout) {
          expect(result.success).toBe(false);
          expect(result.isTimeout).toBe(true);
          expect(result.duration).toBeLessThan(result.timeout + 1000); // Should timeout close to limit
        } else {
          expect(result.success).toBe(true);
          expect(result.duration).toBeGreaterThan(result.delay * 0.8); // Should wait for delay
        }
      });
    });
  });

  test.describe('Reliability Under Stress', () => {
    test('should maintain stability during rapid request cycles', async ({ 
      fluxHttpHelpers 
    }) => {
      const cycles = 5;
      const requestsPerCycle = 30;
      const results = [];
      
      for (let cycle = 0; cycle < cycles; cycle++) {
        const cycleStart = Date.now();
        
        // Rapid fire requests
        const requests = Array.from({ length: requestsPerCycle }, (_, i) =>
          fluxHttpHelpers.executeRequest('get', `/concurrent/${cycle}-${i}`)
        );
        
        const responses = await Promise.allSettled(requests);
        const cycleEnd = Date.now();
        
        const successful = responses.filter(r => r.status === 'fulfilled').length;
        const failed = responses.filter(r => r.status === 'rejected').length;
        
        results.push({
          cycle,
          successful,
          failed,
          duration: cycleEnd - cycleStart,
          successRate: successful / requestsPerCycle
        });
        
        // Brief pause between cycles
        await fluxHttpHelpers.page.waitForTimeout(100);
      }
      
      // All cycles should have high success rates
      expect(results.every(r => r.successRate > 0.8)).toBe(true);
      
      // No cycle should take excessively long
      expect(results.every(r => r.duration < 10000)).toBe(true);
      
      // Overall success rate should be high
      const totalSuccessful = results.reduce((sum, r) => sum + r.successful, 0);
      const totalRequests = cycles * requestsPerCycle;
      const overallSuccessRate = totalSuccessful / totalRequests;
      
      expect(overallSuccessRate).toBeGreaterThan(0.9);
    });

    test('should handle mixed workload patterns', async ({ 
      fluxHttpHelpers 
    }) => {
      // Simulate a mixed workload: reads, writes, uploads, etc.
      const workloadTypes = [
        { type: 'read', method: 'GET', url: '/health' },
        { type: 'write', method: 'POST', url: '/echo', data: { test: 'data' } },
        { type: 'upload', method: 'POST', url: '/files/upload', isFile: true },
        { type: 'large', method: 'GET', url: '/data/large?size=5000' },
        { type: 'delay', method: 'GET', url: '/delay/500' }
      ];
      
      const mixedResults = [];
      const iterations = 10;
      
      for (let i = 0; i < iterations; i++) {
        // Pick random workload type
        const workload = workloadTypes[Math.floor(Math.random() * workloadTypes.length)];
        
        const result = await fluxHttpHelpers.page.evaluate(async (workload, iteration) => {
          const start = Date.now();
          
          try {
            let response;
            
            if (workload.isFile) {
              // Simulate file upload
              const formData = new FormData();
              const blob = new Blob(['test file content'], { type: 'text/plain' });
              formData.append('file', blob, `test-${iteration}.txt`);
              
              response = await window.fluxHttpInstance.post(workload.url, formData);
            } else {
              response = await window.fluxHttpInstance.request({
                method: workload.method,
                url: workload.url,
                data: workload.data
              });
            }
            
            return {
              type: workload.type,
              success: true,
              duration: Date.now() - start,
              status: response.status
            };
          } catch (error) {
            return {
              type: workload.type,
              success: false,
              duration: Date.now() - start,
              error: error.message
            };
          }
        }, workload, i);
        
        mixedResults.push(result);
        
        // Random delay between requests
        await fluxHttpHelpers.page.waitForTimeout(Math.random() * 200);
      }
      
      // Group results by type
      const resultsByType = workloadTypes.reduce((acc, type) => {
        acc[type.type] = mixedResults.filter(r => r.type === type.type);
        return acc;
      }, {});
      
      // Each workload type should have some successful executions
      Object.values(resultsByType).forEach((results: any[]) => {
        if (results.length > 0) {
          const successRate = results.filter(r => r.success).length / results.length;
          expect(successRate).toBeGreaterThan(0.7); // 70% success rate minimum
        }
      });
    });

    test('should maintain performance during error conditions', async ({ 
      fluxHttpHelpers 
    }) => {
      // Mix successful and failing requests
      const testUrls = [
        '/health',         // Success
        '/error/500',      // Server error
        '/concurrent/1',   // Success
        '/error/404',      // Not found
        '/concurrent/2',   // Success
        '/timeout',        // Timeout (with short timeout)
        '/health'          // Success
      ];
      
      const results = [];
      
      for (const url of testUrls) {
        const timing = await fluxHttpHelpers.measureRequestTiming(async () => {
          if (url === '/timeout') {
            return await fluxHttpHelpers.executeRequest('get', url, { timeout: 1000 });
          } else {
            return await fluxHttpHelpers.executeRequest('get', url);
          }
        });
        
        results.push({
          url,
          success: timing.result.success,
          duration: timing.duration,
          expectedToFail: url.includes('/error') || url.includes('/timeout')
        });
      }
      
      // Successful requests should complete quickly
      const successfulResults = results.filter(r => r.success);
      expect(successfulResults.every(r => r.duration < 5000)).toBe(true);
      
      // Failed requests should fail quickly (not hang)
      const failedResults = results.filter(r => !r.success);
      expect(failedResults.every(r => r.duration < 10000)).toBe(true);
      
      // Mix should be as expected
      const expectedSuccesses = results.filter(r => !r.expectedToFail);
      const actualSuccesses = results.filter(r => r.success);
      
      expect(actualSuccesses.length).toBe(expectedSuccesses.length);
    });
  });
});