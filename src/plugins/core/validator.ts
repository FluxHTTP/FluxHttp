/**
 * @fileoverview Plugin validator implementation
 * @module @fluxhttp/plugins/core/validator
 */

import type { Plugin, PluginError, PluginErrorType } from '../types';
import { PluginUtils } from './utils';

/**
 * Plugin validation configuration
 */
export interface PluginValidationConfig {
  /** Strict validation mode */
  strict?: boolean;
  /** Allow unsigned plugins */
  allowUnsigned?: boolean;
  /** Check plugin dependencies */
  checkDependencies?: boolean;
  /** Validate plugin configuration schema */
  validateConfigSchema?: boolean;
  /** Check for malicious patterns */
  securityCheck?: boolean;
  /** Validate plugin metadata */
  validateMetadata?: boolean;
  /** Check plugin size limits */
  checkSizeLimits?: boolean;
  /** Maximum plugin size in bytes */
  maxSize?: number;
}

/**
 * Validation result
 */
export interface ValidationResult {
  /** Whether validation passed */
  valid: boolean;
  /** Validation errors */
  errors: ValidationError[];
  /** Validation warnings */
  warnings: ValidationWarning[];
  /** Security issues found */
  securityIssues: SecurityIssue[];
}

/**
 * Validation error
 */
export interface ValidationError {
  /** Error code */
  code: string;
  /** Error message */
  message: string;
  /** Error severity */
  severity: 'error' | 'warning';
  /** Field that caused the error */
  field?: string;
  /** Additional context */
  context?: Record<string, unknown>;
}

/**
 * Validation warning
 */
export interface ValidationWarning {
  /** Warning code */
  code: string;
  /** Warning message */
  message: string;
  /** Field that caused the warning */
  field?: string;
  /** Recommendation */
  recommendation?: string;
}

/**
 * Security issue
 */
export interface SecurityIssue {
  /** Issue type */
  type: 'malicious_pattern' | 'unsafe_operation' | 'suspicious_dependency' | 'excessive_permissions';
  /** Issue severity */
  severity: 'low' | 'medium' | 'high' | 'critical';
  /** Issue description */
  description: string;
  /** Location of the issue */
  location?: string;
  /** Mitigation suggestions */
  mitigation?: string;
}

/**
 * Plugin validator implementation
 */
export class PluginValidator {
  private readonly config: Required<PluginValidationConfig>;
  private readonly utils = new PluginUtils();

