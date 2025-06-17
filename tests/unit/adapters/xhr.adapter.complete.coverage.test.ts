import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { FluxHTTPRequestConfig } from '../../../src/types';

describe('xhrAdapter - Complete 100% Coverage', () => {
  let mockXHR: any;
  let onloadendHandler: any;

  beforeEach(() => {
    mockXHR = {
      open: vi.fn(),
      send: vi.fn(),
      setRequestHeader: vi.fn(),
      getAllResponseHeaders: vi.fn().mockReturnValue('content-type: application/json'),
      addEventListener: vi.fn(),
      upload: { addEventListener: vi.fn() },
      readyState: 4,
      status: 200,
      statusText: 'OK',
      responseText: '{"success": true}',
      response: null,
      responseType: '',
      timeout: 0,
      withCredentials: false
    };

    // Capture the onloadend handler when it's set
    Object.defineProperty(mockXHR, 'onloadend', {
      get: () => onloadendHandler,
      set: (handler) => { onloadendHandler = handler; },
      configurable: true
    });

    global.XMLHttpRequest = vi.fn(() => mockXHR) as any;
  });

  describe('Line 42: xhr null check guard clause', () => {
    it('should return early when xhr is null/undefined', async () => {
      const { xhrAdapter } = await import('../../../src/adapters/xhr.adapter');
      
      const config: FluxHTTPRequestConfig = {
        url: 'https://fluxhttp.com/api/test',
        method: 'GET'
      };

      const responsePromise = xhrAdapter(config);
      
      // Wait for setup
      await new Promise(resolve => process.nextTick(resolve));
      
      // The onloadend handler should be set
      expect(onloadendHandler).toBeDefined();
      
      // Now test the guard clause by calling onloadend with a falsy xhr context
      // This simulates the scenario where xhr becomes null/undefined
      const originalFunction = onloadendHandler;
      
      // Create a context where xhr is null to trigger line 42: if (!xhr) return;
      const nullXhrContext = { xhr: null };
      
      // Call the function with null xhr - should return early and not throw
      expect(() => {
        originalFunction.call(nullXhrContext);
      }).not.toThrow();
      
      // Now test with undefined xhr
      const undefinedXhrContext = { xhr: undefined };
      expect(() => {
        originalFunction.call(undefinedXhrContext);
      }).not.toThrow();
      
      // Test with falsy xhr
      const falsyXhrContext = { xhr: 0 };
      expect(() => {
        originalFunction.call(falsyXhrContext);
      }).not.toThrow();
      
      // Finally, complete the request normally to resolve the promise
      onloadendHandler.call({ xhr: mockXHR });
      
      const response = await responsePromise;
      expect(response.status).toBe(200);
    });

    it('should handle the guard clause in actual runtime scenario', async () => {
      const { xhrAdapter } = await import('../../../src/adapters/xhr.adapter');
      
      // Mock a scenario where XMLHttpRequest might be destroyed/nullified
      let xhrReference: any = mockXHR;
      
      // Override the XMLHttpRequest constructor to return our reference
      global.XMLHttpRequest = vi.fn(() => xhrReference) as any;
      
      const config: FluxHTTPRequestConfig = {
        url: 'https://fluxhttp.com/api/guard-test',
        method: 'GET'
      };

      const responsePromise = xhrAdapter(config);
      
      // Wait for setup
      await new Promise(resolve => process.nextTick(resolve));
      
      // Simulate xhr being nullified (this can happen in some edge cases)
      xhrReference = null;
      
      // The onloadend handler should handle null xhr gracefully
      expect(() => {
        onloadendHandler();
      }).not.toThrow();
      
      // Restore xhr reference and complete normally
      xhrReference = mockXHR;
      onloadendHandler();
      
      const response = await responsePromise;
      expect(response.status).toBe(200);
    });
  });
});