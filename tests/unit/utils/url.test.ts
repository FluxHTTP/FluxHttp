import { describe, it, expect } from 'vitest';
import { buildURL, serializeParams, combineURLs, isAbsoluteURL } from '../../../src/utils/url';

describe('URL utilities', () => {
  describe('buildURL', () => {
    it('should return URL without params', () => {
      const url = buildURL('/test');
      expect(url).toBe('/test');
    });

    it('should append params to URL without query', () => {
      const url = buildURL('/test', { foo: 'bar', baz: 123 });
      expect(url).toBe('/test?foo=bar&baz=123');
    });

    it('should append params to URL with existing query', () => {
      const url = buildURL('/test?existing=true', { foo: 'bar' });
      expect(url).toBe('/test?existing=true&foo=bar');
    });

    it('should handle array params', () => {
      const url = buildURL('/test', { items: ['a', 'b', 'c'] });
      expect(url).toBe('/test?items=a&items=b&items=c');
    });

    it('should ignore null and undefined params', () => {
      const url = buildURL('/test', { foo: 'bar', baz: null, qux: undefined });
      expect(url).toBe('/test?foo=bar');
    });

    it('should remove hash before appending params', () => {
      const url = buildURL('/test#hash', { foo: 'bar' });
      expect(url).toBe('/test?foo=bar');
    });

    it('should encode special characters', () => {
      const url = buildURL('/test', { 'sp ace': 'val ue', special: '@#$%' });
      expect(url).toBe('/test?sp%20ace=val%20ue&special=%40%23%24%25');
    });
  });

  describe('serializeParams', () => {
    it('should serialize simple params', () => {
      const serialized = serializeParams({ foo: 'bar', baz: 123 });
      expect(serialized).toBe('foo=bar&baz=123');
    });

    it('should serialize arrays', () => {
      const serialized = serializeParams({ items: ['a', 'b'] });
      expect(serialized).toBe('items=a&items=b');
    });

    it('should serialize dates', () => {
      const date = new Date('2023-01-01T00:00:00.000Z');
      const serialized = serializeParams({ date });
      expect(serialized).toBe('date=2023-01-01T00%3A00%3A00.000Z');
    });

    it('should serialize objects as JSON', () => {
      const serialized = serializeParams({ obj: { nested: 'value' } });
      expect(serialized).toBe('obj=%7B%22nested%22%3A%22value%22%7D');
    });

    it('should handle boolean values', () => {
      const serialized = serializeParams({ enabled: true, disabled: false });
      expect(serialized).toBe('enabled=true&disabled=false');
    });
  });

  describe('combineURLs', () => {
    it('should combine base and relative URL', () => {
      const url = combineURLs('https://api.example.com', '/users');
      expect(url).toBe('https://api.example.com/users');
    });

    it('should handle trailing slash in base URL', () => {
      const url = combineURLs('https://api.example.com/', '/users');
      expect(url).toBe('https://api.example.com/users');
    });

    it('should handle leading slash in relative URL', () => {
      const url = combineURLs('https://api.example.com', 'users');
      expect(url).toBe('https://api.example.com/users');
    });

    it('should handle multiple slashes', () => {
      const url = combineURLs('https://api.example.com///', '///users');
      expect(url).toBe('https://api.example.com/users');
    });

    it('should return base URL if relative URL is empty', () => {
      const url = combineURLs('https://api.example.com', '');
      expect(url).toBe('https://api.example.com');
    });

    it('should return absolute URL if relative URL is absolute', () => {
      const url = combineURLs('https://api.example.com', 'https://other.com/users');
      expect(url).toBe('https://other.com/users');
    });
  });

  describe('isAbsoluteURL', () => {
    it('should detect absolute URLs', () => {
      expect(isAbsoluteURL('https://example.com')).toBe(true);
      expect(isAbsoluteURL('http://example.com')).toBe(true);
      expect(isAbsoluteURL('ftp://example.com')).toBe(true);
      expect(isAbsoluteURL('//example.com')).toBe(true);
    });

    it('should detect relative URLs', () => {
      expect(isAbsoluteURL('/path')).toBe(false);
      expect(isAbsoluteURL('path')).toBe(false);
      expect(isAbsoluteURL('./path')).toBe(false);
      expect(isAbsoluteURL('../path')).toBe(false);
    });
  });
});
