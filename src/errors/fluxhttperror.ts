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
   * Serialize error to JSON-safe object with sensitive data protection
   * @returns {Record<string, unknown>} JSON representation of the error
   * @description Safely handles circular references and removes sensitive information
   */
  toJSON(): Record<string, unknown> {
    const result: Record<string, unknown> = {
      name: this.name,
      message: this.sanitizeMessage(this.message),
      stack: this.sanitizeStackTrace(this.stack),
      code: this.code,
      status: this.response?.status,
    };

    // Handle config with potential circular references and sensitive data removal
    if (this.config) {
      try {
        const sanitizedConfig = this.sanitizeConfig(this.config);
        result.config = JSON.parse(JSON.stringify(sanitizedConfig));
      } catch {
        result.config = { 
          url: this.sanitizeURL(this.config.url), 
          method: this.config.method 
        };
      }
    }

    // Handle response with potential circular references and sensitive data removal
    if (this.response) {
      try {
        const sanitizedResponse = this.sanitizeResponse(this.response);
        result.response = JSON.parse(JSON.stringify(sanitizedResponse));
      } catch {
        result.response = {
          status: this.response.status,
          statusText: this.response.statusText,
          data: this.sanitizeResponseData(this.response.data),
        };
      }
    }

    return result;
  }

  /**
   * SECURITY: Sanitize error messages to remove sensitive information
   */
  private sanitizeMessage(message: string): string {
    if (!message) return message;

    const sensitivePatterns = [
      /password[=:]\s*[^\s&]+/gi,
      /token[=:]\s*[^\s&]+/gi,
      /key[=:]\s*[^\s&]+/gi,
      /secret[=:]\s*[^\s&]+/gi,
      /auth[=:]\s*[^\s&]+/gi,
      /bearer\s+[^\s&]+/gi,
      /basic\s+[^\s&]+/gi,
      /\b(?:\d{3}[-.]?\d{2}[-.]?\d{4})\b/g, // SSN pattern
      /\b(?:\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4})\b/g, // Credit card pattern
    ];

    let sanitized = message;
    sensitivePatterns.forEach(pattern => {
      sanitized = sanitized.replace(pattern, '[REDACTED]');
    });

    return sanitized;
  }

  /**
   * SECURITY: Sanitize stack traces to remove sensitive paths
   */
  private sanitizeStackTrace(stack?: string): string | undefined {
    if (!stack) return stack;

    // Remove sensitive file paths and internal details in production
    if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'production') {
      return 'Stack trace hidden in production';
    }

    // Sanitize file paths
    return stack
      .replace(/\/[^\s]+\/node_modules\//g, '[NODE_MODULES]/')
      .replace(/[A-Z]:\\[^\s]*/g, '[PATH]')
      .replace(/\/home\/[^\/\s]+/g, '/home/[USER]')
      .replace(/\/Users\/[^\/\s]+/g, '/Users/[USER]');
  }

  /**
   * SECURITY: Sanitize config object to remove sensitive data
   */
  private sanitizeConfig(config: fluxhttpRequestConfig): Partial<fluxhttpRequestConfig> {
    const sanitized: Partial<fluxhttpRequestConfig> = {
      method: config.method,
      url: this.sanitizeURL(config.url),
      timeout: config.timeout,
    };

    // Sanitize headers
    if (config.headers) {
      sanitized.headers = this.sanitizeHeaders(config.headers);
    }

    // Remove sensitive data from request body
    if (config.data) {
      sanitized.data = '[REDACTED]';
    }

    return sanitized;
  }

  /**
   * SECURITY: Sanitize response object
   */
  private sanitizeResponse(response: fluxhttpResponse): Partial<fluxhttpResponse> {
    return {
      status: response.status,
      statusText: response.statusText,
      headers: this.sanitizeHeaders(response.headers),
      data: this.sanitizeResponseData(response.data),
    };
  }

  /**
   * SECURITY: Sanitize headers to remove sensitive information
   */
  private sanitizeHeaders(headers: Record<string, unknown>): Record<string, unknown> {
    const sanitized: Record<string, unknown> = {};
    const sensitiveHeaders = [
      'authorization', 'cookie', 'set-cookie', 'x-api-key', 
      'x-auth-token', 'x-csrf-token', 'x-session-id'
    ];

    for (const [key, value] of Object.entries(headers)) {
      if (sensitiveHeaders.includes(key.toLowerCase())) {
        sanitized[key] = '[REDACTED]';
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  /**
   * SECURITY: Sanitize URLs to remove sensitive query parameters
   */
  private sanitizeURL(url?: string): string | undefined {
    if (!url) return url;

    try {
      const urlObj = new URL(url);
      const sensitiveParams = ['password', 'token', 'key', 'secret', 'auth', 'api_key'];
      
      sensitiveParams.forEach(param => {
        if (urlObj.searchParams.has(param)) {
          urlObj.searchParams.set(param, '[REDACTED]');
        }
      });

      return urlObj.toString();
    } catch {
      // If URL parsing fails, just remove query string
      return url.split('?')[0];
    }
  }

  /**
   * SECURITY: Sanitize response data
   */
  private sanitizeResponseData(data: unknown): unknown {
    if (typeof data === 'string') {
      return data.length > 1000 ? '[LARGE_RESPONSE_TRUNCATED]' : data;
    }
    
    if (typeof data === 'object' && data !== null) {
      return '[OBJECT]';
    }
    
    return data;
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
