/**
 * @fileoverview Plugin generator for creating plugins from templates
 * @module @fluxhttp/plugins/pdk/generator
 */

import type { PluginTemplate, PluginTemplateFile } from '../types';
import { PluginTemplate as TemplateManager } from './template';

/**
 * Plugin generation options
 */
export interface PluginGenerationOptions {
  /** Template name */
  template: string;
  /** Template variables */
  variables: Record<string, unknown>;
  /** Output directory */
  outputDir?: string;
  /** Whether to overwrite existing files */
  overwrite?: boolean;
  /** File encoding */
  encoding?: BufferEncoding;
  /** Dry run mode (don't write files) */
  dryRun?: boolean;
}

/**
 * Plugin generation result
 */
export interface PluginGenerationResult {
  /** Generated files */
  files: PluginTemplateFile[];
  /** Generation errors */
  errors: string[];
  /** Generation warnings */
  warnings: string[];
  /** Total files generated */
  totalFiles: number;
  /** Generation time in milliseconds */
  generationTime: number;
}

/**
 * Plugin generator utility
 */
export class PluginGenerator {
  /**
   * Generate plugin from template
   */
  async generate(options: PluginGenerationOptions): Promise<PluginGenerationResult> {
    const startTime = Date.now();
    const result: PluginGenerationResult = {
      files: [],
      errors: [],
      warnings: [],
      totalFiles: 0,
      generationTime: 0
    };

    try {
      // Validate template exists
      const template = TemplateManager.get(options.template);
      if (!template) {
        result.errors.push(`Template '${options.template}' not found`);
        return result;
      }

      // Validate variables
      const validationErrors = TemplateManager.validateVariables(options.template, options.variables);
      if (validationErrors.length > 0) {
        result.errors.push(...validationErrors);
        return result;
      }

      // Add computed variables
      const allVariables = this.addComputedVariables(options.variables);

      // Generate files
      const generatedFiles = TemplateManager.generate(options.template, allVariables);
      
      // Process each file
      for (const file of generatedFiles) {
        try {
          const processedFile = await this.processFile(file, options);
          result.files.push(processedFile);
          result.totalFiles++;
        } catch (error) {
          result.errors.push(`Failed to process file '${file.path}': ${error}`);
        }
      }

      // Generate additional files if needed
      const additionalFiles = await this.generateAdditionalFiles(template, allVariables, options);
      result.files.push(...additionalFiles);
      result.totalFiles += additionalFiles.length;

    } catch (error) {
      result.errors.push(`Plugin generation failed: ${error}`);
    }

    result.generationTime = Date.now() - startTime;
    return result;
  }

  /**
   * Generate plugin from template name (convenience method)
   */
  async fromTemplate(templateName: string, variables: Record<string, unknown>): Promise<PluginGenerationResult> {
    return this.generate({
      template: templateName,
      variables,
      dryRun: true // Default to dry run for safety
    });
  }

  /**
   * Preview plugin generation without writing files
   */
  async preview(templateName: string, variables: Record<string, unknown>): Promise<PluginTemplateFile[]> {
    const result = await this.generate({
      template: templateName,
      variables,
      dryRun: true
    });

    if (result.errors.length > 0) {
      throw new Error(`Preview failed: ${result.errors.join(', ')}`);
    }

    return result.files;
  }

  /**
   * Get available templates
   */
  getAvailableTemplates(): PluginTemplate[] {
    return TemplateManager.getAll();
  }

  /**
   * Get template by name
   */
  getTemplate(name: string): PluginTemplate | undefined {
    return TemplateManager.get(name);
  }