  // Malicious patterns to check for
  private readonly maliciousPatterns = [
    /eval\s*\(/i,
    /Function\s*\(/i,
    /setTimeout\s*\(\s*["'`][^"'`]*["'`]/i,
    /setInterval\s*\(\s*["'`][^"'`]*["'`]/i,
    /document\.write/i,
    /innerHTML\s*=/i,
    /outerHTML\s*=/i,
    /insertAdjacentHTML/i,
    /crypto\.subtle/i,
    /navigator\.geolocation/i,
    /localStorage\./i,
    /sessionStorage\./i,
    /indexedDB/i,
    /webkitRequestFileSystem/i,
    /requestFileSystem/i
  ];

  // Suspicious dependencies
  private readonly suspiciousDependencies = [
    'child_process',
    'fs',
    'path',
    'os',
    'crypto',
    'http',
    'https',
    'net',
    'tls',
    'dgram',
    'dns',
    'cluster',
    'worker_threads'
  ];

  constructor(config: PluginValidationConfig = {}) {
    this.config = {
      strict: true,
      allowUnsigned: false,
      checkDependencies: true,
      validateConfigSchema: true,
      securityCheck: true,
      validateMetadata: true,
      checkSizeLimits: true,
      maxSize: 1024 * 1024, // 1MB
      ...config
    };
  }

  /**
   * Validate a plugin
   */
  async validatePlugin(plugin: Plugin): Promise<void> {
    const result = await this.validatePluginDetailed(plugin);
    
    if (!result.valid) {
      const errorMessages = result.errors.map(e => e.message).join('; ');
      const error = new Error(`Plugin validation failed: ${errorMessages}`) as PluginError;
      error.type = 'validation_error' as PluginErrorType;
      error.pluginId = plugin.metadata.id;
      error.code = 'VALIDATION_FAILED';
      error.timestamp = Date.now();
      throw error;
    }

    // Log warnings if any
    if (result.warnings.length > 0) {
      console.warn(`Plugin validation warnings for '${plugin.metadata.id}':`, result.warnings);
    }

    // Log security issues if any
    if (result.securityIssues.length > 0) {
      console.warn(`Security issues found in plugin '${plugin.metadata.id}':`, result.securityIssues);
      
      // In strict mode, treat high/critical security issues as errors
      if (this.config.strict) {
        const criticalIssues = result.securityIssues.filter(
          issue => issue.severity === 'high' || issue.severity === 'critical'
        );
        
        if (criticalIssues.length > 0) {
          const error = new Error(`Plugin contains critical security issues`) as PluginError;
          error.type = 'security_error' as PluginErrorType;
          error.pluginId = plugin.metadata.id;
          error.code = 'SECURITY_VIOLATION';
          error.context = { securityIssues: criticalIssues };
          error.timestamp = Date.now();
          throw error;
        }
      }
    }
  }

  /**
   * Validate plugin with detailed results
   */
  async validatePluginDetailed(plugin: Plugin): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const securityIssues: SecurityIssue[] = [];

    // Validate metadata
    if (this.config.validateMetadata) {
      this.validateMetadata(plugin, errors, warnings);
    }

    // Validate configuration schema
    if (this.config.validateConfigSchema && plugin.configSchema) {
      this.validateConfigSchema(plugin, errors, warnings);
    }

    // Validate dependencies
    if (this.config.checkDependencies) {
      this.validateDependencies(plugin, errors, warnings, securityIssues);
    }

    // Security checks
    if (this.config.securityCheck) {
      await this.performSecurityChecks(plugin, securityIssues);
    }

    // Size limits check
    if (this.config.checkSizeLimits) {
      this.checkSizeLimits(plugin, errors, warnings);
    }

    // Additional strict mode validations
    if (this.config.strict) {
      this.performStrictValidations(plugin, errors, warnings);
    }

    const valid = errors.length === 0 && 
                  (!this.config.strict || securityIssues.filter(i => i.severity === 'critical').length === 0);

    return {
      valid,
      errors,
      warnings,
      securityIssues
    };
  }

  /**
   * Validate plugin metadata
   */
  private validateMetadata(plugin: Plugin, errors: ValidationError[], warnings: ValidationWarning[]): void {
    const { metadata } = plugin;

    // Required fields
    if (!metadata.id) {
      errors.push({
        code: 'MISSING_ID',
        message: 'Plugin ID is required',
        severity: 'error',
        field: 'metadata.id'
      });
    } else if (!/^[a-zA-Z0-9._-]+$/.test(metadata.id)) {
      errors.push({
        code: 'INVALID_ID',
        message: 'Plugin ID must contain only alphanumeric characters, dots, underscores, and hyphens',
        severity: 'error',
        field: 'metadata.id'
      });
    }

    if (!metadata.name) {
      errors.push({
        code: 'MISSING_NAME',
        message: 'Plugin name is required',
        severity: 'error',
        field: 'metadata.name'
      });
    }

    if (!metadata.version) {
      errors.push({
        code: 'MISSING_VERSION',
        message: 'Plugin version is required',
        severity: 'error',
        field: 'metadata.version'
      });
    } else {
      try {
        this.utils.parseVersion(metadata.version);
      } catch (error) {
        errors.push({
          code: 'INVALID_VERSION',
          message: `Invalid semver version: ${metadata.version}`,
          severity: 'error',
          field: 'metadata.version'
        });
      }
    }

    if (!metadata.description) {
      warnings.push({
        code: 'MISSING_DESCRIPTION',
        message: 'Plugin description is recommended',
        field: 'metadata.description',
        recommendation: 'Add a clear description of what the plugin does'
      });
    }

    if (!metadata.author) {
      warnings.push({
        code: 'MISSING_AUTHOR',
        message: 'Plugin author information is recommended',
        field: 'metadata.author',
        recommendation: 'Add author information for accountability'
      });
    }

    if (!metadata.license) {
      warnings.push({
        code: 'MISSING_LICENSE',
        message: 'Plugin license is recommended',
        field: 'metadata.license',
        recommendation: 'Specify a license for legal clarity'
      });
    }

    // Validate keywords
    if (metadata.keywords && metadata.keywords.length === 0) {
      warnings.push({
        code: 'EMPTY_KEYWORDS',
        message: 'Plugin keywords are empty',
        field: 'metadata.keywords',
        recommendation: 'Add relevant keywords for discoverability'
      });
    }

    // Validate FluxHTTP version requirements
    if (metadata.minFluxHttpVersion) {
      try {
        this.utils.parseVersion(metadata.minFluxHttpVersion);
      } catch (error) {
        errors.push({
          code: 'INVALID_MIN_VERSION',
          message: `Invalid minimum FluxHTTP version: ${metadata.minFluxHttpVersion}`,
          severity: 'error',
          field: 'metadata.minFluxHttpVersion'
        });
      }
    }

    if (metadata.maxFluxHttpVersion) {
      try {
        this.utils.parseVersion(metadata.maxFluxHttpVersion);
      } catch (error) {
        errors.push({
          code: 'INVALID_MAX_VERSION',
          message: `Invalid maximum FluxHTTP version: ${metadata.maxFluxHttpVersion}`,
          severity: 'error',
          field: 'metadata.maxFluxHttpVersion'
        });
      }
    }
  }

  /**
   * Validate configuration schema
   */
  private validateConfigSchema(plugin: Plugin, errors: ValidationError[], warnings: ValidationWarning[]): void {
    const { configSchema } = plugin;
    
    if (!configSchema) {
      return;
    }

    // Validate schema structure
    if (configSchema.type !== 'object') {
      errors.push({
        code: 'INVALID_SCHEMA_TYPE',
        message: 'Config schema must be of type "object"',
        severity: 'error',
        field: 'configSchema.type'
      });
    }

    if (!configSchema.properties) {
      warnings.push({
        code: 'EMPTY_SCHEMA_PROPERTIES',
        message: 'Config schema has no properties defined',
        field: 'configSchema.properties',
        recommendation: 'Define properties for plugin configuration validation'
      });
    }

    // Validate current config against schema
    if (plugin.config && configSchema.properties) {
      const isValid = this.utils.validateSchema(plugin.config, configSchema);
      if (!isValid) {
        errors.push({
          code: 'CONFIG_SCHEMA_MISMATCH',
          message: 'Plugin config does not match the defined schema',
          severity: 'error',
          field: 'config'
        });
      }
    }
  }

  /**
   * Validate plugin dependencies
   */
  private validateDependencies(
    plugin: Plugin,
    errors: ValidationError[],
    warnings: ValidationWarning[],
    securityIssues: SecurityIssue[]
  ): void {
    const { dependencies, peerDependencies } = plugin.metadata;

    // Validate dependencies
    if (dependencies) {
      for (const dep of dependencies) {
        if (!dep.id) {
          errors.push({
            code: 'INVALID_DEPENDENCY_ID',
            message: 'Dependency ID is required',
            severity: 'error',
            field: 'metadata.dependencies'
          });
          continue;
        }

        if (!dep.version) {
          errors.push({
            code: 'INVALID_DEPENDENCY_VERSION',
            message: `Dependency '${dep.id}' is missing version requirement`,
            severity: 'error',
            field: 'metadata.dependencies'
          });
        }

        // Check for suspicious dependencies
        this.checkSuspiciousDependency(dep.id, securityIssues);
      }
    }

    // Validate peer dependencies
    if (peerDependencies) {
      for (const dep of peerDependencies) {
        if (!dep.id || !dep.version) {
          errors.push({
            code: 'INVALID_PEER_DEPENDENCY',
            message: 'Peer dependency must have ID and version',
            severity: 'error',
            field: 'metadata.peerDependencies'
          });
        }

        // Check for suspicious dependencies
        this.checkSuspiciousDependency(dep.id, securityIssues);
      }
    }

    // Check for circular dependencies in metadata
    if (dependencies && dependencies.some(dep => dep.id === plugin.metadata.id)) {
      errors.push({
        code: 'CIRCULAR_DEPENDENCY',
        message: 'Plugin cannot depend on itself',
        severity: 'error',
        field: 'metadata.dependencies'
      });
    }
  }

  /**
   * Perform security checks
   */
  private async performSecurityChecks(plugin: Plugin, securityIssues: SecurityIssue[]): Promise<void> {
    // Convert plugin to string for pattern matching
    const pluginString = JSON.stringify(plugin);

    // Check for malicious patterns
    for (const pattern of this.maliciousPatterns) {
      if (pattern.test(pluginString)) {
        securityIssues.push({
          type: 'malicious_pattern',
          severity: 'high',
          description: `Potentially malicious pattern detected: ${pattern.source}`,
          location: 'plugin code',
          mitigation: 'Review plugin code for security vulnerabilities'
        });
      }
    }

    // Check for unsafe operations
    if (pluginString.includes('prototype.constructor') || pluginString.includes('__proto__')) {
      securityIssues.push({
        type: 'unsafe_operation',
        severity: 'high',
        description: 'Potential prototype pollution detected',
        location: 'plugin code',
        mitigation: 'Avoid modifying object prototypes'
      });
    }

    // Check for excessive permissions
    const capabilities = plugin.metadata.capabilities;
    if (capabilities) {
      let permissionCount = 0;
      for (const [key, value] of Object.entries(capabilities)) {
        if (value === true) {
          permissionCount++;
        }
      }

      if (permissionCount > 5) {
        securityIssues.push({
          type: 'excessive_permissions',
          severity: 'medium',
          description: `Plugin requests ${permissionCount} capabilities, which may be excessive`,
          location: 'metadata.capabilities',
          mitigation: 'Review if all capabilities are necessary'
        });
      }
    }

    // Check for unsigned plugin
    if (!this.config.allowUnsigned) {
      // In a real implementation, you would check for plugin signatures here
      // For now, we'll add a warning
      securityIssues.push({
        type: 'malicious_pattern',
        severity: 'low',
        description: 'Plugin is not digitally signed',
        location: 'plugin metadata',
        mitigation: 'Use only trusted, signed plugins in production'
      });
    }
  }

  /**
   * Check size limits
   */
  private checkSizeLimits(plugin: Plugin, errors: ValidationError[], warnings: ValidationWarning[]): void {
    const pluginSize = JSON.stringify(plugin).length;
    
    if (pluginSize > this.config.maxSize) {
      errors.push({
        code: 'PLUGIN_TOO_LARGE',
        message: `Plugin size (${this.utils.formatBytes(pluginSize)}) exceeds maximum allowed size (${this.utils.formatBytes(this.config.maxSize)})`,
        severity: 'error',
        context: { size: pluginSize, maxSize: this.config.maxSize }
      });
    } else if (pluginSize > this.config.maxSize * 0.8) {
      warnings.push({
        code: 'PLUGIN_SIZE_WARNING',
        message: `Plugin size (${this.utils.formatBytes(pluginSize)}) is approaching the maximum limit`,
        recommendation: 'Consider optimizing plugin size'
      });
    }
  }

  /**
   * Perform strict mode validations
   */
  private performStrictValidations(plugin: Plugin, errors: ValidationError[], warnings: ValidationWarning[]): void {
    // In strict mode, warnings become errors for critical fields
    const criticalFields = ['author', 'license', 'description'];
    
    const { metadata } = plugin;
    
    if (!metadata.author) {
      errors.push({
        code: 'MISSING_AUTHOR_STRICT',
        message: 'Plugin author is required in strict mode',
        severity: 'error',
        field: 'metadata.author'
      });
    }

    if (!metadata.license) {
      errors.push({
        code: 'MISSING_LICENSE_STRICT',
        message: 'Plugin license is required in strict mode',
        severity: 'error',
        field: 'metadata.license'
      });
    }

    if (!metadata.description) {
      errors.push({
        code: 'MISSING_DESCRIPTION_STRICT',
        message: 'Plugin description is required in strict mode',
        severity: 'error',
        field: 'metadata.description'
      });
    }

    // Require minimum metadata fields
    if (!metadata.homepage && !metadata.repository) {
      warnings.push({
        code: 'MISSING_LINKS',
        message: 'Plugin should have homepage or repository information',
        recommendation: 'Add homepage or repository URL for transparency'
      });
    }
  }

  /**
   * Check for suspicious dependencies
   */
  private checkSuspiciousDependency(dependencyId: string, securityIssues: SecurityIssue[]): void {
    if (this.suspiciousDependencies.includes(dependencyId)) {
      securityIssues.push({
        type: 'suspicious_dependency',
        severity: 'medium',
        description: `Dependency '${dependencyId}' has access to sensitive system resources`,
        location: 'plugin dependencies',
        mitigation: 'Verify that this dependency is necessary and from a trusted source'
      });
    }
  }
}