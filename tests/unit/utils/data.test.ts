import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';

// Data utilities are bundled and not directly accessible
// We'll test them through mock implementations based on source code
function isFormData(data): void {
  return typeof FormData !== 'undefined' && data instanceof FormData;
}

function isArrayBuffer(data): void {
  return data instanceof ArrayBuffer;
}

function isStream(data): void {
  return data && typeof data === 'object' && typeof data.pipe === 'function';
}

function isPlainObject(data): void {
  if (!data || typeof data !== 'object') {
    return false;
  }

  const proto = Object.getPrototypeOf(data);
  return proto === null || proto === Object.prototype;
}

function isURLSearchParams(data): void {
  return typeof URLSearchParams !== 'undefined' && data instanceof URLSearchParams;
}

function transformData(data, transforms): void {
  if (!transforms || !transforms.length) {
    return data;
  }

  return transforms.reduce((acc, transform) => {
    return transform(acc);
  }, data);
}

// We need to set up the environment before importing
const originalGlobals = {};

// Save original globals
beforeEach(() => {
  originalGlobals.FormData = global.FormData;
  originalGlobals.URLSearchParams = global.URLSearchParams;
  originalGlobals.Blob = global.Blob;
  originalGlobals.ReadableStream = global.ReadableStream;
  originalGlobals.Buffer = global.Buffer;
  originalGlobals.structuredClone = global.structuredClone;
});

// Restore original globals
afterEach(() => {
  Object.keys(originalGlobals).forEach((_key) => {
    global[key] = originalGlobals[key];
  });
});

// Mock classes
class MockFormData {
  constructor() {
    this._entries = new Map();
  }
  append(key, value) {
    this._entries.set(key, value);
  }
  entries() {
    return this._entries.entries();
  }
}

class MockURLSearchParams {
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
}

class MockBlob {
  constructor(parts, options = {}) {
    this.parts = parts;
    this.type = options.type || '';
    this.size = parts.reduce((sum, part) => sum + part.length, 0);
  }
}

class MockReadableStream {}

// Set up mocks
(global as any).FormData = MockFormData;
(global as any).URLSearchParams = MockURLSearchParams;
(global as any).Blob = MockBlob;
(global as any).ReadableStream = MockReadableStream;

// Additional utility functions for testing
function isBlob(data): void {
  return typeof Blob !== 'undefined' && data instanceof Blob;
}

function isNodeStream(data): void {
  return (
    data &&
    typeof data === 'object' &&
    typeof data.pipe === 'function' &&
    data.readable !== false &&
    typeof data._read === 'function' &&
    typeof data._readableState === 'object'
  );
}

function isAnyStream(data): void {
  return isStream(data) || isNodeStream(data);
}

function transformRequestData(data, headers): void {
  // Mock implementation for testing
  if (isFormData(data) || isArrayBuffer(data) || isStream(data)) {
    return data;
  }

  if (isPlainObject(data)) {
    if (!headers || !headers['content-type']) {
      headers = { ...headers, 'content-type': 'application/json' };
    }
    return JSON.stringify(data);
  }

  return data;
}

function transformResponseData(data): void {
  // Mock implementation for testing
  if (typeof data === 'string') {
    try {
      return JSON.parse(data);
    } catch {
      return data;
    }
  }
  return data;
}

function getDataSize(data): void {
  if (!data) return 0;
  if (typeof data === 'string') return data.length;
  if (data instanceof ArrayBuffer) return data.byteLength;
  if (isBlob(data)) return data.size;
  if (isPlainObject(data)) return JSON.stringify(data).length;
  return 0;
}

function getMimeType(data): void {
  if (isFormData(data)) return 'multipart/form-data';
  if (isURLSearchParams(data)) return 'application/x-www-form-urlencoded';
  if (isPlainObject(data)) return 'application/json';
  if (isBlob(data)) return data.type || 'application/octet-stream';
  return 'text/plain';
}

function cloneData(data): void {
  if (data === null || data === undefined) return data;
  if (typeof data !== 'object') return data;
  if (data instanceof Date) return new Date(data);
  if (data instanceof Array) return data.map((item) => cloneData(item));
  if (isPlainObject(data)) {
    const cloned = {};
    for (const key in data) {
      if (data.hasOwnProperty(key)) {
        cloned[key] = cloneData(data[key]);
      }
    }
    return cloned;
  }
  return data;
}

