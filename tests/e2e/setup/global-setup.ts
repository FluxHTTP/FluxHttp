import { FullConfig } from '@playwright/test';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';

const execAsync = promisify(exec);

async function globalSetup(config: FullConfig) {
  console.log('🚀 Starting E2E test setup...');

  try {
    // Ensure dist directory exists and is built
    console.log('📦 Building FluxHTTP...');
    await execAsync('npm run build');
    console.log('✅ Build completed');

    // Create necessary directories
    const dirs = [
      'test-results',
      'test-results/e2e-artifacts',
      'test-results/e2e-report',
      'tests/e2e/uploads',
      'tests/e2e/static'
    ];

    for (const dir of dirs) {
      const fullPath = path.resolve(dir);
      if (!fs.existsSync(fullPath)) {
        fs.mkdirSync(fullPath, { recursive: true });
        console.log(`📁 Created directory: ${dir}`);
      }
    }

    // Create test static files
    const staticDir = path.resolve('tests/e2e/static');
    
    // Create a test HTML file for browser tests
    const testHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>FluxHTTP E2E Test Page</title>
</head>
<body>
    <h1>FluxHTTP E2E Test Page</h1>
    <div id="app"></div>
    
    <!-- FluxHTTP will be loaded via script injection in tests -->
    
    <script>
        window.testResults = {};
        window.fluxHttpReady = false;
        
        // Make fetch available for testing
        if (!window.fetch) {
            console.warn('Fetch not available in this environment');
        }
        
        // Global error handler for testing
        window.addEventListener('error', (event) => {
            console.error('Global error:', event.error);
            window.testResults.globalError = event.error.message;
        });
        
        // Utility function for tests
        window.waitForFluxHttp = () => {
            return new Promise((resolve, reject) => {
                let attempts = 0;
                const checkInterval = setInterval(() => {
                    attempts++;
                    if (window.fluxhttp) {
                        clearInterval(checkInterval);
                        window.fluxHttpReady = true;
                        resolve(window.fluxhttp);
                    } else if (attempts > 50) { // 5 seconds max wait
                        clearInterval(checkInterval);
                        reject(new Error('FluxHTTP not loaded within timeout'));
                    }
                }, 100);
            });
        };
    </script>
</body>
</html>`;
    
    fs.writeFileSync(path.join(staticDir, 'test.html'), testHtml);
    
    // Create a test file for upload testing
    const testFileContent = 'This is a test file for upload testing.\n'.repeat(100);
    fs.writeFileSync(path.join(staticDir, 'test-upload.txt'), testFileContent);
    
    // Create a larger test file
    const largeFileContent = 'Large file content for testing.\n'.repeat(10000);
    fs.writeFileSync(path.join(staticDir, 'large-test-file.txt'), largeFileContent);

    console.log('✅ Static test files created');

    // Verify servers will start (they're started by Playwright config)
    console.log('🌐 Test servers will be started by Playwright');
    
    // Set environment variables for tests
    process.env.E2E_TEST_MODE = 'true';
    process.env.BASE_URL = config.use?.baseURL || 'http://localhost:3000';
    process.env.API_URL = 'http://localhost:3001';
    
    console.log('✅ E2E test setup completed successfully');

  } catch (error) {
    console.error('❌ E2E test setup failed:', error);
    throw error;
  }
}

export default globalSetup;