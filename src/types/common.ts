import type { CancelToken } from '../core/canceltoken';
import type { SecurityConfig } from '../core/security';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS';

export type Headers = Record<string, string | string[] | undefined>;

export type QueryParams = Record<string, string | number | boolean | (string | number | boolean)[]>;

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

export interface FluxProgressEvent {
  loaded: number;
  total: number;
  lengthComputable: boolean;
  bytes?: number;
}

export interface fluxhttpRequestConfig {
  adapter?: <T = unknown>(config: fluxhttpRequestConfig) => Promise<fluxhttpResponse<T>>;
  url?: string;
  method?: HttpMethod;
  baseURL?: string;
  headers?: Headers;
  params?: QueryParams;
  data?: RequestBody;
  timeout?: number;
  withCredentials?: boolean;
  auth?: {
    username: string;
    password: string;
  };
  responseType?: 'json' | 'text' | 'blob' | 'arraybuffer' | 'stream';
  responseEncoding?: string;
  validateStatus?: (status: number) => boolean;
  maxRedirects?: number;
  maxContentLength?: number;
  maxBodyLength?: number;
  decompress?: boolean;
  signal?: AbortSignal;
  cancelToken?: CancelToken;
  onUploadProgress?: (progressEvent: FluxProgressEvent) => void;
  onDownloadProgress?: (progressEvent: FluxProgressEvent) => void;
  retry?: RetryConfig;
  cache?: CacheConfig;
  security?: SecurityConfig;
  transformRequest?: Array<(data: unknown, headers?: Headers) => unknown>;
  transformResponse?: Array<(data: unknown) => unknown>;
}

export interface RetryConfig {
  attempts?: number;
  delay?: number;
  maxDelay?: number;
  backoff?: 'exponential' | 'linear' | 'constant';
  retryCondition?: (error: fluxhttpError) => boolean;
}

export interface CacheConfig {
  enabled?: boolean;
  ttl?: number;
  key?: (config: fluxhttpRequestConfig) => string;
  storage?: 'memory' | 'localStorage' | 'sessionStorage' | CacheStorage;
  excludeHeaders?: string[];
}

export interface fluxhttpResponse<T = unknown> {
  data: T;
  status: number;
  statusText: string;
  headers: Headers;
  config: fluxhttpRequestConfig;
  request?: unknown;
}

export interface fluxhttpError extends Error {
  config?: fluxhttpRequestConfig;
  code?: string;
  request?: unknown;
  response?: fluxhttpResponse;
  isfluxhttpError: boolean;
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