  /**
   * Validate plugin name
   */
  validatePluginName(name: string): string[] {
    const errors: string[] = [];

    if (!name) {
      errors.push('Plugin name is required');
      return errors;
    }

    // Check length
    if (name.length < 2) {
      errors.push('Plugin name must be at least 2 characters long');
    }

    if (name.length > 50) {
      errors.push('Plugin name must be less than 50 characters');
    }

    // Check format (kebab-case)
    if (!/^[a-z][a-z0-9-]*$/.test(name)) {
      errors.push('Plugin name must be in kebab-case format (lowercase letters, numbers, and hyphens only)');
    }

    // Check reserved names
    const reservedNames = ['core', 'built-in', 'builtin', 'system', 'fluxhttp', 'plugin'];
    if (reservedNames.includes(name)) {
      errors.push(`Plugin name '${name}' is reserved`);
    }

    // Check for consecutive hyphens
    if (name.includes('--')) {
      errors.push('Plugin name cannot contain consecutive hyphens');
    }

    // Check start and end
    if (name.startsWith('-') || name.endsWith('-')) {
      errors.push('Plugin name cannot start or end with a hyphen');
    }

    return errors;
  }

  /**
   * Generate class name from plugin ID
   */
  generateClassName(pluginId: string): string {
    return pluginId
      .split('-')
      .map(part => part.charAt(0).toUpperCase() + part.slice(1))
      .join('') + 'Plugin';
  }

  /**
   * Generate package name from plugin ID
   */
  generatePackageName(pluginId: string, scope?: string): string {
    const baseName = pluginId.startsWith('fluxhttp-') ? pluginId : `fluxhttp-${pluginId}`;
    return scope ? `@${scope}/${baseName}` : baseName;
  }

  /**
   * Process template file
   */
  private async processFile(file: PluginTemplateFile, options: PluginGenerationOptions): Promise<PluginTemplateFile> {
    // Process file path variables
    const processedPath = this.interpolateString(file.path, options.variables);
    
    // Process file content
    const processedContent = this.processFileContent(file.content, options.variables);

    return {
      ...file,
      path: processedPath,
      content: processedContent
    };
  }

  /**
   * Process file content
   */
  private processFileContent(content: string, variables: Record<string, unknown>): string {
    let processed = content;

    // Handle conditional blocks {{#if variable}}...{{/if}}
    processed = this.processConditionals(processed, variables);

    // Handle loops {{#each array}}...{{/each}}
    processed = this.processLoops(processed, variables);

    // Handle simple interpolation {{variable}}
    processed = this.interpolateString(processed, variables);

    // Handle helper functions
    processed = this.processHelpers(processed, variables);

    return processed;
  }

