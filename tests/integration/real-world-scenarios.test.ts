import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
const http = require('http');
const https = require('https');
import fluxhttp from '../../dist/index.js';

// Create a test server for integration tests
let server;
let serverPort;
let serverUrl;

// Mock server that simulates various real-world scenarios
function createTestServer(): void {
  return http.createServer((req, res) => {
    const url = new URL(req.url, `http://localhost:${serverPort}`);

    // Route handling
    switch (url.pathname) {
      case '/api/users':
        handleUsersEndpoint(req, res);
        break;
      case '/api/users/1':
        handleUserByIdEndpoint(req, res);
        break;
      case '/api/auth/login':
        handleLoginEndpoint(req, res);
        break;
      case '/api/upload':
        handleUploadEndpoint(req, res);
        break;
      case '/api/download':
        handleDownloadEndpoint(req, res);
        break;
      case '/api/timeout':
        handleTimeoutEndpoint(req, res);
        break;
      case '/api/error':
        handleErrorEndpoint(req, res);
        break;
      case '/api/redirect':
        handleRedirectEndpoint(req, res);
        break;
      case '/api/retry':
        handleRetryEndpoint(req, res);
        break;
      case '/api/stream':
        handleStreamEndpoint(req, res);
        break;
      case '/api/headers':
        handleHeadersEndpoint(req, res);
        break;
      case '/api/cookies':
        handleCookiesEndpoint(req, res);
        break;
      default:
        res.statusCode = 404;
        res.end(JSON.stringify({ error: 'Not found' }));
    }
  });
}

// Endpoint handlers
function handleUsersEndpoint(req, res): void {
  if (req.method === 'GET') {
    res.setHeader('Content-Type', 'application/json');
    res.end(
      JSON.stringify({
        users: [
          { id: 1, name: 'John Doe', email: 'john@example.com' },
          { id: 2, name: 'Jane Smith', email: 'jane@example.com' },
        ],
        total: 2,
      })
    );
  } else if (req.method === 'POST') {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      const user = JSON.parse(body);
      res.statusCode = 201;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ id: 3, ...user }));
    });
  }
}

function handleUserByIdEndpoint(req, res): void {
  if (req.method === 'PUT') {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      const updates = JSON.parse(body);
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ id: 1, ...updates }));
    });
  } else if (req.method === 'DELETE') {
    res.statusCode = 204;
    res.end();
  } else {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ id: 1, name: 'John Doe', email: 'john@example.com' }));
  }
}

function handleLoginEndpoint(req, res): void {
  let body = '';
  req.on('data', (chunk) => (body += chunk));
  req.on('end', () => {
    const { username, password } = JSON.parse(body);
    if (username === 'admin' && password === 'password') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Set-Cookie', 'session=abc123; HttpOnly');
      res.end(
        JSON.stringify({
          token: 'jwt-token-123',
          user: { id: 1, username: 'admin' },
        })
      );
    } else {
      res.statusCode = 401;
      res.end(JSON.stringify({ error: 'Invalid credentials' }));
    }
  });
}

function handleUploadEndpoint(req, res): void {
  let size = 0;
  req.on('data', (chunk) => (size += chunk.length));
  req.on('end', () => {
    res.setHeader('Content-Type', 'application/json');
    res.end(
      JSON.stringify({
        success: true,
        size,
        contentType: req.headers['content-type'],
      })
    );
  });
}

function handleDownloadEndpoint(req, res): void {
  const size = parseInt(req.headers['x-size'] || '1024');
  res.setHeader('Content-Type', 'application/octet-stream');
  res.setHeader('Content-Length', size);
  res.end(Buffer.alloc(size, 'x'));
}

function handleTimeoutEndpoint(req, res): void {
  const delay = parseInt(req.headers['x-delay'] || '5000');
  setTimeout(() => {
    res.end(JSON.stringify({ delayed: true }));
  }, delay);
}

function handleErrorEndpoint(req, res): void {
  const status = parseInt(req.headers['x-status'] || '500');
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ error: `Error ${status}` }));
}

let redirectCount = 0;
function handleRedirectEndpoint(req, res): void {
  const maxRedirects = parseInt(req.headers['x-max-redirects'] || '3');

  if (redirectCount < maxRedirects) {
    redirectCount++;
    res.statusCode = 302;
    res.setHeader('Location', '/api/redirect');
    res.end();
  } else {
    redirectCount = 0;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ redirects: maxRedirects }));
  }
}

let retryCount = 0;
function handleRetryEndpoint(req, res): void {
  const maxRetries = parseInt(req.headers['x-max-retries'] || '2');

  if (retryCount < maxRetries) {
    retryCount++;
    res.statusCode = 503;
    res.setHeader('Retry-After', '1');
    res.end(JSON.stringify({ error: 'Service unavailable' }));
  } else {
    retryCount = 0;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ success: true, attempts: maxRetries + 1 }));
  }
}

function handleStreamEndpoint(req, res): void {
  res.setHeader('Content-Type', 'text/plain');
  res.write('chunk1\n');
  setTimeout(() => res.write('chunk2\n'), 100);
  setTimeout(() => res.write('chunk3\n'), 200);
  setTimeout(() => res.end(), 300);
}

