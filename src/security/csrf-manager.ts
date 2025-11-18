// SECURITY: CSRF token management and validation

import type { fluxhttpRequestConfig } from '../types';
import { fluxhttpError } from '../errors/fluxhttperror';
import { SecurityCrypto } from './crypto';
import type { CSRFConfig } from './types';

// Environment detection
const isBrowser = typeof window !== 'undefined' && typeof document !== 'undefined';

/**
 * CSRF (Cross-Site Request Forgery) protection manager
 * Handles token generation, validation, and storage
 */
export class CSRFManager {
  private encryptedCSRFToken?: string;
  private encryptionKey: Uint8Array;

  constructor(private config: Required<CSRFConfig>) {
    this.encryptionKey = SecurityCrypto.generateSecureBytes(32);
  }

  /**
   * Validate CSRF token for request
   * Throws fluxhttpError if validation fails
   */
  validateCSRF(config: fluxhttpRequestConfig): void {
    if (!this.config.enabled) {
      return;
    }

    const method = (config.method || 'GET').toUpperCase();

    // Skip validation for exempt methods
    if (this.config.exemptMethods.includes(method)) {
      return;
    }

    // Validate origin for cross-origin requests
    if (this.config.validateOrigin && config.url) {
      try {
        const requestUrl = new URL(config.url);
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
        if (error instanceof fluxhttpError) {
          throw error;
        }
        // Ignore URL parsing errors
      }
    }

    // Check for CSRF token in headers
    const tokenHeader = this.config.tokenHeader;
    const token = config.headers?.[tokenHeader];

    if (!token) {
      throw new fluxhttpError(
        `CSRF token required in header: ${tokenHeader}`,
        'ERR_CSRF_TOKEN_MISSING',
        config
      );
    }

    // Validate token length
    if (token.length < 16) {
      throw new fluxhttpError('CSRF token too short', 'ERR_CSRF_TOKEN_INVALID', config);
    }
  }

  /**
   * Generate a new CSRF token
   */
  async generateCSRFToken(): Promise<string> {
    const tokenLength = this.config.tokenLength;
    const randomBytes = SecurityCrypto.generateSecureBytes(tokenLength);

    // BUG-011 FIX: Use chunked conversion to avoid issues with large tokens
    // and handle potential btoa() errors gracefully
    let binaryString = '';
    const CHUNK_SIZE = 8192;
    for (let i = 0; i < randomBytes.length; i += CHUNK_SIZE) {
      const chunk = randomBytes.slice(i, i + CHUNK_SIZE);
      binaryString += String.fromCharCode.apply(null, Array.from(chunk) as any);
    }

    const token = btoa(binaryString)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');

    await this.setCSRFToken(token);
    return token;
  }

  /**
   * Set CSRF token (encrypted storage)
   */
  async setCSRFToken(token: string): Promise<void> {
    this.encryptedCSRFToken = await SecurityCrypto.encryptToken(token, this.encryptionKey);
  }

  /**
   * Get current CSRF token (decrypted)
   */
  async getCSRFToken(): Promise<string | null> {
    if (!this.encryptedCSRFToken) {
      return null;
    }
    return await SecurityCrypto.decryptToken(this.encryptedCSRFToken, this.encryptionKey);
  }

  /**
   * Extract CSRF token from DOM or cookies (browser only)
   */
  extractCSRFToken(): string | null {
    if (!isBrowser || typeof document === 'undefined') {
      return null;
    }

    const cookieName = this.config.cookieName;
    const metaName = this.config.metaName;

    // Try to get token from meta tag first
    const metaElement = document.querySelector(`meta[name="${metaName}"]`);
    if (metaElement) {
      const content = metaElement.getAttribute('content');
      if (content) {
        return content;
      }
    }

    // Try to get token from cookie
    try {
      const cookies = document.cookie.split(';');
      for (const cookie of cookies) {
        const [name, value] = cookie.trim().split('=');
        if (name === cookieName && value) {
          return decodeURIComponent(value);
        }
      }
    } catch {
      // Ignore cookie parsing errors
    }

    return null;
  }

  /**
   * Dispose of sensitive data
   */
  dispose(): void {
    this.encryptionKey.fill(0);
    this.encryptedCSRFToken = undefined;
  }
}
