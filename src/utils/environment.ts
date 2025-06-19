// COMPATIBILITY: Environment detection utilities for cross-platform support

// Global interfaces for type safety
interface WebWorkerGlobalScope {
  importScripts: (...urls: string[]) => void;
}

interface DenoGlobal {
  Deno: {
    version: { deno: string };
  };
}

// Type guards for global objects
function hasImportScripts(obj: unknown): obj is WebWorkerGlobalScope {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'importScripts' in obj &&
    typeof (obj as WebWorkerGlobalScope).importScripts === 'function'
  );
}

function hasDeno(obj: unknown): obj is DenoGlobal {
  return typeof obj === 'object' && obj !== null && 'Deno' in obj;
}

// Runtime environment detection
export const Environment = {
  // Node.js detection
  isNode:
    typeof process !== 'undefined' &&
    process.versions &&
    Boolean(process.versions.node) &&
    typeof require !== 'undefined',

  // Browser detection
  isBrowser: typeof window !== 'undefined' && typeof document !== 'undefined',

  // Web Worker detection
  isWebWorker:
    typeof self !== 'undefined' && hasImportScripts(self) && typeof navigator !== 'undefined',

  // Deno detection
  isDeno: typeof globalThis !== 'undefined' && hasDeno(globalThis),

  // React Native detection
  isReactNative: typeof navigator !== 'undefined' && navigator.product === 'ReactNative',

  // Service Worker detection
  isServiceWorker:
    typeof self !== 'undefined' &&
    hasImportScripts(self) &&
    typeof navigator !== 'undefined' &&
    typeof location === 'undefined',

  // Feature availability
  hasBuffer: typeof Buffer !== 'undefined',
  hasProcess: typeof process !== 'undefined',
  hasDocument: typeof document !== 'undefined',
  hasWindow: typeof window !== 'undefined',
  hasLocation: typeof location !== 'undefined',
  hasNavigator: typeof navigator !== 'undefined',
  hasCrypto: typeof crypto !== 'undefined',
  hasAbortController: typeof AbortController !== 'undefined',
  hasXMLHttpRequest: typeof XMLHttpRequest !== 'undefined',
  hasFetch: typeof fetch !== 'undefined',
  hasTextEncoder: typeof TextEncoder !== 'undefined',
  hasTextDecoder: typeof TextDecoder !== 'undefined',
  hasURL: typeof URL !== 'undefined',
  hasURLSearchParams: typeof URLSearchParams !== 'undefined',
  hasBlob: typeof Blob !== 'undefined',
  hasFormData: typeof FormData !== 'undefined',
  hasHeaders: typeof Headers !== 'undefined',
  hasRequest: typeof Request !== 'undefined',
  hasResponse: typeof Response !== 'undefined',
  hasReadableStream: typeof ReadableStream !== 'undefined',

  // HTTP module availability (Node.js)
  hasHttpModule: false, // Will be set dynamically
  hasHttpsModule: false, // Will be set dynamically
  hasZlibModule: false, // Will be set dynamically
  hasUrlModule: false, // Will be set dynamically
  hasCryptoModule: false, // Will be set dynamically
};

// Type-safe way to update Environment properties
interface MutableEnvironment {
  hasHttpModule: boolean;
  hasHttpsModule: boolean;
  hasZlibModule: boolean;
  hasUrlModule: boolean;
  hasCryptoModule: boolean;
}

// Dynamically check Node.js modules if in Node.js environment
if (Environment.isNode) {
  const mutableEnv = Environment as unknown as MutableEnvironment;

  try {
    require.resolve('http');
    mutableEnv.hasHttpModule = true;
  } catch {
    /* Module not available */
  }

  try {
    require.resolve('https');
    mutableEnv.hasHttpsModule = true;
  } catch {
    /* Module not available */
  }

  try {
    require.resolve('zlib');
    mutableEnv.hasZlibModule = true;
  } catch {
    /* Module not available */
  }

  try {
    require.resolve('url');
    mutableEnv.hasUrlModule = true;
  } catch {
    /* Module not available */
  }

  try {
    require.resolve('crypto');
    mutableEnv.hasCryptoModule = true;
  } catch {
    /* Module not available */
  }
}

// Type guard for checking if a property exists on an object
function hasProperty<K extends string>(obj: unknown, prop: K): obj is Record<K, unknown> {
  return typeof obj === 'object' && obj !== null && prop in obj;
}

// Safe global access with proper typing
export function safeGlobal<T>(name: string): T | undefined {
  try {
    if (Environment.isNode && typeof global !== 'undefined' && hasProperty(global, name)) {
      return (global as Record<string, unknown>)[name] as T;
    }
    if (Environment.isBrowser && typeof window !== 'undefined' && hasProperty(window, name)) {
      return window[name] as T;
    }
    if (Environment.isWebWorker && typeof self !== 'undefined' && hasProperty(self, name)) {
      return self[name] as T;
    }
    // Fallback to globalThis
    if (typeof globalThis !== 'undefined' && hasProperty(globalThis, name)) {
      // Use type assertion with Record to safely access globalThis with string index
      return (globalThis as Record<string, unknown>)[name] as T;
    }
  } catch {
    // Access denied or not available
  }
  return undefined;
}

// Safe module require for Node.js
export function safeRequire<T>(moduleName: string): T | undefined {
  if (!Environment.isNode) {
    return undefined;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require(moduleName) as T;
  } catch {
    return undefined;
  }
}

