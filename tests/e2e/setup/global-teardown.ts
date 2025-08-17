import { FullConfig } from '@playwright/test';
import fs from 'fs';
import path from 'path';

async function globalTeardown(config: FullConfig) {
  console.log('🧹 Starting E2E test teardown...');

  try {
    // Clean up test uploads
    const uploadsDir = path.resolve('tests/e2e/uploads');
    if (fs.existsSync(uploadsDir)) {
      const files = fs.readdirSync(uploadsDir);
      for (const file of files) {
        fs.unlinkSync(path.join(uploadsDir, file));
      }
      console.log('🗑️ Cleaned up test upload files');
    }

    // Clean up temporary test files (keep the static ones)
    const tempFiles = [
      'test-results/temp-test-data.json',
      'test-results/performance-data.json'
    ];

    for (const file of tempFiles) {
      const fullPath = path.resolve(file);
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
        console.log(`🗑️ Removed temporary file: ${file}`);
      }
    }

    // Generate test summary if results exist
    const resultsFile = path.resolve('test-results/e2e-results.json');
    if (fs.existsSync(resultsFile)) {
      try {
        const results = JSON.parse(fs.readFileSync(resultsFile, 'utf-8'));
        const summary = {
          totalTests: results.stats?.total || 0,
          passed: results.stats?.passed || 0,
          failed: results.stats?.failed || 0,
          skipped: results.stats?.skipped || 0,
          duration: results.stats?.duration || 0,
          timestamp: new Date().toISOString()
        };

        fs.writeFileSync(
          path.resolve('test-results/e2e-summary.json'),
          JSON.stringify(summary, null, 2)
        );

        console.log('📊 E2E Test Summary:');
        console.log(`   Total: ${summary.totalTests}`);
        console.log(`   Passed: ${summary.passed}`);
        console.log(`   Failed: ${summary.failed}`);
        console.log(`   Skipped: ${summary.skipped}`);
        console.log(`   Duration: ${(summary.duration / 1000).toFixed(2)}s`);

      } catch (parseError) {
        console.warn('⚠️ Could not parse test results for summary');
      }
    }

    // Clean up environment variables
    delete process.env.E2E_TEST_MODE;
    delete process.env.BASE_URL;
    delete process.env.API_URL;

    console.log('✅ E2E test teardown completed successfully');

  } catch (error) {
    console.error('❌ E2E test teardown failed:', error);
    // Don't throw error here to avoid masking test failures
  }
}

export default globalTeardown;