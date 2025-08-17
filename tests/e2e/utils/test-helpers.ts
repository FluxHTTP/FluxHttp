import { Page, expect, Locator } from '@playwright/test';
import fs from 'fs';
import path from 'path';

export class FluxHttpTestHelpers {
  constructor(private page: Page) {}

  /**
   * Load FluxHTTP library into the page
   */
  async loadFluxHttp(): Promise<void> {
    // Read the built FluxHTTP file
    const distPath = path.resolve('dist/index.js');
    const fluxHttpCode = fs.readFileSync(distPath, 'utf-8');
    
    // Inject FluxHTTP into the page
    await this.page.addScriptTag({
      content: fluxHttpCode
    });

    // Wait for FluxHTTP to be available
    await this.page.waitForFunction(() => {
      return typeof window.fluxhttp !== 'undefined';
    }, { timeout: 5000 });

    // Mark as ready
    await this.page.evaluate(() => {
      window.fluxHttpReady = true;
    });
  }

  /**
   * Create a FluxHTTP instance in the browser
   */
  async createFluxHttpInstance(config: any = {}): Promise<void> {
    await this.page.evaluate((config) => {
      window.fluxHttpInstance = window.fluxhttp.create(config);
    }, config);
  }

  /**
   * Execute a FluxHTTP request in the browser and return the result
   */
  async executeRequest(method: string, url: string, config: any = {}): Promise<any> {
    return await this.page.evaluate(async ({ method, url, config }) => {
      try {
        const response = await window.fluxHttpInstance[method](url, config.data, config);
        return {
          success: true,
          data: response.data,
          status: response.status,
          statusText: response.statusText,
          headers: response.headers
        };
      } catch (error) {
        return {
          success: false,
          error: {
            message: error.message,
            status: error.response?.status,
            data: error.response?.data
          }
        };
      }
    }, { method, url, config });
  }

  /**
   * Wait for network request to complete
   */
  async waitForNetworkRequest(urlPattern: string | RegExp): Promise<any> {
    return await this.page.waitForResponse(urlPattern);
  }

  /**
   * Simulate network conditions
   */
  async simulateNetworkConditions(conditions: {
    offline?: boolean;
    downloadThroughput?: number;
    uploadThroughput?: number;
    latency?: number;
  }): Promise<void> {
    await this.page.context().setNetworkConditions(conditions);
  }

  /**
   * Monitor memory usage
   */
  async getMemoryUsage(): Promise<any> {
    return await this.page.evaluate(() => {
      if (performance.memory) {
        return {
          usedJSHeapSize: performance.memory.usedJSHeapSize,
          totalJSHeapSize: performance.memory.totalJSHeapSize,
          jsHeapSizeLimit: performance.memory.jsHeapSizeLimit
        };
      }
      return null;
    });
  }

  /**
   * Create test data
   */
  createTestData(size: number = 1000): any {
    return {
      users: Array.from({ length: size }, (_, i) => ({
        id: i + 1,
        name: `User ${i + 1}`,
        email: `user${i + 1}@example.com`,
        timestamp: Date.now()
      }))
    };
  }

  /**
   * Generate large payload for testing
   */
  generateLargePayload(sizeKB: number = 100): string {
    const sizeBytes = sizeKB * 1024;
    const chunk = 'x'.repeat(1024); // 1KB chunk
    return chunk.repeat(Math.ceil(sizeBytes / 1024)).substring(0, sizeBytes);
  }

  /**
   * Wait for multiple requests to complete
   */
  async waitForConcurrentRequests(urlPatterns: (string | RegExp)[]): Promise<any[]> {
    const promises = urlPatterns.map(pattern => this.waitForNetworkRequest(pattern));
    return await Promise.all(promises);
  }

  /**
   * Measure request timing
   */
  async measureRequestTiming(requestFn: () => Promise<any>): Promise<{
    duration: number;
    result: any;
  }> {
    const startTime = Date.now();
    const result = await requestFn();
    const duration = Date.now() - startTime;
    
    return { duration, result };
  }