function handleHeadersEndpoint(req, res): void {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('X-Custom-Header', 'custom-value');
  res.setHeader('X-Request-Id', req.headers['x-request-id'] || 'none');
  res.end(JSON.stringify({ headers: req.headers }));
}

function handleCookiesEndpoint(req, res): void {
  const cookies = req.headers.cookie || '';
  res.setHeader('Set-Cookie', ['cookie1=value1; Path=/', 'cookie2=value2; HttpOnly']);
  res.end(JSON.stringify({ cookies }));
}

describe('Real-world integration scenarios', () => {
  beforeEach(async () => {
    server = createTestServer();
    await new Promise((_resolve) => {
      server.listen(0, (): void => {
        serverPort = server.address().port;
        serverUrl = `http://localhost:${serverPort}`;
        resolve();
      });
    });
  });

  afterEach(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  describe('RESTful API operations', (): void => {
    it('should handle full CRUD operations', async (): Promise<void> => {
      const client = fluxhttp.create({ baseURL: serverUrl });

      // GET all users
      const getResponse = await client.get('/api/users');
      assert.strictEqual(getResponse.status, 200);
      assert.strictEqual(getResponse.data.users.length, 2);

      // POST new user
      const newUser = { name: 'Bob Johnson', email: 'bob@example.com' };
      const postResponse = await client.post('/api/users', newUser);
      assert.strictEqual(postResponse.status, 201);
      assert.strictEqual(postResponse.data.id, 3);
      assert.strictEqual(postResponse.data.name, 'Bob Johnson');

      // GET single user
      const getOneResponse = await client.get('/api/users/1');
      assert.strictEqual(getOneResponse.data.id, 1);

      // PUT update user
      const putResponse = await client.put('/api/users/1', { name: 'John Updated' });
      assert.strictEqual(putResponse.data.name, 'John Updated');

      // DELETE user
      const deleteResponse = await client.delete('/api/users/1');
      assert.strictEqual(deleteResponse.status, 204);
    });
  });

  describe('Authentication flow', () => {
    it('should handle login and authenticated requests', async (): Promise<void> => {
      const client = fluxhttp.create({ baseURL: serverUrl });

      // Login
      const loginResponse = await client.post('/api/auth/login', {
        username: 'admin',
        password: 'password',
      });

      assert.strictEqual(loginResponse.status, 200);
      assert(loginResponse.data.token);
      assert(loginResponse.headers['set-cookie']);

      // Use token for authenticated requests
      const authenticatedClient = fluxhttp.create({
        baseURL: serverUrl,
        headers: {
          Authorization: `Bearer ${loginResponse.data.token}`,
        },
      });

      const protectedResponse = await authenticatedClient.get('/api/users');
      assert.strictEqual(protectedResponse.status, 200);
    });

    it('should handle failed authentication', async (): Promise<void> => {
      const client = fluxhttp.create({ baseURL: serverUrl });

      try {
        await client.post('/api/auth/login', {
          username: 'wrong',
          password: 'wrong',
        });
        assert.fail('Should have thrown error');
      } catch (error) {
        assert.strictEqual(error.response.status, 401);
        assert.strictEqual((error.response.data as any).error, 'Invalid credentials');
      }
    });
  });

  describe('File operations', () => {
    it('should handle file upload', async (): Promise<void> => {
      const client = fluxhttp.create({ baseURL: serverUrl });

      // Simulate file data
      const fileData = Buffer.from('This is file content');

      const response = await client.post('/api/upload', fileData, {
        headers: {
          'Content-Type': 'application/octet-stream',
        },
      });

      assert.strictEqual((response.data as any).success, true);
      assert.strictEqual((response.data as any).size, fileData.length);
      assert.strictEqual((response.data as any).contentType, 'application/octet-stream');
    });

    it('should handle file download', async (): Promise<void> => {
      const client = fluxhttp.create({ baseURL: serverUrl });

      const response = await client.get('/api/download', {
        headers: { 'X-Size': '2048' },
        responseType: 'arraybuffer',
      });

      assert(response.data instanceof ArrayBuffer);
      assert.strictEqual((response.data as any).byteLength, 2048);
    });
  });

  describe('Error handling and recovery', () => {
    it('should handle various HTTP errors', async (): Promise<void> => {
      const client = fluxhttp.create({ baseURL: serverUrl });

      // 400 Bad Request
      try {
        await client.get('/api/error', { headers: { 'X-Status': '400' } });
        assert.fail('Should have thrown');
      } catch (error) {
        assert.strictEqual(error.response.status, 400);
      }

      // 404 Not Found
      try {
        await client.get('/api/nonexistent');
        assert.fail('Should have thrown');
      } catch (error) {
        assert.strictEqual(error.response.status, 404);
      }

      // 500 Internal Server Error
      try {
        await client.get('/api/error', { headers: { 'X-Status': '500' } });
        assert.fail('Should have thrown');
      } catch (error) {
        assert.strictEqual(error.response.status, 500);
      }
    });

    it('should handle timeouts', async (): Promise<void> => {
      const client = fluxhttp.create({
        baseURL: serverUrl,
        timeout: 100,
      });

      try {
        await client.get('/api/timeout', {
          headers: { 'X-Delay': '500' },
        });
        assert.fail('Should have timed out');
      } catch (error) {
        assert.strictEqual(error.code, 'ECONNABORTED');
      }
    });
  });

  describe('Request/Response interceptors', () => {
    it('should handle request and response transformations', async (): Promise<void> => {
      const client = fluxhttp.create({ baseURL: serverUrl });

      // Add request interceptor
      client.interceptors.request.use((_config) => {
        config.headers['X-Request-Id'] = 'req-123';
        config.headers['X-Timestamp'] = Date.now().toString();
        return config;
      });

      // Add response interceptor
      client.interceptors.response.use((_response) => {
        (response.data as any)._processed = true;
        (response.data as any)._timestamp = Date.now();
        return response;
      });

      const response = await client.get('/api/headers');

      assert.strictEqual(response.headers['x-request-id'], 'req-123');
      assert((response.data as any)._processed);
      assert((response.data as any)._timestamp);
    });

    it('should handle error interceptors', async (): Promise<void> => {
      const client = fluxhttp.create({ baseURL: serverUrl });

      let errorIntercepted = false;

      client.interceptors.response.use(
        (response) => response,
        (_error) => {
          errorIntercepted = true;
          if (error.response?.status === 404) {
            return {
              data: { fallback: true },
              status: 200,
            };
          }
          throw error;
        }
      );

      const response = await client.get('/api/nonexistent');

      assert(errorIntercepted);
      assert((response.data as any).fallback);
    });
  });

  describe('Advanced scenarios', () => {
    it('should handle concurrent requests', async (): Promise<void> => {
      const client = fluxhttp.create({ baseURL: serverUrl });

      const promises = [
        client.get('/api/users'),
        client.get('/api/users/1'),
        client.post('/api/users', { name: 'Concurrent User' }),
      ];

      const results = await Promise.all(promises);

      assert.strictEqual(results[0].status, 200);
      assert.strictEqual(results[1].status, 200);
      assert.strictEqual(results[2].status, 201);
    });

    it('should handle request cancellation', async (): Promise<void> => {
      const client = fluxhttp.create({ baseURL: serverUrl });
      const controller = new AbortController();

      const promise = client.get('/api/timeout', {
        signal: controller.signal,
        headers: { 'X-Delay': '1000' },
      });

      // Cancel after 50ms
      setTimeout(() => controller.abort(), 50);

      try {
        await promise;
        assert.fail('Should have been cancelled');
      } catch (error) {
        assert(error.code === 'ERR_CANCELED' || error.name === 'AbortError');
      }
    });

    it('should handle custom headers and cookies', async (): Promise<void> => {
      const client = fluxhttp.create({
        baseURL: serverUrl,
        headers: {
          'User-Agent': 'FluxHTTP Test Client',
          'Accept-Language': 'en-US',
        },
      });

      const response = await client.get('/api/headers');

      assert((response.data as any).headers['user-agent'].includes('FluxHTTP Test Client'));
      assert.strictEqual((response.data as any).headers['accept-language'], 'en-US');
    });

    it('should handle form data submission', async (): Promise<void> => {
      const client = fluxhttp.create({ baseURL: serverUrl });

      // Simulate form data
      const formData = new URLSearchParams();
      formData.append('username', 'testuser');
      formData.append('email', 'test@example.com');

      const response = await client.post('/api/users', formData.toString(), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });

      assert.strictEqual(response.status, 201);
    });
  });

  describe('Performance scenarios', () => {
    it('should handle large payloads efficiently', async (): Promise<void> => {
      const client = fluxhttp.create({ baseURL: serverUrl });

      // Create large payload (1MB)
      const largeData = { data: 'x'.repeat(1024 * 1024) };

      const startTime = Date.now();
      const response = await client.post('/api/upload', largeData);
      const duration = Date.now() - startTime;

      assert((response.data as any).success);
      assert(duration < 5000); // Should complete within 5 seconds
    });

    it('should reuse connections efficiently', async (): Promise<void> => {
      const client = fluxhttp.create({ baseURL: serverUrl });

      const startTime = Date.now();

      // Make multiple sequential requests
      for (let i = 0; i < 10; i++) {
        await client.get('/api/users');
      }

      const duration = Date.now() - startTime;
      assert(duration < 2000); // Should be fast due to connection reuse
    });
  });

  describe('Content negotiation', () => {
    it('should handle different content types', async (): Promise<void> => {
      const client = fluxhttp.create({ baseURL: serverUrl });

      // JSON (default)
      const jsonResponse = await client.get('/api/users');
      assert(typeof jsonResponse.data === 'object');

      // Plain text
      const textResponse = await client.get('/api/stream', {
        responseType: 'text',
      });
      assert(typeof textResponse.data === 'string');

      // Binary data
      const binaryResponse = await client.get('/api/download', {
        responseType: 'arraybuffer',
      });
      assert(binaryResponse.data instanceof ArrayBuffer);
    });
  });
});
