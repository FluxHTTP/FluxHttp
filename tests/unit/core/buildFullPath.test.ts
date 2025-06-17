import { describe, it, expect } from 'vitest';
import { buildFullPath } from '../../../src/core/buildFullPath';

describe('buildFullPath', () => {
  it('should return empty string when both URLs are undefined', () => {
    expect(buildFullPath()).toBe('');
    expect(buildFullPath(undefined, undefined)).toBe('');
  });

  it('should return baseURL when requestedURL is undefined', () => {
    expect(buildFullPath('https://api.example.com')).toBe('https://api.example.com');
    expect(buildFullPath('https://api.example.com', undefined)).toBe('https://api.example.com');
  });

  it('should return requestedURL when it is absolute', () => {
    expect(buildFullPath('https://api.example.com', 'https://other.com/test')).toBe(
      'https://other.com/test'
    );
    expect(buildFullPath('https://api.example.com', 'http://other.com/test')).toBe(
      'http://other.com/test'
    );
    expect(buildFullPath('https://api.example.com', '//other.com/test')).toBe('//other.com/test');
  });

  it('should combine baseURL and relative URL', () => {
    expect(buildFullPath('https://api.example.com', '/users')).toBe(
      'https://api.example.com/users'
    );
    expect(buildFullPath('https://api.example.com/', '/users')).toBe(
      'https://api.example.com/users'
    );
    expect(buildFullPath('https://api.example.com', 'users')).toBe('https://api.example.com/users');
    expect(buildFullPath('https://api.example.com/', 'users')).toBe(
      'https://api.example.com/users'
    );
  });

  it('should return requestedURL when baseURL is undefined', () => {
    expect(buildFullPath(undefined, '/users')).toBe('/users');
    expect(buildFullPath('', '/users')).toBe('/users');
  });

  it('should handle complex paths', () => {
    expect(buildFullPath('https://api.example.com/v1', '/users/123')).toBe(
      'https://api.example.com/v1/users/123'
    );
    expect(buildFullPath('https://api.example.com/v1/', 'users/123')).toBe(
      'https://api.example.com/v1/users/123'
    );
  });

  it('should handle multiple slashes correctly', () => {
    expect(buildFullPath('https://api.example.com///', '///users')).toBe(
      'https://api.example.com/users'
    );
  });

  it('should handle empty string baseURL', () => {
    expect(buildFullPath('', 'users')).toBe('users');
    expect(buildFullPath('', '/users')).toBe('/users');
  });

  it('should handle protocol-relative URLs', () => {
    expect(buildFullPath('https://api.example.com', '//cdn.example.com/file.js')).toBe(
      '//cdn.example.com/file.js'
    );
  });

  it('should handle various absolute URL formats', () => {
    expect(buildFullPath('https://api.example.com', 'ftp://files.example.com')).toBe(
      'ftp://files.example.com'
    );
    expect(buildFullPath('https://api.example.com', 'mailto:user@example.com')).toBe(
      'mailto:user@example.com'
    );
  });
});
