import type {
  fluxhttpRequestConfig,
  fluxhttpResponse,
  fluxhttpError as IfluxhttpError,
} from '../types';

export class fluxhttpError extends Error implements IfluxhttpError {
  config?: fluxhttpRequestConfig;
  code?: string;
  request?: unknown;
  response?: fluxhttpResponse;
  isfluxhttpError: boolean = true;

  constructor(
    message: string,
    code?: string,
    config?: fluxhttpRequestConfig,
    request?: unknown,
    response?: fluxhttpResponse
  ) {
    super(message);
    this.name = 'fluxhttpError';
    this.code = code;
    this.config = config;
    this.request = request;
    this.response = response;

    // Make message enumerable
    Object.defineProperty(this, 'message', {
      value: message,
      enumerable: true,
      configurable: true,
      writable: true,
    });

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  toJSON(): Record<string, unknown> {
    const result: Record<string, unknown> = {
      name: this.name,
      message: this.message,
      stack: this.stack,
      code: this.code,
      status: this.response?.status,
    };

    // Handle config with potential circular references
    if (this.config) {
      try {
        result.config = JSON.parse(JSON.stringify(this.config));
      } catch {
        result.config = { url: this.config.url, method: this.config.method };
      }
    }

    // Handle response with potential circular references
    if (this.response) {
      try {
        result.response = JSON.parse(JSON.stringify(this.response));
      } catch {
        result.response = {
          status: this.response.status,
          statusText: this.response.statusText,
          data: typeof this.response.data === 'string' ? this.response.data : '[Object]',
        };
      }
    }

    return result;
  }

  static from(
    error: Error | fluxhttpError,
    code?: string,
    config?: fluxhttpRequestConfig,
    request?: unknown,
    response?: fluxhttpResponse
  ): fluxhttpError {
    if (error instanceof fluxhttpError) {
      return error;
    }

    const httpError = new fluxhttpError(
      error.message || 'Unknown error occurred',
      code,
      config,
      request,
      response
    );

    httpError.stack = error.stack;
    return httpError;
  }

  static isfluxhttpError(value: unknown): value is fluxhttpError {
    return (
      value instanceof fluxhttpError ||
      (typeof value === 'object' && value !== null && 'isfluxhttpError' in value)
    );
  }
}
