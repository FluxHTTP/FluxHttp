import { describe, it, expect, vi, beforeEach } from 'vitest';
import { dispatchRequest } from '../../../src/interceptors/dispatchRequest';
import { InterceptorManager } from '../../../src/interceptors/InterceptorManager';
import type { FluxHTTPRequestConfig, FluxHTTPResponse } from '../../../src/types';

describe('dispatchRequest', () => {
  let requestInterceptors: InterceptorManager<FluxHTTPRequestConfig>;
  let responseInterceptors: InterceptorManager<FluxHTTPResponse>;
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  let mockAdapter: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    requestInterceptors = new InterceptorManager<FluxHTTPRequestConfig>();
    responseInterceptors = new InterceptorManager<FluxHTTPResponse>();
    mockAdapter = vi.fn().mockResolvedValue({
      data: 'test',
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {},
    });
  });

  it('should dispatch request without interceptors', async () => {
    const config: FluxHTTPRequestConfig = { url: '/test', method: 'GET' };

    const response = await dispatchRequest(
      config,
      requestInterceptors,
      responseInterceptors,
      mockAdapter
    );

    expect(mockAdapter).toHaveBeenCalledWith(config);
    expect(response.data).toBe('test');
  });

  it('should execute request interceptors', async () => {
    const config: FluxHTTPRequestConfig = { url: '/test', method: 'GET' };

    requestInterceptors.use((config) => {
      config.headers = { ...config.headers, 'X-Intercepted': 'true' };
      return config;
    });

    await dispatchRequest(config, requestInterceptors, responseInterceptors, mockAdapter);

    expect(mockAdapter).toHaveBeenCalledWith(
      expect.objectContaining({
        headers: { 'X-Intercepted': 'true' },
      })
    );
  });

  it('should execute response interceptors', async () => {
    const config: FluxHTTPRequestConfig = { url: '/test', method: 'GET' };

    responseInterceptors.use((response) => {
      response.data = 'modified';
      return response;
    });

    const response = await dispatchRequest(
      config,
      requestInterceptors,
      responseInterceptors,
      mockAdapter
    );

    expect(response.data).toBe('modified');
  });

  it('should handle request interceptor errors', async () => {
    const config: FluxHTTPRequestConfig = { url: '/test', method: 'GET' };
    const error = new Error('Request interceptor error');

    requestInterceptors.use(
      (config) => config,
      (error) => {
        return Promise.reject(new Error('Handled: ' + error.message));
      }
    );

    requestInterceptors.use(() => {
      throw error;
    });

    await expect(
      dispatchRequest(config, requestInterceptors, responseInterceptors, mockAdapter)
    ).rejects.toThrow('Handled: Request interceptor error');
  });

  it('should handle response interceptor errors', async () => {
    const config: FluxHTTPRequestConfig = { url: '/test', method: 'GET' };
    const error = new Error('Response interceptor error');

    responseInterceptors.use(() => {
      throw error;
    });

    responseInterceptors.use(
      (response) => response,
      (error) => {
        return Promise.reject(new Error('Handled: ' + error.message));
      }
    );

    await expect(
      dispatchRequest(config, requestInterceptors, responseInterceptors, mockAdapter)
    ).rejects.toThrow('Handled: Response interceptor error');
  });

  it('should execute multiple interceptors in correct order', async () => {
    const config: FluxHTTPRequestConfig = { url: '/test', method: 'GET' };
    const order: string[] = [];

    requestInterceptors.use(() => {
      order.push('request1');
      return config;
    });

    requestInterceptors.use(() => {
      order.push('request2');
      return config;
    });

    responseInterceptors.use((response) => {
      order.push('response1');
      return response;
    });

    responseInterceptors.use((response) => {
      order.push('response2');
      return response;
    });

    await dispatchRequest(config, requestInterceptors, responseInterceptors, mockAdapter);

    expect(order).toEqual(['request2', 'request1', 'response1', 'response2']);
  });

  it('should skip interceptors with runWhen returning false', async () => {
    const config: FluxHTTPRequestConfig = { url: '/test', method: 'GET' };
    const interceptorFn = vi.fn((config) => config);

    requestInterceptors.use(interceptorFn, undefined, { runWhen: () => false });

    await dispatchRequest(config, requestInterceptors, responseInterceptors, mockAdapter);

    expect(interceptorFn).not.toHaveBeenCalled();
  });

  it('should execute interceptors with runWhen returning true', async () => {
    const config: FluxHTTPRequestConfig = { url: '/test', method: 'GET' };
    const interceptorFn = vi.fn((config) => config);

    requestInterceptors.use(interceptorFn, undefined, {
      runWhen: (config) => config.method === 'GET',
    });

    await dispatchRequest(config, requestInterceptors, responseInterceptors, mockAdapter);

    expect(interceptorFn).toHaveBeenCalled();
  });

  it('should handle synchronous request interceptors', async () => {
    const config: FluxHTTPRequestConfig = { url: '/test', method: 'GET' };
    const order: string[] = [];

    requestInterceptors.use(
      (config) => {
        order.push('sync1');
        config.headers = { ...config.headers, 'X-Sync1': 'true' };
        return config;
      },
      undefined,
      { synchronous: true }
    );

    requestInterceptors.use(
      (config) => {
        order.push('sync2');
        config.headers = { ...config.headers, 'X-Sync2': 'true' };
        return config;
      },
      undefined,
      { synchronous: true }
    );

    await dispatchRequest(config, requestInterceptors, responseInterceptors, mockAdapter);

    expect(order).toEqual(['sync2', 'sync1']);
    expect(mockAdapter).toHaveBeenCalledWith(
      expect.objectContaining({
        headers: { 'X-Sync1': 'true', 'X-Sync2': 'true' },
      })
    );
  });

  it('should handle mixed synchronous and asynchronous interceptors', async () => {
    const config: FluxHTTPRequestConfig = { url: '/test', method: 'GET' };

    requestInterceptors.use(async (config) => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      config.headers = { ...config.headers, 'X-Async': 'true' };
      return config;
    });

    requestInterceptors.use(
      (config) => {
        config.headers = { ...config.headers, 'X-Sync': 'true' };
        return config;
      },
      undefined,
      { synchronous: true }
    );

    await dispatchRequest(config, requestInterceptors, responseInterceptors, mockAdapter);

    expect(mockAdapter).toHaveBeenCalledWith(
      expect.objectContaining({
        url: '/test',
        method: 'GET',
        headers: { 'X-Sync': 'true', 'X-Async': 'true' },
      })
    );
  });

  it('should handle adapter throwing synchronously', async () => {
    const config: FluxHTTPRequestConfig = { url: '/test', method: 'GET' };
    const error = new Error('Adapter error');

    const throwingAdapter = vi.fn(() => {
      throw error;
    });

    await expect(
      dispatchRequest(config, requestInterceptors, responseInterceptors, throwingAdapter)
    ).rejects.toThrow('Adapter error');
  });

  it('should handle request interceptor rejection without error handler', async () => {
    const config: FluxHTTPRequestConfig = { url: '/test', method: 'GET' };

    requestInterceptors.use(() => {
      throw new Error('Unhandled error');
    });

    await expect(
      dispatchRequest(config, requestInterceptors, responseInterceptors, mockAdapter)
    ).rejects.toThrow('Unhandled error');
  });

  it('should handle synchronous interceptor errors', async () => {
    const config: FluxHTTPRequestConfig = { url: '/test', method: 'GET' };

    requestInterceptors.use(
      () => {
        throw new Error('Sync error');
      },
      (error) => {
        return { ...config, headers: { 'X-Error-Handled': 'true' } };
      },
      { synchronous: true }
    );

    await dispatchRequest(config, requestInterceptors, responseInterceptors, mockAdapter);

    expect(mockAdapter).toHaveBeenCalledWith(
      expect.objectContaining({
        headers: { 'X-Error-Handled': 'true' },
      })
    );
  });

  it('should handle undefined interceptor functions', async () => {
    const config: FluxHTTPRequestConfig = { url: '/test', method: 'GET' };

    requestInterceptors.use(undefined, undefined);
    responseInterceptors.use(undefined, undefined);

    const response = await dispatchRequest(
      config,
      requestInterceptors,
      responseInterceptors,
      mockAdapter
    );

    expect(response.data).toBe('test');
  });

  it('should allow async transformations in request interceptors', async () => {
    const config: FluxHTTPRequestConfig = { url: '/test', method: 'GET' };

    requestInterceptors.use(async (config) => {
      const token = await Promise.resolve('async-token');
      config.headers = { ...config.headers, Authorization: `Bearer ${token}` };
      return config;
    });

    await dispatchRequest(config, requestInterceptors, responseInterceptors, mockAdapter);

    expect(mockAdapter).toHaveBeenCalledWith(
      expect.objectContaining({
        url: '/test',
        method: 'GET',
        headers: { Authorization: 'Bearer async-token' },
      })
    );
  });
});
