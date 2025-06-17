import type { FluxHTTPRequestConfig } from '../types';
import { mergeHeaders } from '../utils/headers';

export function mergeConfig(
  config1: FluxHTTPRequestConfig = {},
  config2: FluxHTTPRequestConfig = {}
): FluxHTTPRequestConfig {
  const merged: FluxHTTPRequestConfig = { ...config1 };

  // Always normalize headers from config1
  if (config1.headers) {
    merged.headers = mergeHeaders(config1.headers);
  }

  const mergeMap: Record<string, 'replace' | 'merge' | 'concat'> = {
    url: 'replace',
    method: 'replace',
    data: 'replace',
    baseURL: 'replace',
    params: 'replace',
    timeout: 'replace',
    withCredentials: 'replace',
    auth: 'replace',
    responseType: 'replace',
    responseEncoding: 'replace',
    validateStatus: 'replace',
    maxRedirects: 'replace',
    maxContentLength: 'replace',
    maxBodyLength: 'replace',
    decompress: 'replace',
    signal: 'replace',
    onUploadProgress: 'replace',
    onDownloadProgress: 'replace',
    retry: 'merge',
    cache: 'merge',
    headers: 'merge',
  };

  Object.keys(config2).forEach((key) => {
    const mergeStrategy = mergeMap[key] || 'replace';
    const value2 = config2[key as keyof FluxHTTPRequestConfig];

    if (value2 === undefined) {
      return;
    }

    if (mergeStrategy === 'replace') {
      (merged as Record<string, unknown>)[key] = value2;
    } else if (mergeStrategy === 'merge') {
      if (key === 'headers') {
        merged.headers = mergeHeaders(config1.headers, config2.headers);
      } else if (typeof value2 === 'object' && value2 !== null) {
        const config1Value = config1[key as keyof FluxHTTPRequestConfig];
        const mergedValue = {
          ...(typeof config1Value === 'object' && config1Value !== null ? config1Value : {}),
          ...value2,
        };
        (merged as Record<string, unknown>)[key] = mergedValue;
      } else {
        (merged as Record<string, unknown>)[key] = value2;
      }
    }
  });

  return merged;
}
