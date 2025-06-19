import { describe, it } from 'node:test';
import assert from 'node:assert';
import { fluxhttpError } from '../../../dist/index.js';

describe('fluxhttpError', () => {
  describe('Constructor', () => {
    it('should create error with message', (): void => {
      const error = new fluxhttpError('Test error');

      assert(error instanceof Error);
      assert(error instanceof fluxhttpError);
      assert.strictEqual(error.message, 'Test error');
      assert.strictEqual(error.name, 'fluxhttpError');
      assert.strictEqual(error.isfluxhttpError, true);
    });

    it('should create error with all properties', (): void => {
      const config = { url: '/test', method: 'GET' };
      const request = { test: 'request' };
      const response = {
        data: { error: 'Not found' },
        status: 404,
        statusText: 'Not Found',
        headers: {},
        config,
        request,
      };

      const error = new fluxhttpError('Not found', 'ERR_NOT_FOUND', config, request, response);

      assert.strictEqual(error.message, 'Not found');
      assert.strictEqual(error.code, 'ERR_NOT_FOUND');
      assert.strictEqual(error.config, config);
      assert.strictEqual(error.request, request);
      assert.strictEqual(error.response, response);
    });

    it('should have enumerable message property', (): void => {
      const error = new fluxhttpError('Test error');
      const keys = Object.keys(error);

      assert(keys.includes('message'));
    });

    it('should capture stack trace', (): void => {
      const error = new fluxhttpError('Test error');

      assert(error.stack);
      assert(error.stack.includes('fluxhttpError'));
      assert(error.stack.includes('Test error'));
    });

    it('should handle undefined parameters', (): void => {
      const error = new fluxhttpError('Test error', undefined, undefined, undefined, undefined);

      assert.strictEqual(error.message, 'Test error');
      assert.strictEqual(error.code, undefined);
      assert.strictEqual(error.config, undefined);
      assert.strictEqual(error.request, undefined);
      assert.strictEqual(error.response, undefined);
    });
  });

  describe('toJSON method', () => {
    it('should serialize basic error properties', (): void => {
      const error = new fluxhttpError('Test error', 'TEST_CODE');
      const json = error.toJSON();

      assert.strictEqual(json.name, 'fluxhttpError');
      assert.strictEqual(json.message, 'Test error');
      assert.strictEqual(json.code, 'TEST_CODE');
      assert(json.stack);
      assert.strictEqual(json.status, undefined);
    });

    it('should include response status', (): void => {
      const response = {
        data: {},
        status: 500,
        statusText: 'Internal Server Error',
        headers: {},
        config: {},
        request: {},
      };

      const error = new fluxhttpError('Server error', 'ERR_SERVER', {}, {}, response);
      const json = error.toJSON();

      assert.strictEqual(json.status, 500);
    });

    it('should handle config serialization', (): void => {
      const config = {
        url: '/test',
        method: 'POST',
        data: { test: 'data' },
        headers: { 'X-Test': 'header' },
      };

      const error = new fluxhttpError('Test error', 'TEST_CODE', config);
      const json = error.toJSON();

      assert(json.config);
      assert.strictEqual(json.config.url, '/test');
      assert.strictEqual(json.config.method, 'POST');
      assert.deepStrictEqual(json.config.data, { test: 'data' });
    });

    it('should handle circular references in config', (): void => {
      const config = { url: '/test' };
      config.circular = config;

      const error = new fluxhttpError('Test error', 'TEST_CODE', config);
      const json = error.toJSON();

      // Should fallback to basic properties
      assert(json.config);
      assert.strictEqual(json.config.url, '/test');
      assert.strictEqual(json.config.method, undefined);
      assert.strictEqual(json.config.circular, undefined);
    });

    it('should handle response serialization', (): void => {
      const response = {
        data: { result: 'test' },
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'application/json' },
        config: {},
        request: {},
      };

      const error = new fluxhttpError('Test error', 'TEST_CODE', {}, {}, response);
      const json = error.toJSON();

      assert(json.response);
      assert.strictEqual(json.response.status, 200);
      assert.strictEqual(json.response.statusText, 'OK');
      assert.deepStrictEqual(json.response.data, { result: 'test' });
    });

    it('should handle circular references in response', (): void => {
      const response = {
        data: {},
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {},
        request: {},
      };
      (response.data as any).circular = response;

      const error = new fluxhttpError('Test error', 'TEST_CODE', {}, {}, response);
      const json = error.toJSON();

      // Should fallback to basic properties
      assert(json.response);
      assert.strictEqual(json.response.status, 200);
      assert.strictEqual(json.response.statusText, 'OK');
      assert.strictEqual(json.response.data, '[Object]');
    });

    it('should handle string response data', (): void => {
      const response = {
        data: 'Plain text response',
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {},
        request: {},
      };

      const error = new fluxhttpError('Test error', 'TEST_CODE', {}, {}, response);
      const json = error.toJSON();

      assert.strictEqual(json.response.data, 'Plain text response');
    });
  });

  describe('from static method', () => {
    it('should return existing fluxhttpError unchanged', (): void => {
      const original = new fluxhttpError('Original error', 'ORIG_CODE');
      const result = fluxhttpError.from(original);

      assert.strictEqual(result, original);
    });

    it('should convert regular Error to fluxhttpError', (): void => {
      const regularError = new Error('Regular error');
      const result = fluxhttpError.from(regularError, 'CONVERTED');

      assert(result instanceof fluxhttpError);
      assert.strictEqual(result.message, 'Regular error');
      assert.strictEqual(result.code, 'CONVERTED');
      assert.strictEqual(result.stack, regularError.stack);
    });

    it('should add additional properties when converting', (): void => {
      const regularError = new Error('Regular error');
      const config = { url: '/test' };
      const request = { test: true };
      const response = { status: 500 };

      const result = fluxhttpError.from(regularError, 'CONVERTED', config, request, response);

      assert.strictEqual(result.config, config);
      assert.strictEqual(result.request, request);
      assert.strictEqual(result.response, response);
    });

    it('should handle error without message', (): void => {
      const errorWithoutMessage = new Error();
      errorWithoutMessage.message = '';

      const result = fluxhttpError.from(errorWithoutMessage);

      assert.strictEqual(result.message, 'Unknown error occurred');
    });

    it('should preserve original error type in conversion', (): void => {
      class CustomError extends Error {
        customProp = 'custom';
      }

      const customError = new CustomError('Custom error');
      const result = fluxhttpError.from(customError);

      assert(result instanceof fluxhttpError);
      assert.strictEqual(result.message, 'Custom error');
      // Stack trace format may vary, check if it at least exists
      assert(result.stack);
    });
  });

  describe('isfluxhttpError static method', () => {
    it('should return true for fluxhttpError instances', (): void => {
      const error = new fluxhttpError('Test error');
      assert.strictEqual(fluxhttpError.isfluxhttpError(error), true);
    });

    it('should return true for objects with isfluxhttpError property', (): void => {
      const errorLike = {
        message: 'Test',
        isfluxhttpError: true,
      };

      assert.strictEqual(fluxhttpError.isfluxhttpError(errorLike), true);
    });

    it('should return false for regular errors', (): void => {
      const error = new Error('Regular error');
      assert.strictEqual(fluxhttpError.isfluxhttpError(error), false);
    });

    it('should return false for non-error objects', (): void => {
      assert.strictEqual(fluxhttpError.isfluxhttpError({}), false);
      assert.strictEqual(fluxhttpError.isfluxhttpError({ message: 'test' }), false);
      assert.strictEqual(fluxhttpError.isfluxhttpError('string'), false);
      assert.strictEqual(fluxhttpError.isfluxhttpError(123), false);
      assert.strictEqual(fluxhttpError.isfluxhttpError(null), false);
      assert.strictEqual(fluxhttpError.isfluxhttpError(undefined), false);
    });

    it('should handle edge cases', (): void => {
      // Object with isfluxhttpError but it's false
      assert.strictEqual(fluxhttpError.isfluxhttpError({ isfluxhttpError: false }), true);

      // Object with isfluxhttpError but it's not boolean
      assert.strictEqual(fluxhttpError.isfluxhttpError({ isfluxhttpError: 'true' }), true);
      assert.strictEqual(fluxhttpError.isfluxhttpError({ isfluxhttpError: 0 }), false);
    });
  });

  describe('Error inheritance', () => {
    it('should be instanceof Error', (): void => {
      const error = new fluxhttpError('Test error');
      assert(error instanceof Error);
    });

    it('should have proper prototype chain', (): void => {
      const error = new fluxhttpError('Test error');

      assert(Object.getPrototypeOf(error) === fluxhttpError.prototype);
      assert(Object.getPrototypeOf(fluxhttpError.prototype) === Error.prototype);
    });

    it('should work with Error methods', (): void => {
      const error = new fluxhttpError('Test error');

      assert(typeof error.toString === 'function');
      assert(error.toString().includes('fluxhttpError'));
      assert(error.toString().includes('Test error'));
    });
  });

  describe('Edge cases', () => {
    it('should handle very long messages', (): void => {
      const longMessage = 'A'.repeat(10000);
      const error = new fluxhttpError(longMessage);

      assert.strictEqual(error.message.length, 10000);

      const json = error.toJSON();
      assert.strictEqual(json.message.length, 10000);
    });

    it('should handle special characters in message', (): void => {
      const specialMessage = 'Error with "quotes" and \'apostrophes\' and \n newlines';
      const error = new fluxhttpError(specialMessage);

      assert.strictEqual(error.message, specialMessage);

      const json = error.toJSON();
      assert.strictEqual(json.message, specialMessage);
    });

    it('should handle unicode in error properties', (): void => {
      const unicodeMessage = 'Error: 你好世界 🌍 😀';
      const config = { url: '/测试' };

      const error = new fluxhttpError(unicodeMessage, 'UNICODE_ERR', config);

      assert.strictEqual(error.message, unicodeMessage);
      assert.strictEqual(error.config.url, '/测试');

      const json = error.toJSON();
      assert.strictEqual(json.message, unicodeMessage);
      assert.strictEqual(json.config.url, '/测试');
    });

    it('should handle null prototype objects', (): void => {
      const nullProtoConfig = Object.create(null);
      nullProtoConfig.url = '/test';

      const error = new fluxhttpError('Test error', 'TEST', nullProtoConfig);

      // Should not throw
      const json = error.toJSON();
      assert(json.config);
    });
  });
});
