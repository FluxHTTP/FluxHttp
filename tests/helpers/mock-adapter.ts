import type { fluxhttpRequestConfig, fluxhttpResponse, fluxhttpAdapter } from '../../src/types/core.js';

/**
 * Mock adapter for testing purposes
 * Provides a controllable adapter that can simulate various scenarios
 */
export class MockAdapter implements fluxhttpAdapter {
  public lastRequest: fluxhttpRequestConfig | null = null;
  public mockResponse: fluxhttpResponse<any> | null = null;
  public shouldFail: boolean = false;
  public failureError: Error | null = null;
  public delay: number = 0;
  public requestCount: number = 0;
  public requestHistory: fluxhttpRequestConfig[] = [];

  constructor() {
    this.reset();
  }

  /**
   * Set a mock response to return
   */
  setMockResponse<T = any>(response: fluxhttpResponse<T>): void {
    this.mockResponse = response;
  }

  /**
   * Set the adapter to fail with a specific error
   */
  setFailure(error: Error): void {
    this.shouldFail = true;
    this.failureError = error;
  }

  /**
   * Set a delay for the response (in milliseconds)
   */
  setDelay(ms: number): void {
    this.delay = ms;
  }

  /**
   * Reset the adapter to initial state
   */
  reset(): void {
    this.lastRequest = null;
    this.mockResponse = null;
    this.shouldFail = false;
    this.failureError = null;
    this.delay = 0;
    this.requestCount = 0;
    this.requestHistory = [];
  }

  /**
   * Implementation of the adapter interface
   */
  async request<T = any>(config: fluxhttpRequestConfig): Promise<fluxhttpResponse<T>> {
    this.lastRequest = config;
    this.requestHistory.push({ ...config });
    this.requestCount++;

    // Simulate delay if set
    if (this.delay > 0) {
      await new Promise(resolve => setTimeout(resolve, this.delay));
    }

    // Simulate failure if configured
    if (this.shouldFail) {
      throw this.failureError || new Error('Mock adapter failure');
    }

    // Return mock response or default response
    return this.mockResponse || {
      data: {} as T,
      status: 200,
      statusText: 'OK',
      headers: {},
      config,
      request: {},
    };
  }

  /**
   * Get the number of requests made
   */
  getRequestCount(): number {
    return this.requestCount;
  }

  /**
   * Get the history of all requests made
   */
  getRequestHistory(): fluxhttpRequestConfig[] {
    return [...this.requestHistory];
  }

  /**
   * Get the last request made
   */
  getLastRequest(): fluxhttpRequestConfig | null {
    return this.lastRequest;
  }

  /**
   * Check if a request was made with specific properties
   */
  wasRequestMadeWith(partial: Partial<fluxhttpRequestConfig>): boolean {
    return this.requestHistory.some(request => {
      return Object.entries(partial).every(([key, value]) => {
        return (request as any)[key] === value;
      });
    });
  }

  /**
   * Create a simple mock response
   */
  static createMockResponse<T = any>(
    data: T,
    status: number = 200,
    statusText: string = 'OK',
    headers: Record<string, string> = {}
  ): fluxhttpResponse<T> {
    return {
      data,
      status,
      statusText,
      headers,
      config: {} as fluxhttpRequestConfig,
      request: {},
    };
  }

  /**
   * Create a mock error response
   */
  static createMockErrorResponse(
    status: number,
    statusText: string,
    data?: any
  ): fluxhttpResponse<any> {
    return {
      data: data || { error: statusText },
      status,
      statusText,
      headers: {},
      config: {} as fluxhttpRequestConfig,
      request: {},
    };
  }

  /**
   * Create a mock network error
   */
  static createNetworkError(message: string = 'Network Error'): Error {
    const error = new Error(message);
    (error as any).code = 'NETWORK_ERROR';
    return error;
  }

  /**
   * Create a mock timeout error
   */
  static createTimeoutError(message: string = 'Timeout Error'): Error {
    const error = new Error(message);
    (error as any).code = 'ECONNABORTED';
    return error;
  }
}

/**
 * Factory function to create a mock adapter
 */
export function createMockAdapter(): MockAdapter {
  return new MockAdapter();
}

/**
 * Create a simple mock adapter function (for compatibility)
 */
export function createSimpleMockAdapter<T = any>(
  response?: fluxhttpResponse<T>
): fluxhttpAdapter {
  const adapter = new MockAdapter();
  if (response) {
    adapter.setMockResponse(response);
  }
  return adapter;
}