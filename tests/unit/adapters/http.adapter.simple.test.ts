import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventEmitter } from 'events';

// Mock the modules before importing the adapter
vi.mock('http', () => ({
  request: vi.fn()
}));

vi.mock('https', () => ({
  request: vi.fn()
}));

vi.mock('zlib', () => ({
  createGunzip: vi.fn(),
  createInflate: vi.fn(),
  createBrotliDecompress: vi.fn()
}));

// Mock data utils
vi.mock('../../../src/utils/data', () => ({
  isStream: vi.fn(() => false),
  transformRequestData: vi.fn((data) => data)
}));

import { httpAdapter } from '../../../src/adapters/http.adapter';
import * as http from 'http';
import * as https from 'https';
import * as zlib from 'zlib';

describe('httpAdapter', () => {
  let mockReq: any;
  let mockRes: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Create mock request
    mockReq = Object.assign(new EventEmitter(), {
      end: vi.fn(),
      write: vi.fn(),
      destroy: vi.fn(),
      setTimeout: vi.fn(),
      destroyed: false
    });

    // Create mock response
    mockRes = Object.assign(new EventEmitter(), {
      statusCode: 200,
      statusMessage: 'OK',
      headers: {},
      pipe: vi.fn().mockReturnThis()
    });

    // Setup default behavior
    vi.mocked(http.request).mockImplementation((opts, callback) => {
      process.nextTick(() => callback(mockRes));
      return mockReq;
    });

    vi.mocked(https.request).mockImplementation((opts, callback) => {
      process.nextTick(() => callback(mockRes));
      return mockReq;
    });

    // Setup zlib mocks
    const createMockStream = () => {
      const stream = new EventEmitter();
      (stream as any).pipe = vi.fn().mockReturnThis();
      return stream;
    };

    vi.mocked(zlib.createGunzip).mockReturnValue(createMockStream() as any);
    vi.mocked(zlib.createInflate).mockReturnValue(createMockStream() as any);
    vi.mocked(zlib.createBrotliDecompress).mockReturnValue(createMockStream() as any);
  });

  it('should reject when URL is missing', async () => {
    await expect(httpAdapter({})).rejects.toThrow('URL is required');
  });

  it('should make successful HTTP GET request', async () => {
    const responsePromise = httpAdapter({
      url: 'http://fluxhttp.com/api/test',
      method: 'GET'
    });

    // Wait for callback to be triggered
    await new Promise(r => process.nextTick(r));
    
    // Emit response data
    mockRes.emit('data', Buffer.from('test response'));
    mockRes.emit('end');

    const response = await responsePromise;
    expect(response.status).toBe(200);
    expect(response.statusText).toBe('OK');
    expect(response.data).toBe('test response');
    expect(mockReq.end).toHaveBeenCalled();
  });

  it('should make successful HTTPS request', async () => {
    const responsePromise = httpAdapter({
      url: 'https://fluxhttp.com/api/secure',
      method: 'GET'
    });

    await new Promise(r => process.nextTick(r));
    mockRes.emit('data', Buffer.from('secure'));
    mockRes.emit('end');

    await responsePromise;
    expect(vi.mocked(https.request)).toHaveBeenCalled();
    expect(vi.mocked(http.request)).not.toHaveBeenCalled();
  });

  it('should send POST data', async () => {
    const data = { test: true };
    const responsePromise = httpAdapter({
      url: 'http://fluxhttp.com/api/users',
      method: 'POST',
      data
    });

    await new Promise(r => process.nextTick(r));
    mockRes.emit('end');

    await responsePromise;
    expect(mockReq.write).toHaveBeenCalledWith(data);
  });

  it('should handle request params', async () => {
    httpAdapter({
      url: 'http://fluxhttp.com/api/search',
      method: 'GET',
      params: { q: 'test', limit: 10 }
    });

    await new Promise(r => process.nextTick(r));
    
    expect(vi.mocked(http.request)).toHaveBeenCalledWith(
      expect.objectContaining({
        path: '/api/search?q=test&limit=10'
      }),
      expect.any(Function)
    );
  });

  it('should handle authentication', async () => {
    httpAdapter({
      url: 'http://fluxhttp.com/api/private',
      method: 'GET',
      auth: { username: 'user', password: 'pass' }
    });

    await new Promise(r => process.nextTick(r));
    
    expect(vi.mocked(http.request)).toHaveBeenCalledWith(
      expect.objectContaining({
        auth: 'user:pass'
      }),
      expect.any(Function)
    );
  });

  it('should handle JSON responseType', async () => {
    const responsePromise = httpAdapter({
      url: 'http://fluxhttp.com/api/json',
      method: 'GET',
      responseType: 'json'
    });

    await new Promise(r => process.nextTick(r));
    mockRes.emit('data', Buffer.from('{"json":true}'));
    mockRes.emit('end');

    const response = await responsePromise;
    expect(response.data).toEqual({ json: true });
  });

  it('should handle invalid JSON', async () => {
    const responsePromise = httpAdapter({
      url: 'http://fluxhttp.com/api/badjson',
      method: 'GET',
      responseType: 'json'
    });

    await new Promise(r => process.nextTick(r));
    mockRes.emit('data', Buffer.from('not json'));
    mockRes.emit('end');

    const response = await responsePromise;
    expect(response.data).toBe('not json');
  });

  it('should handle arraybuffer responseType', async () => {
    const responsePromise = httpAdapter({
      url: 'http://fluxhttp.com/api/binary',
      method: 'GET',
      responseType: 'arraybuffer'
    });

    await new Promise(r => process.nextTick(r));
    const data = Buffer.from([1, 2, 3, 4]);
    mockRes.emit('data', data);
    mockRes.emit('end');

    const response = await responsePromise;
    expect(response.data).toBeInstanceOf(Buffer);
    expect(Buffer.compare(response.data as Buffer, data)).toBe(0);
  });

  it('should handle stream responseType', async () => {
    const responsePromise = httpAdapter({
      url: 'http://fluxhttp.com/api/stream',
      method: 'GET',
      responseType: 'stream'
    });

    await new Promise(r => process.nextTick(r));

    const response = await responsePromise;
    expect(response.data).toBe(mockRes);
  });

  it('should handle request errors', async () => {
    const responsePromise = httpAdapter({
      url: 'http://fluxhttp.com/api/error',
      method: 'GET'
    });

    await new Promise(r => process.nextTick(r));
    mockReq.emit('error', new Error('Network error'));

    await expect(responsePromise).rejects.toThrow('Network error');
  });

  it('should handle response stream errors', async () => {
    const responsePromise = httpAdapter({
      url: 'http://fluxhttp.com/api/error',
      method: 'GET'
    });

    await new Promise(r => process.nextTick(r));
    mockRes.emit('error', new Error('Stream error'));

    await expect(responsePromise).rejects.toThrow('Stream error');
  });

  it('should reject on bad status', async () => {
    mockRes.statusCode = 404;
    mockRes.statusMessage = 'Not Found';

    const responsePromise = httpAdapter({
      url: 'http://fluxhttp.com/api/notfound',
      method: 'GET'
    });

    await new Promise(r => process.nextTick(r));
    mockRes.emit('data', Buffer.from('not found'));
    mockRes.emit('end');

    await expect(responsePromise).rejects.toThrow('Request failed with status code 404');
  });

  it('should use custom validateStatus', async () => {
    mockRes.statusCode = 404;

    const responsePromise = httpAdapter({
      url: 'http://fluxhttp.com/api/notfound',
      method: 'GET',
      validateStatus: (status) => status < 500
    });

    await new Promise(r => process.nextTick(r));
    mockRes.emit('end');

    const response = await responsePromise;
    expect(response.status).toBe(404);
  });

  it('should handle timeout', async () => {
    const responsePromise = httpAdapter({
      url: 'http://fluxhttp.com/api/slow',
      method: 'GET',
      timeout: 100
    });

    await new Promise(r => process.nextTick(r));
    
    // Trigger timeout
    const timeoutCallback = mockReq.setTimeout.mock.calls[0][1];
    timeoutCallback();

    await expect(responsePromise).rejects.toThrow('timeout');
    expect(mockReq.destroy).toHaveBeenCalled();
  });

  it('should handle abort signal', async () => {
    const controller = new AbortController();
    const responsePromise = httpAdapter({
      url: 'http://fluxhttp.com/api/cancel',
      method: 'GET',
      signal: controller.signal
    });

    await new Promise(r => process.nextTick(r));
    controller.abort();

    await expect(responsePromise).rejects.toThrow('Request aborted');
  });

  it('should track download progress', async () => {
    mockRes.headers = { 'content-length': '100' };
    const onDownloadProgress = vi.fn();

    const responsePromise = httpAdapter({
      url: 'http://fluxhttp.com/api/download',
      method: 'GET',
      onDownloadProgress
    });

    await new Promise(r => process.nextTick(r));
    
    mockRes.emit('data', Buffer.from('a'.repeat(50)));
    mockRes.emit('data', Buffer.from('b'.repeat(50)));
    mockRes.emit('end');

    await responsePromise;

    expect(onDownloadProgress).toHaveBeenCalledTimes(2);
    expect(onDownloadProgress).toHaveBeenCalledWith({
      loaded: 50,
      total: 100,
      progress: 0.5,
      bytes: 50
    });
  });

  it('should handle gzip decompression', async () => {
    mockRes.headers = { 'content-encoding': 'gzip' };
    
    const gzipStream = new EventEmitter();
    (gzipStream as any).pipe = vi.fn().mockReturnThis();
    vi.mocked(zlib.createGunzip).mockReturnValue(gzipStream as any);

    // Override pipe to return gzip stream
    mockRes.pipe = vi.fn().mockReturnValue(gzipStream);
    
    const responsePromise = httpAdapter({
      url: 'http://fluxhttp.com/api/gzip',
      method: 'GET'
    });

    await new Promise(r => process.nextTick(r));
    
    // Simulate data through gzip stream
    process.nextTick(() => {
      gzipStream.emit('data', Buffer.from('decompressed'));
      gzipStream.emit('end');
    });

    const response = await responsePromise;
    expect(response.data).toBe('decompressed');
    expect(vi.mocked(zlib.createGunzip)).toHaveBeenCalled();
  });

  it('should skip decompression when decompress is false', async () => {
    mockRes.headers = { 'content-encoding': 'gzip' };
    
    const responsePromise = httpAdapter({
      url: 'http://fluxhttp.com/api/raw',
      method: 'GET',
      decompress: false
    });

    await new Promise(r => process.nextTick(r));
    mockRes.emit('data', Buffer.from('compressed'));
    mockRes.emit('end');

    const response = await responsePromise;
    expect(response.data).toBe('compressed');
    expect(vi.mocked(zlib.createGunzip)).not.toHaveBeenCalled();
  });

  it('should not process response if request is destroyed', async () => {
    mockReq.destroyed = true;
    
    const responsePromise = httpAdapter({
      url: 'http://fluxhttp.com/api/test',
      method: 'GET'
    });

    // Wait for callback
    await new Promise(r => setTimeout(r, 100));

    // Promise should still be pending
    const raceResult = await Promise.race([
      responsePromise.then(() => 'resolved').catch(() => 'rejected'),
      new Promise(r => setTimeout(() => r('pending'), 50))
    ]);

    expect(raceResult).toBe('pending');
  });

  it('should handle empty response', async () => {
    mockRes.statusCode = 204;
    mockRes.statusMessage = 'No Content';
    
    const responsePromise = httpAdapter({
      url: 'http://fluxhttp.com/api/empty',
      method: 'DELETE'
    });

    await new Promise(r => process.nextTick(r));
    mockRes.emit('end');

    const response = await responsePromise;
    expect(response.status).toBe(204);
    expect(response.data).toBe('');
  });

  it('should set content-type for JSON data', async () => {
    const data = { name: 'test' };
    httpAdapter({
      url: 'http://fluxhttp.com/api/users',
      method: 'POST',
      data
    });

    await new Promise(r => process.nextTick(r));
    
    expect(vi.mocked(http.request)).toHaveBeenCalledWith(
      expect.objectContaining({
        headers: expect.objectContaining({
          'content-type': 'application/json',
          'content-length': String(Buffer.byteLength(JSON.stringify(data)))
        })
      }),
      expect.any(Function)
    );
  });

  it('should handle custom headers', async () => {
    httpAdapter({
      url: 'http://fluxhttp.com/api/test',
      method: 'GET',
      headers: { 'X-Custom': 'header' }
    });

    await new Promise(r => process.nextTick(r));
    
    expect(vi.mocked(http.request)).toHaveBeenCalledWith(
      expect.objectContaining({
        headers: expect.objectContaining({
          'X-Custom': 'header'
        })
      }),
      expect.any(Function)
    );
  });

  it('should handle port in URL', async () => {
    httpAdapter({
      url: 'http://fluxhttp.com:8080/api/test',
      method: 'GET'
    });

    await new Promise(r => process.nextTick(r));
    
    expect(vi.mocked(http.request)).toHaveBeenCalledWith(
      expect.objectContaining({
        port: '8080'
      }),
      expect.any(Function)
    );
  });
});