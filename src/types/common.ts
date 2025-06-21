import type { CancelToken } from '../core/canceltoken';
import type { SecurityConfig } from '../core/security';

/**
 * Supported HTTP methods
 * @typedef {string} HttpMethod
 */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS';

/**
 * HTTP headers object
 * @typedef {Object} Headers
 */
export type Headers = Record<string, string | string[] | undefined>;

/**
 * URL query parameters
 * @typedef {Object} QueryParams
 */
export type QueryParams = Record<string, string | number | boolean | (string | number | boolean)[]>;

/**
 * Valid request body types
 * @typedef {*} RequestBody
 */
export type RequestBody =
  | string
  | Record<string, unknown>
  | FormData
  | URLSearchParams
  | ArrayBuffer
  | Blob
  | ReadableStream
  | null
  | undefined;

/**
 * Progress event for upload/download tracking
 * @interface FluxProgressEvent
 */
export interface FluxProgressEvent {
  /** Number of bytes loaded */
  loaded: number;
  /** Total number of bytes (if available) */
  total: number;
  /** Whether the total size is known */
  lengthComputable: boolean;
  /** Additional byte information */
  bytes?: number;
}

/**
 * Request configuration object
 * @interface fluxhttpRequestConfig
 */
export interface fluxhttpRequestConfig {
  /** Custom adapter function */
  adapter?: <T = unknown>(config: fluxhttpRequestConfig) => Promise<fluxhttpResponse<T>>;
  /** Request URL */
  url?: string;
  /** HTTP method */
  method?: HttpMethod;
  /** Base URL to prepend to url */
  baseURL?: string;
  /** Request headers */
  headers?: Headers;
  /** URL query parameters */
  params?: QueryParams;
  /** Request body data */
  data?: RequestBody;
  /** Request timeout in milliseconds (0 = no timeout) */
  timeout?: number;
  /** Whether to send credentials with cross-site requests */
  withCredentials?: boolean;
  /** Basic authentication credentials */
  auth?: {
    username: string;
    password: string;
  };
  /** Response data type */
  responseType?: 'json' | 'text' | 'blob' | 'arraybuffer' | 'stream';
  /** Response encoding (Node.js only) */
  responseEncoding?: string;
  /** Function to determine if status is success */
  validateStatus?: (status: number) => boolean;
  /** Maximum number of redirects to follow */
  maxRedirects?: number;
  /** Maximum response content length in bytes */
  maxContentLength?: number;
  /** Maximum request body length in bytes */
  maxBodyLength?: number;
  /** Whether to decompress response */
  decompress?: boolean;
  /** AbortController signal for cancellation */
  signal?: AbortSignal;
  /** Cancel token for legacy cancellation */
  cancelToken?: CancelToken;
  /** Upload progress callback */
  onUploadProgress?: (progressEvent: FluxProgressEvent) => void;
  /** Download progress callback */
  onDownloadProgress?: (progressEvent: FluxProgressEvent) => void;
  /** Retry configuration */
  retry?: RetryConfig;
  /** Cache configuration */
  cache?: CacheConfig;
  /** Security configuration */
  security?: SecurityConfig;
  /** Request data transformers */
  transformRequest?: Array<(data: unknown, headers?: Headers) => unknown>;
  /** Response data transformers */
  transformResponse?: Array<(data: unknown) => unknown>;
}

/**
 * Retry configuration for failed requests
 * @interface RetryConfig
 */
export interface RetryConfig {
  /** Maximum number of retry attempts */
  attempts?: number;
  /** Initial delay between retries in milliseconds */
  delay?: number;
  /** Maximum delay between retries in milliseconds */
  maxDelay?: number;
  /** Backoff strategy for increasing delay */
  backoff?: 'exponential' | 'linear' | 'constant';
  /** Custom function to determine if request should be retried */
  retryCondition?: (error: fluxhttpError) => boolean;
}

/**
 * Cache configuration for HTTP responses
 * @interface CacheConfig
 */
