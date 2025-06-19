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
      if (val === null || val === undefined) {
        return;
      }

      let v: string;

      if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') {
        v = String(val);
      } else if (
        typeof val === 'object' &&
        'toISOString' in val &&
        typeof (val as { toISOString: () => string }).toISOString === 'function'
      ) {
        v = (val as { toISOString: () => string }).toISOString();
      } else {
        v = JSON.stringify(val);
      }

      parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(v)}`);
    });
  });

  return parts.join('&');
}

export function combineURLs(baseURL?: string, relativeURL?: string): string {
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

export function isAbsoluteURL(url?: string): boolean {
  if (!url) return false;
  // Match URLs with protocol (http://, https://, ftp://, mailto:, etc.) or protocol-relative URLs (//example.com)
  // But not paths that just start with multiple slashes (///path)
  return /^([a-z][a-z\d+\-.]*:)(\/\/.*|[^/].*)/i.test(url) || /^\/\/[^/]/i.test(url);
}

export function buildFullPath(baseURL?: string, relativeURL?: string): string {
  return combineURLs(baseURL, relativeURL);
}
