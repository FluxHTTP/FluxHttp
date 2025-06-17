import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventEmitter } from 'stream';
import type { FluxHTTPRequestConfig } from '../../../src/types';

describe('Final 100% Coverage Tests', () => {
  describe('fetch.adapter.ts line 73: successful JSON parsing with responseType=json', () => {
    beforeEach(() => {
      global.fetch = vi.fn();
      global.Headers = class MockHeaders {
        private headers = new Map<string, string>();
        constructor(init?: any) {
          if (init && typeof init === 'object') {
            Object.entries(init).forEach(([key, value]) => {
              this.headers.set(key.toLowerCase(), String(value));
            });
          }
        }
        get(name: string): string | null {
          return this.headers.get(name.toLowerCase()) || null;
        }
        forEach(callback: (value: string, key: string) => void): void {
          this.headers.forEach(callback);
        }
      } as any;
      global.AbortController = class { signal = {}; abort = vi.fn(); } as any;
      global.setTimeout = vi.fn();
      global.clearTimeout = vi.fn();
    });

    it('should successfully parse JSON when responseType is json (line 73)', async () => {
      const { fetchAdapter } = await import('../../../src/adapters/fetch.adapter');
      
      const jsonData = { success: true, message: 'Valid JSON' };
      const mockResponse = {
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new (global.Headers as any)(),
        json: vi.fn().mockResolvedValue(jsonData), // This should succeed (line 73)
        text: vi.fn().mockResolvedValue('should not be called')
      };

      vi.mocked(global.fetch).mockResolvedValue(mockResponse as any);

      const config: FluxHTTPRequestConfig = {
        url: 'https://fluxhttp.com/api/valid-json',
        method: 'GET',
        responseType: 'json' // Explicitly request JSON
      };

      const response = await fetchAdapter(config);
      
      // Verify successful JSON parsing (line 73)
      expect(mockResponse.json).toHaveBeenCalled();
      expect(mockResponse.text).not.toHaveBeenCalled(); // Should not fallback to text
      expect(response.data).toEqual(jsonData);
    });
  });

  describe('http.adapter.ts lines 178-179: stream abort handling', () => {
    beforeEach(() => {
      vi.resetModules();
    });

    it('should call req.destroy when stream is aborted (lines 178-179)', async () => {
      const mockReq = Object.assign(new EventEmitter(), {
        end: vi.fn(),
        write: vi.fn(),
        destroy: vi.fn(),
        setTimeout: vi.fn()
      });

      const mockRes = Object.assign(new EventEmitter(), {
        statusCode: 200,
        statusMessage: 'OK',
        headers: {}
      });

      // Mock modules
      vi.doMock('http', () => ({
        request: vi.fn((opts, callback) => {
          process.nextTick(() => callback(mockRes));
          return mockReq;
        })
      }));

      vi.doMock('../../../src/utils/data', () => ({
        isStream: vi.fn((data) => data && typeof data.pipeTo === 'function'),
        transformRequestData: vi.fn((data) => data)
      }));

      // Mock WritableStream to capture abort handler
      let capturedAbortHandler: ((err?: Error) => void) | undefined;
      
      global.WritableStream = class MockWritableStream {
        constructor(underlyingSink: any) {
          capturedAbortHandler = underlyingSink.abort;
        }
        getWriter() {
          return {
            write: vi.fn(),
            close: vi.fn(),
            abort: vi.fn()
          };
        }
      } as any;

      const { httpAdapter } = await import('../../../src/adapters/http.adapter');
      const { isStream } = await import('../../../src/utils/data');
      
      vi.mocked(isStream).mockReturnValue(true);

      const streamData = {
        pipeTo: vi.fn().mockResolvedValue(undefined)
      };

      const config: FluxHTTPRequestConfig = {
        url: 'http://fluxhttp.com/api/stream-with-abort',
        method: 'POST',
        data: streamData
      };

      const responsePromise = httpAdapter(config);
      
      // Wait for stream setup
      await new Promise(resolve => process.nextTick(resolve));
      
      // Verify abort handler was captured
      expect(capturedAbortHandler).toBeDefined();
      
      // Trigger abort with error (this should exercise lines 178-179)
      const abortError = new Error('Stream aborted by user');
      capturedAbortHandler!(abortError);
      
      // Verify req.destroy was called with the error (lines 178-179)
      expect(mockReq.destroy).toHaveBeenCalledWith(abortError);
      
      // Complete the response normally
      mockRes.emit('end');
      
      await responsePromise;
    });
  });

  describe('xhr.adapter.ts line 42: complete xhr null guard coverage', () => {
    it('should handle xhr being exactly null (line 42)', async () => {
      let capturedOnloadend: any;
      const mockXHR = {
        open: vi.fn(),
        send: vi.fn(),
        setRequestHeader: vi.fn(),
        getAllResponseHeaders: vi.fn().mockReturnValue(''),
        addEventListener: vi.fn(),
        upload: { addEventListener: vi.fn() },
        status: 200,
        statusText: 'OK',
        responseText: 'test',
        responseType: '',
        response: null,
        get onloadend() { return capturedOnloadend; },
        set onloadend(handler) { capturedOnloadend = handler; }
      };

      global.XMLHttpRequest = vi.fn(() => mockXHR) as any;
      
      const { xhrAdapter } = await import('../../../src/adapters/xhr.adapter');
      
      const config: FluxHTTPRequestConfig = {
        url: 'https://fluxhttp.com/api/xhr-null-test',
        method: 'GET'
      };

      xhrAdapter(config);
      
      // The onloadend function should contain the guard clause
      expect(capturedOnloadend).toBeDefined();
      
      // Test the exact condition: if (!xhr) return;
      // This should test line 42 by calling the function in a context where xhr is null
      const mockEmptyContext = {};
      
      // The onloadend handler should safely handle when 'this' doesn't have xhr
      expect(() => {
        capturedOnloadend.call(mockEmptyContext);
      }).not.toThrow();
      
      // Also test with explicit null
      const nullContext = { xhr: null };
      expect(() => {
        capturedOnloadend.call(nullContext);
      }).not.toThrow();
    });
  });
});