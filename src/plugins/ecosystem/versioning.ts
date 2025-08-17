/**
 * @fileoverview Plugin version management system for handling plugin versions, compatibility, and updates
 * @module @fluxhttp/plugins/ecosystem/versioning
 */

import type {
  Plugin,
  PluginMetadata,
  PluginVersionInfo,
  PluginCompatibilityResult,
  PluginUpdateResult,
  PluginVersionConstraint,
  PluginMigrationInfo
} from '../types';

/**
 * Semantic version information
 */
export interface SemanticVersion {
  major: number;
  minor: number;
  patch: number;
  prerelease?: string;
  build?: string;
  raw: string;
}

/**
 * Plugin version manager for handling version operations
 */
export class PluginVersionManager {
  private versionCache: Map<string, PluginVersionInfo[]> = new Map();
  private compatibilityCache: Map<string, PluginCompatibilityResult> = new Map();
  private migrationHandlers: Map<string, (from: string, to: string) => Promise<PluginMigrationInfo>> = new Map();

  /**
   * Parse semantic version string
   */
  parseVersion(version: string): SemanticVersion {
    const semverRegex = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/;
    const match = version.match(semverRegex);

    if (!match) {
      throw new Error(`Invalid semantic version: ${version}`);
    }

    return {
      major: parseInt(match[1], 10),
      minor: parseInt(match[2], 10),
      patch: parseInt(match[3], 10),
      prerelease: match[4],
      build: match[5],
      raw: version
    };
  }

  /**
   * Compare two semantic versions
   * Returns: -1 if a < b, 0 if a === b, 1 if a > b
   */
  compareVersions(a: string | SemanticVersion, b: string | SemanticVersion): number {
    const versionA = typeof a === 'string' ? this.parseVersion(a) : a;
    const versionB = typeof b === 'string' ? this.parseVersion(b) : b;

    // Compare major version
    if (versionA.major !== versionB.major) {
      return versionA.major > versionB.major ? 1 : -1;
    }

    // Compare minor version
    if (versionA.minor !== versionB.minor) {
      return versionA.minor > versionB.minor ? 1 : -1;
    }

    // Compare patch version
    if (versionA.patch !== versionB.patch) {
      return versionA.patch > versionB.patch ? 1 : -1;
    }

    // Compare prerelease
    if (versionA.prerelease && !versionB.prerelease) return -1;
    if (!versionA.prerelease && versionB.prerelease) return 1;
    if (versionA.prerelease && versionB.prerelease) {
      return versionA.prerelease.localeCompare(versionB.prerelease);
    }

    return 0;
  }

  /**
   * Check if version satisfies constraint
   */
  satisfiesConstraint(version: string, constraint: string): boolean {
    try {
      // Handle exact version
      if (!constraint.match(/[<>=~^]/)) {
        return this.compareVersions(version, constraint) === 0;
      }

      const parsedVersion = this.parseVersion(version);

      // Handle caret range (^1.2.3 allows >=1.2.3 <2.0.0)
      if (constraint.startsWith('^')) {
        const constraintVersion = this.parseVersion(constraint.slice(1));
        return this.compareVersions(version, constraintVersion.raw) >= 0 &&
               parsedVersion.major === constraintVersion.major;
      }

      // Handle tilde range (~1.2.3 allows >=1.2.3 <1.3.0)
      if (constraint.startsWith('~')) {
        const constraintVersion = this.parseVersion(constraint.slice(1));
        return this.compareVersions(version, constraintVersion.raw) >= 0 &&
               parsedVersion.major === constraintVersion.major &&
               parsedVersion.minor === constraintVersion.minor;
      }

      // Handle exact range operators
      if (constraint.startsWith('>=')) {
        return this.compareVersions(version, constraint.slice(2)) >= 0;
      }
      if (constraint.startsWith('>')) {
        return this.compareVersions(version, constraint.slice(1)) > 0;
      }
      if (constraint.startsWith('<=')) {
        return this.compareVersions(version, constraint.slice(2)) <= 0;
      }
      if (constraint.startsWith('<')) {
        return this.compareVersions(version, constraint.slice(1)) < 0;
      }
      if (constraint.startsWith('=')) {
        return this.compareVersions(version, constraint.slice(1)) === 0;
      }

      return false;
    } catch {
      return false;
    }
  }

  /**
   * Get next version based on type
   */
  getNextVersion(currentVersion: string, type: 'major' | 'minor' | 'patch' | 'prerelease'): string {
    const version = this.parseVersion(currentVersion);

    switch (type) {
      case 'major':
        return `${version.major + 1}.0.0`;
      case 'minor':
        return `${version.major}.${version.minor + 1}.0`;
      case 'patch':
        return `${version.major}.${version.minor}.${version.patch + 1}`;
      case 'prerelease':
        if (version.prerelease) {
          const prereleaseNumber = parseInt(version.prerelease.split('.').pop() || '0', 10);
          const prereleaseBase = version.prerelease.replace(/\.\d+$/, '');
          return `${version.major}.${version.minor}.${version.patch}-${prereleaseBase}.${prereleaseNumber + 1}`;
        } else {
          return `${version.major}.${version.minor}.${version.patch + 1}-pre.0`;
        }
      default:
        throw new Error(`Invalid version type: ${type}`);
    }
  }

