import { describe, it, expect } from 'vitest';
import { mergeConfig } from '../../../src/core/mergeConfig';
import type { FluxHTTPRequestConfig } from '../../../src/types';

describe('mergeConfig - additional coverage', () => {
  it('should handle merge strategy for object properties when config1 value is undefined', () => {
    const config1: FluxHTTPRequestConfig = {
      url: '/test',
      // retry is undefined
    };

    const config2: FluxHTTPRequestConfig = {
      retry: {
        limit: 3,
        delay: 1000,
        methods: ['GET', 'POST']
      }
    };

    const result = mergeConfig(config1, config2);

    expect(result.retry).toEqual({
      limit: 3,
      delay: 1000,
      methods: ['GET', 'POST']
    });
  });

  it('should handle merge strategy for cache when config1 has no cache', () => {
    const config1: FluxHTTPRequestConfig = {
      url: '/api',
      method: 'GET'
      // cache is not defined
    };

    const config2: FluxHTTPRequestConfig = {
      cache: {
        ttl: 60000,
        key: 'api-cache',
        storage: 'memory'
      }
    };

    const result = mergeConfig(config1, config2);

    expect(result.cache).toEqual({
      ttl: 60000,
      key: 'api-cache',
      storage: 'memory'
    });
  });

  it('should handle null config1 value with object merge strategy', () => {
    const config1: FluxHTTPRequestConfig = {
      url: '/test',
      retry: null as any // Explicitly null
    };

    const config2: FluxHTTPRequestConfig = {
      retry: {
        limit: 5,
        delay: 2000
      }
    };

    const result = mergeConfig(config1, config2);

    // Since config1.retry is null, it should use empty object fallback
    expect(result.retry).toEqual({
      limit: 5,
      delay: 2000
    });
  });
});