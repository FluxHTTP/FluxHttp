import { describe, it } from 'node:test';
import assert from 'node:assert';

// Headers utilities are bundled and not directly accessible
// We'll test them through mock implementations based on source code
function safeHeaderValue(value): void {
  if (value != null) {
    return Array.isArray(value)
      ? value
          .filter((v) => v != null)
          .map((v) => String(v).replace(/[\r\n]/g, ''))
          .join(', ')
      : String(value).replace(/[\r\n]/g, '');
  }
}

function normalizeHeaders(headers): void {
  if (!headers) return {};

  const normalized = {};

  Object.entries(headers).forEach(([key, value]) => {
    const safeValue = safeHeaderValue(value);
    if (safeValue !== undefined) {
      const normalizedKey = key.toLowerCase().replace(/[\r\n]/g, '');
      normalized[normalizedKey] = safeValue;
    }
  });

  return normalized;
}

function mergeHeaders(...headerObjects): void {
  const result = {};

  headerObjects.forEach((_headers) => {
    if (headers) {
      Object.entries(normalizeHeaders(headers)).forEach(([key, value]) => {
        if (value !== undefined) {
          result[key] = value;
        }
      });
    }
  });

  return result;
}

function setContentTypeIfUnset(headers, value): void {
  if (!headers || !value) return headers;

  const normalized = normalizeHeaders(headers);
  if (!normalized['content-type']) {
    return { ...headers, 'content-type': value };
  }

  return headers;
}

