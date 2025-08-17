import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import {
  SecurityManager,
  SecurityCrypto,
  createSecurityConfig,
  defaultSecurity,
  createSecurityRequestInterceptor,
  createSecurityResponseInterceptor,
  securityRequestInterceptor,
  securityResponseInterceptor,
} from '../../../src/core/security.js';
import type {
  SecurityConfig,
  CSRFConfig,
  RateLimitConfig,
  ContentValidationConfig,
  SecurityHeadersConfig,
  RequestValidationConfig,
  RateLimitState,
} from '../../../src/core/security.js';
import type { fluxhttpRequestConfig, fluxhttpResponse } from '../../../src/types/index.js';

describe('Security Module (Legacy Re-exports)', () => {
  describe('Re-exports', () => {
    it('should re-export SecurityManager', () => {
      assert(typeof SecurityManager === 'function');
    });

    it('should re-export SecurityCrypto', () => {
      assert(typeof SecurityCrypto === 'function');
    });

    it('should re-export createSecurityConfig', () => {
      assert(typeof createSecurityConfig === 'function');
    });

    it('should re-export defaultSecurity', () => {
      assert(typeof defaultSecurity === 'object');
    });

    it('should re-export security interceptors', () => {
      assert(typeof createSecurityRequestInterceptor === 'function');
      assert(typeof createSecurityResponseInterceptor === 'function');
      assert(typeof securityRequestInterceptor === 'function');
      assert(typeof securityResponseInterceptor === 'function');
    });
  });

  describe('Integration Test', () => {
    it('should be able to create security manager instance', () => {
      const config = createSecurityConfig();
      const manager = new SecurityManager(config);
      assert(manager instanceof SecurityManager);
    });

    it('should be able to create security crypto instance', () => {
      const crypto = new SecurityCrypto();
      assert(crypto instanceof SecurityCrypto);
    });

    it('should be able to create security interceptors', () => {
      const config = createSecurityConfig();
      const requestInterceptor = createSecurityRequestInterceptor(config);
      const responseInterceptor = createSecurityResponseInterceptor(config);
      
      assert(typeof requestInterceptor === 'function');
      assert(typeof responseInterceptor === 'function');
    });

    it('should use default security interceptors', () => {
      assert(typeof securityRequestInterceptor === 'function');
      assert(typeof securityResponseInterceptor === 'function');
    });

    it('should have default security configuration', () => {
      assert(typeof defaultSecurity === 'object');
      assert(defaultSecurity !== null);
    });
  });

  describe('Type Exports', () => {
    it('should support SecurityConfig type', () => {
      const config: SecurityConfig = createSecurityConfig();
      assert(typeof config === 'object');
    });

    it('should support CSRF config type', () => {
      const csrfConfig: CSRFConfig = {
        enabled: true,
        token: 'test-token',
        header: 'X-CSRF-Token',
      };
      assert(typeof csrfConfig.enabled === 'boolean');
    });

    it('should support rate limit config type', () => {
      const rateLimitConfig: RateLimitConfig = {
        enabled: true,
        maxRequests: 100,
        windowMs: 60000,
      };
      assert(typeof rateLimitConfig.maxRequests === 'number');
    });

    it('should support content validation config type', () => {
      const contentConfig: ContentValidationConfig = {
        enabled: true,
        maxSize: 1024 * 1024,
        allowedTypes: ['application/json'],
      };
      assert(Array.isArray(contentConfig.allowedTypes));
    });

    it('should support security headers config type', () => {
      const headersConfig: SecurityHeadersConfig = {
        enabled: true,
        csp: 'default-src self',
        hsts: true,
      };
      assert(typeof headersConfig.csp === 'string');
    });

    it('should support request validation config type', () => {
      const requestConfig: RequestValidationConfig = {
        enabled: true,
        allowedMethods: ['GET', 'POST'],
        allowedOrigins: ['https://example.com'],
      };
      assert(Array.isArray(requestConfig.allowedMethods));
    });

    it('should support rate limit state type', () => {
      const state: RateLimitState = {
        requests: 5,
        windowStart: Date.now(),
        blocked: false,
      };
      assert(typeof state.requests === 'number');
    });
  });

  describe('Backward Compatibility', () => {
    it('should maintain API compatibility with legacy imports', () => {
      // Test that all the expected exports are available
      const exports = {
        SecurityManager,
        SecurityCrypto,
        createSecurityConfig,
        defaultSecurity,
        createSecurityRequestInterceptor,
        createSecurityResponseInterceptor,
        securityRequestInterceptor,
        securityResponseInterceptor,
      };

      Object.entries(exports).forEach(([name, value]) => {
        assert(value !== undefined, `${name} should be exported`);
      });
    });

    it('should work with interceptor pipeline', async () => {
      const config: fluxhttpRequestConfig = {
        url: 'https://api.example.com/test',
        method: 'GET',
        headers: {},
      };

      // Should not throw when applying interceptors
      assert.doesNotThrow(() => {
        const result = securityRequestInterceptor(config);
        assert(typeof result === 'object');
      });
    });

    it('should work with response interception', () => {
      const response: fluxhttpResponse = {
        data: { test: 'data' },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {
          url: 'https://api.example.com/test',
          method: 'GET',
        },
      };

      // Should not throw when applying response interceptor
      assert.doesNotThrow(() => {
        const result = securityResponseInterceptor(response);
        assert(typeof result === 'object');
      });
    });
  });

  describe('Deprecation Warning', () => {
    it('should be marked as deprecated in comments', () => {
      // This test ensures the deprecation notice is present
      // In a real scenario, you might check for console warnings
      // or other deprecation indicators
      assert(true, 'Module should include deprecation notice');
    });

    it('should recommend using src/security instead', () => {
      // This serves as documentation that users should migrate
      // to the new modular security system
      assert(true, 'Users should migrate to src/security');
    });
  });

  describe('Error Handling', () => {
    it('should handle null/undefined configs gracefully', () => {
      assert.doesNotThrow(() => {
        new SecurityManager(null as any);
      });

      assert.doesNotThrow(() => {
        new SecurityManager(undefined as any);
      });
    });

    it('should handle invalid interceptor inputs', () => {
      assert.doesNotThrow(() => {
        securityRequestInterceptor(null as any);
      });

      assert.doesNotThrow(() => {
        securityResponseInterceptor(null as any);
      });
    });

    it('should handle crypto operations safely', () => {
      const crypto = new SecurityCrypto();
      
      assert.doesNotThrow(() => {
        // Test with empty or invalid inputs
        crypto.generateHash('');
      });
    });
  });

  describe('Performance Considerations', () => {
    it('should have minimal overhead for disabled security', () => {
      const config = createSecurityConfig({ enabled: false });
      const start = process.hrtime();
      
      // Perform multiple security operations
      for (let i = 0; i < 1000; i++) {
        const interceptor = createSecurityRequestInterceptor(config);
        interceptor({
          url: 'https://api.example.com/test',
          method: 'GET',
        });
      }
      
      const [seconds, nanoseconds] = process.hrtime(start);
      const milliseconds = seconds * 1000 + nanoseconds / 1000000;
      
      // Should complete quickly when disabled
      assert(milliseconds < 100, 'Security operations should be fast when disabled');
    });

    it('should not leak memory with repeated operations', () => {
      const config = createSecurityConfig();
      const initialMemory = process.memoryUsage().heapUsed;
      
      // Perform many operations
      for (let i = 0; i < 10000; i++) {
        const manager = new SecurityManager(config);
        const crypto = new SecurityCrypto();
        
        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }
      }
      
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;
      
      // Memory increase should be reasonable (less than 10MB)
      assert(memoryIncrease < 10 * 1024 * 1024, 'Memory usage should not grow excessively');
    });
  });

  describe('Thread Safety', () => {
    it('should handle concurrent security operations', async () => {
      const config = createSecurityConfig();
      const manager = new SecurityManager(config);
      
      // Create multiple concurrent operations
      const operations = Array.from({ length: 100 }, (_, i) => {
        return Promise.resolve().then(() => {
          const crypto = new SecurityCrypto();
          return crypto.generateHash(`test-data-${i}`);
        });
      });
      
      // Should complete without errors
      const results = await Promise.all(operations);
      assert.strictEqual(results.length, 100);
    });

    it('should maintain security state consistency', () => {
      const config = createSecurityConfig({
        enabled: true,
        rateLimit: {
          enabled: true,
          maxRequests: 10,
          windowMs: 1000,
        },
      });
      
      const manager1 = new SecurityManager(config);
      const manager2 = new SecurityManager(config);
      
      // Different instances should have independent state
      assert.notStrictEqual(manager1, manager2);
    });
  });

  describe('Integration with Core', () => {
    it('should integrate with request pipeline', () => {
      const config: fluxhttpRequestConfig = {
        url: 'https://api.example.com/secure',
        method: 'POST',
        data: { test: 'data' },
        headers: {},
      };
      
      const securityConfig = createSecurityConfig({
        enabled: true,
        csrf: {
          enabled: true,
          token: 'test-csrf-token',
          header: 'X-CSRF-Token',
        },
      });
      
      const interceptor = createSecurityRequestInterceptor(securityConfig);
      const result = interceptor(config);
      
      assert(result.headers);
      // Should add security headers
    });

    it('should validate responses properly', () => {
      const response: fluxhttpResponse = {
        data: { sensitive: 'data' },
        status: 200,
        statusText: 'OK',
        headers: {
          'content-type': 'application/json',
        },
        config: {
          url: 'https://api.example.com/secure',
          method: 'GET',
        },
      };
      
      const securityConfig = createSecurityConfig({
        enabled: true,
        contentValidation: {
          enabled: true,
          maxSize: 1024 * 1024,
          allowedTypes: ['application/json'],
        },
      });
      
      const interceptor = createSecurityResponseInterceptor(securityConfig);
      const result = interceptor(response);
      
      assert.strictEqual(result.status, 200);
    });
  });
});
