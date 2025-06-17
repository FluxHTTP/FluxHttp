import type { RequestBody } from '../types';

export function isFormData(value: unknown): value is FormData {
  return typeof FormData !== 'undefined' && value instanceof FormData;
}

export function isURLSearchParams(value: unknown): value is URLSearchParams {
  return typeof URLSearchParams !== 'undefined' && value instanceof URLSearchParams;
}

export function isArrayBuffer(value: unknown): value is ArrayBuffer {
  return typeof ArrayBuffer !== 'undefined' && value instanceof ArrayBuffer;
}

export function isBlob(value: unknown): value is Blob {
  return typeof Blob !== 'undefined' && value instanceof Blob;
}

export function isStream(value: unknown): value is ReadableStream {
  return typeof ReadableStream !== 'undefined' && value instanceof ReadableStream;
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const proto = Object.getPrototypeOf(value) as object | null;
  return proto === null || proto === Object.prototype;
}

export function transformRequestData(data: RequestBody): RequestBody {
  if (
    data === null ||
    data === undefined ||
    typeof data === 'string' ||
    isFormData(data) ||
    isURLSearchParams(data) ||
    isArrayBuffer(data) ||
    isBlob(data) ||
    isStream(data)
  ) {
    return data;
  }

  if (isPlainObject(data)) {
    return JSON.stringify(data);
  }

  if (Array.isArray(data)) {
    return JSON.stringify(data);
  }

  return String(data);
}

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
      return data;
    }
  }

  return data;
}