  /**
   * Create form data for file upload
   */
  async createFormDataWithFile(fileName: string, content?: string): Promise<any> {
    const testContent = content || 'Test file content for upload';
    
    return await this.page.evaluate(({ fileName, testContent }) => {
      const formData = new FormData();
      const blob = new Blob([testContent], { type: 'text/plain' });
      formData.append('file', blob, fileName);
      return formData;
    }, { fileName, testContent });
  }

  /**
   * Verify request headers
   */
  async verifyRequestHeaders(expectedHeaders: Record<string, string>): Promise<boolean> {
    return await this.page.evaluate((expectedHeaders) => {
      const lastRequest = window.lastFluxHttpRequest;
      if (!lastRequest || !lastRequest.headers) return false;
      
      for (const [key, value] of Object.entries(expectedHeaders)) {
        if (lastRequest.headers[key] !== value) {
          return false;
        }
      }
      return true;
    }, expectedHeaders);
  }

  /**
   * Setup request/response intercepting
   */
  async setupRequestInterception(): Promise<void> {
    await this.page.evaluate(() => {
      const originalFetch = window.fetch;
      window.interceptedRequests = [];
      window.interceptedResponses = [];
      
      window.fetch = async function(...args) {
        const request = {
          url: args[0],
          options: args[1] || {},
          timestamp: Date.now()
        };
        window.interceptedRequests.push(request);
        
        try {
          const response = await originalFetch.apply(this, args);
          window.interceptedResponses.push({
            url: args[0],
            status: response.status,
            statusText: response.statusText,
            timestamp: Date.now()
          });
          return response;
        } catch (error) {
          window.interceptedResponses.push({
            url: args[0],
            error: error.message,
            timestamp: Date.now()
          });
          throw error;
        }
      };
    });
  }

  /**
   * Get intercepted requests
   */
  async getInterceptedRequests(): Promise<any[]> {
    return await this.page.evaluate(() => window.interceptedRequests || []);
  }

  /**
   * Get intercepted responses
   */
  async getInterceptedResponses(): Promise<any[]> {
    return await this.page.evaluate(() => window.interceptedResponses || []);
  }

  /**
   * Clear intercepted requests/responses
   */
  async clearInterceptedRequests(): Promise<void> {
    await this.page.evaluate(() => {
      window.interceptedRequests = [];
      window.interceptedResponses = [];
    });
  }

  /**
   * Simulate authentication token
   */
  async setAuthToken(token: string): Promise<void> {
    await this.page.evaluate((token) => {
      localStorage.setItem('authToken', token);
      
      // Set up FluxHTTP with auth token
      if (window.fluxHttpInstance) {
        window.fluxHttpInstance.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      }
    }, token);
  }

  /**
   * Clear authentication
   */
  async clearAuth(): Promise<void> {
    await this.page.evaluate(() => {
      localStorage.removeItem('authToken');
      
      if (window.fluxHttpInstance) {
        delete window.fluxHttpInstance.defaults.headers.common['Authorization'];
      }
    });
  }

  /**
   * Verify response structure
   */
  verifyResponseStructure(response: any, expectedStructure: any): boolean {
    return this.deepCompareStructure(response, expectedStructure);
  }

  private deepCompareStructure(obj: any, structure: any): boolean {
    if (typeof structure !== 'object' || structure === null) {
      return typeof obj === typeof structure;
    }

    if (Array.isArray(structure)) {
      return Array.isArray(obj) && obj.length > 0 && 
             this.deepCompareStructure(obj[0], structure[0]);
    }

    for (const key in structure) {
      if (!(key in obj)) {
        return false;
      }
      if (!this.deepCompareStructure(obj[key], structure[key])) {
        return false;
      }
    }

    return true;
  }
}

/**
 * Authentication helper
 */
export class AuthHelper {
  constructor(private helpers: FluxHttpTestHelpers) {}

  async login(username: string = 'testuser', password: string = 'testpass'): Promise<string> {
    const result = await this.helpers.executeRequest('post', '/auth/login', {
      data: { username, password }
    });

    if (!result.success) {
      throw new Error(`Login failed: ${result.error.message}`);
    }

    const token = result.data.token;
    await this.helpers.setAuthToken(token);
    return token;
  }

  async logout(): Promise<void> {
    await this.helpers.executeRequest('post', '/auth/logout');
    await this.helpers.clearAuth();
  }

