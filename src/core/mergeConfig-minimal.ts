import type { fluxhttpRequestConfig } from '../types';

// Simple safe object merge without extensive validation
function mergeObjects<T extends Record<string, unknown>>(target: T, source: T): T {
  const result = { ...target };
  
  for (const [key, value] of Object.entries(source)) {
    // Simple prototype pollution protection
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
      continue;
    }
    
    if (value !== undefined) {
      result[key as keyof T] = value;
    }
  }
  
  return result;
}

// Simple header merge
function mergeHeaders(target: Record<string, string> = {}, source: Record<string, string> = {}): Record<string, string> {
  const result: Record<string, string> = {};
  
  // Normalize target headers to lowercase
  for (const [key, value] of Object.entries(target)) {
    result[key.toLowerCase()] = value;
  }
  
  // Normalize source headers to lowercase and merge
  for (const [key, value] of Object.entries(source)) {
    result[key.toLowerCase()] = value;
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