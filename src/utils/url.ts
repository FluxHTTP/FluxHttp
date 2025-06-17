import type { QueryParams } from '../types';

export function buildURL(url: string, params?: QueryParams): string {
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

export function serializeParams(params: QueryParams): string {
  const parts: string[] = [];

  Object.entries(params).forEach(([key, value]) => {
    if (value === null || value === undefined) {
      return;
    }

    const values = Array.isArray(value) ? value : [value];

    values.forEach((val) => {
      let v: string | number | boolean = val;
      if (
        val &&
        typeof val === 'object' &&
        'toISOString' in val &&
        typeof (val as { toISOString: () => string }).toISOString === 'function'
      ) {
        v = (val as { toISOString: () => string }).toISOString();
      } else if (val !== null && typeof val === 'object') {
        v = JSON.stringify(val);
      }

      parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(v))}`);
    });
  });

  return parts.join('&');
}

export function combineURLs(baseURL: string, relativeURL?: string): string {
  if (!relativeURL) {
    return baseURL;
  }

  if (isAbsoluteURL(relativeURL)) {
    return relativeURL;
  }

  const cleanBase = baseURL.replace(/\/+$/, '');
  const cleanRelative = relativeURL.replace(/^\/+/, '');

  return cleanBase + '/' + cleanRelative;
}

export function isAbsoluteURL(url: string): boolean {
  // Match URLs with protocol (http://, https://, ftp://, mailto:, etc.) or protocol-relative URLs (//example.com)
  // But not paths that just start with multiple slashes (///path)
  return /^([a-z][a-z\d+\-.]*:)(\/\/.*|[^/].*)/i.test(url) || /^\/\/[^/]/i.test(url);
}