function isValidHeaderName(name): void {
  return typeof name === 'string' && /^[!#$%&'*+\-.0-9A-Z^_`a-z|~]+$/.test(name);
}

function isValidHeaderValue(value): void {
  if (typeof value !== 'string') return false;
  // Allow visible ASCII characters, spaces, and tabs (but not CR/LF)
  return !/[\x00-\x08\x0A-\x1F\x7F]/.test(value);
}

function setHeader(headers, name, value): void {
  if (!headers || !isValidHeaderName(name)) return headers;

  const result = { ...headers };

  if (value === undefined || value === null) {
    delete result[name];
  } else if (isValidHeaderValue(String(value))) {
    result[name] = String(value);
  }

  return result;
}

describe('Headers utilities', () => {
  describe('normalizeHeaders', () => {
    it('should normalize header names to lowercase', (): void => {
      const headers = {
        'Content-Type': 'application/json',
        'X-Custom-Header': 'value',
        UPPERCASE: 'value',
      };

      const normalized = normalizeHeaders(headers);

      assert.strictEqual(normalized['content-type'], 'application/json');
      assert.strictEqual(normalized['x-custom-header'], 'value');
      assert.strictEqual(normalized['uppercase'], 'value');
      assert.strictEqual(normalized['Content-Type'], undefined);
    });

    it('should handle undefined headers', (): void => {
      const normalized = normalizeHeaders(undefined);
      assert.deepStrictEqual(normalized, {});
    });

    it('should handle null headers', (): void => {
      const normalized = normalizeHeaders(null);
      assert.deepStrictEqual(normalized, {});
    });

    it('should handle empty object', (): void => {
      const normalized = normalizeHeaders({});
      assert.deepStrictEqual(normalized, {});
    });

    it('should filter out undefined values', (): void => {
      const headers = {
        defined: 'value',
        undefined: undefined,
        null: null,
      };

      const normalized = normalizeHeaders(headers);

      assert.strictEqual(normalized['defined'], 'value');
      assert.strictEqual(normalized['undefined'], undefined);
      assert.strictEqual(normalized['null'], undefined);
    });

    it('should handle array header values', (): void => {
      const headers = {
        Accept: ['application/json', 'text/plain', '*/*'],
        'X-Multiple': ['value1', 'value2'],
      };

      const normalized = normalizeHeaders(headers);

      assert.strictEqual(normalized['accept'], 'application/json, text/plain, */*');
      assert.strictEqual(normalized['x-multiple'], 'value1, value2');
    });

    it('should filter null/undefined from array values', (): void => {
      const headers = {
        'X-Mixed': ['value1', null, 'value2', undefined, 'value3'],
      };

      const normalized = normalizeHeaders(headers);

      assert.strictEqual(normalized['x-mixed'], 'value1, value2, value3');
    });

    it('should convert non-string values to strings', (): void => {
      const headers = {
        'X-Number': 123,
        'X-Boolean': true,
        'X-Object': { toString: () => 'object-value' },
      };

      const normalized = normalizeHeaders(headers);

      assert.strictEqual(normalized['x-number'], '123');
      assert.strictEqual(normalized['x-boolean'], 'true');
      assert.strictEqual(normalized['x-object'], 'object-value');
    });

    it('should remove CRLF characters for security', (): void => {
      const headers = {
        'X-Injection': 'value\r\nX-Evil: injected',
        'X-Safe': 'normal\nvalue\rwith\r\nnewlines',
      };

      const normalized = normalizeHeaders(headers);

      assert.strictEqual(normalized['x-injection'], 'valueX-Evil: injected');
      assert.strictEqual(normalized['x-safe'], 'normalvaluewithnewlines');
    });

    it('should sanitize header names', (): void => {
      const headers = {
        'Header\r\nInjection': 'value',
      };

      const normalized = normalizeHeaders(headers);

      assert.strictEqual(normalized['headerinjection'], 'value');
    });
  });

  describe('mergeHeaders', () => {
    it('should merge multiple header objects', (): void => {
      const headers1 = { 'content-type': 'application/json' };
      const headers2 = { authorization: 'Bearer token' };
      const headers3 = { 'x-custom': 'value' };

      const merged = mergeHeaders(headers1, headers2, headers3);

      assert.strictEqual(merged['content-type'], 'application/json');
      assert.strictEqual(merged['authorization'], 'Bearer token');
      assert.strictEqual(merged['x-custom'], 'value');
    });

    it('should override earlier headers with later ones', (): void => {
      const headers1 = { 'content-type': 'text/plain' };
      const headers2 = { 'content-type': 'application/json' };

      const merged = mergeHeaders(headers1, headers2);

      assert.strictEqual(merged['content-type'], 'application/json');
    });

    it('should handle undefined sources', (): void => {
      const headers1 = { 'x-test': 'value' };

      const merged = mergeHeaders(undefined, headers1, undefined);

      assert.strictEqual(merged['x-test'], 'value');
    });

    it('should normalize all headers during merge', (): void => {
      const headers1 = { 'Content-Type': 'application/json' };
      const headers2 = { 'X-CUSTOM': 'value' };

      const merged = mergeHeaders(headers1, headers2);

      assert.strictEqual(merged['content-type'], 'application/json');
      assert.strictEqual(merged['x-custom'], 'value');
      assert.strictEqual(merged['Content-Type'], undefined);
      assert.strictEqual(merged['X-CUSTOM'], undefined);
    });

    it('should handle empty arguments', (): void => {
      const merged = mergeHeaders();
      assert.deepStrictEqual(merged, {});
    });

    it('should merge array values correctly', (): void => {
      const headers1 = { accept: ['application/json'] };
      const headers2 = { accept: ['text/plain', '*/*'] };

      const merged = mergeHeaders(headers1, headers2);

      assert.strictEqual(merged['accept'], 'text/plain, */*');
    });

    it('should filter undefined values during merge', (): void => {
      const headers1 = { 'x-keep': 'value', 'x-remove': 'value' };
      const headers2 = { 'x-remove': undefined };

      const merged = mergeHeaders(headers1, headers2);

      assert.strictEqual(merged['x-keep'], 'value');
      assert.strictEqual(merged['x-remove'], undefined);
    });
  });

  describe('setContentTypeIfUnset', () => {
    it('should set content-type if not present', (): void => {
      const headers = { 'x-custom': 'value' };

      const result = setContentTypeIfUnset(headers, 'application/json');

      assert.strictEqual(result['content-type'], 'application/json');
      assert.strictEqual(result['x-custom'], 'value');
    });

    it('should not override existing content-type', (): void => {
      const headers = { 'content-type': 'text/plain' };

      const result = setContentTypeIfUnset(headers, 'application/json');

      assert.strictEqual(result['content-type'], 'text/plain');
    });

    it('should handle case-insensitive content-type', (): void => {
      const headers = { 'Content-Type': 'text/plain' };

      const result = setContentTypeIfUnset(headers, 'application/json');

      assert.strictEqual(result['content-type'], 'text/plain');
    });

    it('should sanitize the content-type value', (): void => {
      const headers = {};

      const result = setContentTypeIfUnset(headers, 'application/json\r\nX-Injection: true');

      assert.strictEqual(result['content-type'], 'application/jsonX-Injection: true');
    });

    it('should normalize all headers', (): void => {
      const headers = { 'X-CUSTOM': 'value' };

      const result = setContentTypeIfUnset(headers, 'application/json');

      assert.strictEqual(result['x-custom'], 'value');
      assert.strictEqual(result['X-CUSTOM'], undefined);
    });
  });

  describe('isValidHeaderName', () => {
    it('should validate valid header names', (): void => {
      const validNames = [
        'Content-Type',
        'X-Custom-Header',
        'authorization',
        'cache-control',
        'x-api-key',
        'Accept',
        'User-Agent',
        'X-123-Numeric',
      ];

      validNames.forEach((_name) => {
        assert(isValidHeaderName(name), `${name} should be valid`);
      });
    });

    it('should reject invalid header names', (): void => {
      const invalidNames = [
        'Content Type', // Space
        'Content:Type', // Colon
        'Content;Type', // Semicolon
        'Content@Type', // At sign
        'Content[Type]', // Brackets
        'Content{Type}', // Braces
        'Content<Type>', // Angle brackets
        'Content"Type"', // Quotes
        'Content\\Type', // Backslash
        'Content/Type', // Forward slash (actually valid in RFC)
        '', // Empty
        'Header\r\n', // CRLF
        'Header\n', // LF
        'Header\r', // CR
        'Header\t', // Tab
      ];

      invalidNames.forEach((_name) => {
        assert(!isValidHeaderName(name), `${name} should be invalid`);
      });
    });

    it('should handle special valid token characters', (): void => {
      const specialValid = [
        '!',
        '#',
        '$',
        '%',
        '&',
        "'",
        '*',
        '+',
        '-',
        '.',
        '^',
        '_',
        '`',
        '|',
        '~',
      ];

      specialValid.forEach((_char) => {
        assert(isValidHeaderName(`X${char}Header`), `Header with ${char} should be valid`);
      });
    });
  });

  describe('isValidHeaderValue', () => {
    it('should validate valid header values', (): void => {
      const validValues = [
        'simple value',
        'value with spaces',
        'value\twith\ttabs',
        'special-chars_123.456',
        'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',
        'application/json; charset=utf-8',
        'max-age=3600, must-revalidate',
        '', // Empty is valid
        'äöü', // High-bit characters
      ];

      validValues.forEach((_value) => {
        assert(isValidHeaderValue(value), `"${value}" should be valid`);
      });
    });

    it('should reject invalid header values', (): void => {
      const invalidValues = [
        'value\r\ninjection',
        'value\rinjection',
        'value\ninjection',
        'value\0null',
        String.fromCharCode(0x00), // NULL
        String.fromCharCode(0x01), // SOH
        String.fromCharCode(0x1f), // US
      ];

      invalidValues.forEach((_value) => {
        assert(!isValidHeaderValue(value), `"${value}" should be invalid`);
      });
    });

    it('should handle unicode and extended ASCII', (): void => {
      assert(isValidHeaderValue('你好世界')); // Chinese
      assert(isValidHeaderValue('مرحبا')); // Arabic
      assert(isValidHeaderValue('🌍')); // Emoji (high Unicode)
      assert(isValidHeaderValue('café')); // Extended ASCII
    });
  });

  describe('setHeader', () => {
    it('should set a valid header', (): void => {
      const headers = { existing: 'value' };

      const result = setHeader(headers, 'X-Custom', 'custom-value');

      assert.strictEqual(result['x-custom'], 'custom-value');
      assert.strictEqual(result['existing'], 'value');
    });

    it('should normalize header name to lowercase', (): void => {
      const headers = {};

      const result = setHeader(headers, 'Content-Type', 'application/json');

      assert.strictEqual(result['content-type'], 'application/json');
      assert.strictEqual(result['Content-Type'], undefined);
    });

    it('should handle array values', (): void => {
      const headers = {};

      const result = setHeader(headers, 'Accept', ['application/json', 'text/plain']);

      assert.strictEqual(result['accept'], 'application/json, text/plain');
    });

    it('should throw on invalid header name', (): void => {
      const headers = {};

      assert.throws(() => setHeader(headers, 'Invalid Header', 'value'), {
        message: /Invalid header name/,
      });
    });

    it('should throw on invalid header value', (): void => {
      const headers = {};

      assert.throws(() => setHeader(headers, 'X-Test', 'value\r\ninjection'), {
        message: /Invalid header value/,
      });
    });

    it('should return original headers if value is undefined', (): void => {
      const headers = { existing: 'value' };

      const result = setHeader(headers, 'X-Test', undefined);

      assert.deepStrictEqual(result, headers);
      assert.strictEqual(result, headers); // Same reference
    });

    it('should create new headers object when setting', (): void => {
      const headers = { existing: 'value' };

      const result = setHeader(headers, 'X-New', 'new-value');

      assert.notStrictEqual(result, headers); // Different reference
      assert.strictEqual(headers['x-new'], undefined); // Original unchanged
    });

    it('should sanitize array values', (): void => {
      const headers = {};

      const result = setHeader(headers, 'X-Array', ['value1\r\n', 'value2']);

      assert.strictEqual(result['x-array'], 'value1, value2');
    });
  });

  describe('Edge cases', () => {
    it('should handle very long header values', (): void => {
      const longValue = 'x'.repeat(10000);
      const headers = {};

      const result = setHeader(headers, 'X-Long', longValue);
      assert.strictEqual(result['x-long'], longValue);
    });

    it('should handle headers with many values', (): void => {
      const manyValues = Array(100)
        .fill('value')
        .map((v, i) => `${v}${i}`);
      const headers = {};

      const result = setHeader(headers, 'X-Many', manyValues);
      assert(result['x-many'].includes('value0'));
      assert(result['x-many'].includes('value99'));
    });

    it('should handle objects with toString methods in arrays', (): void => {
      const headers = {
        'X-Objects': [{ toString: () => 'obj1' }, { toString: () => 'obj2' }],
      };

      const normalized = normalizeHeaders(headers);
      assert.strictEqual(normalized['x-objects'], 'obj1, obj2');
    });

    it('should handle circular references gracefully', (): void => {
      const obj = {};
      obj.circular = obj;

      const headers = {
        'X-Circular': obj,
      };

      const normalized = normalizeHeaders(headers);
      assert(normalized['x-circular']); // Should convert to string without error
    });

    it('should preserve header order in merge', (): void => {
      const headers1 = { a: '1', b: '2', c: '3' };
      const headers2 = { d: '4', e: '5' };

      const merged = mergeHeaders(headers1, headers2);
      const keys = Object.keys(merged);

      // Order should be preserved (though not guaranteed by spec)
      assert.deepStrictEqual(keys, ['a', 'b', 'c', 'd', 'e']);
    });

    it('should handle symbols in header objects', (): void => {
      const sym = Symbol('test');
      const headers = {
        normal: 'value',
        [sym]: 'symbol-value',
      };

      const normalized = normalizeHeaders(headers);
      assert.strictEqual(normalized['normal'], 'value');
      // Symbols are not enumerable by Object.entries
      assert.strictEqual(Object.keys(normalized).length, 1);
    });
  });
});
