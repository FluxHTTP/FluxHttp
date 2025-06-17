import { describe, it, expect, vi, beforeEach } from 'vitest';
import { dispatchRequest } from '../../../src/interceptors/dispatchRequest';
import { InterceptorManager } from '../../../src/interceptors/InterceptorManager';
import type { FluxHTTPRequestConfig, FluxHTTPResponse } from '../../../src/types';

describe('dispatchRequest - additional coverage', () => {
  let requestInterceptors: InterceptorManager<FluxHTTPRequestConfig>;
  let responseInterceptors: InterceptorManager<FluxHTTPResponse>;
  let mockAdapter: vi.Mock;

  beforeEach(() => {
    requestInterceptors = new InterceptorManager<FluxHTTPRequestConfig>();
    responseInterceptors = new InterceptorManager<FluxHTTPResponse>();
    mockAdapter = vi.fn().mockResolvedValue({
      data: 'test',
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {}
    });
  });

  describe('synchronous request interceptors edge cases', () => {
    it('should handle when onFulfilled is null/undefined', async () => {
      const modifiedConfig = { url: '/modified' };
      
      // Add interceptor with undefined onFulfilled
      requestInterceptors.use(
        undefined,
        (error) => {
          throw error;
        },
        { synchronous: true }
      );

      const config: FluxHTTPRequestConfig = {
        url: '/test',
        method: 'GET'
      };

      const response = await dispatchRequest(
        config,
        requestInterceptors,
        responseInterceptors,
        mockAdapter
      );

      // Should pass through unchanged
      expect(mockAdapter).toHaveBeenCalledWith(
        expect.objectContaining({ url: '/test' })
      );
    });

    it('should handle error in synchronous interceptor without onRejected', async () => {
      // Add synchronous interceptor that throws without error handler
      requestInterceptors.use(
        () => {
          throw new Error('Interceptor error');
        },
        undefined, // No error handler
        { synchronous: true }
      );

      const config: FluxHTTPRequestConfig = {
        url: '/test',
        method: 'GET'
      };

      await expect(
        dispatchRequest(
          config,
          requestInterceptors,
          responseInterceptors,
          mockAdapter
        )
      ).rejects.toThrow('Interceptor error');
    });

    it('should recover from error with onRejected handler', async () => {
      const recoveredConfig = { url: '/recovered', method: 'POST' };
      
      // Add synchronous interceptor that throws but has error handler
      requestInterceptors.use(
        () => {
          throw new Error('Will be caught');
        },
        (error) => {
          // Recover with new config
          return recoveredConfig;
        },
        { synchronous: true }
      );

      const config: FluxHTTPRequestConfig = {
        url: '/test',
        method: 'GET'
      };

      const response = await dispatchRequest(
        config,
        requestInterceptors,
        responseInterceptors,
        mockAdapter
      );

      expect(mockAdapter).toHaveBeenCalledWith(recoveredConfig);
    });
  });

  describe('mixed synchronous and asynchronous interceptors', () => {
    it('should handle synchronous interceptors with runWhen returning false', async () => {
      const syncInterceptor = vi.fn();
      
      requestInterceptors.use(
        syncInterceptor,
        undefined,
        {
          synchronous: true,
          runWhen: (config) => config.method === 'POST' // Will be false
        }
      );

      const config: FluxHTTPRequestConfig = {
        url: '/test',
        method: 'GET'
      };

      await dispatchRequest(
        config,
        requestInterceptors,
        responseInterceptors,
        mockAdapter
      );

      expect(syncInterceptor).not.toHaveBeenCalled();
    });

    it('should maintain config through multiple synchronous interceptors', async () => {
      // First interceptor adds header
      requestInterceptors.use(
        (config) => ({
          ...config,
          headers: { ...config.headers, 'X-First': 'true' }
        }),
        undefined,
        { synchronous: true }
      );

      // Second interceptor adds another header
      requestInterceptors.use(
        (config) => ({
          ...config,
          headers: { ...config.headers, 'X-Second': 'true' }
        }),
        undefined,
        { synchronous: true }
      );

      const config: FluxHTTPRequestConfig = {
        url: '/test',
        method: 'GET',
        headers: { 'X-Original': 'true' }
      };

      await dispatchRequest(
        config,
        requestInterceptors,
        responseInterceptors,
        mockAdapter
      );

      expect(mockAdapter).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: {
            'X-Original': 'true',
            'X-First': 'true',
            'X-Second': 'true'
          }
        })
      );
    });
  });
});