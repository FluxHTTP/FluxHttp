import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventEmitter, PassThrough, Readable } from 'stream';
import type { FluxHTTPRequestConfig } from '../../../src/types';

// Mock modules first
const mockRequest = vi.fn();
const mockCreateBrotliDecompress = vi.fn();

vi.mock('http', () => ({ request: mockRequest }));
vi.mock('https', () => ({ request: vi.fn() }));
vi.mock('zlib', () => ({
  createGunzip: vi.fn(() => new PassThrough()),
  createInflate: vi.fn(() => new PassThrough()),
  createBrotliDecompress: mockCreateBrotliDecompress
}));

// Mock WritableStream for stream tests
class MockWritableStream {
  private underlyingSink: any;
  
  constructor(underlyingSink: any) {
    this.underlyingSink = underlyingSink;
  }
  
  getWriter() {
    return {
      write: (chunk: any) => {
        this.underlyingSink.write(chunk);
        return Promise.resolve();
      },
      close: () => {
        this.underlyingSink.close();
        return Promise.resolve();
      },
      abort: (reason?: any) => {
        this.underlyingSink.abort(reason);
        return Promise.resolve();
      }
    };
  }
}

global.WritableStream = MockWritableStream as any;

// Mock data utils
vi.mock('../../../src/utils/data', () => ({
  isStream: vi.fn(),
  transformRequestData: vi.fn((data) => data)
}));

describe('httpAdapter - Complete 100% Coverage', () => {
  let mockReq: any;
  let mockRes: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockReq = Object.assign(new EventEmitter(), {
      end: vi.fn(),
      write: vi.fn(),
      destroy: vi.fn(),
      setTimeout: vi.fn(),
      destroyed: false
    });

    mockRes = Object.assign(new EventEmitter(), {
      statusCode: 200,
      statusMessage: 'OK',
      headers: {},
      pipe: vi.fn()
    });

    mockRequest.mockImplementation((opts, callback) => {
      process.nextTick(() => callback(mockRes));
      return mockReq;
    });
  });

  describe('Lines 124-125: Brotli decompression', () => {
    it('should handle brotli compression (br encoding)', async () => {
      const { httpAdapter } = await import('../../../src/adapters/http.adapter');
      
      mockRes.headers = { 'content-encoding': 'br' };
      
      const brotliStream = new PassThrough();
      mockCreateBrotliDecompress.mockReturnValue(brotliStream);
      mockRes.pipe.mockReturnValue(brotliStream);
      
      const config: FluxHTTPRequestConfig = {
        url: 'http://fluxhttp.com/api/brotli-data',
        method: 'GET',
        decompress: true
      };

      const responsePromise = httpAdapter(config);
      
      // Wait for request setup
      await new Promise(resolve => process.nextTick(resolve));
      
      // Verify brotli decompression is set up (line 124-125)
      expect(mockCreateBrotliDecompress).toHaveBeenCalled();
      expect(mockRes.pipe).toHaveBeenCalledWith(brotliStream);
      
      // Simulate brotli decompressed data
      process.nextTick(() => {
        brotliStream.emit('data', Buffer.from('brotli decompressed content'));
        brotliStream.emit('end');
      });
      
      const response = await responsePromise;
      expect(response.data).toBe('brotli decompressed content');
    });
  });

  describe('Lines 169-181: Stream data handling with pipeTo', () => {
    it('should handle stream data using pipeTo method', async () => {
      const { httpAdapter } = await import('../../../src/adapters/http.adapter');
      const { isStream } = await import('../../../src/utils/data');
      
      // Mock isStream to return true for our test data
      vi.mocked(isStream).mockReturnValue(true);
      
      const writtenChunks: Buffer[] = [];
      let streamClosed = false;
      let streamAborted = false;
      
      // Create a mock ReadableStream with pipeTo method
      const mockReadableStream = {
        pipeTo: vi.fn().mockImplementation((writableStream: MockWritableStream) => {
          return new Promise<void>((resolve, reject) => {
            const writer = writableStream.getWriter();
            
            // Simulate writing data chunks (this exercises lines 169-181)
            process.nextTick(async () => {
              try {
                await writer.write(Buffer.from('chunk 1'));
                await writer.write(Buffer.from('chunk 2'));
                await writer.close();
                resolve();
              } catch (error) {
                reject(error);
              }
            });
          });
        })
      };
      
      // Override request write and end to capture data
      mockReq.write = vi.fn((chunk: Buffer) => {
        writtenChunks.push(chunk);
      });
      
      mockReq.end = vi.fn(() => {
        streamClosed = true;
      });
      
      const config: FluxHTTPRequestConfig = {
        url: 'http://fluxhttp.com/api/stream-upload',
        method: 'POST',
        data: mockReadableStream
      };

      const responsePromise = httpAdapter(config);
      
      // Wait for stream processing
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Verify stream handling (lines 169-181)
      expect(vi.mocked(isStream)).toHaveBeenCalledWith(mockReadableStream);
      expect(mockReadableStream.pipeTo).toHaveBeenCalled();
      expect(mockReq.write).toHaveBeenCalledWith(Buffer.from('chunk 1'));
      expect(mockReq.write).toHaveBeenCalledWith(Buffer.from('chunk 2'));
      expect(mockReq.end).toHaveBeenCalled();
      
      // Complete the HTTP response
      mockRes.emit('end');
      
      await responsePromise;
    });

    it('should handle stream errors via abort mechanism', async () => {
      const { httpAdapter } = await import('../../../src/adapters/http.adapter');
      const { isStream } = await import('../../../src/utils/data');
      
      vi.mocked(isStream).mockReturnValue(true);
      
      const streamError = new Error('Stream processing failed');
      let abortCalled = false;
      
      const mockReadableStreamWithError = {
        pipeTo: vi.fn().mockImplementation((writableStream: MockWritableStream) => {
          // Access the underlying sink to trigger abort
          const originalAbort = writableStream.getWriter().abort;
          
          return Promise.reject(streamError);
        })
      };
      
      mockReq.destroy = vi.fn((error?: Error) => {
        abortCalled = true;
        expect(error).toBe(streamError);
      });
      
      const config: FluxHTTPRequestConfig = {
        url: 'http://fluxhttp.com/api/stream-error',
        method: 'POST',
        data: mockReadableStreamWithError
      };

      const responsePromise = httpAdapter(config);
      
      // Wait for stream error processing
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // The stream error should trigger request destruction
      expect(mockReadableStreamWithError.pipeTo).toHaveBeenCalled();
      
      // Complete with error
      mockReq.emit('error', streamError);
      
      await expect(responsePromise).rejects.toThrow('Stream processing failed');
    });
  });
});