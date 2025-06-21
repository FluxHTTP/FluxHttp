import type {
  fluxhttpRequestConfig,
  fluxhttpResponse,
  fluxhttpError as IfluxhttpError,
} from '../types';

/**
 * fluxhttp error class for HTTP request failures
 * @class fluxhttpError
 * @extends {Error}
 * @implements {IfluxhttpError}
 * @description Custom error class that includes request/response context for debugging
 *
 * @example
 * ```typescript
 * try {
 *   await fluxhttp.get('/api/data');
 * } catch (error) {
 *   if (fluxhttpError.isfluxhttpError(error)) {
 *     console.log('Status:', error.response?.status);
 *     console.log('Data:', error.response?.data);
 *     console.log('Config:', error.config);
 *   }
 * }
 * ```
 */
export class fluxhttpError extends Error implements IfluxhttpError {
  /** Request configuration that caused the error */
  config?: fluxhttpRequestConfig;
  /** Error code */
  code?: string;
  /** Native request object */
  request?: unknown;
  /** Response object if available */
  response?: fluxhttpResponse;
  /** Type guard property */
  isfluxhttpError: boolean = true;

  /**
   * Create a fluxhttp error
   * @constructor
   * @param {string} message - Error message
   * @param {string} [code] - Error code
   * @param {fluxhttpRequestConfig} [config] - Request configuration
   * @param {unknown} [request] - Native request object
   * @param {fluxhttpResponse} [response] - Response object
   */
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

  /**
   * Serialize error to JSON-safe object
   * @returns {Record<string, unknown>} JSON representation of the error
   * @description Safely handles circular references in config and response objects
   */
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

  /**
   * Create fluxhttpError from another error instance
   * @static
   * @param {Error | fluxhttpError} error - Original error
   * @param {string} [code] - Error code
   * @param {fluxhttpRequestConfig} [config] - Request configuration
   * @param {unknown} [request] - Native request object
   * @param {fluxhttpResponse} [response] - Response object
   * @returns {fluxhttpError} New or existing fluxhttpError instance
   * @example
   * ```typescript
   * try {
   *   // Some operation
   * } catch (error) {
   *   throw fluxhttpError.from(error, 'NETWORK_ERROR', config);
   * }
   * ```
   */
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

  /**
   * Type guard to check if value is a fluxhttpError
   * @static
   * @param {unknown} value - Value to check
   * @returns {boolean} True if value is a fluxhttpError
   * @example
   * ```typescript
   * if (fluxhttpError.isfluxhttpError(error)) {
   *   console.log('HTTP error with status:', error.response?.status);
   * }
   * ```
   */
  static isfluxhttpError(value: unknown): value is fluxhttpError {
    return (
      value instanceof fluxhttpError ||
      (typeof value === 'object' && value !== null && 'isfluxhttpError' in value)
    );
  }
}
