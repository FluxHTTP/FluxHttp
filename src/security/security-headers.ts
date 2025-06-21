// SECURITY: Security headers management

import type { fluxhttpRequestConfig } from '../types';
import type { SecurityHeadersConfig } from './types';

/**
 * Security headers manager
 * Adds security-related headers to outgoing requests
 */
export class SecurityHeaders {
  constructor(private config: Required<SecurityHeadersConfig>) {}

  /**
   * Add security headers to request configuration
   */
  addSecurityHeaders(config: fluxhttpRequestConfig): void {
    if (!this.config.enabled) {
      return;
    }

    // Ensure headers object exists
    config.headers = config.headers || {};

    const sanitizeHeaderValue = (value: string): string => value.replace(/[\r\n]/g, '');

    // X-Content-Type-Options: Prevent MIME type sniffing
    if (this.config.contentTypeNoSniff) {
      config.headers['X-Content-Type-Options'] = 'nosniff';
    }

    // X-XSS-Protection: Enable XSS filtering
    if (this.config.xssProtection) {
      config.headers['X-XSS-Protection'] = '1; mode=block';
    }

    // X-Frame-Options: Prevent clickjacking
    if (this.config.frameOptions) {
      config.headers['X-Frame-Options'] = sanitizeHeaderValue(this.config.frameOptions);
    }

    // Strict-Transport-Security: Force HTTPS
    if (this.config.strictTransportSecurity && config.url?.startsWith('https')) {
      config.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains; preload';
    }

    // Referrer-Policy: Control referrer information
    if (this.config.referrerPolicy) {
      config.headers['Referrer-Policy'] = sanitizeHeaderValue(this.config.referrerPolicy);
    }

    // Content-Security-Policy: Define allowed resources
    if (this.config.contentSecurityPolicy) {
      config.headers['Content-Security-Policy'] = sanitizeHeaderValue(
        this.config.contentSecurityPolicy
      );
    }

    // Permissions-Policy: Control browser features
    if (this.config.permissionsPolicy) {
      config.headers['Permissions-Policy'] = sanitizeHeaderValue(this.config.permissionsPolicy);
    }
  }
}
