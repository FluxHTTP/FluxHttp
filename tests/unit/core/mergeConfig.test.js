const { describe, it } = require('node:test');
const assert = require('node:assert');

// Import the module we need to test - we'll test through the built library
const fluxhttpModule = require('../../../dist/index.js');
const fluxhttp = fluxhttpModule.default || fluxhttpModule;

/**
 * Comprehensive unit tests for configuration merging
 * Tests the mergeConfig function through the fluxhttp interface
 */
describe('Configuration Merging', () => {
  describe('Basic merging behavior', () => {
    it('should merge two configs correctly', () => {
      const config1 = {
        baseURL: 'https://api.test.com',
        timeout: 3000,
        headers: { 'X-First': 'first' }
      };

      const config2 = {
        timeout: 5000,
        headers: { 'X-Second': 'second' },
        withCredentials: true
      };

      const instance = fluxhttp.create(config1);
      const merged = instance.create(config2);

      assert.strictEqual(merged.defaults.baseURL, 'https://api.test.com');
      assert.strictEqual(merged.defaults.timeout, 5000); // Should be overridden
      assert.strictEqual(merged.defaults.withCredentials, true);
      
      // Headers should be merged
      assert.strictEqual(merged.defaults.headers['x-first'], 'first');
      assert.strictEqual(merged.defaults.headers['x-second'], 'second');
    });

    it('should handle null and undefined configs', () => {
      const instance1 = fluxhttp.create(null);
      const instance2 = fluxhttp.create(undefined);
      const instance3 = fluxhttp.create({});

      assert(instance1.defaults, 'Should handle null config');
      assert(instance2.defaults, 'Should handle undefined config');
      assert(instance3.defaults, 'Should handle empty config');
    });

    it('should handle empty configs', () => {
      const instance = fluxhttp.create({});
      const merged = instance.create({});

      assert(merged.defaults, 'Should handle empty configs');
      assert(typeof merged.defaults === 'object', 'Should have defaults object');
    });

    it('should preserve first config when second is null/undefined', () => {
      const config1 = {
        baseURL: 'https://api.test.com',
        timeout: 3000
      };

      const instance = fluxhttp.create(config1);
      const merged1 = instance.create(null);
      const merged2 = instance.create(undefined);

      assert.strictEqual(merged1.defaults.baseURL, 'https://api.test.com');
      assert.strictEqual(merged1.defaults.timeout, 3000);
      assert.strictEqual(merged2.defaults.baseURL, 'https://api.test.com');
      assert.strictEqual(merged2.defaults.timeout, 3000);
    });
  });

  describe('Header merging', () => {
    it('should merge headers correctly', () => {
      const config1 = {
        headers: {
          'Content-Type': 'application/json',
          'X-First': 'first',
          'Common-Header': 'from-first'
        }
      };

      const config2 = {
        headers: {
          'Authorization': 'Bearer token',
          'X-Second': 'second',
          'Common-Header': 'from-second'
        }
      };

      const instance = fluxhttp.create(config1);
      const merged = instance.create(config2);

      const headers = merged.defaults.headers;
      assert.strictEqual(headers['content-type'], 'application/json');
      assert.strictEqual(headers['x-first'], 'first');
      assert.strictEqual(headers['authorization'], 'Bearer token');
      assert.strictEqual(headers['x-second'], 'second');
      assert.strictEqual(headers['common-header'], 'from-second'); // Should override
    });

    it('should handle header case normalization', () => {
      const config1 = {
        headers: {
          'Content-Type': 'application/json',
          'X-Custom-Header': 'value1'
        }
      };

      const config2 = {
        headers: {
          'AUTHORIZATION': 'Bearer token',
          'x-custom-header': 'value2'
        }
      };

      const instance = fluxhttp.create(config1);
      const merged = instance.create(config2);

      const headers = merged.defaults.headers;
      assert.strictEqual(headers['content-type'], 'application/json');
      assert.strictEqual(headers['authorization'], 'Bearer token');
      assert.strictEqual(headers['x-custom-header'], 'value2'); // Should override
    });

    it('should handle null and undefined headers', () => {
      const config1 = { headers: { 'X-First': 'first' } };
      const config2 = { headers: null };
      const config3 = { headers: undefined };

      const instance = fluxhttp.create(config1);
      const merged1 = instance.create(config2);
      const merged2 = instance.create(config3);

      assert.strictEqual(merged1.defaults.headers['x-first'], 'first');
      assert.strictEqual(merged2.defaults.headers['x-first'], 'first');
    });

    it('should handle empty header objects', () => {
      const config1 = { headers: { 'X-First': 'first' } };
      const config2 = { headers: {} };

      const instance = fluxhttp.create(config1);
      const merged = instance.create(config2);

      assert.strictEqual(merged.defaults.headers['x-first'], 'first');
    });

    it('should handle non-object headers gracefully', () => {
      const config1 = { headers: { 'X-First': 'first' } };
      const config2 = { headers: 'not-an-object' };

      const instance = fluxhttp.create(config1);
      
      // Should not throw, should handle gracefully
      assert.doesNotThrow(() => {
        instance.create(config2);
      });
    });
  });

  describe('Replace strategy properties', () => {
    it('should replace adapter', () => {
      const adapter1 = { request: async () => ({}) };
      const adapter2 = { request: async () => ({}) };

      const config1 = { adapter: adapter1, timeout: 3000 };
      const config2 = { adapter: adapter2 };

      const instance = fluxhttp.create(config1);
      const merged = instance.create(config2);

      assert.strictEqual(merged.defaults.adapter, adapter2);
      assert.strictEqual(merged.defaults.timeout, 3000); // Should preserve
    });

    it('should replace URL', () => {
      const config1 = { url: '/first', baseURL: 'https://api.test.com' };
      const config2 = { url: '/second' };

      const instance = fluxhttp.create(config1);
      const merged = instance.create(config2);

      assert.strictEqual(merged.defaults.url, '/second');
      assert.strictEqual(merged.defaults.baseURL, 'https://api.test.com');
    });

    it('should replace method', () => {
      const config1 = { method: 'GET', timeout: 3000 };
      const config2 = { method: 'POST' };

      const instance = fluxhttp.create(config1);
      const merged = instance.create(config2);

      assert.strictEqual(merged.defaults.method, 'POST');
      assert.strictEqual(merged.defaults.timeout, 3000);
    });

    it('should replace data', () => {
      const data1 = { first: 'data' };
      const data2 = { second: 'data' };

      const config1 = { data: data1, timeout: 3000 };
      const config2 = { data: data2 };

      const instance = fluxhttp.create(config1);
      const merged = instance.create(config2);

      assert.deepStrictEqual(merged.defaults.data, data2);
      assert.strictEqual(merged.defaults.timeout, 3000);
    });

    it('should replace timeout', () => {
      const config1 = { timeout: 3000, baseURL: 'https://api.test.com' };
      const config2 = { timeout: 5000 };

      const instance = fluxhttp.create(config1);
      const merged = instance.create(config2);

      assert.strictEqual(merged.defaults.timeout, 5000);
      assert.strictEqual(merged.defaults.baseURL, 'https://api.test.com');
    });

    it('should replace boolean properties', () => {
      const config1 = { withCredentials: false, decompress: true };
      const config2 = { withCredentials: true };

      const instance = fluxhttp.create(config1);
      const merged = instance.create(config2);

      assert.strictEqual(merged.defaults.withCredentials, true);
      assert.strictEqual(merged.defaults.decompress, true);
    });

    it('should replace function properties', () => {
      const validateStatus1 = (status) => status === 200;
      const validateStatus2 = (status) => status < 300;

      const config1 = { validateStatus: validateStatus1, timeout: 3000 };
      const config2 = { validateStatus: validateStatus2 };

      const instance = fluxhttp.create(config1);
      const merged = instance.create(config2);

      assert.strictEqual(merged.defaults.validateStatus, validateStatus2);
      assert.strictEqual(merged.defaults.timeout, 3000);
    });
  });

  describe('Merge strategy properties', () => {
    it('should merge retry config', () => {
      const config1 = {
        retry: {
          retries: 3,
          retryDelay: 1000,
          retryCondition: () => true
        }
      };

      const config2 = {
        retry: {
          retries: 5,
          exponentialBackoff: true
        }
      };

      const instance = fluxhttp.create(config1);
      const merged = instance.create(config2);

      const retryConfig = merged.defaults.retry;
      assert(retryConfig, 'Should have retry config');
      if (retryConfig && typeof retryConfig === 'object') {
        assert.strictEqual(retryConfig.retries, 5); // Should override
        assert.strictEqual(retryConfig.retryDelay, 1000); // Should preserve
        assert.strictEqual(retryConfig.exponentialBackoff, true); // Should add
        assert(retryConfig.retryCondition, 'Should preserve function');
      }
    });

    it('should merge cache config', () => {
      const config1 = {
        cache: {
          enabled: true,
          ttl: 5000,
          maxSize: 100
        }
      };

      const config2 = {
        cache: {
          ttl: 10000,
          strategy: 'memory'
        }
      };

      const instance = fluxhttp.create(config1);
      const merged = instance.create(config2);

      const cacheConfig = merged.defaults.cache;
      assert(cacheConfig, 'Should have cache config');
      if (cacheConfig && typeof cacheConfig === 'object') {
        assert.strictEqual(cacheConfig.enabled, true); // Should preserve
        assert.strictEqual(cacheConfig.ttl, 10000); // Should override
        assert.strictEqual(cacheConfig.maxSize, 100); // Should preserve
        assert.strictEqual(cacheConfig.strategy, 'memory'); // Should add
      }
    });

    it('should merge security config', () => {
      const config1 = {
        security: {
          enabled: true,
          validateCertificate: true,
          timeout: 5000
        }
      };

      const config2 = {
        security: {
          timeout: 10000,
          csrf: { enabled: true }
        }
      };

      const instance = fluxhttp.create(config1);
      const merged = instance.create(config2);

      const securityConfig = merged.defaults.security;
      assert(securityConfig, 'Should have security config');
      if (securityConfig && typeof securityConfig === 'object') {
        assert.strictEqual(securityConfig.enabled, true); // Should preserve
        assert.strictEqual(securityConfig.validateCertificate, true); // Should preserve
        assert.strictEqual(securityConfig.timeout, 10000); // Should override
        assert(securityConfig.csrf, 'Should add csrf config');
      }
    });

    it('should merge deduplication config', () => {
      const config1 = {
        deduplication: {
          enabled: true,
          ttl: 5000,
          strategy: 'url-method'
        }
      };

      const config2 = {
        deduplication: {
          ttl: 10000,
          maxSize: 100
        }
      };

      const instance = fluxhttp.create(config1);
      const merged = instance.create(config2);

      const deduplicationConfig = merged.defaults.deduplication;
      assert(deduplicationConfig, 'Should have deduplication config');
      if (deduplicationConfig && typeof deduplicationConfig === 'object') {
        assert.strictEqual(deduplicationConfig.enabled, true); // Should preserve
        assert.strictEqual(deduplicationConfig.ttl, 10000); // Should override
        assert.strictEqual(deduplicationConfig.strategy, 'url-method'); // Should preserve
        assert.strictEqual(deduplicationConfig.maxSize, 100); // Should add
      }
    });

    it('should handle non-object merge properties gracefully', () => {
      const config1 = { retry: { retries: 3 } };
      const config2 = { retry: 'not-an-object' };

      const instance = fluxhttp.create(config1);
      
      // Should not throw
      assert.doesNotThrow(() => {
        instance.create(config2);
      });
    });
  });

  describe('Security and prototype pollution protection', () => {
    it('should reject dangerous property names', () => {
      const dangerousConfig = {
        __proto__: { malicious: true },
        constructor: 'dangerous',
        prototype: 'bad'
      };

      // Should not throw during creation but should ignore dangerous properties
      assert.doesNotThrow(() => {
        fluxhttp.create(dangerousConfig);
      });
    });

    it('should safely handle prototype pollution attempts', () => {
      const maliciousConfig = {
        baseURL: 'https://api.test.com',
        timeout: 3000
      };

      // Attempt to add malicious properties
      maliciousConfig['__proto__'] = { isAdmin: true };
      maliciousConfig['constructor'] = { dangerous: true };

      const instance = fluxhttp.create(maliciousConfig);
      
      // Check that dangerous properties are not merged
      assert(!instance.defaults.isAdmin, 'Should not inherit malicious properties');
      assert.strictEqual(instance.defaults.baseURL, 'https://api.test.com');
      assert.strictEqual(instance.defaults.timeout, 3000);
    });

    it('should validate config keys', () => {
      const configWithInvalidKeys = {
        baseURL: 'https://api.test.com',
        timeout: 3000,
        invalidKey: 'should be ignored',
        anotherInvalidKey: { nested: 'object' }
      };

      const instance = fluxhttp.create(configWithInvalidKeys);
      
      // Valid keys should be preserved
      assert.strictEqual(instance.defaults.baseURL, 'https://api.test.com');
      assert.strictEqual(instance.defaults.timeout, 3000);
      
      // Invalid keys should be ignored (not throw errors)
      assert(!instance.defaults.invalidKey, 'Should ignore invalid keys');
      assert(!instance.defaults.anotherInvalidKey, 'Should ignore invalid keys');
    });

    it('should handle circular references safely', () => {
      const config = {
        baseURL: 'https://api.test.com',
        timeout: 3000,
        data: { message: 'test' }
      };

      // Create circular reference
      config.data.circular = config.data;

      // Should not throw and should handle gracefully
      assert.doesNotThrow(() => {
        fluxhttp.create(config);
      });
    });
  });

  describe('Deep property merging', () => {
    it('should handle nested objects in merge properties', () => {
      const config1 = {
        security: {
          csrf: {
            enabled: true,
            token: 'old-token'
          },
          rateLimit: {
            enabled: false,
            maxRequests: 100
          }
        }
      };

      const config2 = {
        security: {
          csrf: {
            token: 'new-token',
            headerName: 'X-CSRF-Token'
          },
          headers: {
            'X-Security': 'enabled'
          }
        }
      };

      const instance = fluxhttp.create(config1);
      const merged = instance.create(config2);

      const securityConfig = merged.defaults.security;
      assert(securityConfig, 'Should have security config');
      if (securityConfig && typeof securityConfig === 'object') {
        // Should merge security config
        assert(securityConfig.csrf, 'Should have csrf config');
        assert(securityConfig.headers, 'Should have headers config');
        assert(securityConfig.rateLimit, 'Should preserve rateLimit config');
      }
    });

    it('should preserve functions in merged objects', () => {
      const customFunction = () => 'custom';
      
      const config1 = {
        retry: {
          retries: 3,
          retryCondition: customFunction
        }
      };

      const config2 = {
        retry: {
          retries: 5,
          retryDelay: 1000
        }
      };

      const instance = fluxhttp.create(config1);
      const merged = instance.create(config2);

      const retryConfig = merged.defaults.retry;
      assert(retryConfig, 'Should have retry config');
      if (retryConfig && typeof retryConfig === 'object') {
        assert.strictEqual(retryConfig.retries, 5);
        assert.strictEqual(retryConfig.retryDelay, 1000);
        assert.strictEqual(retryConfig.retryCondition, customFunction);
        assert.strictEqual(typeof retryConfig.retryCondition, 'function');
      }
    });
  });

  describe('Edge cases and error handling', () => {
    it('should handle very large config objects', () => {
      const largeConfig = {
        baseURL: 'https://api.test.com',
        headers: {}
      };

      // Add many headers
      for (let i = 0; i < 1000; i++) {
        largeConfig.headers[`X-Header-${i}`] = `value-${i}`;
      }

      // Should not throw and should handle large objects
      assert.doesNotThrow(() => {
        fluxhttp.create(largeConfig);
      });
    });

    it('should handle undefined values in config', () => {
      const config1 = {
        baseURL: 'https://api.test.com',
        timeout: 3000,
        headers: { 'X-First': 'first' }
      };

      const config2 = {
        baseURL: undefined,
        timeout: 5000,
        headers: undefined,
        data: undefined
      };

      const instance = fluxhttp.create(config1);
      const merged = instance.create(config2);

      // Undefined values should not override existing values
      assert.strictEqual(merged.defaults.baseURL, 'https://api.test.com');
      assert.strictEqual(merged.defaults.timeout, 5000); // Should override
      assert.strictEqual(merged.defaults.headers['x-first'], 'first'); // Should preserve
    });

    it('should handle config with mixed data types', () => {
      const config = {
        baseURL: 'https://api.test.com',
        timeout: 3000,
        withCredentials: true,
        data: { key: 'value' },
        headers: { 'Content-Type': 'application/json' },
        validateStatus: (status) => status < 300,
        transformRequest: [(data) => JSON.stringify(data)]
      };

      // Should handle all data types correctly
      assert.doesNotThrow(() => {
        const instance = fluxhttp.create(config);
        assert.strictEqual(instance.defaults.baseURL, 'https://api.test.com');
        assert.strictEqual(instance.defaults.timeout, 3000);
        assert.strictEqual(instance.defaults.withCredentials, true);
        assert.deepStrictEqual(instance.defaults.data, { key: 'value' });
        assert.strictEqual(instance.defaults.headers['content-type'], 'application/json');
        assert.strictEqual(typeof instance.defaults.validateStatus, 'function');
        assert(Array.isArray(instance.defaults.transformRequest));
      });
    });

    it('should maintain independence between merged configs', () => {
      const sharedHeaders = { 'X-Shared': 'shared' };
      const config1 = { headers: sharedHeaders };
      const config2 = { headers: { 'X-New': 'new' } };

      const instance = fluxhttp.create(config1);
      const merged = instance.create(config2);

      // Modify original shared object
      sharedHeaders['X-Modified'] = 'modified';

      // Merged config should not be affected
      assert(!merged.defaults.headers['x-modified'], 'Should not be affected by original modifications');
      assert.strictEqual(merged.defaults.headers['x-shared'], 'shared');
      assert.strictEqual(merged.defaults.headers['x-new'], 'new');
    });
  });

  describe('Integration with real fluxhttp usage', () => {
    it('should work correctly with request-level config merging', async () => {
      const { MockAdapter } = require('../../helpers/mock-adapter');
      const mockAdapter = new MockAdapter();

      const instance = fluxhttp.create({
        adapter: mockAdapter,
        baseURL: 'https://api.test.com',
        headers: { 'X-Global': 'global' },
        timeout: 3000
      });

      mockAdapter.setMockResponse({
        data: { success: true },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {},
        request: {}
      });

      await instance.get('/test', {
        headers: { 'X-Request': 'request' },
        timeout: 5000
      });

      const lastRequest = mockAdapter.getLastRequest();
      assert.strictEqual(lastRequest.url, 'https://api.test.com/test');
      assert.strictEqual(lastRequest.timeout, 5000); // Request-level should override
      assert.strictEqual(lastRequest.headers['x-global'], 'global'); // Should preserve
      assert.strictEqual(lastRequest.headers['x-request'], 'request'); // Should add
    });

    it('should maintain config hierarchy through multiple instance creations', () => {
      const globalConfig = {
        baseURL: 'https://api.test.com',
        timeout: 3000,
        headers: { 'X-Global': 'global' }
      };

      const serviceConfig = {
        timeout: 5000,
        headers: { 'X-Service': 'service' }
      };

      const requestConfig = {
        headers: { 'X-Request': 'request' },
        withCredentials: true
      };

      const global = fluxhttp.create(globalConfig);
      const service = global.create(serviceConfig);
      const request = service.create(requestConfig);

      // Should maintain hierarchy
      assert.strictEqual(request.defaults.baseURL, 'https://api.test.com');
      assert.strictEqual(request.defaults.timeout, 5000);
      assert.strictEqual(request.defaults.withCredentials, true);
      assert.strictEqual(request.defaults.headers['x-global'], 'global');
      assert.strictEqual(request.defaults.headers['x-service'], 'service');
      assert.strictEqual(request.defaults.headers['x-request'], 'request');
    });
  });
});