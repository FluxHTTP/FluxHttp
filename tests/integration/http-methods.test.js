const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');

// Import the main library
const fluxhttpModule = require('../../dist/index.js');
const fluxhttp = fluxhttpModule.default || fluxhttpModule;

/**
 * Helper function to parse JSON response data
 * Handles both string and object responses from different adapters
 */
function parseResponseData(data) {
  if (typeof data === 'string') {
    try {
      return JSON.parse(data);
    } catch {
      return data;
    }
  }
  return data;
}

/**
 * Real HTTP Methods Integration Tests
 * Tests all HTTP methods against live httpbin.org endpoints
 * 
 * Note: These tests make real network requests and may be affected by network conditions
 */
describe('Real HTTP Methods Integration Tests', () => {
  let client;
  const HTTPBIN_BASE = 'https://httpbin.org';
  const REQUEST_TIMEOUT = 10000; // 10 second timeout for network requests

  beforeEach(() => {
    client = fluxhttp.create({
      timeout: REQUEST_TIMEOUT,
      headers: {
        'User-Agent': 'FluxHTTP-Test/1.0.0',
        'Accept': 'application/json'
      }
    });
  });

  afterEach(() => {
    // Clean up any pending requests
    if (global.gc) {
      global.gc();
    }
  });

  describe('GET requests', () => {
    it('should perform basic GET request', async () => {
      const response = await client.get(`${HTTPBIN_BASE}/get`);
      
      assert.strictEqual(response.status, 200);
      
      const data = parseResponseData(response.data);
      
      assert.strictEqual(typeof data, 'object');
      assert.strictEqual(data.url, `${HTTPBIN_BASE}/get`);
      assert(data.headers, 'Should include request headers');
      assert.strictEqual(data.headers['User-Agent'], 'FluxHTTP-Test/1.0.0');
    });

    it('should handle GET with query parameters', async () => {
      const params = {
        name: 'John Doe',
        age: 30,
        active: true,
        tags: ['user', 'premium']
      };

      const response = await client.get(`${HTTPBIN_BASE}/get`, { params });
      
      assert.strictEqual(response.status, 200);
      
      const data = parseResponseData(response.data);
      assert.deepStrictEqual(data.args, {
        name: 'John Doe',
        age: '30',
        active: 'true',
        tags: ['user', 'premium']
      });
    });

    it('should handle GET with custom headers', async () => {
      const customHeaders = {
        'X-Custom-Header': 'test-value',
        'Authorization': 'Bearer test-token',
        'X-Request-ID': 'req-123'
      };

      const response = await client.get(`${HTTPBIN_BASE}/get`, {
        headers: customHeaders
      });
      
      assert.strictEqual(response.status, 200);
      
      const data = parseResponseData(response.data);
      assert.strictEqual(data.headers['X-Custom-Header'], 'test-value');
      assert.strictEqual(data.headers['Authorization'], 'Bearer test-token');
      assert.strictEqual(data.headers['X-Request-ID'], 'req-123');
    });

    it('should handle JSON response parsing', async () => {
      const response = await client.get(`${HTTPBIN_BASE}/json`);
      
      assert.strictEqual(response.status, 200);
      
      const data = parseResponseData(response.data);
      assert.strictEqual(typeof data, 'object');
      assert(data.slideshow, 'Should parse JSON response');
      assert.strictEqual(data.slideshow.title, 'Sample Slide Show');
    });
  });

  describe('POST requests', () => {
    it('should perform basic POST with JSON data', async () => {
      const postData = {
        name: 'John Doe',
        email: 'john@example.com',
        age: 30,
        preferences: {
          theme: 'dark',
          notifications: true
        }
      };

      const response = await client.post(`${HTTPBIN_BASE}/post`, postData);
      
      assert.strictEqual(response.status, 200);
      
      const data = parseResponseData(response.data);
      assert.deepStrictEqual(data.json, postData);
      assert.strictEqual(data.headers['Content-Type'], 'application/json');
    });

    it('should handle POST with form data', async () => {
      const formData = {
        username: 'testuser',
        password: 'testpass',
        remember: 'on'
      };

      const response = await client.post(`${HTTPBIN_BASE}/post`, formData, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });
      
      assert.strictEqual(response.status, 200);
      
      const data = parseResponseData(response.data);
      assert.deepStrictEqual(data.form, formData);
    });

    it('should handle POST with plain text data', async () => {
      const textData = 'This is plain text content for testing';

      const response = await client.post(`${HTTPBIN_BASE}/post`, textData, {
        headers: {
          'Content-Type': 'text/plain'
        }
      });
      
      assert.strictEqual(response.status, 200);
      assert.strictEqual(response.data.data, textData);
      assert.strictEqual(response.data.headers['Content-Type'], 'text/plain');
    });

    it('should handle POST with binary data', async () => {
      const binaryData = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]); // PNG header

      const response = await client.post(`${HTTPBIN_BASE}/post`, binaryData, {
        headers: {
          'Content-Type': 'application/octet-stream'
        }
      });
      
      assert.strictEqual(response.status, 200);
      assert(response.data.data, 'Should include binary data');
      assert.strictEqual(response.data.headers['Content-Type'], 'application/octet-stream');
    });
  });

  describe('PUT requests', () => {
    it('should perform PUT request with data', async () => {
      const updateData = {
        id: 123,
        name: 'Updated Name',
        version: 2,
        lastModified: new Date().toISOString()
      };

      const response = await client.put(`${HTTPBIN_BASE}/put`, updateData);
      
      assert.strictEqual(response.status, 200);
      assert.deepStrictEqual(response.data.json, updateData);
      assert.strictEqual(response.data.headers['Content-Type'], 'application/json');
    });

    it('should handle PUT with query parameters and data', async () => {
      const updateData = { status: 'active' };
      const params = { version: '2', force: 'true' };

      const response = await client.put(`${HTTPBIN_BASE}/put`, updateData, { params });
      
      assert.strictEqual(response.status, 200);
      assert.deepStrictEqual(response.data.json, updateData);
      assert.deepStrictEqual(response.data.args, { version: '2', force: 'true' });
    });
  });

  describe('PATCH requests', () => {
    it('should perform PATCH request with partial data', async () => {
      const patchData = {
        status: 'inactive',
        lastUpdated: new Date().toISOString()
      };

      const response = await client.patch(`${HTTPBIN_BASE}/patch`, patchData);
      
      assert.strictEqual(response.status, 200);
      assert.deepStrictEqual(response.data.json, patchData);
      assert.strictEqual(response.data.headers['Content-Type'], 'application/json');
    });

    it('should handle PATCH with custom headers', async () => {
      const patchData = { field: 'value' };
      const headers = {
        'If-Match': '"abc123"',
        'X-Patch-Strategy': 'merge'
      };

      const response = await client.patch(`${HTTPBIN_BASE}/patch`, patchData, { headers });
      
      assert.strictEqual(response.status, 200);
      assert.deepStrictEqual(response.data.json, patchData);
      assert.strictEqual(response.data.headers['If-Match'], '"abc123"');
      assert.strictEqual(response.data.headers['X-Patch-Strategy'], 'merge');
    });
  });

  describe('DELETE requests', () => {
    it('should perform basic DELETE request', async () => {
      const response = await client.delete(`${HTTPBIN_BASE}/delete`);
      
      assert.strictEqual(response.status, 200);
      assert.strictEqual(response.data.url, `${HTTPBIN_BASE}/delete`);
      assert(response.data.headers, 'Should include request headers');
    });

    it('should handle DELETE with query parameters', async () => {
      const params = {
        force: 'true',
        reason: 'cleanup'
      };

      const response = await client.delete(`${HTTPBIN_BASE}/delete`, { params });
      
      assert.strictEqual(response.status, 200);
      assert.deepStrictEqual(response.data.args, { force: 'true', reason: 'cleanup' });
    });

    it('should handle DELETE with authorization header', async () => {
      const response = await client.delete(`${HTTPBIN_BASE}/delete`, {
        headers: {
          'Authorization': 'Bearer delete-token'
        }
      });
      
      assert.strictEqual(response.status, 200);
      assert.strictEqual(response.data.headers['Authorization'], 'Bearer delete-token');
    });
  });

  describe('HEAD requests', () => {
    it('should perform HEAD request and receive headers only', async () => {
      const response = await client.head(`${HTTPBIN_BASE}/get`);
      
      assert.strictEqual(response.status, 200);
      assert.strictEqual(response.data, ''); // HEAD should have no body
      assert(response.headers, 'Should include response headers');
      assert(response.headers['content-type'], 'Should include content-type header');
    });

    it('should handle HEAD with custom headers', async () => {
      const response = await client.head(`${HTTPBIN_BASE}/get`, {
        headers: {
          'X-Head-Test': 'true'
        }
      });
      
      assert.strictEqual(response.status, 200);
      assert.strictEqual(response.data, '');
      assert(response.headers, 'Should include response headers');
    });
  });

  describe('OPTIONS requests', () => {
    it('should perform OPTIONS request', async () => {
      const response = await client.options(`${HTTPBIN_BASE}/get`);
      
      assert.strictEqual(response.status, 200);
      assert(response.headers, 'Should include response headers');
      // httpbin.org typically returns allowed methods in response data for OPTIONS
      if (response.data && typeof response.data === 'object') {
        assert(response.data.url, 'Should include request URL');
      }
    });

    it('should handle CORS preflight simulation', async () => {
      const response = await client.options(`${HTTPBIN_BASE}/get`, {
        headers: {
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'Content-Type, Authorization',
          'Origin': 'https://example.com'
        }
      });
      
      assert.strictEqual(response.status, 200);
      assert(response.headers, 'Should include CORS headers in response');
    });
  });

  describe('Status code handling', () => {
    it('should handle 200 OK responses', async () => {
      const response = await client.get(`${HTTPBIN_BASE}/status/200`);
      assert.strictEqual(response.status, 200);
    });

    it('should handle 201 Created responses', async () => {
      const response = await client.get(`${HTTPBIN_BASE}/status/201`);
      assert.strictEqual(response.status, 201);
    });

    it('should handle 204 No Content responses', async () => {
      const response = await client.get(`${HTTPBIN_BASE}/status/204`);
      assert.strictEqual(response.status, 204);
      // 204 responses should have no content
      assert(response.data === '' || response.data === null || response.data === undefined);
    });

    it('should handle 300 redirects (when not following)', async () => {
      try {
        await client.get(`${HTTPBIN_BASE}/status/300`);
        assert.fail('Should have thrown an error for 300 status');
      } catch (error) {
        assert(error.response);
        assert.strictEqual(error.response.status, 300);
      }
    });

    it('should handle 404 Not Found errors', async () => {
      try {
        await client.get(`${HTTPBIN_BASE}/status/404`);
        assert.fail('Should have thrown an error for 404 status');
      } catch (error) {
        assert(error.response);
        assert.strictEqual(error.response.status, 404);
      }
    });

    it('should handle 500 Internal Server Error', async () => {
      try {
        await client.get(`${HTTPBIN_BASE}/status/500`);
        assert.fail('Should have thrown an error for 500 status');
      } catch (error) {
        assert(error.response);
        assert.strictEqual(error.response.status, 500);
      }
    });
  });

  describe('Response format handling', () => {
    it('should handle XML responses', async () => {
      const response = await client.get(`${HTTPBIN_BASE}/xml`);
      
      assert.strictEqual(response.status, 200);
      assert.strictEqual(typeof response.data, 'string');
      assert(response.data.includes('<?xml'), 'Should be XML content');
      assert(response.headers['content-type'].includes('xml'), 'Should have XML content type');
    });

    it('should handle HTML responses', async () => {
      const response = await client.get(`${HTTPBIN_BASE}/html`);
      
      assert.strictEqual(response.status, 200);
      assert.strictEqual(typeof response.data, 'string');
      assert(response.data.includes('<html'), 'Should be HTML content');
      assert(response.headers['content-type'].includes('html'), 'Should have HTML content type');
    });

    it('should handle different encodings', async () => {
      // Test with different Accept-Encoding headers
      const response = await client.get(`${HTTPBIN_BASE}/gzip`, {
        headers: {
          'Accept-Encoding': 'gzip, deflate'
        }
      });
      
      assert.strictEqual(response.status, 200);
      assert.strictEqual(typeof response.data, 'object');
      assert.strictEqual(response.data.gzipped, true);
    });
  });

  describe('Authentication scenarios', () => {
    it('should handle basic authentication success', async () => {
      const username = 'testuser';
      const password = 'testpass';
      
      const response = await client.get(`${HTTPBIN_BASE}/basic-auth/${username}/${password}`, {
        headers: {
          'Authorization': `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`
        }
      });
      
      assert.strictEqual(response.status, 200);
      assert.strictEqual(response.data.authenticated, true);
      assert.strictEqual(response.data.user, username);
    });

    it('should handle basic authentication failure', async () => {
      try {
        await client.get(`${HTTPBIN_BASE}/basic-auth/user/pass`, {
          headers: {
            'Authorization': 'Basic d3JvbmdAY3JlZGVudGlhbHM=' // wrong credentials
          }
        });
        assert.fail('Should have thrown authentication error');
      } catch (error) {
        assert(error.response);
        assert.strictEqual(error.response.status, 401);
      }
    });

    it('should handle bearer token authentication', async () => {
      const token = 'test-bearer-token';
      
      const response = await client.get(`${HTTPBIN_BASE}/bearer`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      assert.strictEqual(response.status, 200);
      assert.strictEqual(response.data.authenticated, true);
      assert.strictEqual(response.data.token, token);
    });
  });

  describe('Edge cases and robustness', () => {
    it('should handle URLs with special characters', async () => {
      const specialChars = 'test with spaces & symbols!@#$%';
      const encoded = encodeURIComponent(specialChars);
      
      const response = await client.get(`${HTTPBIN_BASE}/get`, {
        params: { q: specialChars }
      });
      
      assert.strictEqual(response.status, 200);
      assert.strictEqual(response.data.args.q, specialChars);
    });

    it('should handle very long URLs', async () => {
      const longParam = 'a'.repeat(1000); // 1000 character parameter
      
      const response = await client.get(`${HTTPBIN_BASE}/get`, {
        params: { longParam }
      });
      
      assert.strictEqual(response.status, 200);
      assert.strictEqual(response.data.args.longParam, longParam);
    });

    it('should handle multiple same-named parameters', async () => {
      // Test array parameters
      const response = await client.get(`${HTTPBIN_BASE}/get`, {
        params: {
          tags: ['tag1', 'tag2', 'tag3']
        }
      });
      
      assert.strictEqual(response.status, 200);
      assert.deepStrictEqual(response.data.args.tags, ['tag1', 'tag2', 'tag3']);
    });

    it('should handle empty request bodies appropriately', async () => {
      const response = await client.post(`${HTTPBIN_BASE}/post`, null);
      
      assert.strictEqual(response.status, 200);
      // Should handle null/empty body gracefully
      assert(response.data, 'Should have response data');
    });

    it('should preserve exact header casing when possible', async () => {
      const customHeaders = {
        'X-Custom-CamelCase': 'test',
        'x-custom-lowercase': 'test',
        'X-CUSTOM-UPPERCASE': 'test'
      };

      const response = await client.get(`${HTTPBIN_BASE}/get`, {
        headers: customHeaders
      });
      
      assert.strictEqual(response.status, 200);
      // Note: HTTP headers are case-insensitive, but we should preserve what we can
      const receivedHeaders = response.data.headers;
      assert(receivedHeaders['X-Custom-CamelCase'] || receivedHeaders['x-custom-camelcase']);
      assert(receivedHeaders['x-custom-lowercase'] || receivedHeaders['X-Custom-Lowercase']);
      assert(receivedHeaders['X-CUSTOM-UPPERCASE'] || receivedHeaders['x-custom-uppercase']);
    });
  });
});