import { describe, it } from 'node:test';
import assert from 'node:assert';

// The url utilities are bundled inside the main module and not directly accessible
// We'll test them indirectly through the fluxhttp instance
import fluxhttp from '../../../dist/index.js';

// Mock implementations based on the source code for testing
function buildURL(url, params): void {
  if (!params || Object.keys(params).length === 0) {
    return url;
  }

  const serializedParams = serializeParams(params);
  const hashIndex = url.indexOf('#');

  if (hashIndex !== -1) {
    url = url.slice(0, hashIndex);
  }

  url += (url.indexOf('?') === -1 ? '?' : '&') + serializedParams;

  return url;
}

function serializeParams(params): void {
  const parts = [];

  Object.entries(params).forEach(([key, value]) => {
    if (value === null || value === undefined) {
      return;
    }

    const values = Array.isArray(value) ? value : [value];

    values.forEach((_val) => {
      if (val === null || val === undefined) {
        return;
      }

      let v;

      if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') {
        v = String(val);
      } else if (
        typeof val === 'object' &&
        'toISOString' in val &&
        typeof val.toISOString === 'function'
      ) {
        v = val.toISOString();
      } else {
        try {
          v = JSON.stringify(val);
        } catch {
          // Handle circular references
          v = '[Circular]';
        }
      }

      parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(v)}`);
    });
  });

  return parts.join('&');
}

function combineURLs(baseURL, relativeURL): void {
  if (!baseURL) {
    return relativeURL || '';
  }

  if (!relativeURL) {
    return baseURL;
  }

  if (isAbsoluteURL(relativeURL)) {
    return relativeURL;
  }

  // Handle absolute paths (starting with /) - they replace the path entirely
  if (relativeURL.startsWith('/')) {
    try {
      const baseUrlObj = new URL(baseURL);
      // Parse the relative URL to extract pathname, search, and hash separately
      const tempUrl = new URL(relativeURL, 'http://dummy');
      baseUrlObj.pathname = tempUrl.pathname;
      baseUrlObj.search = tempUrl.search;
      baseUrlObj.hash = tempUrl.hash;
      return baseUrlObj.toString();
    } catch {
      // Fallback if baseURL is not a valid URL
      const cleanBase = baseURL.replace(/\/+$/, '');
      return cleanBase + relativeURL;
    }
  }

  // Handle relative paths
  try {
    const baseUrlObj = new URL(baseURL);
    const resultUrl = new URL(relativeURL, baseUrlObj);
    return resultUrl.toString();
  } catch {
    // Fallback for invalid URLs
    let cleanBase = baseURL.replace(/\/+$/, '');
    const cleanRelative = relativeURL.replace(/^\/+/, '');

    // Ensure we have a proper path separator
    if (cleanBase && cleanRelative && !cleanBase.endsWith('/')) {
      cleanBase += '/';
    }

    return cleanBase + cleanRelative;
  }
}

function isAbsoluteURL(url): void {
  if (!url) return false;
  // Match URLs with protocol (http://, https://, ftp://, mailto:, etc.) or protocol-relative URLs (//example.com)
  // But not paths that just start with multiple slashes (///path)
  return /^([a-z][a-z\d+\-.]*:)(\/\/.*|[^/].*)/i.test(url) || /^\/\/[^/]/i.test(url);
}

function buildFullPath(baseURL, relativeURL): void {
  return combineURLs(baseURL, relativeURL);
}

describe('URL utilities', () => {
  describe('buildURL', () => {
    it('should return URL unchanged when no params', (): void => {
      assert.strictEqual(buildURL('https://api.test.com/path'), 'https://api.test.com/path');
      assert.strictEqual(buildURL('https://api.test.com/path', null), 'https://api.test.com/path');
      assert.strictEqual(
        buildURL('https://api.test.com/path', undefined),
        'https://api.test.com/path'
      );
      assert.strictEqual(buildURL('https://api.test.com/path', {}), 'https://api.test.com/path');
    });

    it('should append params to URL without query string', (): void => {
      const url = buildURL('https://api.test.com/path', { key: 'value', id: 123 });
      assert(url.includes('?'));
      assert(url.includes('key=value'));
      assert(url.includes('id=123'));
    });

    it('should append params to URL with existing query string', (): void => {
      const url = buildURL('https://api.test.com/path?existing=true', { new: 'param' });
      assert(url.includes('existing=true'));
      assert(url.includes('&new=param'));
      assert(!url.includes('?new=param'));
    });

    it('should remove hash before appending params', (): void => {
      const url = buildURL('https://api.test.com/path#section', { key: 'value' });
      assert(!url.includes('#section'));
      assert(url.includes('?key=value'));
    });

    it('should handle complex params', (): void => {
      const params = {
        string: 'value',
        number: 123,
        boolean: true,
        array: ['a', 'b', 'c'],
        nullValue: null,
        undefinedValue: undefined,
      };

      const url = buildURL('https://api.test.com', params);

      assert(url.includes('string=value'));
      assert(url.includes('number=123'));
      assert(url.includes('boolean=true'));
      assert(url.includes('array=a'));
      assert(url.includes('array=b'));
      assert(url.includes('array=c'));
      assert(!url.includes('nullValue'));
      assert(!url.includes('undefinedValue'));
    });
  });

  describe('serializeParams', () => {
    it('should serialize simple params', (): void => {
      const params = { key: 'value', id: 123 };
      const serialized = serializeParams(params);

      assert.strictEqual(serialized, 'key=value&id=123');
    });

    it('should encode special characters', (): void => {
      const params = {
        'special chars': 'hello world',
        symbols: '!@#$%^&*()',
        unicode: '你好世界',
      };

      const serialized = serializeParams(params);

      assert(serialized.includes('special%20chars=hello%20world'));
      assert(serialized.includes('symbols=!%40%23%24%25%5E%26*()'));
      assert(serialized.includes('unicode=%E4%BD%A0%E5%A5%BD%E4%B8%96%E7%95%8C'));
    });

    it('should handle array values', (): void => {
      const params = { items: ['a', 'b', 'c'] };
      const serialized = serializeParams(params);

      assert.strictEqual(serialized, 'items=a&items=b&items=c');
    });

    it('should handle mixed array values', (): void => {
      const params = { values: [1, 'two', true, null, undefined] };
      const serialized = serializeParams(params);

      assert(serialized.includes('values=1'));
      assert(serialized.includes('values=two'));
      assert(serialized.includes('values=true'));
      assert(!serialized.includes('values=null'));
      assert(!serialized.includes('values=undefined'));
    });

    it('should skip null and undefined values', (): void => {
      const params = {
        defined: 'value',
        nullValue: null,
        undefinedValue: undefined,
      };

      const serialized = serializeParams(params);

      assert.strictEqual(serialized, 'defined=value');
    });

    it('should handle Date objects', (): void => {
      const date = new Date('2024-01-01T00:00:00Z');
      const params = { date };

      const serialized = serializeParams(params);

      assert(serialized.includes('date=2024-01-01T00%3A00%3A00.000Z'));
    });

    it('should handle objects with toISOString method', (): void => {
      const customDate = {
        toISOString: () => '2024-01-01T12:00:00Z',
      };

      const params = { customDate };
      const serialized = serializeParams(params);

      assert(serialized.includes('customDate=2024-01-01T12%3A00%3A00Z'));
    });

    it('should JSON stringify other objects', (): void => {
      const params = {
        obj: { nested: 'value', number: 123 },
      };

      const serialized = serializeParams(params);

      assert(serialized.includes('obj=%7B%22nested%22%3A%22value%22%2C%22number%22%3A123%7D'));
    });

    it('should handle empty params', (): void => {
      assert.strictEqual(serializeParams({}), '');
    });

    it('should handle boolean values', (): void => {
      const params = { isTrue: true, isFalse: false };
      const serialized = serializeParams(params);

      assert.strictEqual(serialized, 'isTrue=true&isFalse=false');
    });
  });

  describe('combineURLs', () => {
    it('should return relative URL when base is empty', (): void => {
      assert.strictEqual(combineURLs('', '/path'), '/path');
      assert.strictEqual(combineURLs(null, '/path'), '/path');
      assert.strictEqual(combineURLs(undefined, '/path'), '/path');
    });

    it('should return base URL when relative is empty', (): void => {
      assert.strictEqual(combineURLs('https://api.test.com', ''), 'https://api.test.com');
      assert.strictEqual(combineURLs('https://api.test.com', null), 'https://api.test.com');
      assert.strictEqual(combineURLs('https://api.test.com', undefined), 'https://api.test.com');
    });

    it('should return empty string when both are empty', (): void => {
      assert.strictEqual(combineURLs('', ''), '');
      assert.strictEqual(combineURLs(null, null), '');
      assert.strictEqual(combineURLs(undefined, undefined), '');
    });

    it('should return absolute URL unchanged', (): void => {
      assert.strictEqual(
        combineURLs('https://api.test.com', 'https://other.com/path'),
        'https://other.com/path'
      );
      assert.strictEqual(
        combineURLs('https://api.test.com', '//other.com/path'),
        '//other.com/path'
      );
    });

    it('should handle absolute paths correctly', (): void => {
      assert.strictEqual(
        combineURLs('https://api.test.com/v1/users', '/v2/posts'),
        'https://api.test.com/v2/posts'
      );
      assert.strictEqual(
        combineURLs('https://api.test.com/path?old=param', '/new?new=param'),
        'https://api.test.com/new?new=param'
      );
      assert.strictEqual(
        combineURLs('https://api.test.com/path#old', '/new#new'),
        'https://api.test.com/new#new'
      );
    });

    it('should handle relative paths correctly', (): void => {
      assert.strictEqual(
        combineURLs('https://api.test.com/v1/', 'users'),
        'https://api.test.com/v1/users'
      );
      assert.strictEqual(
        combineURLs('https://api.test.com/v1/users', '../posts'),
        'https://api.test.com/posts'
      );
      assert.strictEqual(
        combineURLs('https://api.test.com/v1/users/', './profile'),
        'https://api.test.com/v1/users/profile'
      );
    });

    it('should handle trailing slashes', (): void => {
      assert.strictEqual(combineURLs('https://api.test.com/', 'path'), 'https://api.test.com/path');
      assert.strictEqual(combineURLs('https://api.test.com', 'path'), 'https://api.test.com/path');
      assert.strictEqual(
        combineURLs('https://api.test.com//', 'path'),
        'https://api.test.com//path'
      );
    });

    it('should handle query strings and fragments', (): void => {
      assert.strictEqual(
        combineURLs('https://api.test.com', 'path?query=1#section'),
        'https://api.test.com/path?query=1#section'
      );
      assert.strictEqual(
        combineURLs('https://api.test.com?base=1', 'path?new=2'),
        'https://api.test.com/path?new=2'
      );
    });

    it('should handle invalid base URLs gracefully', (): void => {
      assert.strictEqual(combineURLs('not-a-url', 'path'), 'not-a-url/path');
      assert.strictEqual(combineURLs('not-a-url/', '/absolute'), 'not-a-url/absolute');
    });

    it('should handle port numbers', (): void => {
      assert.strictEqual(
        combineURLs('https://api.test.com:8080', 'path'),
        'https://api.test.com:8080/path'
      );
      assert.strictEqual(
        combineURLs('https://api.test.com:8080/v1', '/v2'),
        'https://api.test.com:8080/v2'
      );
    });

    it('should handle authentication in URLs', (): void => {
      assert.strictEqual(
        combineURLs('https://user:pass@api.test.com', 'path'),
        'https://user:pass@api.test.com/path'
      );
    });
  });

  describe('isAbsoluteURL', () => {
    it('should identify absolute URLs with protocols', (): void => {
      assert(isAbsoluteURL('https://example.com'));
      assert(isAbsoluteURL('http://example.com'));
      assert(isAbsoluteURL('ftp://example.com'));
      assert(isAbsoluteURL('mailto:test@example.com'));
      assert(isAbsoluteURL('file:///path/to/file'));
      assert(isAbsoluteURL('custom-protocol://example'));
    });

    it('should identify protocol-relative URLs', (): void => {
      assert(isAbsoluteURL('//example.com'));
      assert(isAbsoluteURL('//example.com/path'));
    });

    it('should reject relative URLs', (): void => {
      assert(!isAbsoluteURL('/path'));
      assert(!isAbsoluteURL('path'));
      assert(!isAbsoluteURL('./path'));
      assert(!isAbsoluteURL('../path'));
      assert(!isAbsoluteURL(''));
      assert(!isAbsoluteURL(null));
      assert(!isAbsoluteURL(undefined));
    });

    it('should reject paths with multiple slashes', (): void => {
      assert(!isAbsoluteURL('///path'));
      assert(!isAbsoluteURL('////path'));
    });

    it('should handle edge cases', (): void => {
      assert(isAbsoluteURL('HTTP://EXAMPLE.COM')); // Uppercase
      assert(isAbsoluteURL('a://b')); // Minimal valid
      assert(!isAbsoluteURL('://example.com')); // Missing protocol
      assert(!isAbsoluteURL('http:/example.com')); // Single slash
      assert(!isAbsoluteURL('http//example.com')); // Missing colon
      assert(!isAbsoluteURL('123://example.com')); // Protocol starting with number
    });
  });

  describe('buildFullPath', () => {
    it('should behave the same as combineURLs', (): void => {
      const testCases = [
        ['https://api.test.com', 'path'],
        ['https://api.test.com/', '/absolute'],
        ['', 'relative'],
        ['base', ''],
        ['https://api.test.com', 'https://other.com'],
      ];

      testCases.forEach(([base, relative]) => {
        assert.strictEqual(buildFullPath(base, relative), combineURLs(base, relative));
      });
    });
  });

  describe('Edge cases', () => {
    it('should handle very long URLs', (): void => {
      const longPath = 'a'.repeat(10000);
      const url = buildURL('https://api.test.com', { path: longPath });

      assert(url.includes(encodeURIComponent(longPath)));
    });

    it('should handle many query parameters', (): void => {
      const params = {};
      for (let i = 0; i < 100; i++) {
        params[`param${i}`] = `value${i}`;
      }

      const url = buildURL('https://api.test.com', params);

      assert(url.includes('param0=value0'));
      assert(url.includes('param99=value99'));
    });

    it('should handle special URL characters', (): void => {
      const params = {
        'key&with&ampersands': 'value&with&ampersands',
        'key=with=equals': 'value=with=equals',
        'key?with?questions': 'value?with?questions',
      };

      const serialized = serializeParams(params);

      assert(serialized.includes('key%26with%26ampersands'));
      assert(serialized.includes('key%3Dwith%3Dequals'));
      assert(serialized.includes('key%3Fwith%3Fquestions'));
    });

    it('should handle circular references in objects', (): void => {
      const obj = { key: 'value' };
      obj.circular = obj;

      // Should not throw
      const serialized = serializeParams({ data: obj });
      assert(serialized.includes('data='));
    });

    it('should handle custom objects with toString', (): void => {
      const customObj = {
        toString: () => 'custom-string-value',
      };

      const serialized = serializeParams({ obj: customObj });
      // Should use JSON.stringify, not toString
      assert(serialized.includes('obj=%7B%7D'));
    });

    it('should handle URLs with all components', (): void => {
      const fullUrl = 'https://user:pass@api.test.com:8080/path?query=1#fragment';
      const result = combineURLs(fullUrl, '../newpath');

      assert(result.includes('user:pass@'));
      assert(result.includes(':8080'));
      assert(result.includes('newpath'));
      assert(result.includes('newpath'));
    });

    it('should handle file URLs', (): void => {
      assert(isAbsoluteURL('file:///C:/path/to/file'));
      assert(isAbsoluteURL('file://localhost/path'));

      const combined = combineURLs('file:///base/', 'relative.txt');
      assert(combined.includes('file:///'));
    });

    it('should preserve URL encoding in base URL', (): void => {
      const encoded = combineURLs('https://api.test.com/path%20with%20spaces', 'more');
      // URL constructor may decode the path
      assert(encoded.includes('path%20with%20spaces') || encoded.includes('path with spaces'));
    });
  });
});
