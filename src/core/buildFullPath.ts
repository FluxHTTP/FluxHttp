import { combineURLs, isAbsoluteURL } from '../utils/url';

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
