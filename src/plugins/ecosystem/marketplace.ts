/**
 * @fileoverview Plugin marketplace for managing plugin collections and curated sets
 * @module @fluxhttp/plugins/ecosystem/marketplace
 */

import type {
  Plugin,
  PluginMetadata,
  PluginCollection,
  PluginMarketplaceEntry,
  PluginMarketplaceOptions,
  PluginInstallOptions,
  PluginPublishOptions,
  PluginRating,
  PluginReview
} from '../types';

import { PluginDiscovery } from './discovery';
import { PluginVersionManager } from './versioning';

/**
 * Plugin marketplace for discovering, installing, and managing plugins
 */
export class PluginMarketplace {
  private discovery: PluginDiscovery;
  private versionManager: PluginVersionManager;
  private collections: Map<string, PluginCollection> = new Map();
  private ratings: Map<string, PluginRating[]> = new Map();
  private reviews: Map<string, PluginReview[]> = new Map();
  private featured: string[] = [];
  private verified: Set<string> = new Set();

  constructor(
    discovery?: PluginDiscovery,
    versionManager?: PluginVersionManager
  ) {
    this.discovery = discovery || new PluginDiscovery();
    this.versionManager = versionManager || new PluginVersionManager();
    this.initializeDefaultCollections();
  }

  /**
   * Get featured plugins
   */
  async getFeatured(): Promise<PluginMarketplaceEntry[]> {
    const entries: PluginMarketplaceEntry[] = [];

    for (const pluginId of this.featured) {
      try {
        const entry = await this.getPluginEntry(pluginId);
        if (entry) {
          entries.push(entry);
        }
      } catch (error) {
        console.warn(`Failed to get featured plugin ${pluginId}:`, error);
      }
    }

    return entries;
  }

  /**
   * Get plugin collections
   */
  getCollections(): PluginCollection[] {
    return Array.from(this.collections.values());
  }

  /**
   * Get specific collection
   */
  getCollection(id: string): PluginCollection | undefined {
    return this.collections.get(id);
  }

