import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';

// Mock global fetch
let mockFetchResponse;
let mockFetchError;
let fetchCallCount = 0;
let lastFetchCall = null;

(global as any).fetch = async (url, options) => {
  fetchCallCount++;
  lastFetchCall = { url, options };

  if (mockFetchError) {
    throw mockFetchError;
  }

  return (
    mockFetchResponse || {
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: new Map([['content-type', 'application/json']]),
      json: async (): Promise<any> => ({ test: 'data' }),
      text: async () => '{"test":"data"}',
      blob: async () => new Blob(['test']),
      arrayBuffer: async () => new ArrayBuffer(4),
      body: null,
    }
  );
};

(global as any).Headers = class Headers extends Map {
  constructor(init) {
    super();
    if (init) {
      Object.entries(init).forEach(([key, value]) => {
        this.set(key.toLowerCase(), value);
      });
    }
  }

  entries() {
    return Array.from(super.entries());
  }
};

(global as any).AbortController = class AbortController {
  constructor() {
    this.signal = { aborted: false };
  }

  abort() {
    this.signal.aborted = true;
  }
};

(global as any).Blob = class Blob {
  constructor(parts) {
    this.parts = parts;
    this.size = parts.reduce((sum, part) => sum + part.length, 0);
  }
};

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

(global as any).ReadableStream = class ReadableStream {};

// Import after mocking globals
import { fetchAdapter } from '../../../dist/adapters/fetch.adapter.js';

