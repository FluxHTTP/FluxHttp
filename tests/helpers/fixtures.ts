import type {
  fluxhttpRequestConfig,
  fluxhttpResponse,
  fluxhttpError as FluxHttpErrorType,
} from '../../src/types/core.js';

/**
 * Test fixtures and mock data for consistent testing
 */

/**
 * Sample request configurations
 */
export const requestConfigs = {
  basic: {
    url: 'https://api.test.com/users',
    method: 'GET' as const,
    headers: {},
    timeout: 5000,
  },

  withAuth: {
    url: 'https://api.test.com/protected',
    method: 'GET' as const,
    headers: {
      'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
      'Content-Type': 'application/json',
    },
    timeout: 10000,
  },

  postWithData: {
    url: 'https://api.test.com/users',
    method: 'POST' as const,
    headers: {
      'Content-Type': 'application/json',
    },
    data: {
      name: 'John Doe',
      email: 'john@example.com',
      age: 30,
    },
    timeout: 5000,
  },

  withBaseURL: {
    baseURL: 'https://api.test.com',
    url: '/users/123',
    method: 'GET' as const,
    headers: {},
    timeout: 5000,
  },

  withQueryParams: {
    url: 'https://api.test.com/search',
    method: 'GET' as const,
    params: {
      q: 'javascript',
      page: 1,
      limit: 10,
    },
    timeout: 5000,
  },

  withCustomHeaders: {
    url: 'https://api.test.com/data',
    method: 'GET' as const,
    headers: {
      'Accept': 'application/vnd.api+json',
      'X-API-Version': '2',
      'X-Client-ID': 'test-client',
      'User-Agent': 'FluxHTTP/1.0.0',
    },
    timeout: 5000,
  },

  fileUpload: {
    url: 'https://api.test.com/upload',
    method: 'POST' as const,
    headers: {
      'Content-Type': 'multipart/form-data',
    },
    data: new FormData(),
    timeout: 30000,
  },

  longPolling: {
    url: 'https://api.test.com/events',
    method: 'GET' as const,
    headers: {
      'Accept': 'text/event-stream',
      'Cache-Control': 'no-cache',
    },
    timeout: 60000,
  },
} as const satisfies Record<string, fluxhttpRequestConfig>;

/**
 * Sample response data
 */
export const responseData = {
  user: {
    id: 1,
    name: 'John Doe',
    email: 'john@example.com',
    avatar: 'https://example.com/avatar.jpg',
    created_at: '2023-01-01T00:00:00Z',
    updated_at: '2023-01-01T00:00:00Z',
  },

  users: [
    {
      id: 1,
      name: 'John Doe',
      email: 'john@example.com',
    },
    {
      id: 2,
      name: 'Jane Smith',
      email: 'jane@example.com',
    },
    {
      id: 3,
      name: 'Bob Johnson',
      email: 'bob@example.com',
    },
  ],

  pagination: {
    data: [
      { id: 1, name: 'Item 1' },
      { id: 2, name: 'Item 2' },
    ],
    meta: {
      page: 1,
      limit: 10,
      total: 100,
      pages: 10,
    },
    links: {
      first: 'https://api.test.com/items?page=1',
      last: 'https://api.test.com/items?page=10',
      next: 'https://api.test.com/items?page=2',
      prev: null,
    },
  },

  empty: null,
  emptyArray: [],
  emptyObject: {},

  largeData: {
    items: Array.from({ length: 1000 }, (_, i) => ({
      id: i + 1,
      name: `Item ${i + 1}`,
      description: `Description for item ${i + 1}`.repeat(10),
    })),
  },

  binaryData: new Uint8Array([0x48, 0x65, 0x6c, 0x6c, 0x6f]), // "Hello" in bytes

  jsonString: '{"message":"Hello, World!","timestamp":"2023-01-01T00:00:00Z"}',

  xmlString: '<?xml version="1.0"?><root><message>Hello, World!</message></root>',

  csvString: 'name,email,age\nJohn Doe,john@example.com,30\nJane Smith,jane@example.com,25',

  htmlString: '<!DOCTYPE html><html><head><title>Test</title></head><body><h1>Hello</h1></body></html>',
} as const;

/**
 * Sample responses
 */
