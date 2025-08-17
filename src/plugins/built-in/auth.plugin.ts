/**
 * @fileoverview Authentication plugin for FluxHTTP
 * @module @fluxhttp/plugins/built-in/auth
 */

import type {
  Plugin,
  PluginConfig,
  PluginContext,
  PluginMetadata,
  PluginConfigSchema,
  fluxhttpRequestConfig,
  fluxhttpResponse
} from '../types';
import { PluginLifecycleState, PluginType, PluginPriority } from '../types';

/**
 * Authentication types
 */
export type AuthType = 'bearer' | 'basic' | 'api-key' | 'oauth2' | 'jwt' | 'custom';

/**
 * Authentication configuration
 */
export interface AuthPluginConfig extends PluginConfig {
  settings: {
    /** Authentication type */
    type: AuthType;
    /** Bearer token (for bearer auth) */
    token?: string;
    /** Username (for basic auth) */
    username?: string;
    /** Password (for basic auth) */
    password?: string;
    /** API key */
    apiKey?: string;
    /** API key header name */
    apiKeyHeader?: string;
    /** OAuth2 access token */
    accessToken?: string;
    /** OAuth2 refresh token */
    refreshToken?: string;
    /** OAuth2 token endpoint */
    tokenEndpoint?: string;
    /** OAuth2 client ID */
    clientId?: string;
    /** OAuth2 client secret */
    clientSecret?: string;
    /** JWT token */
    jwt?: string;
    /** JWT signing key */
    jwtKey?: string;
    /** JWT algorithm */
    jwtAlgorithm?: string;
    /** Custom authentication function */
    customAuth?: (config: fluxhttpRequestConfig) => fluxhttpRequestConfig | Promise<fluxhttpRequestConfig>;
    /** Token refresh function */
    onTokenRefresh?: (newToken: string) => void;
    /** Authentication error handler */
    onAuthError?: (error: Error) => void;
    /** Automatic token refresh */
    autoRefresh?: boolean;
    /** Token refresh threshold (seconds before expiry) */
    refreshThreshold?: number;
    /** Include credentials in CORS requests */
    includeCredentials?: boolean;
  };
}

/**
 * OAuth2 token response
 */
interface OAuth2TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
}

/**
 * JWT payload
 */
interface JWTPayload {
  iss?: string;
  sub?: string;
  aud?: string;
  exp?: number;
  nbf?: number;
  iat?: number;
  jti?: string;
  [key: string]: unknown;
}

/**
 * Authentication plugin implementation
 */
export class AuthPlugin implements Plugin {
  readonly metadata: PluginMetadata = {
    id: 'auth',
    name: 'Authentication Plugin',
    version: '1.0.0',
    type: PluginType.AUTH,
    description: 'Provides authentication support for HTTP requests',
    author: {
      name: 'FluxHTTP Team',
      email: 'team@fluxhttp.dev'
    },
    license: 'MIT',
    keywords: ['auth', 'authentication', 'oauth', 'jwt', 'bearer', 'basic'],
    capabilities: {
      canModifyRequest: true,
      canAuthenticate: true,
      canValidate: true
    },
    priority: PluginPriority.HIGH
  };

