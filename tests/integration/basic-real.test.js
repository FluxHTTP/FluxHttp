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
 * Basic Real HTTP Integration Tests
 * Tests basic functionality against live httpbin.org endpoints
 * 
 * These tests are designed to be resilient and focus on core functionality
 * Note: These tests make real network requests and may be affected by network conditions
 */
describe('Basic Real HTTP Integration Tests', () => {
  let client;
  const HTTPBIN_BASE = 'https://httpbin.org';
  const REQUEST_TIMEOUT = 10000; // 10 second timeout

  beforeEach(() => {
    client = fluxhttp.create({
      baseURL: HTTPBIN_BASE,
      timeout: REQUEST_TIMEOUT,
      headers: {
        'User-Agent': 'FluxHTTP-BasicTest/1.0.0'
      }
    });
  });

  afterEach(() => {
    if (global.gc) {
      global.gc();
    }
  });

  describe('Core HTTP Methods', () => {
    it('should handle GET requests', async () => {
      const response = await client.get('/get');
      
      assert.strictEqual(response.status, 200);
      
      const data = parseResponseData(response.data);
      assert.strictEqual(typeof data, 'object');
      assert.strictEqual(data.url, `${HTTPBIN_BASE}/get`);
      assert(data.headers, 'Should include request headers');
    });

    it('should handle POST requests with JSON', async () => {
      const testData = { name: 'Test', value: 123 };
      const response = await client.post('/post', testData);
      
      assert.strictEqual(response.status, 200);
      
      const data = parseResponseData(response.data);
      assert.strictEqual(typeof data, 'object');
      assert(data.json, 'Should include posted JSON data');
      assert.strictEqual(data.json.name, 'Test');
      assert.strictEqual(data.json.value, 123);
    });

    it('should handle PUT requests', async () => {
      const testData = { id: 1, updated: true };
      const response = await client.put('/put', testData);
      
      assert.strictEqual(response.status, 200);
      
      const data = parseResponseData(response.data);
      assert(data.json, 'Should include PUT data');
      assert.strictEqual(data.json.updated, true);
    });

    it('should handle DELETE requests', async () => {
      const response = await client.delete('/delete');
      
      assert.strictEqual(response.status, 200);
      
      const data = parseResponseData(response.data);
      assert.strictEqual(data.url, `${HTTPBIN_BASE}/delete`);
    });

    it('should handle PATCH requests', async () => {
      const patchData = { status: 'updated' };
      const response = await client.patch('/patch', patchData);
      
      assert.strictEqual(response.status, 200);
      
      const data = parseResponseData(response.data);
      assert(data.json, 'Should include PATCH data');
      assert.strictEqual(data.json.status, 'updated');
    });
  });

  describe('Query Parameters', () => {
    it('should handle simple query parameters', async () => {
      const params = { test: 'value', number: 42 };
      const response = await client.get('/get', { params });
      
      assert.strictEqual(response.status, 200);
      
      const data = parseResponseData(response.data);
      assert(data.args, 'Should include query parameters');
      assert.strictEqual(data.args.test, 'value');
      assert.strictEqual(data.args.number, '42'); // Query params are strings
    });

    it('should handle array parameters', async () => {
      const params = { tags: ['tag1', 'tag2'] };
      const response = await client.get('/get', { params });
      
      assert.strictEqual(response.status, 200);
      
      const data = parseResponseData(response.data);
      assert(data.args, 'Should include query parameters');
      // Array handling may vary, so just check that tags are present
      assert(data.args.tags, 'Should include tags parameter');
    });
  });

  describe('Headers', () => {
    it('should send custom headers', async () => {
      const customHeaders = {
        'X-Test-Header': 'test-value',
        'X-Custom': 'custom-value'
      };
      
      const response = await client.get('/get', { headers: customHeaders });
      
      assert.strictEqual(response.status, 200);
      
      const data = parseResponseData(response.data);
      assert(data.headers, 'Should include request headers');
      // Header names might be normalized, so check case-insensitively
      const headers = data.headers;
      let foundTestHeader = false;
      let foundCustomHeader = false;
      
      Object.keys(headers).forEach(key => {
        if (key.toLowerCase() === 'x-test-header') {
          foundTestHeader = headers[key] === 'test-value';
        }
        if (key.toLowerCase() === 'x-custom') {
          foundCustomHeader = headers[key] === 'custom-value';
        }
      });
      
      assert(foundTestHeader, 'Should include X-Test-Header');
      assert(foundCustomHeader, 'Should include X-Custom header');
    });
  });

  describe('Response Handling', () => {
    it('should handle JSON responses', async () => {
      const response = await client.get('/json');
      
      assert.strictEqual(response.status, 200);
      
      const data = parseResponseData(response.data);
      assert.strictEqual(typeof data, 'object');
      assert(data.slideshow, 'Should parse JSON content');
      assert.strictEqual(typeof data.slideshow.title, 'string');
    });

    it('should handle XML responses', async () => {
      const response = await client.get('/xml');
      
      assert.strictEqual(response.status, 200);
      
      // XML will be returned as text
      const content = typeof response.data === 'string' ? response.data : parseResponseData(response.data);
      assert(typeof content === 'string' && content.includes('<?xml'), 'Should return XML content');
    });

    it('should handle HTML responses', async () => {
      const response = await client.get('/html');
      
      assert.strictEqual(response.status, 200);
      
      const content = typeof response.data === 'string' ? response.data : parseResponseData(response.data);
      assert(typeof content === 'string' && content.includes('<html'), 'Should return HTML content');
    });
  });

  describe('Error Handling', () => {
    it('should handle 404 errors', async () => {
      try {
        await client.get('/status/404');
        assert.fail('Should have thrown an error for 404');
      } catch (error) {
        assert(error.response, 'Should have response object');
        assert.strictEqual(error.response.status, 404);
      }
    });

    it('should handle 500 errors', async () => {
      try {
        await client.get('/status/500');
        assert.fail('Should have thrown an error for 500');
      } catch (error) {
        assert(error.response, 'Should have response object');
        assert.strictEqual(error.response.status, 500);
      }
    });

    it('should handle timeout errors', async () => {
      const shortClient = fluxhttp.create({
        baseURL: HTTPBIN_BASE,
        timeout: 1000 // 1 second
      });

      try {
        await shortClient.get('/delay/3'); // 3 second delay
        assert.fail('Should have timed out');
      } catch (error) {
        assert(error.code === 'ECONNABORTED' || error.message.includes('timeout'));
      }
    });
  });

  describe('Interceptors', () => {
    it('should handle request interceptors', async () => {
      client.interceptors.request.use((config) => {
        config.headers = {
          ...config.headers,
          'X-Intercepted': 'true'
        };
        return config;
      });

      const response = await client.get('/get');
      
      assert.strictEqual(response.status, 200);
      
      const data = parseResponseData(response.data);
      assert(data.headers, 'Should include headers');
      
      // Check if interceptor header was included
      let foundInterceptorHeader = false;
      Object.keys(data.headers).forEach(key => {
        if (key.toLowerCase() === 'x-intercepted') {
          foundInterceptorHeader = data.headers[key] === 'true';
        }
      });
      
      assert(foundInterceptorHeader, 'Should include interceptor header');
    });

    it('should handle response interceptors', async () => {
      client.interceptors.response.use((response) => {
        response.data = {
          ...parseResponseData(response.data),
          intercepted: true
        };
        return response;
      });

      const response = await client.get('/get');
      
      assert.strictEqual(response.status, 200);
      assert(response.data.intercepted, 'Should be marked as intercepted');
    });
  });

  describe('Concurrent Requests', () => {
    it('should handle multiple concurrent requests', async () => {
      const promises = [
        client.get('/get?req=1'),
        client.get('/get?req=2'),
        client.get('/get?req=3'),
        client.post('/post', { test: 'concurrent' }),
        client.get('/json')
      ];

      const responses = await Promise.all(promises);
      
      assert.strictEqual(responses.length, 5);
      
      responses.forEach(response => {
        assert.strictEqual(response.status, 200);
      });

      // Verify specific responses
      const getData1 = parseResponseData(responses[0].data);
      const getData2 = parseResponseData(responses[1].data);
      const getData3 = parseResponseData(responses[2].data);
      const postData = parseResponseData(responses[3].data);
      const jsonData = parseResponseData(responses[4].data);

      assert.strictEqual(getData1.args.req, '1');
      assert.strictEqual(getData2.args.req, '2');
      assert.strictEqual(getData3.args.req, '3');
      assert.strictEqual(postData.json.test, 'concurrent');
      assert(jsonData.slideshow, 'Should have slideshow data');
    });
  });

  describe('Authentication', () => {
    it('should handle basic authentication success', async () => {
      const username = 'testuser';
      const password = 'testpass';
      
      const response = await client.get(`/basic-auth/${username}/${password}`, {
        headers: {
          'Authorization': `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`
        }
      });
      
      assert.strictEqual(response.status, 200);
      
      const data = parseResponseData(response.data);
      assert.strictEqual(data.authenticated, true);
      assert.strictEqual(data.user, username);
    });

    it('should handle basic authentication failure', async () => {
      try {
        await client.get('/basic-auth/user/pass', {
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
  });

  describe('Large Data', () => {
    it('should handle moderately large JSON payload', async () => {
      const largeData = {
        items: Array.from({ length: 100 }, (_, i) => ({
          id: i,
          name: `Item ${i}`,
          description: `Description for item ${i}`
        }))
      };

      const response = await client.post('/post', largeData);
      
      assert.strictEqual(response.status, 200);
      
      const data = parseResponseData(response.data);
      assert(data.json, 'Should include posted data');
      assert.strictEqual(data.json.items.length, 100);
      assert.strictEqual(data.json.items[0].id, 0);
      assert.strictEqual(data.json.items[99].id, 99);
    });

    it('should handle text upload', async () => {
      const textData = 'Hello World! '.repeat(100); // Small text payload
      
      const response = await client.post('/post', textData, {
        headers: {
          'Content-Type': 'text/plain'
        }
      });
      
      assert.strictEqual(response.status, 200);
      
      const data = parseResponseData(response.data);
      assert.strictEqual(data.data, textData);
    });
  });
});