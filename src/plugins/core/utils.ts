/**
 * @fileoverview Plugin utilities implementation
 * @module @fluxhttp/plugins/core/utils
 */

import type { PluginUtils as IPluginUtils, PluginConfigSchema } from '../types';

/**
 * Plugin utilities implementation
 */
export class PluginUtils implements IPluginUtils {
  private idCounter = 0;

  /**
   * Generate unique ID
   */
  generateId(): string {
    return `plugin_${Date.now()}_${++this.idCounter}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Deep clone object
   */
  deepClone<T>(obj: T): T {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }

    if (obj instanceof Date) {
      return new Date(obj.getTime()) as unknown as T;
    }

    if (obj instanceof RegExp) {
      return new RegExp(obj.source, obj.flags) as unknown as T;
    }

    if (obj instanceof Array) {
      return obj.map(item => this.deepClone(item)) as unknown as T;
    }

    if (obj instanceof Map) {
      const cloned = new Map();
      for (const [key, value] of obj) {
        cloned.set(this.deepClone(key), this.deepClone(value));
      }
      return cloned as unknown as T;
    }

    if (obj instanceof Set) {
      const cloned = new Set();
      for (const value of obj) {
        cloned.add(this.deepClone(value));
      }
      return cloned as unknown as T;
    }

    if (typeof obj === 'object') {
      const cloned = {} as T;
      for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
          (cloned as any)[key] = this.deepClone((obj as any)[key]);
        }
      }
      return cloned;
    }

    return obj;
  }

  /**
   * Deep merge objects
   */
  deepMerge<T>(target: T, ...sources: Partial<T>[]): T {
    if (!sources.length) {
      return target;
    }

    const source = sources.shift();
    if (!source) {
      return this.deepMerge(target, ...sources);
    }

    if (this.isPlainObject(target) && this.isPlainObject(source)) {
      for (const key in source) {
        if (this.isPlainObject((source as any)[key])) {
          if (!(target as any)[key]) {
            Object.assign(target as any, { [key]: {} });
          }
          this.deepMerge((target as any)[key], (source as any)[key]);
        } else {
          Object.assign(target as any, { [key]: (source as any)[key] });
        }
      }
    }

    return this.deepMerge(target, ...sources);
  }

  /**
   * Check if object is plain object
   */
  isPlainObject(obj: unknown): obj is Record<string, unknown> {
    if (typeof obj !== 'object' || obj === null) {
      return false;
    }

    if (Object.prototype.toString.call(obj) !== '[object Object]') {
      return false;
    }

    if (Object.getPrototypeOf(obj) === null) {
      return true;
    }

    let proto = obj;
    while (Object.getPrototypeOf(proto) !== null) {
      proto = Object.getPrototypeOf(proto);
    }

    return Object.getPrototypeOf(obj) === proto;
  }

  /**
   * Throttle function execution
   */
  throttle<T extends (...args: any[]) => any>(fn: T, wait: number): T {
    let inThrottle = false;
    let lastFunc: NodeJS.Timeout;
    let lastRan: number;

    return ((...args: any[]) => {
      if (!inThrottle) {
        fn.apply(this, args);
        lastRan = Date.now();
        inThrottle = true;
      } else {
        clearTimeout(lastFunc);
        lastFunc = setTimeout(() => {
          if (Date.now() - lastRan >= wait) {
            fn.apply(this, args);
            lastRan = Date.now();
          }
        }, Math.max(wait - (Date.now() - lastRan), 0));
      }
    }) as T;
  }

  /**
   * Debounce function execution
   */
  debounce<T extends (...args: any[]) => any>(fn: T, wait: number): T {
    let timeout: NodeJS.Timeout;

    return ((...args: any[]) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => fn.apply(this, args), wait);
    }) as T;
  }

  /**
   * Validate JSON schema (simplified implementation)
   */
  validateSchema(data: unknown, schema: PluginConfigSchema): boolean {
    try {
      return this.validateSchemaRecursive(data, schema);
    } catch (error) {
      return false;
    }
  }

  /**
   * Parse semver version
   */
  parseVersion(version: string): { major: number; minor: number; patch: number } {
    const match = version.match(/^(\d+)\.(\d+)\.(\d+)/);
    if (!match) {
      throw new Error(`Invalid version format: ${version}`);
    }

    return {
      major: parseInt(match[1], 10),
      minor: parseInt(match[2], 10),
      patch: parseInt(match[3], 10)
    };
  }

  /**
   * Compare semver versions
   */
  compareVersions(a: string, b: string): -1 | 0 | 1 {
    const versionA = this.parseVersion(a);
    const versionB = this.parseVersion(b);

    if (versionA.major !== versionB.major) {
      return versionA.major > versionB.major ? 1 : -1;
    }

    if (versionA.minor !== versionB.minor) {
      return versionA.minor > versionB.minor ? 1 : -1;
    }

    if (versionA.patch !== versionB.patch) {
      return versionA.patch > versionB.patch ? 1 : -1;
    }

    return 0;
  }

  /**
   * Check if version satisfies range
   */
  satisfiesVersion(version: string, range: string): boolean {
    // Simple implementation - supports ^, ~, >=, <=, >, <, and exact matches
    const trimmedRange = range.trim();
    
    if (trimmedRange === '*') {
      return true;
    }

    if (trimmedRange === version) {
      return true;
    }

    // Handle caret range (^1.2.3)
    if (trimmedRange.startsWith('^')) {
      const rangeVersion = trimmedRange.substring(1);
      const rangeParsed = this.parseVersion(rangeVersion);
      const versionParsed = this.parseVersion(version);
      
      return versionParsed.major === rangeParsed.major &&
             (versionParsed.minor > rangeParsed.minor ||
              (versionParsed.minor === rangeParsed.minor && versionParsed.patch >= rangeParsed.patch));
    }

    // Handle tilde range (~1.2.3)
    if (trimmedRange.startsWith('~')) {
      const rangeVersion = trimmedRange.substring(1);
      const rangeParsed = this.parseVersion(rangeVersion);
      const versionParsed = this.parseVersion(version);
      
      return versionParsed.major === rangeParsed.major &&
             versionParsed.minor === rangeParsed.minor &&
             versionParsed.patch >= rangeParsed.patch;
    }

    // Handle comparison operators
    const operators = ['>=', '<=', '>', '<'];
    for (const operator of operators) {
      if (trimmedRange.startsWith(operator)) {
        const rangeVersion = trimmedRange.substring(operator.length).trim();
        const comparison = this.compareVersions(version, rangeVersion);
        
        switch (operator) {
          case '>=':
            return comparison >= 0;
          case '<=':
            return comparison <= 0;
          case '>':
            return comparison > 0;
          case '<':
            return comparison < 0;
        }
      }
    }

    // If no operator matches, try exact match
    return version === trimmedRange;
  }

  /**
   * Format bytes to human readable string
   */
  formatBytes(bytes: number, decimals = 2): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }

  /**
   * Escape string for use in regular expressions
   */
  escapeRegExp(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Convert camelCase to kebab-case
   */
  camelToKebab(str: string): string {
    return str.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
  }

  /**
   * Convert kebab-case to camelCase
   */
  kebabToCamel(str: string): string {
    return str.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
  }

  /**
   * Create timeout promise
   */
  timeout(ms: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms);
    });
  }

  /**
   * Retry function with exponential backoff
   */
  async retry<T>(
    fn: () => Promise<T>,
    options: {
      attempts?: number;
      delay?: number;
      backoff?: number;
      maxDelay?: number;
    } = {}
  ): Promise<T> {
    const {
      attempts = 3,
      delay = 1000,
      backoff = 2,
      maxDelay = 30000
    } = options;

    let lastError: Error;
    let currentDelay = delay;

    for (let attempt = 1; attempt <= attempts; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;

        if (attempt === attempts) {
          throw lastError;
        }

        await new Promise(resolve => setTimeout(resolve, currentDelay));
        currentDelay = Math.min(currentDelay * backoff, maxDelay);
      }
    }

    throw lastError!;
  }

  // Private methods

  /**
   * Recursive schema validation
   */
  private validateSchemaRecursive(data: unknown, schema: any): boolean {
    if (schema.type === 'object') {
      if (typeof data !== 'object' || data === null || Array.isArray(data)) {
        return false;
      }

      const obj = data as Record<string, unknown>;

      // Check required properties
      if (schema.required) {
        for (const required of schema.required) {
          if (!(required in obj)) {
            return false;
          }
        }
      }

      // Validate properties
      if (schema.properties) {
        for (const [key, value] of Object.entries(obj)) {
          const propSchema = schema.properties[key];
          if (propSchema && !this.validateSchemaRecursive(value, propSchema)) {
            return false;
          }
        }
      }

      return true;
    }

    if (schema.type === 'array') {
      if (!Array.isArray(data)) {
        return false;
      }

      if (schema.items) {
        return data.every(item => this.validateSchemaRecursive(item, schema.items));
      }

      return true;
    }

    if (schema.type === 'string') {
      if (typeof data !== 'string') {
        return false;
      }

      if (schema.pattern) {
        const regex = new RegExp(schema.pattern);
        if (!regex.test(data)) {
          return false;
        }
      }

      if (schema.enum && !schema.enum.includes(data)) {
        return false;
      }

      return true;
    }

    if (schema.type === 'number') {
      if (typeof data !== 'number' || isNaN(data)) {
        return false;
      }

      if (schema.minimum !== undefined && data < schema.minimum) {
        return false;
      }

      if (schema.maximum !== undefined && data > schema.maximum) {
        return false;
      }

      return true;
    }

    if (schema.type === 'boolean') {
      return typeof data === 'boolean';
    }

    return true;
  }
}