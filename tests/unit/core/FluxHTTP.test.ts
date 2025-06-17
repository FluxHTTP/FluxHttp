import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FluxHTTP } from '../../../src/core/FluxHTTP';
import { InterceptorManager } from '../../../src/interceptors/InterceptorManager';
import * as dispatchRequestModule from '../../../src/interceptors/dispatchRequest';
import * as adaptersModule from '../../../src/adapters';
import type { FluxHTTPRequestConfig, FluxHTTPResponse } from '../../../src/types';

vi.mock('../../../src/interceptors/dispatchRequest');
vi.mock('../../../src/adapters');

describe('FluxHTTP', () => {
  let instance: FluxHTTP;
  let mockAdapter: vi.Mock;
  let mockDispatchRequest: vi.Mock;
  
  beforeEach(() => {
    mockAdapter = vi.fn();
    mockDispatchRequest = vi.fn().mockResolvedValue({
      data: 'test',
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {}
    });
    
    vi.spyOn(adaptersModule, 'getDefaultAdapter').mockReturnValue(mockAdapter);
    vi.spyOn(dispatchRequestModule, 'dispatchRequest').mockImplementation(mockDispatchRequest);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create instance with default config', () => {
      instance = new FluxHTTP();
      
      expect(instance.defaults).toEqual({});
      expect(instance.interceptors.request).toBeInstanceOf(InterceptorManager);
      expect(instance.interceptors.response).toBeInstanceOf(InterceptorManager);
    });

    it('should create instance with custom config', () => {
      const config: FluxHTTPRequestConfig = {
        baseURL: 'https://fluxhttp.com',
        timeout: 5000,
        headers: { 'X-Custom': 'header' }
      };
      
      instance = new FluxHTTP(config);
      
      expect(instance.defaults).toEqual(config);
    });

    it('should use custom adapter if provided', () => {
      const customAdapter = vi.fn();
      instance = new FluxHTTP({ adapter: customAdapter });
      
      // Make a request to trigger adapter usage
      instance.request({ url: '/test' });
      
      expect(adaptersModule.getDefaultAdapter).not.toHaveBeenCalled();
    });

    it('should use default adapter if not provided', () => {
      instance = new FluxHTTP();
      
      expect(adaptersModule.getDefaultAdapter).toHaveBeenCalled();
    });
  });

  describe('request', () => {
    beforeEach(() => {
      instance = new FluxHTTP({ baseURL: 'https://fluxhttp.com' });
    });

    it('should merge config with defaults', async () => {
      const config: FluxHTTPRequestConfig = {
        url: '/api/users',
        method: 'GET'
      };
      
      await instance.request(config);
      
      expect(mockDispatchRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          url: 'https://fluxhttp.com/api/users',
          method: 'GET',
          baseURL: 'https://fluxhttp.com'
        }),
        instance.interceptors.request,
        instance.interceptors.response,
        mockAdapter
      );
    });

    it('should uppercase method', async () => {
      await instance.request({ url: '/test', method: 'get' as any });
      
      expect(mockDispatchRequest).toHaveBeenCalledWith(
        expect.objectContaining({ method: 'GET' }),
        expect.any(Object),
        expect.any(Object),
        expect.any(Function)
      );
    });

    it('should default to GET method', async () => {
      await instance.request({ url: '/test' });
      
      expect(mockDispatchRequest).toHaveBeenCalledWith(
        expect.objectContaining({ method: 'GET' }),
        expect.any(Object),
        expect.any(Object),
        expect.any(Function)
      );
    });

    it('should build full URL from baseURL and url', async () => {
      instance = new FluxHTTP({ baseURL: 'https://fluxhttp.com/api/v1' });
      await instance.request({ url: '/users' });
      
      expect(mockDispatchRequest).toHaveBeenCalledWith(
        expect.objectContaining({ url: 'https://fluxhttp.com/api/v1/users' }),
        expect.any(Object),
        expect.any(Object),
        expect.any(Function)
      );
    });

    it('should handle absolute URLs', async () => {
      await instance.request({ url: 'https://github.com/fluxhttp' });
      
      expect(mockDispatchRequest).toHaveBeenCalledWith(
        expect.objectContaining({ url: 'https://github.com/fluxhttp' }),
        expect.any(Object),
        expect.any(Object),
        expect.any(Function)
      );
    });
  });

  describe('HTTP methods', () => {
    beforeEach(() => {
      instance = new FluxHTTP();
    });

    describe('get', () => {
      it('should make GET request', async () => {
        await instance.get('/users');
        
        expect(mockDispatchRequest).toHaveBeenCalledWith(
          expect.objectContaining({ method: 'GET', url: '/users' }),
          expect.any(Object),
          expect.any(Object),
          expect.any(Function)
        );
      });

      it('should accept config', async () => {
        await instance.get('/users', { headers: { 'X-Custom': 'header' } });
        
        expect(mockDispatchRequest).toHaveBeenCalledWith(
          expect.objectContaining({
            method: 'GET',
            url: '/users',
            headers: { 'x-custom': 'header' }
          }),
          expect.any(Object),
          expect.any(Object),
          expect.any(Function)
        );
      });
    });

    describe('delete', () => {
      it('should make DELETE request', async () => {
        await instance.delete('/users/1');
        
        expect(mockDispatchRequest).toHaveBeenCalledWith(
          expect.objectContaining({ method: 'DELETE', url: '/users/1' }),
          expect.any(Object),
          expect.any(Object),
          expect.any(Function)
        );
      });

      it('should accept config', async () => {
        await instance.delete('/users/1', { headers: { 'X-Custom': 'header' } });
        
        expect(mockDispatchRequest).toHaveBeenCalledWith(
          expect.objectContaining({
            method: 'DELETE',
            url: '/users/1',
            headers: { 'x-custom': 'header' }
          }),
          expect.any(Object),
          expect.any(Object),
          expect.any(Function)
        );
      });
    });

    describe('head', () => {
      it('should make HEAD request', async () => {
        await instance.head('/users');
        
        expect(mockDispatchRequest).toHaveBeenCalledWith(
          expect.objectContaining({ method: 'HEAD', url: '/users' }),
          expect.any(Object),
          expect.any(Object),
          expect.any(Function)
        );
      });

      it('should accept config', async () => {
        await instance.head('/users', { timeout: 3000 });
        
        expect(mockDispatchRequest).toHaveBeenCalledWith(
          expect.objectContaining({
            method: 'HEAD',
            url: '/users',
            timeout: 3000
          }),
          expect.any(Object),
          expect.any(Object),
          expect.any(Function)
        );
      });
    });

    describe('options', () => {
      it('should make OPTIONS request', async () => {
        await instance.options('/users');
        
        expect(mockDispatchRequest).toHaveBeenCalledWith(
          expect.objectContaining({ method: 'OPTIONS', url: '/users' }),
          expect.any(Object),
          expect.any(Object),
          expect.any(Function)
        );
      });

      it('should accept config', async () => {
        await instance.options('/users', { timeout: 3000 });
        
        expect(mockDispatchRequest).toHaveBeenCalledWith(
          expect.objectContaining({
            method: 'OPTIONS',
            url: '/users',
            timeout: 3000
          }),
          expect.any(Object),
          expect.any(Object),
          expect.any(Function)
        );
      });
    });

    describe('post', () => {
      it('should make POST request with data', async () => {
        const data = { name: 'John', email: 'john@fluxhttp.com' };
        await instance.post('/users', data);
        
        expect(mockDispatchRequest).toHaveBeenCalledWith(
          expect.objectContaining({ method: 'POST', url: '/users', data }),
          expect.any(Object),
          expect.any(Object),
          expect.any(Function)
        );
      });

      it('should make POST request without data', async () => {
        await instance.post('/users');
        
        expect(mockDispatchRequest).toHaveBeenCalledWith(
          expect.objectContaining({ method: 'POST', url: '/users' }),
          expect.any(Object),
          expect.any(Object),
          expect.any(Function)
        );
      });

      it('should accept config', async () => {
        const data = { name: 'John' };
        await instance.post('/users', data, { headers: { 'X-Custom': 'header' } });
        
        expect(mockDispatchRequest).toHaveBeenCalledWith(
          expect.objectContaining({
            method: 'POST',
            url: '/users',
            data,
            headers: { 'x-custom': 'header' }
          }),
          expect.any(Object),
          expect.any(Object),
          expect.any(Function)
        );
      });
    });

    describe('put', () => {
      it('should make PUT request with data', async () => {
        const data = { name: 'John Updated', email: 'john@fluxhttp.com' };
        await instance.put('/users/1', data);
        
        expect(mockDispatchRequest).toHaveBeenCalledWith(
          expect.objectContaining({ method: 'PUT', url: '/users/1', data }),
          expect.any(Object),
          expect.any(Object),
          expect.any(Function)
        );
      });

      it('should make PUT request without data', async () => {
        await instance.put('/users/1');
        
        expect(mockDispatchRequest).toHaveBeenCalledWith(
          expect.objectContaining({ method: 'PUT', url: '/users/1' }),
          expect.any(Object),
          expect.any(Object),
          expect.any(Function)
        );
      });

      it('should accept config', async () => {
        const data = { name: 'John' };
        await instance.put('/users/1', data, { timeout: 5000 });
        
        expect(mockDispatchRequest).toHaveBeenCalledWith(
          expect.objectContaining({
            method: 'PUT',
            url: '/users/1',
            data,
            timeout: 5000
          }),
          expect.any(Object),
          expect.any(Object),
          expect.any(Function)
        );
      });
    });

    describe('patch', () => {
      it('should make PATCH request with data', async () => {
        const data = { name: 'John Patched' };
        await instance.patch('/users/1', data);
        
        expect(mockDispatchRequest).toHaveBeenCalledWith(
          expect.objectContaining({ method: 'PATCH', url: '/users/1', data }),
          expect.any(Object),
          expect.any(Object),
          expect.any(Function)
        );
      });

      it('should make PATCH request without data', async () => {
        await instance.patch('/users/1');
        
        expect(mockDispatchRequest).toHaveBeenCalledWith(
          expect.objectContaining({ method: 'PATCH', url: '/users/1' }),
          expect.any(Object),
          expect.any(Object),
          expect.any(Function)
        );
      });

      it('should accept config', async () => {
        const data = { status: 'active' };
        await instance.patch('/users/1', data, { headers: { 'X-API-Key': '123' } });
        
        expect(mockDispatchRequest).toHaveBeenCalledWith(
          expect.objectContaining({
            method: 'PATCH',
            url: '/users/1',
            data,
            headers: { 'x-api-key': '123' }
          }),
          expect.any(Object),
          expect.any(Object),
          expect.any(Function)
        );
      });
    });
  });

  describe('getUri', () => {
    it('should return URL without baseURL', () => {
      instance = new FluxHTTP();
      const uri = instance.getUri({ url: '/users' });
      
      expect(uri).toBe('/users');
    });

    it('should return URL with baseURL', () => {
      instance = new FluxHTTP({ baseURL: 'https://fluxhttp.com/api' });
      const uri = instance.getUri({ url: '/users' });
      
      expect(uri).toBe('https://fluxhttp.com/api/users');
    });

    it('should use instance defaults', () => {
      instance = new FluxHTTP({ baseURL: 'https://fluxhttp.com/api' });
      const uri = instance.getUri();
      
      expect(uri).toBe('https://fluxhttp.com/api');
    });

    it('should override instance defaults', () => {
      instance = new FluxHTTP({ baseURL: 'https://fluxhttp.com/api' });
      const uri = instance.getUri({ baseURL: 'https://github.com/fluxhttp', url: '/repo' });
      
      expect(uri).toBe('https://github.com/fluxhttp/repo');
    });

    it('should handle absolute URLs', () => {
      instance = new FluxHTTP({ baseURL: 'https://fluxhttp.com' });
      const uri = instance.getUri({ url: 'https://github.com/fluxhttp' });
      
      expect(uri).toBe('https://github.com/fluxhttp');
    });
  });
});