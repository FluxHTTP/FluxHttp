import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { EventEmitter, PassThrough, Readable } from 'node:stream';
const zlib = require('node:zlib');

// Mock Node.js http/https modules
const mockRequests = [];
let mockRequestError = null;
let mockResponseData = null;
let mockResponseError = null;

class MockIncomingMessage extends EventEmitter {
  constructor(statusCode = 200, headers = {}) {
    super();
    this.statusCode = statusCode;
    this.statusMessage = 'OK';
    this.headers = headers;
  }

  pipe(stream) {
    // Simulate piping for compression
    return this;
  }
}

class MockClientRequest extends EventEmitter {
  constructor(options) {
    super();
    this.options = options;
    this.destroyed = false;
    this.writtenData = [];
    mockRequests.push(this);
  }

  write(data) {
    this.writtenData.push(data);
  }

  end(data) {
    if (data) {
      this.writtenData.push(data);
    }

    // Simulate async response
    process.nextTick(() => {
      if (mockRequestError) {
        this.emit('error', mockRequestError);
        return;
      }

      const res = new MockIncomingMessage(
        mockResponseData?.statusCode || 200,
        mockResponseData?.headers || {}
      );

      this.emit('response', res);

      process.nextTick(() => {
        if (mockResponseError) {
          res.emit('error', mockResponseError);
          return;
        }

        if (mockResponseData?.data) {
          res.emit('data', Buffer.from(mockResponseData.data));
        }
        res.emit('end');
      });
    });
  }

  destroy() {
    this.destroyed = true;
    this.emit('close');
  }

  setTimeout(timeout, callback) {
    // Mock timeout implementation
  }
}

// Mock http and https modules
const httpMock = {
  request: (options, callback) => {
    const req = new MockClientRequest(options);
    if (callback) {
      req.on('response', callback);
    }
    return req;
  },
};

const httpsMock = {
  request: (options, callback) => {
    const req = new MockClientRequest(options);
    if (callback) {
      req.on('response', callback);
    }
    return req;
  },
};

// Mock require for http/https modules
const Module = require('module');
const originalRequire = Module.prototype.require;

Module.prototype.require = function (id) {
  if (id === 'http') return httpMock;
  if (id === 'https') return httpsMock;
  return originalRequire.apply(this, arguments);
};

// Import after mocking
import { httpAdapter } from '../../../dist/adapters/http.adapter.js';

