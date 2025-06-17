import { describe, it, expect, beforeEach } from 'vitest';
import {
  isFormData,
  isURLSearchParams,
  isArrayBuffer,
  isBlob,
  isStream,
  isPlainObject,
  transformRequestData,
  transformResponseData,
} from '../../../src/utils/data';

describe('data utilities', () => {
  describe('type checking functions', () => {
    beforeEach(() => {
      // Setup globals for browser APIs
      global.FormData = class FormData {} as any;
      global.Blob = class Blob {} as any;
      global.ReadableStream = class ReadableStream {} as any;
    });

    it('should correctly identify FormData', () => {
      const formData = new FormData();
      expect(isFormData(formData)).toBe(true);
      expect(isFormData({})).toBe(false);
      expect(isFormData(null)).toBe(false);
      expect(isFormData('string')).toBe(false);
    });

    it('should correctly identify URLSearchParams', () => {
      const params = new URLSearchParams();
      expect(isURLSearchParams(params)).toBe(true);
      expect(isURLSearchParams({})).toBe(false);
      expect(isURLSearchParams(null)).toBe(false);
    });

    it('should correctly identify ArrayBuffer', () => {
      const buffer = new ArrayBuffer(8);
      expect(isArrayBuffer(buffer)).toBe(true);
      expect(isArrayBuffer({})).toBe(false);
      expect(isArrayBuffer(null)).toBe(false);
    });

    it('should correctly identify Blob', () => {
      const blob = new Blob();
      expect(isBlob(blob)).toBe(true);
      expect(isBlob({})).toBe(false);
      expect(isBlob(null)).toBe(false);
    });

    it('should correctly identify ReadableStream', () => {
      const stream = new ReadableStream();
      expect(isStream(stream)).toBe(true);
      expect(isStream({})).toBe(false);
      expect(isStream(null)).toBe(false);
    });

    it('should correctly identify plain objects', () => {
      expect(isPlainObject({})).toBe(true);
      expect(isPlainObject({ foo: 'bar' })).toBe(true);
      expect(isPlainObject(Object.create(null))).toBe(true);

      expect(isPlainObject(null)).toBe(false);
      expect(isPlainObject(undefined)).toBe(false);
      expect(isPlainObject('string')).toBe(false);
      expect(isPlainObject(123)).toBe(false);
      expect(isPlainObject([])).toBe(false);
      expect(isPlainObject(new Date())).toBe(false);
      expect(isPlainObject(new FormData())).toBe(false);
    });

    it('should handle undefined globals', () => {
      // Test when FormData is not defined
      const originalFormData = global.FormData;
      delete (global as any).FormData;
      expect(isFormData({})).toBe(false);
      global.FormData = originalFormData;

      // Test when Blob is not defined
      const originalBlob = global.Blob;
      delete (global as any).Blob;
      expect(isBlob({})).toBe(false);
      global.Blob = originalBlob;

      // Test when ReadableStream is not defined
      const originalStream = global.ReadableStream;
      delete (global as any).ReadableStream;
      expect(isStream({})).toBe(false);
      global.ReadableStream = originalStream;
    });
  });

  describe('transformRequestData', () => {
    it('should not transform null or undefined', () => {
      expect(transformRequestData(null)).toBe(null);
      expect(transformRequestData(undefined)).toBe(undefined);
    });

    it('should not transform strings', () => {
      const str = 'test string';
      expect(transformRequestData(str)).toBe(str);
    });

    it('should not transform FormData', () => {
      const formData = new FormData();
      expect(transformRequestData(formData)).toBe(formData);
    });

    it('should not transform URLSearchParams', () => {
      const params = new URLSearchParams('foo=bar');
      expect(transformRequestData(params)).toBe(params);
    });

    it('should not transform ArrayBuffer', () => {
      const buffer = new ArrayBuffer(8);
      expect(transformRequestData(buffer)).toBe(buffer);
    });

    it('should not transform Blob', () => {
      const blob = new Blob(['test']);
      expect(transformRequestData(blob)).toBe(blob);
    });

    it('should not transform ReadableStream', () => {
      const stream = new ReadableStream();
      expect(transformRequestData(stream)).toBe(stream);
    });

    it('should stringify plain objects', () => {
      const obj = { foo: 'bar', nested: { value: 123 } };
      expect(transformRequestData(obj)).toBe(JSON.stringify(obj));
    });

    it('should convert other types to string', () => {
      expect(transformRequestData(123 as any)).toBe('123');
      expect(transformRequestData(true as any)).toBe('true');
      expect(transformRequestData(false as any)).toBe('false');
    });

    it('should handle arrays as plain objects', () => {
      const arr = [1, 2, 3];
      expect(transformRequestData(arr as any)).toBe('[1,2,3]');
    });
  });

  describe('transformResponseData', () => {
    it('should not transform if no data', () => {
      expect(transformResponseData(null)).toBe(null);
      expect(transformResponseData(undefined)).toBe(undefined);
      expect(transformResponseData('')).toBe('');
    });

    it('should not transform for stream response type', () => {
      const stream = new ReadableStream();
      expect(transformResponseData(stream, 'stream')).toBe(stream);
    });

    it('should not transform for blob response type', () => {
      const blob = new Blob(['test']);
      expect(transformResponseData(blob, 'blob')).toBe(blob);
    });

    it('should not transform for arraybuffer response type', () => {
      const buffer = new ArrayBuffer(8);
      expect(transformResponseData(buffer, 'arraybuffer')).toBe(buffer);
    });

    it('should parse JSON string when responseType is json', () => {
      const jsonStr = '{"foo":"bar"}';
      expect(transformResponseData(jsonStr, 'json')).toEqual({ foo: 'bar' });
    });

    it('should return original string if JSON parsing fails', () => {
      const invalidJson = 'not json';
      expect(transformResponseData(invalidJson, 'json')).toBe('not json');
    });

    it('should not transform non-string data for json responseType', () => {
      const obj = { already: 'parsed' };
      expect(transformResponseData(obj, 'json')).toBe(obj);
    });

    it('should return data as-is for other response types', () => {
      const data = 'test data';
      expect(transformResponseData(data, 'text')).toBe(data);
      expect(transformResponseData(data)).toBe(data);
    });

    it('should handle complex JSON parsing', () => {
      const complexJson = '{"array":[1,2,3],"nested":{"value":true},"null":null}';
      const parsed = transformResponseData(complexJson, 'json');
      expect(parsed).toEqual({
        array: [1, 2, 3],
        nested: { value: true },
        null: null,
      });
    });

    it('should handle empty JSON object', () => {
      expect(transformResponseData('{}', 'json')).toEqual({});
      expect(transformResponseData('[]', 'json')).toEqual([]);
    });
  });
});
