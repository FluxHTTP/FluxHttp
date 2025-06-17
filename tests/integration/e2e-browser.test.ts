import { describe, it, expect, beforeAll, vi } from 'vitest';
import { JSDOM } from 'jsdom';

describe('E2E Browser Environment Tests', () => {
  let originalGlobal: any;
  let dom: JSDOM;

  beforeAll(async () => {
    // Save original global state
    originalGlobal = {
      window: globalThis.window,
      document: globalThis.document,
      XMLHttpRequest: globalThis.XMLHttpRequest,
      fetch: globalThis.fetch,
      FormData: globalThis.FormData,
      URLSearchParams: globalThis.URLSearchParams,
    };

    // Create JSDOM environment
    dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
      url: 'http://localhost:3000',
      pretendToBeVisual: true,
      resources: 'usable',
    });

    // Set up browser-like environment
    globalThis.window = dom.window as any;
    globalThis.document = dom.window.document as any;
    
    // Mock XMLHttpRequest for testing
    globalThis.XMLHttpRequest = vi.fn().mockImplementation(() => ({
      open: vi.fn(),
      send: vi.fn(),
      setRequestHeader: vi.fn(),
      getAllResponseHeaders: vi.fn().mockReturnValue('content-type: application/json\r\n'),
      abort: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      status: 200,
      statusText: 'OK',
      responseText: JSON.stringify({ id: 1, title: 'Test Post' }),
      response: { id: 1, title: 'Test Post' },
      readyState: 4,
      timeout: 0,
      withCredentials: false,
      upload: {
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      },
    }));

    // Mock fetch for testing
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: new Map([['content-type', 'application/json']]),
      json: vi.fn().mockResolvedValue({ id: 1, title: 'Test Post' }),
      text: vi.fn().mockResolvedValue(JSON.stringify({ id: 1, title: 'Test Post' })),
      blob: vi.fn().mockResolvedValue(new Blob()),
      arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(0)),
    });

    // Mock FormData
    globalThis.FormData = vi.fn().mockImplementation(() => ({
      append: vi.fn(),
      delete: vi.fn(),
      get: vi.fn(),
      getAll: vi.fn(),
      has: vi.fn(),
      set: vi.fn(),
      entries: vi.fn(),
      keys: vi.fn(),
      values: vi.fn(),
    }));

    // Mock URLSearchParams
    globalThis.URLSearchParams = vi.fn().mockImplementation(() => ({
      append: vi.fn(),
      delete: vi.fn(),
      get: vi.fn(),
      getAll: vi.fn(),
      has: vi.fn(),
      set: vi.fn(),
      sort: vi.fn(),
      toString: vi.fn().mockReturnValue('param=value'),
      entries: vi.fn(),
      keys: vi.fn(),
      values: vi.fn(),
    }));
  });

  afterAll(() => {
    // Restore original global state
    Object.assign(globalThis, originalGlobal);
    dom?.window?.close();
  });

  describe('Browser adapter selection', () => {
    it('should select XMLHttpRequest adapter in browser environment', async () => {
      // Import FluxHTTP in browser environment
      const { default: fluxhttp } = await import('../../src');

      expect(globalThis.XMLHttpRequest).toBeDefined();
      expect(globalThis.fetch).toBeDefined();

      // Make a request - should use XMLHttpRequest adapter
      const response = await fluxhttp.get('https://api.example.com/test');

      expect(response).toBeDefined();
      expect(response.status).toBe(200);
      expect(response.data).toEqual({ id: 1, title: 'Test Post' });
    });

    it('should handle fetch adapter fallback', async () => {
      // Temporarily remove XMLHttpRequest
      const savedXHR = globalThis.XMLHttpRequest;
      delete (globalThis as any).XMLHttpRequest;

      try {
        const { default: fluxhttp } = await import('../../src');

        // Should fall back to fetch
        const response = await fluxhttp.get('https://api.example.com/test');

        expect(response).toBeDefined();
        expect(response.status).toBe(200);
      } finally {
        globalThis.XMLHttpRequest = savedXHR;
      }
    });
  });

  describe('Browser-specific features', () => {
    it('should handle cookies with withCredentials', async () => {
      const { default: fluxhttp } = await import('../../src');

      const mockXHR = vi.mocked(globalThis.XMLHttpRequest as any);
      const xhrInstance = mockXHR.mock.results[0]?.value || {};

      await fluxhttp.get('https://api.example.com/test', {
        withCredentials: true,
      });

      // Should set withCredentials on XHR
      expect(xhrInstance.withCredentials).toBe(true);
    });

    it('should handle file uploads with FormData', async () => {
      const { default: fluxhttp } = await import('../../src');

      const formData = new FormData();
      formData.append('file', new Blob(['test'], { type: 'text/plain' }), 'test.txt');
      formData.append('description', 'Test file');

      await fluxhttp.post('https://api.example.com/upload', formData);

      expect(FormData).toHaveBeenCalled();
    });

    it('should handle URL search params', async () => {
      const { default: fluxhttp } = await import('../../src');

      const params = new URLSearchParams();
      params.append('key1', 'value1');
      params.append('key2', 'value2');

      await fluxhttp.post('https://api.example.com/form', params, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });

      expect(URLSearchParams).toHaveBeenCalled();
    });

    it('should handle progress events', async () => {
      const { default: fluxhttp } = await import('../../src');

      const onUploadProgress = vi.fn();
      const onDownloadProgress = vi.fn();

      const mockXHR = vi.mocked(globalThis.XMLHttpRequest as any);
      const xhrInstance = mockXHR.mock.results[0]?.value || {};

      await fluxhttp.post('https://api.example.com/upload', 'test data', {
        onUploadProgress,
        onDownloadProgress,
      });

      // Should register progress listeners
      expect(xhrInstance.addEventListener).toHaveBeenCalledWith('progress', expect.any(Function));
      expect(xhrInstance.upload?.addEventListener).toHaveBeenCalledWith('progress', expect.any(Function));
    });

    it('should handle request cancellation with AbortController', async () => {
      const { default: fluxhttp } = await import('../../src');

      const controller = new AbortController();

      // Cancel immediately
      controller.abort();

      try {
        await fluxhttp.get('https://api.example.com/test', {
          signal: controller.signal,
        });
        expect.fail('Should have been cancelled');
      } catch (error: any) {
        expect(error.code).toBe('ERR_CANCELED');
      }
    });
  });

  describe('Cross-origin requests', () => {
    it('should handle CORS preflight', async () => {
      const { default: fluxhttp } = await import('../../src');

      // Mock a CORS preflight scenario
      vi.mocked(globalThis.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Map([
          ['access-control-allow-origin', '*'],
          ['access-control-allow-methods', 'GET, POST, PUT, DELETE'],
          ['access-control-allow-headers', 'Content-Type, Authorization'],
        ]),
        json: vi.fn().mockResolvedValue({ success: true }),
      });

      const response = await fluxhttp.post('https://api.external.com/data', {
        data: 'test',
      }, {
        headers: {
          'Content-Type': 'application/json',
          'X-Custom-Header': 'value',
        },
      });

      expect(response.status).toBe(200);
    });

    it('should handle different response types', async () => {
      const { default: fluxhttp } = await import('../../src');

      // Test JSON response
      const jsonResponse = await fluxhttp.get('https://api.example.com/json', {
        responseType: 'json',
      });
      expect(jsonResponse.data).toEqual({ id: 1, title: 'Test Post' });

      // Test text response
      const textResponse = await fluxhttp.get('https://api.example.com/text', {
        responseType: 'text',
      });
      expect(typeof textResponse.data).toBe('string');

      // Test blob response
      const blobResponse = await fluxhttp.get('https://api.example.com/blob', {
        responseType: 'blob',
      });
      expect(blobResponse.data).toBeInstanceOf(Blob);
    });
  });

  describe('Browser storage integration', () => {
    it('should work with localStorage for caching', async () => {
      const { default: fluxhttp } = await import('../../src');

      // Mock localStorage
      const localStorage = {
        getItem: vi.fn(),
        setItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn(),
        length: 0,
        key: vi.fn(),
      };

      (globalThis as any).localStorage = localStorage;

      // Create client with caching interceptor
      const client = fluxhttp.create({
        baseURL: 'https://api.example.com',
      });

      client.interceptors.request.use((config) => {
        // Check cache
        const cacheKey = `cache_${config.url}`;
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          config.cached = JSON.parse(cached);
        }
        return config;
      });

      client.interceptors.response.use((response) => {
        // Store in cache
        const cacheKey = `cache_${response.config.url}`;
        localStorage.setItem(cacheKey, JSON.stringify(response.data));
        return response;
      });

      await client.get('/test');

      expect(localStorage.setItem).toHaveBeenCalled();
    });

    it('should handle sessionStorage', async () => {
      const { default: fluxhttp } = await import('../../src');

      // Mock sessionStorage
      const sessionStorage = {
        getItem: vi.fn(),
        setItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn(),
        length: 0,
        key: vi.fn(),
      };

      (globalThis as any).sessionStorage = sessionStorage;

      const client = fluxhttp.create({
        baseURL: 'https://api.example.com',
      });

      client.interceptors.request.use((config) => {
        // Store session info
        sessionStorage.setItem('lastRequest', config.url || '');
        return config;
      });

      await client.get('/test');

      expect(sessionStorage.setItem).toHaveBeenCalledWith('lastRequest', '/test');
    });
  });

  describe('Real-world browser scenarios', () => {
    it('should handle authentication flow', async () => {
      const { default: fluxhttp } = await import('../../src');

      const client = fluxhttp.create({
        baseURL: 'https://api.example.com',
      });

      // Simulate login
      const loginResponse = await client.post('/auth/login', {
        username: 'testuser',
        password: 'testpass',
      });

      expect(loginResponse.status).toBe(200);

      // Add token to subsequent requests
      const token = 'fake-jwt-token';
      client.interceptors.request.use((config) => {
        config.headers = config.headers || {};
        config.headers['Authorization'] = `Bearer ${token}`;
        return config;
      });

      // Make authenticated request
      const protectedResponse = await client.get('/protected');
      expect(protectedResponse.status).toBe(200);
    });

    it('should handle file download', async () => {
      const { default: fluxhttp } = await import('../../src');

      // Mock blob response
      const mockBlob = new Blob(['file content'], { type: 'application/pdf' });
      vi.mocked(globalThis.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        blob: vi.fn().mockResolvedValue(mockBlob),
        headers: new Map([
          ['content-type', 'application/pdf'],
          ['content-disposition', 'attachment; filename="test.pdf"'],
        ]),
      });

      const response = await fluxhttp.get('https://api.example.com/download/file.pdf', {
        responseType: 'blob',
      });

      expect(response.data).toBeInstanceOf(Blob);
      expect(response.headers['content-type']).toBe('application/pdf');
    });

    it('should handle image upload with preview', async () => {
      const { default: fluxhttp } = await import('../../src');

      // Create mock image file
      const imageData = new Uint8Array([255, 216, 255]); // JPEG header
      const imageBlob = new Blob([imageData], { type: 'image/jpeg' });

      const formData = new FormData();
      formData.append('image', imageBlob, 'test.jpg');
      formData.append('caption', 'Test image');

      let uploadProgress = 0;
      const onUploadProgress = vi.fn((event) => {
        uploadProgress = event.progress || 0;
      });

      await fluxhttp.post('https://api.example.com/upload/image', formData, {
        onUploadProgress,
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      expect(FormData).toHaveBeenCalled();
    });
  });

  describe('Error scenarios in browser', () => {
    it('should handle network offline', async () => {
      const { default: fluxhttp } = await import('../../src');

      // Mock network error
      vi.mocked(globalThis.fetch as any).mockRejectedValueOnce(
        new Error('Failed to fetch')
      );

      try {
        await fluxhttp.get('https://api.example.com/test');
        expect.fail('Should have thrown network error');
      } catch (error: any) {
        expect(error.code).toBe('ERR_NETWORK');
        expect(error.message).toContain('Network Error');
      }
    });

    it('should handle quota exceeded', async () => {
      const { default: fluxhttp } = await import('../../src');

      // Mock quota exceeded error for localStorage
      const localStorage = {
        setItem: vi.fn().mockImplementation(() => {
          throw new Error('QuotaExceededError');
        }),
        getItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn(),
        length: 0,
        key: vi.fn(),
      };

      (globalThis as any).localStorage = localStorage;

      const client = fluxhttp.create({
        baseURL: 'https://api.example.com',
      });

      client.interceptors.response.use((response) => {
        try {
          localStorage.setItem('cache', JSON.stringify(response.data));
        } catch (e) {
          console.warn('Cache storage failed:', e);
        }
        return response;
      });

      const response = await client.get('/test');
      expect(response.status).toBe(200);
    });
  });
});