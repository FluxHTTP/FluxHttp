import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { FluxHTTPRequestConfig } from '../../../src/types';

// Setup global mocks before any imports
const setupGlobalMocks = () => {
  global.fetch = vi.fn();
  
  global.Headers = class MockHeaders {
    private headers = new Map<string, string>();
    
    constructor(init?: any) {
      if (init && typeof init === 'object') {
        if (init instanceof MockHeaders) {
          init.forEach((value: string, key: string) => this.headers.set(key, value));
        } else {
          Object.entries(init).forEach(([key, value]) => {
            this.headers.set(key.toLowerCase(), String(value));
          });
        }
      }
    }
    
    get(name: string): string | null {
      return this.headers.get(name.toLowerCase()) || null;
    }
    
    set(name: string, value: string): void {
      this.headers.set(name.toLowerCase(), value);
    }
    
    forEach(callback: (value: string, key: string) => void): void {
      this.headers.forEach(callback);
    }
  } as any;

  global.AbortController = class MockAbortController {
    signal = { addEventListener: vi.fn() };
    abort = vi.fn();
  } as any;

  global.setTimeout = vi.fn((fn: Function, delay: number) => {
    const id = Math.random();
    // Don't actually set timeout in tests
    return id as any;
  });

  global.clearTimeout = vi.fn();
};

setupGlobalMocks();

describe('fetchAdapter - Complete 100% Coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Lines 84-85: JSON parse error in auto-detect mode', () => {
    it('should catch JSON parse error and fall back to text when content-type is json', async () => {
      // Import after mocks are setup
      const { fetchAdapter } = await import('../../../src/adapters/fetch.adapter');
      
      const mockHeaders = new (global.Headers as any)({ 'content-type': 'application/json' });
      const mockResponse = {
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: mockHeaders,
        json: vi.fn().mockRejectedValue(new SyntaxError('Unexpected token < in JSON')),
        text: vi.fn().mockResolvedValue('{"malformed": json}') // This will be returned when JSON parsing fails
      };
      
      // Spy on the headers.get method
      vi.spyOn(mockHeaders, 'get');

      vi.mocked(global.fetch).mockResolvedValue(mockResponse as any);

      const config: FluxHTTPRequestConfig = {
        url: 'https://fluxhttp.com/api/malformed-json',
        method: 'GET'
        // No responseType specified - should auto-detect JSON and fallback to text
      };

      const response = await fetchAdapter(config);
      
      // Verify the flow: 
      // 1. contentType check passes (application/json)
      // 2. JSON parsing is attempted and fails
      // 3. Falls back to text (lines 84-85)
      expect(mockHeaders.get).toHaveBeenCalledWith('content-type');
      expect(mockResponse.json).toHaveBeenCalled();
      expect(mockResponse.text).toHaveBeenCalled();
      expect(response.data).toBe('{"malformed": json}');
    });
  });

  describe('Lines 118-119: Timeout cleanup on error', () => {
    it('should clear timeout when network error occurs', async () => {
      const { fetchAdapter } = await import('../../../src/adapters/fetch.adapter');
      
      const networkError = new Error('fetch failed');
      vi.mocked(global.fetch).mockRejectedValue(networkError);

      const config: FluxHTTPRequestConfig = {
        url: 'https://fluxhttp.com/api/network-error',
        method: 'GET',
        timeout: 5000
      };

      await expect(fetchAdapter(config)).rejects.toThrow('fetch failed');
      
      // Verify timeout was cleared on error (lines 118-119)
      expect(global.clearTimeout).toHaveBeenCalled();
    });

    it('should clear timeout when AbortError occurs', async () => {
      const { fetchAdapter } = await import('../../../src/adapters/fetch.adapter');
      
      const abortError = new Error('The operation was aborted');
      abortError.name = 'AbortError';
      vi.mocked(global.fetch).mockRejectedValue(abortError);

      const config: FluxHTTPRequestConfig = {
        url: 'https://fluxhttp.com/api/aborted',
        method: 'POST',
        timeout: 3000
      };

      await expect(fetchAdapter(config)).rejects.toThrow('Request aborted');
      
      // Verify timeout was cleared on abort error (lines 118-119)
      expect(global.clearTimeout).toHaveBeenCalled();
    });

    it('should clear timeout when unknown error occurs', async () => {
      const { fetchAdapter } = await import('../../../src/adapters/fetch.adapter');
      
      const unknownError = new Error('Unknown fetch error');
      unknownError.name = 'UnknownError';
      vi.mocked(global.fetch).mockRejectedValue(unknownError);

      const config: FluxHTTPRequestConfig = {
        url: 'https://fluxhttp.com/api/unknown-error',
        method: 'GET',
        timeout: 2000
      };

      await expect(fetchAdapter(config)).rejects.toThrow('Unknown fetch error');
      
      // Verify timeout was cleared on unknown error (lines 118-119)
      expect(global.clearTimeout).toHaveBeenCalled();
    });
  });
});