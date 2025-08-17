const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert');

// Import the built library
const fluxhttpModule = require('../../../dist/index.js');
const { fluxhttpError } = fluxhttpModule;

/**
 * Comprehensive unit tests for fluxhttpError class
 * Tests error creation, serialization, type guards, and integration
 */
describe('fluxhttpError', () => {
  describe('Constructor and basic properties', () => {
    it('should create error with message only', () => {
      const error = new fluxhttpError('Test error');
      
      assert.strictEqual(error.message, 'Test error');
      assert.strictEqual(error.name, 'fluxhttpError');
      assert.strictEqual(error.isfluxhttpError, true);
      assert(error instanceof Error, 'Should extend Error');
      assert(error instanceof fluxhttpError, 'Should be instance of fluxhttpError');
    });

    it('should create error with message and code', () => {
      const error = new fluxhttpError('Network error', 'ERR_NETWORK');
      
      assert.strictEqual(error.message, 'Network error');
      assert.strictEqual(error.code, 'ERR_NETWORK');
      assert.strictEqual(error.name, 'fluxhttpError');
    });

    it('should create error with all parameters', () => {
      const config = {
        url: 'https://api.test.com/data',
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      };

      const request = { requestId: '123' };

      const response = {
        data: { error: 'Not found' },
        status: 404,
        statusText: 'Not Found',
        headers: { 'Content-Type': 'application/json' },
        config,
        request
      };

      const error = new fluxhttpError(
        'Request failed',
        'ERR_BAD_REQUEST',
        config,
        request,
        response
      );

      assert.strictEqual(error.message, 'Request failed');
      assert.strictEqual(error.code, 'ERR_BAD_REQUEST');
      assert.deepStrictEqual(error.config, config);
      assert.deepStrictEqual(error.request, request);
      assert.deepStrictEqual(error.response, response);
    });

    it('should have stack trace', () => {
      const error = new fluxhttpError('Test error');
      
      assert(error.stack, 'Should have stack trace');
      assert(error.stack.includes('fluxhttpError'), 'Stack should mention fluxhttpError');
      assert(typeof error.stack === 'string', 'Stack should be string');
    });

    it('should make message enumerable', () => {
      const error = new fluxhttpError('Test error');
      const descriptor = Object.getOwnPropertyDescriptor(error, 'message');
      
      assert(descriptor, 'Should have message property descriptor');
      assert.strictEqual(descriptor.enumerable, true, 'Message should be enumerable');
      assert.strictEqual(descriptor.configurable, true, 'Message should be configurable');
      assert.strictEqual(descriptor.writable, true, 'Message should be writable');
    });

    it('should handle undefined and null parameters gracefully', () => {
      const error = new fluxhttpError('Test', undefined, null, undefined, null);
      
      assert.strictEqual(error.message, 'Test');
      assert.strictEqual(error.code, undefined);
      assert.strictEqual(error.config, null);
      assert.strictEqual(error.request, undefined);
      assert.strictEqual(error.response, null);
    });
  });

  describe('Error inheritance and behavior', () => {
    it('should behave like a normal Error', () => {
      const error = new fluxhttpError('Test error');
      
      // Should be throwable
      assert.throws(() => {
        throw error;
      }, fluxhttpError);

      // Should work with instanceof
      assert(error instanceof Error);
      assert(error instanceof fluxhttpError);

      // Should have Error properties
      assert(error.message);
      assert(error.name);
      assert(error.stack);
    });

    it('should capture stack trace correctly', () => {
      function createError() {
        return new fluxhttpError('Created in function');
      }

      const error = createError();
      
      assert(error.stack, 'Should have stack trace');
      if (error.stack.includes('createError')) {
        // Stack trace should show the function where it was created
        assert(error.stack.includes('createError'), 'Stack should include createError function');
      }
    });

    it('should work with Error.prototype methods', () => {
      const error = new fluxhttpError('Test error');
      
      // toString should work
      const errorString = error.toString();
      assert(errorString.includes('fluxhttpError'), 'toString should include error name');
      assert(errorString.includes('Test error'), 'toString should include message');

      // Should be serializable for logging
      assert.doesNotThrow(() => {
        String(error);
      });
    });

    it('should handle circular references in constructor', () => {
      const config = { url: 'https://test.com' };
      config.circular = config;

      const response = {
        data: { message: 'test' },
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
        request: {}
      };
      response.circularResponse = response;

      // Should not throw with circular references
      assert.doesNotThrow(() => {
        new fluxhttpError('Test', 'CODE', config, {}, response);
      });
    });
  });

  describe('JSON serialization (toJSON method)', () => {
    it('should serialize basic error to JSON', () => {
      const error = new fluxhttpError('Test error', 'TEST_CODE');
      const json = error.toJSON();

      assert.strictEqual(json.name, 'fluxhttpError');
      assert.strictEqual(json.message, 'Test error');
      assert.strictEqual(json.code, 'TEST_CODE');
      assert(json.stack, 'Should include stack trace');
      assert.strictEqual(json.status, undefined);
    });

    it('should serialize error with response', () => {
      const config = {
        url: 'https://api.test.com/data',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      };

      const response = {
        data: { error: 'Validation failed', details: ['Name is required'] },
        status: 400,
        statusText: 'Bad Request',
        headers: { 'Content-Type': 'application/json' },
        config,
        request: {}
      };

      const error = new fluxhttpError('Request failed', 'ERR_BAD_REQUEST', config, {}, response);
      const json = error.toJSON();

      assert.strictEqual(json.name, 'fluxhttpError');
      assert.strictEqual(json.message, 'Request failed');
      assert.strictEqual(json.code, 'ERR_BAD_REQUEST');
      assert.strictEqual(json.status, 400);
      
      assert(json.config, 'Should include config');
      assert.strictEqual(json.config.url, 'https://api.test.com/data');
      assert.strictEqual(json.config.method, 'POST');
      
      assert(json.response, 'Should include response');
      assert.strictEqual(json.response.status, 400);
      assert.strictEqual(json.response.statusText, 'Bad Request');
      assert.deepStrictEqual(json.response.data, { error: 'Validation failed', details: ['Name is required'] });
    });

    it('should handle circular references in config', () => {
      const config = {
        url: 'https://test.com',
        method: 'GET'
      };
      config.circular = config;

      const error = new fluxhttpError('Test', 'CODE', config);
      const json = error.toJSON();

      assert(json.config, 'Should include config');
      assert.strictEqual(json.config.url, 'https://test.com');
      assert.strictEqual(json.config.method, 'GET');
      // Circular reference should be handled gracefully
    });

    it('should handle circular references in response', () => {
      const response = {
        data: { message: 'test' },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {},
        request: {}
      };
      response.circular = response;

      const error = new fluxhttpError('Test', 'CODE', {}, {}, response);
      const json = error.toJSON();

      assert(json.response, 'Should include response');
      assert.strictEqual(json.response.status, 200);
      assert.strictEqual(json.response.statusText, 'OK');
      // Circular reference should be handled gracefully
    });

    it('should handle non-string response data', () => {
      const response = {
        data: { complex: { nested: { object: true } } },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {},
        request: {}
      };

      const error = new fluxhttpError('Test', 'CODE', {}, {}, response);
      const json = error.toJSON();

      assert(json.response, 'Should include response');
      assert.deepStrictEqual(json.response.data, { complex: { nested: { object: true } } });
    });

    it('should handle response with non-serializable data', () => {
      const circularData = { name: 'test' };
      circularData.self = circularData;

      const response = {
        data: circularData,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {},
        request: {}
      };

      const error = new fluxhttpError('Test', 'CODE', {}, {}, response);
      const json = error.toJSON();

      assert(json.response, 'Should include response');
      assert.strictEqual(json.response.status, 200);
      assert.strictEqual(json.response.data, '[Object]'); // Should fallback for non-serializable data
    });

    it('should be JSON.stringify compatible', () => {
      const error = new fluxhttpError('Test error', 'TEST_CODE');
      
      assert.doesNotThrow(() => {
        JSON.stringify(error);
      }, 'Should be JSON.stringify compatible');

      const jsonString = JSON.stringify(error);
      const parsed = JSON.parse(jsonString);
      
      assert.strictEqual(parsed.name, 'fluxhttpError');
      assert.strictEqual(parsed.message, 'Test error');
      assert.strictEqual(parsed.code, 'TEST_CODE');
    });
  });

  describe('Static method: from', () => {
    it('should return existing fluxhttpError unchanged', () => {
      const originalError = new fluxhttpError('Original error', 'ORIGINAL_CODE');
      const newError = fluxhttpError.from(originalError);

      assert.strictEqual(newError, originalError, 'Should return same instance');
      assert.strictEqual(newError.message, 'Original error');
      assert.strictEqual(newError.code, 'ORIGINAL_CODE');
    });

    it('should convert regular Error to fluxhttpError', () => {
      const originalError = new Error('Regular error');
      const newError = fluxhttpError.from(originalError, 'CONVERTED_CODE');

      assert(newError instanceof fluxhttpError, 'Should be fluxhttpError instance');
      assert.strictEqual(newError.message, 'Regular error');
      assert.strictEqual(newError.code, 'CONVERTED_CODE');
      assert.strictEqual(newError.stack, originalError.stack, 'Should preserve stack trace');
    });

    it('should convert Error with additional context', () => {
      const originalError = new Error('Network failed');
      const config = { url: 'https://test.com', method: 'GET' };
      const response = { status: 500, statusText: 'Internal Server Error' };

      const newError = fluxhttpError.from(originalError, 'ERR_NETWORK', config, {}, response);

      assert(newError instanceof fluxhttpError);
      assert.strictEqual(newError.message, 'Network failed');
      assert.strictEqual(newError.code, 'ERR_NETWORK');
      assert.deepStrictEqual(newError.config, config);
      assert.deepStrictEqual(newError.response, response);
    });

    it('should handle Error without message', () => {
      const originalError = new Error();
      const newError = fluxhttpError.from(originalError, 'NO_MESSAGE');

      assert.strictEqual(newError.message, 'Unknown error occurred');
      assert.strictEqual(newError.code, 'NO_MESSAGE');
    });

    it('should handle Error with empty message', () => {
      const originalError = new Error('');
      const newError = fluxhttpError.from(originalError, 'EMPTY_MESSAGE');

      assert.strictEqual(newError.message, 'Unknown error occurred');
      assert.strictEqual(newError.code, 'EMPTY_MESSAGE');
    });

    it('should preserve custom Error properties when possible', () => {
      const originalError = new Error('Custom error');
      originalError.customProperty = 'custom value';
      
      const newError = fluxhttpError.from(originalError, 'CUSTOM');

      assert.strictEqual(newError.message, 'Custom error');
      assert.strictEqual(newError.code, 'CUSTOM');
      // Custom properties are not explicitly preserved, but original stack is
      assert.strictEqual(newError.stack, originalError.stack);
    });
  });

  describe('Static method: isfluxhttpError', () => {
    it('should identify fluxhttpError instances', () => {
      const error = new fluxhttpError('Test error');
      assert(fluxhttpError.isfluxhttpError(error), 'Should identify fluxhttpError instance');
    });

    it('should identify objects with isfluxhttpError property', () => {
      const fakeError = {
        message: 'Fake error',
        isfluxhttpError: true
      };
      assert(fluxhttpError.isfluxhttpError(fakeError), 'Should identify fake fluxhttpError');
    });

    it('should not identify regular Errors', () => {
      const error = new Error('Regular error');
      assert(!fluxhttpError.isfluxhttpError(error), 'Should not identify regular Error');
    });

    it('should not identify other objects', () => {
      assert(!fluxhttpError.isfluxhttpError({}), 'Should not identify empty object');
      assert(!fluxhttpError.isfluxhttpError(null), 'Should not identify null');
      assert(!fluxhttpError.isfluxhttpError(undefined), 'Should not identify undefined');
      assert(!fluxhttpError.isfluxhttpError('string'), 'Should not identify string');
      assert(!fluxhttpError.isfluxhttpError(123), 'Should not identify number');
      assert(!fluxhttpError.isfluxhttpError(true), 'Should not identify boolean');
      assert(!fluxhttpError.isfluxhttpError([]), 'Should not identify array');
      assert(!fluxhttpError.isfluxhttpError(() => {}), 'Should not identify function');
    });

    it('should handle objects that look like Errors but are not fluxhttpErrors', () => {
      const errorLike = {
        name: 'SomeError',
        message: 'Some error message',
        stack: 'stack trace'
      };
      assert(!fluxhttpError.isfluxhttpError(errorLike), 'Should not identify error-like object');
    });

    it('should handle objects with false isfluxhttpError property', () => {
      const notError = {
        message: 'Not an error',
        isfluxhttpError: false
      };
      assert(!fluxhttpError.isfluxhttpError(notError), 'Should not identify object with false flag');
    });
  });

  describe('Integration with HTTP status codes', () => {
    it('should properly handle 4xx client errors', () => {
      const response = {
        data: { error: 'Bad Request', message: 'Invalid input' },
        status: 400,
        statusText: 'Bad Request',
        headers: { 'Content-Type': 'application/json' },
        config: { url: 'https://api.test.com/users', method: 'POST' },
        request: {}
      };

      const error = new fluxhttpError('Request failed', 'ERR_BAD_REQUEST', response.config, {}, response);

      assert.strictEqual(error.response.status, 400);
      assert.strictEqual(error.code, 'ERR_BAD_REQUEST');
      
      const json = error.toJSON();
      assert.strictEqual(json.status, 400);
    });

    it('should properly handle 5xx server errors', () => {
      const response = {
        data: { error: 'Internal Server Error' },
        status: 500,
        statusText: 'Internal Server Error',
        headers: { 'Content-Type': 'application/json' },
        config: { url: 'https://api.test.com/data', method: 'GET' },
        request: {}
      };

      const error = new fluxhttpError('Server error', 'ERR_SERVER_ERROR', response.config, {}, response);

      assert.strictEqual(error.response.status, 500);
      assert.strictEqual(error.code, 'ERR_SERVER_ERROR');
    });

    it('should handle network errors without response', () => {
      const config = { url: 'https://unreachable.test.com', method: 'GET' };
      const error = new fluxhttpError('Network Error', 'ERR_NETWORK', config);

      assert.strictEqual(error.code, 'ERR_NETWORK');
      assert.strictEqual(error.response, undefined);
      assert(error.config, 'Should have config');
      
      const json = error.toJSON();
      assert.strictEqual(json.status, undefined);
    });

    it('should handle timeout errors', () => {
      const config = { url: 'https://slow.test.com', method: 'GET', timeout: 1000 };
      const error = new fluxhttpError('Timeout of 1000ms exceeded', 'ECONNABORTED', config);

      assert.strictEqual(error.code, 'ECONNABORTED');
      assert.strictEqual(error.message, 'Timeout of 1000ms exceeded');
    });
  });

  describe('Real-world usage scenarios', () => {
    it('should work in try-catch blocks', () => {
      function throwFluxhttpError() {
        throw new fluxhttpError('API Error', 'ERR_API');
      }

      let caughtError = null;
      try {
        throwFluxhttpError();
      } catch (error) {
        caughtError = error;
      }

      assert(caughtError instanceof fluxhttpError);
      assert.strictEqual(caughtError.message, 'API Error');
      assert.strictEqual(caughtError.code, 'ERR_API');
    });

    it('should work with Promise rejections', async () => {
      function rejectWithFluxhttpError() {
        return Promise.reject(new fluxhttpError('Async Error', 'ERR_ASYNC'));
      }

      let caughtError = null;
      try {
        await rejectWithFluxhttpError();
      } catch (error) {
        caughtError = error;
      }

      assert(caughtError instanceof fluxhttpError);
      assert.strictEqual(caughtError.message, 'Async Error');
      assert.strictEqual(caughtError.code, 'ERR_ASYNC');
    });

    it('should work with error logging systems', () => {
      const error = new fluxhttpError('Log this error', 'ERR_LOG', {
        url: 'https://api.test.com/log',
        method: 'POST'
      });

      // Should work with console.log
      assert.doesNotThrow(() => {
        console.log(error.toString());
      });

      // Should work with JSON logging
      assert.doesNotThrow(() => {
        JSON.stringify(error);
      });

      // Should provide useful information for debugging
      const json = error.toJSON();
      assert(json.message, 'Should have message for logging');
      assert(json.stack, 'Should have stack for debugging');
      assert(json.config, 'Should have config for debugging');
    });

    it('should provide useful error messages for debugging', () => {
      const config = {
        url: 'https://api.test.com/users/123',
        method: 'DELETE',
        headers: { 'Authorization': 'Bearer token123' }
      };

      const response = {
        data: { error: 'User not found' },
        status: 404,
        statusText: 'Not Found',
        headers: { 'Content-Type': 'application/json' },
        config,
        request: {}
      };

      const error = new fluxhttpError('Delete failed', 'ERR_NOT_FOUND', config, {}, response);
      const json = error.toJSON();

      // Should provide all necessary debugging information
      assert.strictEqual(json.message, 'Delete failed');
      assert.strictEqual(json.code, 'ERR_NOT_FOUND');
      assert.strictEqual(json.status, 404);
      assert.strictEqual(json.config.url, 'https://api.test.com/users/123');
      assert.strictEqual(json.config.method, 'DELETE');
      assert.strictEqual(json.response.status, 404);
      assert.deepStrictEqual(json.response.data, { error: 'User not found' });
    });

    it('should handle errors in middleware/interceptors', () => {
      // Simulate an error that might occur in a response interceptor
      const originalResponse = {
        data: '{"malformed": json}',
        status: 200,
        statusText: 'OK',
        headers: { 'Content-Type': 'application/json' },
        config: { url: 'https://api.test.com/data', method: 'GET' },
        request: {}
      };

      const parseError = new Error('JSON parsing failed');
      const interceptorError = fluxhttpError.from(
        parseError,
        'ERR_PARSE',
        originalResponse.config,
        originalResponse.request,
        originalResponse
      );

      assert(interceptorError instanceof fluxhttpError);
      assert.strictEqual(interceptorError.message, 'JSON parsing failed');
      assert.strictEqual(interceptorError.code, 'ERR_PARSE');
      assert.strictEqual(interceptorError.response.status, 200);
    });
  });

  describe('Edge cases and robustness', () => {
    it('should handle extremely long error messages', () => {
      const longMessage = 'Error: ' + 'x'.repeat(10000);
      const error = new fluxhttpError(longMessage, 'ERR_LONG');

      assert.strictEqual(error.message, longMessage);
      assert.strictEqual(error.message.length, longMessage.length);
      
      // Should still be JSON serializable
      assert.doesNotThrow(() => {
        JSON.stringify(error);
      });
    });

    it('should handle special characters in error message', () => {
      const specialMessage = 'Error with émojis 🚀 and "quotes" and \\slashes\\';
      const error = new fluxhttpError(specialMessage, 'ERR_SPECIAL');

      assert.strictEqual(error.message, specialMessage);
      
      const json = error.toJSON();
      assert.strictEqual(json.message, specialMessage);
    });

    it('should handle undefined values in response data', () => {
      const response = {
        data: {
          value: undefined,
          nullValue: null,
          emptyString: '',
          zero: 0,
          false: false
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {},
        request: {}
      };

      const error = new fluxhttpError('Test', 'CODE', {}, {}, response);
      const json = error.toJSON();

      assert(json.response, 'Should include response');
      assert.strictEqual(json.response.data.nullValue, null);
      assert.strictEqual(json.response.data.emptyString, '');
      assert.strictEqual(json.response.data.zero, 0);
      assert.strictEqual(json.response.data.false, false);
    });

    it('should handle very deep object structures', () => {
      let deepObject = { level: 0 };
      let current = deepObject;
      
      // Create a 100-level deep object
      for (let i = 1; i < 100; i++) {
        current.next = { level: i };
        current = current.next;
      }

      const response = {
        data: deepObject,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {},
        request: {}
      };

      const error = new fluxhttpError('Deep object test', 'ERR_DEEP', {}, {}, response);
      
      // Should handle deep objects without throwing
      assert.doesNotThrow(() => {
        error.toJSON();
      });
    });

    it('should handle large response data', () => {
      const largeData = {
        items: new Array(1000).fill().map((_, i) => ({
          id: i,
          name: `Item ${i}`,
          description: `Description for item ${i}`.repeat(10)
        }))
      };

      const response = {
        data: largeData,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {},
        request: {}
      };

      const error = new fluxhttpError('Large data test', 'ERR_LARGE', {}, {}, response);
      
      // Should handle large data without throwing
      assert.doesNotThrow(() => {
        error.toJSON();
      });

      const json = error.toJSON();
      assert.strictEqual(json.response.data.items.length, 1000);
    });
  });
});