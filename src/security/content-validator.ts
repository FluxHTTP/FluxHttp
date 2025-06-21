// SECURITY: Content validation for requests and responses

import type { fluxhttpRequestConfig, fluxhttpResponse } from '../types';
import { fluxhttpError } from '../errors/fluxhttperror';
import type { ContentValidationConfig } from './types';

// Environment detection
const isNode = typeof process !== 'undefined' && process.versions && process.versions.node;
const hasBuffer = typeof Buffer !== 'undefined';

/**
 * Content validator for security and size limits
 * Validates request/response content types and sizes
 */
export class ContentValidator {
  constructor(private config: Required<ContentValidationConfig>) {}

  /**
   * Validate request content before sending
   */
  validateRequest(config: fluxhttpRequestConfig): void {
    if (!this.config.enabled || !config.data) {
      return;
    }

    const dataSize = this.getDataSize(config.data);
    const maxSize = this.config.maxRequestSize;

    if (dataSize > maxSize) {
      throw new fluxhttpError(
        `Request size ${dataSize} exceeds maximum ${maxSize}`,
        'ERR_REQUEST_TOO_LARGE',
        config
      );
    }
  }

  /**
   * Validate response content after receiving
   */
  validateResponse(response: fluxhttpResponse): void {
    if (!this.config.enabled) {
      return;
    }

    const contentType = this.getResponseContentType(response);

    // Check blocked content types
    if (
      contentType &&
      this.config.blockedContentTypes.some((blocked) => contentType.includes(blocked))
    ) {
      throw new fluxhttpError(
        `Blocked content type: ${contentType}`,
        'ERR_BLOCKED_CONTENT_TYPE',
        response.config,
        undefined,
        response
      );
    }

    // Check allowed content types
    const allowedTypes = this.config.allowedContentTypes;
    if (
      allowedTypes.length > 0 &&
      contentType &&
      !allowedTypes.some((allowed) => contentType.includes(allowed))
    ) {
      throw new fluxhttpError(
        `Content type not allowed: ${contentType}`,
        'ERR_CONTENT_TYPE_NOT_ALLOWED',
        response.config,
        undefined,
        response
      );
    }

    // Validate response size
    this.validateResponseSize(response);

    // Validate JSON syntax if enabled
    if (this.config.validateJsonSyntax && contentType?.includes('json')) {
      try {
        if (typeof response.data === 'string') {
          JSON.parse(response.data);
        }
      } catch {
        throw new fluxhttpError(
          'Invalid JSON syntax in response',
          'ERR_INVALID_JSON',
          response.config,
          undefined,
          response
        );
      }
    }
  }

  /**
   * Calculate data size for various data types
   */
  private getDataSize(data: unknown): number {
    if (data == null) {
      return 0;
    }

    if (typeof data === 'string') {
      return hasBuffer && isNode
        ? Buffer.byteLength(data, 'utf8')
        : new Blob([data]).size || data.length * 3; // Rough UTF-8 estimate
    }

    if (data instanceof ArrayBuffer) {
      return data.byteLength;
    }

    if (data instanceof Blob) {
      return data.size;
    }

    if (typeof data === 'object') {
      try {
        const jsonString = JSON.stringify(data);
        return hasBuffer && isNode ? Buffer.byteLength(jsonString, 'utf8') : jsonString.length * 3; // Rough UTF-8 estimate
      } catch {
        return 0; // Can't determine size
      }
    }

    return 0;
  }

  /**
   * Get content type from response headers
   */
  private getResponseContentType(response: fluxhttpResponse): string | null {
    const headers = response.headers;
    for (const [key, value] of Object.entries(headers)) {
      if (key.toLowerCase() === 'content-type') {
        return Array.isArray(value) ? value[0] || null : value || null;
      }
    }
    return null;
  }

  /**
   * Validate response size against limits
   */
  private validateResponseSize(response: fluxhttpResponse): void {
    const maxSize = this.config.maxResponseSize;
    if (maxSize <= 0) {
      return;
    }

    let actualSize = 0;
    const contentLength = this.getResponseContentLength(response);

    if (contentLength !== null) {
      actualSize = contentLength;
    } else {
      actualSize = this.getDataSize(response.data);
    }

    if (actualSize > maxSize) {
      throw new fluxhttpError(
        `Response size ${actualSize} exceeds maximum ${maxSize}`,
        'ERR_RESPONSE_TOO_LARGE',
        response.config,
        undefined,
        response
      );
    }
  }

  /**
   * Get content length from response headers
   */
  private getResponseContentLength(response: fluxhttpResponse): number | null {
    const headers = response.headers;
    for (const [key, value] of Object.entries(headers)) {
      if (key.toLowerCase() === 'content-length') {
        const lengthValue = Array.isArray(value) ? value[0] : value;
        if (lengthValue) {
          const parsed = parseInt(String(lengthValue), 10);
          return isNaN(parsed) ? null : parsed;
        }
      }
    }
    return null;
  }
}
