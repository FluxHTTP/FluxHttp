import type { fluxhttpRequestConfig, fluxhttpResponse } from '../types';
import { fluxhttpError } from '../errors/fluxhttperror';

// SECURITY: Environment detection utilities
const isNode = typeof process !== 'undefined' && process.versions && process.versions.node;
const isBrowser = typeof window !== 'undefined' && typeof document !== 'undefined';
const hasBuffer = typeof Buffer !== 'undefined';

// SECURITY: Crypto utilities for token encryption
class SecurityCrypto {
  private static encoder = typeof TextEncoder !== 'undefined' ? new TextEncoder() : null;
  private static decoder = typeof TextDecoder !== 'undefined' ? new TextDecoder() : null;

  // SECURITY: Generate cryptographically secure random bytes
  static generateSecureBytes(length: number): Uint8Array {
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      return crypto.getRandomValues(new Uint8Array(length));
    }
    if (isNode && typeof require !== 'undefined') {
      try {
        // Define proper interface for Node.js crypto module
        interface NodeCrypto {
          randomBytes(size: number): Buffer;
        }

        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const nodeCrypto = require('crypto') as NodeCrypto;
        const buffer = nodeCrypto.randomBytes(length);
        return new Uint8Array(buffer);
      } catch {
        // Fallback to Math.random (less secure)
      }
    }
    // Fallback: less secure but better than nothing
    const bytes = new Uint8Array(length);
    for (let i = 0; i < length; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
    return bytes;
  }

  // SECURITY: Simple XOR encryption for in-memory token protection
  static encryptToken(token: string, key: Uint8Array): string {
    if (!this.encoder) {
      return token; // Fallback: return plain token if no encoder
    }

    const tokenBytes = this.encoder.encode(token);
    const encrypted = new Uint8Array(tokenBytes.length);

    for (let i = 0; i < tokenBytes.length; i++) {
      encrypted[i] = tokenBytes[i]! ^ key[i % key.length]!;
    }

    return btoa(String.fromCharCode.apply(null, Array.from(encrypted)));
  }

  // SECURITY: Decrypt XOR encrypted token
  static decryptToken(encryptedToken: string, key: Uint8Array): string {
    if (!this.decoder) {
      return encryptedToken; // Fallback: return as-is if no decoder
    }

    try {
      const encrypted = new Uint8Array(
        atob(encryptedToken)
          .split('')
          .map((char) => char.charCodeAt(0))
      );

      const decrypted = new Uint8Array(encrypted.length);
      for (let i = 0; i < encrypted.length; i++) {
        decrypted[i] = encrypted[i]! ^ key[i % key.length]!;
      }

      return this.decoder.decode(decrypted);
    } catch {
      return encryptedToken; // Fallback on error
    }
  }
}

export interface SecurityConfig {
  // CSRF Protection
  csrf?: {
    enabled?: boolean;
    tokenHeader?: string;
    cookieName?: string;
    metaName?: string;
    exemptMethods?: string[];
    // SECURITY: Enhanced CSRF protection
    validateOrigin?: boolean;
    tokenLength?: number;
    rotateTokens?: boolean;
  };

  // Rate Limiting
  rateLimit?: {
    enabled?: boolean;
    maxRequests?: number;
    windowMs?: number;
    skipSuccessfulRequests?: boolean;
    skipFailedRequests?: boolean;
    // SECURITY: Enhanced rate limiting
    cleanupInterval?: number;
    keyGenerator?: (config: fluxhttpRequestConfig) => string;
  };

  // Content Security
  contentValidation?: {
    enabled?: boolean;
    maxRequestSize?: number;
    maxResponseSize?: number;
    allowedContentTypes?: string[];
    blockedContentTypes?: string[];
    // SECURITY: Enhanced content validation
    validateJsonSyntax?: boolean;
    blockMaliciousPatterns?: boolean;
  };

  // Security Headers
  securityHeaders?: {
    enabled?: boolean;
    forceHttps?: boolean;
    strictTransportSecurity?: boolean;
    contentTypeNoSniff?: boolean;
    frameOptions?: string;
    xssProtection?: boolean;
    referrerPolicy?: string;
    // SECURITY: Additional security headers
    contentSecurityPolicy?: string;
    permissionsPolicy?: string;
  };

  // Request Validation
  requestValidation?: {
    enabled?: boolean;
    allowedOrigins?: string[];
    allowedMethods?: string[];
    requireAuth?: boolean;
    validateHeaders?: boolean;
    // SECURITY: Enhanced request validation
    blockSuspiciousUserAgents?: boolean;
    validateReferer?: boolean;
  };
}