export interface CacheConfig {
  /** Whether caching is enabled */
  enabled?: boolean;
  /** Time to live in milliseconds */
  ttl?: number;
  /** Custom cache key generator */
  key?: (config: fluxhttpRequestConfig) => string;
  /** Cache storage backend */
  storage?: 'memory' | 'localStorage' | 'sessionStorage' | CacheStorage;
  /** Headers to exclude from cache */
  excludeHeaders?: string[];
}

/**
 * HTTP response object
 * @interface fluxhttpResponse
 * @template T - Response data type
 */
export interface fluxhttpResponse<T = unknown> {
  /** Response data */
  data: T;
  /** HTTP status code */
  status: number;
  /** HTTP status message */
  statusText: string;
  /** Response headers */
  headers: Headers;
  /** Request configuration */
  config: fluxhttpRequestConfig;
  /** Native request object (XMLHttpRequest, ClientRequest, etc.) */
  request?: unknown;
}

/**
 * fluxhttp error object
 * @interface fluxhttpError
 * @extends {Error}
 */
export interface fluxhttpError extends Error {
  /** Request configuration */
  config?: fluxhttpRequestConfig;
  /** Error code */
  code?: string;
  /** Native request object */
  request?: unknown;
  /** Response object (if available) */
  response?: fluxhttpResponse;
  /** Type guard property */
  isfluxhttpError: boolean;
  /** Serialize error to JSON */
  toJSON: () => Record<string, unknown>;
}

export interface ProgressEvent {
  loaded: number;
  total?: number;
  progress?: number;
  bytes: number;
  rate?: number;
  estimated?: number;
  upload?: boolean;
}

export interface InterceptorManager<T> {
  use(
    onFulfilled?: (value: T) => T | Promise<T>,
    onRejected?: (error: unknown) => unknown,
    options?: InterceptorOptions
  ): number;
  eject(id: number): void;
  clear(): void;
}

export interface InterceptorOptions {
  synchronous?: boolean;
  runWhen?: (config: fluxhttpRequestConfig) => boolean;
}

export interface fluxhttpInstance {
  defaults: fluxhttpRequestConfig;
  interceptors: {
    request: InterceptorManager<fluxhttpRequestConfig>;
    response: InterceptorManager<fluxhttpResponse>;
  };

  request<T = unknown>(config: fluxhttpRequestConfig): Promise<fluxhttpResponse<T>>;
  request<T = unknown>(url: string): Promise<fluxhttpResponse<T>>;
  get<T = unknown>(url: string, config?: fluxhttpRequestConfig): Promise<fluxhttpResponse<T>>;
  delete<T = unknown>(url: string, config?: fluxhttpRequestConfig): Promise<fluxhttpResponse<T>>;
  head<T = unknown>(url: string, config?: fluxhttpRequestConfig): Promise<fluxhttpResponse<T>>;
  options<T = unknown>(url: string, config?: fluxhttpRequestConfig): Promise<fluxhttpResponse<T>>;
  post<T = unknown>(
    url: string,
    data?: RequestBody,
    config?: fluxhttpRequestConfig
  ): Promise<fluxhttpResponse<T>>;
  put<T = unknown>(
    url: string,
    data?: RequestBody,
    config?: fluxhttpRequestConfig
  ): Promise<fluxhttpResponse<T>>;
  patch<T = unknown>(
    url: string,
    data?: RequestBody,
    config?: fluxhttpRequestConfig
  ): Promise<fluxhttpResponse<T>>;

  getUri(config?: fluxhttpRequestConfig): string;
}

export interface fluxhttpStatic extends fluxhttpInstance {
  create(config?: fluxhttpRequestConfig): fluxhttpInstance;
  isCancel(value: unknown): boolean;
  all<T>(values: Array<T | Promise<T>>): Promise<T[]>;
  spread<T, R>(callback: (...args: T[]) => R): (array: T[]) => R;
  isfluxhttpError(value: unknown): value is fluxhttpError;
}