  readonly configSchema: PluginConfigSchema = {
    type: 'object',
    properties: {
      enabled: { type: 'boolean', default: true },
      settings: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            enum: ['bearer', 'basic', 'api-key', 'oauth2', 'jwt', 'custom'],
            description: 'Authentication type'
          },
          token: { type: 'string', description: 'Bearer token' },
          username: { type: 'string', description: 'Username for basic auth' },
          password: { type: 'string', description: 'Password for basic auth' },
          apiKey: { type: 'string', description: 'API key' },
          apiKeyHeader: { type: 'string', default: 'X-API-Key', description: 'API key header name' },
          accessToken: { type: 'string', description: 'OAuth2 access token' },
          refreshToken: { type: 'string', description: 'OAuth2 refresh token' },
          tokenEndpoint: { type: 'string', description: 'OAuth2 token endpoint' },
          clientId: { type: 'string', description: 'OAuth2 client ID' },
          clientSecret: { type: 'string', description: 'OAuth2 client secret' },
          jwt: { type: 'string', description: 'JWT token' },
          autoRefresh: { type: 'boolean', default: true, description: 'Automatic token refresh' },
          refreshThreshold: { type: 'number', default: 300, description: 'Token refresh threshold in seconds' },
          includeCredentials: { type: 'boolean', default: false, description: 'Include credentials in CORS requests' }
        },
        required: ['type']
      }
    },
    required: ['settings']
  };

  state = PluginLifecycleState.UNINITIALIZED;
  config: AuthPluginConfig;
  context?: PluginContext;

  private tokenCache = new Map<string, { token: string; expires: number }>();
  private refreshPromises = new Map<string, Promise<string>>();

  constructor(config: Partial<AuthPluginConfig> = {}) {
    this.config = {
      enabled: true,
      settings: {
        type: 'bearer',
        autoRefresh: true,
        refreshThreshold: 300,
        includeCredentials: false,
        apiKeyHeader: 'X-API-Key',
        ...config.settings
      },
      ...config
    } as AuthPluginConfig;
  }

  /**
   * Initialize plugin
   */
  async init(context: PluginContext): Promise<void> {
    this.context = context;
    
    // Register request interceptor
    this.interceptRequest(this.handleAuthentication.bind(this));
    
    // Register response interceptor for token refresh
    this.interceptResponse(this.handleTokenRefresh.bind(this));
    
    context.logger.info('Auth plugin initialized', { type: this.config.settings.type });
  }

  /**
   * Register request interceptor
   */
  interceptRequest(interceptor: (config: fluxhttpRequestConfig, context: PluginContext) => Promise<fluxhttpRequestConfig> | fluxhttpRequestConfig): void {
    if (this.context?.fluxhttp.interceptors.request) {
      this.context.fluxhttp.interceptors.request.use(
        (config) => interceptor(config, this.context!),
        undefined,
        { runWhen: () => this.config.enabled }
      );
    }
  }

  /**
   * Register response interceptor
   */
  interceptResponse(interceptor: (response: fluxhttpResponse, context: PluginContext) => Promise<fluxhttpResponse> | fluxhttpResponse): void {
    if (this.context?.fluxhttp.interceptors.response) {
      this.context.fluxhttp.interceptors.response.use(
        (response) => interceptor(response, this.context!),
        undefined,
        { runWhen: () => this.config.enabled }
      );
    }
  }

  /**
   * Handle authentication for requests
   */
  private async handleAuthentication(config: fluxhttpRequestConfig): Promise<fluxhttpRequestConfig> {
    if (!this.config.enabled) {
      return config;
    }

    const authConfig = this.config.settings;
    
    try {
      switch (authConfig.type) {
        case 'bearer':
          return await this.handleBearerAuth(config);
        
        case 'basic':
          return this.handleBasicAuth(config);
        
        case 'api-key':
          return this.handleApiKeyAuth(config);
        
        case 'oauth2':
          return await this.handleOAuth2Auth(config);
        
        case 'jwt':
          return await this.handleJWTAuth(config);
        
        case 'custom':
          return await this.handleCustomAuth(config);
        
        default:
          this.context?.logger.warn('Unknown authentication type', { type: authConfig.type });
          return config;
      }
    } catch (error) {
      this.context?.logger.error('Authentication failed', { error, type: authConfig.type });
      
      if (authConfig.onAuthError) {
        authConfig.onAuthError(error as Error);
      }
      
      throw error;
    }
  }

  /**
   * Handle bearer token authentication
   */
  private async handleBearerAuth(config: fluxhttpRequestConfig): Promise<fluxhttpRequestConfig> {
    const { token } = this.config.settings;
    
    if (!token) {
      throw new Error('Bearer token is required');
    }

    config.headers = config.headers || {};
    config.headers['Authorization'] = `Bearer ${token}`;
    
    if (this.config.settings.includeCredentials) {
      config.withCredentials = true;
    }

    return config;
  }

  /**
   * Handle basic authentication
   */
  private handleBasicAuth(config: fluxhttpRequestConfig): fluxhttpRequestConfig {
    const { username, password } = this.config.settings;
    
    if (!username || !password) {
      throw new Error('Username and password are required for basic auth');
    }

    const credentials = btoa(`${username}:${password}`);
    
    config.headers = config.headers || {};
    config.headers['Authorization'] = `Basic ${credentials}`;
    
    if (this.config.settings.includeCredentials) {
      config.withCredentials = true;
    }

    return config;
  }

  /**
   * Handle API key authentication
   */
  private handleApiKeyAuth(config: fluxhttpRequestConfig): fluxhttpRequestConfig {
    const { apiKey, apiKeyHeader } = this.config.settings;
    
    if (!apiKey) {
      throw new Error('API key is required');
    }

    config.headers = config.headers || {};
    config.headers[apiKeyHeader || 'X-API-Key'] = apiKey;

    return config;
  }

  /**
   * Handle OAuth2 authentication
   */
  private async handleOAuth2Auth(config: fluxhttpRequestConfig): Promise<fluxhttpRequestConfig> {
    const { accessToken, autoRefresh } = this.config.settings;
    
    if (!accessToken) {
      // Try to refresh token if auto-refresh is enabled
      if (autoRefresh) {
        const newToken = await this.refreshOAuth2Token();
        this.config.settings.accessToken = newToken;
      } else {
        throw new Error('OAuth2 access token is required');
      }
    }

    // Check if token needs refresh
    if (autoRefresh && this.shouldRefreshToken()) {
      const newToken = await this.refreshOAuth2Token();
      this.config.settings.accessToken = newToken;
    }

    config.headers = config.headers || {};
    config.headers['Authorization'] = `Bearer ${this.config.settings.accessToken}`;
    
    if (this.config.settings.includeCredentials) {
      config.withCredentials = true;
    }

    return config;
  }

  /**
   * Handle JWT authentication
   */
  private async handleJWTAuth(config: fluxhttpRequestConfig): Promise<fluxhttpRequestConfig> {
    const { jwt, autoRefresh } = this.config.settings;
    
    if (!jwt) {
      throw new Error('JWT token is required');
    }

    // Check if JWT needs refresh
    if (autoRefresh && this.isJWTExpired(jwt)) {
      // In a real implementation, you would refresh the JWT here
      this.context?.logger.warn('JWT token is expired');
    }

    config.headers = config.headers || {};
    config.headers['Authorization'] = `Bearer ${jwt}`;
    
    if (this.config.settings.includeCredentials) {
      config.withCredentials = true;
    }

    return config;
  }

  /**
   * Handle custom authentication
   */
  private async handleCustomAuth(config: fluxhttpRequestConfig): Promise<fluxhttpRequestConfig> {
    const { customAuth } = this.config.settings;
    
    if (!customAuth) {
      throw new Error('Custom authentication function is required');
    }

    return await customAuth(config);
  }

  /**
   * Handle token refresh from response
   */
  private async handleTokenRefresh(response: fluxhttpResponse): Promise<fluxhttpResponse> {
    // Check for 401 Unauthorized responses
    if (response.status === 401 && this.config.settings.autoRefresh) {
      try {
        if (this.config.settings.type === 'oauth2') {
          const newToken = await this.refreshOAuth2Token();
          this.config.settings.accessToken = newToken;
          
          if (this.config.settings.onTokenRefresh) {
            this.config.settings.onTokenRefresh(newToken);
          }
        }
      } catch (error) {
        this.context?.logger.error('Token refresh failed', { error });
      }
    }

    return response;
  }

  /**
   * Refresh OAuth2 token
   */
  private async refreshOAuth2Token(): Promise<string> {
    const {
      refreshToken,
      tokenEndpoint,
      clientId,
      clientSecret
    } = this.config.settings;

    if (!refreshToken || !tokenEndpoint || !clientId || !clientSecret) {
      throw new Error('OAuth2 refresh configuration is incomplete');
    }

    // Check if refresh is already in progress
    const cacheKey = `${clientId}:${refreshToken}`;
    if (this.refreshPromises.has(cacheKey)) {
      return this.refreshPromises.get(cacheKey)!;
    }

    const refreshPromise = this.performTokenRefresh(
      tokenEndpoint,
      clientId,
      clientSecret,
      refreshToken
    );

    this.refreshPromises.set(cacheKey, refreshPromise);

    try {
      const newToken = await refreshPromise;
      this.refreshPromises.delete(cacheKey);
      return newToken;
    } catch (error) {
      this.refreshPromises.delete(cacheKey);
      throw error;
    }
  }

  /**
   * Perform actual token refresh
   */
  private async performTokenRefresh(
    tokenEndpoint: string,
    clientId: string,
    clientSecret: string,
    refreshToken: string
  ): Promise<string> {
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret
    });

    // Use fetch directly to avoid circular authentication
    const response = await fetch(tokenEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: body.toString()
    });

    if (!response.ok) {
      throw new Error(`Token refresh failed: ${response.status} ${response.statusText}`);
    }

    const tokenResponse: OAuth2TokenResponse = await response.json();
    
    // Update refresh token if provided
    if (tokenResponse.refresh_token) {
      this.config.settings.refreshToken = tokenResponse.refresh_token;
    }

    // Cache token with expiry
    if (tokenResponse.expires_in) {
      const cacheKey = `${clientId}:${refreshToken}`;
      this.tokenCache.set(cacheKey, {
        token: tokenResponse.access_token,
        expires: Date.now() + (tokenResponse.expires_in * 1000)
      });
    }

    return tokenResponse.access_token;
  }

  /**
   * Check if token should be refreshed
   */
  private shouldRefreshToken(): boolean {
    const { refreshThreshold } = this.config.settings;
    
    // For OAuth2, check cached token expiry
    if (this.config.settings.type === 'oauth2') {
      const cacheKey = `${this.config.settings.clientId}:${this.config.settings.refreshToken}`;
      const cached = this.tokenCache.get(cacheKey);
      
      if (cached) {
        const timeUntilExpiry = cached.expires - Date.now();
        return timeUntilExpiry <= (refreshThreshold || 300) * 1000;
      }
    }

    return false;
  }

  /**
   * Check if JWT is expired
   */
  private isJWTExpired(jwt: string): boolean {
    try {
      const payload = this.parseJWT(jwt);
      
      if (payload.exp) {
        const now = Math.floor(Date.now() / 1000);
        const threshold = this.config.settings.refreshThreshold || 300;
        return payload.exp <= (now + threshold);
      }
    } catch (error) {
      this.context?.logger.warn('Failed to parse JWT', { error });
    }

    return false;
  }

  /**
   * Parse JWT payload
   */
  private parseJWT(jwt: string): JWTPayload {
    const parts = jwt.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid JWT format');
    }

    const payload = parts[1];
    const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    
    return JSON.parse(decoded);
  }

  /**
   * Update configuration
   */
  async updateConfig(config: Partial<AuthPluginConfig>): Promise<void> {
    this.config = { ...this.config, ...config };
    this.context?.logger.info('Auth plugin configuration updated');
  }

  /**
   * Get plugin health status
   */
  async getHealth() {
    const status = this.config.enabled ? 'healthy' : 'degraded';
    
    return {
      status,
      timestamp: Date.now(),
      details: {
        enabled: this.config.enabled,
        authType: this.config.settings.type,
        hasToken: !!(this.config.settings.token || this.config.settings.accessToken || this.config.settings.jwt),
        autoRefresh: this.config.settings.autoRefresh,
        tokenCacheSize: this.tokenCache.size
      }
    };
  }

  /**
   * Get plugin metrics
   */
  async getMetrics() {
    return {
      authType: this.config.settings.type,
      enabled: this.config.enabled,
      tokenCacheSize: this.tokenCache.size,
      refreshPromisesActive: this.refreshPromises.size
    };
  }
}

/**
 * Auth plugin factory
 */
export function createAuthPlugin(config?: Partial<AuthPluginConfig>): AuthPlugin {
  return new AuthPlugin(config);
}