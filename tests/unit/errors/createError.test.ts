import { describe, it } from 'node:test';
import assert from 'node:assert';
import { fluxhttpError } from '../../../dist/index.js';
const {
  createError,
  createRequestError,
  createResponseError,
  createTimeoutError,
  createNetworkError,
  createCancelError,
} = require('../../../dist/errors/createError.js');

describe('createError functions', () => {
  describe('createError', () => {
    it('should create basic error', (): void => {
      const error = createError('Test error');

      assert(error instanceof fluxhttpError);
      assert.strictEqual(error.message, 'Test error');
      assert.strictEqual(error.code, undefined);
    });

    it('should create error with all properties', (): void => {
      const config = { url: '/test', method: 'GET' };
      const request = { test: 'request' };
      const response = {
        data: {},
        status: 404,
        statusText: 'Not Found',
        headers: {},
        config,
        request,
      };

      const error = createError('Not found', 'ERR_NOT_FOUND', config, request, response);

      assert.strictEqual(error.message, 'Not found');
      assert.strictEqual(error.code, 'ERR_NOT_FOUND');
      assert.strictEqual(error.config, config);
      assert.strictEqual(error.request, request);
      assert.strictEqual(error.response, response);
    });

    it('should handle undefined parameters', (): void => {
      const error = createError('Test error', undefined, undefined, undefined, undefined);

      assert(error instanceof fluxhttpError);
      assert.strictEqual(error.message, 'Test error');
    });
  });

  describe('createRequestError', () => {
    it('should create request error with default code', (): void => {
      const config = { url: '/test', method: 'POST' };
      const error = createRequestError('Request failed', config);

      assert(error instanceof fluxhttpError);
      assert.strictEqual(error.message, 'Request failed');
      assert.strictEqual(error.code, 'ERR_REQUEST');
      assert.strictEqual(error.config, config);
    });

    it('should create request error with custom code', (): void => {
      const config = { url: '/test' };
      const request = { aborted: true };
      const error = createRequestError('Request aborted', config, 'ERR_ABORTED', request);

      assert.strictEqual(error.code, 'ERR_ABORTED');
      assert.strictEqual(error.request, request);
    });

    it('should include config in request error', (): void => {
      const config = {
        url: '/api/data',
        method: 'GET',
        headers: { 'X-Custom': 'header' },
      };

      const error = createRequestError('Network error', config);

      assert.strictEqual(error.config, config);
      assert.strictEqual(error.config.url, '/api/data');
      assert.strictEqual(error.config.method, 'GET');
    });
  });

  describe('createResponseError', () => {
    it('should create server error for 5xx status', (): void => {
      const config = { url: '/test' };
      const response = {
        data: { error: 'Internal error' },
        status: 500,
        statusText: 'Internal Server Error',
        headers: {},
        config,
        request: {},
      };

      const error = createResponseError('Server error', config, response);

      assert.strictEqual(error.message, 'Server error');
      assert.strictEqual(error.code, 'ERR_SERVER');
      assert.strictEqual(error.response, response);
    });

    it('should create client error for 4xx status', (): void => {
      const config = { url: '/test' };
      const response = {
        data: { error: 'Not found' },
        status: 404,
        statusText: 'Not Found',
        headers: {},
        config,
        request: {},
      };

      const error = createResponseError('Not found', config, response);

      assert.strictEqual(error.code, 'ERR_CLIENT');
    });

    it('should create generic response error for other statuses', (): void => {
      const config = { url: '/test' };
      const response = {
        data: {},
        status: 301,
        statusText: 'Moved Permanently',
        headers: {},
        config,
        request: {},
      };

      const error = createResponseError('Redirect', config, response);

      assert.strictEqual(error.code, 'ERR_RESPONSE');
    });

    it('should include request object when provided', (): void => {
      const config = { url: '/test' };
      const request = { method: 'GET' };
      const response = {
        data: {},
        status: 400,
        statusText: 'Bad Request',
        headers: {},
        config,
        request,
      };

      const error = createResponseError('Bad request', config, response, request);

      assert.strictEqual(error.request, request);
    });

    it('should handle edge status codes', (): void => {
      const config = { url: '/test' };

      // Test 399 (not client error)
      let response = { status: 399, config };
      let error = createResponseError('Test', config, response);
      assert.strictEqual(error.code, 'ERR_RESPONSE');

      // Test 400 (client error)
      response = { status: 400, config };
      error = createResponseError('Test', config, response);
      assert.strictEqual(error.code, 'ERR_CLIENT');

      // Test 499 (client error)
      response = { status: 499, config };
      error = createResponseError('Test', config, response);
      assert.strictEqual(error.code, 'ERR_CLIENT');

      // Test 500 (server error)
      response = { status: 500, config };
      error = createResponseError('Test', config, response);
      assert.strictEqual(error.code, 'ERR_SERVER');
    });
  });

  describe('createTimeoutError', () => {
    it('should create timeout error with specific timeout', (): void => {
      const config = { url: '/test', timeout: 5000 };
      const error = createTimeoutError(config);

      assert(error instanceof fluxhttpError);
      assert.strictEqual(error.message, 'Request timeout of 5000ms exceeded');
      assert.strictEqual(error.code, 'ETIMEDOUT');
      assert.strictEqual(error.config, config);
    });

    it('should create timeout error without specific timeout', (): void => {
      const config = { url: '/test' };
      const error = createTimeoutError(config);

      assert.strictEqual(error.message, 'Request timeout exceeded');
      assert.strictEqual(error.code, 'ETIMEDOUT');
    });

    it('should handle zero timeout', (): void => {
      const config = { url: '/test', timeout: 0 };
      const error = createTimeoutError(config);

      assert.strictEqual(error.message, 'Request timeout exceeded');
    });

    it('should include request object when provided', (): void => {
      const config = { url: '/test', timeout: 3000 };
      const request = { aborted: true };
      const error = createTimeoutError(config, request);

      assert.strictEqual(error.request, request);
      assert.strictEqual(error.message, 'Request timeout of 3000ms exceeded');
    });
  });

  describe('createNetworkError', () => {
    it('should create network error', (): void => {
      const config = { url: '/test' };
      const error = createNetworkError('Connection refused', config);

      assert(error instanceof fluxhttpError);
      assert.strictEqual(error.message, 'Connection refused');
      assert.strictEqual(error.code, 'ERR_NETWORK');
      assert.strictEqual(error.config, config);
    });

    it('should include request object when provided', (): void => {
      const config = { url: '/test' };
      const request = { socket: null };
      const error = createNetworkError('Network unreachable', config, request);

      assert.strictEqual(error.request, request);
    });

    it('should handle various network error messages', (): void => {
      const config = { url: '/test' };

      const errors = ['ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT', 'ECONNRESET', 'ENETUNREACH'];

      errors.forEach((_message) => {
        const error = createNetworkError(message, config);
        assert.strictEqual(error.message, message);
        assert.strictEqual(error.code, 'ERR_NETWORK');
      });
    });
  });

  describe('createCancelError', () => {
    it('should create cancel error with default message', (): void => {
      const error = createCancelError();

      assert(error instanceof fluxhttpError);
      assert.strictEqual(error.message, 'Request canceled');
      assert.strictEqual(error.code, 'ERR_CANCELED');
    });

    it('should create cancel error with custom message', (): void => {
      const error = createCancelError('User canceled the request');

      assert.strictEqual(error.message, 'User canceled the request');
      assert.strictEqual(error.code, 'ERR_CANCELED');
    });

    it('should include config when provided', (): void => {
      const config = { url: '/test', method: 'GET' };
      const error = createCancelError('Canceled by user', config);

      assert.strictEqual(error.config, config);
    });

    it('should handle empty string message', (): void => {
      const error = createCancelError('');

      assert.strictEqual(error.message, '');
      assert.strictEqual(error.code, 'ERR_CANCELED');
    });
  });

  describe('Error factory consistency', () => {
    it('should all create fluxhttpError instances', (): void => {
      const errors = [
        createError('Test'),
        createRequestError('Test', {}),
        createResponseError('Test', {}, { status: 404 }),
        createTimeoutError({}),
        createNetworkError('Test', {}),
        createCancelError(),
      ];

      errors.forEach((_error) => {
        assert(error instanceof fluxhttpError);
        assert(error.isfluxhttpError);
      });
    });

    it('should all have proper error codes', (): void => {
      const config = { url: '/test' };
      const response = { status: 500 };

      const errorCodes = {
        request: createRequestError('Test', config).code,
        serverResponse: createResponseError('Test', config, { ...response, status: 500 }).code,
        clientResponse: createResponseError('Test', config, { ...response, status: 404 }).code,
        timeout: createTimeoutError(config).code,
        network: createNetworkError('Test', config).code,
        cancel: createCancelError().code,
      };

      assert.strictEqual(errorCodes.request, 'ERR_REQUEST');
      assert.strictEqual(errorCodes.serverResponse, 'ERR_SERVER');
      assert.strictEqual(errorCodes.clientResponse, 'ERR_CLIENT');
      assert.strictEqual(errorCodes.timeout, 'ETIMEDOUT');
      assert.strictEqual(errorCodes.network, 'ERR_NETWORK');
      assert.strictEqual(errorCodes.cancel, 'ERR_CANCELED');
    });
  });

  describe('Edge cases', () => {
    it('should handle very long error messages', (): void => {
      const longMessage = 'Error: ' + 'A'.repeat(10000);
      const config = { url: '/test' };

      const errors = [
        createError(longMessage),
        createRequestError(longMessage, config),
        createNetworkError(longMessage, config),
        createCancelError(longMessage),
      ];

      errors.forEach((_error) => {
        assert.strictEqual(error.message, longMessage);
      });
    });

    it('should handle special characters in messages', (): void => {
      const specialMessage = 'Error: "test" with \'quotes\' and \n\t special chars';
      const config = { url: '/test' };

      const error = createError(specialMessage, 'TEST', config);
      assert.strictEqual(error.message, specialMessage);
    });

    it('should handle complex config objects', (): void => {
      const complexConfig = {
        url: '/test',
        method: 'POST',
        data: { nested: { deep: { value: 'test' } } },
        headers: { 'X-Array': ['value1', 'value2'] },
        params: new URLSearchParams({ key: 'value' }),
        customProp: Symbol('custom'),
      };

      const error = createRequestError('Complex config', complexConfig);
      assert.strictEqual(error.config, complexConfig);
    });

    it('should handle null and undefined in various positions', (): void => {
      // Null config
      const error1 = createRequestError('Test', null);
      assert.strictEqual(error1.config, null);

      // Undefined response data
      const error2 = createResponseError('Test', {}, { data: undefined, status: 404 });
      assert.strictEqual(error2.response.data, undefined);

      // Null request
      const error3 = createTimeoutError({}, null);
      assert.strictEqual(error3.request, null);
    });
  });
});
