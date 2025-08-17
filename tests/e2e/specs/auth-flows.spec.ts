import { test, expect, testData } from '../utils/fixtures';

test.describe('Authentication Flows', () => {
  test.describe('Login Flow', () => {
    test('should successfully login with valid credentials', async ({ 
      fluxHttpHelpers, 
      authHelper 
    }) => {
      // Perform login
      const token = await authHelper.login();
      
      // Verify token was received
      expect(token).toBeTruthy();
      expect(typeof token).toBe('string');
      
      // Verify the token is stored
      const storedToken = await fluxHttpHelpers.page.evaluate(() => 
        localStorage.getItem('authToken')
      );
      expect(storedToken).toBe(token);
      
      // Verify auth headers are set
      const hasAuthHeader = await fluxHttpHelpers.page.evaluate(() => {
        return !!window.fluxHttpInstance.defaults.headers.common['Authorization'];
      });
      expect(hasAuthHeader).toBe(true);
    });

    test('should fail login with invalid credentials', async ({ 
      fluxHttpHelpers 
    }) => {
      const result = await fluxHttpHelpers.executeRequest('post', '/auth/login', {
        data: testData.users.invalid
      });
      
      expect(result.success).toBe(false);
      expect(result.error.status).toBe(401);
      expect(result.error.data).toMatchObject({
        error: 'Invalid credentials'
      });
    });

    test('should handle login with missing credentials', async ({ 
      fluxHttpHelpers 
    }) => {
      const result = await fluxHttpHelpers.executeRequest('post', '/auth/login', {
        data: { username: 'testuser' } // missing password
      });
      
      expect(result.success).toBe(false);
      expect(result.error.status).toBe(400);
      expect(result.error.data).toMatchObject({
        error: 'Username and password required'
      });
    });

    test('should handle multiple concurrent login attempts', async ({ 
      fluxHttpHelpers 
    }) => {
      // Setup request interception
      await fluxHttpHelpers.setupRequestInterception();
      
      // Make multiple concurrent login requests
      const loginPromises = Array.from({ length: 5 }, () =>
        fluxHttpHelpers.executeRequest('post', '/auth/login', {
          data: testData.users.valid
        })
      );
      
      const results = await Promise.all(loginPromises);
      
      // All should succeed and return unique tokens
      expect(results.every(r => r.success)).toBe(true);
      
      const tokens = results.map(r => r.data.token);
      const uniqueTokens = new Set(tokens);
      expect(uniqueTokens.size).toBe(tokens.length); // All tokens should be unique
    });
  });

  test.describe('Token Management', () => {
    test('should successfully refresh token', async ({ 
      authHelper, 
      fluxHttpHelpers 
    }) => {
      // Login first
      const originalToken = await authHelper.login();
      
      // Wait a moment to ensure different timestamps
      await fluxHttpHelpers.page.waitForTimeout(100);
      
      // Refresh token
      const newToken = await authHelper.refreshToken();
      
      // Verify new token is different
      expect(newToken).toBeTruthy();
      expect(newToken).not.toBe(originalToken);
      
      // Verify old token is invalidated by trying to use it
      await fluxHttpHelpers.setAuthToken(originalToken);
      const result = await fluxHttpHelpers.executeRequest('get', '/auth/profile');
      expect(result.success).toBe(false);
      expect(result.error.status).toBe(401);
    });

    test('should fail to refresh with invalid token', async ({ 
      fluxHttpHelpers 
    }) => {
      // Set invalid token
      await fluxHttpHelpers.setAuthToken('invalid-token');
      
      const result = await fluxHttpHelpers.executeRequest('post', '/auth/refresh');
      
      expect(result.success).toBe(false);
      expect(result.error.status).toBe(401);
    });

    test('should handle token expiration gracefully', async ({ 
      authHelper, 
      fluxHttpHelpers 
    }) => {
      // Login
      await authHelper.login();
      
      // Simulate token expiration by clearing server-side session
      await fluxHttpHelpers.page.evaluate(async () => {
        // Make a request that will clear the session server-side
        await fetch('/auth/logout', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('authToken')}`
          }
        });
      });
      
      // Try to access protected resource
      const result = await fluxHttpHelpers.executeRequest('get', '/auth/profile');
      
      expect(result.success).toBe(false);
      expect(result.error.status).toBe(401);
    });
  });

  test.describe('Protected Resource Access', () => {
    test('should access protected resource with valid token', async ({ 
      authHelper, 
      fluxHttpHelpers 
    }) => {
      // Login
      await authHelper.login();
      
      // Access protected resource
      const result = await fluxHttpHelpers.executeRequest('get', '/auth/profile');
      
      expect(result.success).toBe(true);
      expect(result.status).toBe(200);
      expect(result.data.user).toBeDefined();
      expect(result.data.user.username).toBe(testData.users.valid.username);
    });

    test('should reject access to protected resource without token', async ({ 
      fluxHttpHelpers 
    }) => {
      const result = await fluxHttpHelpers.executeRequest('get', '/auth/profile');
      
      expect(result.success).toBe(false);
      expect(result.error.status).toBe(401);
    });

    test('should reject access with malformed token', async ({ 
      fluxHttpHelpers 
    }) => {
      await fluxHttpHelpers.setAuthToken('malformed.token.here');
      
      const result = await fluxHttpHelpers.executeRequest('get', '/auth/profile');
      
      expect(result.success).toBe(false);
      expect(result.error.status).toBe(401);
    });
  });

  test.describe('Logout Flow', () => {
    test('should successfully logout', async ({ 
      authHelper, 
      fluxHttpHelpers 
    }) => {
      // Login first
      await authHelper.login();
      
      // Verify we can access protected resource
      const beforeLogout = await fluxHttpHelpers.executeRequest('get', '/auth/profile');
      expect(beforeLogout.success).toBe(true);
      
      // Logout
      await authHelper.logout();
      
      // Verify token is removed from local storage
      const storedToken = await fluxHttpHelpers.page.evaluate(() => 
        localStorage.getItem('authToken')
      );
      expect(storedToken).toBeNull();
      
      // Verify auth header is removed
      const hasAuthHeader = await fluxHttpHelpers.page.evaluate(() => {
        const authHeader = window.fluxHttpInstance.defaults.headers.common['Authorization'];
        return !!authHeader;
      });
      expect(hasAuthHeader).toBe(false);
      
      // Verify we can no longer access protected resources
      const afterLogout = await fluxHttpHelpers.executeRequest('get', '/auth/profile');
      expect(afterLogout.success).toBe(false);
      expect(afterLogout.error.status).toBe(401);
    });

    test('should handle logout with invalid token gracefully', async ({ 
      fluxHttpHelpers 
    }) => {
      // Set invalid token
      await fluxHttpHelpers.setAuthToken('invalid-token');
      
      // Attempt logout
      const result = await fluxHttpHelpers.executeRequest('post', '/auth/logout');
      
      // Should fail but not crash
      expect(result.success).toBe(false);
      expect(result.error.status).toBe(401);
    });
  });

  test.describe('Authentication State Persistence', () => {
    test('should maintain authentication across page reloads', async ({ 
      authHelper, 
      fluxHttpHelpers, 
      testPage 
    }) => {
      // Login
      const token = await authHelper.login();
      
      // Reload page
      await testPage.reload();
      
      // Re-initialize FluxHTTP
      await fluxHttpHelpers.loadFluxHttp();
      await fluxHttpHelpers.createFluxHttpInstance();
      
      // Restore auth state
      await fluxHttpHelpers.setAuthToken(token);
      
      // Verify we can still access protected resources
      const result = await fluxHttpHelpers.executeRequest('get', '/auth/profile');
      expect(result.success).toBe(true);
    });

    test('should handle authentication state in multiple tabs', async ({ 
      browser, 
      fluxHttpHelpers 
    }) => {
      // Create second page/tab
      const secondPage = await browser.newPage();
      const secondHelpers = new (await import('../utils/test-helpers')).FluxHttpTestHelpers(secondPage);
      
      try {
        // Setup second tab
        await secondPage.goto('/static/test.html');
        await secondHelpers.loadFluxHttp();
        await secondHelpers.createFluxHttpInstance();
        
        // Login in first tab
        const token = await fluxHttpHelpers.page.evaluate(async () => {
          const response = await window.fluxHttpInstance.post('/auth/login', {
            username: 'testuser',
            password: 'testpass'
          });
          const token = response.data.token;
          localStorage.setItem('authToken', token);
          window.fluxHttpInstance.defaults.headers.common['Authorization'] = `Bearer ${token}`;
          return token;
        });
        
        // Set same token in second tab
        await secondHelpers.setAuthToken(token);
        
        // Verify both tabs can access protected resources
        const [firstResult, secondResult] = await Promise.all([
          fluxHttpHelpers.executeRequest('get', '/auth/profile'),
          secondHelpers.executeRequest('get', '/auth/profile')
        ]);
        
        expect(firstResult.success).toBe(true);
        expect(secondResult.success).toBe(true);
        
      } finally {
        await secondPage.close();
      }
    });
  });

  test.describe('Role-Based Access Control', () => {
    test('should handle different user roles', async ({ 
      fluxHttpHelpers 
    }) => {
      // Login as admin
      const adminResult = await fluxHttpHelpers.executeRequest('post', '/auth/login', {
        data: testData.users.admin
      });
      
      expect(adminResult.success).toBe(true);
      expect(adminResult.data.user.role).toBe('admin');
      
      // Set admin token
      await fluxHttpHelpers.setAuthToken(adminResult.data.token);
      
      // Access admin profile
      const profileResult = await fluxHttpHelpers.executeRequest('get', '/auth/profile');
      expect(profileResult.success).toBe(true);
      expect(profileResult.data.user.role).toBe('admin');
    });
  });

  test.describe('Authentication Error Handling', () => {
    test('should handle network errors during authentication', async ({ 
      fluxHttpHelpers 
    }) => {
      // Simulate network failure
      await fluxHttpHelpers.simulateNetworkConditions({ offline: true });
      
      const result = await fluxHttpHelpers.executeRequest('post', '/auth/login', {
        data: testData.users.valid
      });
      
      expect(result.success).toBe(false);
      expect(result.error.message).toContain('fetch');
      
      // Restore network
      await fluxHttpHelpers.simulateNetworkConditions({ offline: false });
    });

    test('should handle authentication timeout', async ({ 
      fluxHttpHelpers 
    }) => {
      // Set very short timeout
      await fluxHttpHelpers.createFluxHttpInstance({ timeout: 100 });
      
      // Try to login with delay endpoint
      const result = await fluxHttpHelpers.executeRequest('post', '/delay/5000', {
        data: testData.users.valid
      });
      
      expect(result.success).toBe(false);
      expect(result.error.message).toContain('timeout');
    });

    test('should handle malformed authentication responses', async ({ 
      fluxHttpHelpers 
    }) => {
      // Login to get valid token format, then test error endpoint
      const result = await fluxHttpHelpers.executeRequest('post', '/error/500', {
        data: testData.users.valid
      });
      
      expect(result.success).toBe(false);
      expect(result.error.status).toBe(500);
    });
  });
});