  /**
   * Check plugin compatibility with FluxHTTP version
   */
  async checkCompatibility(
    pluginId: string,
    pluginVersion: string,
    fluxhttpVersion: string = '1.0.0'
  ): Promise<PluginCompatibilityResult> {
    const cacheKey = `${pluginId}@${pluginVersion}:${fluxhttpVersion}`;
    
    // Check cache first
    if (this.compatibilityCache.has(cacheKey)) {
      return this.compatibilityCache.get(cacheKey)!;
    }

    const result: PluginCompatibilityResult = {
      compatible: true,
      issues: [],
      warnings: [],
      recommendations: []
    };

    try {
      // TODO: In a real implementation, this would fetch plugin metadata
      // and check compatibility constraints
      
      // For now, assume compatibility based on version patterns
      const pluginSemver = this.parseVersion(pluginVersion);
      const fluxhttpSemver = this.parseVersion(fluxhttpVersion);

      // Check for major version compatibility
      if (pluginSemver.major > fluxhttpSemver.major) {
        result.compatible = false;
        result.issues.push(
          `Plugin major version ${pluginSemver.major} is higher than FluxHTTP major version ${fluxhttpSemver.major}`
        );
      }

      // Warn about prerelease versions
      if (pluginSemver.prerelease) {
        result.warnings.push(
          'Plugin is a prerelease version and may be unstable'
        );
      }

      // Recommend updates for very old plugins
      if (pluginSemver.major < fluxhttpSemver.major - 1) {
        result.recommendations.push(
          'Consider updating to a newer plugin version for better compatibility'
        );
      }

    } catch (error) {
      result.compatible = false;
      result.issues.push(`Version parsing error: ${error}`);
    }

    // Cache result
    this.compatibilityCache.set(cacheKey, result);

    return result;
  }

  /**
   * Get available versions for a plugin
   */
  async getAvailableVersions(pluginId: string): Promise<PluginVersionInfo[]> {
    // Check cache first
    if (this.versionCache.has(pluginId)) {
      return this.versionCache.get(pluginId)!;
    }

    // TODO: In a real implementation, this would query the plugin registry
    // For now, return mock data
    const versions: PluginVersionInfo[] = [
      {
        version: '1.0.0',
        releaseDate: '2024-01-01',
        changelog: 'Initial release',
        isStable: true,
        isPrerelease: false,
        isDeprecated: false,
        downloadCount: 1000,
        dependencies: {},
        peerDependencies: {
          '@fluxhttp/core': '^1.0.0'
        }
      },
      {
        version: '1.1.0',
        releaseDate: '2024-02-01',
        changelog: 'Added new features and bug fixes',
        isStable: true,
        isPrerelease: false,
        isDeprecated: false,
        downloadCount: 800,
        dependencies: {},
        peerDependencies: {
          '@fluxhttp/core': '^1.0.0'
        }
      },
      {
        version: '2.0.0-beta.1',
        releaseDate: '2024-03-01',
        changelog: 'Major rewrite with breaking changes',
        isStable: false,
        isPrerelease: true,
        isDeprecated: false,
        downloadCount: 100,
        dependencies: {},
        peerDependencies: {
          '@fluxhttp/core': '^2.0.0'
        }
      }
    ];

    // Cache result
    this.versionCache.set(pluginId, versions);

    return versions;
  }

  /**
   * Get latest stable version
   */
  async getLatestStableVersion(pluginId: string): Promise<string | null> {
    const versions = await this.getAvailableVersions(pluginId);
    const stableVersions = versions
      .filter(v => v.isStable && !v.isDeprecated)
      .sort((a, b) => this.compareVersions(b.version, a.version));

    return stableVersions.length > 0 ? stableVersions[0].version : null;
  }

  /**
   * Get latest version (including prereleases)
   */
  async getLatestVersion(pluginId: string, includePrerelease = false): Promise<string | null> {
    const versions = await this.getAvailableVersions(pluginId);
    const filteredVersions = versions
      .filter(v => !v.isDeprecated && (includePrerelease || !v.isPrerelease))
      .sort((a, b) => this.compareVersions(b.version, a.version));

    return filteredVersions.length > 0 ? filteredVersions[0].version : null;
  }

