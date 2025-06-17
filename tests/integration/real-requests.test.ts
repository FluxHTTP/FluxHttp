import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fluxhttp from '../../src';
import type { FluxHTTPInstance, FluxHTTPError } from '../../src';

describe('Integration Tests - Real HTTP Requests', () => {
  let apiClient: FluxHTTPInstance;
  const testBaseURL = 'https://jsonplaceholder.typicode.com';

  beforeAll(() => {
    apiClient = fluxhttp.create({
      baseURL: testBaseURL,
      timeout: 10000,
      headers: {
        'User-Agent': 'FluxHTTP-Integration-Tests',
      },
    });
  });

  describe('GET requests', () => {
    it('should fetch a single resource', async () => {
      const response = await apiClient.get('/posts/1');

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('id', 1);
      expect(response.data).toHaveProperty('userId');
      expect(response.data).toHaveProperty('title');
      expect(response.data).toHaveProperty('body');
      expect(response.headers['content-type']).toContain('application/json');
    });

    it('should fetch a list of resources', async () => {
      const response = await apiClient.get('/posts');

      expect(response.status).toBe(200);
      expect(Array.isArray(response.data)).toBe(true);
      expect(response.data.length).toBeGreaterThan(0);
      expect(response.data[0]).toHaveProperty('id');
    });

    it('should handle query parameters', async () => {
      const response = await apiClient.get('/posts', {
        params: {
          userId: 1,
          _limit: 5,
        },
      });

      expect(response.status).toBe(200);
      expect(Array.isArray(response.data)).toBe(true);
      expect(response.data.length).toBeLessThanOrEqual(5);
      response.data.forEach((post: any) => {
        expect(post.userId).toBe(1);
      });
    });

    it('should handle 404 errors', async () => {
      try {
        await apiClient.get('/posts/999999');
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect((error as FluxHTTPError).response?.status).toBe(404);
        expect((error as FluxHTTPError).isFluxHTTPError).toBe(true);
      }
    });
  });

  describe('POST requests', () => {
    it('should create a new resource', async () => {
      const newPost = {
        title: 'FluxHTTP Integration Test',
        body: 'This is a test post created by FluxHTTP integration tests',
        userId: 1,
      };

      const response = await apiClient.post('/posts', newPost);

      expect(response.status).toBe(201);
      expect(response.data).toMatchObject(newPost);
      expect(response.data).toHaveProperty('id');
    });

    it('should handle form data', async () => {
      const formData = new URLSearchParams({
        title: 'Form Data Post',
        body: 'Posted as form data',
        userId: '1',
      });

      const response = await apiClient.post('/posts', formData, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });

      expect(response.status).toBe(201);
      expect(response.data).toHaveProperty('id');
    });
  });

  describe('PUT requests', () => {
    it('should update an existing resource', async () => {
      const updatedPost = {
        id: 1,
        title: 'Updated Title',
        body: 'Updated body content',
        userId: 1,
      };

      const response = await apiClient.put('/posts/1', updatedPost);

      expect(response.status).toBe(200);
      expect(response.data).toMatchObject(updatedPost);
    });
  });

  describe('PATCH requests', () => {
    it('should partially update a resource', async () => {
      const partialUpdate = {
        title: 'Partially Updated Title',
      };

      const response = await apiClient.patch('/posts/1', partialUpdate);

      expect(response.status).toBe(200);
      expect(response.data.title).toBe(partialUpdate.title);
      expect(response.data).toHaveProperty('id', 1);
    });
  });

  describe('DELETE requests', () => {
    it('should delete a resource', async () => {
      const response = await apiClient.delete('/posts/1');

      expect(response.status).toBe(200);
      // JSONPlaceholder returns empty object for DELETE
      expect(response.data).toEqual({});
    });
  });

  describe('Request headers', () => {
    it('should send custom headers', async () => {
      const response = await apiClient.get('/posts/1', {
        headers: {
          'X-Custom-Header': 'test-value',
          'Accept': 'application/json',
        },
      });

      expect(response.status).toBe(200);
      expect(response.config.headers?.['X-Custom-Header']).toBe('test-value');
    });

    it('should merge instance headers with request headers', async () => {
      const customClient = fluxhttp.create({
        baseURL: testBaseURL,
        headers: {
          'X-Instance-Header': 'instance-value',
        },
      });

      const response = await customClient.get('/posts/1', {
        headers: {
          'X-Request-Header': 'request-value',
        },
      });

      expect(response.status).toBe(200);
      expect(response.config.headers?.['X-Instance-Header']).toBe('instance-value');
      expect(response.config.headers?.['X-Request-Header']).toBe('request-value');
    });
  });

  describe('Interceptors', () => {
    it('should handle request interceptors', async () => {
      const customClient = fluxhttp.create({ baseURL: testBaseURL });
      let interceptorCalled = false;

      customClient.interceptors.request.use((config) => {
        interceptorCalled = true;
        config.headers = config.headers || {};
        config.headers['X-Interceptor'] = 'request-interceptor';
        return config;
      });

      const response = await customClient.get('/posts/1');

      expect(interceptorCalled).toBe(true);
      expect(response.status).toBe(200);
      expect(response.config.headers?.['X-Interceptor']).toBe('request-interceptor');
    });

    it('should handle response interceptors', async () => {
      const customClient = fluxhttp.create({ baseURL: testBaseURL });
      let interceptorCalled = false;

      customClient.interceptors.response.use((response) => {
        interceptorCalled = true;
        response.data.intercepted = true;
        return response;
      });

      const response = await customClient.get('/posts/1');

      expect(interceptorCalled).toBe(true);
      expect(response.status).toBe(200);
      expect(response.data.intercepted).toBe(true);
    });

    it('should handle error interceptors', async () => {
      const customClient = fluxhttp.create({ baseURL: testBaseURL });
      let errorInterceptorCalled = false;

      customClient.interceptors.response.use(
        (response) => response,
        (error) => {
          errorInterceptorCalled = true;
          error.intercepted = true;
          return Promise.reject(error);
        }
      );

      try {
        await customClient.get('/posts/999999');
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(errorInterceptorCalled).toBe(true);
        expect(error.intercepted).toBe(true);
        expect(error.response?.status).toBe(404);
      }
    });
  });

  describe('Timeouts', () => {
    it('should timeout on slow requests', async () => {
      const slowClient = fluxhttp.create({
        baseURL: 'https://httpbin.org',
        timeout: 1000, // 1 second
      });

      try {
        // This endpoint delays response by 3 seconds
        await slowClient.get('/delay/3');
        expect.fail('Should have timed out');
      } catch (error: any) {
        expect(error.code).toBe('ETIMEDOUT');
        expect(error.message).toContain('timeout');
      }
    });
  });

  describe('Response types', () => {
    it('should handle JSON responses', async () => {
      const response = await apiClient.get('/posts/1', {
        responseType: 'json',
      });

      expect(response.status).toBe(200);
      expect(typeof response.data).toBe('object');
      expect(response.data).toHaveProperty('id');
    });

    it('should handle text responses', async () => {
      const response = await apiClient.get('/posts/1', {
        responseType: 'text',
      });

      expect(response.status).toBe(200);
      expect(typeof response.data).toBe('string');
      expect(() => JSON.parse(response.data)).not.toThrow();
    });
  });

  describe('Error handling', () => {
    it('should provide detailed error information', async () => {
      try {
        await apiClient.get('/posts/invalid-id');
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.isFluxHTTPError).toBe(true);
        expect(error.config).toBeDefined();
        expect(error.config.url).toContain('/posts/invalid-id');
        expect(error.response).toBeDefined();
        expect(error.response.status).toBe(404);
        expect(error.message).toContain('404');
      }
    });

    it('should handle network errors', async () => {
      const invalidClient = fluxhttp.create({
        baseURL: 'https://invalid-domain-that-does-not-exist-12345.com',
        timeout: 5000,
      });

      try {
        await invalidClient.get('/test');
        expect.fail('Should have thrown a network error');
      } catch (error: any) {
        expect(error.isFluxHTTPError).toBe(true);
        expect(error.code).toBe('ERR_NETWORK');
        expect(error.message).toContain('Network Error');
      }
    });
  });

  describe('Concurrent requests', () => {
    it('should handle multiple concurrent requests', async () => {
      const requests = [
        apiClient.get('/posts/1'),
        apiClient.get('/posts/2'),
        apiClient.get('/posts/3'),
        apiClient.get('/users/1'),
        apiClient.get('/albums/1'),
      ];

      const responses = await Promise.all(requests);

      expect(responses).toHaveLength(5);
      responses.forEach((response) => {
        expect(response.status).toBe(200);
        expect(response.data).toBeDefined();
      });

      // Verify different resource types
      expect(responses[0].data).toHaveProperty('title'); // post
      expect(responses[3].data).toHaveProperty('username'); // user
      expect(responses[4].data).toHaveProperty('userId'); // album
    });

    it('should handle mixed success and failure', async () => {
      const requests = [
        apiClient.get('/posts/1'),
        apiClient.get('/posts/999999'), // This will fail
        apiClient.get('/posts/3'),
      ];

      const results = await Promise.allSettled(requests);

      expect(results[0].status).toBe('fulfilled');
      expect(results[1].status).toBe('rejected');
      expect(results[2].status).toBe('fulfilled');

      if (results[1].status === 'rejected') {
        expect(results[1].reason.response?.status).toBe(404);
      }
    });
  });

  describe('Cancel requests', () => {
    it('should cancel requests using AbortController', async () => {
      const controller = new AbortController();

      const promise = apiClient.get('/posts', {
        signal: controller.signal,
      });

      // Cancel the request immediately
      controller.abort();

      try {
        await promise;
        expect.fail('Should have been cancelled');
      } catch (error: any) {
        expect(error.code).toBe('ERR_CANCELED');
        expect(error.message).toContain('aborted');
      }
    });
  });

  describe('Base URL handling', () => {
    it('should handle absolute URLs', async () => {
      const response = await apiClient.get('https://jsonplaceholder.typicode.com/posts/1');

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('id', 1);
    });

    it('should handle relative URLs with baseURL', async () => {
      const response = await apiClient.get('/posts/1');

      expect(response.status).toBe(200);
      expect(response.config.url).toBe('/posts/1');
      expect(response.config.baseURL).toBe(testBaseURL);
    });
  });
});