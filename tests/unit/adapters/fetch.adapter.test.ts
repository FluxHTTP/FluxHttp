import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchAdapter } from '../../../src/adapters/fetch.adapter';
import type { FluxHTTPRequestConfig } from '../../../src/types';

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('fetchAdapter', () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });

  it('should make a successful GET request', async () => {
    const mockResponse = {
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: new Headers({ 'content-type': 'application/json' }),
      json: vi.fn().mockResolvedValue({ data: 'test' }),
      text: vi.fn().mockResolvedValue('{"data":"test"}'),
    };
    mockFetch.mockResolvedValue(mockResponse);

    const config: FluxHTTPRequestConfig = {
      url: 'https://api.example.com/test',
      method: 'GET',
    };

    const response = await fetchAdapter(config);

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.example.com/test',
      expect.objectContaining({
        method: 'GET',
        credentials: 'same-origin',
      })
    );
    expect(response.status).toBe(200);
    expect(response.data).toEqual({ data: 'test' });
  });

  it('should handle POST request with data', async () => {
    const mockResponse = {
      ok: true,
      status: 201,
      statusText: 'Created',
      headers: new Headers(),
      json: vi.fn().mockResolvedValue({ id: 1 }),
      text: vi.fn().mockResolvedValue('{"id":1}'),
    };
    mockFetch.mockResolvedValue(mockResponse);

    const config: FluxHTTPRequestConfig = {
      url: 'https://api.example.com/users',
      method: 'POST',
      data: JSON.stringify({ name: 'test' }),
      headers: { 'Content-Type': 'application/json' },
    };

    const response = await fetchAdapter(config);

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.example.com/users',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ name: 'test' }),
      })
    );
    expect(response.status).toBe(201);
  });

  it('should handle request with query parameters', async () => {
    const mockResponse = {
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: new Headers(),
      text: vi.fn().mockResolvedValue('test'),
    };
    mockFetch.mockResolvedValue(mockResponse);

    const config: FluxHTTPRequestConfig = {
      url: 'https://api.example.com/search',
      method: 'GET',
      params: { q: 'test', limit: 10 },
    };

    await fetchAdapter(config);

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.example.com/search?q=test&limit=10',
      expect.any(Object)
    );
  });

  it('should handle different response types', async () => {
    // Test blob response
    const mockBlob = new Blob(['test']);
    const blobResponse = {
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: new Headers(),
      blob: vi.fn().mockResolvedValue(mockBlob),
    };
    mockFetch.mockResolvedValueOnce(blobResponse);

    const blobResult = await fetchAdapter({
      url: 'https://api.example.com/file',
      responseType: 'blob',
    });
    expect(blobResult.data).toBe(mockBlob);

    // Test arraybuffer response
    const mockArrayBuffer = new ArrayBuffer(8);
    const arrayBufferResponse = {
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: new Headers(),
      arrayBuffer: vi.fn().mockResolvedValue(mockArrayBuffer),
    };
    mockFetch.mockResolvedValueOnce(arrayBufferResponse);

    const arrayBufferResult = await fetchAdapter({
      url: 'https://api.example.com/buffer',
      responseType: 'arraybuffer',
    });
    expect(arrayBufferResult.data).toBe(mockArrayBuffer);

    // Test stream response
    const mockStream = new ReadableStream();
    const streamResponse = {
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: new Headers(),
      body: mockStream,
    };
    mockFetch.mockResolvedValueOnce(streamResponse);

    const streamResult = await fetchAdapter({
      url: 'https://api.example.com/stream',
      responseType: 'stream',
    });
    expect(streamResult.data).toBe(mockStream);
  });

  it('should handle JSON parsing errors', async () => {
    const mockResponse = {
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: new Headers({ 'content-type': 'application/json' }),
      json: vi.fn().mockRejectedValue(new Error('Invalid JSON')),
      text: vi.fn().mockResolvedValue('Invalid JSON'),
    };
    mockFetch.mockResolvedValue(mockResponse);

    const response = await fetchAdapter({
      url: 'https://api.example.com/test',
      responseType: 'json',
    });

    expect(response.data).toBe('Invalid JSON');
  });

  it('should handle timeout', async () => {
    const config: FluxHTTPRequestConfig = {
      url: 'https://api.example.com/test',
      timeout: 100,
    };

    let timeoutId: NodeJS.Timeout;
    mockFetch.mockImplementation(() => {
      return new Promise((resolve) => {
        timeoutId = setTimeout(
          () =>
            resolve({
              ok: true,
              status: 200,
              statusText: 'OK',
              headers: new Headers(),
              text: vi.fn().mockResolvedValue('should not reach here'),
            }),
          200
        );
      });
    });

    await expect(fetchAdapter(config)).rejects.toThrow(/timeout/i);
    clearTimeout(timeoutId!);
  });

  it('should handle abort signal', async () => {
    const controller = new AbortController();
    const config: FluxHTTPRequestConfig = {
      url: 'https://api.example.com/test',
      signal: controller.signal,
    };

    mockFetch.mockImplementation((url, options) => {
      return new Promise((resolve, reject) => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        options.signal.addEventListener('abort', () => {
          reject(new DOMException('The user aborted a request.', 'AbortError'));
        });
      });
    });

    const promise = fetchAdapter(config);
    controller.abort();

    await expect(promise).rejects.toThrow(/aborted/i);
  });

  it('should handle credentials option', async () => {
    const mockResponse = {
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: new Headers(),
      text: vi.fn().mockResolvedValue('test'),
    };
    mockFetch.mockResolvedValue(mockResponse);

    await fetchAdapter({
      url: 'https://api.example.com/test',
      withCredentials: true,
    });

    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        credentials: 'include',
      })
    );
  });

  it('should handle network errors', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));

    const config: FluxHTTPRequestConfig = {
      url: 'https://api.example.com/test',
    };

    await expect(fetchAdapter(config)).rejects.toThrow(/network/i);
  });

  it('should handle non-2xx status codes', async () => {
    const mockResponse = {
      ok: false,
      status: 404,
      statusText: 'Not Found',
      headers: new Headers(),
      text: vi.fn().mockResolvedValue('Not found'),
    };
    mockFetch.mockResolvedValue(mockResponse);

    const config: FluxHTTPRequestConfig = {
      url: 'https://api.example.com/test',
    };

    await expect(fetchAdapter(config)).rejects.toThrow(/404/);
  });

  it('should use custom validateStatus', async () => {
    const mockResponse = {
      ok: false,
      status: 404,
      statusText: 'Not Found',
      headers: new Headers(),
      text: vi.fn().mockResolvedValue('Not found'),
    };
    mockFetch.mockResolvedValue(mockResponse);

    const config: FluxHTTPRequestConfig = {
      url: 'https://api.example.com/test',
      validateStatus: (status) => status < 500,
    };

    const response = await fetchAdapter(config);
    expect(response.status).toBe(404);
  });

  it('should reject when URL is not provided', async () => {
    const config: FluxHTTPRequestConfig = {};

    await expect(fetchAdapter(config)).rejects.toThrow(/URL is required/);
  });

  it('should handle unknown errors', async () => {
    mockFetch.mockRejectedValue('Unknown error');

    const config: FluxHTTPRequestConfig = {
      url: 'https://api.example.com/test',
    };

    await expect(fetchAdapter(config)).rejects.toThrow(/Unknown error/);
  });

  it('should handle text response by default', async () => {
    const mockResponse = {
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: new Headers(),
      text: vi.fn().mockResolvedValue('plain text response'),
    };
    mockFetch.mockResolvedValue(mockResponse);

    const response = await fetchAdapter({
      url: 'https://api.example.com/test',
    });

    expect(response.data).toBe('plain text response');
  });

  it('should skip body for GET and HEAD requests', async () => {
    const mockResponse = {
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: new Headers(),
      text: vi.fn().mockResolvedValue('test'),
    };
    mockFetch.mockResolvedValue(mockResponse);

    await fetchAdapter({
      url: 'https://api.example.com/test',
      method: 'GET',
      data: 'should be ignored',
    });

    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      expect.not.objectContaining({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        body: expect.anything(),
      })
    );

    mockFetch.mockClear();

    await fetchAdapter({
      url: 'https://api.example.com/test',
      method: 'HEAD',
      data: 'should be ignored',
    });

    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      expect.not.objectContaining({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        body: expect.anything(),
      })
    );
  });
});
