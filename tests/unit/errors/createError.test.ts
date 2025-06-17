import { describe, it, expect } from 'vitest';
import {
  createError,
  createRequestError,
  createResponseError,
  createTimeoutError,
  createNetworkError,
  createCancelError
} from '../../../src/errors/createError';
import { FluxHTTPError } from '../../../src/errors/FluxHTTPError';
import type { FluxHTTPRequestConfig, FluxHTTPResponse } from '../../../src/types';

describe('createError functions', () => {
  describe('createError', () => {
    it('should create basic error with message only', () => {
      const error = createError('Basic error');
      
      expect(error).toBeInstanceOf(FluxHTTPError);
      expect(error.message).toBe('Basic error');
      expect(error.code).toBeUndefined();
      expect(error.config).toBeUndefined();
      expect(error.request).toBeUndefined();
      expect(error.response).toBeUndefined();
    });

    it('should create error with all parameters', () => {
      const config: FluxHTTPRequestConfig = {
        url: 'https://fluxhttp.com/api/test',
        method: 'GET'
      };
      const request = { id: 'req-123' };
      const response: FluxHTTPResponse = {
        data: null,
        status: 404,
        statusText: 'Not Found',
        headers: {},
        config
      };
      
      const error = createError(
        'Not found',
        config,
        'ERR_NOT_FOUND',
        request,
        response
      );
      
      expect(error.message).toBe('Not found');
      expect(error.config).toBe(config);
      expect(error.code).toBe('ERR_NOT_FOUND');
      expect(error.request).toBe(request);
      expect(error.response).toBe(response);
    });
  });

  describe('createRequestError', () => {
    it('should create request error with default code', () => {
      const config: FluxHTTPRequestConfig = {
        url: 'https://fluxhttp.com/api/data',
        method: 'POST'
      };
      
      const error = createRequestError('Request failed', config);
      
      expect(error).toBeInstanceOf(FluxHTTPError);
      expect(error.message).toBe('Request failed');
      expect(error.config).toBe(config);
      expect(error.code).toBe('ERR_REQUEST');
    });

    it('should create request error with custom code', () => {
      const config: FluxHTTPRequestConfig = {
        url: 'https://fluxhttp.com/api/upload',
        method: 'PUT'
      };
      const request = { headers: {} };
      
      const error = createRequestError(
        'Upload failed',
        config,
        'ERR_UPLOAD',
        request
      );
      
      expect(error.code).toBe('ERR_UPLOAD');
      expect(error.request).toBe(request);
    });

    it('should handle undefined code with fallback', () => {
      const config: FluxHTTPRequestConfig = { url: '/test' };
      
      const error = createRequestError(
        'Test error',
        config,
        undefined,
        undefined
      );
      
      expect(error.code).toBe('ERR_REQUEST');
    });
  });

  describe('createResponseError', () => {
    it('should create server error for 5xx status', () => {
      const config: FluxHTTPRequestConfig = {
        url: 'https://fluxhttp.com/api/server',
        method: 'GET'
      };
      const response: FluxHTTPResponse = {
        data: 'Internal Server Error',
        status: 500,
        statusText: 'Internal Server Error',
        headers: {},
        config
      };
      
      const error = createResponseError(
        'Server error occurred',
        config,
        response
      );
      
      expect(error.code).toBe('ERR_SERVER');
      expect(error.response).toBe(response);
    });

    it('should create client error for 4xx status', () => {
      const config: FluxHTTPRequestConfig = {
        url: 'https://fluxhttp.com/api/auth',
        method: 'POST'
      };
      const response: FluxHTTPResponse = {
        data: { error: 'Unauthorized' },
        status: 401,
        statusText: 'Unauthorized',
        headers: {},
        config
      };
      const request = { auth: false };
      
      const error = createResponseError(
        'Authentication required',
        config,
        response,
        request
      );
      
      expect(error.code).toBe('ERR_CLIENT');
      expect(error.request).toBe(request);
    });

    it('should create response error for other status codes', () => {
      const config: FluxHTTPRequestConfig = {
        url: 'https://fluxhttp.com/api/redirect',
        method: 'GET'
      };
      const response: FluxHTTPResponse = {
        data: null,
        status: 301,
        statusText: 'Moved Permanently',
        headers: { location: 'https://fluxhttp.com/new-location' },
        config
      };
      
      const error = createResponseError(
        'Unexpected redirect',
        config,
        response
      );
      
      expect(error.code).toBe('ERR_RESPONSE');
    });

    it('should handle edge case status codes', () => {
      const config: FluxHTTPRequestConfig = { url: '/test' };
      
      // Exactly 500
      let response: FluxHTTPResponse = {
        data: null,
        status: 500,
        statusText: '',
        headers: {},
        config
      };
      let error = createResponseError('Error', config, response);
      expect(error.code).toBe('ERR_SERVER');
      
      // Exactly 400
      response = { ...response, status: 400 };
      error = createResponseError('Error', config, response);
      expect(error.code).toBe('ERR_CLIENT');
      
      // Below 400
      response = { ...response, status: 399 };
      error = createResponseError('Error', config, response);
      expect(error.code).toBe('ERR_RESPONSE');
    });
  });

  describe('createTimeoutError', () => {
    it('should create timeout error with specific timeout value', () => {
      const config: FluxHTTPRequestConfig = {
        url: 'https://fluxhttp.com/api/slow',
        method: 'GET',
        timeout: 5000
      };
      const request = { id: 'timeout-req' };
      
      const error = createTimeoutError(config, request);
      
      expect(error.message).toBe('Request timeout of 5000ms exceeded');
      expect(error.code).toBe('ETIMEDOUT');
      expect(error.config).toBe(config);
      expect(error.request).toBe(request);
    });

    it('should create timeout error without specific timeout value', () => {
      const config: FluxHTTPRequestConfig = {
        url: 'https://fluxhttp.com/api/slow',
        method: 'POST'
      };
      
      const error = createTimeoutError(config);
      
      expect(error.message).toBe('Request timeout exceeded');
      expect(error.code).toBe('ETIMEDOUT');
      expect(error.request).toBeUndefined();
    });

    it('should handle timeout value of 0', () => {
      const config: FluxHTTPRequestConfig = {
        url: '/test',
        timeout: 0
      };
      
      const error = createTimeoutError(config);
      
      expect(error.message).toBe('Request timeout exceeded');
    });
  });

  describe('createNetworkError', () => {
    it('should create network error', () => {
      const config: FluxHTTPRequestConfig = {
        url: 'https://fluxhttp.com/api/unreachable',
        method: 'GET'
      };
      const request = { aborted: true };
      
      const error = createNetworkError(
        'Network connection failed',
        config,
        request
      );
      
      expect(error.message).toBe('Network connection failed');
      expect(error.code).toBe('ERR_NETWORK');
      expect(error.config).toBe(config);
      expect(error.request).toBe(request);
    });

    it('should create network error without request', () => {
      const config: FluxHTTPRequestConfig = {
        url: 'https://fluxhttp.com/api/test'
      };
      
      const error = createNetworkError(
        'DNS lookup failed',
        config
      );
      
      expect(error.message).toBe('DNS lookup failed');
      expect(error.request).toBeUndefined();
    });
  });

  describe('createCancelError', () => {
    it('should create cancel error with default message', () => {
      const error = createCancelError();
      
      expect(error.message).toBe('Request canceled');
      expect(error.code).toBe('ERR_CANCELED');
      expect(error.config).toBeUndefined();
    });

    it('should create cancel error with custom message', () => {
      const config: FluxHTTPRequestConfig = {
        url: 'https://fluxhttp.com/api/long-running',
        method: 'POST'
      };
      
      const error = createCancelError('User canceled the request', config);
      
      expect(error.message).toBe('User canceled the request');
      expect(error.code).toBe('ERR_CANCELED');
      expect(error.config).toBe(config);
    });

    it('should create cancel error with empty message', () => {
      const error = createCancelError('');
      
      expect(error.message).toBe('');
      expect(error.code).toBe('ERR_CANCELED');
    });
  });
});