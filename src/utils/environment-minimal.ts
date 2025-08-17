/**
 * Minimal environment detection for optimal bundle size
 * Only includes essential runtime checks
 */

// Minimal environment detection
export const Environment = {
  // Node.js detection
  isNode: typeof process !== 'undefined' && process.versions?.node,
  
  // Browser detection  
  isBrowser: typeof window !== 'undefined',
  
  // Feature detection
  hasFormData: typeof FormData !== 'undefined',
  hasURLSearchParams: typeof URLSearchParams !== 'undefined',
  hasBlob: typeof Blob !== 'undefined',
  hasBuffer: typeof Buffer !== 'undefined',
  hasReadableStream: typeof ReadableStream !== 'undefined',
} as const;

// Minimal polyfills - return undefined if not available
export const Polyfills = {
  FormData: typeof FormData !== 'undefined' ? FormData : undefined,
  URLSearchParams: typeof URLSearchParams !== 'undefined' ? URLSearchParams : undefined,
  Buffer: typeof Buffer !== 'undefined' ? Buffer : undefined,
  ReadableStream: typeof ReadableStream !== 'undefined' ? ReadableStream : undefined,
} as const;