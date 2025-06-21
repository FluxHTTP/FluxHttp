// SECURITY: Security interceptors for request/response pipeline

import type { fluxhttpRequestConfig, fluxhttpResponse } from '../types';
import { SecurityManager, defaultSecurity } from './index';

// Default security manager instance (disabled by default)
const defaultSecurityManager = new SecurityManager(defaultSecurity);

/**
 * Create security request interceptor
 * Validates and secures outgoing requests
 */
export function createSecurityRequestInterceptor(
  securityManager: SecurityManager = defaultSecurityManager
) {
  return function securityRequestInterceptor(config: fluxhttpRequestConfig): fluxhttpRequestConfig {
    // Use config-specific security manager if provided, otherwise use default
    if (config.security) {
      const configSecurityManager = new SecurityManager(config.security);
      configSecurityManager.validateRequest(config);
    } else {
      securityManager.validateRequest(config);
    }

    return config;
  };
}

/**
 * Create security response interceptor
 * Validates incoming responses for security compliance
 */
export function createSecurityResponseInterceptor(
  securityManager: SecurityManager = defaultSecurityManager
) {
  return function securityResponseInterceptor(response: fluxhttpResponse): fluxhttpResponse {
    // Use config-specific security manager if provided, otherwise use default
    if (response.config.security) {
      const configSecurityManager = new SecurityManager(response.config.security);
      configSecurityManager.validateResponse(response);
    } else {
      securityManager.validateResponse(response);
    }

    return response;
  };
}

// Pre-configured interceptors for easy use
export const securityRequestInterceptor = createSecurityRequestInterceptor();
export const securityResponseInterceptor = createSecurityResponseInterceptor();
