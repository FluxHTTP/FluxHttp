import { describe, it } from 'node:test';
import assert from 'node:assert';

// We need to test the built module
import fluxhttp from '../../../dist/index.js';

// Helper to create instances with different configs for testing merge behavior
function testMergeConfig(config1, config2): void {
  const instance = fluxhttp.create(config1);
  const merged = instance.create(config2);
  return merged.defaults;
}

describe('mergeConfig', () => {
  describe('Basic merging', () => {
    it('should merge two config objects', (): void => {
      const config1 = { baseURL: 'https://api1.com', timeout: 3000 };
      const config2 = { timeout: 5000, method: 'POST' };

      const merged = testMergeConfig(config1, config2);

      assert.strictEqual(merged.baseURL, 'https://api1.com');
      assert.strictEqual(merged.timeout, 5000);
      assert.strictEqual(merged.method, 'POST');
    });

    it('should handle null configs', (): void => {
      const merged1 = testMergeConfig(null, { timeout: 5000 });
      assert.strictEqual(merged1.timeout, 5000);

      const merged2 = testMergeConfig({ baseURL: 'https://test.com' }, null);
      assert.strictEqual(merged2.baseURL, 'https://test.com');

      const merged3 = testMergeConfig(null, null);
      assert(merged3);
    });

    it('should handle undefined configs', (): void => {
      const merged1 = testMergeConfig(undefined, { timeout: 5000 });
      assert.strictEqual(merged1.timeout, 5000);

      const merged2 = testMergeConfig({ baseURL: 'https://test.com' }, undefined);
      assert.strictEqual(merged2.baseURL, 'https://test.com');
    });

    it('should override values from config1 with config2', (): void => {
      const config1 = {
        baseURL: 'https://old.com',
        timeout: 3000,
        method: 'GET',
      };
      const config2 = {
        baseURL: 'https://new.com',
        timeout: 5000,
      };

      const merged = testMergeConfig(config1, config2);

      assert.strictEqual(merged.baseURL, 'https://new.com');
      assert.strictEqual(merged.timeout, 5000);
      assert.strictEqual(merged.method, 'GET'); // Not overridden
    });
  });

  describe('Headers merging', () => {
    it('should merge headers objects', (): void => {
      const config1 = {
        headers: {
          'X-Header-1': 'value1',
          'X-Common': 'old',
        },
      };
      const config2 = {
        headers: {
          'X-Header-2': 'value2',
          'X-Common': 'new',
        },
      };

      const merged = testMergeConfig(config1, config2);

      assert.strictEqual(merged.headers['X-Header-1'], 'value1');
      assert.strictEqual(merged.headers['X-Header-2'], 'value2');
      assert.strictEqual(merged.headers['X-Common'], 'new');
    });

    it('should handle null/undefined headers', (): void => {
      const config1 = { headers: { 'X-Test': 'value' } };
      const config2 = { headers: null };

      const merged = testMergeConfig(config1, config2);
      assert(merged.headers);

      const merged2 = testMergeConfig({ headers: null }, { headers: { 'X-New': 'value' } });
      assert.strictEqual(merged2.headers['X-New'], 'value');
    });

    it('should preserve case-insensitive header names', (): void => {
      const config1 = { headers: { 'content-type': 'text/plain' } };
      const config2 = { headers: { 'Content-Type': 'application/json' } };

      const merged = testMergeConfig(config1, config2);

      // Should have the second value with normalized case
      const hasContentType = Object.keys(merged.headers).some(
        (key) => key.toLowerCase() === 'content-type'
      );
      assert(hasContentType);
    });
  });

  describe('Special config properties', () => {
    it('should merge retry config', (): void => {
      const config1 = {
        retry: {
          retries: 3,
          delay: 1000,
        },
      };
      const config2 = {
        retry: {
          retries: 5,
          factor: 2,
        },
      };

      const merged = testMergeConfig(config1, config2);

      assert.strictEqual(merged.retry.retries, 5);
      assert.strictEqual(merged.retry.delay, 1000);
      assert.strictEqual(merged.retry.factor, 2);
    });

    it('should merge cache config', (): void => {
      const config1 = {
        cache: {
          ttl: 300,
          methods: ['GET'],
        },
      };
      const config2 = {
        cache: {
          ttl: 600,
          excludePaths: ['/api/auth'],
        },
      };

      const merged = testMergeConfig(config1, config2);

      assert.strictEqual(merged.cache.ttl, 600);
      assert.deepStrictEqual(merged.cache.methods, ['GET']);
      assert.deepStrictEqual(merged.cache.excludePaths, ['/api/auth']);
    });

    it('should merge security config', (): void => {
      const config1 = {
        security: {
          csrf: true,
          xss: true,
        },
      };
      const config2 = {
        security: {
          xss: false,
          contentValidation: true,
        },
      };

      const merged = testMergeConfig(config1, config2);

      assert.strictEqual(merged.security.csrf, true);
      assert.strictEqual(merged.security.xss, false);
      assert.strictEqual(merged.security.contentValidation, true);
    });
  });

  describe('Transform functions', () => {
    it('should replace transform functions', (): void => {
      const transform1 = [(data) => data + '1'];
      const transform2 = [(data) => data + '2'];

      const config1 = { transformRequest: transform1 };
      const config2 = { transformRequest: transform2 };

      const merged = testMergeConfig(config1, config2);

      assert.strictEqual(merged.transformRequest, transform2);
      assert.notStrictEqual(merged.transformRequest, transform1);
    });
  });

  describe('Security - Prototype pollution protection', () => {
    it('should not allow __proto__ in config', (): void => {
      const maliciousConfig = {
        __proto__: { polluted: true },
        normal: 'value',
      };

      const merged = testMergeConfig({}, maliciousConfig);

      // The merged config should not have __proto__
      assert.strictEqual(merged.__proto__.polluted, undefined);
      assert.strictEqual(merged.normal, undefined); // Not a valid config key
    });

    it('should not allow constructor in config', (): void => {
      const maliciousConfig = {
        constructor: { prototype: { polluted: true } },
        timeout: 5000,
      };

      const merged = testMergeConfig({}, maliciousConfig);

      assert.strictEqual(merged.constructor.prototype.polluted, undefined);
      assert.strictEqual(merged.timeout, 5000);
    });

    it('should not allow prototype in config', (): void => {
      const maliciousConfig = {
        prototype: { polluted: true },
      };

      const merged = testMergeConfig({}, maliciousConfig);
      assert.strictEqual(Object.prototype.polluted, undefined);
    });

    it('should filter out dangerous keys in nested objects', (): void => {
      const config = {
        retry: {
          retries: 3,
          __proto__: { polluted: true },
        },
      };

      const merged = testMergeConfig({}, config);

      assert.strictEqual(merged.retry.retries, 3);
      assert.strictEqual(Object.prototype.polluted, undefined);
    });
  });

  describe('Valid config keys', () => {
    it('should only merge known config keys', (): void => {
      const config1 = { baseURL: 'https://api.com' };
      const config2 = {
        baseURL: 'https://newapi.com',
        unknownKey: 'should not be merged',
        anotherUnknown: 123,
      };

      const merged = testMergeConfig(config1, config2);

      assert.strictEqual(merged.baseURL, 'https://newapi.com');
      assert.strictEqual(merged.unknownKey, undefined);
      assert.strictEqual(merged.anotherUnknown, undefined);
    });

    it('should merge all valid config properties', (): void => {
      const validConfig = {
        adapter: 'custom',
        url: '/path',
        method: 'POST',
        baseURL: 'https://api.com',
        headers: { 'X-Test': 'value' },
        params: { id: 1 },
        data: { name: 'test' },
        timeout: 5000,
        withCredentials: true,
        auth: { username: 'user', password: 'pass' },
        responseType: 'json',
        responseEncoding: 'utf8',
        validateStatus: (status) => status < 400,
        maxRedirects: 5,
        maxContentLength: 10000,
        maxBodyLength: 10000,
        decompress: true,
        signal: new AbortController().signal,
        cancelToken: 'token',
        onUploadProgress: () => {},
        onDownloadProgress: () => {},
        retry: { retries: 3 },
        cache: { ttl: 300 },
        security: { csrf: true },
      };

      const merged = testMergeConfig({}, validConfig);

      // Check that all properties were merged
      Object.keys(validConfig).forEach((_key) => {
        if (
          key === 'validateStatus' ||
          key === 'onUploadProgress' ||
          key === 'onDownloadProgress'
        ) {
          assert(typeof merged[key] === 'function');
        } else {
          assert(merged[key] !== undefined);
        }
      });
    });
  });

  describe('Edge cases', () => {
    it('should handle undefined values in config2', (): void => {
      const config1 = {
        baseURL: 'https://api.com',
        timeout: 5000,
      };
      const config2 = {
        baseURL: undefined,
        timeout: 3000,
      };

      const merged = testMergeConfig(config1, config2);

      assert.strictEqual(merged.baseURL, 'https://api.com'); // Not overridden by undefined
      assert.strictEqual(merged.timeout, 3000);
    });

    it('should handle empty objects', (): void => {
      const merged1 = testMergeConfig({}, {});
      assert(merged1);

      const merged2 = testMergeConfig({ timeout: 5000 }, {});
      assert.strictEqual(merged2.timeout, 5000);
    });

    it('should handle non-object values for merge-type configs', (): void => {
      const config = {
        retry: 'not-an-object',
        cache: 123,
        security: null,
      };

      const merged = testMergeConfig({}, config);

      // Non-objects should not be merged for these properties
      assert.notStrictEqual(merged.retry, 'not-an-object');
      assert.notStrictEqual(merged.cache, 123);
      assert.notStrictEqual(merged.security, null);
    });

    it('should handle circular references', (): void => {
      const config1 = { timeout: 3000 };
      config1.circular = config1;

      const config2 = { timeout: 5000 };

      // Should not throw
      const merged = testMergeConfig(config1, config2);
      assert.strictEqual(merged.timeout, 5000);
    });
  });
});
