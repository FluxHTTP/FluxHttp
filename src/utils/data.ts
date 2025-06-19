import type { RequestBody } from '../types';
import { Environment, Polyfills } from './environment';

// COMPATIBILITY: Safe type checking with environment detection
export function isFormData(value: unknown): value is FormData {
  return Environment.hasFormData && value instanceof FormData;
}

export function isURLSearchParams(value: unknown): value is URLSearchParams {
  return Environment.hasURLSearchParams && value instanceof URLSearchParams;
}

export function isArrayBuffer(value: unknown): value is ArrayBuffer {
  return value instanceof ArrayBuffer;
}

export function isBlob(value: unknown): value is Blob {
  return Environment.hasBlob && value instanceof Blob;
}

export function isStream(value: unknown): value is ReadableStream {
  return Environment.hasReadableStream && value instanceof ReadableStream;
}

// Interface for Node.js stream-like objects
interface NodeStreamLike {
  pipe: (...args: unknown[]) => unknown;
}

// Type guard for Node.js stream objects
function hasStreamMethods(value: object): value is NodeStreamLike {
  return 'pipe' in value && typeof (value as NodeStreamLike).pipe === 'function';
}

// COMPATIBILITY: Enhanced stream detection for Node.js
export function isNodeStream(value: unknown): boolean {
  if (!Environment.isNode) {
    return false;
  }

  return typeof value === 'object' && value !== null && hasStreamMethods(value);
}

// COMPATIBILITY: Universal stream detection
export function isAnyStream(value: unknown): boolean {
  return isStream(value) || isNodeStream(value);
}

// SECURITY: Safe object prototype checking
export function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const proto = Object.getPrototypeOf(value) as object | null;

  // Only accept objects with Object.prototype as their prototype
  // This is more secure as it rejects Object.create(null) and other edge cases
  if (proto !== Object.prototype) {
    return false;
  }

  // Ensure the constructor is Object (not a custom constructor)
  return value.constructor === Object;
}

// COMPATIBILITY: Safe JSON stringification
function safeStringify(data: unknown): string {
  try {
    return JSON.stringify(data);
  } catch (error) {
    // Handle circular references or non-serializable data
    try {
      // Create a new seen set for each stringify attempt
      const seenObjects = new WeakSet<object>();

      return JSON.stringify(data, (_key, value: unknown) => {
        if (typeof value === 'object' && value !== null) {
          // Simple circular reference check
          if (seenObjects.has(value)) {
            return '[Circular]';
          }
          seenObjects.add(value);
        }
        return value;
      });
    } catch {
      return String(data);
    }
  }
}

// COMPATIBILITY: Enhanced request data transformation
export function transformRequestData(data: RequestBody): RequestBody {
  if (data === null || data === undefined) {
    return data;
  }

  if (typeof data === 'string') {
    return data;
  }

  // Check for browser-specific types
  if (isFormData(data) || isURLSearchParams(data) || isArrayBuffer(data) || isBlob(data)) {
    return data;
  }

  // Check for stream types (both browser and Node.js)
  if (isStream(data) || isNodeStream(data)) {
    return data as RequestBody;
  }

  // COMPATIBILITY: Handle Buffer in Node.js
  if (Environment.hasBuffer && data instanceof Buffer) {
    return data as RequestBody;
  }

  // Handle plain objects and arrays
  if (isPlainObject(data) || Array.isArray(data)) {
    return safeStringify(data);
  }

  // Fallback to string conversion
  return String(data);
}

// COMPATIBILITY: Enhanced response data transformation
export function transformResponseData(data: unknown, responseType?: string): unknown {
  if (
    !data ||
    responseType === 'stream' ||
    responseType === 'blob' ||
    responseType === 'arraybuffer'
  ) {
    return data;
  }

  if (responseType === 'json' && typeof data === 'string') {
    try {
      return JSON.parse(data);
    } catch {
      return data; // Return original string if JSON parsing fails
    }
  }

  return data;
}

