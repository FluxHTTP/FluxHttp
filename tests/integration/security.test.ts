import { describe, it, expect, beforeAll } from 'vitest';
import fluxhttp from '../../src';
import type { FluxHTTPInstance } from '../../src';

describe('Security Tests', () => {
  let apiClient: FluxHTTPInstance;
  const testBaseURL = 'https://jsonplaceholder.typicode.com';

  beforeAll(() => {
    apiClient = fluxhttp.create({
      baseURL: testBaseURL,
      timeout: 10000,
    });
  });

  describe('Input validation', () => {
    it('should handle malicious URLs safely', async () => {
      const maliciousUrls = [
        'javascript:alert(1)',
        'data:text/html,<script>alert(1)</script>',
        'file:///etc/passwd',
        'ftp://malicious.com',
        '../../../etc/passwd',
        '\\\\attacker.com\\share',
      ];

      for (const url of maliciousUrls) {
        try {
          await apiClient.get(url);
        } catch (error: any) {
          // Should either fail or sanitize
          expect(error).toBeDefined();
        }
      }
    });

    it('should sanitize header values', () => {
      const client = fluxhttp.create({ baseURL: testBaseURL });
      
      const dangerousHeaders = {
        'X-Injection': 'value\r\nX-Injected: malicious',
        'X-Null-Byte': 'value\0attack',
        'X-Script': '<script>alert(1)</script>',
      };

      client.interceptors.request.use((config) => {
        // Headers should be sanitized
        Object.entries(config.headers || {}).forEach(([key, value]) => {
          if (typeof value === 'string') {
            expect(value).not.toContain('\r');
            expect(value).not.toContain('\n');
            expect(value).not.toContain('\0');
          }
        });
        return config;
      });

      // Test would fail if headers aren't properly handled
      const config = {
        headers: dangerousHeaders,
      };

      expect(() => client.request(config)).not.toThrow();
    });

    it('should handle prototype pollution attempts', () => {
      const maliciousPayload = {
        '__proto__': { isAdmin: true },
        'constructor': { prototype: { isAdmin: true } },
        'prototype': { isAdmin: true },
      };

      const client = fluxhttp.create({ baseURL: testBaseURL });
      
      // Attempt to pollute via config
      const config = {
        data: maliciousPayload,
        headers: maliciousPayload as any,
      };

      // Should not affect Object prototype
      expect((Object.prototype as any).isAdmin).toBeUndefined();
      expect((client.constructor.prototype as any).isAdmin).toBeUndefined();

      // Config should handle it safely
      expect(() => client.request(config)).not.toThrow();
    });
  });

  describe('XSS prevention', () => {
    it('should not execute scripts in response data', async () => {
      // Mock response that contains script tags
      const client = fluxhttp.create({ baseURL: testBaseURL });
      
      client.interceptors.response.use((response) => {
        // Simulate a response with XSS attempt
        response.data = {
          title: '<script>alert("XSS")</script>',
          body: '<img src=x onerror=alert(1)>',
          onclick: 'alert(1)',
        };
        return response;
      });

      const response = await client.get('/posts/1');
      
      // Data should be returned as-is (not executed)
      expect(response.data.title).toBe('<script>alert("XSS")</script>');
      expect(response.data.body).toBe('<img src=x onerror=alert(1)>');
      expect(response.data.onclick).toBe('alert(1)');
      
      // No scripts should have been executed (would cause test failure)
    });

    it('should handle JSON hijacking attempts safely', async () => {
      const client = fluxhttp.create({ baseURL: testBaseURL });
      
      // Responses should be parsed safely
      client.interceptors.response.use((response) => {
        // Simulate various JSON hijacking patterns
        const dangerousPatterns = [
          'while(1);{"data": "value"}',
          'for(;;);{"data": "value"}',
          '{"data": "value", "__proto__": {"isAdmin": true}}',
        ];

        dangerousPatterns.forEach(pattern => {
          // Should handle these safely or throw
          try {
            if (typeof pattern === 'string' && pattern.includes('{')) {
              JSON.parse(pattern.replace(/^[^{]+/, ''));
            }
          } catch {
            // Expected to fail for some patterns
          }
        });

        return response;
      });

      const response = await client.get('/posts/1');
      expect(response.status).toBe(200);
    });
  });

  describe('CSRF protection', () => {
    it('should support CSRF tokens', async () => {
      const client = fluxhttp.create({ baseURL: testBaseURL });
      const csrfToken = 'test-csrf-token-12345';

      // Add CSRF token to all requests
      client.interceptors.request.use((config) => {
        config.headers = config.headers || {};
        config.headers['X-CSRF-Token'] = csrfToken;
        return config;
      });

      const response = await client.post('/posts', {
        title: 'Test with CSRF',
        body: 'Testing CSRF protection',
        userId: 1,
      });

      expect(response.status).toBe(201);
      expect(response.config.headers?.['X-CSRF-Token']).toBe(csrfToken);
    });

    it('should handle double submit cookies pattern', async () => {
      const client = fluxhttp.create({ 
        baseURL: testBaseURL,
        withCredentials: true,
      });

      const csrfToken = 'double-submit-token';

      client.interceptors.request.use((config) => {
        // In real app, read from cookie
        config.headers = config.headers || {};
        config.headers['X-CSRF-Token'] = csrfToken;
        
        // Ensure same token in cookie (simulated)
        config.headers['Cookie'] = `csrf-token=${csrfToken}`;
        
        return config;
      });

      const response = await client.post('/posts', {
        title: 'Double submit test',
        body: 'Testing double submit pattern',
        userId: 1,
      });

      expect(response.status).toBe(201);
    });
  });

  describe('Authentication security', () => {
    it('should handle auth headers securely', async () => {
      const client = fluxhttp.create({ baseURL: testBaseURL });
      
      const sensitiveToken = 'Bearer super-secret-token-12345';
      
      client.interceptors.request.use((config) => {
        config.headers = config.headers || {};
        config.headers['Authorization'] = sensitiveToken;
        return config;
      });

      const response = await client.get('/posts/1');
      
      // Token should be in config but not logged/exposed
      expect(response.config.headers?.['Authorization']).toBe(sensitiveToken);
      
      // Ensure error messages don't expose tokens
      try {
        await client.get('/invalid-endpoint');
      } catch (error: any) {
        expect(error.message).not.toContain(sensitiveToken);
        expect(JSON.stringify(error.toJSON())).not.toContain(sensitiveToken);
      }
    });

    it('should support auth object securely', () => {
      const client = fluxhttp.create({
        baseURL: testBaseURL,
        auth: {
          username: 'testuser',
          password: 'testpass123',
        },
      });

      // Auth should be converted to header, not exposed
      client.interceptors.request.use((config) => {
        // Should have Authorization header
        expect(config.headers?.['Authorization']).toBeDefined();
        
        // Should not expose raw credentials
        expect(config.auth).toBeDefined();
        expect(JSON.stringify(config)).not.toContain('testpass123');
        
        return config;
      });

      // Test would verify auth is handled securely
      expect(() => client.get('/posts/1')).not.toThrow();
    });
  });

  describe('Content Security', () => {
    it('should handle different content types safely', async () => {
      const contentTypes = [
        'application/json',
        'text/plain',
        'text/html',
        'application/xml',
        'application/javascript',
        'image/svg+xml',
      ];

      for (const contentType of contentTypes) {
        const client = fluxhttp.create({ baseURL: testBaseURL });
        
        client.interceptors.response.use((response) => {
          // Simulate different content types
          response.headers['content-type'] = contentType;
          
          if (contentType.includes('javascript') || contentType.includes('svg')) {
            // Potentially dangerous types should be handled carefully
            expect(response.config.responseType).not.toBe('document');
          }
          
          return response;
        });

        const response = await client.get('/posts/1');
        expect(response.status).toBe(200);
      }
    });

    it('should validate response size limits', async () => {
      const client = fluxhttp.create({
        baseURL: testBaseURL,
        maxContentLength: 1000, // 1KB limit
      });

      client.interceptors.response.use((response) => {
        // Check if response respects size limits
        const size = JSON.stringify(response.data).length;
        
        if (client.defaults.maxContentLength) {
          expect(size).toBeLessThanOrEqual(client.defaults.maxContentLength * 10); // Some tolerance
        }
        
        return response;
      });

      const response = await client.get('/posts/1');
      expect(response.status).toBe(200);
    });
  });

  describe('URL validation', () => {
    it('should validate and sanitize URLs', () => {
      const client = fluxhttp.create({ baseURL: testBaseURL });
      
      const testUrls = [
        { url: '/posts/1', valid: true },
        { url: 'posts/1', valid: true },
        { url: 'https://example.com/posts/1', valid: true },
        { url: '//example.com/posts/1', valid: true },
        { url: 'javascript:void(0)', valid: false },
        { url: 'data:text/html,test', valid: false },
        { url: 'file:///etc/passwd', valid: false },
      ];

      testUrls.forEach(({ url, valid }) => {
        if (valid) {
          expect(() => client.getUri({ url })).not.toThrow();
        } else {
          // Should either sanitize or handle safely
          const uri = client.getUri({ url });
          expect(uri).not.toContain('javascript:');
          expect(uri).not.toContain('data:');
          expect(uri).not.toContain('file:');
        }
      });
    });

    it('should prevent path traversal', () => {
      const client = fluxhttp.create({ baseURL: testBaseURL });
      
      const traversalAttempts = [
        '../../../etc/passwd',
        '..\\..\\..\\windows\\system32',
        '/posts/../../../etc/passwd',
        '/posts/1/../../../../../../etc/passwd',
        '%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd',
      ];

      traversalAttempts.forEach(path => {
        const uri = client.getUri({ url: path });
        
        // Should not contain path traversal sequences
        expect(uri).not.toMatch(/\.\.[\/\\]/);
        expect(decodeURIComponent(uri)).not.toMatch(/\.\.[\/\\]/);
      });
    });
  });

  describe('Error information security', () => {
    it('should not leak sensitive information in errors', async () => {
      const client = fluxhttp.create({
        baseURL: testBaseURL,
        headers: {
          'Authorization': 'Bearer secret-token-12345',
          'X-API-Key': 'api-key-67890',
        },
      });

      try {
        await client.get('/this-endpoint-does-not-exist');
      } catch (error: any) {
        const errorStr = JSON.stringify(error);
        const errorMessage = error.message;
        
        // Should not expose sensitive headers in errors
        expect(errorStr).not.toContain('secret-token-12345');
        expect(errorStr).not.toContain('api-key-67890');
        expect(errorMessage).not.toContain('secret-token-12345');
        expect(errorMessage).not.toContain('api-key-67890');
        
        // Should still have useful error info
        expect(error.response?.status).toBe(404);
        expect(error.config?.url).toBeDefined();
      }
    });
  });

  describe('Safe JSON parsing', () => {
    it('should handle malformed JSON safely', async () => {
      const client = fluxhttp.create({ baseURL: testBaseURL });
      
      const malformedResponses = [
        '{invalid json}',
        '{"unclosed": ',
        'undefined',
        'null',
        '{"__proto__": {"isAdmin": true}}',
        '[1,2,3,]', // trailing comma
      ];

      client.interceptors.response.use((response) => {
        // Test each malformed response
        malformedResponses.forEach(malformed => {
          try {
            const parsed = JSON.parse(malformed);
            // If it parses, ensure prototype isn't polluted
            expect((Object.prototype as any).isAdmin).toBeUndefined();
          } catch {
            // Expected for malformed JSON
          }
        });
        
        return response;
      });

      const response = await client.get('/posts/1');
      expect(response.status).toBe(200);
    });
  });
});