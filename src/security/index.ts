// SECURITY: Main security module exports

export { SecurityManager } from './security-manager';
export { SecurityCrypto } from './crypto';
export { RateLimiter } from './rate-limiter';
export { CSRFManager } from './csrf-manager';
export { SecurityHeaders } from './security-headers';
export { ContentValidator } from './content-validator';
export {
  createSecurityRequestInterceptor,
  createSecurityResponseInterceptor,
  securityRequestInterceptor,
  securityResponseInterceptor,
} from './interceptors';

export type {
  SecurityConfig,
  CSRFConfig,
  RateLimitConfig,
  ContentValidationConfig,
  SecurityHeadersConfig,
  RequestValidationConfig,
  RateLimitState,
} from './types';

// Default security configuration (all features disabled for minimal setup)
export const defaultSecurity = {
  csrf: { enabled: false },
  rateLimit: { enabled: false },
  contentValidation: { enabled: false },
  securityHeaders: { enabled: false },
  requestValidation: { enabled: false },
};

/**
 * Create security configuration with defaults
 * Allows partial configuration while maintaining type safety
 */
export function createSecurityConfig(config: any = {}) {
  return {
    csrf: { enabled: false, ...config.csrf },
    rateLimit: { enabled: false, ...config.rateLimit },
    contentValidation: { enabled: false, ...config.contentValidation },
    securityHeaders: { enabled: false, ...config.securityHeaders },
    requestValidation: { enabled: false, ...config.requestValidation },
  };
}
