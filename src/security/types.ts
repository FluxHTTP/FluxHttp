// SECURITY: Type definitions for security configuration

export interface CSRFConfig {
  enabled: boolean;
  tokenHeader: string;
  cookieName: string;
  metaName: string;
  exemptMethods: string[];
  validateOrigin: boolean;
  tokenLength: number;
  rotateTokens: boolean;
}

export interface RateLimitConfig {
  enabled: boolean;
  maxRequests: number;
  windowMs: number;
  skipSuccessfulRequests: boolean;
  skipFailedRequests: boolean;
  cleanupInterval: number;
  keyGenerator?: (config: any) => string;
}

export interface ContentValidationConfig {
  enabled: boolean;
  maxRequestSize: number;
  maxResponseSize: number;
  allowedContentTypes: string[];
  blockedContentTypes: string[];
  validateJsonSyntax: boolean;
  blockMaliciousPatterns: boolean;
}

export interface SecurityHeadersConfig {
  enabled: boolean;
  forceHttps: boolean;
  strictTransportSecurity: boolean;
  contentTypeNoSniff: boolean;
  frameOptions: string;
  xssProtection: boolean;
  referrerPolicy: string;
  contentSecurityPolicy: string;
  permissionsPolicy?: string;
}

export interface RequestValidationConfig {
  enabled: boolean;
  allowedOrigins: string[];
  allowedMethods: string[];
  requireAuth: boolean;
  validateHeaders: boolean;
  blockSuspiciousUserAgents: boolean;
  validateReferer: boolean;
}

export interface SecurityConfig {
  csrf?: Partial<CSRFConfig>;
  rateLimit?: Partial<RateLimitConfig>;
  contentValidation?: Partial<ContentValidationConfig>;
  securityHeaders?: Partial<SecurityHeadersConfig>;
  requestValidation?: Partial<RequestValidationConfig>;
}

export interface RateLimitState {
  requests: number[];
  windowStart: number;
  lastCleanup?: number;
}
