import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';

// Mock XMLHttpRequest
let mockXHRInstances = [];
let mockXHRResponse = null;
let mockXHRError = null;
let mockNetworkError = false;
let mockTimeout = false;

class MockXMLHttpRequest {
  constructor() {
    this.readyState = 0;
    this.status = 0;
    this.statusText = '';
    this.responseText = '';
    this.response = null;
    this.responseType = '';
    this.timeout = 0;
    this.withCredentials = false;
    this.upload = {
      onprogress: null,
    };
    this.onloadend = null;
    this.onerror = null;
    this.ontimeout = null;
    this.onprogress = null;
    this.headers = {};
    this.aborted = false;
    this.openCalled = false;
    this.sendCalled = false;
    this.sentData = null;

    mockXHRInstances.push(this);
  }

  open(method, url, async) {
    this.openCalled = true;
    this.method = method;
    this.url = url;
    this.async = async;
  }

  setRequestHeader(key, value) {
    this.headers[key] = value;
  }

  getAllResponseHeaders() {
    if (mockXHRResponse?.headers) {
      return Object.entries(mockXHRResponse.headers)
        .map(([key, value]) => `${key}: ${value}`)
        .join('\r\n');
    }
    return '';
  }

  send(data) {
    this.sendCalled = true;
    this.sentData = data;

    // Simulate async response
    setTimeout(() => {
      if (this.aborted) return;

      if (mockTimeout) {
        this.readyState = 4;
        if (this.ontimeout) this.ontimeout();
        return;
      }

      if (mockNetworkError) {
        this.readyState = 4;
        if (this.onerror) this.onerror();
        return;
      }

      if (mockXHRError) {
        this.readyState = 4;
        this.status = mockXHRError.status || 0;
        this.statusText = mockXHRError.statusText || '';
        if (this.onerror) this.onerror();
        return;
      }

      // Success response
      this.readyState = 4;
      this.status = mockXHRResponse?.status || 200;
      this.statusText = mockXHRResponse?.statusText || 'OK';

      if (this.responseType === 'json') {
        this.responseText = mockXHRResponse?.data || '{}';
        this.response = null;
      } else if (this.responseType === 'arraybuffer') {
        this.response = mockXHRResponse?.data || new ArrayBuffer(0);
      } else if (this.responseType === 'blob') {
        this.response = mockXHRResponse?.data || new Blob(['']);
      } else if (this.responseType === 'document') {
        this.response = mockXHRResponse?.data || null;
      } else {
        this.responseText = mockXHRResponse?.data || '';
        this.response = this.responseText;
      }

      // Trigger progress events
      if (this.onprogress && mockXHRResponse?.progressEvents) {
        mockXHRResponse.progressEvents.forEach((_event) => {
          this.onprogress(event);
        });
      }

      if (this.upload.onprogress && mockXHRResponse?.uploadProgressEvents) {
        mockXHRResponse.uploadProgressEvents.forEach((_event) => {
          this.upload.onprogress(event);
        });
      }

      if (this.onloadend) this.onloadend();
    }, 10);
  }

  abort() {
    this.aborted = true;
  }
}

(global as any).XMLHttpRequest = MockXMLHttpRequest;
(global as any).FormData = class FormData {
  constructor() {
    this._data = new Map();
  }
  append(key, value) {
    this._data.set(key, value);
  }
};
(global as any).URLSearchParams = class URLSearchParams {
  constructor(init) {
    this._params = new Map();
    if (init) {
      Object.entries(init).forEach(([key, value]) => {
        this._params.set(key, value);
      });
    }
  }
  toString() {
    return Array.from(this._params.entries())
      .map(([key, value]) => `${key}=${value}`)
      .join('&');
  }
};
(global as any).Blob = class Blob {
  constructor(parts) {
    this.parts = parts;
    this.size = parts.reduce((sum, part) => sum + part.length, 0);
  }
};
(global as any).Document = class Document {};

// Import after mocking globals
import { xhrAdapter } from '../../../dist/adapters/xhr.adapter.js';

