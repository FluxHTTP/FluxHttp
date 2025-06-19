import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';

// Note: The adapter selection logic is bundled and not directly testable
// This test verifies the behavior through the main fluxhttp instance

describe('Adapter Selection', () => {
  let originalXMLHttpRequest: any;
  let originalProcess: any;
  let originalFetch: any;

  beforeEach((): void => {
    // Save original globals
    originalXMLHttpRequest = (global as any).XMLHttpRequest;
    originalProcess = (global as any).process;
    originalFetch = (global as any).fetch;
  });

  afterEach((): void => {
    // Restore original globals
    (global as any).XMLHttpRequest = originalXMLHttpRequest;
    (global as any).process = originalProcess;
    (global as any).fetch = originalFetch;
  });

  describe('Environment-based adapter selection', () => {
    it('should work with XMLHttpRequest available', async (): Promise<void> => {
      // Mock browser environment
      (global as any).XMLHttpRequest = class XMLHttpRequest {
        open(): void {}
        send(): void {}
        setRequestHeader(): void {}
      };

      const fluxhttp = await import('../../../dist/index.js');
      const instance = fluxhttp.create();

      // Should create instance successfully
      assert(instance);
      assert(typeof instance.get === 'function');
    });

    it('should work with Node.js http module', async (): Promise<void> => {
      // Ensure we're in Node environment
      assert(global.process);
      assert((global.process as any).versions);
      assert((global.process as any).versions.node);

      const fluxhttp = await import('../../../dist/index.js');
      const instance = fluxhttp.create();

      // Should create instance successfully
      assert(instance);
      assert(typeof instance.get === 'function');
    });

    it('should work with fetch API', async (): Promise<void> => {
      // Mock modern environment
      delete (global as any).XMLHttpRequest;
      (global as any).fetch = async (): Promise<any> => ({});

      const fluxhttp = await import('../../../dist/index.js');
      const instance = fluxhttp.create();

      // Should create instance successfully
      assert(instance);
      assert(typeof instance.get === 'function');
    });
  });

  describe('Adapter functionality', () => {
    it('should make requests with appropriate adapter', async (): Promise<void> => {
      const fluxhttp = await import('../../../dist/index.js');

      // Create instance with mock adapter
      const mockAdapter = async (config: any): Promise<any> => ({
        data: { adapter: 'mock', url: config.url },
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
        request: {},
      });

      const instance = fluxhttp.create({ adapter: mockAdapter });

      const response = await instance.get('/test');
      assert.strictEqual((response.data as any).adapter, 'mock');
      assert.strictEqual((response.data as any).url, '/test');
    });

    it('should handle errors from adapter', async (): Promise<void> => {
      const fluxhttp = await import('../../../dist/index.js');

      const errorAdapter = async (): Promise<never> => {
        throw new Error('Adapter error');
      };

      const instance = fluxhttp.create({ adapter: errorAdapter });

      await assert.rejects(async (): Promise<any> => await instance.get('/test'), { message: 'Adapter error' });
    });
  });

  describe('Custom adapter', () => {
    it('should allow custom adapter', async (): Promise<void> => {
      const fluxhttp = await import('../../../dist/index.js');

      let adapterCalled = false;
      const customAdapter = async (config: any): Promise<any> => {
        adapterCalled = true;
        return {
          data: { custom: true },
          status: 200,
          statusText: 'OK',
          headers: {},
          config,
          request: {},
        };
      };

      const instance = fluxhttp.create({ adapter: customAdapter });
      const response = await instance.get('/test');

      assert(adapterCalled);
      assert((response.data as any).custom);
    });

    it('should pass config to adapter', async (): Promise<void> => {
      const fluxhttp = await import('../../../dist/index.js');

      let capturedConfig: any;
      const captureAdapter = async (config: any): Promise<any> => {
        capturedConfig = config;
        return {
          data: {},
          status: 200,
          statusText: 'OK',
          headers: {},
          config,
          request: {},
        };
      };

      const instance = fluxhttp.create({
        adapter: captureAdapter,
        baseURL: 'https://api.test.com',
        timeout: 5000,
      });

      await instance.post(
        '/users',
        { name: 'test' },
        {
          headers: { 'X-Custom': 'header' },
        }
      );

      assert.strictEqual(capturedConfig.method, 'POST');
      assert.strictEqual(capturedConfig.url, 'https://api.test.com/users');
      assert.deepStrictEqual(capturedConfig.data, { name: 'test' });
      // Headers may be normalized to lowercase
      assert(
        capturedConfig.headers['X-Custom'] === 'header' ||
          capturedConfig.headers['x-custom'] === 'header'
      );
      assert.strictEqual(capturedConfig.timeout, 5000);
    });
  });
});
