import { describe, it, expect, vi, beforeEach } from 'vitest';
import { xhrAdapter } from '../../../src/adapters/xhr.adapter';
import type { FluxHTTPRequestConfig } from '../../../src/types';

// Mock XMLHttpRequest
class MockXMLHttpRequest {
  static DONE = 4;

  open = vi.fn();
  send = vi.fn();
  abort = vi.fn();
  setRequestHeader = vi.fn();
  getAllResponseHeaders = vi.fn();
  addEventListener = vi.fn();

  status = 200;
  statusText = 'OK';
  response = null;
  responseText = '';
  responseType = '';
  timeout = 0;
  withCredentials = false;
  upload = {
    addEventListener: vi.fn(),
  };

  onloadend: (() => void) | null = null;
  onerror: (() => void) | null = null;
  ontimeout: (() => void) | null = null;

  readyState = 0;
}

global.XMLHttpRequest = MockXMLHttpRequest as any;

describe('xhrAdapter', () => {
  let mockXhr: MockXMLHttpRequest;

  beforeEach(() => {
    mockXhr = new MockXMLHttpRequest();
    vi.spyOn(global, 'XMLHttpRequest').mockImplementation(() => mockXhr as any);
  });

  it('should make a successful GET request', async () => {
    const config: FluxHTTPRequestConfig = {
      url: 'https://api.example.com/test',
      method: 'GET',
      headers: { 'X-Test': 'value' },
    };

    mockXhr.getAllResponseHeaders.mockReturnValue(
      'content-type: application/json\r\nx-test: value'
    );
    mockXhr.responseText = '{"data":"test"}';
    mockXhr.response = { data: 'test' };

    const responsePromise = xhrAdapter(config);

    // Trigger successful response
    mockXhr.readyState = MockXMLHttpRequest.DONE;
    mockXhr.onloadend?.();

    const response = await responsePromise;

    expect(mockXhr.open).toHaveBeenCalledWith('GET', 'https://api.example.com/test', true);
    expect(mockXhr.setRequestHeader).toHaveBeenCalledWith('X-Test', 'value');
    expect(mockXhr.send).toHaveBeenCalled();
    expect(response.status).toBe(200);
    expect(response.data).toEqual({ data: 'test' });
  });

  it('should handle POST request with data', async () => {
    const config: FluxHTTPRequestConfig = {
      url: 'https://api.example.com/users',
      method: 'POST',
      data: JSON.stringify({ name: 'test' }),
      headers: { 'Content-Type': 'application/json' },
    };

    mockXhr.getAllResponseHeaders.mockReturnValue('');
    mockXhr.status = 201;
    mockXhr.response = { id: 1 };

    const responsePromise = xhrAdapter(config);
    mockXhr.onloadend?.();

    const response = await responsePromise;

    expect(mockXhr.send).toHaveBeenCalledWith(JSON.stringify({ name: 'test' }));
    expect(response.status).toBe(201);
  });

  it('should handle query parameters', async () => {
    const config: FluxHTTPRequestConfig = {
      url: 'https://api.example.com/search',
      method: 'GET',
      params: { q: 'test', limit: 10 },
    };

    mockXhr.getAllResponseHeaders.mockReturnValue('');

    const responsePromise = xhrAdapter(config);
    mockXhr.onloadend?.();

    await responsePromise;

    expect(mockXhr.open).toHaveBeenCalledWith(
      'GET',
      'https://api.example.com/search?q=test&limit=10',
      true
    );
  });

  it('should handle timeout', async () => {
    const config: FluxHTTPRequestConfig = {
      url: 'https://api.example.com/test',
      timeout: 1000,
    };

    mockXhr.getAllResponseHeaders.mockReturnValue('');

    const responsePromise = xhrAdapter(config);
    mockXhr.ontimeout?.();

    await expect(responsePromise).rejects.toThrow(/timeout/i);
    expect(mockXhr.timeout).toBe(1000);
  });

  it('should handle network error', async () => {
    const config: FluxHTTPRequestConfig = {
      url: 'https://api.example.com/test',
    };

    const responsePromise = xhrAdapter(config);
    mockXhr.onerror?.();

    await expect(responsePromise).rejects.toThrow(/network error/i);
  });

  it('should handle abort signal', async () => {
    const controller = new AbortController();
    const config: FluxHTTPRequestConfig = {
      url: 'https://api.example.com/test',
      signal: controller.signal,
    };

    const abortListener = vi.fn();
    controller.signal.addEventListener = abortListener;

    const responsePromise = xhrAdapter(config);

    // Get the abort handler that was registered
    const abortHandler = abortListener.mock.calls[0][1];
    abortHandler();

    await expect(responsePromise).rejects.toThrow(/aborted/i);
    expect(mockXhr.abort).toHaveBeenCalled();
  });

  it('should handle non-2xx status codes', async () => {
    const config: FluxHTTPRequestConfig = {
      url: 'https://api.example.com/test',
    };

    mockXhr.status = 404;
    mockXhr.statusText = 'Not Found';
    mockXhr.getAllResponseHeaders.mockReturnValue('');

    const responsePromise = xhrAdapter(config);
    mockXhr.onloadend?.();

    await expect(responsePromise).rejects.toThrow(/404/);
  });

  it('should use custom validateStatus', async () => {
    const config: FluxHTTPRequestConfig = {
      url: 'https://api.example.com/test',
      validateStatus: (status) => status < 500,
    };

    mockXhr.status = 404;
    mockXhr.getAllResponseHeaders.mockReturnValue('');

    const responsePromise = xhrAdapter(config);
    mockXhr.onloadend?.();

    const response = await responsePromise;
    expect(response.status).toBe(404);
  });

  it('should handle withCredentials', async () => {
    const config: FluxHTTPRequestConfig = {
      url: 'https://api.example.com/test',
      withCredentials: true,
    };

    mockXhr.getAllResponseHeaders.mockReturnValue('');

    const responsePromise = xhrAdapter(config);
    mockXhr.onloadend?.();

    await responsePromise;

    expect(mockXhr.withCredentials).toBe(true);
  });

  it('should handle responseType', async () => {
    const config: FluxHTTPRequestConfig = {
      url: 'https://api.example.com/test',
      responseType: 'blob',
    };

    mockXhr.getAllResponseHeaders.mockReturnValue('');

    const responsePromise = xhrAdapter(config);
    mockXhr.onloadend?.();

    await responsePromise;

    expect(mockXhr.responseType).toBe('blob');
  });

  it('should parse JSON response when responseType is json', async () => {
    const config: FluxHTTPRequestConfig = {
      url: 'https://api.example.com/test',
      responseType: 'json',
    };

    mockXhr.getAllResponseHeaders.mockReturnValue('');
    mockXhr.responseText = '{"data":"test"}';

    const responsePromise = xhrAdapter(config);
    mockXhr.onloadend?.();

    const response = await responsePromise;
    expect(response.data).toEqual({ data: 'test' });
  });

  it('should handle malformed JSON gracefully', async () => {
    const config: FluxHTTPRequestConfig = {
      url: 'https://api.example.com/test',
      responseType: 'json',
    };

    mockXhr.getAllResponseHeaders.mockReturnValue('');
    mockXhr.responseText = 'Invalid JSON';

    const responsePromise = xhrAdapter(config);
    mockXhr.onloadend?.();

    const response = await responsePromise;
    expect(response.data).toBe('Invalid JSON');
  });

  it('should handle download progress', async () => {
    const onDownloadProgress = vi.fn();
    const config: FluxHTTPRequestConfig = {
      url: 'https://api.example.com/test',
      onDownloadProgress,
    };

    mockXhr.getAllResponseHeaders.mockReturnValue('');

    const responsePromise = xhrAdapter(config);

    // Get the progress handler
    const progressHandler = mockXhr.addEventListener.mock.calls.find(
      (call) => call[0] === 'progress'
    )?.[1];

    // Simulate progress event
    progressHandler?.({
      lengthComputable: true,
      loaded: 50,
      total: 100,
    });

    mockXhr.onloadend?.();
    await responsePromise;

    expect(onDownloadProgress).toHaveBeenCalledWith({
      loaded: 50,
      total: 100,
      progress: 0.5,
      bytes: 50,
    });
  });

  it('should handle upload progress', async () => {
    const onUploadProgress = vi.fn();
    const config: FluxHTTPRequestConfig = {
      url: 'https://api.example.com/test',
      method: 'POST',
      data: 'test',
      onUploadProgress,
    };

    mockXhr.getAllResponseHeaders.mockReturnValue('');

    const responsePromise = xhrAdapter(config);

    // Get the upload progress handler
    const progressHandler = mockXhr.upload.addEventListener.mock.calls.find(
      (call) => call[0] === 'progress'
    )?.[1];

    // Simulate progress event
    progressHandler?.({
      lengthComputable: true,
      loaded: 25,
      total: 50,
    });

    mockXhr.onloadend?.();
    await responsePromise;

    expect(onUploadProgress).toHaveBeenCalledWith({
      loaded: 25,
      total: 50,
      progress: 0.5,
      bytes: 25,
      upload: true,
    });
  });

  it('should handle progress event without total', async () => {
    const onDownloadProgress = vi.fn();
    const config: FluxHTTPRequestConfig = {
      url: 'https://api.example.com/test',
      onDownloadProgress,
    };

    mockXhr.getAllResponseHeaders.mockReturnValue('');

    const responsePromise = xhrAdapter(config);

    const progressHandler = mockXhr.addEventListener.mock.calls.find(
      (call) => call[0] === 'progress'
    )?.[1];

    // Simulate progress event without total
    progressHandler?.({
      lengthComputable: false,
      loaded: 50,
    });

    mockXhr.onloadend?.();
    await responsePromise;

    expect(onDownloadProgress).not.toHaveBeenCalled();
  });
});
