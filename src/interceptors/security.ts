import type { fluxhttpRequestConfig, fluxhttpResponse } from '../types';
import { SecurityManager, defaultSecurity } from '../security';

// Create default security manager instance
const defaultSecurityManager = new SecurityManager(defaultSecurity);

export function createSecurityRequestInterceptor(
  manager: SecurityManager = defaultSecurityManager
): (config: fluxhttpRequestConfig) => fluxhttpRequestConfig {
  return function securityRequestInterceptor(config: fluxhttpRequestConfig): fluxhttpRequestConfig {
    // Use per-request security config if provided, otherwise use the manager's config
    if (config.security) {
      const requestManager = new SecurityManager(config.security);
      requestManager.validateRequest(config);
    } else {
      manager.validateRequest(config);
    }

    return config;
  };
}

export function createSecurityResponseInterceptor(
  manager: SecurityManager = defaultSecurityManager
): (response: fluxhttpResponse) => fluxhttpResponse {
  return function securityResponseInterceptor(response: fluxhttpResponse): fluxhttpResponse {
    // Use per-request security config if provided
    if (response.config.security) {
      const requestManager = new SecurityManager(response.config.security);
      requestManager.validateResponse(response);
    } else {
      manager.validateResponse(response);
    }

    return response;
  };
}

// Default interceptors using the global security manager
export const securityRequestInterceptor = createSecurityRequestInterceptor();
export const securityResponseInterceptor = createSecurityResponseInterceptor();
