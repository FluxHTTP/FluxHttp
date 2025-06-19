import type { fluxhttpRequestConfig } from '../types';
import { mergeHeaders } from '../utils/headers';

// SECURITY: Dangerous property names that could cause prototype pollution
const DANGEROUS_KEYS = new Set([
  '__proto__',
  'constructor',
  'prototype',
  'valueOf',
  'toString',
  'hasOwnProperty',
  'isPrototypeOf',
  'propertyIsEnumerable',
  'toLocaleString',
]);

// Type guard to check if a value is a Record<string, unknown>
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// SECURITY: Type guard to check if a key is a valid config key AND safe
function isConfigKey(key: string): key is keyof fluxhttpRequestConfig {
  // SECURITY: Block dangerous keys that could cause prototype pollution
  if (DANGEROUS_KEYS.has(key)) {
    return false;
  }

  const validKeys: ReadonlyArray<keyof fluxhttpRequestConfig> = [
    'adapter',
    'url',
    'method',
    'baseURL',
    'headers',
    'params',
    'data',
    'timeout',
    'withCredentials',
    'auth',
    'responseType',
    'responseEncoding',
    'validateStatus',
    'maxRedirects',
    'maxContentLength',
    'maxBodyLength',
    'decompress',
    'signal',
    'cancelToken',
    'onUploadProgress',
    'onDownloadProgress',
    'retry',
    'cache',
    'security',
    'transformRequest',
    'transformResponse',
  ];
  return validKeys.includes(key as keyof fluxhttpRequestConfig);
}

// SECURITY: Safe property setter with prototype pollution protection
function setConfigProperty<K extends keyof fluxhttpRequestConfig>(
  target: fluxhttpRequestConfig,
  key: K,
  value: fluxhttpRequestConfig[K]
): void {
  // SECURITY: Additional check to prevent prototype pollution
  if (typeof key === 'string' && DANGEROUS_KEYS.has(key)) {
    throw new Error(`Dangerous key "${key}" not allowed in configuration`);
  }
  target[key] = value;
}

// Helper function to safely copy properties between objects
function safeObjectCopy<T>(target: T, source: unknown): T {
  const result = { ...target };

  // Only proceed if source is a valid record object
  if (isRecord(source)) {
    // Copy source properties safely
    Object.entries(source).forEach(([key, value]) => {
      if (!DANGEROUS_KEYS.has(key)) {
        // Type assertion is necessary here to allow property assignment
        (result as Record<string, unknown>)[key] = value;
      }
    });
  }

  return result;
}

export function mergeConfig(
  config1?: fluxhttpRequestConfig | null,
  config2?: fluxhttpRequestConfig | null
): fluxhttpRequestConfig {
  // Handle null/undefined configs
  const safeConfig1 = config1 || {};
  const safeConfig2 = config2 || {};
  // SECURITY: Create safe copy to prevent prototype pollution
  const merged: fluxhttpRequestConfig = { ...safeConfig1 };

  // Always normalize headers from config1
  if (safeConfig1.headers) {
    merged.headers = mergeHeaders(safeConfig1.headers);
  }

  const mergeMap: Record<keyof fluxhttpRequestConfig, 'replace' | 'merge' | 'concat'> = {
    adapter: 'replace',
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
    cancelToken: 'replace',
    onUploadProgress: 'replace',
    onDownloadProgress: 'replace',
    retry: 'merge',
    cache: 'merge',
    security: 'merge',
    headers: 'merge',
    transformRequest: 'replace',
    transformResponse: 'replace',
  };

  // SECURITY: Only process keys from a filtered list, not all Object.keys()
  const safeKeys = Object.keys(safeConfig2).filter(
    (key): key is keyof fluxhttpRequestConfig =>
      isConfigKey(key) && Object.prototype.hasOwnProperty.call(safeConfig2, key)
  );

  safeKeys.forEach((key) => {
    const value2 = safeConfig2[key];
    if (value2 === undefined) {
      return;
    }

    const mergeStrategy = mergeMap[key] || 'replace';

    if (mergeStrategy === 'replace') {
      setConfigProperty(merged, key, value2);
    } else if (mergeStrategy === 'merge') {
      if (key === 'headers') {
        merged.headers = mergeHeaders(safeConfig1.headers, safeConfig2.headers);
      } else if (key === 'retry') {
        // SECURITY: Safe merging for retry config
        const config1Value = safeConfig1.retry;
        if (isRecord(value2)) {
          if (isRecord(config1Value)) {
            // Use the safe copy helper function
            merged.retry = safeObjectCopy(config1Value, value2);
          } else {
            merged.retry = value2 as fluxhttpRequestConfig['retry'];
          }
        }
      } else if (key === 'cache') {
        // SECURITY: Safe merging for cache config
        const config1Value = safeConfig1.cache;
        if (isRecord(value2)) {
          if (isRecord(config1Value)) {
            // Use the safe copy helper function
            merged.cache = safeObjectCopy(config1Value, value2);
          } else {
            merged.cache = value2 as fluxhttpRequestConfig['cache'];
          }
        }
      } else if (key === 'security') {
        // SECURITY: Safe merging for security config
        const config1Value = safeConfig1.security;
        if (isRecord(value2)) {
          if (isRecord(config1Value)) {
            // Use the safe copy helper function
            merged.security = safeObjectCopy(config1Value, value2);
          } else {
            merged.security = value2 as fluxhttpRequestConfig['security'];
          }
        }
      }
    }
  });

  return merged;
}
