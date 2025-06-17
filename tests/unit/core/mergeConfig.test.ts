import { describe, it, expect } from 'vitest';
import { mergeConfig } from '../../../src/core/mergeConfig';
import type { FluxHTTPRequestConfig } from '../../../src/types';

describe('mergeConfig', () => {
  it('should merge configs with replace strategy', () => {
    const config1: FluxHTTPRequestConfig = {
      url: '/old',
      method: 'GET',
      timeout: 5000,
    };

    const config2: FluxHTTPRequestConfig = {
      url: '/new',
      method: 'POST',
      timeout: 10000,
    };

    const merged = mergeConfig(config1, config2);

    expect(merged).toEqual({
      url: '/new',
      method: 'POST',
      timeout: 10000,
    });
  });

  it('should merge headers', () => {
    const config1: FluxHTTPRequestConfig = {
      headers: {
        'X-Common': 'value1',
        'X-Override': 'old',
      },
    };

    const config2: FluxHTTPRequestConfig = {
      headers: {
        'X-Override': 'new',
        'X-New': 'value2',
      },
    };

    const merged = mergeConfig(config1, config2);

    expect(merged.headers).toEqual({
      'x-common': 'value1',
      'x-override': 'new',
      'x-new': 'value2',
    });
  });

  it('should merge retry config', () => {
    const config1: FluxHTTPRequestConfig = {
      retry: {
        attempts: 3,
        delay: 1000,
      },
    };

    const config2: FluxHTTPRequestConfig = {
      retry: {
        delay: 2000,
        backoff: 'exponential',
      },
    };

    const merged = mergeConfig(config1, config2);

    expect(merged.retry).toEqual({
      attempts: 3,
      delay: 2000,
      backoff: 'exponential',
    });
  });

  it('should merge cache config', () => {
    const config1: FluxHTTPRequestConfig = {
      cache: {
        enabled: true,
        ttl: 300000,
      },
    };

    const config2: FluxHTTPRequestConfig = {
      cache: {
        ttl: 600000,
        storage: 'memory',
      },
    };

    const merged = mergeConfig(config1, config2);

    expect(merged.cache).toEqual({
      enabled: true,
      ttl: 600000,
      storage: 'memory',
    });
  });

  it('should handle undefined values in config2', () => {
    const config1: FluxHTTPRequestConfig = {
      url: '/test',
      method: 'GET',
      timeout: 5000,
    };

    const config2: FluxHTTPRequestConfig = {
      url: undefined,
      timeout: undefined,
    };

    const merged = mergeConfig(config1, config2);

    expect(merged).toEqual({
      url: '/test',
      method: 'GET',
      timeout: 5000,
    });
  });

  it('should handle undefined configs', () => {
    const config: FluxHTTPRequestConfig = { url: '/test' };

    expect(mergeConfig(undefined, config)).toEqual({ url: '/test' });
    expect(mergeConfig(config, undefined)).toEqual({ url: '/test' });
    expect(mergeConfig(undefined, undefined)).toEqual({});
  });

  it('should handle empty configs', () => {
    const config: FluxHTTPRequestConfig = { url: '/test' };

    expect(mergeConfig({}, config)).toEqual({ url: '/test' });
    expect(mergeConfig(config, {})).toEqual({ url: '/test' });
    expect(mergeConfig({}, {})).toEqual({});
  });

  it('should not modify original configs', () => {
    const config1: FluxHTTPRequestConfig = {
      headers: { 'X-Original': 'value' },
    };

    const config2: FluxHTTPRequestConfig = {
      headers: { 'X-New': 'value' },
    };

    const merged = mergeConfig(config1, config2);

    expect(config1.headers).toEqual({ 'X-Original': 'value' });
    expect(config2.headers).toEqual({ 'X-New': 'value' });
    expect(merged.headers).toEqual({
      'x-original': 'value',
      'x-new': 'value',
    });
  });

  it('should handle all config properties', () => {
    const config1: FluxHTTPRequestConfig = {
      url: '/api/v1',
      method: 'GET',
      baseURL: 'https://api1.example.com',
      headers: { 'X-API': 'v1' },
      params: { version: 1 },
      data: { old: 'data' },
      timeout: 5000,
      withCredentials: false,
      auth: { username: 'user1', password: 'pass1' },
      responseType: 'json',
      responseEncoding: 'utf8',
      validateStatus: (status) => status < 400,
      maxRedirects: 5,
      maxContentLength: 1000,
      maxBodyLength: 2000,
      decompress: true,
      signal: new AbortController().signal,
      onUploadProgress: () => {},
      onDownloadProgress: () => {},
      retry: { attempts: 3 },
      cache: { enabled: true },
    };

    const config2: FluxHTTPRequestConfig = {
      url: '/api/v2',
      method: 'POST',
      baseURL: 'https://api2.example.com',
      headers: { 'X-API': 'v2' },
      params: { version: 2 },
      data: { new: 'data' },
      timeout: 10000,
      withCredentials: true,
      auth: { username: 'user2', password: 'pass2' },
      responseType: 'blob',
      responseEncoding: 'utf16',
      validateStatus: (status) => status < 500,
      maxRedirects: 10,
      maxContentLength: 2000,
      maxBodyLength: 4000,
      decompress: false,
      signal: new AbortController().signal,
      onUploadProgress: () => {},
      onDownloadProgress: () => {},
      retry: { delay: 1000 },
      cache: { ttl: 300000 },
    };

    const merged = mergeConfig(config1, config2);

    expect(merged.url).toBe('/api/v2');
    expect(merged.method).toBe('POST');
    expect(merged.baseURL).toBe('https://api2.example.com');
    expect(merged.headers).toEqual({ 'x-api': 'v2' });
    expect(merged.params).toEqual({ version: 2 });
    expect(merged.data).toEqual({ new: 'data' });
    expect(merged.timeout).toBe(10000);
    expect(merged.withCredentials).toBe(true);
    expect(merged.auth).toEqual({ username: 'user2', password: 'pass2' });
    expect(merged.responseType).toBe('blob');
    expect(merged.responseEncoding).toBe('utf16');
    expect(merged.validateStatus).toBe(config2.validateStatus);
    expect(merged.maxRedirects).toBe(10);
    expect(merged.maxContentLength).toBe(2000);
    expect(merged.maxBodyLength).toBe(4000);
    expect(merged.decompress).toBe(false);
    expect(merged.signal).toBe(config2.signal);
    expect(merged.onUploadProgress).toBe(config2.onUploadProgress);
    expect(merged.onDownloadProgress).toBe(config2.onDownloadProgress);
    expect(merged.retry).toEqual({ attempts: 3, delay: 1000 });
    expect(merged.cache).toEqual({ enabled: true, ttl: 300000 });
  });

  it('should handle properties not in mergeMap as replace', () => {
    const config1: FluxHTTPRequestConfig = {
      // Add a custom property
      customProperty: 'value1',
    } as any;

    const config2: FluxHTTPRequestConfig = {
      customProperty: 'value2',
    } as any;

    const merged = mergeConfig(config1, config2);

    expect((merged as any).customProperty).toBe('value2');
  });

  it('should handle non-object merge values correctly', () => {
    const config1: FluxHTTPRequestConfig = {
      retry: { attempts: 3 },
    };

    const config2: FluxHTTPRequestConfig = {
      retry: null as any, // Non-object value
    };

    const merged = mergeConfig(config1, config2);

    expect(merged.retry).toBe(null);
  });

  it('should preserve headers when second config has no headers', () => {
    const config1: FluxHTTPRequestConfig = {
      headers: { 'X-Custom': 'value' },
    };

    const config2: FluxHTTPRequestConfig = {
      url: '/test',
    };

    const merged = mergeConfig(config1, config2);

    expect(merged.headers).toEqual({ 'x-custom': 'value' });
  });
});
