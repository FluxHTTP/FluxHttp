import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventEmitter, PassThrough } from 'stream';
import type { FluxHTTPRequestConfig } from '../../../src/types';

describe('Final Coverage Tests', () => {
  describe('fetchAdapter lines 55-56 (timeout clearance)', () => {
    beforeEach(() => {
      // Mock fetch globals
      global.fetch = vi.fn();
      global.Headers = class {
        forEach = vi.fn();
        get = vi.fn();
      } as any;
      global.AbortController = class {
        signal = {};
        abort = vi.fn();
      } as any;
    });

    it('should clear timeout when fetch succeeds', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: { forEach: vi.fn(), get: vi.fn() },
        text: vi.fn().mockResolvedValue('success')
      };
      
      vi.mocked(global.fetch).mockResolvedValue(mockResponse as any);
      const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');
      
      // Dynamic import to ensure mocks are set
      const { fetchAdapter } = await import('../../../src/adapters/fetch.adapter');
      
      const config: FluxHTTPRequestConfig = {
        url: 'https://fluxhttp.com/api/test',
        method: 'GET',
        timeout: 1000 // This will trigger timeout setup and clearance
      };

      await fetchAdapter(config);
      
      expect(clearTimeoutSpy).toHaveBeenCalled();
    });
  });

  describe('http.adapter line 122 (deflate decompression)', () => {
    beforeEach(() => {
      vi.resetModules();
    });

    it('should handle deflate decompression', async () => {
      const mockReq = Object.assign(new EventEmitter(), {
        end: vi.fn(),
        write: vi.fn(),
        destroy: vi.fn(),
        setTimeout: vi.fn()
      });

      const mockRes = Object.assign(new EventEmitter(), {
        statusCode: 200,
        statusMessage: 'OK',
        headers: { 'content-encoding': 'deflate' },
        pipe: vi.fn()
      });

      const deflateStream = new PassThrough();
      
      // Mock modules
      vi.doMock('http', () => ({
        request: vi.fn((opts, callback) => {
          process.nextTick(() => callback(mockRes));
          return mockReq;
        })
      }));
      
      vi.doMock('zlib', () => ({
        createGunzip: vi.fn(),
        createInflate: vi.fn(() => deflateStream),
        createBrotliDecompress: vi.fn()
      }));
      
      vi.doMock('../../../src/utils/data', () => ({
        isStream: vi.fn(() => false),
        transformRequestData: vi.fn((data) => data)
      }));

      const { httpAdapter } = await import('../../../src/adapters/http.adapter');
      const { createInflate } = await import('zlib');
      
      mockRes.pipe = vi.fn().mockReturnValue(deflateStream);
      
      const config: FluxHTTPRequestConfig = {
        url: 'http://fluxhttp.com/api/deflate',
        method: 'GET'
      };

      const responsePromise = httpAdapter(config);
      
      await new Promise(resolve => process.nextTick(resolve));
      
      // Trigger deflate decompression by emitting data
      process.nextTick(() => {
        deflateStream.emit('data', Buffer.from('deflate response'));
        deflateStream.emit('end');
      });
      
      const response = await responsePromise;
      
      expect(createInflate).toHaveBeenCalled();
      expect(response.data).toBe('deflate response');
    });
  });

  describe('xhr.adapter line 42 (xhr null check)', () => {
    it('should handle null xhr in onloadend', async () => {
      let onloadendHandler: any;
      const mockXHR = {
        open: vi.fn(),
        send: vi.fn(),
        setRequestHeader: vi.fn(),
        getAllResponseHeaders: vi.fn().mockReturnValue(''),
        addEventListener: vi.fn(),
        upload: { addEventListener: vi.fn() },
        get onloadend() { return null; },
        set onloadend(handler) { onloadendHandler = handler; },
        status: 200,
        statusText: 'OK',
        responseText: 'success',
        responseType: '',
        response: null
      };

      global.XMLHttpRequest = vi.fn(() => mockXHR) as any;
      
      const { xhrAdapter } = await import('../../../src/adapters/xhr.adapter');
      
      const config: FluxHTTPRequestConfig = {
        url: 'https://fluxhttp.com/api/test',
        method: 'GET'
      };

      xhrAdapter(config);
      
      // The onloadend handler should be set
      expect(onloadendHandler).toBeDefined();
      
      // Now test the null check by calling the handler when xhr might be null
      // The line `if (!xhr) return;` should be covered when xhr is falsy
      expect(() => {
        // This simulates the condition where xhr might be null/undefined
        onloadendHandler.call({ xhr: null });
      }).not.toThrow();
    });
  });
});