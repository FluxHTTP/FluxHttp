import type { Headers } from '../types';

export function normalizeHeaders(headers?: Headers): Headers {
  if (!headers) {
    return {};
  }

  const normalized: Headers = {};

  Object.entries(headers).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      normalized[key.toLowerCase()] = String(value);
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
    normalized['content-type'] = contentType;
  }

  return normalized;
}