  /**
   * Check for plugin updates
   */
  async checkForUpdates(
    pluginId: string,
    currentVersion: string,
    options: {
      includePrerelease?: boolean;
      includeBreaking?: boolean;
    } = {}
  ): Promise<PluginUpdateResult> {
    const { includePrerelease = false, includeBreaking = false } = options;
    
    const availableVersions = await this.getAvailableVersions(pluginId);
    const currentSemver = this.parseVersion(currentVersion);
    
    const updates = availableVersions
      .filter(v => {
        // Skip deprecated versions
        if (v.isDeprecated) return false;
        
        // Skip prereleases if not included
        if (v.isPrerelease && !includePrerelease) return false;
        
        // Check if version is newer
        if (this.compareVersions(v.version, currentVersion) <= 0) return false;
        
        // Check for breaking changes
        if (!includeBreaking) {
          const versionSemver = this.parseVersion(v.version);
          if (versionSemver.major > currentSemver.major) return false;
        }
        
        return true;
      })
      .sort((a, b) => this.compareVersions(b.version, a.version));

    return {
      hasUpdates: updates.length > 0,
      currentVersion,
      latestVersion: updates[0]?.version || currentVersion,
      availableUpdates: updates,
      updateType: this.determineUpdateType(currentVersion, updates[0]?.version || currentVersion),
      migrationRequired: await this.isMigrationRequired(pluginId, currentVersion, updates[0]?.version || currentVersion)
    };
  }

  /**
   * Determine update type
   */
  private determineUpdateType(current: string, latest: string): 'major' | 'minor' | 'patch' | 'none' {
    if (this.compareVersions(current, latest) === 0) return 'none';
    
    const currentSemver = this.parseVersion(current);
    const latestSemver = this.parseVersion(latest);
    
    if (latestSemver.major > currentSemver.major) return 'major';
    if (latestSemver.minor > currentSemver.minor) return 'minor';
    return 'patch';
  }

  /**
   * Check if migration is required between versions
   */
  private async isMigrationRequired(pluginId: string, from: string, to: string): Promise<boolean> {
    // Major version changes typically require migration
    const fromSemver = this.parseVersion(from);
    const toSemver = this.parseVersion(to);
    
    return toSemver.major > fromSemver.major;
  }

  /**
   * Get migration information between versions
   */
  async getMigrationInfo(pluginId: string, from: string, to: string): Promise<PluginMigrationInfo | null> {
    const migrationHandler = this.migrationHandlers.get(pluginId);
    if (migrationHandler) {
      return await migrationHandler(from, to);
    }

    // Default migration info for major version changes
    const fromSemver = this.parseVersion(from);
    const toSemver = this.parseVersion(to);

    if (toSemver.major > fromSemver.major) {
      return {
        required: true,
        breaking: true,
        steps: [
          'Review breaking changes in changelog',
          'Update plugin configuration if needed',
          'Test plugin functionality after update'
        ],
        configChanges: [],
        apiChanges: [],
        documentation: `https://docs.fluxhttp.com/plugins/${pluginId}/migration/${fromSemver.major}-to-${toSemver.major}`
      };
    }

    return null;
  }

  /**
   * Register migration handler for a plugin
   */
  registerMigrationHandler(
    pluginId: string,
    handler: (from: string, to: string) => Promise<PluginMigrationInfo>
  ): void {
    this.migrationHandlers.set(pluginId, handler);
  }

  /**
   * Resolve version constraint to specific version
   */
  async resolveVersionConstraint(pluginId: string, constraint: string): Promise<string | null> {
    const availableVersions = await this.getAvailableVersions(pluginId);
    
    // Find all versions that satisfy the constraint
    const satisfyingVersions = availableVersions
      .filter(v => this.satisfiesConstraint(v.version, constraint) && !v.isDeprecated)
      .sort((a, b) => this.compareVersions(b.version, a.version));

    return satisfyingVersions.length > 0 ? satisfyingVersions[0].version : null;
  }

  /**
   * Check version constraints for dependencies
   */
  async checkDependencyConstraints(
    dependencies: Record<string, string>,
    peerDependencies: Record<string, string> = {}
  ): Promise<{ valid: boolean; issues: string[] }> {
    const issues: string[] = [];

    // Check regular dependencies
    for (const [pluginId, constraint] of Object.entries(dependencies)) {
      const resolvedVersion = await this.resolveVersionConstraint(pluginId, constraint);
      if (!resolvedVersion) {
        issues.push(`Cannot resolve dependency ${pluginId}@${constraint}`);
      }
    }

    // Check peer dependencies
    for (const [pluginId, constraint] of Object.entries(peerDependencies)) {
      const resolvedVersion = await this.resolveVersionConstraint(pluginId, constraint);
      if (!resolvedVersion) {
        issues.push(`Cannot resolve peer dependency ${pluginId}@${constraint}`);
      }
    }

    return {
      valid: issues.length === 0,
      issues
    };
  }

  /**
   * Clear version cache
   */
  clearCache(): void {
    this.versionCache.clear();
    this.compatibilityCache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { versions: number; compatibility: number } {
    return {
      versions: this.versionCache.size,
      compatibility: this.compatibilityCache.size
    };
  }
}

/**
 * Default version manager instance
 */
export const defaultVersionManager = new PluginVersionManager();