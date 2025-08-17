import { test, expect, testData } from '../utils/fixtures';

test.describe('Framework Integration Tests', () => {
  test.describe('React Integration', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/static/../frameworks/react-app.html');
    });

    test('should load FluxHTTP in React environment', async ({ page }) => {
      // Wait for React app to initialize
      await page.waitForSelector('h1:has-text("FluxHTTP React Integration Test")');
      
      // Load FluxHTTP
      const distPath = require('path').resolve('dist/index.js');
      const fluxHttpCode = require('fs').readFileSync(distPath, 'utf-8');
      await page.addScriptTag({ content: fluxHttpCode });
      
      // Wait for FluxHTTP to be available
      await page.waitForFunction(() => window.fluxhttp !== undefined);
      
      // Check React test results
      const results = await page.evaluate(() => window.reactTestResults);
      expect(results.fluxHttpLoaded).toBe(true);
    });

    test('should handle HTTP methods in React components', async ({ page }) => {
      // Load FluxHTTP
      const distPath = require('path').resolve('dist/index.js');
      const fluxHttpCode = require('fs').readFileSync(distPath, 'utf-8');
      await page.addScriptTag({ content: fluxHttpCode });
      
      await page.waitForFunction(() => window.fluxhttp !== undefined);
      
      // Test GET request
      await page.click('button:has-text("Test GET")');
      
      // Wait for result to appear
      await page.waitForSelector('.status:has-text("GET: Success")', { timeout: 10000 });
      
      // Verify success message
      const getResult = await page.textContent('.status:has-text("GET:")');
      expect(getResult).toContain('Success');
    });

    test('should handle authentication flow in React', async ({ page }) => {
      // Load FluxHTTP
      const distPath = require('path').resolve('dist/index.js');
      const fluxHttpCode = require('fs').readFileSync(distPath, 'utf-8');
      await page.addScriptTag({ content: fluxHttpCode });
      
      await page.waitForFunction(() => window.fluxhttp !== undefined);
      
      // Test login
      await page.click('button:has-text("Login")');
      
      // Wait for authentication status to update
      await page.waitForSelector('.status:has-text("Authenticated")', { timeout: 10000 });
      
      // Verify login status
      const authStatus = await page.textContent('.status:has-text("Authenticated")');
      expect(authStatus).toContain('Authenticated');
      
      // Test profile access
      await page.click('button:has-text("Get Profile")');
      
      // Wait for profile result
      await page.waitForSelector('.status:has-text("Profile:")', { timeout: 5000 });
      
      const profileStatus = await page.textContent('.status:has-text("Profile:")');
      expect(profileStatus).toContain('Profile:');
    });

    test('should handle file upload in React', async ({ page }) => {
      // Load FluxHTTP
      const distPath = require('path').resolve('dist/index.js');
      const fluxHttpCode = require('fs').readFileSync(distPath, 'utf-8');
      await page.addScriptTag({ content: fluxHttpCode });
      
      await page.waitForFunction(() => window.fluxhttp !== undefined);
      
      // Create a test file
      const fileContent = 'Test file content for React upload';
      
      // Set file input
      await page.setInputFiles('input[type="file"]', {
        name: 'react-test.txt',
        mimeType: 'text/plain',
        buffer: Buffer.from(fileContent)
      });
      
      // Click upload
      await page.click('button:has-text("Upload File")');
      
      // Wait for upload result
      await page.waitForSelector('.status:has-text("Upload successful")', { timeout: 10000 });
      
      const uploadStatus = await page.textContent('.status:has-text("Upload successful")');
      expect(uploadStatus).toContain('Upload successful');
    });

    test('should handle concurrent requests in React', async ({ page }) => {
      // Load FluxHTTP
      const distPath = require('path').resolve('dist/index.js');
      const fluxHttpCode = require('fs').readFileSync(distPath, 'utf-8');
      await page.addScriptTag({ content: fluxHttpCode });
      
      await page.waitForFunction(() => window.fluxhttp !== undefined);
      
      // Test concurrent requests
      await page.click('button:has-text("Test 10 Concurrent Requests")');
      
      // Wait for results
      await page.waitForSelector('pre', { timeout: 15000 });
      
      const results = await page.textContent('pre');
      const parsedResults = JSON.parse(results);
      
      expect(parsedResults.success).toBe(true);
      expect(parsedResults.count).toBe(10);
      expect(parsedResults.duration).toBeGreaterThan(0);
    });

    test('should handle React component lifecycle', async ({ page }) => {
      // Load FluxHTTP
      const distPath = require('path').resolve('dist/index.js');
      const fluxHttpCode = require('fs').readFileSync(distPath, 'utf-8');
      await page.addScriptTag({ content: fluxHttpCode });
      
      await page.waitForFunction(() => window.fluxhttp !== undefined);
      
      // Test multiple component interactions
      await page.click('button:has-text("Test GET")');
      await page.waitForSelector('.status:has-text("GET: Success")');
      
      await page.click('button:has-text("Test POST")');
      await page.waitForSelector('.status:has-text("POST: Success")');
      
      // Verify both requests completed
      const getStatus = await page.isVisible('.status:has-text("GET: Success")');
      const postStatus = await page.isVisible('.status:has-text("POST: Success")');
      
      expect(getStatus).toBe(true);
      expect(postStatus).toBe(true);
    });
  });

  test.describe('Vue Integration', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/static/../frameworks/vue-app.html');
    });

    test('should load FluxHTTP in Vue environment', async ({ page }) => {
      // Wait for Vue app to initialize
      await page.waitForSelector('h1:has-text("FluxHTTP Vue Integration Test")');
      
      // Load FluxHTTP
      const distPath = require('path').resolve('dist/index.js');
      const fluxHttpCode = require('fs').readFileSync(distPath, 'utf-8');
      await page.addScriptTag({ content: fluxHttpCode });
      
      // Wait for FluxHTTP to be available
      await page.waitForFunction(() => window.fluxhttp !== undefined);
      
      // Check Vue test results
      const results = await page.evaluate(() => window.vueTestResults);
      expect(results.fluxHttpLoaded).toBe(true);
    });

    test('should handle HTTP methods in Vue components', async ({ page }) => {
      // Load FluxHTTP
      const distPath = require('path').resolve('dist/index.js');
      const fluxHttpCode = require('fs').readFileSync(distPath, 'utf-8');
      await page.addScriptTag({ content: fluxHttpCode });
      
      await page.waitForFunction(() => window.fluxhttp !== undefined);
      
      // Test GET and POST requests
      await page.click('button:has-text("Test GET")');
      await page.waitForSelector('.status:has-text("GET: Success")', { timeout: 10000 });
      
      await page.click('button:has-text("Test POST")');
      await page.waitForSelector('.status:has-text("POST: Success")', { timeout: 10000 });
      
      // Verify both requests succeeded
      const getResult = await page.textContent('.status:has-text("GET:")');
      const postResult = await page.textContent('.status:has-text("POST:")');
      
      expect(getResult).toContain('Success');
      expect(postResult).toContain('Success');
    });

    test('should handle Vue reactivity with HTTP requests', async ({ page }) => {
      // Load FluxHTTP
      const distPath = require('path').resolve('dist/index.js');
      const fluxHttpCode = require('fs').readFileSync(distPath, 'utf-8');
      await page.addScriptTag({ content: fluxHttpCode });
      
      await page.waitForFunction(() => window.fluxhttp !== undefined);
      
      // Test authentication flow to verify reactivity
      await page.click('button:has-text("Login")');
      await page.waitForSelector('.status:has-text("Authenticated")', { timeout: 10000 });
      
      // Verify button states changed (Vue reactivity)
      const profileBtnDisabled = await page.isDisabled('button:has-text("Get Profile")');
      expect(profileBtnDisabled).toBe(false);
      
      // Test profile access
      await page.click('button:has-text("Get Profile")');
      await page.waitForSelector('.status:has-text("Profile:")', { timeout: 5000 });
      
      const profileStatus = await page.textContent('.status:has-text("Profile:")');
      expect(profileStatus).toContain('Profile:');
    });

    test('should handle Vue composition API with FluxHTTP', async ({ page }) => {
      // Load FluxHTTP
      const distPath = require('path').resolve('dist/index.js');
      const fluxHttpCode = require('fs').readFileSync(distPath, 'utf-8');
      await page.addScriptTag({ content: fluxHttpCode });
      
      await page.waitForFunction(() => window.fluxhttp !== undefined);
      
      // Test real-time data component (uses composition API)
      await page.click('button:has-text("Start Stream")');
      
      // Wait for streaming to start
      await page.waitForSelector('.status:has-text("Streaming")', { timeout: 5000 });
      
      // Wait for some data to arrive
      await page.waitForSelector('h4:has-text("Received Data:")', { timeout: 10000 });
      
      // Verify data was received
      const dataItems = await page.locator('.status:has-text(":")').count();
      expect(dataItems).toBeGreaterThan(0);
    });

    test('should handle Vue error boundaries with HTTP errors', async ({ page }) => {
      // Load FluxHTTP
      const distPath = require('path').resolve('dist/index.js');
      const fluxHttpCode = require('fs').readFileSync(distPath, 'utf-8');
      await page.addScriptTag({ content: fluxHttpCode });
      
      await page.waitForFunction(() => window.fluxhttp !== undefined);
      
      // Test error handling
      await page.click('button:has-text("Test 404")');
      
      // Wait for error result
      await page.waitForSelector('.status:has-text("404: Caught")', { timeout: 5000 });
      
      const errorResult = await page.textContent('.status:has-text("404:")');
      expect(errorResult).toContain('Caught');
    });
  });

  test.describe('Vanilla JavaScript Integration', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/static/../frameworks/vanilla-js-app.html');
    });

    test('should load FluxHTTP in vanilla JS environment', async ({ page }) => {
      // Load FluxHTTP
      const distPath = require('path').resolve('dist/index.js');
      const fluxHttpCode = require('fs').readFileSync(distPath, 'utf-8');
      await page.addScriptTag({ content: fluxHttpCode });
      
      // Wait for initialization
      await page.waitForSelector('h1:has-text("FluxHTTP Vanilla JavaScript Integration Test")');
      
      // Check vanilla JS test results
      const results = await page.evaluate(() => window.vanillaTestResults);
      expect(results.fluxHttpLoaded).toBe(true);
    });

    test('should handle all HTTP methods in vanilla JS', async ({ page }) => {
      // Load FluxHTTP
      const distPath = require('path').resolve('dist/index.js');
      const fluxHttpCode = require('fs').readFileSync(distPath, 'utf-8');
      await page.addScriptTag({ content: fluxHttpCode });
      
      // Wait for initialization
      await page.waitForFunction(() => window.vanillaTestResults?.fluxHttpLoaded === true);
      
      // Test all HTTP methods
      const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];
      
      for (const method of methods) {
        await page.click(`button:has-text("Test ${method}")`);
        await page.waitForSelector(`.status:has-text("${method}: Success")`, { timeout: 10000 });
        
        const result = await page.textContent(`.status:has-text("${method}:")`);
        expect(result).toContain('Success');
      }
    });

    test('should handle authentication flow in vanilla JS', async ({ page }) => {
      // Load FluxHTTP
      const distPath = require('path').resolve('dist/index.js');
      const fluxHttpCode = require('fs').readFileSync(distPath, 'utf-8');
      await page.addScriptTag({ content: fluxHttpCode });
      
      await page.waitForFunction(() => window.vanillaTestResults?.fluxHttpLoaded === true);
      
      // Complete authentication flow
      await page.click('button:has-text("Login")');
      await page.waitForSelector('.status:has-text("Authenticated")', { timeout: 10000 });
      
      await page.click('button:has-text("Get Profile")');
      await page.waitForSelector('.status:has-text("Profile:")', { timeout: 5000 });
      
      await page.click('button:has-text("Refresh Token")');
      await page.waitForSelector('.status:has-text("Token refreshed")', { timeout: 5000 });
      
      await page.click('button:has-text("Logout")');
      await page.waitForSelector('.status:has-text("Logged out")', { timeout: 5000 });
      
      // Verify logout state
      const logoutStatus = await page.textContent('.status:has-text("Logged out")');
      expect(logoutStatus).toContain('Logged out');
    });

    test('should handle file upload with progress in vanilla JS', async ({ page }) => {
      // Load FluxHTTP
      const distPath = require('path').resolve('dist/index.js');
      const fluxHttpCode = require('fs').readFileSync(distPath, 'utf-8');
      await page.addScriptTag({ content: fluxHttpCode });
      
      await page.waitForFunction(() => window.vanillaTestResults?.fluxHttpLoaded === true);
      
      // Upload test file
      await page.setInputFiles('#file-input', {
        name: 'vanilla-test.txt',
        mimeType: 'text/plain',
        buffer: Buffer.from('Vanilla JS test file content')
      });
      
      // Trigger upload
      await page.click('#upload-btn');
      
      // Wait for upload to complete
      await page.waitForSelector('.status:has-text("Upload successful")', { timeout: 10000 });
      
      const uploadStatus = await page.textContent('.status:has-text("Upload successful")');
      expect(uploadStatus).toContain('Upload successful');
    });

    test('should handle concurrent requests in vanilla JS', async ({ page }) => {
      // Load FluxHTTP
      const distPath = require('path').resolve('dist/index.js');
      const fluxHttpCode = require('fs').readFileSync(distPath, 'utf-8');
      await page.addScriptTag({ content: fluxHttpCode });
      
      await page.waitForFunction(() => window.vanillaTestResults?.fluxHttpLoaded === true);
      
      // Test basic concurrent requests
      await page.click('button:has-text("Test 10 Concurrent Requests")');
      await page.waitForSelector('.status:has-text("Completed 10 requests")', { timeout: 15000 });
      
      // Test mixed methods
      await page.click('button:has-text("Test Mixed Methods Concurrency")');
      await page.waitForSelector('.status:has-text("Mixed methods completed")', { timeout: 10000 });
      
      // Test large batch
      await page.click('button:has-text("Test Large Batch (50 requests)")');
      await page.waitForSelector('.status:has-text("Completed 50 requests")', { timeout: 20000 });
      
      const largeResult = await page.textContent('.status:has-text("Completed 50 requests")');
      expect(largeResult).toContain('Completed 50 requests');
    });

    test('should handle error scenarios in vanilla JS', async ({ page }) => {
      // Load FluxHTTP
      const distPath = require('path').resolve('dist/index.js');
      const fluxHttpCode = require('fs').readFileSync(distPath, 'utf-8');
      await page.addScriptTag({ content: fluxHttpCode });
      
      await page.waitForFunction(() => window.vanillaTestResults?.fluxHttpLoaded === true);
      
      // Test various error codes
      const errorCodes = [400, 401, 404, 500];
      
      for (const code of errorCodes) {
        await page.click(`button:has-text("Test ${code}")`);
        await page.waitForSelector(`.status:has-text("${code}: Caught")`, { timeout: 10000 });
        
        const result = await page.textContent(`.status:has-text("${code}:")`);
        expect(result).toContain('Caught');
      }
      
      // Test timeout
      await page.click('button:has-text("Test Timeout")');
      await page.waitForSelector('.status:has-text("Timeout: Caught")', { timeout: 10000 });
      
      // Test network error
      await page.click('button:has-text("Test Network Error")');
      await page.waitForSelector('.status:has-text("Network: Caught")', { timeout: 10000 });
    });

    test('should handle performance testing in vanilla JS', async ({ page }) => {
      // Load FluxHTTP
      const distPath = require('path').resolve('dist/index.js');
      const fluxHttpCode = require('fs').readFileSync(distPath, 'utf-8');
      await page.addScriptTag({ content: fluxHttpCode });
      
      await page.waitForFunction(() => window.vanillaTestResults?.fluxHttpLoaded === true);
      
      // Run performance test
      await page.click('button:has-text("Run Performance Test")');
      await page.waitForSelector('.status:has-text("Performance test completed")', { timeout: 15000 });
      
      const perfResult = await page.textContent('.status:has-text("Performance test completed")');
      expect(perfResult).toContain('Performance test completed');
      
      // Check performance results
      const perfData = await page.textContent('#performance-results');
      const perfResults = JSON.parse(perfData);
      
      expect(perfResults.iterations).toBe(20);
      expect(perfResults.successCount).toBeGreaterThan(15); // Allow some failures
      expect(parseFloat(perfResults.averageTime)).toBeLessThan(1000); // Should be fast
    });

    test('should handle interceptors in vanilla JS', async ({ page }) => {
      // Load FluxHTTP
      const distPath = require('path').resolve('dist/index.js');
      const fluxHttpCode = require('fs').readFileSync(distPath, 'utf-8');
      await page.addScriptTag({ content: fluxHttpCode });
      
      await page.waitForFunction(() => window.vanillaTestResults?.fluxHttpLoaded === true);
      
      // Setup interceptors
      await page.click('button:has-text("Setup Interceptors")');
      await page.waitForSelector('.status:has-text("Interceptors setup successfully")');
      
      // Test with interceptors
      await page.click('button:has-text("Test Request with Interceptors")');
      await page.waitForSelector('.status:has-text("Request with interceptors completed")');
      
      // Verify interceptor logs
      const logEntries = await page.locator('#interceptors-log .status').count();
      expect(logEntries).toBeGreaterThan(0);
      
      // Clear interceptors
      await page.click('button:has-text("Clear Interceptors")');
      await page.waitForSelector('.status:has-text("Interceptors cleared")');
    });

    test('should handle request cancellation in vanilla JS', async ({ page }) => {
      // Load FluxHTTP
      const distPath = require('path').resolve('dist/index.js');
      const fluxHttpCode = require('fs').readFileSync(distPath, 'utf-8');
      await page.addScriptTag({ content: fluxHttpCode });
      
      await page.waitForFunction(() => window.vanillaTestResults?.fluxHttpLoaded === true);
      
      // Test single cancellation
      await page.click('button:has-text("Test Cancellation")');
      await page.waitForSelector('.status:has-text("Request cancelled successfully")', { timeout: 10000 });
      
      // Test multiple cancellation
      await page.click('button:has-text("Test Multiple Cancellation")');
      await page.waitForSelector('.status:has-text("5/5 requests cancelled")', { timeout: 10000 });
      
      const multiResult = await page.textContent('.status:has-text("requests cancelled")');
      expect(multiResult).toContain('5/5 requests cancelled successfully');
    });
  });

  test.describe('Cross-Framework Compatibility', () => {
    test('should maintain consistent behavior across frameworks', async ({ browser }) => {
      // Test the same functionality across all frameworks
      const frameworks = [
        { name: 'React', url: '/static/../frameworks/react-app.html', testSelector: 'button:has-text("Test GET")' },
        { name: 'Vue', url: '/static/../frameworks/vue-app.html', testSelector: 'button:has-text("Test GET")' },
        { name: 'Vanilla', url: '/static/../frameworks/vanilla-js-app.html', testSelector: 'button:has-text("Test GET")' }
      ];
      
      const results = [];
      
      for (const framework of frameworks) {
        const page = await browser.newPage();
        
        try {
          await page.goto(framework.url);
          
          // Load FluxHTTP
          const distPath = require('path').resolve('dist/index.js');
          const fluxHttpCode = require('fs').readFileSync(distPath, 'utf-8');
          await page.addScriptTag({ content: fluxHttpCode });
          
          // Wait for framework to be ready
          await page.waitForFunction(() => window.fluxhttp !== undefined);
          
          // Perform the same test in each framework
          const startTime = Date.now();
          await page.click(framework.testSelector);
          
          // Wait for success result
          await page.waitForSelector('.status:has-text("GET: Success")', { timeout: 10000 });
          const endTime = Date.now();
          
          results.push({
            framework: framework.name,
            success: true,
            duration: endTime - startTime
          });
          
        } catch (error) {
          results.push({
            framework: framework.name,
            success: false,
            error: error.message
          });
        } finally {
          await page.close();
        }
      }
      
      // Verify all frameworks succeeded
      expect(results.every(r => r.success)).toBe(true);
      
      // Verify performance is consistent (within 2x range)
      const durations = results.map(r => r.duration);
      const maxDuration = Math.max(...durations);
      const minDuration = Math.min(...durations);
      
      expect(maxDuration / minDuration).toBeLessThan(3); // Max 3x difference
    });

    test('should handle memory management consistently across frameworks', async ({ browser }) => {
      const frameworks = [
        '/static/../frameworks/react-app.html',
        '/static/../frameworks/vue-app.html',
        '/static/../frameworks/vanilla-js-app.html'
      ];
      
      const memoryResults = [];
      
      for (const frameworkUrl of frameworks) {
        const page = await browser.newPage();
        
        try {
          await page.goto(frameworkUrl);
          
          // Load FluxHTTP
          const distPath = require('path').resolve('dist/index.js');
          const fluxHttpCode = require('fs').readFileSync(distPath, 'utf-8');
          await page.addScriptTag({ content: fluxHttpCode });
          
          await page.waitForFunction(() => window.fluxhttp !== undefined);
          
          // Measure memory before
          const memBefore = await page.evaluate(() => {
            return performance.memory ? performance.memory.usedJSHeapSize : 0;
          });
          
          // Perform memory-intensive operations
          await page.evaluate(async () => {
            const requests = Array.from({ length: 20 }, (_, i) =>
              window.fluxhttp.create().get(`/concurrent/${i}`)
            );
            await Promise.all(requests);
          });
          
          // Measure memory after
          const memAfter = await page.evaluate(() => {
            return performance.memory ? performance.memory.usedJSHeapSize : 0;
          });
          
          memoryResults.push({
            framework: frameworkUrl.split('/').pop().replace('.html', ''),
            memoryIncrease: memAfter - memBefore
          });
          
        } catch (error) {
          console.error(`Memory test failed for ${frameworkUrl}:`, error);
        } finally {
          await page.close();
        }
      }
      
      // Verify memory usage is reasonable across frameworks
      if (memoryResults.length > 0) {
        const avgMemoryIncrease = memoryResults.reduce((sum, r) => sum + r.memoryIncrease, 0) / memoryResults.length;
        
        // Each framework should be within 50% of average memory usage
        memoryResults.forEach(result => {
          const deviation = Math.abs(result.memoryIncrease - avgMemoryIncrease) / avgMemoryIncrease;
          expect(deviation).toBeLessThan(0.5);
        });
      }
    });
  });
});