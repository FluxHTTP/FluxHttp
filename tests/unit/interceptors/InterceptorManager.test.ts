import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { InterceptorManager } from '../../../src/interceptors/InterceptorManager.js';
import type { InterceptorOptions } from '../../../src/types/index.js';

// Mock types for testing
interface TestRequestConfig {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  data?: unknown;
}

interface TestResponse {
  data: unknown;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  config: TestRequestConfig;
}

describe('InterceptorManager', () => {
  describe('Request Interceptor Manager', () => {
    let manager: InterceptorManager<TestRequestConfig>;

    beforeEach(() => {
      manager = new InterceptorManager<TestRequestConfig>();
    });

    afterEach(() => {
      manager.dispose();
    });

    describe('Basic Functionality', () => {
      it('should create empty interceptor manager', () => {
        assert(manager instanceof InterceptorManager);
        assert.strictEqual(manager.size, 0);
      });

      it('should register request interceptor', () => {
        const interceptorId = manager.use(
          (config) => {
            config.headers = { ...config.headers, 'X-Intercepted': 'true' };
            return config;
          }
        );

        assert(typeof interceptorId === 'number');
        assert.strictEqual(manager.size, 1);
      });

      it('should register interceptor with error handler', () => {
        const interceptorId = manager.use(
          (config) => config,
          (error) => {
            console.error('Interceptor error:', error);
            return Promise.reject(error);
          }
        );

        assert(typeof interceptorId === 'number');
        assert.strictEqual(manager.size, 1);
      });

      it('should register interceptor with options', () => {
        const options: InterceptorOptions = {
          runOnce: true,
          synchronous: false,
        };

        const interceptorId = manager.use(
          (config) => config,
          undefined,
          options
        );

        assert(typeof interceptorId === 'number');
        assert.strictEqual(manager.size, 1);
      });

      it('should remove interceptor', () => {
        const interceptorId = manager.use((config) => config);
        assert.strictEqual(manager.size, 1);

        manager.eject(interceptorId);
        assert.strictEqual(manager.size, 0);
      });

      it('should handle removing non-existent interceptor', () => {
        assert.doesNotThrow(() => {
          manager.eject(999); // Non-existent ID
        });
        
        assert.strictEqual(manager.size, 0);
      });

      it('should clear all interceptors', () => {
        manager.use((config) => config);
        manager.use((config) => config);
        manager.use((config) => config);
        
        assert.strictEqual(manager.size, 3);
        
        manager.clear();
        assert.strictEqual(manager.size, 0);
      });
    });

    describe('Interceptor Execution', () => {
      it('should execute single interceptor', async () => {
        let executed = false;
        
        manager.use((config) => {
          executed = true;
          config.headers = { ...config.headers, 'X-Test': 'executed' };
          return config;
        });

        const config: TestRequestConfig = {
          url: '/api/test',
          headers: {},
        };

        const results = [];
        for (const interceptor of manager) {
          if (interceptor.fulfilled) {
            const result = await interceptor.fulfilled(config);
            results.push(result);
          }
        }

        assert(executed);
        assert.strictEqual(results[0].headers['X-Test'], 'executed');
      });

      it('should execute multiple interceptors in order', async () => {
        const order: number[] = [];
        
        manager.use((config) => {
          order.push(1);
          config.headers = { ...config.headers, 'X-First': 'true' };
          return config;
        });
        
        manager.use((config) => {
          order.push(2);
          config.headers = { ...config.headers, 'X-Second': 'true' };
          return config;
        });
        
        manager.use((config) => {
          order.push(3);
          config.headers = { ...config.headers, 'X-Third': 'true' };
          return config;
        });

        const config: TestRequestConfig = {
          url: '/api/test',
          headers: {},
        };

        let currentConfig = config;
        for (const interceptor of manager) {
          if (interceptor.fulfilled) {
            currentConfig = await interceptor.fulfilled(currentConfig);
          }
        }

        assert.deepStrictEqual(order, [1, 2, 3]);
        assert.strictEqual(currentConfig.headers['X-First'], 'true');
        assert.strictEqual(currentConfig.headers['X-Second'], 'true');
        assert.strictEqual(currentConfig.headers['X-Third'], 'true');
      });

      it('should handle async interceptors', async () => {
        manager.use(async (config) => {
          await new Promise(resolve => setTimeout(resolve, 10));
          config.headers = { ...config.headers, 'X-Async': 'true' };
          return config;
        });

        const config: TestRequestConfig = {
          url: '/api/test',
          headers: {},
        };

        for (const interceptor of manager) {
          if (interceptor.fulfilled) {
            const result = await interceptor.fulfilled(config);
            assert.strictEqual(result.headers['X-Async'], 'true');
          }
        }
      });

      it('should handle interceptor that modifies config reference', async () => {
        manager.use((config) => {
          // Return a completely new config object
          return {
            url: config.url + '?intercepted=true',
            method: 'POST',
            headers: { 'X-New-Config': 'true' },
          };
        });

        const config: TestRequestConfig = {
          url: '/api/test',
          method: 'GET',
          headers: {},
        };

        for (const interceptor of manager) {
          if (interceptor.fulfilled) {
            const result = await interceptor.fulfilled(config);
            assert.strictEqual(result.url, '/api/test?intercepted=true');
            assert.strictEqual(result.method, 'POST');
            assert.strictEqual(result.headers['X-New-Config'], 'true');
          }
        }
      });
    });

    describe('Error Handling', () => {
      it('should handle interceptor throwing synchronous error', async () => {
        const errorMessage = 'Interceptor sync error';
        
        manager.use(
          () => {
            throw new Error(errorMessage);
          },
          (error) => {
            assert(error instanceof Error);
            assert.strictEqual(error.message, errorMessage);
            return Promise.reject(error);
          }
        );

        const config: TestRequestConfig = {
          url: '/api/test',
        };

        for (const interceptor of manager) {
          if (interceptor.fulfilled) {
            try {
              await interceptor.fulfilled(config);
              assert.fail('Should have thrown error');
            } catch (error) {
              if (interceptor.rejected) {
                try {
                  await interceptor.rejected(error);
                  assert.fail('Error handler should have rejected');
                } catch (rejectedError) {
                  assert(rejectedError instanceof Error);
                  assert.strictEqual((rejectedError as Error).message, errorMessage);
                }
              }
            }
          }
        }
      });

      it('should handle interceptor rejecting with Promise', async () => {
        const errorMessage = 'Interceptor async error';
        
        manager.use(
          async () => {
            await new Promise(resolve => setTimeout(resolve, 10));
            throw new Error(errorMessage);
          },
          (error) => {
            assert(error instanceof Error);
            return Promise.reject(error);
          }
        );

        const config: TestRequestConfig = {
          url: '/api/test',
        };

        for (const interceptor of manager) {
          if (interceptor.fulfilled) {
            try {
              await interceptor.fulfilled(config);
              assert.fail('Should have thrown error');
            } catch (error) {
              if (interceptor.rejected) {
                try {
                  await interceptor.rejected(error);
                  assert.fail('Error handler should have rejected');
                } catch (rejectedError) {
                  assert(rejectedError instanceof Error);
                  assert.strictEqual((rejectedError as Error).message, errorMessage);
                }
              }
            }
          }
        }
      });

      it('should handle error handler recovering from error', async () => {
        manager.use(
          () => {
            throw new Error('Original error');
          },
          () => {
            // Recover by returning a default config
            return {
              url: '/api/fallback',
              method: 'GET',
              headers: { 'X-Recovered': 'true' },
            };
          }
        );

        const config: TestRequestConfig = {
          url: '/api/test',
        };

        for (const interceptor of manager) {
          if (interceptor.fulfilled) {
            try {
              await interceptor.fulfilled(config);
              assert.fail('Should have thrown error');
            } catch (error) {
              if (interceptor.rejected) {
                const recovered = await interceptor.rejected(error) as TestRequestConfig;
                assert.strictEqual(recovered.url, '/api/fallback');
                assert.strictEqual(recovered.headers['X-Recovered'], 'true');
              }
            }
          }
        }
      });

      it('should handle missing error handler', async () => {
        manager.use((config) => {
          throw new Error('No error handler');
        });

        const config: TestRequestConfig = {
          url: '/api/test',
        };

        for (const interceptor of manager) {
          if (interceptor.fulfilled) {
            try {
              await interceptor.fulfilled(config);
              assert.fail('Should have thrown error');
            } catch (error) {
              assert(error instanceof Error);
              assert.strictEqual((error as Error).message, 'No error handler');
              // No rejected handler, so error should propagate
              assert.strictEqual(interceptor.rejected, undefined);
            }
          }
        }
      });
    });

    describe('Run Once Interceptors', () => {
      it('should execute run-once interceptor only once', async () => {
        let executeCount = 0;
        
        manager.use(
          (config) => {
            executeCount++;
            config.headers = { ...config.headers, 'X-Count': executeCount.toString() };
            return config;
          },
          undefined,
          { runOnce: true }
        );

        const config: TestRequestConfig = {
          url: '/api/test',
          headers: {},
        };

        // First execution
        for (const interceptor of manager) {
          if (interceptor.fulfilled) {
            await interceptor.fulfilled(config);
          }
        }

        // Second execution
        for (const interceptor of manager) {
          if (interceptor.fulfilled) {
            await interceptor.fulfilled(config);
          }
        }

        assert.strictEqual(executeCount, 1);
      });

      it('should remove run-once interceptor after execution', async () => {
        const interceptorId = manager.use(
          (config) => config,
          undefined,
          { runOnce: true }
        );

        assert.strictEqual(manager.size, 1);

        const config: TestRequestConfig = {
          url: '/api/test',
        };

        // Execute interceptor
        for (const interceptor of manager) {
          if (interceptor.fulfilled) {
            await interceptor.fulfilled(config);
          }
        }

        // Trigger cleanup to remove used run-once interceptors
        (manager as any).performCleanup();
        
        assert.strictEqual(manager.size, 0);
      });
    });

    describe('Iterator Protocol', () => {
      it('should implement iterator protocol', () => {
        manager.use((config) => config);
        manager.use((config) => config);
        manager.use((config) => config);

        const interceptors = Array.from(manager);
        assert.strictEqual(interceptors.length, 3);
        
        interceptors.forEach(interceptor => {
          assert(typeof interceptor.fulfilled === 'function');
        });
      });

      it('should iterate in insertion order', () => {
        const order: number[] = [];
        
        manager.use((config) => {
          order.push(1);
          return config;
        });
        
        manager.use((config) => {
          order.push(2);
          return config;
        });
        
        manager.use((config) => {
          order.push(3);
          return config;
        });

        const config: TestRequestConfig = {
          url: '/api/test',
        };

        for (const interceptor of manager) {
          if (interceptor.fulfilled) {
            interceptor.fulfilled(config);
          }
        }

        assert.deepStrictEqual(order, [1, 2, 3]);
      });

      it('should handle empty iterator', () => {
        const interceptors = Array.from(manager);
        assert.strictEqual(interceptors.length, 0);
      });

      it('should handle iterator after clear', () => {
        manager.use((config) => config);
        manager.use((config) => config);
        
        assert.strictEqual(manager.size, 2);
        
        manager.clear();
        
        const interceptors = Array.from(manager);
        assert.strictEqual(interceptors.length, 0);
      });
    });

    describe('Memory Management', () => {
      it('should track usage statistics', () => {
        const interceptorId1 = manager.use((config) => config);
        const interceptorId2 = manager.use((config) => config);
        
        const stats = manager.getStats();
        
        assert.strictEqual(stats.size, 2);
        assert(stats.totalUsage >= 0);
        assert(Array.isArray(stats.interceptorIds));
        assert.strictEqual(stats.interceptorIds.length, 2);
        assert(stats.interceptorIds.includes(interceptorId1));
        assert(stats.interceptorIds.includes(interceptorId2));
      });

      it('should cleanup old interceptors', async () => {
        // Create manager with aggressive cleanup
        const cleanupManager = new InterceptorManager<TestRequestConfig>({
          maxAge: 50, // 50ms
          cleanupInterval: 25, // 25ms
          maxInterceptors: 10,
        });

        cleanupManager.use((config) => config);
        assert.strictEqual(cleanupManager.size, 1);

        // Wait for cleanup
        await new Promise(resolve => setTimeout(resolve, 100));

        // Should be cleaned up
        assert.strictEqual(cleanupManager.size, 0);

        cleanupManager.dispose();
      });

      it('should respect max interceptors limit', () => {
        // Create manager with low limit
        const limitedManager = new InterceptorManager<TestRequestConfig>({
          maxInterceptors: 3,
          enableLRU: true,
        });

        // Add interceptors up to limit
        limitedManager.use((config) => config);
        limitedManager.use((config) => config);
        limitedManager.use((config) => config);
        assert.strictEqual(limitedManager.size, 3);

        // Add one more - should trigger LRU eviction
        limitedManager.use((config) => config);
        
        // Trigger cleanup manually
        (limitedManager as any).performCleanup();
        
        assert(limitedManager.size <= 3);

        limitedManager.dispose();
      });

      it('should dispose resources properly', () => {
        manager.use((config) => config);
        manager.use((config) => config);
        
        assert.strictEqual(manager.size, 2);
        assert.strictEqual(manager.isDisposed(), false);
        
        manager.dispose();
        
        assert.strictEqual(manager.size, 0);
        assert.strictEqual(manager.isDisposed(), true);
        
        // Multiple dispose calls should be safe
        manager.dispose();
        assert.strictEqual(manager.isDisposed(), true);
      });

      it('should not accept new interceptors after disposal', () => {
        manager.dispose();
        
        assert.throws(() => {
          manager.use((config) => config);
        }, { message: 'InterceptorManager has been disposed' });
      });
    });

    describe('Edge Cases', () => {
      it('should handle interceptor returning null/undefined', async () => {
        manager.use(() => null as any);
        
        const config: TestRequestConfig = {
          url: '/api/test',
        };

        for (const interceptor of manager) {
          if (interceptor.fulfilled) {
            const result = await interceptor.fulfilled(config);
            assert.strictEqual(result, null);
          }
        }
      });

      it('should handle interceptor with undefined fulfilled handler', () => {
        const interceptorId = manager.use(undefined as any);
        assert(typeof interceptorId === 'number');
        assert.strictEqual(manager.size, 1);
        
        const interceptors = Array.from(manager);
        assert.strictEqual(interceptors[0].fulfilled, undefined);
      });

      it('should handle very large number of interceptors', () => {
        const count = 1000;
        const interceptorIds: number[] = [];
        
        for (let i = 0; i < count; i++) {
          const id = manager.use((config) => {
            config.headers = { ...config.headers, [`X-Test-${i}`]: 'true' };
            return config;
          });
          interceptorIds.push(id);
        }
        
        assert.strictEqual(manager.size, count);
        assert.strictEqual(interceptorIds.length, count);
        
        // Remove half of them
        for (let i = 0; i < count / 2; i++) {
          manager.eject(interceptorIds[i]);
        }
        
        assert.strictEqual(manager.size, count / 2);
      });

      it('should handle concurrent modifications', () => {
        const interceptorIds: number[] = [];
        
        // Add interceptors
        for (let i = 0; i < 10; i++) {
          interceptorIds.push(manager.use((config) => config));
        }
        
        // Iterate while modifying
        const results = [];
        for (const interceptor of manager) {
          results.push(interceptor);
          
          // Remove some interceptors during iteration
          if (interceptorIds.length > 0) {
            manager.eject(interceptorIds.pop()!);
          }
        }
        
        // Should handle gracefully
        assert(results.length > 0);
      });

      it('should handle circular reference in interceptor options', () => {
        const options: any = { runOnce: false };
        options.circular = options;
        
        assert.doesNotThrow(() => {
          manager.use((config) => config, undefined, options);
        });
        
        assert.strictEqual(manager.size, 1);
      });
    });
  });

  describe('Response Interceptor Manager', () => {
    let manager: InterceptorManager<TestResponse>;

    beforeEach(() => {
      manager = new InterceptorManager<TestResponse>();
    });

    afterEach(() => {
      manager.dispose();
    });

    describe('Response Specific Tests', () => {
      it('should transform response data', async () => {
        manager.use((response) => {
          return {
            ...response,
            data: {
              ...response.data as any,
              transformed: true,
            },
          };
        });

        const response: TestResponse = {
          data: { original: 'data' },
          status: 200,
          statusText: 'OK',
          headers: {},
          config: { url: '/api/test' },
        };

        for (const interceptor of manager) {
          if (interceptor.fulfilled) {
            const result = await interceptor.fulfilled(response);
            assert.deepStrictEqual(result.data, {
              original: 'data',
              transformed: true,
            });
          }
        }
      });

      it('should handle response status transformations', async () => {
        manager.use((response) => {
          if (response.status === 200) {
            return {
              ...response,
              status: 201,
              statusText: 'Created',
              headers: {
                ...response.headers,
                'X-Status-Modified': 'true',
              },
            };
          }
          return response;
        });

        const response: TestResponse = {
          data: { id: 1 },
          status: 200,
          statusText: 'OK',
          headers: {},
          config: { url: '/api/test' },
        };

        for (const interceptor of manager) {
          if (interceptor.fulfilled) {
            const result = await interceptor.fulfilled(response);
            assert.strictEqual(result.status, 201);
            assert.strictEqual(result.statusText, 'Created');
            assert.strictEqual(result.headers['X-Status-Modified'], 'true');
          }
        }
      });

      it('should chain multiple response transformations', async () => {
        // First interceptor: add timestamp
        manager.use((response) => {
          return {
            ...response,
            data: {
              ...response.data as any,
              timestamp: new Date().toISOString(),
            },
          };
        });

        // Second interceptor: add metadata
        manager.use((response) => {
          return {
            ...response,
            data: {
              ...response.data as any,
              metadata: {
                processed: true,
                version: '1.0.0',
              },
            },
          };
        });

        // Third interceptor: normalize structure
        manager.use((response) => {
          return {
            ...response,
            data: {
              result: response.data,
              success: response.status < 400,
            },
          };
        });

        const response: TestResponse = {
          data: { id: 1, name: 'Test' },
          status: 200,
          statusText: 'OK',
          headers: {},
          config: { url: '/api/test' },
        };

        let currentResponse = response;
        for (const interceptor of manager) {
          if (interceptor.fulfilled) {
            currentResponse = await interceptor.fulfilled(currentResponse);
          }
        }

        const finalData = currentResponse.data as any;
        assert.strictEqual(finalData.success, true);
        assert(finalData.result.timestamp);
        assert.deepStrictEqual(finalData.result.metadata, {
          processed: true,
          version: '1.0.0',
        });
        assert.strictEqual(finalData.result.id, 1);
        assert.strictEqual(finalData.result.name, 'Test');
      });

      it('should handle response error interceptors', async () => {
        manager.use(
          (response) => {
            if (response.status >= 400) {
              throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            return response;
          },
          (error) => {
            // Transform error into a standardized error response
            return {
              data: {
                error: true,
                message: (error as Error).message,
                code: 'HTTP_ERROR',
              },
              status: 0,
              statusText: 'Error',
              headers: {},
              config: { url: '/api/error' },
            };
          }
        );

        const errorResponse: TestResponse = {
          data: { error: 'Not found' },
          status: 404,
          statusText: 'Not Found',
          headers: {},
          config: { url: '/api/test' },
        };

        for (const interceptor of manager) {
          if (interceptor.fulfilled) {
            try {
              await interceptor.fulfilled(errorResponse);
              assert.fail('Should have thrown error');
            } catch (error) {
              if (interceptor.rejected) {
                const result = await interceptor.rejected(error) as TestResponse;
                assert.deepStrictEqual(result.data, {
                  error: true,
                  message: 'HTTP 404: Not Found',
                  code: 'HTTP_ERROR',
                });
              }
            }
          }
        }
      });
    });
  });

  describe('Performance Tests', () => {
    it('should handle many interceptors efficiently', async () => {
      const manager = new InterceptorManager<TestRequestConfig>();
      
      // Add many interceptors
      for (let i = 0; i < 1000; i++) {
        manager.use((config) => {
          config.headers = { ...config.headers, [`X-Test-${i}`]: 'true' };
          return config;
        });
      }
      
      const config: TestRequestConfig = {
        url: '/api/test',
        headers: {},
      };
      
      const start = process.hrtime();
      
      let currentConfig = config;
      for (const interceptor of manager) {
        if (interceptor.fulfilled) {
          currentConfig = await interceptor.fulfilled(currentConfig);
        }
      }
      
      const [seconds, nanoseconds] = process.hrtime(start);
      const milliseconds = seconds * 1000 + nanoseconds / 1000000;
      
      assert(milliseconds < 100, 'Should execute many interceptors quickly');
      assert(Object.keys(currentConfig.headers).length === 1000);
      
      manager.dispose();
    });

    it('should not leak memory with many operations', () => {
      const manager = new InterceptorManager<TestRequestConfig>();
      const initialMemory = process.memoryUsage().heapUsed;
      
      // Add and remove many interceptors
      for (let i = 0; i < 10000; i++) {
        const id = manager.use((config) => config);
        if (i % 2 === 0) {
          manager.eject(id);
        }
      }
      
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;
      
      // Memory increase should be reasonable
      assert(memoryIncrease < 50 * 1024 * 1024, 'Memory usage should not grow excessively');
      
      manager.dispose();
    });
  });
});
