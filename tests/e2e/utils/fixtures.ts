import { test as base, Page } from '@playwright/test';
import { FluxHttpTestHelpers, AuthHelper, FileHelper, PerformanceHelper } from './test-helpers';

// Test fixtures for FluxHTTP E2E tests
export interface FluxHttpFixtures {
  fluxHttpHelpers: FluxHttpTestHelpers;
  authHelper: AuthHelper;
  fileHelper: FileHelper;
  performanceHelper: PerformanceHelper;
  testPage: Page;
}

export const test = base.extend<FluxHttpFixtures>({
  // Test page with FluxHTTP pre-loaded
  testPage: async ({ page }, use) => {
    // Navigate to test page
    await page.goto('/static/test.html');
    
    // Load FluxHTTP
    const helpers = new FluxHttpTestHelpers(page);
    await helpers.loadFluxHttp();
    await helpers.createFluxHttpInstance({
      baseURL: process.env.BASE_URL || 'http://localhost:3000',
      timeout: 10000
    });
    
    await use(page);
  },

  // FluxHTTP test helpers
  fluxHttpHelpers: async ({ testPage }, use) => {
    const helpers = new FluxHttpTestHelpers(testPage);
    await use(helpers);
  },

  // Authentication helper
  authHelper: async ({ fluxHttpHelpers }, use) => {
    const authHelper = new AuthHelper(fluxHttpHelpers);
    await use(authHelper);
  },

  // File operations helper
  fileHelper: async ({ fluxHttpHelpers }, use) => {
    const fileHelper = new FileHelper(fluxHttpHelpers);
    await use(fileHelper);
  },

  // Performance testing helper
  performanceHelper: async ({ fluxHttpHelpers }, use) => {
    const performanceHelper = new PerformanceHelper(fluxHttpHelpers);
    await use(performanceHelper);
  }
});

export { expect } from '@playwright/test';

// Common test data
export const testData = {
  users: {
    valid: { username: 'testuser', password: 'testpass' },
    admin: { username: 'admin', password: 'admin123' },
    invalid: { username: 'invalid', password: 'wrong' }
  },
  
  apiEndpoints: {
    echo: '/echo',
    login: '/auth/login',
    profile: '/auth/profile',
    upload: '/files/upload',
    download: '/files/download',
    large: '/data/large',
    delay: '/delay',
    error: '/error',
    concurrent: '/concurrent'
  },
  
  payloads: {
    small: { message: 'Hello World' },
    medium: { data: 'x'.repeat(1000) }, // 1KB
    large: { data: 'x'.repeat(100000) }, // 100KB
    xlarge: { data: 'x'.repeat(1000000) } // 1MB
  },
  
  timeouts: {
    short: 1000,
    medium: 5000,
    long: 10000,
    veryLong: 30000
  },
  
  networkConditions: {
    fast: {
      downloadThroughput: 10000000, // 10 Mbps
      uploadThroughput: 2000000,    // 2 Mbps
      latency: 20
    },
    slow: {
      downloadThroughput: 100000,   // 100 Kbps
      uploadThroughput: 50000,      // 50 Kbps
      latency: 200
    },
    mobile3G: {
      downloadThroughput: 375000,   // 375 Kbps
      uploadThroughput: 375000,     // 375 Kbps
      latency: 300
    },
    offline: {
      offline: true
    }
  }
};

// Custom matchers for FluxHTTP responses
export const customMatchers = {
  toBeSuccessfulResponse: (response: any) => {
    const pass = response.success === true && 
                 response.status >= 200 && 
                 response.status < 300;
    
    return {
      message: () => pass 
        ? `Expected response not to be successful`
        : `Expected response to be successful, got status ${response.status}`,
      pass
    };
  },
  
  toHaveStatus: (response: any, expectedStatus: number) => {
    const pass = response.status === expectedStatus;
    
    return {
      message: () => pass
        ? `Expected status not to be ${expectedStatus}`
        : `Expected status ${expectedStatus}, got ${response.status}`,
      pass
    };
  },
  
  toHaveHeader: (response: any, headerName: string, expectedValue?: string) => {
    const headers = response.headers || {};
    const actualValue = headers[headerName.toLowerCase()];
    const hasHeader = actualValue !== undefined;
    const valueMatches = expectedValue === undefined || actualValue === expectedValue;
    const pass = hasHeader && valueMatches;
    
    return {
      message: () => {
        if (!hasHeader) {
          return `Expected response to have header '${headerName}'`;
        }
        if (!valueMatches) {
          return `Expected header '${headerName}' to be '${expectedValue}', got '${actualValue}'`;
        }
        return `Expected response not to have header '${headerName}'`;
      },
      pass
    };
  },
  
  toContainData: (response: any, expectedData: any) => {
    const actualData = response.data;
    const pass = JSON.stringify(actualData).includes(JSON.stringify(expectedData));
    
    return {
      message: () => pass
        ? `Expected response data not to contain ${JSON.stringify(expectedData)}`
        : `Expected response data to contain ${JSON.stringify(expectedData)}`,
      pass
    };
  }
};

// Test configuration presets
export const testConfigs = {
  // Standard browser test
  browser: {
    timeout: 30000,
    retries: 2
  },
  
  // Performance test with longer timeout
  performance: {
    timeout: 60000,
    retries: 1
  },
  
  // Stress test with minimal retries
  stress: {
    timeout: 120000,
    retries: 0
  },
  
  // Network test with custom conditions
  network: {
    timeout: 45000,
    retries: 1
  },
  
  // Security test
  security: {
    timeout: 30000,
    retries: 0
  }
};