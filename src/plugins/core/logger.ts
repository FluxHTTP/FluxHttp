/**
 * @fileoverview Plugin logger implementation
 * @module @fluxhttp/plugins/core/logger
 */

import type { PluginLogger as IPluginLogger } from '../types';

/**
 * Logger configuration
 */
export interface PluginLoggerConfig {
  enabled?: boolean;
  level?: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';
  namespace?: string;
  format?: 'json' | 'text';
  timestamp?: boolean;
  colors?: boolean;
}

/**
 * Log level priorities
 */
const LOG_LEVELS = {
  trace: 0,
  debug: 1,
  info: 2,
  warn: 3,
  error: 4,
  fatal: 5
} as const;

/**
 * Plugin logger implementation
 */
export class PluginLogger implements IPluginLogger {
  private readonly config: Required<PluginLoggerConfig>;
  private readonly bindings: Record<string, unknown> = {};

  constructor(config: PluginLoggerConfig = {}) {
    this.config = {
      enabled: true,
      level: 'info',
      namespace: 'fluxhttp:plugins',
      format: 'text',
      timestamp: true,
      colors: typeof window === 'undefined',
      ...config
    };
  }

  /**
   * Trace level logging
   */
  trace(message: string, ...args: unknown[]): void {
    this.log('trace', message, ...args);
  }

  /**
   * Debug level logging
   */
  debug(message: string, ...args: unknown[]): void {
    this.log('debug', message, ...args);
  }

  /**
   * Info level logging
   */
  info(message: string, ...args: unknown[]): void {
    this.log('info', message, ...args);
  }

  /**
   * Warn level logging
   */
  warn(message: string, ...args: unknown[]): void {
    this.log('warn', message, ...args);
  }

  /**
   * Error level logging
   */
  error(message: string, ...args: unknown[]): void {
    this.log('error', message, ...args);
  }

  /**
   * Fatal level logging
   */
  fatal(message: string, ...args: unknown[]): void {
    this.log('fatal', message, ...args);
  }

  /**
   * Create child logger with additional bindings
   */
  child(bindings: Record<string, unknown>): PluginLogger {
    const child = new PluginLogger(this.config);
    Object.assign(child.bindings, this.bindings, bindings);
    return child;
  }

  /**
   * Core logging method
   */
  private log(level: keyof typeof LOG_LEVELS, message: string, ...args: unknown[]): void {
    if (!this.config.enabled) {
      return;
    }

    const currentLevel = LOG_LEVELS[this.config.level];
    const messageLevel = LOG_LEVELS[level];

    if (messageLevel < currentLevel) {
      return;
    }

    const logEntry = this.createLogEntry(level, message, ...args);

    if (this.config.format === 'json') {
      console.log(JSON.stringify(logEntry));
    } else {
      const formatted = this.formatTextLog(level, message, logEntry);
      
      // Use appropriate console method
      switch (level) {
        case 'trace':
        case 'debug':
          console.debug(formatted, ...args);
          break;
        case 'info':
          console.info(formatted, ...args);
          break;
        case 'warn':
          console.warn(formatted, ...args);
          break;
        case 'error':
        case 'fatal':
          console.error(formatted, ...args);
          break;
      }
    }
  }

  /**
   * Create log entry object
   */
  private createLogEntry(level: string, message: string, ...args: unknown[]) {
    const entry: Record<string, unknown> = {
      level,
      msg: message,
      namespace: this.config.namespace,
      ...this.bindings
    };

    if (this.config.timestamp) {
      entry.time = new Date().toISOString();
    }

    if (args.length > 0) {
      // Handle structured logging
      const lastArg = args[args.length - 1];
      if (lastArg && typeof lastArg === 'object' && !Array.isArray(lastArg)) {
        Object.assign(entry, lastArg);
        args.pop();
      }
      
      if (args.length > 0) {
        entry.args = args;
      }
    }

    return entry;
  }

  /**
   * Format text log output
   */
  private formatTextLog(level: string, message: string, entry: Record<string, unknown>): string {
    const parts: string[] = [];

    // Timestamp
    if (this.config.timestamp && entry.time) {
      parts.push(`[${entry.time}]`);
    }

    // Level
    const levelStr = this.config.colors ? this.colorizeLevel(level) : level.toUpperCase();
    parts.push(`[${levelStr}]`);

    // Namespace
    if (this.config.namespace) {
      parts.push(`[${this.config.namespace}]`);
    }

    // Plugin ID
    if (entry.pluginId) {
      parts.push(`[${entry.pluginId}]`);
    }

    // Message
    parts.push(message);

    return parts.join(' ');
  }

  /**
   * Colorize log level for terminal output
   */
  private colorizeLevel(level: string): string {
    if (!this.config.colors) {
      return level.toUpperCase();
    }

    const colors = {
      trace: '\x1b[90m', // gray
      debug: '\x1b[36m', // cyan
      info: '\x1b[32m',  // green
      warn: '\x1b[33m',  // yellow
      error: '\x1b[31m', // red
      fatal: '\x1b[35m'  // magenta
    };

    const reset = '\x1b[0m';
    const color = colors[level as keyof typeof colors] || '';
    
    return `${color}${level.toUpperCase()}${reset}`;
  }
}