describe('xhrAdapter', () => {
  beforeEach(() => {
    mockXHRInstances = [];
    mockXHRResponse = null;
    mockXHRError = null;
    mockNetworkError = false;
    mockTimeout = false;
  });

  describe('Basic requests', (): void => {
    it('should make a GET request', async (): Promise<void> => {
      mockXHRResponse = { data: '{"test":"data"}' };

      const config = {
        url: 'https://api.test.com/data',
        method: 'GET',
      };

      const response = await xhrAdapter(config);

      assert.strictEqual(mockXHRInstances.length, 1);
      const xhr = mockXHRInstances[0];
      assert(xhr.openCalled);
      assert.strictEqual(xhr.method, 'GET');
      assert.strictEqual(xhr.url, 'https://api.test.com/data');
      assert.strictEqual(xhr.async, true);
      assert.deepStrictEqual(response.data, { test: 'data' });
      assert.strictEqual(response.status, 200);
    });

    it('should make a POST request with data', async (): Promise<void> => {
      mockXHRResponse = { data: '{"success":true}' };

      const config = {
        url: 'https://api.test.com/data',
        method: 'POST',
        data: { name: 'test', value: 123 },
      };

      const response = await xhrAdapter(config);

      const xhr = mockXHRInstances[0];
      assert.strictEqual(xhr.method, 'POST');
      assert.strictEqual(xhr.sentData, JSON.stringify(config.data));
      assert.deepStrictEqual(response.data, { success: true });
    });

    it('should handle PUT requests', async (): Promise<void> => {
      mockXHRResponse = { data: '{"updated":true}' };

      const config = {
        url: 'https://api.test.com/data/1',
        method: 'PUT',
        data: { updated: 'value' },
      };

      await xhrAdapter(config);

      const xhr = mockXHRInstances[0];
      assert.strictEqual(xhr.method, 'PUT');
      assert.strictEqual(xhr.sentData, JSON.stringify(config.data));
    });

    it('should handle DELETE requests', async (): Promise<void> => {
      mockXHRResponse = { data: '{"deleted":true}' };

      const config = {
        url: 'https://api.test.com/data/1',
        method: 'DELETE',
      };

      await xhrAdapter(config);

      const xhr = mockXHRInstances[0];
      assert.strictEqual(xhr.method, 'DELETE');
      assert(xhr.sendCalled);
      assert.strictEqual(xhr.sentData, undefined);
    });

    it('should handle HEAD requests without body', async (): Promise<void> => {
      mockXHRResponse = { data: '' };

      const config = {
        url: 'https://api.test.com/data',
        method: 'HEAD',
        data: { should: 'be ignored' },
      };

      await xhrAdapter(config);

      const xhr = mockXHRInstances[0];
      assert.strictEqual(xhr.method, 'HEAD');
      assert.strictEqual(xhr.sentData, undefined);
    });
  });

  describe('URL handling', () => {
    it('should build URL with query params', async (): Promise<void> => {
      mockXHRResponse = { data: '{}' };

      const config = {
        url: 'https://api.test.com/data',
        params: { id: 123, name: 'test' },
      };

      await xhrAdapter(config);

      const xhr = mockXHRInstances[0];
      assert(xhr.url.includes('id=123'));
      assert(xhr.url.includes('name=test'));
    });

    it('should handle empty URL gracefully', async (): Promise<void> => {
      mockXHRResponse = { data: '{}' };

      const config = {
        url: '',
        method: 'GET',
      };

      await xhrAdapter(config);

      const xhr = mockXHRInstances[0];
      assert.strictEqual(xhr.url, '');
    });

    it('should handle URLs with existing query params', async (): Promise<void> => {
      mockXHRResponse = { data: '{}' };

      const config = {
        url: 'https://api.test.com/data?existing=true',
        params: { new: 'param' },
      };

      await xhrAdapter(config);

      const xhr = mockXHRInstances[0];
      assert(xhr.url.includes('existing=true'));
      assert(xhr.url.includes('new=param'));
    });
  });

  describe('Headers handling', () => {
    it('should set custom headers', async (): Promise<void> => {
      mockXHRResponse = { data: '{}' };

      const config = {
        url: 'https://api.test.com/data',
        headers: {
          'X-Custom': 'value',
          Authorization: 'Bearer token',
        },
      };

      await xhrAdapter(config);

      const xhr = mockXHRInstances[0];
      assert.strictEqual(xhr.headers['X-Custom'], 'value');
      assert.strictEqual(xhr.headers['Authorization'], 'Bearer token');
    });

    it('should handle array header values', async (): Promise<void> => {
      mockXHRResponse = { data: '{}' };

      const config = {
        url: 'https://api.test.com/data',
        headers: {
          'X-Multiple': ['value1', 'value2', 'value3'],
        },
      };

      await xhrAdapter(config);

      const xhr = mockXHRInstances[0];
      assert.strictEqual(xhr.headers['X-Multiple'], 'value1, value2, value3');
    });

    it('should ignore undefined header values', async (): Promise<void> => {
      mockXHRResponse = { data: '{}' };

      const config = {
        url: 'https://api.test.com/data',
        headers: {
          'X-Defined': 'value',
          'X-Undefined': undefined,
        },
      };

      await xhrAdapter(config);

      const xhr = mockXHRInstances[0];
      assert.strictEqual(xhr.headers['X-Defined'], 'value');
      assert.strictEqual(xhr.headers['X-Undefined'], undefined);
    });

    it('should parse response headers', async (): Promise<void> => {
      mockXHRResponse = {
        data: '{}',
        headers: {
          'content-type': 'application/json',
          'x-custom-header': 'value',
          'cache-control': 'no-cache',
        },
      };

      const response = await xhrAdapter({ url: 'https://api.test.com/data' });

      assert.strictEqual(response.headers['content-type'], 'application/json');
      assert.strictEqual(response.headers['x-custom-header'], 'value');
      assert.strictEqual(response.headers['cache-control'], 'no-cache');
    });
  });

  describe('Response types', () => {
    it('should handle JSON response type', async (): Promise<void> => {
      mockXHRResponse = { data: '{"json":"response"}' };

      const config = {
        url: 'https://api.test.com/data',
        responseType: 'json',
      };

      const response = await xhrAdapter(config);
      assert.deepStrictEqual(response.data, { json: 'response' });
    });

    it('should handle text response type', async (): Promise<void> => {
      mockXHRResponse = { data: 'plain text response' };

      const config = {
        url: 'https://api.test.com/data',
        responseType: 'text',
      };

      const response = await xhrAdapter(config);
      assert.strictEqual(response.data, 'plain text response');
    });

    it('should handle arraybuffer response type', async (): Promise<void> => {
      const buffer = new ArrayBuffer(8);
      mockXHRResponse = { data: buffer };

      const config = {
        url: 'https://api.test.com/data',
        responseType: 'arraybuffer',
      };

      const response = await xhrAdapter(config);
      assert.strictEqual(response.data, buffer);

      const xhr = mockXHRInstances[0];
      assert.strictEqual(xhr.responseType, 'arraybuffer');
    });

    it('should handle blob response type', async (): Promise<void> => {
      const blob = new Blob(['blob data']);
      mockXHRResponse = { data: blob };

      const config = {
        url: 'https://api.test.com/data',
        responseType: 'blob',
      };

      const response = await xhrAdapter(config);
      assert.strictEqual(response.data, blob);

      const xhr = mockXHRInstances[0];
      assert.strictEqual(xhr.responseType, 'blob');
    });

    it('should handle document response type', async (): Promise<void> => {
      const doc = new Document();
      mockXHRResponse = { data: doc };

      const config = {
        url: 'https://api.test.com/data',
        responseType: 'document',
      };

      const response = await xhrAdapter(config);
      assert.strictEqual(response.data, doc);
    });

    it('should default to text when no responseType', async (): Promise<void> => {
      mockXHRResponse = { data: 'default text' };

      const response = await xhrAdapter({ url: 'https://api.test.com/data' });
      assert.strictEqual(response.data, 'default text');
    });

    it('should handle invalid JSON gracefully', async (): Promise<void> => {
      mockXHRResponse = { data: 'not json' };

      const config = {
        url: 'https://api.test.com/data',
        responseType: 'json',
      };

      const response = await xhrAdapter(config);
      assert.strictEqual(response.data, 'not json');
    });

    it('should reject invalid responseType values', async (): Promise<void> => {
      mockXHRResponse = { data: '{}' };

      const config = {
        url: 'https://api.test.com/data',
        responseType: 'invalid',
      };

      await xhrAdapter(config);

      const xhr = mockXHRInstances[0];
      // Should not set invalid responseType
      assert.strictEqual(xhr.responseType, '');
    });
  });

  describe('Request body handling', () => {
    it('should send FormData as-is', async (): Promise<void> => {
      mockXHRResponse = { data: '{}' };

      const formData = new FormData();
      formData.append('field', 'value');

      const config = {
        url: 'https://api.test.com/data',
        method: 'POST',
        data: formData,
      };

      await xhrAdapter(config);

      const xhr = mockXHRInstances[0];
      assert.strictEqual(xhr.sentData, formData);
    });

    it('should send URLSearchParams as-is', async (): Promise<void> => {
      mockXHRResponse = { data: '{}' };

      const params = new URLSearchParams({ key: 'value' });

      const config = {
        url: 'https://api.test.com/data',
        method: 'POST',
        data: params,
      };

      await xhrAdapter(config);

      const xhr = mockXHRInstances[0];
      assert.strictEqual(xhr.sentData, params);
    });

    it('should send Blob as-is', async (): Promise<void> => {
      mockXHRResponse = { data: '{}' };

      const blob = new Blob(['blob content']);

      const config = {
        url: 'https://api.test.com/data',
        method: 'POST',
        data: blob,
      };

      await xhrAdapter(config);

      const xhr = mockXHRInstances[0];
      assert.strictEqual(xhr.sentData, blob);
    });

    it('should send string as-is', async (): Promise<void> => {
      mockXHRResponse = { data: '{}' };

      const config = {
        url: 'https://api.test.com/data',
        method: 'POST',
        data: 'plain text data',
      };

      await xhrAdapter(config);

      const xhr = mockXHRInstances[0];
      assert.strictEqual(xhr.sentData, 'plain text data');
    });

    it('should stringify objects', async (): Promise<void> => {
      mockXHRResponse = { data: '{}' };

      const config = {
        url: 'https://api.test.com/data',
        method: 'POST',
        data: { complex: { nested: 'object' } },
      };

      await xhrAdapter(config);

      const xhr = mockXHRInstances[0];
      assert.strictEqual(xhr.sentData, JSON.stringify(config.data));
    });

    it('should handle null data', async (): Promise<void> => {
      mockXHRResponse = { data: '{}' };

      const config = {
        url: 'https://api.test.com/data',
        method: 'POST',
        data: null,
      };

      await xhrAdapter(config);

      const xhr = mockXHRInstances[0];
      assert.strictEqual(xhr.sentData, undefined);
    });
  });

  describe('XHR configuration', () => {
    it('should set timeout', async (): Promise<void> => {
      mockXHRResponse = { data: '{}' };

      const config = {
        url: 'https://api.test.com/data',
        timeout: 5000,
      };

      await xhrAdapter(config);

      const xhr = mockXHRInstances[0];
      assert.strictEqual(xhr.timeout, 5000);
    });

    it('should set withCredentials', async (): Promise<void> => {
      mockXHRResponse = { data: '{}' };

      const config = {
        url: 'https://api.test.com/data',
        withCredentials: true,
      };

      await xhrAdapter(config);

      const xhr = mockXHRInstances[0];
      assert.strictEqual(xhr.withCredentials, true);
    });

    it('should default withCredentials to false', async (): Promise<void> => {
      mockXHRResponse = { data: '{}' };

      await xhrAdapter({ url: 'https://api.test.com/data' });

      const xhr = mockXHRInstances[0];
      assert.strictEqual(xhr.withCredentials, false);
    });
  });

  describe('Error handling', () => {
    it('should handle network errors', async (): Promise<void> => {
      mockNetworkError = true;

      await assert.rejects(async () => await xhrAdapter({ url: 'https://api.test.com/data' }), {
        code: 'ERR_NETWORK',
      });
    });

    it('should handle timeout', async (): Promise<void> => {
      mockTimeout = true;

      await assert.rejects(
        async () => await xhrAdapter({ url: 'https://api.test.com/data', timeout: 1000 }),
        { code: 'ECONNABORTED' }
      );
    });

    it('should reject on non-2xx status by default', async (): Promise<void> => {
      mockXHRResponse = {
        status: 404,
        statusText: 'Not Found',
        data: '{"error":"Not found"}',
      };

      await assert.rejects(async () => await xhrAdapter({ url: 'https://api.test.com/data' }), {
        code: 'ERR_BAD_RESPONSE',
      });
    });

    it('should use validateStatus when provided', async (): Promise<void> => {
      mockXHRResponse = {
        status: 404,
        statusText: 'Not Found',
        data: '{"error":"Not found"}',
      };

      const config = {
        url: 'https://api.test.com/data',
        validateStatus: (status) => status < 500,
      };

      const response = await xhrAdapter(config);
      assert.strictEqual(response.status, 404);
    });

    it('should handle parse errors', async (): Promise<void> => {
      // Force a parse error by returning invalid data for arraybuffer
      mockXHRResponse = {
        data: 'not an arraybuffer',
      };

      const config = {
        url: 'https://api.test.com/data',
        responseType: 'arraybuffer',
      };

      // The adapter should handle this gracefully
      await assert.rejects(async () => await xhrAdapter(config), { code: 'ERR_PARSE_RESPONSE' });
    });
  });

  describe('Progress events', () => {
    it('should handle download progress', async (): Promise<void> => {
      const progressEvents = [];

      mockXHRResponse = {
        data: '{}',
        progressEvents: [
          { loaded: 50, total: 100, lengthComputable: true },
          { loaded: 100, total: 100, lengthComputable: true },
        ],
      };

      const config = {
        url: 'https://api.test.com/data',
        onDownloadProgress: (event) => progressEvents.push(event),
      };

      await xhrAdapter(config);

      assert.strictEqual(progressEvents.length, 2);
      assert.strictEqual(progressEvents[0].loaded, 50);
      assert.strictEqual(progressEvents[0].total, 100);
      assert.strictEqual(progressEvents[0].bytes, 50);
      assert.strictEqual(progressEvents[1].loaded, 100);
    });

    it('should handle upload progress', async (): Promise<void> => {
      const progressEvents = [];

      mockXHRResponse = {
        data: '{}',
        uploadProgressEvents: [
          { loaded: 25, total: 50, lengthComputable: true },
          { loaded: 50, total: 50, lengthComputable: true },
        ],
      };

      const config = {
        url: 'https://api.test.com/data',
        method: 'POST',
        data: { test: 'data' },
        onUploadProgress: (event) => progressEvents.push(event),
      };

      await xhrAdapter(config);

      assert.strictEqual(progressEvents.length, 2);
      assert.strictEqual(progressEvents[0].loaded, 25);
      assert.strictEqual(progressEvents[0].total, 50);
      assert.strictEqual(progressEvents[1].loaded, 50);
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
          await xhrAdapter({
            url: 'https://api.test.com/data',
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

      // Make the XHR take longer
      const originalTimeout = global.setTimeout;
      (global as any).setTimeout = (fn, delay) => originalTimeout(fn, 100);

      const promise = xhrAdapter({
        url: 'https://api.test.com/data',
        cancelToken,
      });

      // Cancel after a short delay
      originalTimeout(() => {
        cancelResolve({ message: 'User canceled' });
      }, 50);

      await assert.rejects(async () => await promise, { code: 'ERR_CANCELED' });

      (global as any).setTimeout = originalTimeout;

      const xhr = mockXHRInstances[0];
      assert(xhr.aborted);
    });

    it('should handle abort signal', async (): Promise<void> => {
      const listeners = [];
      const signal = {
        addEventListener: (event, listener) => {
          listeners.push({ event, listener });
        },
      };

      // Make the XHR take longer
      const originalTimeout = global.setTimeout;
      (global as any).setTimeout = (fn, delay) => originalTimeout(fn, 100);

      const promise = xhrAdapter({
        url: 'https://api.test.com/data',
        signal,
      });

      // Trigger abort after a short delay
      originalTimeout(() => {
        const abortListener = listeners.find((l) => l.event === 'abort');
        if (abortListener) {
          abortListener.listener();
        }
      }, 50);

      await assert.rejects(async () => await promise, { code: 'ERR_CANCELED' });

      (global as any).setTimeout = originalTimeout;

      const xhr = mockXHRInstances[0];
      assert(xhr.aborted);
    });
  });

  describe('Response handling', () => {
    it('should include status and statusText', async (): Promise<void> => {
      mockXHRResponse = {
        status: 201,
        statusText: 'Created',
        data: '{}',
      };

      const response = await xhrAdapter({ url: 'https://api.test.com/data' });

      assert.strictEqual(response.status, 201);
      assert.strictEqual(response.statusText, 'Created');
    });

    it('should include config and request in response', async (): Promise<void> => {
      mockXHRResponse = { data: '{}' };

      const config = {
        url: 'https://api.test.com/data',
        method: 'POST',
        timeout: 5000,
      };

      const response = await xhrAdapter(config);

      assert.strictEqual(response.config, config);
      assert(response.request instanceof MockXMLHttpRequest);
    });

    it('should handle empty response headers', async (): Promise<void> => {
      mockXHRResponse = { data: '{}', headers: null };

      const response = await xhrAdapter({ url: 'https://api.test.com/data' });

      assert(response.headers);
      assert.strictEqual(Object.keys(response.headers).length, 0);
    });
  });

  describe('Edge cases', () => {
    it('should handle empty response body', async (): Promise<void> => {
      mockXHRResponse = { data: '' };

      const response = await xhrAdapter({ url: 'https://api.test.com/data' });
      assert.strictEqual(response.data, '');
    });

    it('should handle method case normalization', async (): Promise<void> => {
      mockXHRResponse = { data: '{}' };

      const config = {
        url: 'https://api.test.com/data',
        method: 'post',
      };

      await xhrAdapter(config);

      const xhr = mockXHRInstances[0];
      assert.strictEqual(xhr.method, 'POST');
    });

    it('should handle special characters in headers', async (): Promise<void> => {
      mockXHRResponse = {
        data: '{}',
        headers: {
          'x-special': 'value with spaces',
          'x-unicode': '你好世界',
        },
      };

      const response = await xhrAdapter({ url: 'https://api.test.com/data' });

      assert.strictEqual(response.headers['x-special'], 'value with spaces');
      assert.strictEqual(response.headers['x-unicode'], '你好世界');
    });

    it('should handle ArrayBuffer-like objects', async (): Promise<void> => {
      mockXHRResponse = { data: '{}' };

      // Create a buffer-like object
      const bufferLike = {
        buffer: new ArrayBuffer(8),
        byteLength: 8,
        byteOffset: 0,
      };

      const config = {
        url: 'https://api.test.com/data',
        method: 'POST',
        data: bufferLike,
      };

      await xhrAdapter(config);

      const xhr = mockXHRInstances[0];
      assert.strictEqual(xhr.sentData, bufferLike);
    });

    it('should handle malformed response headers', async (): Promise<void> => {
      // Override getAllResponseHeaders to return malformed data
      MockXMLHttpRequest.prototype.getAllResponseHeaders = function () {
        return 'malformed\nno-colon\n:no-key\n  \n\nvalid-header: value';
      };

      mockXHRResponse = { data: '{}' };

      const response = await xhrAdapter({ url: 'https://api.test.com/data' });

      // Should only parse valid header
      assert.strictEqual(response.headers['valid-header'], 'value');
      assert.strictEqual(Object.keys(response.headers).length, 1);

      // Restore original
      MockXMLHttpRequest.prototype.getAllResponseHeaders = function () {
        if (mockXHRResponse?.headers) {
          return Object.entries(mockXHRResponse.headers)
            .map(([key, value]) => `${key}: ${value}`)
            .join('\r\n');
        }
        return '';
      };
    });
  });
});
