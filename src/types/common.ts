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

export interface FluxHTTPRequestConfig {
  adapter?: <T = unknown>(config: FluxHTTPRequestConfig) => Promise<FluxHTTPResponse<T>>;
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
  onUploadProgress?: (progressEvent: ProgressEvent) => void;
  onDownloadProgress?: (progressEvent: ProgressEvent) => void;
  retry?: RetryConfig;
  cache?: CacheConfig;
  transformRequest?: Array<(data: unknown, headers?: Headers) => unknown>;
  transformResponse?: Array<(data: unknown) => unknown>;
}

export interface RetryConfig {
  attempts?: number;
  delay?: number;
  maxDelay?: number;
  backoff?: 'exponential' | 'linear' | 'constant';
  retryCondition?: (error: FluxHTTPError) => boolean;
}

export interface CacheConfig {
  enabled?: boolean;
  ttl?: number;
  key?: (config: FluxHTTPRequestConfig) => string;
  storage?: 'memory' | 'localStorage' | 'sessionStorage' | CacheStorage;
  excludeHeaders?: string[];
}

export interface FluxHTTPResponse<T = unknown> {
  data: T;
  status: number;
  statusText: string;
  headers: Headers;
  config: FluxHTTPRequestConfig;
  request?: unknown;
}

export interface FluxHTTPError extends Error {
  config?: FluxHTTPRequestConfig;
  code?: string;
  request?: unknown;
  response?: FluxHTTPResponse;
  isFluxHTTPError: boolean;
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
  runWhen?: (config: FluxHTTPRequestConfig) => boolean;
}

export interface FluxHTTPInstance {
  defaults: FluxHTTPRequestConfig;
  interceptors: {
    request: InterceptorManager<FluxHTTPRequestConfig>;
    response: InterceptorManager<FluxHTTPResponse>;
  };

  request<T = unknown>(config: FluxHTTPRequestConfig): Promise<FluxHTTPResponse<T>>;
  get<T = unknown>(url: string, config?: FluxHTTPRequestConfig): Promise<FluxHTTPResponse<T>>;
  delete<T = unknown>(url: string, config?: FluxHTTPRequestConfig): Promise<FluxHTTPResponse<T>>;
  head<T = unknown>(url: string, config?: FluxHTTPRequestConfig): Promise<FluxHTTPResponse<T>>;
  options<T = unknown>(url: string, config?: FluxHTTPRequestConfig): Promise<FluxHTTPResponse<T>>;
  post<T = unknown>(
    url: string,
    data?: RequestBody,
    config?: FluxHTTPRequestConfig
  ): Promise<FluxHTTPResponse<T>>;
  put<T = unknown>(
    url: string,
    data?: RequestBody,
    config?: FluxHTTPRequestConfig
  ): Promise<FluxHTTPResponse<T>>;
  patch<T = unknown>(
    url: string,
    data?: RequestBody,
    config?: FluxHTTPRequestConfig
  ): Promise<FluxHTTPResponse<T>>;

  getUri(config?: FluxHTTPRequestConfig): string;
}

export interface FluxHTTPStatic extends FluxHTTPInstance {
  create(config?: FluxHTTPRequestConfig): FluxHTTPInstance;
  isCancel(value: unknown): boolean;
  all<T>(values: Array<T | Promise<T>>): Promise<T[]>;
  spread<T, R>(callback: (...args: T[]) => R): (array: T[]) => R;
  isFluxHTTPError(value: unknown): value is FluxHTTPError;
}