export const responses = {
  success: {
    data: responseData.user,
    status: 200,
    statusText: 'OK',
    headers: {
      'content-type': 'application/json',
      'cache-control': 'no-cache',
    },
    config: requestConfigs.basic,
    request: {},
  },

  created: {
    data: responseData.user,
    status: 201,
    statusText: 'Created',
    headers: {
      'content-type': 'application/json',
      'location': 'https://api.test.com/users/1',
    },
    config: requestConfigs.postWithData,
    request: {},
  },

  noContent: {
    data: null,
    status: 204,
    statusText: 'No Content',
    headers: {},
    config: requestConfigs.basic,
    request: {},
  },

  notFound: {
    data: {
      error: 'User not found',
      code: 'USER_NOT_FOUND',
    },
    status: 404,
    statusText: 'Not Found',
    headers: {
      'content-type': 'application/json',
    },
    config: requestConfigs.basic,
    request: {},
  },

  unauthorized: {
    data: {
      error: 'Unauthorized',
      message: 'Invalid or missing authentication token',
    },
    status: 401,
    statusText: 'Unauthorized',
    headers: {
      'content-type': 'application/json',
      'www-authenticate': 'Bearer',
    },
    config: requestConfigs.withAuth,
    request: {},
  },

  forbidden: {
    data: {
      error: 'Forbidden',
      message: 'Insufficient permissions',
    },
    status: 403,
    statusText: 'Forbidden',
    headers: {
      'content-type': 'application/json',
    },
    config: requestConfigs.withAuth,
    request: {},
  },

  serverError: {
    data: {
      error: 'Internal Server Error',
      message: 'An unexpected error occurred',
      timestamp: '2023-01-01T00:00:00Z',
    },
    status: 500,
    statusText: 'Internal Server Error',
    headers: {
      'content-type': 'application/json',
    },
    config: requestConfigs.basic,
    request: {},
  },

  badGateway: {
    data: 'Bad Gateway',
    status: 502,
    statusText: 'Bad Gateway',
    headers: {
      'content-type': 'text/plain',
    },
    config: requestConfigs.basic,
    request: {},
  },

  timeout: {
    data: null,
    status: 0,
    statusText: '',
    headers: {},
    config: requestConfigs.basic,
    request: {},
  },
} as const satisfies Record<string, fluxhttpResponse<any>>;

/**
 * Sample error objects
 */
export const errors = {
  network: {
    message: 'Network Error',
    code: 'NETWORK_ERROR',
    config: requestConfigs.basic,
  },

  timeout: {
    message: 'Request timeout',
    code: 'ECONNABORTED',
    config: requestConfigs.basic,
  },

  canceled: {
    message: 'Request canceled',
    code: 'ERR_CANCELED',
    config: requestConfigs.basic,
  },

  badRequest: {
    message: 'Request failed with status code 400',
    code: 'ERR_BAD_REQUEST',
    config: requestConfigs.postWithData,
    response: {
      data: {
        error: 'Validation failed',
        details: [
          { field: 'email', message: 'Invalid email format' },
          { field: 'age', message: 'Age must be a positive number' },
        ],
      },
      status: 400,
      statusText: 'Bad Request',
      headers: {
        'content-type': 'application/json',
      },
    },
  },

  notFound: {
    message: 'Request failed with status code 404',
    code: 'ERR_NOT_FOUND',
    config: requestConfigs.basic,
    response: responses.notFound,
  },

  serverError: {
    message: 'Request failed with status code 500',
    code: 'ERR_SERVER_ERROR',
    config: requestConfigs.basic,
    response: responses.serverError,
  },
} as const;

/**
 * Test URLs for different scenarios
 */
export const urls = {
  valid: {
    http: 'http://example.com',
    https: 'https://example.com',
    withPort: 'https://example.com:8080',
    withPath: 'https://example.com/api/v1/users',
    withQuery: 'https://example.com/search?q=test&page=1',
    withFragment: 'https://example.com/page#section',
    ipv4: 'https://192.168.1.1/api',
    ipv6: 'https://[::1]:8080/api',
    localhost: 'http://localhost:3000',
    subdomain: 'https://api.example.com',
  },

  invalid: {
    empty: '',
    noProtocol: 'example.com',
    invalidProtocol: 'ftp://example.com',
    malformed: 'https://exam ple.com',
    noHost: 'https://',
    invalidChars: 'https://example.com/<>',
  },

  relative: {
    simple: '/api/users',
    withQuery: '/api/users?page=1',
    withFragment: '/api/users#top',
    nested: '/api/v1/users/123/profile',
    encoded: '/api/users?name=John%20Doe',
  },

  protocolRelative: {
    simple: '//api.example.com',
    withPath: '//api.example.com/users',
    withQuery: '//api.example.com/search?q=test',
  },
} as const;