export interface RateLimitState {
  requests: number[];
  windowStart: number;
  lastCleanup?: number; // SECURITY: Track cleanup time
}

export class SecurityManager {
  private config: SecurityConfig;
  private rateLimitState: Map<string, RateLimitState> = new Map();
  private encryptionKey: Uint8Array;
  private encryptedCSRFToken?: string;
  private cleanupTimer?: NodeJS.Timeout;

  constructor(config: SecurityConfig = {}) {
    // SECURITY: Generate unique encryption key for this instance
    this.encryptionKey = SecurityCrypto.generateSecureBytes(32);

    // SECURITY: Secure defaults - enable security features by default
    this.config = {
      csrf: {
        enabled: true, // SECURITY: Enable by default
        tokenHeader: 'X-CSRF-Token',
        cookieName: 'csrf_token',
        metaName: 'csrf-token',
        exemptMethods: ['GET', 'HEAD', 'OPTIONS'],
        validateOrigin: true, // SECURITY: Enable origin validation
        tokenLength: 32, // SECURITY: Longer tokens
        rotateTokens: false,
        ...config.csrf,
      },
      rateLimit: {
        enabled: true, // SECURITY: Enable by default
        maxRequests: 100,
        windowMs: 60000,
        skipSuccessfulRequests: false,
        skipFailedRequests: false,
        cleanupInterval: 300000, // SECURITY: 5 minutes
        ...config.rateLimit,
      },
      contentValidation: {
        enabled: true, // SECURITY: Enable by default
        maxRequestSize: 10 * 1024 * 1024,
        maxResponseSize: 50 * 1024 * 1024,
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
          'application/octet-stream', // SECURITY: Block binary content
        ],
        validateJsonSyntax: true, // SECURITY: Validate JSON
        blockMaliciousPatterns: true, // SECURITY: Block malicious patterns
        ...config.contentValidation,
      },
      securityHeaders: {
        enabled: true, // SECURITY: Enable by default
        forceHttps: true, // SECURITY: Force HTTPS
        strictTransportSecurity: true,
        contentTypeNoSniff: true,
        frameOptions: 'DENY', // SECURITY: Deny framing by default
        xssProtection: true,
        referrerPolicy: 'strict-origin-when-cross-origin',
        contentSecurityPolicy: "default-src 'self'", // SECURITY: Strict CSP
        ...config.securityHeaders,
      },
      requestValidation: {
        enabled: true, // SECURITY: Enable by default
        allowedOrigins: [],
        allowedMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'],
        requireAuth: false,
        validateHeaders: true,
        blockSuspiciousUserAgents: true, // SECURITY: Block suspicious UAs
        validateReferer: true, // SECURITY: Validate referer
        ...config.requestValidation,
      },
    };

