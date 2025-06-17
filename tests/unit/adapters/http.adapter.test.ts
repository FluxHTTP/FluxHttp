import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { FluxHTTPRequestConfig } from '../../../src/types';
import { EventEmitter } from 'events';

// Create mocks before imports
const mockHttpRequest = vi.fn();
const mockHttpsRequest = vi.fn();
const mockCreateGunzip = vi.fn();
const mockCreateInflate = vi.fn();
const mockCreateBrotliDecompress = vi.fn();

vi.mock('http', () => {
  return {
    default: { request: (): unknown => mockHttpRequest() },
    request: (): unknown => mockHttpRequest(),
  };
});

vi.mock('https', () => {
  return {
    default: { request: (): unknown => mockHttpsRequest() },
    request: (): unknown => mockHttpsRequest(),
  };
});

vi.mock('zlib', () => {
  return {
    createGunzip: (): unknown => mockCreateGunzip(),
    createInflate: (): unknown => mockCreateInflate(),
    createBrotliDecompress: (): unknown => mockCreateBrotliDecompress(),
  };
});

describe.skip('httpAdapter', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockRequest: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockResponse: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Create mock request
    mockRequest = Object.assign(new EventEmitter(), {
      end: vi.fn(),
      write: vi.fn(),
      destroy: vi.fn(),
      setTimeout: vi.fn(),
      destroyed: false,
    });

    // Create mock response
    mockResponse = Object.assign(new EventEmitter(), {
      statusCode: 200,
      statusMessage: 'OK',
      headers: {
        'content-type': 'application/json',
      },
      pipe: vi.fn().mockReturnThis(),
    });

    // Setup default mock returns
    mockHttpRequest.mockReturnValue(mockRequest);
    mockHttpsRequest.mockReturnValue(mockRequest);

    // Dynamic import after mocks are set up
    const { httpAdapter } = await import('../../../src/adapters/http.adapter');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
    (global as any).httpAdapter = httpAdapter;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  const getHttpAdapter = () => (global as any).httpAdapter;

  it('should make a successful GET request', async () => {
    const config: FluxHTTPRequestConfig = {
      url: 'http://api.example.com/test',
      method: 'GET',
    };

    const responsePromise = getHttpAdapter()(config);

    // Get the callback that was passed to request
    const requestCallback = mockHttpRequest.mock.results[0]?.value;

    // Emit request callback with response
    process.nextTick(() => {
      requestCallback.emit('response', mockResponse);
      mockResponse.emit('data', Buffer.from('{"data":"test"}'));
      mockResponse.emit('end');
    });

    const response = await responsePromise;

    expect(response.status).toBe(200);
    expect(response.data).toEqual({ data: 'test' });
    expect(mockRequest.end).toHaveBeenCalled();
  });

  it('should reject when URL is missing', async () => {
    const config: FluxHTTPRequestConfig = {};

    await expect(getHttpAdapter()(config)).rejects.toThrow(/URL is required/);
  });
});
