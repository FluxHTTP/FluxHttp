import { describe, it, expect } from 'vitest';
import { normalizeHeaders, mergeHeaders, setContentTypeIfUnset } from '../../../src/utils/headers';

describe('headers utilities', () => {
  describe('normalizeHeaders', () => {
    it('should normalize header keys to lowercase', () => {
      const headers = {
        'Content-Type': 'application/json',
        'X-Custom-Header': 'value',
        UPPERCASE: 'test',
      };

      const normalized = normalizeHeaders(headers);

      expect(normalized).toEqual({
        'content-type': 'application/json',
        'x-custom-header': 'value',
        uppercase: 'test',
      });
    });

    it('should handle undefined headers', () => {
      expect(normalizeHeaders(undefined)).toEqual({});
    });

    it('should handle empty headers', () => {
      expect(normalizeHeaders({})).toEqual({});
    });

    it('should remove undefined and null values', () => {
      const headers = {
        'Content-Type': 'application/json',
        'X-Null': null,
        'X-Undefined': undefined,
        'X-Empty': '',
      };

      const normalized = normalizeHeaders(headers);

      expect(normalized).toEqual({
        'content-type': 'application/json',
        'x-empty': '',
      });
    });

    it('should convert values to strings', () => {
      const headers = {
        'X-Number': 123 as any,
        'X-Boolean': true as any,
        'X-Array': ['a', 'b'] as any,
      };

      const normalized = normalizeHeaders(headers);

      expect(normalized).toEqual({
        'x-number': '123',
        'x-boolean': 'true',
        'x-array': 'a,b',
      });
    });

    it('should handle header values that are already arrays', () => {
      const headers = {
        'X-Array': ['value1', 'value2'],
      };

      const normalized = normalizeHeaders(headers);

      expect(normalized).toEqual({
        'x-array': 'value1,value2',
      });
    });
  });

  describe('mergeHeaders', () => {
    it('should merge multiple header objects', () => {
      const headers1 = { 'Content-Type': 'application/json', 'X-A': '1' };
      const headers2 = { 'X-B': '2', 'X-C': '3' };
      const headers3 = { 'X-D': '4' };

      const merged = mergeHeaders(headers1, headers2, headers3);

      expect(merged).toEqual({
        'content-type': 'application/json',
        'x-a': '1',
        'x-b': '2',
        'x-c': '3',
        'x-d': '4',
      });
    });

    it('should override headers from left to right', () => {
      const headers1 = { 'X-Custom': 'first', 'X-Keep': 'value' };
      const headers2 = { 'X-Custom': 'second' };
      const headers3 = { 'X-Custom': 'third' };

      const merged = mergeHeaders(headers1, headers2, headers3);

      expect(merged).toEqual({
        'x-custom': 'third',
        'x-keep': 'value',
      });
    });

    it('should handle undefined sources', () => {
      const headers1 = { 'X-A': '1' };
      const merged = mergeHeaders(undefined, headers1, undefined);

      expect(merged).toEqual({
        'x-a': '1',
      });
    });

    it('should handle all undefined sources', () => {
      const merged = mergeHeaders(undefined, undefined, undefined);
      expect(merged).toEqual({});
    });

    it('should normalize all headers during merge', () => {
      const headers1 = { 'UPPER-CASE': 'value1' };
      const headers2 = { 'lower-case': 'value2' };

      const merged = mergeHeaders(headers1, headers2);

      expect(merged).toEqual({
        'upper-case': 'value1',
        'lower-case': 'value2',
      });
    });

    it('should handle empty objects', () => {
      const headers1 = { 'X-A': '1' };
      const merged = mergeHeaders({}, headers1, {});

      expect(merged).toEqual({
        'x-a': '1',
      });
    });

    it('should ignore undefined values during merge', () => {
      const headers1 = { 'X-A': '1', 'X-B': '2' };
      const headers2 = { 'X-B': undefined, 'X-C': 'new' };

      const merged = mergeHeaders(headers1, headers2);

      expect(merged).toEqual({
        'x-a': '1',
        'x-b': '2',
        'x-c': 'new',
      });
    });

    it('should handle no arguments', () => {
      const merged = mergeHeaders();
      expect(merged).toEqual({});
    });

    it('should handle single header object', () => {
      const headers = { 'X-Custom': 'value' };
      const merged = mergeHeaders(headers);

      expect(merged).toEqual({
        'x-custom': 'value',
      });
    });
  });

  describe('setContentTypeIfUnset', () => {
    it('should set content-type if not present', () => {
      const headers = { 'X-Custom': 'value' };
      const result = setContentTypeIfUnset(headers, 'application/json');

      expect(result).toEqual({
        'x-custom': 'value',
        'content-type': 'application/json',
      });
    });

    it('should not override existing content-type', () => {
      const headers = { 'Content-Type': 'text/plain' };
      const result = setContentTypeIfUnset(headers, 'application/json');

      expect(result).toEqual({
        'content-type': 'text/plain',
      });
    });

    it('should handle case-insensitive content-type', () => {
      const headers = { 'CONTENT-TYPE': 'text/plain' };
      const result = setContentTypeIfUnset(headers, 'application/json');

      expect(result).toEqual({
        'content-type': 'text/plain',
      });
    });

    it('should handle empty headers', () => {
      const headers = {};
      const result = setContentTypeIfUnset(headers, 'application/json');

      expect(result).toEqual({
        'content-type': 'application/json',
      });
    });

    it('should normalize headers', () => {
      const headers = { 'X-UPPER': 'VALUE' };
      const result = setContentTypeIfUnset(headers, 'application/json');

      expect(result).toEqual({
        'x-upper': 'VALUE',
        'content-type': 'application/json',
      });
    });

    it('should not modify original headers object', () => {
      const headers = { 'X-Custom': 'value' };
      const result = setContentTypeIfUnset(headers, 'application/json');

      expect(headers).toEqual({ 'X-Custom': 'value' });
      expect(result).not.toBe(headers);
    });
  });
});
