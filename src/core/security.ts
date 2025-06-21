// SECURITY: Legacy security module - DEPRECATED
// This file is deprecated in favor of the modular security system
// Import from src/security/index.ts instead

import {
  SecurityManager,
  SecurityCrypto,
  createSecurityConfig,
  defaultSecurity,
  createSecurityRequestInterceptor,
  createSecurityResponseInterceptor,
  securityRequestInterceptor,
  securityResponseInterceptor,
} from '../security';

import type {
  SecurityConfig,
  CSRFConfig,
  RateLimitConfig,
  ContentValidationConfig,
  SecurityHeadersConfig,
  RequestValidationConfig,
  RateLimitState,
} from '../security';

// Re-export everything for backward compatibility
export {
  SecurityManager,
  SecurityCrypto,
  createSecurityConfig,
  defaultSecurity,
  createSecurityRequestInterceptor,
  createSecurityResponseInterceptor,
  securityRequestInterceptor,
  securityResponseInterceptor,
};

export type {
  SecurityConfig,
  CSRFConfig,
  RateLimitConfig,
  ContentValidationConfig,
  SecurityHeadersConfig,
  RequestValidationConfig,
  RateLimitState,
};

// TODO: Remove this file in the next major version
// Use import from 'src/security' instead