// Platform-specific utilities
export const PlatformUtils = {
  // Get user agent safely
  getUserAgent(): string | undefined {
    if (Environment.hasNavigator && navigator.userAgent) {
      return navigator.userAgent;
    }
    return undefined;
  },

  // Get current origin safely
  getCurrentOrigin(): string | undefined {
    if (Environment.hasLocation && location.origin) {
      return location.origin;
    }
    if (Environment.hasLocation && location.protocol && location.host) {
      return `${location.protocol}//${location.host}`;
    }
    return undefined;
  },

  // Get document safely
  getDocument(): Document | undefined {
    return Environment.hasDocument ? document : undefined;
  },

  // Get window safely
  getWindow(): Window | undefined {
    return Environment.hasWindow ? window : undefined;
  },

  // Get crypto safely
  getCrypto(): Crypto | undefined {
    if (Environment.hasCrypto) {
      return crypto;
    }
    // Try Node.js crypto
    interface NodeCryptoModule {
      webcrypto?: Crypto;
    }
    const nodeCrypto = safeRequire<NodeCryptoModule>('crypto');
    if (nodeCrypto && typeof nodeCrypto === 'object' && nodeCrypto.webcrypto) {
      return nodeCrypto.webcrypto;
    }
    return undefined;
  },

  // Check if running in secure context
  isSecureContext(): boolean {
    if (Environment.isBrowser && typeof window !== 'undefined') {
      return Boolean(window.isSecureContext);
    }
    // In Node.js, consider it secure by default
    return Environment.isNode;
  },

  // Get current protocol
  getProtocol(): string | undefined {
    if (Environment.hasLocation && location.protocol) {
      return location.protocol;
    }
    return undefined;
  },

  // Check if HTTPS is available/required
  isHttpsRequired(): boolean {
    const protocol = this.getProtocol();
    return protocol === 'https:' || (!protocol && this.isSecureContext());
  },
};

// Polyfill utilities
export const Polyfills = {
  // Get AbortController (with polyfill if needed)
  getAbortController(): typeof AbortController | undefined {
    if (Environment.hasAbortController) {
      return AbortController;
    }
    // Could add polyfill here if needed
    return undefined;
  },

  // Get URL constructor (with polyfill if needed)
  getURL(): typeof URL | undefined {
    if (Environment.hasURL) {
      return URL;
    }
    // Could add polyfill here if needed
    return undefined;
  },

  // Get TextEncoder (with polyfill if needed)
  getTextEncoder(): typeof TextEncoder | undefined {
    if (Environment.hasTextEncoder) {
      return TextEncoder;
    }
    // Node.js util.TextEncoder
    interface NodeUtilModule {
      TextEncoder?: typeof TextEncoder;
    }
    const util = safeRequire<NodeUtilModule>('util');
    if (util && typeof util === 'object' && util.TextEncoder) {
      return util.TextEncoder;
    }
    return undefined;
  },

  // Get TextDecoder (with polyfill if needed)
  getTextDecoder(): typeof TextDecoder | undefined {
    if (Environment.hasTextDecoder) {
      return TextDecoder;
    }
    // Node.js util.TextDecoder
    interface NodeUtilModule {
      TextDecoder?: typeof TextDecoder;
    }
    const util = safeRequire<NodeUtilModule>('util');
    if (util && typeof util === 'object' && util.TextDecoder) {
      return util.TextDecoder;
    }
    return undefined;
  },

  // Get Buffer safely
  getBuffer(): typeof Buffer | undefined {
    if (Environment.hasBuffer) {
      return Buffer;
    }
    return undefined;
  },

  // Safe buffer creation
  createBuffer(data: string | Uint8Array, encoding?: BufferEncoding): Uint8Array {
    const BufferConstructor = this.getBuffer();
    if (BufferConstructor && typeof data === 'string') {
      return BufferConstructor.from(data, encoding);
    }
    if (BufferConstructor && data instanceof Uint8Array) {
      return BufferConstructor.from(data);
    }

    // Fallback: use TextEncoder
    const TextEncoderConstructor = this.getTextEncoder();
    if (TextEncoderConstructor && typeof data === 'string') {
      return new TextEncoderConstructor().encode(data);
    }

    if (data instanceof Uint8Array) {
      return data;
    }

    // Final fallback: convert string to Uint8Array manually
    if (typeof data === 'string') {
      const bytes = new Uint8Array(data.length);
      for (let i = 0; i < data.length; i++) {
        bytes[i] = data.charCodeAt(i) & 0xff;
      }
      return bytes;
    }

    return new Uint8Array(0);
  },

  // Safe buffer length calculation
  getByteLength(data: string, encoding: BufferEncoding = 'utf8'): number {
    const BufferConstructor = this.getBuffer();
    if (BufferConstructor) {
      return BufferConstructor.byteLength(data, encoding);
    }

    // Fallback: estimate based on encoding
    if (encoding === 'utf8' || encoding === 'utf-8') {
      // Conservative estimate for UTF-8
      return new Blob([data]).size || data.length * 3;
    }

    return data.length;
  },
};

// Export environment information for debugging
export function getEnvironmentInfo(): Record<string, unknown> {
  return {
    ...Environment,
    userAgent: PlatformUtils.getUserAgent(),
    origin: PlatformUtils.getCurrentOrigin(),
    protocol: PlatformUtils.getProtocol(),
    isSecureContext: PlatformUtils.isSecureContext(),
    isHttpsRequired: PlatformUtils.isHttpsRequired(),
  };
}
