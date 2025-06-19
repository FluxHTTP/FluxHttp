import { describe, it } from 'node:test';
import assert from 'node:assert';
import fluxhttp from '../../../dist/index.js';

describe('defaults configuration', () => {
  const defaults = fluxhttp.defaults;

  describe('Basic properties', () => {
    it('should have default method as GET', (): void => {
      assert.strictEqual(defaults.method, 'GET');
    });

    it('should have default timeout as 0', (): void => {
      assert.strictEqual(defaults.timeout, 0);
    });

    it('should have default headers', (): void => {
      assert(defaults.headers);
      assert.strictEqual(defaults.headers.Accept, 'application/json, text/plain, */*');
      assert(defaults.headers['User-Agent'].startsWith('fluxhttp/'));
    });
  });

  describe('validateStatus function', () => {
    it('should be a function', (): void => {
      assert(typeof defaults.validateStatus === 'function');
    });

    it('should accept 2xx status codes', (): void => {
      assert.strictEqual(defaults.validateStatus(200), true);
      assert.strictEqual(defaults.validateStatus(201), true);
      assert.strictEqual(defaults.validateStatus(204), true);
      assert.strictEqual(defaults.validateStatus(299), true);
    });

    it('should reject non-2xx status codes', (): void => {
      assert.strictEqual(defaults.validateStatus(100), false);
      assert.strictEqual(defaults.validateStatus(199), false);
      assert.strictEqual(defaults.validateStatus(300), false);
      assert.strictEqual(defaults.validateStatus(400), false);
      assert.strictEqual(defaults.validateStatus(404), false);
      assert.strictEqual(defaults.validateStatus(500), false);
    });

    it('should handle edge cases', (): void => {
      assert.strictEqual(defaults.validateStatus(0), false);
      assert.strictEqual(defaults.validateStatus(-1), false);
      assert.strictEqual(defaults.validateStatus(NaN), false);
      assert.strictEqual(defaults.validateStatus(Infinity), false);
    });
  });

  describe('transformRequest function', () => {
    let transformRequest;

    it('should have transformRequest array', (): void => {
      assert(Array.isArray(defaults.transformRequest));
      assert(defaults.transformRequest.length > 0);
      transformRequest = defaults.transformRequest[0];
    });

    it('should stringify plain objects to JSON', (): void => {
      const data = { name: 'test', value: 123 };
      const headers = {};
      const result = transformRequest(data, headers);

      assert.strictEqual(result, JSON.stringify(data));
      assert.strictEqual(headers['content-type'], 'application/json');
    });

    it('should not override existing content-type', (): void => {
      const data = { test: true };
      const headers = { 'content-type': 'application/xml' };
      transformRequest(data, headers);

      assert.strictEqual(headers['content-type'], 'application/xml');
    });

    it('should preserve FormData', (): void => {
      // Simulate FormData check
      const formData = {
        _isFormData: true,
        [Symbol.toStringTag]: 'FormData',
      };

      const result = transformRequest(formData);
      assert.strictEqual(result, formData);
    });

    it('should preserve URLSearchParams', (): void => {
      // Simulate URLSearchParams check
      const params = {
        _isURLSearchParams: true,
        toString: () => 'param=value',
      };

      const result = transformRequest(params);
      assert.strictEqual(result, params);
    });

    it('should handle null and undefined', (): void => {
      assert.strictEqual(transformRequest(null), null);
      assert.strictEqual(transformRequest(undefined), undefined);
    });

    it('should preserve strings', (): void => {
      const str = 'plain text data';
      assert.strictEqual(transformRequest(str), str);
    });

    it('should preserve numbers', (): void => {
      assert.strictEqual(transformRequest(123), 123);
      assert.strictEqual(transformRequest(0), 0);
      assert.strictEqual(transformRequest(-1), -1);
    });

    it('should preserve booleans', (): void => {
      assert.strictEqual(transformRequest(true), true);
      assert.strictEqual(transformRequest(false), false);
    });

    it('should handle arrays', (): void => {
      const arr = [1, 2, 3];
      const headers = {};
      const result = transformRequest(arr, headers);

      assert.strictEqual(result, JSON.stringify(arr));
      assert.strictEqual(headers['content-type'], 'application/json');
    });

    it('should handle nested objects', (): void => {
      const nested = {
        level1: {
          level2: {
            value: 'deep',
          },
        },
      };
      const headers = {};
      const result = transformRequest(nested, headers);

      assert.strictEqual(result, JSON.stringify(nested));
    });

    it('should handle objects with special characters', (): void => {
      const data = {
        unicode: '你好世界',
        emoji: '😀',
        special: '<>&"\'',
        newline: 'line1\nline2',
      };
      const result = transformRequest(data, {});

      assert.strictEqual(result, JSON.stringify(data));
    });
  });

  describe('transformResponse function', () => {
    let transformResponse;

    it('should have transformResponse array', (): void => {
      assert(Array.isArray(defaults.transformResponse));
      assert(defaults.transformResponse.length > 0);
      transformResponse = defaults.transformResponse[0];
    });

    it('should parse valid JSON strings', (): void => {
      const obj = { name: 'test', value: 123 };
      const jsonStr = JSON.stringify(obj);
      const result = transformResponse(jsonStr);

      assert.deepStrictEqual(result, obj);
    });

    it('should return invalid JSON strings as-is', (): void => {
      const invalidJson = '{ invalid json }';
      const result = transformResponse(invalidJson);

      assert.strictEqual(result, invalidJson);
    });

    it('should preserve non-string data', (): void => {
      assert.strictEqual(transformResponse(123), 123);
      assert.strictEqual(transformResponse(true), true);
      assert.strictEqual(transformResponse(null), null);
      assert.strictEqual(transformResponse(undefined), undefined);

      const obj = { test: true };
      assert.strictEqual(transformResponse(obj), obj);

      const arr = [1, 2, 3];
      assert.strictEqual(transformResponse(arr), arr);
    });

    it('should handle empty strings', (): void => {
      assert.strictEqual(transformResponse(''), '');
    });

    it('should handle whitespace-only strings', (): void => {
      assert.strictEqual(transformResponse('   '), '   ');
      assert.strictEqual(transformResponse('\n\t'), '\n\t');
    });

    it('should parse JSON arrays', (): void => {
      const arr = [1, 2, 3, { nested: true }];
      const jsonStr = JSON.stringify(arr);
      const result = transformResponse(jsonStr);

      assert.deepStrictEqual(result, arr);
    });

    it('should parse JSON primitives', (): void => {
      assert.strictEqual(transformResponse('"string"'), 'string');
      assert.strictEqual(transformResponse('123'), 123);
      assert.strictEqual(transformResponse('true'), true);
      assert.strictEqual(transformResponse('false'), false);
      assert.strictEqual(transformResponse('null'), null);
    });

    it('should handle large JSON strings', (): void => {
      const largeObj = {
        data: Array(1000)
          .fill(null)
          .map((_, i) => ({
            id: i,
            value: `item-${i}`,
            nested: { prop: i * 2 },
          })),
      };
      const jsonStr = JSON.stringify(largeObj);
      const result = transformResponse(jsonStr);

      assert.deepStrictEqual(result, largeObj);
    });

    it('should handle unicode in JSON', (): void => {
      const unicodeObj = {
        chinese: '你好世界',
        emoji: '😀🎉',
        arabic: 'مرحبا',
        special: '©®™',
      };
      const jsonStr = JSON.stringify(unicodeObj);
      const result = transformResponse(jsonStr);

      assert.deepStrictEqual(result, unicodeObj);
    });
  });

  describe('Default configuration immutability', () => {
    it('should not affect other instances when modified', (): void => {
      const instance1 = fluxhttp.create();
      const instance2 = fluxhttp.create();

      instance1.defaults.timeout = 5000;
      instance1.defaults.headers['X-Custom'] = 'instance1';

      assert.notStrictEqual(instance2.defaults.timeout, 5000);
      assert.strictEqual(instance2.defaults.headers['X-Custom'], undefined);
    });

    it('should allow overriding defaults', (): void => {
      const instance = fluxhttp.create({
        timeout: 10000,
        method: 'POST',
        validateStatus: (status) => status < 400,
      });

      assert.strictEqual(instance.defaults.timeout, 10000);
      assert.strictEqual(instance.defaults.method, 'POST');
      assert.strictEqual(instance.defaults.validateStatus(399), true);
      assert.strictEqual(instance.defaults.validateStatus(400), false);
    });
  });
});