describe('fetchAdapter', () => {
  beforeEach(() => {
    mockFetchResponse = null;
    mockFetchError = null;
    fetchCallCount = 0;
    lastFetchCall = null;
  });

  describe('Basic requests', (): void => {
    it('should make a GET request', async (): Promise<void> => {
      const config = {
        url: 'https://api.test.com/data',
        method: 'GET',
      };

      const response = await fetchAdapter(config);

      assert.strictEqual(fetchCallCount, 1);
      assert.strictEqual(lastFetchCall.url, 'https://api.test.com/data');
      assert.strictEqual(lastFetchCall.options.method, 'GET');
      assert.deepStrictEqual(response.data, { test: 'data' });
      assert.strictEqual(response.status, 200);
    });

    it('should make a POST request with data', async (): Promise<void> => {
      const config = {
        url: 'https://api.test.com/data',
        method: 'POST',
        data: { name: 'test', value: 123 },
      };

      await fetchAdapter(config);

      assert.strictEqual(lastFetchCall.options.method, 'POST');
      assert.strictEqual(lastFetchCall.options.body, JSON.stringify(config.data));
    });

    it('should handle PUT requests', async (): Promise<void> => {
      const config = {
        url: 'https://api.test.com/data/1',
        method: 'PUT',
        data: { updated: true },
      };

      await fetchAdapter(config);

      assert.strictEqual(lastFetchCall.options.method, 'PUT');
      assert.strictEqual(lastFetchCall.options.body, JSON.stringify(config.data));
    });

    it('should handle DELETE requests', async (): Promise<void> => {
      const config = {
        url: 'https://api.test.com/data/1',
        method: 'DELETE',
      };

      await fetchAdapter(config);

      assert.strictEqual(lastFetchCall.options.method, 'DELETE');
      assert.strictEqual(lastFetchCall.options.body, undefined);
    });

    it('should handle PATCH requests', async (): Promise<void> => {
      const config = {
        url: 'https://api.test.com/data/1',
        method: 'PATCH',
        data: { field: 'value' },
      };

      await fetchAdapter(config);

      assert.strictEqual(lastFetchCall.options.method, 'PATCH');
      assert.strictEqual(lastFetchCall.options.body, JSON.stringify(config.data));
    });

    it('should handle HEAD requests without body', async (): Promise<void> => {
      const config = {
        url: 'https://api.test.com/data',
        method: 'HEAD',
        data: { should: 'be ignored' },
      };

      await fetchAdapter(config);

      assert.strictEqual(lastFetchCall.options.method, 'HEAD');
      assert.strictEqual(lastFetchCall.options.body, undefined);
    });

    it('should handle OPTIONS requests', async (): Promise<void> => {
      const config = {
        url: 'https://api.test.com/data',
        method: 'OPTIONS',
      };

      await fetchAdapter(config);

      assert.strictEqual(lastFetchCall.options.method, 'OPTIONS');
    });
  });

  describe('URL handling', () => {
    it('should reject when URL is missing', async (): Promise<void> => {
      await assert.rejects(async () => await fetchAdapter({ method: 'GET' }), {
        code: 'ERR_INVALID_URL',
      });
    });

    it('should build URL with query params', async (): Promise<void> => {
      const config = {
        url: 'https://api.test.com/data',
        params: { id: 123, name: 'test' },
      };

      await fetchAdapter(config);

      assert(lastFetchCall.url.includes('id=123'));
      assert(lastFetchCall.url.includes('name=test'));
    });

    it('should handle URLs with existing query params', async (): Promise<void> => {
      const config = {
        url: 'https://api.test.com/data?existing=true',
        params: { new: 'param' },
      };

      await fetchAdapter(config);

      assert(lastFetchCall.url.includes('existing=true'));
      assert(lastFetchCall.url.includes('new=param'));
    });
  });

  describe('Headers handling', () => {
    it('should set custom headers', async (): Promise<void> => {
      const config = {
        url: 'https://api.test.com/data',
        headers: {
          'X-Custom': 'value',
          Authorization: 'Bearer token',
        },
      };

      await fetchAdapter(config);

      const headers = lastFetchCall.options.headers;
      assert(headers.get('x-custom') === 'value');
      assert(headers.get('authorization') === 'Bearer token');
    });

    it('should handle array header values', async (): Promise<void> => {
      const config = {
        url: 'https://api.test.com/data',
        headers: {
          'X-Multiple': ['value1', 'value2', 'value3'],
        },
      };

      await fetchAdapter(config);

      const headers = lastFetchCall.options.headers;
      assert.strictEqual(headers.get('x-multiple'), 'value1, value2, value3');
    });

    it('should ignore undefined header values', async (): Promise<void> => {
      const config = {
        url: 'https://api.test.com/data',
        headers: {
          'X-Defined': 'value',
          'X-Undefined': undefined,
        },
      };

      await fetchAdapter(config);

      const headers = lastFetchCall.options.headers;
      assert(headers.has('x-defined'));
      assert(!headers.has('x-undefined'));
    });
  });

  describe('Response types', () => {
    it('should handle JSON response type', async (): Promise<void> => {
      const config = {
        url: 'https://api.test.com/data',
        responseType: 'json',
      };

      mockFetchResponse = {
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Map(),
        json: async (): Promise<any> => ({ json: 'data' }),
        text: async () => 'fallback',
      };

      const response = await fetchAdapter(config);
      assert.deepStrictEqual(response.data, { json: 'data' });
    });

    it('should handle text response type', async (): Promise<void> => {
      const config = {
        url: 'https://api.test.com/data',
        responseType: 'text',
      };

      mockFetchResponse = {
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Map(),
        text: async () => 'plain text response',
      };

      const response = await fetchAdapter(config);
      assert.strictEqual(response.data, 'plain text response');
    });

    it('should handle blob response type', async (): Promise<void> => {
      const config = {
        url: 'https://api.test.com/data',
        responseType: 'blob',
      };

      const blob = new Blob(['blob data']);
      mockFetchResponse = {
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Map(),
        blob: async () => blob,
      };

      const response = await fetchAdapter(config);
      assert.strictEqual(response.data, blob);
    });

    it('should handle arraybuffer response type', async (): Promise<void> => {
      const config = {
        url: 'https://api.test.com/data',
        responseType: 'arraybuffer',
      };

      const buffer = new ArrayBuffer(8);
      mockFetchResponse = {
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Map(),
        arrayBuffer: async () => buffer,
      };

      const response = await fetchAdapter(config);
      assert.strictEqual(response.data, buffer);
    });

    it('should handle stream response type', async (): Promise<void> => {
      const config = {
        url: 'https://api.test.com/data',
        responseType: 'stream',
      };

      const stream = new ReadableStream();
      mockFetchResponse = {
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Map(),
        body: stream,
      };

      const response = await fetchAdapter(config);
      assert.strictEqual(response.data, stream);
    });

    it('should auto-detect JSON from content-type', async (): Promise<void> => {
      const config = {
        url: 'https://api.test.com/data',
      };

      mockFetchResponse = {
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Map([['content-type', 'application/json; charset=utf-8']]),
        json: async (): Promise<any> => ({ auto: 'detected' }),
        text: async () => '{"auto":"detected"}',
      };

      const response = await fetchAdapter(config);
      assert.deepStrictEqual(response.data, { auto: 'detected' });
    });

    it('should fallback to text when JSON parsing fails', async (): Promise<void> => {
      const config = {
        url: 'https://api.test.com/data',
        responseType: 'json',
      };

      mockFetchResponse = {
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Map(),
        json: async () => {
          throw new Error('Invalid JSON');
        },
        text: async () => 'not json',
      };

      const response = await fetchAdapter(config);
      assert.strictEqual(response.data, 'not json');
    });
  });

  describe('Request body handling', () => {
    it('should send FormData as-is', async (): Promise<void> => {
      const formData = new FormData();
      formData.append('field', 'value');

      const config = {
        url: 'https://api.test.com/data',
        method: 'POST',
        data: formData,
      };

      await fetchAdapter(config);

      assert.strictEqual(lastFetchCall.options.body, formData);
    });

    it('should send URLSearchParams as-is', async (): Promise<void> => {
      const params = new URLSearchParams({ key: 'value' });

      const config = {
        url: 'https://api.test.com/data',
        method: 'POST',
        data: params,
      };

      await fetchAdapter(config);

      assert.strictEqual(lastFetchCall.options.body, params);
    });

    it('should send Blob as-is', async (): Promise<void> => {
      const blob = new Blob(['blob content']);

      const config = {
        url: 'https://api.test.com/data',
        method: 'POST',
        data: blob,
      };

      await fetchAdapter(config);

      assert.strictEqual(lastFetchCall.options.body, blob);
    });

    it('should send string as-is', async (): Promise<void> => {
      const config = {
        url: 'https://api.test.com/data',
        method: 'POST',
        data: 'plain text data',
      };

      await fetchAdapter(config);

      assert.strictEqual(lastFetchCall.options.body, 'plain text data');
    });

    it('should stringify objects', async (): Promise<void> => {
      const config = {
        url: 'https://api.test.com/data',
        method: 'POST',
        data: { complex: { nested: 'object' } },
      };

      await fetchAdapter(config);

      assert.strictEqual(lastFetchCall.options.body, JSON.stringify(config.data));
    });

    it('should handle null data', async (): Promise<void> => {
      const config = {
        url: 'https://api.test.com/data',
        method: 'POST',
        data: null,
      };

      await fetchAdapter(config);

      assert.strictEqual(lastFetchCall.options.body, undefined);
    });
  });

  describe('Credentials handling', () => {
    it('should set credentials to include when withCredentials is true', async (): Promise<void> => {
      const config = {
        url: 'https://api.test.com/data',
        withCredentials: true,
      };

      await fetchAdapter(config);

      assert.strictEqual(lastFetchCall.options.credentials, 'include');
    });

    it('should set credentials to same-origin by default', async (): Promise<void> => {
      const config = {
        url: 'https://api.test.com/data',
      };

      await fetchAdapter(config);

      assert.strictEqual(lastFetchCall.options.credentials, 'same-origin');
    });
  });

  describe('Error handling', () => {
    it('should reject on non-2xx status by default', async (): Promise<void> => {
      mockFetchResponse = {
        ok: false,
        status: 404,
        statusText: 'Not Found',
        headers: new Map(),
        json: async (): Promise<any> => ({ error: 'Not found' }),
        text: async () => '{"error":"Not found"}',
      };

      await assert.rejects(async () => await fetchAdapter({ url: 'https://api.test.com/data' }), {
        code: 'ERR_BAD_RESPONSE',
      });
    });

    it('should use validateStatus when provided', async (): Promise<void> => {
      mockFetchResponse = {
        ok: false,
        status: 404,
        statusText: 'Not Found',
        headers: new Map(),
        json: async (): Promise<any> => ({ error: 'Not found' }),
        text: async () => '{"error":"Not found"}',
      };

      const config = {
        url: 'https://api.test.com/data',
        validateStatus: (status) => status < 500,
      };

      const response = await fetchAdapter(config);
      assert.strictEqual(response.status, 404);
    });

    it('should handle network errors', async (): Promise<void> => {
      mockFetchError = new Error('Network error: Failed to fetch');

      await assert.rejects(async () => await fetchAdapter({ url: 'https://api.test.com/data' }), {
        code: 'ERR_NETWORK',
      });
    });

    it('should handle abort errors as timeout', async (): Promise<void> => {
      mockFetchError = new Error('AbortError');
      mockFetchError.name = 'AbortError';

      await assert.rejects(async () => await fetchAdapter({ url: 'https://api.test.com/data' }), {
        code: 'ECONNABORTED',
      });
    });

    it('should handle unknown errors', async (): Promise<void> => {
      mockFetchError = 'string error';

      await assert.rejects(async () => await fetchAdapter({ url: 'https://api.test.com/data' }), {
        code: 'ERR_UNKNOWN',
      });
    });
  });

  describe('Timeout handling', () => {
    it('should timeout after specified duration', async (): Promise<void> => {
      let resolveFetch;
      mockFetchResponse = new Promise((_resolve) => {
        resolveFetch = resolve;
      });

      const config = {
        url: 'https://api.test.com/data',
        timeout: 100,
      };

      const startTime = Date.now();

      await assert.rejects(async () => await fetchAdapter(config), { code: 'ECONNABORTED' });

      const duration = Date.now() - startTime;
      assert(duration >= 90 && duration < 200, `Timeout duration was ${duration}ms`);
    });

    it('should clear timeout on successful response', async (): Promise<void> => {
      const config = {
        url: 'https://api.test.com/data',
        timeout: 1000,
      };

      const response = await fetchAdapter(config);
      assert(response);

      // Wait a bit to ensure no timeout occurs
      await new Promise((resolve) => setTimeout(resolve, 100));
    });
  });

  describe('Cancel token handling', () => {
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
          await fetchAdapter({
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

      // Delay the mock response
      mockFetchResponse = new Promise((_resolve) => {
        setTimeout(
          () =>
            resolve({
              ok: true,
              status: 200,
              statusText: 'OK',
              headers: new Map(),
              json: async (): Promise<any> => ({ test: 'data' }),
            }),
          100
        );
      });

      const requestPromise = fetchAdapter({
        url: 'https://api.test.com/data',
        cancelToken,
      });

      // Cancel after a short delay
      setTimeout(() => {
        cancelResolve({ message: 'User canceled' });
      }, 50);

      await assert.rejects(async () => await requestPromise, { code: 'ERR_CANCELED' });
    });
  });

  describe('Response parsing edge cases', () => {
    it('should handle empty response body', async (): Promise<void> => {
      mockFetchResponse = {
        ok: true,
        status: 204,
        statusText: 'No Content',
        headers: new Map(),
        text: async () => '',
      };

      const response = await fetchAdapter({ url: 'https://api.test.com/data' });
      assert.strictEqual(response.data, '');
    });

    it('should handle response headers', async (): Promise<void> => {
      mockFetchResponse = {
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Map([
          ['content-type', 'application/json'],
          ['x-custom-header', 'value'],
          ['cache-control', 'no-cache'],
        ]),
        json: async (): Promise<any> => ({ test: 'data' }),
      };

      const response = await fetchAdapter({ url: 'https://api.test.com/data' });

      assert.strictEqual(response.headers['content-type'], 'application/json');
      assert.strictEqual(response.headers['x-custom-header'], 'value');
      assert.strictEqual(response.headers['cache-control'], 'no-cache');
    });

    it('should include original request in response', async (): Promise<void> => {
      const response = await fetchAdapter({ url: 'https://api.test.com/data' });
      assert(response.request);
    });

    it('should include config in response', async (): Promise<void> => {
      const config = {
        url: 'https://api.test.com/data',
        method: 'POST',
        timeout: 5000,
      };

      const response = await fetchAdapter(config);
      assert.strictEqual(response.config, config);
    });
  });

  describe('Method normalization', () => {
    it('should uppercase method names', async (): Promise<void> => {
      const methods = ['get', 'post', 'put', 'delete', 'patch', 'head', 'options'];

      for (const method of methods) {
        await fetchAdapter({ url: 'https://api.test.com/data', method });
        assert.strictEqual(lastFetchCall.options.method, method.toUpperCase());
      }
    });
  });
});