  /**
   * Process conditional blocks
   */
  private processConditionals(content: string, variables: Record<string, unknown>): string {
    const conditionalRegex = /{{#if\s+(\w+)}}([\s\S]*?){{\/if}}/g;
    
    return content.replace(conditionalRegex, (match, variable, block) => {
      const value = variables[variable];
      return value ? block : '';
    });
  }

  /**
   * Process loop blocks
   */
  private processLoops(content: string, variables: Record<string, unknown>): string {
    const loopRegex = /{{#each\s+(\w+)}}([\s\S]*?){{\/each}}/g;
    
    return content.replace(loopRegex, (match, variable, block) => {
      const array = variables[variable];
      if (!Array.isArray(array)) {
        return '';
      }

      return array.map(item => {
        let processedBlock = block;
        
        // Replace {{this}} with current item
        processedBlock = processedBlock.replace(/{{this}}/g, String(item));
        
        // Replace {{@index}} with current index
        processedBlock = processedBlock.replace(/{{@index}}/g, String(array.indexOf(item)));
        
        return processedBlock;
      }).join('');
    });
  }

  /**
   * Process helper functions
   */
  private processHelpers(content: string, variables: Record<string, unknown>): string {
    // {{uppercase variable}}
    content = content.replace(/{{uppercase\s+(\w+)}}/g, (match, variable) => {
      const value = variables[variable];
      return typeof value === 'string' ? value.toUpperCase() : String(value);
    });

    // {{lowercase variable}}
    content = content.replace(/{{lowercase\s+(\w+)}}/g, (match, variable) => {
      const value = variables[variable];
      return typeof value === 'string' ? value.toLowerCase() : String(value);
    });

    // {{camelCase variable}}
    content = content.replace(/{{camelCase\s+(\w+)}}/g, (match, variable) => {
      const value = variables[variable];
      if (typeof value === 'string') {
        return value.replace(/-(\w)/g, (_, letter) => letter.toUpperCase());
      }
      return String(value);
    });

    // {{pascalCase variable}}
    content = content.replace(/{{pascalCase\s+(\w+)}}/g, (match, variable) => {
      const value = variables[variable];
      if (typeof value === 'string') {
        const camelCase = value.replace(/-(\w)/g, (_, letter) => letter.toUpperCase());
        return camelCase.charAt(0).toUpperCase() + camelCase.slice(1);
      }
      return String(value);
    });

    return content;
  }

  /**
   * Interpolate string variables
   */
  private interpolateString(str: string, variables: Record<string, unknown>): string {
    return str.replace(/{{(\w+)}}/g, (match, variable) => {
      const value = variables[variable];
      return value !== undefined ? String(value) : match;
    });
  }

  /**
   * Add computed variables
   */
  private addComputedVariables(variables: Record<string, unknown>): Record<string, unknown> {
    const computed = { ...variables };

    // Generate class name from plugin ID if not provided
    if (computed.pluginId && !computed.className) {
      computed.className = this.generateClassName(String(computed.pluginId));
    }

    // Generate package name if not provided
    if (computed.pluginId && !computed.packageName) {
      computed.packageName = this.generatePackageName(String(computed.pluginId));
    }

    // Add current date
    computed.currentDate = new Date().toISOString().split('T')[0];
    computed.currentYear = new Date().getFullYear();

    // Add version if not provided
    if (!computed.version) {
      computed.version = '1.0.0';
    }

    return computed;
  }

  /**
   * Generate additional files based on template
   */
  private async generateAdditionalFiles(
    template: PluginTemplate,
    variables: Record<string, unknown>,
    options: PluginGenerationOptions
  ): Promise<PluginTemplateFile[]> {
    const additionalFiles: PluginTemplateFile[] = [];

    // Generate TypeScript configuration
    if (template.type !== 'minimal') {
      additionalFiles.push({
        path: 'tsconfig.json',
        content: JSON.stringify({
          compilerOptions: {
            target: 'ES2020',
            module: 'commonjs',
            lib: ['ES2020'],
            outDir: './dist',
            rootDir: './src',
            strict: true,
            esModuleInterop: true,
            skipLibCheck: true,
            forceConsistentCasingInFileNames: true,
            declaration: true,
            declarationMap: true,
            sourceMap: true
          },
          include: ['src/**/*'],
          exclude: ['node_modules', 'dist', 'tests']
        }, null, 2)
      });
    }

    // Generate Jest configuration
    additionalFiles.push({
      path: 'jest.config.js',
      content: `module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
};
`
    });

    // Generate ESLint configuration
    additionalFiles.push({
      path: '.eslintrc.js',
      content: `module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
  },
  extends: [
    'eslint:recommended',
    '@typescript-eslint/recommended',
  ],
  rules: {
    // Add your custom rules here
  },
};
`
    });

    // Generate GitHub workflow
    additionalFiles.push({
      path: '.github/workflows/ci.yml',
      content: `name: CI

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest

    strategy:
      matrix:
        node-version: [16.x, 18.x, 20.x]

    steps:
    - uses: actions/checkout@v3
    
    - name: Use Node.js \${{ matrix.node-version }}
      uses: actions/setup-node@v3
      with:
        node-version: \${{ matrix.node-version }}
        cache: 'npm'
    
    - run: npm ci
    - run: npm run build
    - run: npm test
    - run: npm run lint
`
    });

    return additionalFiles;
  }
}