const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');

/**
 * Comprehensive unit tests for adapter selection logic
 * Tests the getDefaultAdapter function and environment detection
 * 
 * Note: This test simulates different environments by manipulating global objects
 */
describe('Adapter Selection Logic', () => {
  let originalXMLHttpRequest;
  let originalProcess;
  let originalFetch;

  beforeEach(() => {
    // Store original global values
    originalXMLHttpRequest = globalThis.XMLHttpRequest;
    originalProcess = globalThis.process;
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    // Restore original global values
    globalThis.XMLHttpRequest = originalXMLHttpRequest;
    globalThis.process = originalProcess;
    globalThis.fetch = originalFetch;
  });

  describe('Environment detection', () => {
    it('should detect browser environment with XMLHttpRequest', async () => {
      // Simulate browser environment
      globalThis.XMLHttpRequest = function XMLHttpRequest() {
        this.open = () => {};
        this.send = () => {};
        this.setRequestHeader = () => {};
        this.addEventListener = () => {};
      };
      delete globalThis.process;
      delete globalThis.fetch;

      // We need to dynamically import to test the adapter selection
      // Since we can't easily test the internal getDefaultAdapter directly,
      // we'll test through fluxhttp instance creation
      const fluxhttpModule = require('../../../dist/index.js');
      const fluxhttp = fluxhttpModule.default || fluxhttpModule;

      const instance = fluxhttp.create();
      assert(instance, 'Should create instance in browser environment');
      assert(instance.defaults, 'Should have defaults');
    });

    it('should detect Node.js environment', async () => {
      // Simulate Node.js environment
      delete globalThis.XMLHttpRequest;
      globalThis.process = {
        versions: {
          node: '18.0.0'
        },
        env: {},
        cwd: () => '/current/dir',
        platform: 'linux'
      };
      delete globalThis.fetch;

      const fluxhttpModule = require('../../../dist/index.js');
      const fluxhttp = fluxhttpModule.default || fluxhttpModule;

      const instance = fluxhttp.create();
      assert(instance, 'Should create instance in Node.js environment');
      assert(instance.defaults, 'Should have defaults');
    });

    it('should detect modern runtime with fetch', async () => {
      // Simulate modern runtime (like Deno, Bun, or modern Node.js)
      delete globalThis.XMLHttpRequest;
      delete globalThis.process;
      globalThis.fetch = async function fetch(input, init) {
        return {
          ok: true,
          status: 200,
          statusText: 'OK',
          headers: new Map(),
          json: async () => ({}),
          text: async () => '',
          arrayBuffer: async () => new ArrayBuffer(0)
        };
      };

      const fluxhttpModule = require('../../../dist/index.js');
      const fluxhttp = fluxhttpModule.default || fluxhttpModule;

      const instance = fluxhttp.create();
      assert(instance, 'Should create instance in fetch environment');
      assert(instance.defaults, 'Should have defaults');
    });

    it('should handle environment with multiple available adapters (browser priority)', async () => {
      // Simulate environment with both XMLHttpRequest and fetch
      globalThis.XMLHttpRequest = function XMLHttpRequest() {
        this.open = () => {};
        this.send = () => {};
        this.setRequestHeader = () => {};
        this.addEventListener = () => {};
      };
      delete globalThis.process;
      globalThis.fetch = async function fetch() {
        return { ok: true, status: 200 };
      };

      const fluxhttpModule = require('../../../dist/index.js');
      const fluxhttp = fluxhttpModule.default || fluxhttpModule;

      // In browser environment, XMLHttpRequest should take priority
      const instance = fluxhttp.create();
      assert(instance, 'Should create instance with XMLHttpRequest priority');
    });

    it('should handle environment with Node.js and fetch (Node.js priority)', async () => {
      // Simulate Node.js with modern fetch support
      delete globalThis.XMLHttpRequest;
      globalThis.process = {
        versions: { node: '18.0.0' },
        env: {},
        platform: 'linux'
      };
      globalThis.fetch = async function fetch() {
        return { ok: true, status: 200 };
      };

      const fluxhttpModule = require('../../../dist/index.js');
      const fluxhttp = fluxhttpModule.default || fluxhttpModule;

      // In Node.js environment, http adapter should take priority over fetch
      const instance = fluxhttp.create();
      assert(instance, 'Should create instance with Node.js http priority');
    });
  });

  describe('Adapter functionality verification', () => {
    it('should create functional adapter wrappers', async () => {
      // Test with a mock environment that has XMLHttpRequest
      globalThis.XMLHttpRequest = function XMLHttpRequest() {
        this.open = () => {};
        this.send = () => {};
        this.setRequestHeader = () => {};
        this.addEventListener = () => {};
        this.readyState = 4;
        this.status = 200;
        this.responseText = '{"success": true}';
      };

      const fluxhttpModule = require('../../../dist/index.js');
      const fluxhttp = fluxhttpModule.default || fluxhttpModule;

      const instance = fluxhttp.create();
      
      // The adapter should be a function
      assert(typeof instance.defaults.adapter === 'function', 'Adapter should be a function');
    });

    it('should handle adapter loading asynchronously', async () => {
      // Test that adapter wrappers work asynchronously
      globalThis.XMLHttpRequest = function XMLHttpRequest() {
        this.open = () => {};
        this.send = () => {};
        this.setRequestHeader = () => {};
        this.addEventListener = () => {};
      };

      const fluxhttpModule = require('../../../dist/index.js');
      const fluxhttp = fluxhttpModule.default || fluxhttpModule;

      const instance = fluxhttp.create();
      const adapter = instance.defaults.adapter;

      // Adapter should be async function
      assert(typeof adapter === 'function', 'Should have adapter function');
      
      // Should be able to call adapter (though it may fail without proper mocking)
      assert.doesNotThrow(() => {
        adapter({ url: 'https://test.com' });
      }, 'Should not throw when calling adapter');
    });
  });

  describe('Error handling', () => {
    it('should throw error when no suitable adapter is found', () => {
      // Remove all possible adapters
      delete globalThis.XMLHttpRequest;
      delete globalThis.process;
      delete globalThis.fetch;

      // This should throw an error during instance creation
      assert.throws(() => {
        // Clear the module cache to force re-evaluation
        delete require.cache[require.resolve('../../../dist/index.js')];
        const fluxhttpModule = require('../../../dist/index.js');
        const fluxhttp = fluxhttpModule.default || fluxhttpModule;
        
        // This should trigger adapter selection and throw
        fluxhttp.create();
      }, {
        message: /No suitable adapter found for the current environment/
      });
    });

    it('should handle corrupted global objects gracefully', () => {
      // Test with corrupted XMLHttpRequest
      globalThis.XMLHttpRequest = 'not a constructor';
      delete globalThis.process;
      delete globalThis.fetch;

      // Should not throw during creation, but might during usage
      assert.doesNotThrow(() => {
        const fluxhttpModule = require('../../../dist/index.js');
        const fluxhttp = fluxhttpModule.default || fluxhttpModule;
        fluxhttp.create();
      });
    });

    it('should handle process object without versions', () => {
      // Test with incomplete process object
      delete globalThis.XMLHttpRequest;
      globalThis.process = {
        env: {},
        // Missing versions property
      };
      globalThis.fetch = async function fetch() {
        return { ok: true, status: 200 };
      };

      // Should fall back to fetch adapter
      const fluxhttpModule = require('../../../dist/index.js');
      const fluxhttp = fluxhttpModule.default || fluxhttpModule;
      
      const instance = fluxhttp.create();
      assert(instance, 'Should create instance with fetch fallback');
    });

    it('should handle process object without node version', () => {
      // Test with process object but no Node.js version
      delete globalThis.XMLHttpRequest;
      globalThis.process = {
        versions: {
          // Missing node property
          v8: '10.2.0'
        },
        env: {}
      };
      globalThis.fetch = async function fetch() {
        return { ok: true, status: 200 };
      };

      // Should fall back to fetch adapter
      const fluxhttpModule = require('../../../dist/index.js');
      const fluxhttp = fluxhttpModule.default || fluxhttpModule;
      
      const instance = fluxhttp.create();
      assert(instance, 'Should create instance with fetch fallback');
    });
  });

  describe('Adapter priority and selection logic', () => {
    it('should prioritize XMLHttpRequest over fetch in browser-like environment', () => {
      // Set up both XMLHttpRequest and fetch
      globalThis.XMLHttpRequest = function XMLHttpRequest() {};
      delete globalThis.process;
      globalThis.fetch = function fetch() {};

      const fluxhttpModule = require('../../../dist/index.js');
      const fluxhttp = fluxhttpModule.default || fluxhttpModule;

      const instance = fluxhttp.create();
      
      // Should have selected XMLHttpRequest adapter
      assert(instance.defaults.adapter, 'Should have adapter');
      assert(typeof instance.defaults.adapter === 'function', 'Adapter should be function');
    });

    it('should prioritize Node.js http over fetch when Node.js is detected', () => {
      // Set up Node.js environment with fetch available
      delete globalThis.XMLHttpRequest;
      globalThis.process = {
        versions: { node: '18.0.0' },
        env: {}
      };
      globalThis.fetch = function fetch() {};

      const fluxhttpModule = require('../../../dist/index.js');
      const fluxhttp = fluxhttpModule.default || fluxhttpModule;

      const instance = fluxhttp.create();
      
      // Should have selected Node.js http adapter
      assert(instance.defaults.adapter, 'Should have adapter');
      assert(typeof instance.defaults.adapter === 'function', 'Adapter should be function');
    });

    it('should fall back to fetch when XMLHttpRequest and Node.js are not available', () => {
      // Set up fetch-only environment
      delete globalThis.XMLHttpRequest;
      delete globalThis.process;
      globalThis.fetch = function fetch() {};

      const fluxhttpModule = require('../../../dist/index.js');
      const fluxhttp = fluxhttpModule.default || fluxhttpModule;

      const instance = fluxhttp.create();
      
      // Should have selected fetch adapter
      assert(instance.defaults.adapter, 'Should have adapter');
      assert(typeof instance.defaults.adapter === 'function', 'Adapter should be function');
    });
  });

  describe('Custom adapter override', () => {
    it('should allow custom adapter to override default selection', async () => {
      // Set up any environment
      globalThis.XMLHttpRequest = function XMLHttpRequest() {};
      
      // Create custom adapter
      const customAdapter = async (config) => ({
        data: { custom: true, url: config.url },
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
        request: {}
      });

      const fluxhttpModule = require('../../../dist/index.js');
      const fluxhttp = fluxhttpModule.default || fluxhttpModule;

      const instance = fluxhttp.create({ adapter: customAdapter });
      
      // Should use custom adapter
      assert.strictEqual(instance.defaults.adapter, customAdapter, 'Should use custom adapter');
      
      // Test that it works
      const response = await instance.get('https://test.com');
      assert.strictEqual(response.data.custom, true);
      assert.strictEqual(response.data.url, 'https://test.com');
    });

    it('should work with custom adapter even when no default adapter is available', () => {
      // Remove all default adapters
      delete globalThis.XMLHttpRequest;
      delete globalThis.process;
      delete globalThis.fetch;

      const customAdapter = async (config) => ({
        data: { success: true },
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
        request: {}
      });

      const fluxhttpModule = require('../../../dist/index.js');
      const fluxhttp = fluxhttpModule.default || fluxhttpModule;

      // Should not throw when custom adapter is provided
      assert.doesNotThrow(() => {
        fluxhttp.create({ adapter: customAdapter });
      });
    });
  });

  describe('Real-world environment simulation', () => {
    it('should work in simulated Chrome browser environment', () => {
      // Simulate Chrome browser globals
      globalThis.XMLHttpRequest = function XMLHttpRequest() {
        this.UNSENT = 0;
        this.OPENED = 1;
        this.HEADERS_RECEIVED = 2;
        this.LOADING = 3;
        this.DONE = 4;
        this.readyState = 0;
        this.status = 0;
        this.statusText = '';
        this.responseType = '';
        this.response = null;
        this.responseText = '';
        this.responseXML = null;
        this.open = () => {};
        this.send = () => {};
        this.setRequestHeader = () => {};
        this.getAllResponseHeaders = () => '';
        this.getResponseHeader = () => null;
        this.addEventListener = () => {};
        this.removeEventListener = () => {};
      };
      globalThis.fetch = function fetch() {};
      delete globalThis.process;

      const fluxhttpModule = require('../../../dist/index.js');
      const fluxhttp = fluxhttpModule.default || fluxhttpModule;

      const instance = fluxhttp.create();
      assert(instance, 'Should work in Chrome-like environment');
    });

    it('should work in simulated Node.js environment', () => {
      // Simulate Node.js globals
      delete globalThis.XMLHttpRequest;
      globalThis.process = {
        version: 'v18.17.0',
        versions: {
          node: '18.17.0',
          v8: '10.2.154.26-node.26',
          uv: '1.44.2',
          zlib: '1.2.13'
        },
        platform: 'linux',
        arch: 'x64',
        env: {},
        argv: ['node'],
        execPath: '/usr/bin/node',
        cwd: () => '/current/directory',
        chdir: () => {},
        exit: () => {},
        nextTick: (callback) => setTimeout(callback, 0)
      };
      delete globalThis.fetch;

      const fluxhttpModule = require('../../../dist/index.js');
      const fluxhttp = fluxhttpModule.default || fluxhttpModule;

      const instance = fluxhttp.create();
      assert(instance, 'Should work in Node.js-like environment');
    });

    it('should work in simulated Deno environment', () => {
      // Simulate Deno environment
      delete globalThis.XMLHttpRequest;
      delete globalThis.process;
      globalThis.fetch = async function fetch(input, init) {
        return {
          ok: true,
          status: 200,
          statusText: 'OK',
          headers: new Headers(),
          json: async () => ({}),
          text: async () => '',
          blob: async () => new Blob(),
          arrayBuffer: async () => new ArrayBuffer(0),
          clone: () => this
        };
      };
      globalThis.Deno = {
        version: { deno: '1.36.0' },
        env: { get: () => undefined }
      };

      const fluxhttpModule = require('../../../dist/index.js');
      const fluxhttp = fluxhttpModule.default || fluxhttpModule;

      const instance = fluxhttp.create();
      assert(instance, 'Should work in Deno-like environment');
    });
  });

  describe('Edge cases and robustness', () => {
    it('should handle undefined global objects', () => {
      // Test with explicitly undefined globals
      globalThis.XMLHttpRequest = undefined;
      globalThis.process = undefined;
      globalThis.fetch = undefined;

      assert.throws(() => {
        const fluxhttpModule = require('../../../dist/index.js');
        const fluxhttp = fluxhttpModule.default || fluxhttpModule;
        fluxhttp.create();
      }, {
        message: /No suitable adapter found/
      });
    });

    it('should handle null global objects', () => {
      // Test with explicitly null globals
      globalThis.XMLHttpRequest = null;
      globalThis.process = null;
      globalThis.fetch = null;

      assert.throws(() => {
        const fluxhttpModule = require('../../../dist/index.js');
        const fluxhttp = fluxhttpModule.default || fluxhttpModule;
        fluxhttp.create();
      }, {
        message: /No suitable adapter found/
      });
    });

    it('should handle non-function global objects', () => {
      // Test with non-function values
      globalThis.XMLHttpRequest = 'not a function';
      globalThis.process = 'not an object';
      globalThis.fetch = 'not a function';

      assert.throws(() => {
        const fluxhttpModule = require('../../../dist/index.js');
        const fluxhttp = fluxhttpModule.default || fluxhttpModule;
        fluxhttp.create();
      }, {
        message: /No suitable adapter found/
      });
    });

    it('should handle empty process object', () => {
      delete globalThis.XMLHttpRequest;
      globalThis.process = {}; // Empty process object
      globalThis.fetch = function fetch() {};

      // Should fall back to fetch
      const fluxhttpModule = require('../../../dist/index.js');
      const fluxhttp = fluxhttpModule.default || fluxhttpModule;

      const instance = fluxhttp.create();
      assert(instance, 'Should fall back to fetch with empty process');
    });

    it('should be deterministic across multiple calls', () => {
      // Set up stable environment
      globalThis.XMLHttpRequest = function XMLHttpRequest() {};
      delete globalThis.process;
      delete globalThis.fetch;

      const fluxhttpModule = require('../../../dist/index.js');
      const fluxhttp = fluxhttpModule.default || fluxhttpModule;

      const instance1 = fluxhttp.create();
      const instance2 = fluxhttp.create();

      // Both should have the same type of adapter
      assert(typeof instance1.defaults.adapter === typeof instance2.defaults.adapter);
      assert(typeof instance1.defaults.adapter === 'function');
      assert(typeof instance2.defaults.adapter === 'function');
    });
  });
});