/**
 * Test headers for different scenarios
 */
export const headers = {
  contentTypes: {
    json: { 'Content-Type': 'application/json' },
    xml: { 'Content-Type': 'application/xml' },
    text: { 'Content-Type': 'text/plain' },
    html: { 'Content-Type': 'text/html' },
    form: { 'Content-Type': 'application/x-www-form-urlencoded' },
    multipart: { 'Content-Type': 'multipart/form-data' },
    octetStream: { 'Content-Type': 'application/octet-stream' },
  },

  authentication: {
    bearer: { 'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' },
    basic: { 'Authorization': 'Basic dXNlcm5hbWU6cGFzc3dvcmQ=' },
    apiKey: { 'X-API-Key': 'sk_test_1234567890abcdef' },
    custom: { 'X-Auth-Token': 'custom-token-12345' },
  },

  caching: {
    noCache: { 'Cache-Control': 'no-cache' },
    maxAge: { 'Cache-Control': 'max-age=3600' },
    etag: { 'ETag': '"33a64df551425fcc55e4d42a148795d9f25f89d4"' },
    lastModified: { 'Last-Modified': 'Wed, 21 Oct 2015 07:28:00 GMT' },
  },

  cors: {
    simple: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
    withCredentials: {
      'Access-Control-Allow-Origin': 'https://example.com',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  },

  custom: {
    userAgent: { 'User-Agent': 'FluxHTTP/1.0.0 (Test Suite)' },
    accept: { 'Accept': 'application/vnd.api+json' },
    acceptLanguage: { 'Accept-Language': 'en-US,en;q=0.9' },
    acceptEncoding: { 'Accept-Encoding': 'gzip, deflate, br' },
    referer: { 'Referer': 'https://example.com/previous-page' },
  },

  security: {
    csp: { 'Content-Security-Policy': "default-src 'self'" },
    hsts: { 'Strict-Transport-Security': 'max-age=31536000; includeSubDomains' },
    xframe: { 'X-Frame-Options': 'DENY' },
    xss: { 'X-XSS-Protection': '1; mode=block' },
    contentType: { 'X-Content-Type-Options': 'nosniff' },
  },
} as const;

/**
 * Helper functions for creating test data
 */
export const helpers = {
  /**
   * Create a request config with overrides
   */
  createRequestConfig(overrides: Partial<fluxhttpRequestConfig> = {}): fluxhttpRequestConfig {
    return {
      ...requestConfigs.basic,
      ...overrides,
    };
  },

  /**
   * Create a response with overrides
   */
  createResponse<T = any>(
    data: T,
    overrides: Partial<fluxhttpResponse<T>> = {}
  ): fluxhttpResponse<T> {
    return {
      data,
      status: 200,
      statusText: 'OK',
      headers: {},
      config: requestConfigs.basic,
      request: {},
      ...overrides,
    };
  },

  /**
   * Create an error with overrides
   */
  createError(overrides: Partial<FluxHttpErrorType> = {}): FluxHttpErrorType {
    return {
      message: 'Test error',
      name: 'fluxhttpError',
      code: 'TEST_ERROR',
      config: requestConfigs.basic,
      ...overrides,
    } as FluxHttpErrorType;
  },

  /**
   * Generate random test data
   */
  randomData: {
    string: (length: number = 10): string => {
      const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      return Array.from({ length }, () => chars.charAt(Math.floor(Math.random() * chars.length))).join('');
    },

    number: (min: number = 0, max: number = 100): number => {
      return Math.floor(Math.random() * (max - min + 1)) + min;
    },

    boolean: (): boolean => {
      return Math.random() < 0.5;
    },

    array: <T>(generator: () => T, length: number = 5): T[] => {
      return Array.from({ length }, generator);
    },

    object: (keys: string[]): Record<string, any> => {
      const obj: Record<string, any> = {};
      for (const key of keys) {
        obj[key] = helpers.randomData.string();
      }
      return obj;
    },
  },
};