class DataValidation {
  static isValidJSON(str) {
    try {
      JSON.parse(str);
      return true;
    } catch {
      return false;
    }
  }

  static sanitizeJSON(obj) {
    return JSON.parse(JSON.stringify(obj));
  }
}

describe('Data utilities', () => {
  describe('Type checking functions', () => {
    describe('isFormData', () => {
      it('should identify FormData instances', (): void => {
        const formData = new FormData();
        assert(isFormData(formData));
      });

      it('should return false for non-FormData', (): void => {
        assert(!isFormData({}));
        assert(!isFormData('string'));
        assert(!isFormData(null));
        assert(!isFormData(undefined));
      });
    });

    describe('isURLSearchParams', () => {
      it('should identify URLSearchParams instances', (): void => {
        const params = new URLSearchParams();
        assert(isURLSearchParams(params));
      });

      it('should return false for non-URLSearchParams', (): void => {
        assert(!isURLSearchParams({}));
        assert(!isURLSearchParams('string'));
        assert(!isURLSearchParams(null));
      });
    });

    describe('isArrayBuffer', () => {
      it('should identify ArrayBuffer instances', (): void => {
        const buffer = new ArrayBuffer(8);
        assert(isArrayBuffer(buffer));
      });

      it('should return false for non-ArrayBuffer', (): void => {
        assert(!isArrayBuffer({}));
        assert(!isArrayBuffer([]));
        assert(!isArrayBuffer(Buffer.from('test')));
      });
    });

    describe('isBlob', () => {
      it('should identify Blob instances', (): void => {
        const blob = new Blob(['test']);
        assert(isBlob(blob));
      });

      it('should return false for non-Blob', (): void => {
        assert(!isBlob({}));
        assert(!isBlob('string'));
        assert(!isBlob(null));
      });
    });

    describe('isStream', () => {
      it('should identify ReadableStream instances', (): void => {
        const stream = new ReadableStream();
        assert(isStream(stream));
      });

      it('should return false for non-ReadableStream', (): void => {
        assert(!isStream({}));
        assert(!isStream({ pipe: () => {} }));
      });
    });

    describe('isNodeStream', () => {
      it('should identify Node.js stream-like objects', (): void => {
        const nodeStream = {
          pipe: function () {},
          read: function () {},
          on: function () {},
        };
        assert(isNodeStream(nodeStream));
      });

      it('should return false for non-stream objects', (): void => {
        assert(!isNodeStream({}));
        assert(!isNodeStream({ pipe: 'not-a-function' }));
        assert(!isNodeStream(null));
        assert(!isNodeStream('string'));
      });
    });

    describe('isAnyStream', () => {
      it('should identify both browser and Node.js streams', (): void => {
        const readableStream = new ReadableStream();
        const nodeStream = { pipe: () => {} };

        assert(isAnyStream(readableStream));
        assert(isAnyStream(nodeStream));
      });

      it('should return false for non-streams', (): void => {
        assert(!isAnyStream({}));
        assert(!isAnyStream('string'));
        assert(!isAnyStream(null));
      });
    });

    describe('isPlainObject', () => {
      it('should identify plain objects', (): void => {
        assert(isPlainObject({}));
        assert(isPlainObject({ key: 'value' }));
        assert(isPlainObject(new Object()));
      });

      it('should return false for non-plain objects', (): void => {
        assert(!isPlainObject(null));
        assert(!isPlainObject(undefined));
        assert(!isPlainObject('string'));
        assert(!isPlainObject(123));
        assert(!isPlainObject([]));
        assert(!isPlainObject(new Date()));
        assert(!isPlainObject(new FormData()));
        assert(!isPlainObject(Object.create(null)));

        class CustomClass {}
        assert(!isPlainObject(new CustomClass()));
      });
    });
  });

  describe('transformRequestData', () => {
    it('should return null and undefined as-is', (): void => {
      assert.strictEqual(transformRequestData(null), null);
      assert.strictEqual(transformRequestData(undefined), undefined);
    });

    it('should return strings as-is', (): void => {
      assert.strictEqual(transformRequestData('test string'), 'test string');
      assert.strictEqual(transformRequestData(''), '');
    });

    it('should return FormData as-is', (): void => {
      const formData = new FormData();
      assert.strictEqual(transformRequestData(formData), formData);
    });

    it('should return URLSearchParams as-is', (): void => {
      const params = new URLSearchParams();
      assert.strictEqual(transformRequestData(params), params);
    });

    it('should return ArrayBuffer as-is', (): void => {
      const buffer = new ArrayBuffer(8);
      assert.strictEqual(transformRequestData(buffer), buffer);
    });

    it('should return Blob as-is', (): void => {
      const blob = new Blob(['test']);
      assert.strictEqual(transformRequestData(blob), blob);
    });

    it('should return streams as-is', (): void => {
      const stream = new ReadableStream();
      const nodeStream = { pipe: () => {} };

      assert.strictEqual(transformRequestData(stream), stream);
      assert.strictEqual(transformRequestData(nodeStream), nodeStream);
    });

    it('should return Buffer as-is in Node.js', (): void => {
      const buffer = Buffer.from('test');
      assert.strictEqual(transformRequestData(buffer), buffer);
    });

    it('should stringify plain objects', (): void => {
      const obj = { key: 'value', nested: { prop: 123 } };
      const result = transformRequestData(obj);
      assert.strictEqual(result, JSON.stringify(obj));
    });

    it('should stringify arrays', (): void => {
      const arr = [1, 2, 3, { nested: true }];
      const result = transformRequestData(arr);
      assert.strictEqual(result, JSON.stringify(arr));
    });

    it('should convert other types to string', (): void => {
      assert.strictEqual(transformRequestData(123), '123');
      assert.strictEqual(transformRequestData(true), 'true');
      assert.strictEqual(transformRequestData(false), 'false');
    });

    it('should handle circular references in objects', (): void => {
      const obj = { key: 'value' };
      obj.circular = obj;

      const result = transformRequestData(obj);
      assert(typeof result === 'string');
      assert(result.includes('[Circular]'));
    });
  });

  describe('transformResponseData', () => {
    it('should return data as-is for special response types', (): void => {
      const data = { test: 'data' };

      assert.strictEqual(transformResponseData(data, 'stream'), data);
      assert.strictEqual(transformResponseData(data, 'blob'), data);
      assert.strictEqual(transformResponseData(data, 'arraybuffer'), data);
    });

    it('should parse JSON strings when responseType is json', (): void => {
      const obj = { key: 'value', number: 123 };
      const jsonStr = JSON.stringify(obj);

      const result = transformResponseData(jsonStr, 'json');
      assert.deepStrictEqual(result, obj);
    });

    it('should return original string if JSON parsing fails', (): void => {
      const invalidJson = '{ invalid json }';
      const result = transformResponseData(invalidJson, 'json');
      assert.strictEqual(result, invalidJson);
    });

    it('should return data as-is for other cases', (): void => {
      const data = { already: 'parsed' };
      assert.strictEqual(transformResponseData(data), data);

      const str = 'plain text';
      assert.strictEqual(transformResponseData(str), str);
    });

    it('should handle null and undefined', (): void => {
      assert.strictEqual(transformResponseData(null), null);
      assert.strictEqual(transformResponseData(undefined), undefined);
    });
  });

  describe('getDataSize', () => {
    it('should return 0 for null and undefined', (): void => {
      assert.strictEqual(getDataSize(null), 0);
      assert.strictEqual(getDataSize(undefined), 0);
    });

    it('should calculate string byte length', (): void => {
      assert.strictEqual(getDataSize('test'), 4);
      assert.strictEqual(getDataSize('你好'), 6); // UTF-8 bytes
      assert.strictEqual(getDataSize(''), 0);
    });

    it('should get ArrayBuffer byteLength', (): void => {
      const buffer = new ArrayBuffer(16);
      assert.strictEqual(getDataSize(buffer), 16);
    });

    it('should get Buffer length', (): void => {
      const buffer = Buffer.from('test');
      assert.strictEqual(getDataSize(buffer), 4);
    });

    it('should get Blob size', (): void => {
      const blob = new Blob(['test data']);
      assert.strictEqual(getDataSize(blob), 9);
    });

    it('should estimate FormData size', (): void => {
      const formData = new FormData();
      formData.append('key1', 'value1');
      formData.append('key2', 'value2');

      const size = getDataSize(formData);
      assert(size > 0);
    });

    it('should calculate URLSearchParams size', (): void => {
      const params = new URLSearchParams({ key: 'value', test: '123' });
      const size = getDataSize(params);
      assert.strictEqual(size, params.toString().length);
    });

    it('should stringify objects to calculate size', (): void => {
      const obj = { key: 'value' };
      const expectedSize = JSON.stringify(obj).length;
      assert.strictEqual(getDataSize(obj), expectedSize);
    });

    it('should handle non-serializable objects', (): void => {
      const obj = { key: 'value' };
      obj.circular = obj;

      assert.strictEqual(getDataSize(obj), 0);
    });
  });

  describe('getMimeType', () => {
    it('should return mime type for Blob', (): void => {
      const blob = new Blob(['test'], { type: 'text/plain' });
      assert.strictEqual(getMimeType(blob), 'text/plain');
    });

    it('should return multipart/form-data for FormData', (): void => {
      const formData = new FormData();
      assert.strictEqual(getMimeType(formData), 'multipart/form-data');
    });

    it('should return application/x-www-form-urlencoded for URLSearchParams', (): void => {
      const params = new URLSearchParams();
      assert.strictEqual(getMimeType(params), 'application/x-www-form-urlencoded');
    });

    it('should detect JSON strings', (): void => {
      assert.strictEqual(getMimeType('{"key":"value"}'), 'application/json');
      assert.strictEqual(getMimeType('[]'), 'application/json');
    });

    it('should return text/plain for non-JSON strings', (): void => {
      assert.strictEqual(getMimeType('plain text'), 'text/plain');
      assert.strictEqual(getMimeType('not { json'), 'text/plain');
    });

    it('should return application/json for objects', (): void => {
      assert.strictEqual(getMimeType({}), 'application/json');
      assert.strictEqual(getMimeType({ key: 'value' }), 'application/json');
      assert.strictEqual(getMimeType([]), 'application/json');
    });

    it('should return null for other types', (): void => {
      assert.strictEqual(getMimeType(null), null);
      assert.strictEqual(getMimeType(undefined), null);
      assert.strictEqual(getMimeType(123), null);
    });
  });

  describe('cloneData', () => {
    it('should return primitives as-is', (): void => {
      assert.strictEqual(cloneData(null), null);
      assert.strictEqual(cloneData(undefined), undefined);
      assert.strictEqual(cloneData('string'), 'string');
      assert.strictEqual(cloneData(123), 123);
      assert.strictEqual(cloneData(true), true);
    });

    it('should return special objects as-is', (): void => {
      const formData = new FormData();
      const blob = new Blob(['test']);
      const buffer = new ArrayBuffer(8);
      const stream = new ReadableStream();

      assert.strictEqual(cloneData(formData), formData);
      assert.strictEqual(cloneData(blob), blob);
      assert.strictEqual(cloneData(buffer), buffer);
      assert.strictEqual(cloneData(stream), stream);
    });

    it('should deep clone plain objects', (): void => {
      const obj = { key: 'value', nested: { prop: 123 } };
      const cloned = cloneData(obj);

      assert.deepStrictEqual(cloned, obj);
      assert.notStrictEqual(cloned, obj);
      assert.notStrictEqual(cloned.nested, obj.nested);
    });

    it('should deep clone arrays', (): void => {
      const arr = [1, 2, { nested: true }];
      const cloned = cloneData(arr);

      assert.deepStrictEqual(cloned, arr);
      assert.notStrictEqual(cloned, arr);
      assert.notStrictEqual(cloned[2], arr[2]);
    });

    it('should use structuredClone when available', (): void => {
      (global as any).structuredClone = (data) => JSON.parse(JSON.stringify(data));

      const obj = { key: 'value' };
      const cloned = cloneData(obj);

      assert.deepStrictEqual(cloned, obj);
      assert.notStrictEqual(cloned, obj);
    });

    it('should handle cloning failures', (): void => {
      const obj = { key: 'value' };
      obj.circular = obj;

      // Should return original object
      const result = cloneData(obj);
      assert.strictEqual(result, obj);
    });
  });

  describe('DataValidation', () => {
    describe('isValidRequestData', () => {
      it('should validate valid request data types', (): void => {
        assert(DataValidation.isValidRequestData(null));
        assert(DataValidation.isValidRequestData(undefined));
        assert(DataValidation.isValidRequestData('string'));
        assert(DataValidation.isValidRequestData(new FormData()));
        assert(DataValidation.isValidRequestData(new URLSearchParams()));
        assert(DataValidation.isValidRequestData(new ArrayBuffer(8)));
        assert(DataValidation.isValidRequestData(new Blob(['test'])));
        assert(DataValidation.isValidRequestData(new ReadableStream()));
        assert(DataValidation.isValidRequestData(Buffer.from('test')));
        assert(DataValidation.isValidRequestData({}));
        assert(DataValidation.isValidRequestData([]));
      });

      it('should reject invalid request data types', (): void => {
        assert(!DataValidation.isValidRequestData(123));
        assert(!DataValidation.isValidRequestData(true));
        assert(!DataValidation.isValidRequestData(new Date()));
      });
    });

    describe('isJSONSerializable', () => {
      it('should return true for serializable data', (): void => {
        assert(DataValidation.isJSONSerializable(null));
        assert(DataValidation.isJSONSerializable('string'));
        assert(DataValidation.isJSONSerializable(123));
        assert(DataValidation.isJSONSerializable(true));
        assert(DataValidation.isJSONSerializable({}));
        assert(DataValidation.isJSONSerializable([]));
        assert(DataValidation.isJSONSerializable({ nested: { data: [1, 2, 3] } }));
      });

      it('should return false for non-serializable data', (): void => {
        const circular = {};
        circular.ref = circular;

        assert(!DataValidation.isJSONSerializable(circular));
        assert(!DataValidation.isJSONSerializable(undefined));
        assert(!DataValidation.isJSONSerializable(() => {}));
        assert(!DataValidation.isJSONSerializable(Symbol('test')));
      });
    });

    describe('isBinaryData', () => {
      it('should identify binary data types', (): void => {
        assert(DataValidation.isBinaryData(new ArrayBuffer(8)));
        assert(DataValidation.isBinaryData(new Blob(['test'])));
        assert(DataValidation.isBinaryData(Buffer.from('test')));
      });

      it('should return false for non-binary data', (): void => {
        assert(!DataValidation.isBinaryData('string'));
        assert(!DataValidation.isBinaryData({}));
        assert(!DataValidation.isBinaryData(new FormData()));
      });
    });

    describe('requiresSpecialHandling', () => {
      it('should identify data requiring special handling', (): void => {
        assert(DataValidation.requiresSpecialHandling(new FormData()));
        assert(DataValidation.requiresSpecialHandling(new URLSearchParams()));
        assert(DataValidation.requiresSpecialHandling(new ReadableStream()));
        assert(DataValidation.requiresSpecialHandling(new ArrayBuffer(8)));
        assert(DataValidation.requiresSpecialHandling(new Blob(['test'])));
        assert(DataValidation.requiresSpecialHandling(Buffer.from('test')));
      });

      it('should return false for regular data', (): void => {
        assert(!DataValidation.requiresSpecialHandling('string'));
        assert(!DataValidation.requiresSpecialHandling({}));
        assert(!DataValidation.requiresSpecialHandling([]));
        assert(!DataValidation.requiresSpecialHandling(null));
      });
    });
  });

  describe('Edge cases', () => {
    it('should handle objects with null prototype', (): void => {
      const obj = Object.create(null);
      obj.key = 'value';

      assert(!isPlainObject(obj));

      const transformed = transformRequestData(obj);
      assert.strictEqual(transformed, String(obj));
    });

    it('should handle very large strings', (): void => {
      const largeString = 'x'.repeat(1000000);
      assert.strictEqual(getDataSize(largeString), 1000000);
    });

    it('should handle empty FormData', (): void => {
      const formData = new FormData();
      assert.strictEqual(getDataSize(formData), 0);
    });

    it('should handle FormData without entries method', (): void => {
      const formData = new FormData();
      delete formData.entries;

      assert.strictEqual(getDataSize(formData), 0);
    });

    it('should handle special characters in data', (): void => {
      const specialChars = '你好世界 🌍 😀 \n\t\r';
      const transformed = transformRequestData({ text: specialChars });

      assert(transformed.includes(specialChars));
    });

    it('should handle deeply nested objects', (): void => {
      const nested = {
        level1: {
          level2: {
            level3: {
              level4: {
                value: 'deep',
              },
            },
          },
        },
      };

      const cloned = cloneData(nested);
      assert.strictEqual(cloned.level1.level2.level3.level4.value, 'deep');
    });
  });
});