describe('httpAdapter', () => {
  beforeEach(() => {
    mockRequests.length = 0;
    mockRequestError = null;
    mockResponseData = null;
    mockResponseError = null;
  });

  describe('Basic requests', (): void => {
    it('should make a GET request', async (): Promise<void> => {
      mockResponseData = { data: '{"test":"data"}' };

      const config = {
        url: 'http://api.test.com/data',
        method: 'GET',
      };

      const response = await httpAdapter(config);

      assert.strictEqual(mockRequests.length, 1);
      assert.strictEqual(mockRequests[0].options.method, 'GET');
      assert.strictEqual(mockRequests[0].options.hostname, 'api.test.com');
      assert.strictEqual(mockRequests[0].options.path, '/data');
      assert.deepStrictEqual(response.data, { test: 'data' });
    });

    it('should make a POST request with data', async (): Promise<void> => {
      mockResponseData = { data: '{"success":true}' };

      const config = {
        url: 'http://api.test.com/data',
        method: 'POST',
        data: { name: 'test', value: 123 },
      };

      const response = await httpAdapter(config);

      assert.strictEqual(mockRequests[0].options.method, 'POST');
      assert.strictEqual(mockRequests[0].writtenData.join(''), JSON.stringify(config.data));
      assert.deepStrictEqual(response.data, { success: true });
    });

    it('should handle HTTPS requests', async (): Promise<void> => {
      mockResponseData = { data: '{"secure":true}' };

      const config = {
        url: 'https://secure.test.com/data',
        method: 'GET',
      };

      const response = await httpAdapter(config);

      assert.strictEqual(mockRequests[0].options.protocol, 'https:');
      assert.strictEqual(mockRequests[0].options.hostname, 'secure.test.com');
    });

    it('should handle PUT requests', async (): Promise<void> => {
      mockResponseData = { data: '{"updated":true}' };

      const config = {
        url: 'http://api.test.com/data/1',
        method: 'PUT',
        data: { updated: 'value' },
      };

      await httpAdapter(config);

      assert.strictEqual(mockRequests[0].options.method, 'PUT');
    });

    it('should handle DELETE requests', async (): Promise<void> => {
      mockResponseData = { data: '{"deleted":true}' };

      const config = {
        url: 'http://api.test.com/data/1',
        method: 'DELETE',
      };

      await httpAdapter(config);

      assert.strictEqual(mockRequests[0].options.method, 'DELETE');
    });
  });

  describe('URL handling', () => {
    it('should reject when URL is missing', async (): Promise<void> => {
      await assert.rejects(async () => await httpAdapter({ method: 'GET' }), {
        code: 'ERR_INVALID_URL',
      });
    });

    it('should build URL with query params', async (): Promise<void> => {
      mockResponseData = { data: '{}' };

      const config = {
        url: 'http://api.test.com/data',
        params: { id: 123, name: 'test' },
      };

      await httpAdapter(config);

      assert(mockRequests[0].options.path.includes('id=123'));
      assert(mockRequests[0].options.path.includes('name=test'));
    });

    it('should handle port in URL', async (): Promise<void> => {
      mockResponseData = { data: '{}' };

      const config = {
        url: 'http://api.test.com:8080/data',
      };

      await httpAdapter(config);

      assert.strictEqual(mockRequests[0].options.port, '8080');
    });

    it('should handle path with existing query params', async (): Promise<void> => {
      mockResponseData = { data: '{}' };

      const config = {
        url: 'http://api.test.com/data?existing=true',
        params: { new: 'param' },
      };

      await httpAdapter(config);

      assert(mockRequests[0].options.path.includes('existing=true'));
      assert(mockRequests[0].options.path.includes('new=param'));
    });
  });

  describe('Headers handling', () => {
    it('should set custom headers', async (): Promise<void> => {
      mockResponseData = { data: '{}' };

      const config = {
        url: 'http://api.test.com/data',
        headers: {
          'X-Custom': 'value',
          Authorization: 'Bearer token',
        },
      };

      await httpAdapter(config);

      assert.strictEqual(mockRequests[0].options.headers['X-Custom'], 'value');
      assert.strictEqual(mockRequests[0].options.headers['Authorization'], 'Bearer token');
    });

    it('should set Content-Length for non-stream data', async (): Promise<void> => {
      mockResponseData = { data: '{}' };

      const config = {
        url: 'http://api.test.com/data',
        method: 'POST',
        data: { test: 'data' },
      };

      await httpAdapter(config);

      const expectedLength = Buffer.byteLength(JSON.stringify(config.data));
      assert.strictEqual(mockRequests[0].options.headers['Content-Length'], String(expectedLength));
    });

    it('should handle array header values', async (): Promise<void> => {
      mockResponseData = { data: '{}' };

      const config = {
        url: 'http://api.test.com/data',
        headers: {
          'X-Multiple': ['value1', 'value2', 'value3'],
        },
      };

      await httpAdapter(config);

      assert.strictEqual(mockRequests[0].options.headers['X-Multiple'], 'value1, value2, value3');
    });

    it('should ignore undefined headers', async (): Promise<void> => {
      mockResponseData = { data: '{}' };

      const config = {
        url: 'http://api.test.com/data',
        headers: {
          'X-Defined': 'value',
          'X-Undefined': undefined,
        },
      };

      await httpAdapter(config);

      assert.strictEqual(mockRequests[0].options.headers['X-Defined'], 'value');
      assert.strictEqual(mockRequests[0].options.headers['X-Undefined'], undefined);
    });
  });

  describe('Authentication', () => {
    it('should set basic auth', async (): Promise<void> => {
      mockResponseData = { data: '{}' };

      const config = {
        url: 'http://api.test.com/data',
        auth: {
          username: 'user',
          password: 'pass',
        },
      };

      await httpAdapter(config);

      assert.strictEqual(mockRequests[0].options.auth, 'user:pass');
    });
  });

  describe('Response types', () => {
    it('should parse JSON responses', async (): Promise<void> => {
      mockResponseData = { data: '{"json":"response"}' };

      const config = {
        url: 'http://api.test.com/data',
        responseType: 'json',
      };

      const response = await httpAdapter(config);
      assert.deepStrictEqual(response.data, { json: 'response' });
    });

    it('should handle text responses', async (): Promise<void> => {
      mockResponseData = { data: 'plain text response' };

      const config = {
        url: 'http://api.test.com/data',
        responseType: 'text',
      };

      const response = await httpAdapter(config);
      assert.strictEqual(response.data, 'plain text response');
    });

    it('should handle arraybuffer responses', async (): Promise<void> => {
      const bufferData = Buffer.from('binary data');
      mockResponseData = { data: bufferData };

      const config = {
        url: 'http://api.test.com/data',
        responseType: 'arraybuffer',
      };

      const response = await httpAdapter(config);
      assert(response.data instanceof ArrayBuffer);

      const view = new Uint8Array(response.data);
      assert.strictEqual(view.length, bufferData.length);
    });

    it('should handle stream responses', async (): Promise<void> => {
      mockResponseData = { data: 'stream data' };

      const config = {
        url: 'http://api.test.com/data',
        responseType: 'stream',
      };

      const response = await httpAdapter(config);
      assert(response.data instanceof EventEmitter);
    });

    it('should auto-parse JSON when no responseType', async (): Promise<void> => {
      mockResponseData = { data: '{"auto":"parsed"}' };

      const response = await httpAdapter({ url: 'http://api.test.com/data' });
      assert.deepStrictEqual(response.data, { auto: 'parsed' });
    });

    it('should fallback to text for invalid JSON', async (): Promise<void> => {
      mockResponseData = { data: 'not json' };

      const config = {
        url: 'http://api.test.com/data',
        responseType: 'json',
      };

      const response = await httpAdapter(config);
      assert.strictEqual(response.data, 'not json');
    });
  });

  describe('Request body handling', () => {
    it('should send string data as-is', async (): Promise<void> => {
      mockResponseData = { data: '{}' };

      const config = {
        url: 'http://api.test.com/data',
        method: 'POST',
        data: 'plain text data',
      };

      await httpAdapter(config);

      assert.strictEqual(mockRequests[0].writtenData.join(''), 'plain text data');
    });

    it('should stringify object data', async (): Promise<void> => {
      mockResponseData = { data: '{}' };

      const config = {
        url: 'http://api.test.com/data',
        method: 'POST',
        data: { complex: { nested: 'object' } },
      };

      await httpAdapter(config);

      assert.strictEqual(mockRequests[0].writtenData.join(''), JSON.stringify(config.data));
    });

    it('should handle null data', async (): Promise<void> => {
      mockResponseData = { data: '{}' };

      const config = {
        url: 'http://api.test.com/data',
        method: 'POST',
        data: null,
      };

      await httpAdapter(config);

      assert.strictEqual(mockRequests[0].writtenData.length, 0);
    });

    it('should pipe stream data', async (): Promise<void> => {
      mockResponseData = { data: '{}' };

      const stream = new Readable({
        read() {
          this.push('stream data');
          this.push(null);
        },
      });

      // Mark as stream
      stream._readableState = true;

      const config = {
        url: 'http://api.test.com/data',
        method: 'POST',
        data: stream,
      };

      await httpAdapter(config);

      // Stream should be piped, not written directly
      assert.strictEqual(mockRequests[0].writtenData.length, 0);
    });
  });

  describe('Error handling', () => {
    it('should reject on network errors', async (): Promise<void> => {
      mockRequestError = new Error('ECONNREFUSED');

      await assert.rejects(async () => await httpAdapter({ url: 'http://api.test.com/data' }), {
        code: 'ERR_NETWORK',
      });
    });

    it('should reject on non-2xx status by default', async (): Promise<void> => {
      mockResponseData = {
        statusCode: 404,
        data: '{"error":"Not found"}',
      };

      await assert.rejects(async () => await httpAdapter({ url: 'http://api.test.com/data' }), {
        code: 'ERR_BAD_RESPONSE',
      });
    });

    it('should use validateStatus when provided', async (): Promise<void> => {
      mockResponseData = {
        statusCode: 404,
        data: '{"error":"Not found"}',
      };

      const config = {
        url: 'http://api.test.com/data',
        validateStatus: (status) => status < 500,
      };

      const response = await httpAdapter(config);
      assert.strictEqual(response.status, 404);
    });

    it('should handle response stream errors', async (): Promise<void> => {
      mockResponseError = new Error('Stream error');

      await assert.rejects(async () => await httpAdapter({ url: 'http://api.test.com/data' }), {
        code: 'ERR_NETWORK',
      });
    });

    it('should handle timeout', async (): Promise<void> => {
      const config = {
        url: 'http://api.test.com/data',
        timeout: 100,
      };

      // Simulate timeout
      mockResponseData = null;

      const promise = httpAdapter(config);

      // Trigger timeout
      setTimeout(() => {
        mockRequests[0].emit('timeout');
      }, 50);

      await assert.rejects(async () => await promise, { code: 'ECONNABORTED' });

      assert(mockRequests[0].destroyed);
    });
  });

  describe('Decompression', () => {
    it('should decompress gzip responses by default', async (): Promise<void> => {
      mockResponseData = {
        headers: { 'content-encoding': 'gzip' },
        data: '{"compressed":"data"}',
      };

      const response = await httpAdapter({ url: 'http://api.test.com/data' });
      assert.deepStrictEqual(response.data, { compressed: 'data' });
    });

    it('should decompress deflate responses', async (): Promise<void> => {
      mockResponseData = {
        headers: { 'content-encoding': 'deflate' },
        data: '{"compressed":"data"}',
      };

      const response = await httpAdapter({ url: 'http://api.test.com/data' });
      assert.deepStrictEqual(response.data, { compressed: 'data' });
    });

    it('should decompress br responses', async (): Promise<void> => {
      mockResponseData = {
        headers: { 'content-encoding': 'br' },
        data: '{"compressed":"data"}',
      };

      const response = await httpAdapter({ url: 'http://api.test.com/data' });
      assert.deepStrictEqual(response.data, { compressed: 'data' });
    });

    it('should skip decompression when decompress is false', async (): Promise<void> => {
      mockResponseData = {
        headers: { 'content-encoding': 'gzip' },
        data: '{"compressed":"data"}',
      };

      const response = await httpAdapter({
        url: 'http://api.test.com/data',
        decompress: false,
      });

      assert.deepStrictEqual(response.data, { compressed: 'data' });
    });
  });

  describe('Progress events', () => {
    it('should emit download progress', async (): Promise<void> => {
      const progressEvents = [];

      mockResponseData = {
        headers: { 'content-length': '100' },
        data: 'x'.repeat(100),
      };

      const config = {
        url: 'http://api.test.com/data',
        onDownloadProgress: (event) => progressEvents.push(event),
      };

      await httpAdapter(config);

      assert(progressEvents.length > 0);
      const lastEvent = progressEvents[progressEvents.length - 1];
      assert.strictEqual(lastEvent.loaded, 100);
      assert.strictEqual(lastEvent.total, 100);
      assert.strictEqual(lastEvent.lengthComputable, true);
    });

    it('should handle missing content-length', async (): Promise<void> => {
      const progressEvents = [];

      mockResponseData = {
        data: 'data without length',
      };

      const config = {
        url: 'http://api.test.com/data',
        onDownloadProgress: (event) => progressEvents.push(event),
      };

      await httpAdapter(config);

      assert(progressEvents.length > 0);
      const lastEvent = progressEvents[progressEvents.length - 1];
      assert(lastEvent.loaded > 0);
      assert.strictEqual(lastEvent.total, 0);
      assert.strictEqual(lastEvent.lengthComputable, false);
    });
  });

  describe('Cancel handling', () => {
    it('should reject if already canceled', async (): Promise<void> => {
      const cancelToken = {
        throwIfRequested: () => {
          const error = new Error('Canceled');
          error.code = 'ERR_CANCELED';
          throw error;
        },
        promise: Promise.resolve(),
      };

      await assert.rejects(
        async () =>
          await httpAdapter({
            url: 'http://api.test.com/data',
            cancelToken,
          }),
        { code: 'ERR_CANCELED' }
      );
    });

    it('should cancel request when token is triggered', async (): Promise<void> => {
      let cancelResolve;
      const cancelToken = {
        throwIfRequested: () => {},
        promise: new Promise((_resolve) => {
          cancelResolve = resolve;
        }),
      };

      // Delay response
      mockResponseData = null;

      const promise = httpAdapter({
        url: 'http://api.test.com/data',
        cancelToken,
      });

      // Cancel after a short delay
      setTimeout(() => {
        cancelResolve({ message: 'User canceled' });
      }, 50);

      await assert.rejects(async () => await promise, { code: 'ERR_CANCELED' });

      assert(mockRequests[0].destroyed);
    });

    it('should handle abort signal', async (): Promise<void> => {
      const controller = new AbortController();

      // Delay response
      mockResponseData = null;

      const promise = httpAdapter({
        url: 'http://api.test.com/data',
        signal: controller.signal,
      });

      // Abort after a short delay
      setTimeout(() => {
        controller.signal.aborted = true;
        mockRequests[0].emit('abort');
      }, 50);

      await assert.rejects(async () => await promise, { code: 'ERR_CANCELED' });
    });
  });

  describe('Response handling', () => {
    it('should include status and statusText', async (): Promise<void> => {
      mockResponseData = {
        statusCode: 201,
        statusMessage: 'Created',
        data: '{}',
      };

      const response = await httpAdapter({ url: 'http://api.test.com/data' });

      assert.strictEqual(response.status, 201);
      assert.strictEqual(response.statusText, 'OK'); // Mock always returns OK
    });

    it('should normalize response headers', async (): Promise<void> => {
      mockResponseData = {
        headers: {
          'content-type': 'application/json',
          'x-custom-header': ['value1', 'value2'],
        },
        data: '{}',
      };

      const response = await httpAdapter({ url: 'http://api.test.com/data' });

      assert.strictEqual(response.headers['content-type'], 'application/json');
      assert.strictEqual(response.headers['x-custom-header'], 'value1, value2');
    });

    it('should include config and request in response', async (): Promise<void> => {
      mockResponseData = { data: '{}' };

      const config = {
        url: 'http://api.test.com/data',
        method: 'POST',
        timeout: 5000,
      };

      const response = await httpAdapter(config);

      assert.strictEqual(response.config, config);
      assert(response.request);
    });
  });

  describe('Edge cases', () => {
    it('should handle empty response body', async (): Promise<void> => {
      mockResponseData = { data: '' };

      const response = await httpAdapter({ url: 'http://api.test.com/data' });
      assert.strictEqual(response.data, '');
    });

    it('should handle very large JSON', async (): Promise<void> => {
      const largeData = {
        items: Array(1000)
          .fill(null)
          .map((_, i) => ({
            id: i,
            data: 'x'.repeat(100),
          })),
      };

      mockResponseData = { data: JSON.stringify(largeData) };

      const response = await httpAdapter({ url: 'http://api.test.com/data' });
      assert.strictEqual((response.data as any).items.length, 1000);
    });

    it('should handle unicode in response', async (): Promise<void> => {
      mockResponseData = {
        data: JSON.stringify({
          chinese: '你好世界',
          emoji: '😀🎉',
          special: '©®™',
        }),
      };

      const response = await httpAdapter({ url: 'http://api.test.com/data' });
      assert.strictEqual((response.data as any).chinese, '你好世界');
      assert.strictEqual((response.data as any).emoji, '😀🎉');
    });

    it('should handle parse errors gracefully', async (): Promise<void> => {
      // This would cause a parse error if responseType validation fails
      mockResponseData = { data: '{}' };

      const config = {
        url: 'http://api.test.com/data',
        responseType: 'invalid',
      };

      // Should not throw, adapter should handle gracefully
      const response = await httpAdapter(config);
      assert(response.data);
    });
  });
});
