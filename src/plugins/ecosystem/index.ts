/**
 * @fileoverview Plugin ecosystem - Discovery, marketplace, and versioning system
 * @module @fluxhttp/plugins/ecosystem
 */

// Discovery System
export {
  PluginDiscovery,
  NpmPluginSource,
  GitHubPluginSource,
  defaultDiscovery
} from './discovery';

// Marketplace System
export {
  PluginMarketplace,
  defaultMarketplace
} from './marketplace';

// Version Management
export {
  PluginVersionManager,
  defaultVersionManager,
  type SemanticVersion
} from './versioning';

// Re-export types
export type {
  PluginSource,
  PluginSearchQuery,
  PluginSearchResult,
  PluginDiscoveryOptions,
  PluginPackageInfo,
  PluginCollection,
  PluginMarketplaceEntry,
  PluginMarketplaceOptions,
  PluginInstallOptions,
  PluginPublishOptions,
  PluginRating,
  PluginReview,
  PluginVersionInfo,
  PluginCompatibilityResult,
  PluginUpdateResult,
  PluginVersionConstraint,
  PluginMigrationInfo
} from '../types';

/**
 * Plugin Ecosystem namespace containing all ecosystem functionality
 */
export namespace PluginEcosystem {
  /**
   * Discovery service for finding plugins
   */
  export const discovery = defaultDiscovery;

  /**
   * Marketplace for managing plugin collections and ratings
   */
  export const marketplace = defaultMarketplace;

  /**
   * Version manager for handling plugin versions and updates
   */
  export const versionManager = defaultVersionManager;

  /**
   * Search for plugins across all sources
   */
  export const search = discovery.search.bind(discovery);

  /**
   * Get plugin details
   */
  export const getPluginDetails = discovery.getPluginDetails.bind(discovery);

  /**
   * Install plugin from marketplace
   */
  export const installPlugin = marketplace.installPlugin.bind(marketplace);

  /**
   * Check for plugin updates
   */
  export const checkForUpdates = versionManager.checkForUpdates.bind(versionManager);

  /**
   * Get featured plugins
   */
  export const getFeatured = marketplace.getFeatured.bind(marketplace);

  /**
   * Get plugin collections
   */
  export const getCollections = marketplace.getCollections.bind(marketplace);

  /**
   * Get plugin recommendations
   */
  export const getRecommendations = discovery.getRecommendations.bind(discovery);

  /**
   * Get trending plugins
   */
  export const getTrending = discovery.getTrending.bind(discovery);

  /**
   * Check plugin compatibility
   */
  export const checkCompatibility = versionManager.checkCompatibility.bind(versionManager);

  /**
   * Resolve version constraint
   */
  export const resolveVersion = versionManager.resolveVersionConstraint.bind(versionManager);

  /**
   * Compare semantic versions
   */
  export const compareVersions = versionManager.compareVersions.bind(versionManager);

  /**
   * Ecosystem statistics
   */
  export async function getStats() {
    const marketplaceStats = marketplace.getStats();
    const cacheStats = {
      discovery: discovery.getCacheStats(),
      versions: versionManager.getCacheStats()
    };

    return {
      marketplace: marketplaceStats,
      cache: cacheStats,
      sources: discovery['sources'].size, // Access private property for stats
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Clear all caches
   */
  export function clearCaches() {
    discovery.clearCache();
    versionManager.clearCache();
  }

  /**
   * Initialize ecosystem with default configuration
   */
  export function initialize() {
    // Register default plugin sources
    // NPM source is already registered by default
    
    // Feature default plugins
    marketplace.featurePlugin('fluxhttp-auth');
    marketplace.featurePlugin('fluxhttp-cache');
    marketplace.featurePlugin('fluxhttp-retry');
    marketplace.featurePlugin('fluxhttp-logging');
    
    // Verify official plugins
    marketplace.verifyPlugin('fluxhttp-auth');
    marketplace.verifyPlugin('fluxhttp-cache');
    marketplace.verifyPlugin('fluxhttp-retry');
    marketplace.verifyPlugin('fluxhttp-logging');
    marketplace.verifyPlugin('fluxhttp-metrics');
    marketplace.verifyPlugin('fluxhttp-mock');
    marketplace.verifyPlugin('fluxhttp-debug');
  }
}

/**
 * Quick access functions for common operations
 */

/**
 * Search for plugins
 */
export async function searchPlugins(query: string, options?: any) {
  return PluginEcosystem.search({ text: query }, options);
}

/**
 * Get plugin information
 */
export async function getPlugin(pluginId: string) {
  return PluginEcosystem.getPluginDetails(pluginId);
}

/**
 * Install a plugin
 */
export async function installPlugin(pluginId: string, version?: string) {
  return PluginEcosystem.installPlugin(pluginId, { version });
}

/**
 * Check for updates
 */
export async function checkUpdates(pluginId: string, currentVersion: string) {
  return PluginEcosystem.checkForUpdates(pluginId, currentVersion);
}

/**
 * Get featured plugins
 */
export async function getFeaturedPlugins() {
  return PluginEcosystem.getFeatured();
}

/**
 * Get plugin collections
 */
export function getPluginCollections() {
  return PluginEcosystem.getCollections();
}

/**
 * Get recommendations
 */
export async function getRecommendations(currentPlugins?: string[]) {
  return PluginEcosystem.getRecommendations(currentPlugins);
}

/**
 * Initialize the ecosystem
 */
export function initializeEcosystem() {
  PluginEcosystem.initialize();
}

/**
 * Default export - Plugin Ecosystem namespace
 */
export default PluginEcosystem;