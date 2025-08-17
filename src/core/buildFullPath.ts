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
  if (!requestedURL) {
    return baseURL || '';
  }

  if (isAbsoluteURL(requestedURL)) {
    return requestedURL;
  }

  if (baseURL) {
    return combineURLs(baseURL, requestedURL);
  }

  return requestedURL;
}
