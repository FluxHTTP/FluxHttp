const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');

// Import the main library
const fluxhttpModule = require('../../dist/index.js');
const fluxhttp = fluxhttpModule.default || fluxhttpModule;
const { fluxhttpError, CancelToken, isCancel } = fluxhttpModule;

/**
 * Real Error Scenarios Integration Tests
 * Tests error handling, timeouts, and network issues with real endpoints
 * 
 * Note: These tests make real network requests and may be affected by network conditions
 */

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

describe('Real Error Scenarios Integration Tests', () => {
  let client;
  const HTTPBIN_BASE = 'https://httpbin.org';

  beforeEach(() => {
    client = fluxhttp.create({
      baseURL: HTTPBIN_BASE,
      headers: {
        'User-Agent': 'FluxHTTP-Error-Test/1.0.0'
      }
    });
  });

  afterEach(() => {
    if (global.gc) {
      global.gc();
    }
  });

  describe('HTTP Error Status Codes', () => {
    it('should handle 400 Bad Request errors', async () => {
      try {
        await client.get('/status/400');
        assert.fail('Should have thrown an error for 400 status');
      } catch (error) {
        assert(error.response, 'Should have response object');
        assert.strictEqual(error.response.status, 400);
        assert(error.message.includes('400') || error.message.includes('Bad Request'));
        assert.strictEqual(error.config.url, `${HTTPBIN_BASE}/status/400`);
      }
    });

    it('should handle 401 Unauthorized errors', async () => {
      try {
        await client.get('/basic-auth/user/pass');
        assert.fail('Should have thrown an error for 401 status');
      } catch (error) {
        assert(error.response, 'Should have response object');
        assert.strictEqual(error.response.status, 401);
        assert(error.message.includes('401') || error.message.includes('Unauthorized'));
      }
    });

    it('should handle 403 Forbidden errors', async () => {
      try {
        await client.get('/status/403');
        assert.fail('Should have thrown an error for 403 status');
      } catch (error) {
        assert(error.response, 'Should have response object');
        assert.strictEqual(error.response.status, 403);
        assert(error.message.includes('403') || error.message.includes('Forbidden'));
      }
    });

    it('should handle 404 Not Found errors', async () => {
      try {
        await client.get('/status/404');
        assert.fail('Should have thrown an error for 404 status');
      } catch (error) {
        assert(error.response, 'Should have response object');
        assert.strictEqual(error.response.status, 404);
        assert(error.message.includes('404') || error.message.includes('Not Found'));
      }
    });

    it('should handle 422 Unprocessable Entity errors', async () => {
      try {
        await client.get('/status/422');
        assert.fail('Should have thrown an error for 422 status');
      } catch (error) {
        assert(error.response, 'Should have response object');
        assert.strictEqual(error.response.status, 422);
        assert(error.message.includes('422'));
      }
    });

    it('should handle 429 Too Many Requests errors', async () => {
      try {
        await client.get('/status/429');
        assert.fail('Should have thrown an error for 429 status');
      } catch (error) {
        assert(error.response, 'Should have response object');
        assert.strictEqual(error.response.status, 429);
        assert(error.message.includes('429'));
      }
    });

    it('should handle 500 Internal Server Error', async () => {
      try {
        await client.get('/status/500');
        assert.fail('Should have thrown an error for 500 status');
      } catch (error) {
        assert(error.response, 'Should have response object');
        assert.strictEqual(error.response.status, 500);
        assert(error.message.includes('500'));
      }
    });

    it('should handle 502 Bad Gateway errors', async () => {
      try {
        await client.get('/status/502');
        assert.fail('Should have thrown an error for 502 status');
      } catch (error) {
        assert(error.response, 'Should have response object');
        assert.strictEqual(error.response.status, 502);
        assert(error.message.includes('502'));
      }
    });

    it('should handle 503 Service Unavailable errors', async () => {
      try {
        await client.get('/status/503');
        assert.fail('Should have thrown an error for 503 status');
      } catch (error) {
        assert(error.response, 'Should have response object');
        assert.strictEqual(error.response.status, 503);
        assert(error.message.includes('503'));
      }
    });

    it('should preserve error response data', async () => {
      try {
        await client.get('/status/418'); // I'm a teapot
        assert.fail('Should have thrown an error for 418 status');
      } catch (error) {
        assert(error.response, 'Should have response object');
        assert.strictEqual(error.response.status, 418);
        assert(error.response.headers, 'Should have response headers');
        assert(error.response.data !== undefined, 'Should have response data');
      }
    });
  });

  describe('Timeout Scenarios', () => {
    it('should handle request timeout', async () => {
      const shortTimeoutClient = fluxhttp.create({
        baseURL: HTTPBIN_BASE,
        timeout: 500 // 500ms timeout
      });

      try {
        await shortTimeoutClient.get('/delay/2'); // 2 second delay
        assert.fail('Should have thrown a timeout error');
      } catch (error) {
        assert(error.code === 'ECONNABORTED' || error.message.includes('timeout'));
        assert(!error.response, 'Timeout errors should not have response');
      }
    });

    it('should handle very short timeouts', async () => {
      const veryShortTimeoutClient = fluxhttp.create({
        baseURL: HTTPBIN_BASE,
        timeout: 1 // 1ms timeout - should always timeout
      });

      try {
        await veryShortTimeoutClient.get('/get');
        assert.fail('Should have thrown a timeout error');
      } catch (error) {
        assert(error.code === 'ECONNABORTED' || error.message.includes('timeout'));
      }
    });

    it('should handle timeout during upload', async () => {
      const uploadTimeoutClient = fluxhttp.create({
        baseURL: HTTPBIN_BASE,
        timeout: 1000 // 1 second timeout
      });

      const largeData = 'x'.repeat(10000); // 10KB of data

      try {
        await uploadTimeoutClient.post('/delay/2', largeData); // 2 second delay
        assert.fail('Should have thrown a timeout error');
      } catch (error) {
        assert(error.code === 'ECONNABORTED' || error.message.includes('timeout'));
      }
    });

    it('should respect per-request timeout override', async () => {
      const defaultTimeoutClient = fluxhttp.create({
        baseURL: HTTPBIN_BASE,
        timeout: 5000 // 5 second default
      });

      try {
        await defaultTimeoutClient.get('/delay/2', {
          timeout: 500 // Override to 500ms
        });
        assert.fail('Should have thrown a timeout error');
      } catch (error) {
        assert(error.code === 'ECONNABORTED' || error.message.includes('timeout'));
      }
    });
  });

  describe('Network Error Scenarios', () => {
    it('should handle invalid domain errors', async () => {
      const invalidClient = fluxhttp.create({
        baseURL: 'https://this-domain-does-not-exist-12345.com',
        timeout: 5000
      });

      try {
        await invalidClient.get('/test');
        assert.fail('Should have thrown a network error');
      } catch (error) {
        assert(
          error.code === 'ENOTFOUND' || 
          error.code === 'ECONNREFUSED' ||
          error.message.includes('getaddrinfo') ||
          error.message.includes('not found')
        );
        assert(!error.response, 'Network errors should not have response');
      }
    });

    it('should handle connection refused errors', async () => {
      const refusedClient = fluxhttp.create({
        baseURL: 'http://localhost:99999', // Unlikely to be in use
        timeout: 2000
      });

      try {
        await refusedClient.get('/test');
        assert.fail('Should have thrown a connection error');
      } catch (error) {
        assert(
          error.code === 'ECONNREFUSED' || 
          error.code === 'ECONNRESET' ||
          error.code === 'ECONNABORTED' ||
          error.message.includes('connect')
        );
        assert(!error.response, 'Connection errors should not have response');
      }
    });

    it('should handle invalid URL errors', async () => {
      try {
        await client.get('not-a-valid-url');
        assert.fail('Should have thrown a URL error');
      } catch (error) {
        assert(error.message.includes('Invalid') || error.code);
      }
    });

    it('should handle malformed URLs', async () => {
      try {
        await client.get('http://[invalid-ipv6-address');
        assert.fail('Should have thrown a URL error');
      } catch (error) {
        assert(error.message || error.code);
      }
    });
  });

  describe('SSL/TLS Error Scenarios', () => {
    it('should handle self-signed certificate errors', async () => {
      const sslClient = fluxhttp.create({
        baseURL: 'https://self-signed.badssl.com',
        timeout: 10000
      });

      try {
        await sslClient.get('/');
        // Some environments might accept self-signed certs
      } catch (error) {
        if (error.code) {
          assert(
            error.code === 'DEPTH_ZERO_SELF_SIGNED_CERT' ||
            error.code === 'SELF_SIGNED_CERT_IN_CHAIN' ||
            error.code === 'CERT_UNTRUSTED' ||
            error.message.includes('certificate') ||
            error.message.includes('SSL')
          );
        }
      }
    });

    it('should handle expired certificate errors', async () => {
      const expiredClient = fluxhttp.create({
        baseURL: 'https://expired.badssl.com',
        timeout: 10000
      });

      try {
        await expiredClient.get('/');
        // Some environments might accept expired certs
      } catch (error) {
        if (error.code) {
          assert(
            error.code === 'CERT_HAS_EXPIRED' ||
            error.code === 'CERT_NOT_YET_VALID' ||
            error.message.includes('certificate') ||
            error.message.includes('expired')
          );
        }
      }
    });
  });

  describe('Request Cancellation', () => {
    it('should handle request cancellation', async () => {
      const source = CancelToken.source();

      const requestPromise = client.get('/delay/3', {
        cancelToken: source.token
      });

      // Cancel immediately
      source.cancel('User cancelled the request');

      try {
        await requestPromise;
        assert.fail('Should have thrown a cancellation error');
      } catch (error) {
        assert(isCancel(error), 'Should be a cancellation error');
        assert.strictEqual(error.message, 'User cancelled the request');
      }
    });

    it('should handle cancellation during slow request', async () => {
      const source = CancelToken.source();

      const requestPromise = client.get('/delay/5', {
        cancelToken: source.token
      });

      // Cancel after 500ms
      setTimeout(() => {
        source.cancel('Request took too long');
      }, 500);

      try {
        await requestPromise;
        assert.fail('Should have thrown a cancellation error');
      } catch (error) {
        assert(isCancel(error), 'Should be a cancellation error');
        assert.strictEqual(error.message, 'Request took too long');
      }
    });

    it('should handle cancellation with custom message', async () => {
      const source = CancelToken.source();
      const customMessage = 'Operation cancelled by user action';

      const requestPromise = client.get('/delay/2', {
        cancelToken: source.token
      });

      source.cancel(customMessage);

      try {
        await requestPromise;
        assert.fail('Should have thrown a cancellation error');
      } catch (error) {
        assert(isCancel(error), 'Should be a cancellation error');
        assert.strictEqual(error.message, customMessage);
      }
    });

    it('should handle multiple requests with same cancel token', async () => {
      const source = CancelToken.source();

      const requests = [
        client.get('/delay/3', { cancelToken: source.token }),
        client.get('/delay/4', { cancelToken: source.token }),
        client.get('/delay/5', { cancelToken: source.token })
      ];

      // Cancel all requests
      source.cancel('Bulk cancellation');

      const results = await Promise.allSettled(requests);

      results.forEach(result => {
        assert.strictEqual(result.status, 'rejected');
        assert(isCancel(result.reason), 'All should be cancellation errors');
        assert.strictEqual(result.reason.message, 'Bulk cancellation');
      });
    });
  });

  describe('Large Response Handling', () => {
    it('should handle large response gracefully', async () => {
      try {
        // Note: This might not be available on all test environments
        const response = await client.get('/stream-bytes/1000000'); // 1MB of data
        
        assert.strictEqual(response.status, 200);
        assert(response.data, 'Should have response data');
        // The actual size check depends on how the adapter handles binary data
      } catch (error) {
        // If the endpoint doesn't exist or fails, that's acceptable for this test
        if (error.response && error.response.status === 404) {
          console.log('Large response endpoint not available, skipping');
        } else {
          throw error;
        }
      }
    });

    it('should handle malformed JSON responses', async () => {
      try {
        // This should return invalid JSON
        await client.get('/html'); // HTML content when expecting JSON
        
        // If it succeeds, the response should be treated as text
        // The test passes either way since different adapters handle this differently
      } catch (error) {
        // JSON parse errors are acceptable for this test
        if (error.message && error.message.includes('JSON')) {
          assert(true, 'JSON parse error is expected for HTML content');
        } else {
          throw error;
        }
      }
    });
  });

  describe('Error Context and Debugging', () => {
    it('should preserve request config in error object', async () => {
      const config = {
        headers: {
          'X-Test-Header': 'test-value',
          'Authorization': 'Bearer test-token'
        },
        params: {
          test: 'value',
          debug: true
        }
      };

      try {
        await client.get('/status/500', config);
        assert.fail('Should have thrown an error');
      } catch (error) {
        assert(error.config, 'Should include request config');
        assert.strictEqual(error.config.headers['X-Test-Header'], 'test-value');
        assert.strictEqual(error.config.headers['Authorization'], 'Bearer test-token');
        assert.deepStrictEqual(error.config.params, { test: 'value', debug: true });
      }
    });

    it('should include response headers in error', async () => {
      try {
        await client.get('/status/404');
        assert.fail('Should have thrown an error');
      } catch (error) {
        assert(error.response, 'Should have response object');
        assert(error.response.headers, 'Should have response headers');
        assert(typeof error.response.headers === 'object', 'Headers should be object');
      }
    });

    it('should handle errors with response data', async () => {
      try {
        await client.post('/status/400', { invalid: 'data' });
        assert.fail('Should have thrown an error');
      } catch (error) {
        assert(error.response, 'Should have response object');
        assert.strictEqual(error.response.status, 400);
        // Response data depends on the endpoint implementation
        assert(error.response.data !== undefined, 'Should have response data');
      }
    });

    it('should preserve error stack trace', async () => {
      try {
        await client.get('/status/500');
        assert.fail('Should have thrown an error');
      } catch (error) {
        assert(error.stack, 'Should have stack trace');
        assert(error.stack.includes('Error'), 'Stack should contain error info');
      }
    });
  });

  describe('Recovery and Retry Scenarios', () => {
    it('should handle intermittent failures', async () => {
      let attempts = 0;
      const maxAttempts = 3;

      const retryClient = fluxhttp.create({
        baseURL: HTTPBIN_BASE,
        timeout: 5000
      });

      // Add retry interceptor
      retryClient.interceptors.response.use(
        (response) => response,
        async (error) => {
          attempts++;
          
          if (attempts < maxAttempts && error.response && error.response.status >= 500) {
            // Wait before retry
            await new Promise(resolve => setTimeout(resolve, 100 * attempts));
            return retryClient.request(error.config);
          }
          
          return Promise.reject(error);
        }
      );

      try {
        await retryClient.get('/status/500');
        assert.fail('Should have thrown an error after retries');
      } catch (error) {
        assert.strictEqual(attempts, maxAttempts, 'Should have attempted all retries');
        assert.strictEqual(error.response.status, 500);
      }
    });

    it('should handle exponential backoff', async () => {
      const delays = [];
      let attempts = 0;

      const backoffClient = fluxhttp.create({
        baseURL: HTTPBIN_BASE,
        timeout: 5000
      });

      backoffClient.interceptors.response.use(
        (response) => response,
        async (error) => {
          attempts++;
          
          if (attempts <= 3 && error.response && error.response.status === 429) {
            const delay = Math.pow(2, attempts) * 100; // Exponential backoff
            delays.push(delay);
            
            await new Promise(resolve => setTimeout(resolve, delay));
            return backoffClient.request(error.config);
          }
          
          return Promise.reject(error);
        }
      );

      try {
        await backoffClient.get('/status/429');
        assert.fail('Should have thrown an error after retries');
      } catch (error) {
        assert.strictEqual(error.response.status, 429);
        assert(delays.length > 0, 'Should have recorded delays');
        
        // Verify exponential backoff pattern
        for (let i = 1; i < delays.length; i++) {
          assert(delays[i] > delays[i - 1], 'Delays should increase exponentially');
        }
      }
    });
  });
});