// SECURITY: Main security manager that orchestrates all security features

import type { fluxhttpRequestConfig, fluxhttpResponse } from '../types';
import { fluxhttpError } from '../errors/fluxhttperror';
import { RateLimiter } from './rate-limiter';
import { CSRFManager } from './csrf-manager';
import { SecurityHeaders } from './security-headers';
import { ContentValidator } from './content-validator';
import type {
  SecurityConfig,
  CSRFConfig,
  RateLimitConfig,
  ContentValidationConfig,
  SecurityHeadersConfig,
  RequestValidationConfig,
} from './types';

/**
 * Main security manager that coordinates all security features
 * Provides a unified interface for request/response security validation
 */
export class SecurityManager {
  private rateLimiter: RateLimiter;
  private csrfManager: CSRFManager;
  private securityHeaders: SecurityHeaders;
  private contentValidator: ContentValidator;
  private requestValidationConfig: Required<RequestValidationConfig>;

  constructor(config: SecurityConfig = {}) {
    // Create default configurations with user overrides
    const csrfConfig: Required<CSRFConfig> = {
      enabled: true,
      tokenHeader: 'X-CSRF-Token',
      cookieName: 'csrf_token',
      metaName: 'csrf-token',
      exemptMethods: ['GET', 'HEAD', 'OPTIONS'],
      validateOrigin: true,
      tokenLength: 32,
      rotateTokens: false,
      ...config.csrf,
    };

    const rateLimitConfig: Required<RateLimitConfig> = {
      enabled: true,
      maxRequests: 100,
      windowMs: 60000, // 1 minute
      skipSuccessfulRequests: false,
      skipFailedRequests: false,
      cleanupInterval: 300000, // 5 minutes
      keyGenerator: (config: any) => {
        const origin = config.url ? new URL(config.url).origin : 'unknown';
        const userAgent =
          config.headers?.['User-Agent'] || config.headers?.['user-agent'] || 'unknown';
        return `${origin}:${String(userAgent)}`;
      },
      ...config.rateLimit,
    };

    const contentValidationConfig: Required<ContentValidationConfig> = {
      enabled: true,
      maxRequestSize: 10 * 1024 * 1024, // 10MB
      maxResponseSize: 50 * 1024 * 1024, // 50MB
      allowedContentTypes: [
        'application/json',
        'application/x-www-form-urlencoded',
        'multipart/form-data',
        'text/plain',
        'text/html',
        'application/xml',
        'text/xml',
      ],
      blockedContentTypes: [
        'application/x-executable',
        'application/x-msdownload',
        'application/x-msdos-program',
        'application/octet-stream',
      ],
      validateJsonSyntax: true,
      blockMaliciousPatterns: true,
      ...config.contentValidation,
    };

    const securityHeadersConfig: Required<SecurityHeadersConfig> = {
      enabled: true,
      forceHttps: true,
      strictTransportSecurity: true,
      contentTypeNoSniff: true,
      frameOptions: 'DENY',
      xssProtection: true,
      referrerPolicy: 'strict-origin-when-cross-origin',
      contentSecurityPolicy: "default-src 'self'",
      permissionsPolicy: '',
      ...config.securityHeaders,
    };

    this.requestValidationConfig = {
      enabled: true,
      allowedOrigins: [],
      allowedMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'],
      requireAuth: false,
      validateHeaders: true,
      blockSuspiciousUserAgents: true,
      validateReferer: true,
      ...config.requestValidation,
    };

    // Initialize security modules
    this.rateLimiter = new RateLimiter(rateLimitConfig);
    this.csrfManager = new CSRFManager(csrfConfig);
    this.securityHeaders = new SecurityHeaders(securityHeadersConfig);
    this.contentValidator = new ContentValidator(contentValidationConfig);
  }

  /**
   * Validate request before sending
   * Performs all security checks on outgoing requests
   */
  validateRequest(config: fluxhttpRequestConfig): void {
    // Basic request validation
    this.validateRequestBasics(config);

    // Rate limiting
    this.rateLimiter.checkRateLimit(config);

    // CSRF validation
    this.csrfManager.validateCSRF(config);

    // Content validation
    this.contentValidator.validateRequest(config);

    // Add security headers
    this.securityHeaders.addSecurityHeaders(config);
  }

  /**
   * Validate response after receiving
   * Performs security checks on incoming responses
   */
  validateResponse(response: fluxhttpResponse): void {
    this.contentValidator.validateResponse(response);
  }

  /**
   * Basic request validation (origins, methods, etc.)
   */
  private validateRequestBasics(config: fluxhttpRequestConfig): void {
    if (!this.requestValidationConfig.enabled) {
      return;
    }

    // Validate allowed origins
    if (config.url && this.requestValidationConfig.allowedOrigins.length > 0) {
      if (!this.isValidOrigin(config.url, this.requestValidationConfig.allowedOrigins)) {
        throw new fluxhttpError(
          `Request origin not allowed: ${config.url}`,
          'ERR_ORIGIN_NOT_ALLOWED',
          config
        );
      }
    }

    // Validate allowed methods
    if (this.requestValidationConfig.allowedMethods.length > 0) {
      const method = (config.method || 'GET').toUpperCase();
      if (!this.requestValidationConfig.allowedMethods.includes(method)) {
        throw new fluxhttpError(
          `HTTP method not allowed: ${method}`,
          'ERR_METHOD_NOT_ALLOWED',
          config
        );
      }
    }
  }

  /**
   * Check if URL origin is in allowed list
   */
  private isValidOrigin(url: string, allowedOrigins: string[]): boolean {
    if (!allowedOrigins.length) {
      return true;
    }

    try {
      const origin = new URL(url).origin;
      return allowedOrigins.some((allowed) => {
        if (allowed === '*') {
          return true;
        }
        if (allowed.startsWith('*.')) {
          const domain = allowed.slice(2);
          return (
            origin.endsWith('.' + domain) ||
            origin === 'https://' + domain ||
            origin === 'http://' + domain
          );
        }
        return origin === allowed;
      });
    } catch {
      return false;
    }
  }

  /**
   * Generate CSRF token
   */
  generateCSRFToken(): string {
    return this.csrfManager.generateCSRFToken();
  }

  /**
   * Set CSRF token
   */
  setCSRFToken(token: string): void {
    this.csrfManager.setCSRFToken(token);
  }

  /**
   * Get current CSRF token
   */
  getCSRFToken(): string | null {
    return this.csrfManager.getCSRFToken();
  }

  /**
   * Extract CSRF token from environment (browser)
   */
  extractCSRFToken(): string | null {
    return this.csrfManager.extractCSRFToken();
  }

  /**
   * Clean up rate limiting data
   */
  cleanupRateLimit(): void {
    this.rateLimiter.cleanupRateLimit();
  }

  /**
   * Dispose of security manager and clean up resources
   */
  dispose(): void {
    this.rateLimiter.dispose();
    this.csrfManager.dispose();
  }
}