  async refreshToken(): Promise<string> {
    const result = await this.helpers.executeRequest('post', '/auth/refresh');
    
    if (!result.success) {
      throw new Error(`Token refresh failed: ${result.error.message}`);
    }

    const newToken = result.data.token;
    await this.helpers.setAuthToken(newToken);
    return newToken;
  }
}

/**
 * File operations helper
 */
export class FileHelper {
  constructor(private helpers: FluxHttpTestHelpers) {}

  async uploadFile(filePath: string, fileName?: string): Promise<any> {
    const content = fs.readFileSync(path.resolve(filePath), 'utf-8');
    const name = fileName || path.basename(filePath);
    
    return await this.helpers.page.evaluate(async ({ content, name }) => {
      const formData = new FormData();
      const blob = new Blob([content], { type: 'text/plain' });
      formData.append('file', blob, name);
      
      try {
        const response = await window.fluxHttpInstance.post('/files/upload', formData, {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        });
        return { success: true, data: response.data };
      } catch (error) {
        return { success: false, error: error.message };
      }
    }, { content, name });
  }

  async downloadFile(fileName: string): Promise<any> {
    return await this.helpers.executeRequest('get', `/files/download/${fileName}`, {
      responseType: 'blob'
    });
  }
}

/**
 * Performance testing helper
 */
export class PerformanceHelper {
  constructor(private helpers: FluxHttpTestHelpers) {}

  async measureConcurrentRequests(urls: string[], concurrency: number = 10): Promise<any> {
    const results = await this.helpers.page.evaluate(async ({ urls, concurrency }) => {
      const batches = [];
      for (let i = 0; i < urls.length; i += concurrency) {
        batches.push(urls.slice(i, i + concurrency));
      }

      const allResults = [];
      const timings = [];

      for (const batch of batches) {
        const startTime = performance.now();
        const batchPromises = batch.map(async (url) => {
          try {
            const response = await window.fluxHttpInstance.get(url);
            return { success: true, url, status: response.status };
          } catch (error) {
            return { success: false, url, error: error.message };
          }
        });

        const batchResults = await Promise.all(batchPromises);
        const endTime = performance.now();
        
        allResults.push(...batchResults);
        timings.push(endTime - startTime);
      }

      return {
        results: allResults,
        totalTime: timings.reduce((a, b) => a + b, 0),
        batchTimings: timings,
        successCount: allResults.filter(r => r.success).length,
        errorCount: allResults.filter(r => !r.success).length
      };
    }, { urls, concurrency });

    return results;
  }

  async stressTest(url: string, requests: number = 100, duration: number = 30000): Promise<any> {
    return await this.helpers.page.evaluate(async ({ url, requests, duration }) => {
      const startTime = Date.now();
      const results = [];
      let completed = 0;

      const makeRequest = async () => {
        const requestStart = performance.now();
        try {
          const response = await window.fluxHttpInstance.get(url);
          const requestEnd = performance.now();
          results.push({
            success: true,
            duration: requestEnd - requestStart,
            status: response.status
          });
        } catch (error) {
          const requestEnd = performance.now();
          results.push({
            success: false,
            duration: requestEnd - requestStart,
            error: error.message
          });
        }
        completed++;
      };

      const requestPromises = [];
      for (let i = 0; i < requests; i++) {
        if (Date.now() - startTime > duration) break;
        requestPromises.push(makeRequest());
      }

      await Promise.all(requestPromises);

      const successResults = results.filter(r => r.success);
      const errorResults = results.filter(r => !r.success);

      return {
        totalRequests: completed,
        successCount: successResults.length,
        errorCount: errorResults.length,
        averageDuration: successResults.reduce((a, b) => a + b.duration, 0) / successResults.length || 0,
        minDuration: Math.min(...successResults.map(r => r.duration)) || 0,
        maxDuration: Math.max(...successResults.map(r => r.duration)) || 0,
        totalDuration: Date.now() - startTime
      };
    }, { url, requests, duration });
  }
}

declare global {
  interface Window {
    fluxhttp: any;
    fluxHttpInstance: any;
    fluxHttpReady: boolean;
    testResults: any;
    lastFluxHttpRequest: any;
    interceptedRequests: any[];
    interceptedResponses: any[];
    waitForFluxHttp: () => Promise<any>;
  }
}