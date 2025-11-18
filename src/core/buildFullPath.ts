// Minimal URL building without external dependencies
function isAbsoluteURL(url: string): boolean {
  return /^https?:\/\//.test(url);
}

function combineURLs(baseURL: string, relativeURL: string): string {
  const base = baseURL.replace(/\/+$/, '');
  const relative = relativeURL.replace(/^\/+/, '');
  return `${base}/${relative}`;
}

export function buildFullPath(baseURL?: string, requestedURL?: string): string {
  // BUG-019 FIX: Explicitly handle null, undefined, and empty string cases
  const hasRequestedURL = requestedURL !== null && requestedURL !== undefined && requestedURL !== '';
  const hasBaseURL = baseURL !== null && baseURL !== undefined && baseURL !== '';

  if (!hasRequestedURL) {
    return baseURL || '';
  }

  if (isAbsoluteURL(requestedURL)) {
    return requestedURL;
  }

  if (hasBaseURL) {
    return combineURLs(baseURL, requestedURL);
  }

  return requestedURL;
}