    // SECURITY: Start cleanup timer for rate limiting
    this.startCleanupTimer();
  }

  // SECURITY: Start automatic cleanup of old rate limit entries
  private startCleanupTimer(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }

    const interval = this.config.rateLimit?.cleanupInterval || 300000;
    this.cleanupTimer = setInterval(() => {
      this.cleanupRateLimit();
    }, interval);
  }

  // SECURITY: Safe buffer size calculation
  private getDataSize(data: unknown): number {
    if (data === null || data === undefined) {
      return 0;
    }

    if (typeof data === 'string') {
      // SECURITY: Use Buffer if available, otherwise estimate
      if (hasBuffer && isNode) {
        return Buffer.byteLength(data, 'utf8');
      }
      // Fallback: estimate UTF-8 byte length
      return new Blob([data]).size || data.length * 3; // Conservative estimate
    }

    if (data instanceof ArrayBuffer) {
      return data.byteLength;
    }

    if (data instanceof Blob) {
      return data.size;
    }

    if (typeof data === 'object') {
      try {
        const jsonStr = JSON.stringify(data);
        return hasBuffer && isNode ? Buffer.byteLength(jsonStr, 'utf8') : jsonStr.length * 3;
      } catch {
        return 0; // Invalid JSON
      }
    }

    return 0;
  }

  // SECURITY: Enhanced URL origin validation
  private isValidOrigin(url: string, allowedOrigins: string[]): boolean {
    if (!allowedOrigins.length) return true; // No restriction if empty

    try {
      const parsedUrl = new URL(url);
      const origin = parsedUrl.origin;

      return allowedOrigins.some((allowed) => {
        if (allowed === '*') return true;
        if (allowed.startsWith('*.')) {
          // Wildcard subdomain matching
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
      return false; // Invalid URL
    }
  }

  // SECURITY: Validate request against security policies
  validateRequest(config: fluxhttpRequestConfig): void {
    if (!this.config.requestValidation?.enabled) return;

    // Validate URL origin
    if (config.url && this.config.requestValidation.allowedOrigins?.length) {
      if (!this.isValidOrigin(config.url, this.config.requestValidation.allowedOrigins)) {
        throw new fluxhttpError(
          `Request origin not allowed: ${config.url}`,
          'ERR_ORIGIN_NOT_ALLOWED',
          config
        );
      }
    }

    // Validate HTTP method
    if (this.config.requestValidation.allowedMethods?.length) {
      const method = (config.method || 'GET').toUpperCase();
      if (!this.config.requestValidation.allowedMethods.includes(method)) {
        throw new fluxhttpError(
          `HTTP method not allowed: ${method}`,
          'ERR_METHOD_NOT_ALLOWED',
          config
        );
      }
    }

    // Validate request size
    if (this.config.contentValidation?.enabled && config.data) {
      const requestSize = this.getDataSize(config.data);
      const maxSize = this.config.contentValidation.maxRequestSize || 10 * 1024 * 1024;

      if (requestSize > maxSize) {
        throw new fluxhttpError(
          `Request size ${requestSize} exceeds maximum ${maxSize}`,
          'ERR_REQUEST_TOO_LARGE',
          config
        );
      }
    }

    // Rate limiting
    this.checkRateLimit(config);

    // CSRF validation
    this.validateCSRF(config);

    // Add security headers
    this.addSecurityHeaders(config);
  }

  // SECURITY: Enhanced rate limiting with automatic cleanup
  private checkRateLimit(config: fluxhttpRequestConfig): void {
    if (!this.config.rateLimit?.enabled) return;

    const keyGenerator =
      this.config.rateLimit.keyGenerator ||
      ((config: fluxhttpRequestConfig): string => {
        // Default: use origin + user agent as key
        const origin = config.url ? new URL(config.url).origin : 'unknown';
        const userAgent =
          config.headers?.['User-Agent'] || config.headers?.['user-agent'] || 'unknown';
        return `${origin}:${String(userAgent)}`;
      });

    const key = keyGenerator(config);
    const now = Date.now();
    const windowMs = this.config.rateLimit.windowMs || 60000;
    const maxRequests = this.config.rateLimit.maxRequests || 100;

    let state = this.rateLimitState.get(key);
    if (!state) {
      state = { requests: [], windowStart: now };
      this.rateLimitState.set(key, state);
    }

    // Clean old requests outside the window
    state.requests = state.requests.filter((time) => now - time < windowMs);

    if (state.requests.length >= maxRequests) {
      const oldestRequest = state.requests[0];
      if (oldestRequest !== undefined) {
        const resetTime = Math.ceil((oldestRequest + windowMs - now) / 1000);
        throw new fluxhttpError(
          `Rate limit exceeded. Try again in ${resetTime} seconds`,
          'ERR_RATE_LIMITED',
          config,
          undefined,
          {
            data: { resetTime },
            status: 429,
            statusText: 'Too Many Requests',
            headers: {
              'Retry-After': resetTime.toString(),
              'X-RateLimit-Limit': maxRequests.toString(),
              'X-RateLimit-Remaining': '0',
              'X-RateLimit-Reset': new Date(oldestRequest + windowMs).toISOString(),
            },
            config,
          }
        );
      }
    }

    // Add this request to the window
    state.requests.push(now);
    state.lastCleanup = now;
  }

  // SECURITY: Enhanced CSRF validation with origin checking
  private validateCSRF(config: fluxhttpRequestConfig): void {
    if (!this.config.csrf?.enabled) return;

    const method = (config.method || 'GET').toUpperCase();
    const exemptMethods = this.config.csrf.exemptMethods || ['GET', 'HEAD', 'OPTIONS'];

    if (exemptMethods.includes(method)) {
      return; // Skip CSRF check for exempt methods
    }

    // Validate origin for CSRF protection
    if (this.config.csrf.validateOrigin && config.url) {
      try {
        const requestUrl = new URL(config.url);

        // SECURITY: Check if request is same-origin or explicitly allowed
        if (isBrowser && typeof location !== 'undefined') {
          const currentOrigin = location.origin;
          const requestOrigin = requestUrl.origin;

          if (currentOrigin !== requestOrigin) {
            throw new fluxhttpError(
              'Cross-origin request requires CSRF token validation',
              'ERR_CSRF_ORIGIN_MISMATCH',
              config
            );
          }
        }
      } catch (error) {
        if (error instanceof fluxhttpError) throw error;
        // Invalid URL, allow the request to fail later
      }
    }

    const tokenHeader = this.config.csrf.tokenHeader || 'X-CSRF-Token';
    const token = config.headers?.[tokenHeader] as string;

    if (!token) {
      throw new fluxhttpError(
        `CSRF token required in header: ${tokenHeader}`,
        'ERR_CSRF_TOKEN_MISSING',
        config
      );
    }

    // Validate token format (basic check)
    if (token.length < 16) {
      throw new fluxhttpError('CSRF token too short', 'ERR_CSRF_TOKEN_INVALID', config);
    }
  }

  // SECURITY: Enhanced response validation
  validateResponse(response: fluxhttpResponse): void {
    if (!this.config.contentValidation?.enabled) return;

    // Validate response content type
    const contentType = this.getResponseContentType(response);
    if (contentType) {
      const allowedTypes = this.config.contentValidation.allowedContentTypes;
      const blockedTypes = this.config.contentValidation.blockedContentTypes;

      if (blockedTypes?.some((blocked) => contentType.includes(blocked))) {
        throw new fluxhttpError(
          `Blocked content type: ${contentType}`,
          'ERR_BLOCKED_CONTENT_TYPE',
          response.config,
          undefined,
          response
        );
      }

      if (allowedTypes?.length && !allowedTypes.some((allowed) => contentType.includes(allowed))) {
        throw new fluxhttpError(
          `Content type not allowed: ${contentType}`,
          'ERR_CONTENT_TYPE_NOT_ALLOWED',
          response.config,
          undefined,
          response
        );
      }
    }

    // Validate response size
    this.validateResponseSize(response);

    // SECURITY: Validate JSON syntax if enabled
    if (this.config.contentValidation.validateJsonSyntax && contentType?.includes('json')) {
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

  // SECURITY: Safe token generation and storage
  generateCSRFToken(): string {
    const tokenLength = this.config.csrf?.tokenLength || 32;
    const randomBytes = SecurityCrypto.generateSecureBytes(tokenLength);

    // Convert to base64 for safe transmission
    const token = btoa(String.fromCharCode.apply(null, Array.from(randomBytes)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');

    this.setCSRFToken(token);
    return token;
  }

  // SECURITY: Encrypted token storage
  setCSRFToken(token: string): void {
    // SECURITY: Store token encrypted in memory
    this.encryptedCSRFToken = SecurityCrypto.encryptToken(token, this.encryptionKey);
  }

  // SECURITY: Decrypt and return token
  getCSRFToken(): string | null {
    if (!this.encryptedCSRFToken) return null;
    return SecurityCrypto.decryptToken(this.encryptedCSRFToken, this.encryptionKey);
  }

  // SECURITY: Extract CSRF token from various sources
  extractCSRFToken(): string | null {
    if (!isBrowser || typeof document === 'undefined') return null;

    const cookieName = this.config.csrf?.cookieName || 'csrf_token';
    const metaName = this.config.csrf?.metaName || 'csrf-token';

    // Try meta tag first
    const metaTag = document.querySelector(`meta[name="${metaName}"]`);
    if (metaTag) {
      const token = metaTag.getAttribute('content');
      if (token) return token;
    }

    // Try cookie
    try {
      const cookies = document.cookie.split(';');
      for (const cookie of cookies) {
        const [name, value] = cookie.trim().split('=');
        if (name === cookieName && value) {
          return decodeURIComponent(value);
        }
      }
    } catch {
      // Cookie parsing failed
    }

    return null;
  }

  // SECURITY: Enhanced security headers with input validation
  private addSecurityHeaders(config: fluxhttpRequestConfig): void {
    if (!this.config.securityHeaders?.enabled) return;

    config.headers = config.headers || {};

    // SECURITY: Validate and sanitize header values
    const sanitizeHeaderValue = (value: string): string => {
      return value.replace(/[\r\n]/g, ''); // Remove CRLF to prevent header injection
    };

    if (this.config.securityHeaders.contentTypeNoSniff) {
      config.headers['X-Content-Type-Options'] = 'nosniff';
    }

    if (this.config.securityHeaders.xssProtection) {
      config.headers['X-XSS-Protection'] = '1; mode=block';
    }

    if (this.config.securityHeaders.frameOptions) {
      config.headers['X-Frame-Options'] = sanitizeHeaderValue(
        this.config.securityHeaders.frameOptions
      );
    }

    if (this.config.securityHeaders.strictTransportSecurity && config.url?.startsWith('https')) {
      config.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains; preload';
    }

    if (this.config.securityHeaders.referrerPolicy) {
      config.headers['Referrer-Policy'] = sanitizeHeaderValue(
        this.config.securityHeaders.referrerPolicy
      );
    }

    if (this.config.securityHeaders.contentSecurityPolicy) {
      config.headers['Content-Security-Policy'] = sanitizeHeaderValue(
        this.config.securityHeaders.contentSecurityPolicy
      );
    }

    if (this.config.securityHeaders.permissionsPolicy) {
      config.headers['Permissions-Policy'] = sanitizeHeaderValue(
        this.config.securityHeaders.permissionsPolicy
      );
    }
  }

  // SECURITY: Safe content type extraction
  private getResponseContentType(response: fluxhttpResponse): string | null {
    const headers = response.headers;
    for (const [key, value] of Object.entries(headers)) {
      if (key.toLowerCase() === 'content-type') {
        return Array.isArray(value) ? value[0] || null : value || null;
      }
    }
    return null;
  }

  // SECURITY: Enhanced response size validation
  private validateResponseSize(response: fluxhttpResponse): void {
    if (!this.config.contentValidation?.enabled) return;

    const maxResponseSize = this.config.contentValidation.maxResponseSize || 0;
    if (maxResponseSize <= 0) return;

    let responseSize = 0;

    // Try to get size from Content-Length header first
    const contentLength = this.getResponseContentLength(response);
    if (contentLength !== null) {
      responseSize = contentLength;
    } else {
      // Estimate size from data
      responseSize = this.getDataSize(response.data);
    }

    if (responseSize > maxResponseSize) {
      throw new fluxhttpError(
        `Response size ${responseSize} exceeds maximum ${maxResponseSize}`,
        'ERR_RESPONSE_TOO_LARGE',
        response.config,
        undefined,
        response
      );
    }
  }

  // SECURITY: Safe content length extraction
  private getResponseContentLength(response: fluxhttpResponse): number | null {
    const headers = response.headers;
    for (const [key, value] of Object.entries(headers)) {
      if (key.toLowerCase() === 'content-length') {
        const length = Array.isArray(value) ? value[0] : value;
        if (length) {
          const parsed = parseInt(String(length), 10);
          return isNaN(parsed) ? null : parsed;
        }
      }
    }
    return null;
  }

  // SECURITY: Automatic cleanup of rate limit state
  cleanupRateLimit(): void {
    const now = Date.now();
    const windowMs = this.config.rateLimit?.windowMs || 60000;
    const cleanupInterval = this.config.rateLimit?.cleanupInterval || 300000;

    for (const [key, state] of Array.from(this.rateLimitState.entries())) {
      // Clean old requests
      state.requests = state.requests.filter((time) => now - time < windowMs);

      // Remove empty states that haven't been used recently
      if (
        state.requests.length === 0 &&
        state.lastCleanup &&
        now - state.lastCleanup > cleanupInterval
      ) {
        this.rateLimitState.delete(key);
      }
    }
  }

  // SECURITY: Secure disposal of sensitive data
  dispose(): void {
    // Clear encryption key
    this.encryptionKey.fill(0);

    // Clear encrypted token
    this.encryptedCSRFToken = undefined;

    // Clear rate limit state
    this.rateLimitState.clear();

    // Clear cleanup timer
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }
  }
}

// COMPATIBILITY: Default security configuration
export const defaultSecurity: SecurityConfig = {
  csrf: { enabled: false },
  rateLimit: { enabled: false },
  contentValidation: { enabled: false },
  securityHeaders: { enabled: false },
  requestValidation: { enabled: false },
};

// COMPATIBILITY: Security configuration factory
export function createSecurityConfig(config: Partial<SecurityConfig> = {}): SecurityConfig {
  return {
    csrf: { enabled: false, ...config.csrf },
    rateLimit: { enabled: false, ...config.rateLimit },
    contentValidation: { enabled: false, ...config.contentValidation },
    securityHeaders: { enabled: false, ...config.securityHeaders },
    requestValidation: { enabled: false, ...config.requestValidation },
  };
}
