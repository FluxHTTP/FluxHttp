import type { fluxhttpRequestConfig, Headers } from '../types';

// Simple safe object merge without extensive validation
function mergeObjects(target: fluxhttpRequestConfig, source: fluxhttpRequestConfig): fluxhttpRequestConfig {
  const result: fluxhttpRequestConfig = { ...target };

  for (const [key, value] of Object.entries(source)) {
    // Simple prototype pollution protection
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
      continue;
    }

    if (value !== undefined) {
      (result as Record<string, unknown>)[key] = value;
    }
  }

  return result;
}

// Simple header merge - handles Headers type (string | string[] | undefined)
function mergeHeaders(target?: Headers, source?: Headers): Headers {
  const result: Headers = {};

  // Normalize target headers to lowercase
  if (target) {
    for (const [key, value] of Object.entries(target)) {
      if (value !== undefined) {
        // Convert string[] to string by joining
        result[key.toLowerCase()] = Array.isArray(value) ? value.join(', ') : value;
      }
    }
  }

  // Normalize source headers to lowercase and merge
  if (source) {
    for (const [key, value] of Object.entries(source)) {
      if (value !== undefined) {
        // Convert string[] to string by joining
        result[key.toLowerCase()] = Array.isArray(value) ? value.join(', ') : value;
      }
    }
  }

  return result;
}

/**
 * Merge two configuration objects with simple conflict resolution
 * @param target Base configuration
 * @param source Configuration to merge in
 * @returns Merged configuration
 */
export function mergeConfig(
  target: fluxhttpRequestConfig = {},
  source: fluxhttpRequestConfig = {}
): fluxhttpRequestConfig {
  const result = mergeObjects(target, source);

  // Special handling for headers
  if (target.headers || source.headers) {
    result.headers = mergeHeaders(target.headers, source.headers);
  }

  return result;
}