// COMPATIBILITY: Safe data size calculation
export function getDataSize(data: unknown): number {
  if (data === null || data === undefined) {
    return 0;
  }

  if (typeof data === 'string') {
    // Use platform-appropriate byte length calculation
    return Polyfills.getByteLength(data, 'utf8');
  }

  if (data instanceof ArrayBuffer) {
    return data.byteLength;
  }

  if (Environment.hasBuffer && data instanceof Buffer) {
    return data.length;
  }

  if (isBlob(data)) {
    return data.size;
  }

  if (isFormData(data)) {
    // Estimate FormData size (not perfectly accurate)
    let size = 0;
    try {
      // Use traditional for...of with Array.from for compatibility
      const entries = Array.from((data as any).entries()) as [string, any][];
      for (const [key, value] of entries) {
        size += Polyfills.getByteLength(key, 'utf8');
        if (typeof value === 'string') {
          size += Polyfills.getByteLength(value, 'utf8');
        } else if (isBlob(value)) {
          size += value.size;
        } else {
          size += 100; // Estimate for File metadata
        }
      }
    } catch {
      // FormData.entries() might not be available
      return 0;
    }
    return size;
  }

  if (isURLSearchParams(data)) {
    return Polyfills.getByteLength(data.toString(), 'utf8');
  }

  if (typeof data === 'object') {
    try {
      const jsonStr = JSON.stringify(data);
      return Polyfills.getByteLength(jsonStr, 'utf8');
    } catch {
      return 0; // Invalid object
    }
  }

  return 0;
}

// COMPATIBILITY: Mime type detection
export function getMimeType(data: unknown): string | null {
  if (isBlob(data) && data.type) {
    return data.type;
  }

  if (isFormData(data)) {
    return 'multipart/form-data';
  }

  if (isURLSearchParams(data)) {
    return 'application/x-www-form-urlencoded';
  }

  if (typeof data === 'string') {
    try {
      JSON.parse(data);
      return 'application/json';
    } catch {
      return 'text/plain';
    }
  }

  if (typeof data === 'object' && data !== null) {
    return 'application/json';
  }

  return null;
}

// COMPATIBILITY: Safe data cloning
export function cloneData(data: unknown): unknown {
  if (data === null || data === undefined || typeof data !== 'object') {
    return data;
  }

  // Cannot clone special objects
  if (isFormData(data) || isBlob(data) || isArrayBuffer(data) || isAnyStream(data)) {
    return data;
  }

  // Use structured cloning if available
  if (typeof structuredClone !== 'undefined') {
    try {
      return structuredClone(data);
    } catch {
      // Fall through to JSON cloning
    }
  }

  // Fallback to JSON cloning
  try {
    return JSON.parse(JSON.stringify(data));
  } catch {
    return data; // Return original if cloning fails
  }
}

// COMPATIBILITY: Data validation utilities
export const DataValidation = {
  // Check if data is valid for HTTP request
  isValidRequestData(data: unknown): boolean {
    if (data === null || data === undefined || typeof data === 'string') {
      return true;
    }

    return (
      isFormData(data) ||
      isURLSearchParams(data) ||
      isArrayBuffer(data) ||
      isBlob(data) ||
      isAnyStream(data) ||
      (Environment.hasBuffer && data instanceof Buffer) ||
      isPlainObject(data) ||
      Array.isArray(data)
    );
  },

  // Check if data can be safely JSON serialized
  isJSONSerializable(data: unknown): boolean {
    try {
      JSON.stringify(data);
      return true;
    } catch {
      return false;
    }
  },

  // Check if data is binary
  isBinaryData(data: unknown): boolean {
    return isArrayBuffer(data) || isBlob(data) || (Environment.hasBuffer && data instanceof Buffer);
  },

  // Check if data requires special handling
  requiresSpecialHandling(data: unknown): boolean {
    return (
      isFormData(data) || isURLSearchParams(data) || isAnyStream(data) || this.isBinaryData(data)
    );
  },
};