  /**
   * Create a new collection
   */
  createCollection(collection: Omit<PluginCollection, 'id' | 'createdAt' | 'updatedAt'>): PluginCollection {
    const newCollection: PluginCollection = {
      ...collection,
      id: this.generateId(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.collections.set(newCollection.id, newCollection);
    return newCollection;
  }

  /**
   * Update existing collection
   */
  updateCollection(id: string, updates: Partial<PluginCollection>): PluginCollection | null {
    const collection = this.collections.get(id);
    if (!collection) return null;

    const updated = {
      ...collection,
      ...updates,
      id: collection.id, // Preserve ID
      createdAt: collection.createdAt, // Preserve creation date
      updatedAt: new Date().toISOString()
    };

    this.collections.set(id, updated);
    return updated;
  }

  /**
   * Delete collection
   */
  deleteCollection(id: string): boolean {
    return this.collections.delete(id);
  }

  /**
   * Get plugin marketplace entry
   */
  async getPluginEntry(pluginId: string): Promise<PluginMarketplaceEntry | null> {
    try {
      const details = await this.discovery.getPluginDetails(pluginId);
      if (!details) return null;

      const ratings = this.ratings.get(pluginId) || [];
      const reviews = this.reviews.get(pluginId) || [];
      const averageRating = ratings.length > 0 
        ? ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length 
        : 0;

      return {
        plugin: details,
        isVerified: this.verified.has(pluginId),
        isFeatured: this.featured.includes(pluginId),
        rating: {
          average: averageRating,
          count: ratings.length,
          distribution: this.calculateRatingDistribution(ratings)
        },
        reviews: reviews.slice(0, 5), // Latest 5 reviews
        downloadStats: {
          total: details.stats?.downloads || 0,
          weekly: Math.floor((details.stats?.downloads || 0) * 0.1),
          monthly: Math.floor((details.stats?.downloads || 0) * 0.3)
        },
        collections: this.getPluginCollections(pluginId),
        compatibilityInfo: await this.versionManager.checkCompatibility(pluginId, details.latestVersion),
        securityInfo: {
          hasVulnerabilities: false,
          lastSecurityAudit: new Date().toISOString(),
          trustScore: this.calculateTrustScore(pluginId, details)
        }
      };
    } catch (error) {
      console.error(`Failed to get marketplace entry for ${pluginId}:`, error);
      return null;
    }
  }

  /**
   * Install plugin from marketplace
   */
  async installPlugin(
    pluginId: string,
    options: PluginInstallOptions = {}
  ): Promise<{ success: boolean; plugin?: Plugin; error?: string }> {
    try {
      const {
        version = 'latest',
        source,
        skipDependencies = false,
        force = false
      } = options;

      // Check if plugin is verified
      if (!this.verified.has(pluginId) && !force) {
        return {
          success: false,
          error: 'Plugin is not verified. Use force: true to install anyway.'
        };
      }

      // Get plugin details
      const details = await this.discovery.getPluginDetails(pluginId, source);
      if (!details) {
        return {
          success: false,
          error: `Plugin ${pluginId} not found`
        };
      }

      // Resolve version
      const targetVersion = version === 'latest' ? details.latestVersion : version;
      if (!details.versions.includes(targetVersion)) {
        return {
          success: false,
          error: `Version ${targetVersion} not available`
        };
      }

      // Check compatibility
      const compatibility = await this.versionManager.checkCompatibility(pluginId, targetVersion);
      if (!compatibility.compatible && !force) {
        return {
          success: false,
          error: `Plugin version ${targetVersion} is not compatible: ${compatibility.issues.join(', ')}`
        };
      }

      // Install dependencies first (if not skipped)
      if (!skipDependencies && details.dependencies) {
        for (const [depId, depVersion] of Object.entries(details.dependencies)) {
          const depResult = await this.installPlugin(depId, {
            version: depVersion,
            skipDependencies: true // Avoid circular dependencies
          });

          if (!depResult.success) {
            return {
              success: false,
              error: `Failed to install dependency ${depId}: ${depResult.error}`
            };
          }
        }
      }

      // TODO: Actual plugin installation logic would go here
      // This would involve downloading the plugin, loading it, and registering it
      
      return {
        success: true,
        plugin: undefined // Would return the actual plugin instance
      };

    } catch (error) {
      return {
        success: false,
        error: `Installation failed: ${error}`
      };
    }
  }

  /**
   * Publish plugin to marketplace
   */
  async publishPlugin(
    plugin: Plugin,
    options: PluginPublishOptions = {}
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const {
        source = 'npm',
        makePublic = true,
        requestVerification = false
      } = options;

      // Validate plugin
      if (!plugin.metadata.id || !plugin.metadata.version) {
        return {
          success: false,
          error: 'Plugin must have ID and version'
        };
      }

      // Check if plugin already exists
      const existing = await this.discovery.getPluginDetails(plugin.metadata.id, source);
      if (existing && existing.versions.includes(plugin.metadata.version)) {
        return {
          success: false,
          error: `Plugin ${plugin.metadata.id}@${plugin.metadata.version} already exists`
        };
      }

      // TODO: Actual publishing logic would go here
      // This would involve packaging the plugin and uploading to the specified source

      // If requesting verification, add to verification queue
      if (requestVerification) {
        // TODO: Add to verification queue
      }

      return { success: true };

    } catch (error) {
      return {
        success: false,
        error: `Publishing failed: ${error}`
      };
    }
  }

  /**
   * Rate a plugin
   */
  addRating(pluginId: string, rating: Omit<PluginRating, 'id' | 'createdAt'>): PluginRating {
    const newRating: PluginRating = {
      ...rating,
      id: this.generateId(),
      createdAt: new Date().toISOString()
    };

    const ratings = this.ratings.get(pluginId) || [];
    ratings.push(newRating);
    this.ratings.set(pluginId, ratings);

    return newRating;
  }

  /**
   * Add a review
   */
  addReview(pluginId: string, review: Omit<PluginReview, 'id' | 'createdAt'>): PluginReview {
    const newReview: PluginReview = {
      ...review,
      id: this.generateId(),
      createdAt: new Date().toISOString()
    };

    const reviews = this.reviews.get(pluginId) || [];
    reviews.push(newReview);
    this.reviews.set(pluginId, reviews);

    return newReview;
  }

  /**
   * Get plugin reviews
   */
  getReviews(pluginId: string, limit = 20, offset = 0): PluginReview[] {
    const reviews = this.reviews.get(pluginId) || [];
    return reviews
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(offset, offset + limit);
  }

  /**
   * Get plugin ratings
   */
  getRatings(pluginId: string): PluginRating[] {
    return this.ratings.get(pluginId) || [];
  }

  /**
   * Mark plugin as verified
   */
  verifyPlugin(pluginId: string): void {
    this.verified.add(pluginId);
  }

  /**
   * Remove verification from plugin
   */
  unverifyPlugin(pluginId: string): void {
    this.verified.delete(pluginId);
  }

  /**
   * Add plugin to featured list
   */
  featurePlugin(pluginId: string): void {
    if (!this.featured.includes(pluginId)) {
      this.featured.push(pluginId);
    }
  }

  /**
   * Remove plugin from featured list
   */
  unfeaturePlugin(pluginId: string): void {
    const index = this.featured.indexOf(pluginId);
    if (index > -1) {
      this.featured.splice(index, 1);
    }
  }

  /**
   * Get marketplace statistics
   */
  getStats(): {
    totalPlugins: number;
    verifiedPlugins: number;
    featuredPlugins: number;
    totalCollections: number;
    totalRatings: number;
    totalReviews: number;
  } {
    const totalRatings = Array.from(this.ratings.values())
      .reduce((sum, ratings) => sum + ratings.length, 0);
    
    const totalReviews = Array.from(this.reviews.values())
      .reduce((sum, reviews) => sum + reviews.length, 0);

    return {
      totalPlugins: 0, // Would need to query discovery service
      verifiedPlugins: this.verified.size,
      featuredPlugins: this.featured.length,
      totalCollections: this.collections.size,
      totalRatings,
      totalReviews
    };
  }

  /**
   * Initialize default collections
   */
  private initializeDefaultCollections(): void {
    // Essential plugins collection
    this.createCollection({
      name: 'Essential Plugins',
      description: 'Must-have plugins for every FluxHTTP project',
      author: 'FluxHTTP Team',
      plugins: [
        'fluxhttp-auth',
        'fluxhttp-cache',
        'fluxhttp-retry',
        'fluxhttp-logging'
      ],
      tags: ['essential', 'recommended', 'core'],
      isOfficial: true,
      isPublic: true
    });

    // Development tools collection
    this.createCollection({
      name: 'Development Tools',
      description: 'Plugins to enhance development experience',
      author: 'FluxHTTP Team',
      plugins: [
        'fluxhttp-mock',
        'fluxhttp-debug',
        'fluxhttp-metrics'
      ],
      tags: ['development', 'debugging', 'testing'],
      isOfficial: true,
      isPublic: true
    });

    // Security plugins collection
    this.createCollection({
      name: 'Security & Authentication',
      description: 'Security-focused plugins for protecting your applications',
      author: 'FluxHTTP Team',
      plugins: [
        'fluxhttp-auth',
        'fluxhttp-oauth',
        'fluxhttp-jwt',
        'fluxhttp-csrf'
      ],
      tags: ['security', 'authentication', 'protection'],
      isOfficial: true,
      isPublic: true
    });

    // Performance plugins collection
    this.createCollection({
      name: 'Performance Optimization',
      description: 'Plugins to improve performance and efficiency',
      author: 'FluxHTTP Team',
      plugins: [
        'fluxhttp-cache',
        'fluxhttp-compression',
        'fluxhttp-retry',
        'fluxhttp-timeout'
      ],
      tags: ['performance', 'optimization', 'speed'],
      isOfficial: true,
      isPublic: true
    });
  }

  /**
   * Calculate rating distribution
   */
  private calculateRatingDistribution(ratings: PluginRating[]): Record<number, number> {
    const distribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    
    for (const rating of ratings) {
      const stars = Math.round(rating.rating);
      if (stars >= 1 && stars <= 5) {
        distribution[stars]++;
      }
    }

    return distribution;
  }

  /**
   * Get collections containing a plugin
   */
  private getPluginCollections(pluginId: string): string[] {
    const collections: string[] = [];
    
    for (const [id, collection] of this.collections.entries()) {
      if (collection.plugins.includes(pluginId)) {
        collections.push(id);
      }
    }

    return collections;
  }

  /**
   * Calculate trust score for plugin
   */
  private calculateTrustScore(pluginId: string, details: any): number {
    let score = 0;

    // Base score for existence
    score += 10;

    // Verification bonus
    if (this.verified.has(pluginId)) {
      score += 30;
    }

    // Download count bonus (logarithmic scale)
    const downloads = details.stats?.downloads || 0;
    if (downloads > 0) {
      score += Math.min(20, Math.log10(downloads) * 5);
    }

    // Author reputation (simplified)
    if (details.author === 'FluxHTTP Team') {
      score += 25;
    }

    // Recent updates bonus
    const daysSinceUpdate = Math.floor(
      (Date.now() - new Date(details.updatedAt).getTime()) / (1000 * 60 * 60 * 24)
    );
    if (daysSinceUpdate < 30) {
      score += 10;
    } else if (daysSinceUpdate < 90) {
      score += 5;
    }

    // License bonus
    const trustedLicenses = ['MIT', 'Apache-2.0', 'BSD-3-Clause', 'ISC'];
    if (trustedLicenses.includes(details.license)) {
      score += 5;
    }

    return Math.min(100, Math.max(0, score));
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * Default marketplace instance
 */
export const defaultMarketplace = new PluginMarketplace();