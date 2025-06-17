import { describe, it, expect } from 'vitest';
import { defaults } from '../../../src/core/defaults';

describe('defaults', () => {
  it('should have default timeout', () => {
    expect(defaults.timeout).toBe(0);
  });

  it('should have default headers', () => {
    expect(defaults.headers).toEqual({
      Accept: 'application/json, text/plain, */*',
      'User-Agent': 'FluxHTTP/0.1.0',
    });
  });

  it('should have default validateStatus function', () => {
    const validateStatus = defaults.validateStatus!;

    expect(validateStatus(200)).toBe(true);
    expect(validateStatus(201)).toBe(true);
    expect(validateStatus(299)).toBe(true);
    expect(validateStatus(300)).toBe(false);
    expect(validateStatus(400)).toBe(false);
    expect(validateStatus(500)).toBe(false);
  });

  it('should have transformRequest function', () => {
    expect(defaults.transformRequest).toBeDefined();
    expect(Array.isArray(defaults.transformRequest)).toBe(true);
    expect(defaults.transformRequest!.length).toBe(1);
  });

  it('should transform request data correctly', () => {
    const transform = defaults.transformRequest![0] as Function;
    const headers: Headers = {};

    // Test plain object transformation
    const objData = { foo: 'bar' };
    const transformed = transform(objData, headers);
    expect(transformed).toBe(JSON.stringify(objData));
    // setContentTypeIfUnset normalizes headers to lowercase
    expect(headers).toEqual({ 'content-type': 'application/json' });
  });

  it('should not transform FormData', () => {
    const transform = defaults.transformRequest![0] as Function;
    const headers = {};

    // Mock FormData
    global.FormData = class FormData {} as any;
    const formData = new FormData();

    const result = transform(formData, headers);
    expect(result).toBe(formData);
    expect(headers).toEqual({});
  });

  it('should not transform URLSearchParams', () => {
    const transform = defaults.transformRequest![0] as Function;
    const headers = {};

    const params = new URLSearchParams('foo=bar');
    const result = transform(params, headers);
    expect(result).toBe(params);
    expect(headers).toEqual({});
  });

  it('should not transform string data', () => {
    const transform = defaults.transformRequest![0] as Function;
    const headers = {};

    const stringData = 'raw string data';
    const result = transform(stringData, headers);
    expect(result).toBe(stringData);
    expect(headers).toEqual({});
  });

  it('should not transform null or undefined', () => {
    const transform = defaults.transformRequest![0] as Function;
    const headers = {};

    expect(transform(null, headers)).toBe(null);
    expect(transform(undefined, headers)).toBe(undefined);
    expect(headers).toEqual({});
  });

  it('should have transformResponse function', () => {
    expect(defaults.transformResponse).toBeDefined();
    expect(Array.isArray(defaults.transformResponse)).toBe(true);
    expect(defaults.transformResponse!.length).toBe(1);
  });

  it('should transform response data correctly', () => {
    const transform = defaults.transformResponse![0] as Function;

    // Test JSON parsing
    const jsonString = '{"foo":"bar"}';
    const parsed = transform(jsonString);
    expect(parsed).toEqual({ foo: 'bar' });

    // Test invalid JSON
    const invalidJson = 'not json';
    const notParsed = transform(invalidJson);
    expect(notParsed).toBe('not json');

    // Test non-string data
    const obj = { already: 'parsed' };
    const passThrough = transform(obj);
    expect(passThrough).toBe(obj);
  });

  it('should not set content-type if already present', () => {
    const transform = defaults.transformRequest![0] as Function;
    const headers = { 'content-type': 'text/plain' };

    const objData = { foo: 'bar' };
    transform(objData, headers);

    expect(headers['content-type']).toBe('text/plain');
  });

  it('should handle headers being undefined', () => {
    const transform = defaults.transformRequest![0] as Function;

    const objData = { foo: 'bar' };
    const result = transform(objData, undefined);

    expect(result).toBe(JSON.stringify(objData));
  });
});
