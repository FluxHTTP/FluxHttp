import { test, expect, testData } from '../utils/fixtures';

test.describe('Error Handling and Network Failures', () => {
  test.describe('HTTP Error Status Codes', () => {
    test('should handle 400 Bad Request', async ({ fluxHttpHelpers }) => {
      const result = await fluxHttpHelpers.executeRequest('get', '/error/400');
      
      expect(result.success).toBe(false);
      expect(result.error.status).toBe(400);
      expect(result.error.data).toMatchObject({
        error: 'Simulated 400 error',
        code: 400
      });
    });

    test('should handle 401 Unauthorized', async ({ fluxHttpHelpers }) => {
      const result = await fluxHttpHelpers.executeRequest('get', '/error/401');
      
      expect(result.success).toBe(false);
      expect(result.error.status).toBe(401);
      expect(result.error.data.error).toContain('Unauthorized');
    });

    test('should handle 403 Forbidden', async ({ fluxHttpHelpers }) => {
      const result = await fluxHttpHelpers.executeRequest('get', '/error/403');
      
      expect(result.success).toBe(false);
      expect(result.error.status).toBe(403);
      expect(result.error.data.error).toContain('Forbidden');
    });

    test('should handle 404 Not Found', async ({ fluxHttpHelpers }) => {
      const result = await fluxHttpHelpers.executeRequest('get', '/error/404');
      
      expect(result.success).toBe(false);
      expect(result.error.status).toBe(404);
      expect(result.error.data.error).toContain('Not Found');
    });

    test('should handle 429 Too Many Requests', async ({ fluxHttpHelpers }) => {
      const result = await fluxHttpHelpers.executeRequest('get', '/error/429');
      
      expect(result.success).toBe(false);
      expect(result.error.status).toBe(429);
      expect(result.error.data.error).toContain('Too Many Requests');
    });

    test('should handle 500 Internal Server Error', async ({ fluxHttpHelpers }) => {
      const result = await fluxHttpHelpers.executeRequest('get', '/error/500');
      
      expect(result.success).toBe(false);
      expect(result.error.status).toBe(500);
      expect(result.error.data.error).toContain('Internal Server Error');
    });

    test('should handle 502 Bad Gateway', async ({ fluxHttpHelpers }) => {
      const result = await fluxHttpHelpers.executeRequest('get', '/error/502');
      
      expect(result.success).toBe(false);
      expect(result.error.status).toBe(502);
      expect(result.error.data.error).toContain('Bad Gateway');
    });

    test('should handle 503 Service Unavailable', async ({ fluxHttpHelpers }) => {
      const result = await fluxHttpHelpers.executeRequest('get', '/error/503');
      
      expect(result.success).toBe(false);
      expect(result.error.status).toBe(503);
      expect(result.error.data.error).toContain('Service Unavailable');
    });

    test('should handle custom error messages', async ({ fluxHttpHelpers }) => {
      const customMessage = 'Custom error message for testing';
      const result = await fluxHttpHelpers.executeRequest('get', `/error/422?message=${encodeURIComponent(customMessage)}`);
      
      expect(result.success).toBe(false);
      expect(result.error.status).toBe(422);
      expect(result.error.data.error).toBe(customMessage);
    });
  });

  test.describe('Network Failures', () => {
    test('should handle complete network failure', async ({ fluxHttpHelpers }) => {
      // Simulate offline condition
      await fluxHttpHelpers.simulateNetworkConditions({ offline: true });
      
      const result = await fluxHttpHelpers.executeRequest('get', '/health');
      
      expect(result.success).toBe(false);
      expect(result.error.message).toContain('Failed to fetch');
      
      // Restore network
      await fluxHttpHelpers.simulateNetworkConditions({ offline: false });
    });

    test('should handle DNS resolution failure', async ({ fluxHttpHelpers }) => {
      // Test with invalid domain
      const result = await fluxHttpHelpers.page.evaluate(async () => {
        try {
          const response = await window.fluxHttpInstance.get('http://non-existent-domain-12345.invalid/api');
          return { success: true, data: response.data };
        } catch (error) {
          return {
            success: false,
            error: {
              message: error.message,
              code: error.code,
              isDnsError: error.message.includes('NXDOMAIN') || error.message.includes('Failed to fetch')
            }
          };
        }
      });
      
      expect(result.success).toBe(false);
      expect(result.error.isDnsError).toBe(true);
    });

    test('should handle connection refused', async ({ fluxHttpHelpers }) => {
      // Test with invalid port
      const result = await fluxHttpHelpers.page.evaluate(async () => {
        try {
          const response = await window.fluxHttpInstance.get('http://localhost:99999/api');
          return { success: true, data: response.data };
        } catch (error) {
          return {
            success: false,
            error: {
              message: error.message,
              isConnectionError: error.message.includes('Failed to fetch') || error.message.includes('ECONNREFUSED')
            }
          };
        }
      });
      
      expect(result.success).toBe(false);
      expect(result.error.isConnectionError).toBe(true);
    });

    test('should handle slow network conditions', async ({ fluxHttpHelpers }) => {
      // Simulate very slow network
      await fluxHttpHelpers.simulateNetworkConditions(testData.networkConditions.slow);
      
      const timing = await fluxHttpHelpers.measureRequestTiming(async () => {
        return await fluxHttpHelpers.executeRequest('get', '/health');
      });
      
      expect(timing.result.success).toBe(true);
      expect(timing.duration).toBeGreaterThan(100); // Should take longer due to slow network
      
      // Restore normal network
      await fluxHttpHelpers.simulateNetworkConditions(testData.networkConditions.fast);
    });

    test('should handle intermittent connectivity', async ({ fluxHttpHelpers }) => {
      const results = [];
      
      // Alternate between online and offline
      for (let i = 0; i < 5; i++) {
        const isOffline = i % 2 === 0;
        await fluxHttpHelpers.simulateNetworkConditions({ offline: isOffline });
        
        const result = await fluxHttpHelpers.executeRequest('get', '/health');
        results.push({ isOffline, success: result.success });
      }
      
      // Restore online
      await fluxHttpHelpers.simulateNetworkConditions({ offline: false });
      
      // Verify that offline requests failed and online requests succeeded
      results.forEach(({ isOffline, success }) => {
        if (isOffline) {
          expect(success).toBe(false);
        } else {
          expect(success).toBe(true);
        }
      });
    });
  });

  test.describe('Timeout Handling', () => {
    test('should handle request timeout', async ({ fluxHttpHelpers }) => {
      // Set short timeout
      await fluxHttpHelpers.createFluxHttpInstance({ timeout: 1000 });
      
      const result = await fluxHttpHelpers.executeRequest('get', '/delay/2000');
      
      expect(result.success).toBe(false);
      expect(result.error.message).toContain('timeout');
    });

    test('should handle different timeout values', async ({ fluxHttpHelpers }) => {
      const timeouts = [500, 1000, 2000];
      const delays = [300, 1500, 1000]; // Some within timeout, some not
      
      for (let i = 0; i < timeouts.length; i++) {
        await fluxHttpHelpers.createFluxHttpInstance({ timeout: timeouts[i] });
        
        const result = await fluxHttpHelpers.executeRequest('get', `/delay/${delays[i]}`);
        
        if (delays[i] < timeouts[i]) {
          expect(result.success).toBe(true);
        } else {
          expect(result.success).toBe(false);
          expect(result.error.message).toContain('timeout');
        }
      }
    });

    test('should handle server timeout response', async ({ fluxHttpHelpers }) => {
      // Use the timeout endpoint that never responds
      const result = await fluxHttpHelpers.page.evaluate(async () => {
        try {
          const response = await window.fluxHttpInstance.get('/timeout', {
            timeout: 3000 // 3 second timeout
          });
          return { success: true, data: response.data };
        } catch (error) {
          return {
            success: false,
            error: {
              message: error.message,
              isTimeout: error.code === 'ECONNABORTED' || error.message.includes('timeout')
            }
          };
        }
      });
      
      expect(result.success).toBe(false);
      expect(result.error.isTimeout).toBe(true);
    });
  });

  test.describe('Malformed Response Handling', () => {
    test('should handle malformed JSON response', async ({ fluxHttpHelpers }) => {
      // Note: This test assumes the server can return malformed JSON
      // For a real test, you'd need an endpoint that returns invalid JSON
      const result = await fluxHttpHelpers.page.evaluate(async () => {
        // Mock a response with malformed JSON
        const originalFetch = window.fetch;
        window.fetch = async function(url, options) {
          if (url.includes('/malformed-json')) {
            return {
              ok: true,
              status: 200,
              json: async () => {
                throw new SyntaxError('Unexpected token in JSON');
              },
              text: async () => '{invalid json}'
            };
          }
          return originalFetch.call(this, url, options);
        };
        
        try {
          const response = await window.fluxHttpInstance.get('/malformed-json');
          return { success: true, data: response.data };
        } catch (error) {
          return {
            success: false,
            error: {
              message: error.message,
              isParseError: error.message.includes('JSON') || error.message.includes('Unexpected token')
            }
          };
        } finally {
          // Restore original fetch
          window.fetch = originalFetch;
        }
      });
      
      expect(result.success).toBe(false);
      expect(result.error.isParseError).toBe(true);
    });

    test('should handle empty response body', async ({ fluxHttpHelpers }) => {
      const result = await fluxHttpHelpers.page.evaluate(async () => {
        // Mock empty response
        const originalFetch = window.fetch;
        window.fetch = async function(url, options) {
          if (url.includes('/empty-response')) {
            return {
              ok: true,
              status: 200,
              json: async () => null,
              text: async () => ''
            };
          }
          return originalFetch.call(this, url, options);
        };
        
        try {
          const response = await window.fluxHttpInstance.get('/empty-response');
          return { success: true, data: response.data };
        } catch (error) {
          return { success: false, error: error.message };
        } finally {
          window.fetch = originalFetch;
        }
      });
      
      // Should handle empty response gracefully
      expect(result.success).toBe(true);
      expect(result.data).toBeNull();
    });
  });

  test.describe('Large Payload Error Handling', () => {
    test('should handle payload too large error', async ({ fluxHttpHelpers }) => {
      const result = await fluxHttpHelpers.page.evaluate(async () => {
        // Create very large payload
        const largePayload = {
          data: 'x'.repeat(100 * 1024 * 1024) // 100MB
        };
        
        try {
          const response = await window.fluxHttpInstance.post('/data/large', largePayload);
          return { success: true, data: response.data };
        } catch (error) {
          return {
            success: false,
            error: {
              message: error.message,
              status: error.response?.status,
              isPayloadError: error.response?.status === 413 || error.message.includes('payload')
            }
          };
        }
      });
      
      expect(result.success).toBe(false);
      expect(result.error.isPayloadError).toBe(true);
    });

    test('should handle memory exhaustion during large requests', async ({ fluxHttpHelpers }) => {
      // Monitor memory before and during large request
      const memoryBefore = await fluxHttpHelpers.getMemoryUsage();
      
      const result = await fluxHttpHelpers.page.evaluate(async () => {
        // Create moderately large payload that shouldn't fail but uses memory
        const payload = {
          data: 'x'.repeat(10 * 1024 * 1024) // 10MB
        };
        
        try {
          const response = await window.fluxHttpInstance.post('/data/large', payload);
          return { success: true, data: response.data };
        } catch (error) {
          return {
            success: false,
            error: {
              message: error.message,
              isMemoryError: error.message.includes('memory') || error.message.includes('heap')
            }
          };
        }
      });
      
      const memoryAfter = await fluxHttpHelpers.getMemoryUsage();
      
      if (memoryBefore && memoryAfter) {
        // Memory usage should have increased during the large request
        expect(memoryAfter.usedJSHeapSize).toBeGreaterThanOrEqual(memoryBefore.usedJSHeapSize);
      }
      
      // Request should succeed if memory is available
      if (result.success) {
        expect(result.data.processed).toBe(1);
      }
    });
  });

  test.describe('Rate Limiting', () => {
    test('should handle rate limit errors', async ({ fluxHttpHelpers }) => {
      // Make multiple rapid requests to trigger rate limiting
      const results = [];
      
      for (let i = 0; i < 15; i++) {
        const result = await fluxHttpHelpers.executeRequest('get', '/limited');
        results.push(result);
      }
      
      // Some requests should succeed, others should be rate limited
      const successfulRequests = results.filter(r => r.success);
      const rateLimitedRequests = results.filter(r => !r.success && r.error.status === 429);
      
      expect(successfulRequests.length).toBeLessThan(results.length);
      expect(rateLimitedRequests.length).toBeGreaterThan(0);
      
      // Rate limited responses should include retry information
      const rateLimitError = rateLimitedRequests[0];
      expect(rateLimitError.error.data).toMatchObject({
        error: 'Too Many Requests',
        retryAfter: expect.any(Number)
      });
    });

    test('should respect Retry-After header', async ({ fluxHttpHelpers }) => {
      // First, trigger rate limiting
      for (let i = 0; i < 10; i++) {
        await fluxHttpHelpers.executeRequest('get', '/limited');
      }
      
      // Get rate limited
      const rateLimitResult = await fluxHttpHelpers.executeRequest('get', '/limited');
      
      if (!rateLimitResult.success && rateLimitResult.error.status === 429) {
        const retryAfter = rateLimitResult.error.data.retryAfter;
        
        // Wait for the retry period to expire
        await fluxHttpHelpers.page.waitForTimeout((retryAfter + 1) * 1000);
        
        // Should be able to make requests again
        const retryResult = await fluxHttpHelpers.executeRequest('get', '/limited');
        expect(retryResult.success).toBe(true);
      }
    });
  });

  test.describe('Request Cancellation', () => {
    test('should handle request cancellation', async ({ fluxHttpHelpers }) => {
      const result = await fluxHttpHelpers.page.evaluate(async () => {
        const controller = new AbortController();
        
        // Start a request with delay
        const requestPromise = window.fluxHttpInstance.get('/delay/3000', {
          signal: controller.signal
        });
        
        // Cancel after 500ms
        setTimeout(() => controller.abort(), 500);
        
        try {
          const response = await requestPromise;
          return { success: true, data: response.data };
        } catch (error) {
          return {
            success: false,
            error: {
              message: error.message,
              isCancelled: error.name === 'AbortError' || error.message.includes('abort')
            }
          };
        }
      });
      
      expect(result.success).toBe(false);
      expect(result.error.isCancelled).toBe(true);
    });

    test('should handle multiple request cancellations', async ({ fluxHttpHelpers }) => {
      const result = await fluxHttpHelpers.page.evaluate(async () => {
        const controllers = Array.from({ length: 5 }, () => new AbortController());
        
        const requests = controllers.map((controller, i) =>
          window.fluxHttpInstance.get(`/delay/2000`, {
            signal: controller.signal
          }).catch(error => ({
            index: i,
            cancelled: error.name === 'AbortError'
          }))
        );
        
        // Cancel all requests after 500ms
        setTimeout(() => {
          controllers.forEach(controller => controller.abort());
        }, 500);
        
        const results = await Promise.all(requests);
        return {
          success: true,
          results: results.map(r => r.cancelled || false)
        };
      });
      
      expect(result.success).toBe(true);
      expect(result.results.every(cancelled => cancelled)).toBe(true);
    });
  });

  test.describe('Error Recovery', () => {
    test('should recover from temporary network errors', async ({ fluxHttpHelpers }) => {
      // Simulate temporary network failure
      await fluxHttpHelpers.simulateNetworkConditions({ offline: true });
      
      // First request should fail
      const firstResult = await fluxHttpHelpers.executeRequest('get', '/health');
      expect(firstResult.success).toBe(false);
      
      // Restore network
      await fluxHttpHelpers.simulateNetworkConditions({ offline: false });
      
      // Second request should succeed
      const secondResult = await fluxHttpHelpers.executeRequest('get', '/health');
      expect(secondResult.success).toBe(true);
    });

    test('should handle error during retry operations', async ({ fluxHttpHelpers }) => {
      // Create instance with retry logic
      await fluxHttpHelpers.createFluxHttpInstance({
        timeout: 5000,
        retryConfig: {
          retries: 3,
          retryDelay: 100
        }
      });
      
      let attemptCount = 0;
      const result = await fluxHttpHelpers.page.evaluate(async () => {
        // Mock fetch to fail first 2 attempts, succeed on 3rd
        const originalFetch = window.fetch;
        let attempts = 0;
        
        window.fetch = async function(url, options) {
          attempts++;
          if (url.includes('/retry-test') && attempts <= 2) {
            throw new Error('Network error');
          }
          return originalFetch.call(this, url, options);
        };
        
        try {
          const response = await window.fluxHttpInstance.get('/retry-test');
          return { success: true, attempts };
        } catch (error) {
          return { success: false, error: error.message, attempts };
        } finally {
          window.fetch = originalFetch;
        }
      });
      
      expect(result.success).toBe(true);
      expect(result.attempts).toBe(3);
    });
  });
});