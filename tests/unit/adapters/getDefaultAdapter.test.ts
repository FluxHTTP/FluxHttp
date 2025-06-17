import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getDefaultAdapter } from '../../../src/adapters';
import type { FluxHTTPRequestConfig } from '../../../src/types';

describe('getDefaultAdapter', () => {
  let originalXMLHttpRequest: typeof XMLHttpRequest | undefined;
  let originalProcess: typeof process | undefined;
  let originalFetch: typeof fetch | undefined;

  beforeEach(() => {
    // Save original values
    originalXMLHttpRequest = (global as any).XMLHttpRequest;
    originalProcess = (global as any).process;
    originalFetch = (global as any).fetch;

    // Clear all to start fresh
    (global as any).XMLHttpRequest = undefined;
    (global as any).process = undefined;
    (global as any).fetch = undefined;
  });

  afterEach(() => {
    // Restore original values
    (global as any).XMLHttpRequest = originalXMLHttpRequest;
    (global as any).process = originalProcess;
    (global as any).fetch = originalFetch;
    vi.clearAllMocks();
  });

  describe('browser environment (XMLHttpRequest)', () => {
    beforeEach(() => {
      // Mock XMLHttpRequest
      (global as any).XMLHttpRequest = function() {
        this.open = vi.fn();
        this.send = vi.fn();
      };
    });

    it('should return xhr adapter wrapper', async () => {
      const adapter = getDefaultAdapter();
      
      expect(adapter).toBeDefined();
      expect(adapter).toBeInstanceOf(Function);
      expect(adapter.name).toBe('xhrAdapterWrapper');
    });

    it('should dynamically import and call xhr adapter', async () => {
      const mockXhrAdapter = vi.fn().mockResolvedValue({
        data: 'xhr response',
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {}
      });

      vi.doMock('../../../src/adapters/xhr.adapter', () => ({
        xhrAdapter: mockXhrAdapter
      }));

      const adapter = getDefaultAdapter();
      const config: FluxHTTPRequestConfig = {
        url: 'https://fluxhttp.com/api/test',
        method: 'GET'
      };

      await adapter(config);

      expect(mockXhrAdapter).toHaveBeenCalledWith(config);
      
      vi.doUnmock('../../../src/adapters/xhr.adapter');
    });
  });

  describe('Node.js environment', () => {
    beforeEach(() => {
      // Mock Node.js process
      (global as any).process = {
        versions: {
          node: '16.0.0'
        }
      };
    });

    it('should return http adapter wrapper', async () => {
      const adapter = getDefaultAdapter();
      
      expect(adapter).toBeDefined();
      expect(adapter).toBeInstanceOf(Function);
      expect(adapter.name).toBe('httpAdapterWrapper');
    });

    it('should dynamically import and call http adapter', async () => {
      const mockHttpAdapter = vi.fn().mockResolvedValue({
        data: 'http response',
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {}
      });

      vi.doMock('../../../src/adapters/http.adapter', () => ({
        httpAdapter: mockHttpAdapter
      }));

      const adapter = getDefaultAdapter();
      const config: FluxHTTPRequestConfig = {
        url: 'https://fluxhttp.com/api/test',
        method: 'POST',
        data: { test: true }
      };

      await adapter(config);

      expect(mockHttpAdapter).toHaveBeenCalledWith(config);
      
      vi.doUnmock('../../../src/adapters/http.adapter');
    });

    it('should not detect Node.js without node version', () => {
      (global as any).process = {
        versions: {}
      };

      // Should throw since no adapter is available
      expect(() => getDefaultAdapter()).toThrow('No suitable adapter found for the current environment');
    });
  });

  describe('modern runtime environment (fetch)', () => {
    beforeEach(() => {
      // Mock fetch
      (global as any).fetch = vi.fn();
    });

    it('should return fetch adapter wrapper', async () => {
      const adapter = getDefaultAdapter();
      
      expect(adapter).toBeDefined();
      expect(adapter).toBeInstanceOf(Function);
      expect(adapter.name).toBe('fetchAdapterWrapper');
    });

    it('should dynamically import and call fetch adapter', async () => {
      const mockFetchAdapter = vi.fn().mockResolvedValue({
        data: 'fetch response',
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {}
      });

      vi.doMock('../../../src/adapters/fetch.adapter', () => ({
        fetchAdapter: mockFetchAdapter
      }));

      const adapter = getDefaultAdapter();
      const config: FluxHTTPRequestConfig = {
        url: 'https://fluxhttp.com/api/test',
        method: 'GET',
        headers: { 'X-Custom': 'header' }
      };

      await adapter(config);

      expect(mockFetchAdapter).toHaveBeenCalledWith(config);
      
      vi.doUnmock('../../../src/adapters/fetch.adapter');
    });
  });

  describe('no suitable adapter', () => {
    it('should throw error when no adapter is available', () => {
      // All globals are undefined
      expect(() => getDefaultAdapter()).toThrow('No suitable adapter found for the current environment');
    });
  });

  describe('environment detection priority', () => {
    it('should prefer XMLHttpRequest over process', () => {
      (global as any).XMLHttpRequest = function() {};
      (global as any).process = { versions: { node: '16.0.0' } };
      (global as any).fetch = vi.fn();

      const adapter = getDefaultAdapter();
      expect(adapter.name).toBe('xhrAdapterWrapper');
    });

    it('should prefer process over fetch', () => {
      (global as any).process = { versions: { node: '16.0.0' } };
      (global as any).fetch = vi.fn();

      const adapter = getDefaultAdapter();
      expect(adapter.name).toBe('httpAdapterWrapper');
    });

    it('should use fetch as last resort', () => {
      (global as any).fetch = vi.fn();

      const adapter = getDefaultAdapter();
      expect(adapter.name).toBe('fetchAdapterWrapper');
    });
  });

  describe('edge cases', () => {
    it('should handle process without versions property', () => {
      (global as any).process = {};
      (global as any).fetch = vi.fn();

      const adapter = getDefaultAdapter();
      expect(adapter.name).toBe('fetchAdapterWrapper');
    });

    it('should handle null process.versions', () => {
      (global as any).process = { versions: null };
      (global as any).fetch = vi.fn();

      const adapter = getDefaultAdapter();
      expect(adapter.name).toBe('fetchAdapterWrapper');
    });

    it('should handle process.versions without node property', () => {
      (global as any).process = { versions: { v8: '9.0.0' } };
      (global as any).fetch = vi.fn();

      const adapter = getDefaultAdapter();
      expect(adapter.name).toBe('fetchAdapterWrapper');
    });
  });
});