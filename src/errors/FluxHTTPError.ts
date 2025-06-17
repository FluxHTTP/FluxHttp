import type {
  FluxHTTPRequestConfig,
  FluxHTTPResponse,
  FluxHTTPError as IFluxHTTPError,
} from '../types';

export class FluxHTTPError extends Error implements IFluxHTTPError {
  config?: FluxHTTPRequestConfig;
  code?: string;
  request?: unknown;
  response?: FluxHTTPResponse;
  isFluxHTTPError: boolean = true;

  constructor(
    message: string,
    code?: string,
    config?: FluxHTTPRequestConfig,
    request?: unknown,
    response?: FluxHTTPResponse
  ) {
    super(message);
    this.name = 'FluxHTTPError';
    this.code = code;
    this.config = config;
    this.request = request;
    this.response = response;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      stack: this.stack,
      config: this.config,
      code: this.code,
      status: this.response?.status,
    };
  }

  static from(
    error: Error | FluxHTTPError,
    code?: string,
    config?: FluxHTTPRequestConfig,
    request?: unknown,
    response?: FluxHTTPResponse
  ): FluxHTTPError {
    if (error instanceof FluxHTTPError) {
      return error;
    }

    const httpError = new FluxHTTPError(
      error.message || 'Unknown error occurred',
      code,
      config,
      request,
      response
    );

    httpError.stack = error.stack;
    return httpError;
  }

  static isFluxHTTPError(value: unknown): value is FluxHTTPError {
    return (
      value instanceof FluxHTTPError ||
      (typeof value === 'object' && value !== null && 'isFluxHTTPError' in value)
    );
  }
}
