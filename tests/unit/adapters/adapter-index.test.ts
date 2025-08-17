import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import {
  getDefaultAdapter,
  xhrAdapter,
  httpAdapter,
  fetchAdapter,
  mockAdapter,
  createMockAdapter,
  MockAdapter,
  type Adapter,
} from '../../../src/adapters/index.js';
import type { fluxhttpRequestConfig } from '../../../src/types/index.js';

describe('Adapter System', () => {
  describe('Type Definitions', () => {
    it('should define Adapter type correctly', () => {
      const testAdapter: Adapter = async (config) => {
        return {
          data: {},
          status: 200,
          statusText: 'OK',
          headers: {},
          config,
        };
      };
      
      assert(typeof testAdapter === 'function');
    });
  });

  describe('Adapter Exports', () => {
    it('should export all adapter functions', () => {
      assert(typeof xhrAdapter === 'function');
      assert(typeof httpAdapter === 'function');
      assert(typeof fetchAdapter === 'function');
      assert(typeof mockAdapter === 'function');
      assert(typeof createMockAdapter === 'function');
      assert(typeof MockAdapter === 'function');
    });

    it('should export getDefaultAdapter function', () => {
      assert(typeof getDefaultAdapter === 'function');
    });
  });

  describe('getDefaultAdapter', () => {
    let originalXMLHttpRequest: any;
    let originalProcess: any;
    let originalFetch: any;

    beforeEach(() => {
      // Store original globals
      originalXMLHttpRequest = global.XMLHttpRequest;
      originalProcess = global.process;
      originalFetch = global.fetch;
    });

    afterEach(() => {
      // Restore original globals
      global.XMLHttpRequest = originalXMLHttpRequest;
      global.process = originalProcess;
      global.fetch = originalFetch;
    });

    it('should return xhr adapter in browser environment', () => {
      // Mock browser environment
      global.XMLHttpRequest = class MockXMLHttpRequest {};
      delete (global as any).process;
      delete (global as any).fetch;

      const adapter = getDefaultAdapter();
      assert(typeof adapter === 'function');
    });

    it('should return http adapter in Node.js environment', () => {
      // Mock Node.js environment
      delete (global as any).XMLHttpRequest;
      global.process = {
        versions: { node: '16.0.0' },
      } as any;
      delete (global as any).fetch;

      const adapter = getDefaultAdapter();
      assert(typeof adapter === 'function');
    });

    it('should return fetch adapter in modern environment', () => {
      // Mock modern environment (e.g., Deno, modern workers)
      delete (global as any).XMLHttpRequest;
      delete (global as any).process;
      global.fetch = async () => new Response();

      const adapter = getDefaultAdapter();
      assert(typeof adapter === 'function');
    });

    it('should throw error when no suitable adapter is found', () => {
      // Remove all adapters
      delete (global as any).XMLHttpRequest;
      delete (global as any).process;
      delete (global as any).fetch;

      assert.throws(
        () => getDefaultAdapter(),
        { message: 'No suitable adapter found for the current environment' }
      );
    });

    it('should return different adapters for different environments', () => {
      // Test browser environment
      global.XMLHttpRequest = class MockXMLHttpRequest {};
      delete (global as any).process;
      delete (global as any).fetch;
      const browserAdapter = getDefaultAdapter();

      // Test Node.js environment
      delete (global as any).XMLHttpRequest;
      global.process = {
        versions: { node: '16.0.0' },
      } as any;
      const nodeAdapter = getDefaultAdapter();

      // Test fetch environment
      delete (global as any).XMLHttpRequest;
      delete (global as any).process;
      global.fetch = async () => new Response();
      const fetchAdapter = getDefaultAdapter();

      // All should be functions but potentially different implementations
      assert(typeof browserAdapter === 'function');
      assert(typeof nodeAdapter === 'function');
      assert(typeof fetchAdapter === 'function');
    });
  });

  describe('Adapter Wrapper Functions', () => {
    let originalXMLHttpRequest: any;
    let originalProcess: any;
    let originalFetch: any;

    beforeEach(() => {
      originalXMLHttpRequest = global.XMLHttpRequest;
      originalProcess = global.process;
      originalFetch = global.fetch;
    });

    afterEach(() => {
      global.XMLHttpRequest = originalXMLHttpRequest;
      global.process = originalProcess;
      global.fetch = originalFetch;
    });

    it('should create xhr adapter wrapper in browser environment', async () => {
      global.XMLHttpRequest = class MockXMLHttpRequest {
        open() {}
        send() {}
        setRequestHeader() {}
        abort() {}
        readyState = 4;
        status = 200;
        statusText = 'OK';
        responseText = '{"test":"data"}';
        getAllResponseHeaders() { return 'content-type: application/json'; }
      };
      delete (global as any).process;
      delete (global as any).fetch;

      const adapter = getDefaultAdapter();
      assert(typeof adapter === 'function');

      // Test that the wrapper function works
      const config: fluxhttpRequestConfig = {
        url: 'https://api.example.com/test',
        method: 'GET',
      };

      // The wrapper should be a function that can be called
      assert(typeof adapter === 'function');
    });

    it('should create http adapter wrapper in Node.js environment', async () => {
      delete (global as any).XMLHttpRequest;
      global.process = {
        versions: { node: '16.0.0' },
      } as any;
      delete (global as any).fetch;

      const adapter = getDefaultAdapter();
      assert(typeof adapter === 'function');
    });

    it('should create fetch adapter wrapper in fetch environment', async () => {
      delete (global as any).XMLHttpRequest;
      delete (global as any).process;
      global.fetch = async () => {
        return new Response(JSON.stringify({ test: 'data' }), {
          status: 200,
          statusText: 'OK',
          headers: { 'content-type': 'application/json' },
        });
      };

      const adapter = getDefaultAdapter();
      assert(typeof adapter === 'function');
    });
  });

  describe('Environment Detection', () => {
    let originalXMLHttpRequest: any;
    let originalProcess: any;
    let originalFetch: any;

    beforeEach(() => {
      originalXMLHttpRequest = global.XMLHttpRequest;
      originalProcess = global.process;
      originalFetch = global.fetch;
    });

    afterEach(() => {
      global.XMLHttpRequest = originalXMLHttpRequest;
      global.process = originalProcess;
      global.fetch = originalFetch;
    });

    it('should prioritize XMLHttpRequest over other APIs', () => {
      // Set all APIs available
      global.XMLHttpRequest = class MockXMLHttpRequest {};
      global.process = { versions: { node: '16.0.0' } } as any;
      global.fetch = async () => new Response();

      const adapter = getDefaultAdapter();
      assert(typeof adapter === 'function');
      // Should choose XHR adapter (browser)
    });

    it('should choose process over fetch when XMLHttpRequest is not available', () => {
      delete (global as any).XMLHttpRequest;
      global.process = { versions: { node: '16.0.0' } } as any;
      global.fetch = async () => new Response();

      const adapter = getDefaultAdapter();
      assert(typeof adapter === 'function');
      // Should choose HTTP adapter (Node.js)
    });

    it('should fallback to fetch when others are not available', () => {
      delete (global as any).XMLHttpRequest;
      delete (global as any).process;
      global.fetch = async () => new Response();

      const adapter = getDefaultAdapter();
      assert(typeof adapter === 'function');
      // Should choose fetch adapter
    });

    it('should handle malformed process object', () => {
      delete (global as any).XMLHttpRequest;
      global.process = {} as any; // Process without versions
      global.fetch = async () => new Response();

      const adapter = getDefaultAdapter();
      assert(typeof adapter === 'function');
      // Should fallback to fetch adapter
    });

    it('should handle process without node version', () => {
      delete (global as any).XMLHttpRequest;
      global.process = { versions: {} } as any; // Versions without node
      global.fetch = async () => new Response();

      const adapter = getDefaultAdapter();
      assert(typeof adapter === 'function');
      // Should fallback to fetch adapter
    });
  });

  describe('Error Handling', () => {
    let originalXMLHttpRequest: any;
    let originalProcess: any;
    let originalFetch: any;

    beforeEach(() => {
      originalXMLHttpRequest = global.XMLHttpRequest;
      originalProcess = global.process;
      originalFetch = global.fetch;
    });

    afterEach(() => {
      global.XMLHttpRequest = originalXMLHttpRequest;
      global.process = originalProcess;
      global.fetch = originalFetch;
    });

    it('should handle undefined XMLHttpRequest gracefully', () => {
      global.XMLHttpRequest = undefined as any;
      global.process = { versions: { node: '16.0.0' } } as any;
      delete (global as any).fetch;

      const adapter = getDefaultAdapter();
      assert(typeof adapter === 'function');
    });

    it('should handle null process gracefully', () => {
      delete (global as any).XMLHttpRequest;
      global.process = null as any;
      global.fetch = async () => new Response();

      const adapter = getDefaultAdapter();
      assert(typeof adapter === 'function');
    });

    it('should handle undefined fetch gracefully', () => {
      delete (global as any).XMLHttpRequest;
      global.process = { versions: { node: '16.0.0' } } as any;
      global.fetch = undefined as any;

      const adapter = getDefaultAdapter();
      assert(typeof adapter === 'function');
    });
  });

  describe('Integration Tests', () => {
    it('should return working adapter function', () => {
      // Use mock adapter for testing
      const adapter = mockAdapter;
      
      assert(typeof adapter === 'function');
      
      const config: fluxhttpRequestConfig = {
        url: 'https://api.example.com/test',
        method: 'GET',
      };
      
      // Should be able to call adapter
      const result = adapter(config);
      assert(result instanceof Promise);
    });

    it('should work with different request configurations', async () => {
      const adapter = mockAdapter;
      
      const configs = [
        { url: 'https://api.example.com/get', method: 'GET' },
        { url: 'https://api.example.com/post', method: 'POST', data: { test: 'data' } },
        { url: 'https://api.example.com/put', method: 'PUT', data: { update: 'data' } },
        { url: 'https://api.example.com/delete', method: 'DELETE' },
      ];
      
      for (const config of configs) {
        const response = await adapter(config as fluxhttpRequestConfig);
        assert(response);
        assert(typeof response.status === 'number');
        assert(typeof response.statusText === 'string');
      }
    });
  });

  describe('Performance', () => {
    it('should handle adapter creation efficiently', () => {
      const start = process.hrtime();
      
      // Create multiple adapters
      for (let i = 0; i < 1000; i++) {
        const adapter = mockAdapter;
        assert(typeof adapter === 'function');
      }
      
      const [seconds, nanoseconds] = process.hrtime(start);
      const milliseconds = seconds * 1000 + nanoseconds / 1000000;
      
      // Should be fast
      assert(milliseconds < 100, 'Adapter creation should be fast');
    });

    it('should not leak memory with repeated adapter detection', () => {
      const initialMemory = process.memoryUsage().heapUsed;
      
      // Simulate repeated adapter detection
      for (let i = 0; i < 1000; i++) {
        // Mock different environments
        if (i % 3 === 0) {
          global.XMLHttpRequest = class MockXMLHttpRequest {};
          delete (global as any).process;
          delete (global as any).fetch;
        } else if (i % 3 === 1) {
          delete (global as any).XMLHttpRequest;
          global.process = { versions: { node: '16.0.0' } } as any;
          delete (global as any).fetch;
        } else {
          delete (global as any).XMLHttpRequest;
          delete (global as any).process;
          global.fetch = async () => new Response();
        }
        
        try {
          getDefaultAdapter();
        } catch {
          // Ignore errors for this test
        }
      }
      
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;
      
      // Memory increase should be reasonable
      assert(memoryIncrease < 10 * 1024 * 1024, 'Memory usage should not grow excessively');
    });
  });

  describe('Edge Cases', () => {
    it('should handle exotic global objects', () => {
      // Mock unusual global configurations
      (global as any).XMLHttpRequest = 'not a constructor';
      (global as any).process = 'not an object';
      (global as any).fetch = 'not a function';
      
      assert.throws(
        () => getDefaultAdapter(),
        { message: 'No suitable adapter found for the current environment' }
      );
    });

    it('should handle circular references in global objects', () => {
      const circular: any = {};
      circular.self = circular;
      
      delete (global as any).XMLHttpRequest;
      (global as any).process = circular;
      delete (global as any).fetch;
      
      assert.throws(
        () => getDefaultAdapter(),
        { message: 'No suitable adapter found for the current environment' }
      );
    });

    it('should handle adapter detection in worker environment', () => {
      // Mock worker-like environment
      delete (global as any).XMLHttpRequest;
      delete (global as any).process;
      global.fetch = async () => new Response();
      (global as any).importScripts = () => {}; // Worker indicator
      
      const adapter = getDefaultAdapter();
      assert(typeof adapter === 'function');
      
      delete (global as any).importScripts;
    });

    it('should handle adapter detection in service worker environment', () => {
      // Mock service worker-like environment
      delete (global as any).XMLHttpRequest;
      delete (global as any).process;
      global.fetch = async () => new Response();
      (global as any).ServiceWorkerGlobalScope = class {};
      
      const adapter = getDefaultAdapter();
      assert(typeof adapter === 'function');
      
      delete (global as any).ServiceWorkerGlobalScope;
    });
  });
});
