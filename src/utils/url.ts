import type { QueryParams } from '../types';

export function buildURL(url: string, params?: QueryParams): string {
  // SECURITY: Validate URL for dangerous protocols
  if (!isSecureURL(url)) {
    throw new Error(`Dangerous URL protocol detected: ${url}`);
  }

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

// SECURITY: URL validation functions to prevent XSS and SSRF attacks
export function isSecureURL(url?: string): boolean {
  if (!url) return false;

  // Dangerous protocol detection
  const dangerousProtocols = [
    'javascript:',
    'data:',
    'vbscript:',
    'file:',
    'ftp:',
    'about:',
    'chrome:',
    'chrome-extension:',
    'resource:'
  ];

  const lowerUrl = url.toLowerCase().trim();
  
  for (const protocol of dangerousProtocols) {
    if (lowerUrl.startsWith(protocol)) {
      return false;
    }
  }

  // Check for SSRF-prone URLs
  if (lowerUrl.startsWith('http://') || lowerUrl.startsWith('https://')) {
    try {
      const urlObj = new URL(url);
      
      // Block localhost and private IP ranges
      const hostname = urlObj.hostname.toLowerCase();
      
      // Block localhost variants
      if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') {
        return false;
      }
      
      // Block private IP ranges
      if (isPrivateIP(hostname)) {
        return false;
      }
      
      // Block cloud metadata services
      if (hostname === '169.254.169.254' || hostname === 'metadata.google.internal') {
        return false;
      }
      
      return true;
    } catch {
      return false;
    }
  }

  // Allow relative URLs (no protocol)
  return !lowerUrl.includes(':');
}

// SECURITY: Check if IP address is in private range
function isPrivateIP(hostname: string): boolean {
  // Simple regex patterns for private IP ranges
  const privateIPPatterns = [
    /^10\./,                    // 10.0.0.0/8
    /^172\.(1[6-9]|2[0-9]|3[01])\./, // 172.16.0.0/12
    /^192\.168\./,              // 192.168.0.0/16
    /^fc00:/,                   // IPv6 private
    /^fe80:/,                   // IPv6 link-local
  ];

  return privateIPPatterns.some(pattern => pattern.test(hostname));
}

// SECURITY: Path traversal prevention
export function sanitizePath(path: string): string {
  // Remove path traversal sequences
  return path
    .replace(/\.\.\//g, '')    // Remove ../
    .replace(/\.\.\\/g, '')    // Remove ..\
    .replace(/\0/g, '')        // Remove null bytes
    .replace(/%2e%2e%2f/gi, '') // Remove encoded ../
    .replace(/%2e%2e%5c/gi, '') // Remove encoded ..\
    .replace(/\.{2,}/g, '.');   // Remove multiple dots
}

export function buildFullPath(baseURL?: string, relativeURL?: string): string {
  const combined = combineURLs(baseURL, relativeURL);
  
  // SECURITY: Validate the final URL
  if (!isSecureURL(combined)) {
    throw new Error(`Insecure URL detected: ${combined}`);
  }
  
  return combined;
}
