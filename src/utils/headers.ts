import type { Headers } from '../types';

// SECURITY: Safe header value conversion
function safeHeaderValue(value: string | string[] | undefined): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (Array.isArray(value)) {
    // SECURITY: Properly handle array headers by joining with commas
    return value
      .filter((v) => v !== null && v !== undefined)
      .map((v) => String(v).replace(/[\r\n]/g, '')) // Remove CRLF for security
      .join(', ');
  }

  // SECURITY: Sanitize header values to prevent injection
  return String(value).replace(/[\r\n]/g, '');
}

export function normalizeHeaders(headers?: Headers): Headers {
  if (!headers) {
    return {};
  }

  const normalized: Headers = {};

  Object.entries(headers).forEach(([key, value]) => {
    const normalizedValue = safeHeaderValue(value);
    if (normalizedValue !== undefined) {
      // SECURITY: Normalize header names to lowercase
      const normalizedKey = key.toLowerCase().replace(/[\r\n]/g, '');
      normalized[normalizedKey] = normalizedValue;
    }
  });

  return normalized;
}

export function mergeHeaders(...sources: (Headers | undefined)[]): Headers {
  const result: Headers = {};

  sources.forEach((source) => {
    if (source) {
      Object.entries(normalizeHeaders(source)).forEach(([key, value]) => {
        if (value !== undefined) {
          result[key] = value;
        }
      });
    }
  });

  return result;
}

export function setContentTypeIfUnset(headers: Headers, contentType: string): Headers {
  const normalized = normalizeHeaders(headers);

  if (!normalized['content-type']) {
    // SECURITY: Sanitize content type
    normalized['content-type'] = contentType.replace(/[\r\n]/g, '');
  }

  return normalized;
}

// SECURITY: Validate header name according to RFC 7230
export function isValidHeaderName(name: string): boolean {
  // Header names must be tokens (RFC 7230 section 3.2.6)
  return /^[!#$%&'*+\-.0-9A-Z^_`a-z|~]+$/.test(name);
}

// SECURITY: Validate header value according to RFC 7230
export function isValidHeaderValue(value: string): boolean {
  // Header values can contain visible VCHAR and whitespace (RFC 7230 section 3.2)
  return /^[\t\x20-\x7E\x80-\xFF]*$/.test(value);
}

// SECURITY: Safe header setting with validation
export function setHeader(headers: Headers, name: string, value: string | string[]): Headers {
  if (!isValidHeaderName(name)) {
    throw new Error(`Invalid header name: ${name}`);
  }

  const normalizedValue = safeHeaderValue(value);
  if (normalizedValue !== undefined) {
    if (!isValidHeaderValue(normalizedValue)) {
      throw new Error(`Invalid header value for ${name}: ${normalizedValue}`);
    }

    const result = { ...headers };
    result[name.toLowerCase()] = normalizedValue;
    return result;
  }

  return headers;
}
