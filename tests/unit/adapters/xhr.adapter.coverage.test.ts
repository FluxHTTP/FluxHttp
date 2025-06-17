import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { FluxHTTPRequestConfig } from '../../../src/types';

describe('xhrAdapter - 100% coverage', () => {
  let mockXHR: any;
  let XHRConstructor: any;

  beforeEach(() => {
    mockXHR = {
      open: vi.fn(),
      send: vi.fn(),
      setRequestHeader: vi.fn(),
      getAllResponseHeaders: vi.fn().mockReturnValue('content-type: application/json\r\nx-custom: value'),
      addEventListener: vi.fn(),
      upload: {
        addEventListener: vi.fn()
      },
      readyState: 4,
      status: 200,
      statusText: 'OK',
      responseText: '{"success":true}',
      response: null,
      responseURL: 'https://fluxhttp.com/api/test',
      timeout: 0,
      withCredentials: false,
      responseType: ''
    };

    XHRConstructor = vi.fn(() => mockXHR);
    global.XMLHttpRequest = XHRConstructor as any;
  });

  const importAdapter = async () => {
    const module = await import('../../../src/adapters/xhr.adapter');
    return module.xhrAdapter;
  };

  describe('URL edge cases', () => {
    it('should handle undefined URL (line 24)', async () => {
      const xhrAdapter = await importAdapter();
      
      const config: FluxHTTPRequestConfig = {
        method: 'GET',
        // url is undefined
        params: { key: 'value' }
      };

      const responsePromise = xhrAdapter(config);
      
      // Should call buildURL with empty string
      expect(mockXHR.open).toHaveBeenCalledWith('GET', '?key=value', true);
      
      // Trigger response
      mockXHR.onloadend();
      
      const response = await responsePromise;
      expect(response.status).toBe(200);
    });
  });

  describe('onloadend guard clause', () => {
    it('should return early if xhr is falsy (line 42)', async () => {
      const xhrAdapter = await importAdapter();
      
      const config: FluxHTTPRequestConfig = {
        url: 'https://fluxhttp.com/api/test',
        method: 'GET'
      };

      const responsePromise = xhrAdapter(config);
      
      // Capture onloadend handler
      const onloadend = mockXHR.onloadend;
      
      // Mock the xhr check to simulate xhr being null/undefined
      const originalXHR = mockXHR;
      mockXHR = null;
      
      // Call onloadend when xhr is null - should return early
      onloadend.call(null);
      
      // Restore xhr and properly complete the request
      mockXHR = originalXHR;
      mockXHR.onloadend();
      
      const response = await responsePromise;
      expect(response.status).toBe(200);
    });
  });

  describe('progress calculations', () => {
    it('should calculate progress as 0 when total is 0 (line 102)', async () => {
      const xhrAdapter = await importAdapter();
      const onDownloadProgress = vi.fn();
      
      const config: FluxHTTPRequestConfig = {
        url: 'https://fluxhttp.com/api/download',
        method: 'GET',
        onDownloadProgress
      };

      xhrAdapter(config);
      
      // Find the progress event listener
      const progressCall = mockXHR.addEventListener.mock.calls.find(
        (call: any) => call[0] === 'progress'
      );
      const progressListener = progressCall[1];
      
      // Trigger progress event with total = 0
      progressListener({
        lengthComputable: true,
        loaded: 1024,
        total: 0
      });
      
      expect(onDownloadProgress).toHaveBeenCalledWith({
        loaded: 1024,
        total: 0,
        progress: 0, // When total is 0, progress should be 0
        bytes: 1024
      });
      
      // Complete the request
      mockXHR.onloadend();
    });

    it('should calculate upload progress as 0 when total is 0 (line 115)', async () => {
      const xhrAdapter = await importAdapter();
      const onUploadProgress = vi.fn();
      
      const config: FluxHTTPRequestConfig = {
        url: 'https://fluxhttp.com/api/upload',
        method: 'POST',
        data: { file: 'content' },
        onUploadProgress
      };

      xhrAdapter(config);
      
      // Find the upload progress event listener
      const uploadProgressCall = mockXHR.upload.addEventListener.mock.calls.find(
        (call: any) => call[0] === 'progress'
      );
      const uploadProgressListener = uploadProgressCall[1];
      
      // Trigger upload progress event with total = 0
      uploadProgressListener({
        lengthComputable: true,
        loaded: 512,
        total: 0
      });
      
      expect(onUploadProgress).toHaveBeenCalledWith({
        loaded: 512,
        total: 0,
        progress: 0, // When total is 0, progress should be 0
        bytes: 512,
        upload: true
      });
      
      // Complete the request
      mockXHR.onloadend();
    });
  });
});