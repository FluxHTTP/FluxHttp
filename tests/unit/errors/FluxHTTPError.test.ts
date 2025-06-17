import { describe, it, expect, vi } from 'vitest';
import { FluxHTTPError } from '../../../src/errors/FluxHTTPError';
import type { FluxHTTPRequestConfig, FluxHTTPResponse } from '../../../src/types';

describe('FluxHTTPError', () => {
  describe('constructor', () => {
    it('should create error with message only', () => {
      const error = new FluxHTTPError('Test error');
      
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(FluxHTTPError);
      expect(error.message).toBe('Test error');
      expect(error.name).toBe('FluxHTTPError');
      expect(error.isFluxHTTPError).toBe(true);
      expect(error.code).toBeUndefined();
      expect(error.config).toBeUndefined();
      expect(error.request).toBeUndefined();
      expect(error.response).toBeUndefined();
    });

    it('should create error with all properties', () => {
      const config: FluxHTTPRequestConfig = {
        url: 'https://fluxhttp.com/api/test',
        method: 'GET'
      };
      const request = { test: 'request' };
      const response: FluxHTTPResponse = {
        data: 'test',
        status: 404,
        statusText: 'Not Found',
        headers: {},
        config
      };
      
      const error = new FluxHTTPError(
        'Not found',
        'ERR_NOT_FOUND',
        config,
        request,
        response
      );
      
      expect(error.message).toBe('Not found');
      expect(error.code).toBe('ERR_NOT_FOUND');
      expect(error.config).toBe(config);
      expect(error.request).toBe(request);
      expect(error.response).toBe(response);
    });

    it('should capture stack trace if available', () => {
      const captureStackTrace = vi.spyOn(Error, 'captureStackTrace');
      
      const error = new FluxHTTPError('Test error');
      
      if (Error.captureStackTrace) {
        expect(captureStackTrace).toHaveBeenCalledWith(error, FluxHTTPError);
      }
      
      captureStackTrace.mockRestore();
    });

    it('should work when captureStackTrace is not available', () => {
      const originalCaptureStackTrace = Error.captureStackTrace;
      (Error as any).captureStackTrace = undefined;
      
      const error = new FluxHTTPError('Test error');
      
      expect(error).toBeInstanceOf(FluxHTTPError);
      expect(error.stack).toBeDefined();
      
      Error.captureStackTrace = originalCaptureStackTrace;
    });
  });

  describe('toJSON', () => {
    it('should serialize error to JSON', () => {
      const config: FluxHTTPRequestConfig = {
        url: 'https://fluxhttp.com/api/test',
        method: 'POST'
      };
      const response: FluxHTTPResponse = {
        data: null,
        status: 500,
        statusText: 'Internal Server Error',
        headers: {},
        config
      };
      
      const error = new FluxHTTPError(
        'Server error',
        'ERR_SERVER',
        config,
        undefined,
        response
      );
      
      const json = error.toJSON();
      
      expect(json).toEqual({
        name: 'FluxHTTPError',
        message: 'Server error',
        stack: error.stack,
        config,
        code: 'ERR_SERVER',
        status: 500
      });
    });

    it('should handle missing response', () => {
      const error = new FluxHTTPError('Network error', 'ERR_NETWORK');
      const json = error.toJSON();
      
      expect(json.status).toBeUndefined();
      expect(json.code).toBe('ERR_NETWORK');
    });
  });

  describe('from', () => {
    it('should return the same FluxHTTPError instance', () => {
      const originalError = new FluxHTTPError('Original error', 'ERR_ORIGINAL');
      const result = FluxHTTPError.from(originalError);
      
      expect(result).toBe(originalError);
    });

    it('should create FluxHTTPError from regular Error', () => {
      const regularError = new Error('Regular error');
      const config: FluxHTTPRequestConfig = { url: '/test', method: 'GET' };
      
      const result = FluxHTTPError.from(
        regularError,
        'ERR_CONVERTED',
        config
      );
      
      expect(result).toBeInstanceOf(FluxHTTPError);
      expect(result.message).toBe('Regular error');
      expect(result.code).toBe('ERR_CONVERTED');
      expect(result.config).toBe(config);
      expect(result.stack).toBe(regularError.stack);
    });

    it('should handle Error without message', () => {
      const errorWithoutMessage = new Error();
      errorWithoutMessage.message = '';
      
      const result = FluxHTTPError.from(errorWithoutMessage, 'ERR_NO_MSG');
      
      expect(result.message).toBe('Unknown error occurred');
    });

    it('should create FluxHTTPError with all parameters', () => {
      const error = new Error('Test error');
      const config: FluxHTTPRequestConfig = { url: '/api', method: 'POST' };
      const request = { test: true };
      const response: FluxHTTPResponse = {
        data: null,
        status: 400,
        statusText: 'Bad Request',
        headers: {},
        config
      };
      
      const result = FluxHTTPError.from(
        error,
        'ERR_BAD_REQUEST',
        config,
        request,
        response
      );
      
      expect(result.message).toBe('Test error');
      expect(result.code).toBe('ERR_BAD_REQUEST');
      expect(result.config).toBe(config);
      expect(result.request).toBe(request);
      expect(result.response).toBe(response);
      expect(result.stack).toBe(error.stack);
    });
  });

  describe('isFluxHTTPError', () => {
    it('should return true for FluxHTTPError instance', () => {
      const error = new FluxHTTPError('Test');
      expect(FluxHTTPError.isFluxHTTPError(error)).toBe(true);
    });

    it('should return false for regular Error', () => {
      const error = new Error('Test');
      expect(FluxHTTPError.isFluxHTTPError(error)).toBe(false);
    });

    it('should return true for object with isFluxHTTPError property', () => {
      const errorLike = {
        isFluxHTTPError: true,
        message: 'Test',
        name: 'FluxHTTPError'
      };
      expect(FluxHTTPError.isFluxHTTPError(errorLike)).toBe(true);
    });

    it('should return false for null', () => {
      expect(FluxHTTPError.isFluxHTTPError(null)).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(FluxHTTPError.isFluxHTTPError(undefined)).toBe(false);
    });

    it('should return false for non-object values', () => {
      expect(FluxHTTPError.isFluxHTTPError('string')).toBe(false);
      expect(FluxHTTPError.isFluxHTTPError(123)).toBe(false);
      expect(FluxHTTPError.isFluxHTTPError(true)).toBe(false);
    });

    it('should return false for objects without isFluxHTTPError property', () => {
      expect(FluxHTTPError.isFluxHTTPError({})).toBe(false);
      expect(FluxHTTPError.isFluxHTTPError({ error: true })).toBe(false);
    });
  });
});