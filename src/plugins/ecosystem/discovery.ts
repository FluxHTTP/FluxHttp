/**
 * @fileoverview Plugin discovery system for finding and managing plugins
 * @module @fluxhttp/plugins/ecosystem/discovery
 */

import type {
  Plugin,
  PluginMetadata,
  PluginSearchQuery,
  PluginSearchResult,
  PluginDiscoveryOptions,
  PluginSource,
  PluginPackageInfo
} from '../types';

/**
 * Plugin discovery service for finding plugins
 */
export class PluginDiscovery {
  private sources: Map<string, PluginSource> = new Map();
  private cache: Map<string, PluginSearchResult[]> = new Map();
  private cacheExpiry: Map<string, number> = new Map();

  /**
   * Register a plugin source
   */
  registerSource(source: PluginSource): void {
    this.sources.set(source.id, source);
  }

  /**
   * Unregister a plugin source
   */
  unregisterSource(sourceId: string): void {
    this.sources.delete(sourceId);
    // Clear cache entries for this source
    for (const [key, results] of this.cache.entries()) {
      const filtered = results.filter(result => result.source !== sourceId);
      if (filtered.length !== results.length) {
        this.cache.set(key, filtered);
      }
    }
  }

  /**
   * Search for plugins across all registered sources
   */
  async search(query: PluginSearchQuery, options: PluginDiscoveryOptions = {}): Promise<PluginSearchResult[]> {
    const {
      useCache = true,
      cacheTtl = 300000, // 5 minutes
      sources = Array.from(this.sources.keys()),
      maxResults = 50,
      includePrerelease = false
    } = options;

    const cacheKey = this.generateCacheKey(query, sources);

    // Check cache first
    if (useCache && this.isCacheValid(cacheKey, cacheTtl)) {
      const cached = this.cache.get(cacheKey);
      if (cached) {
        return this.filterResults(cached, query, maxResults, includePrerelease);
      }
    }

    // Search across all specified sources
    const searchPromises = sources
      .map(sourceId => this.sources.get(sourceId))
      .filter(Boolean)
      .map(source => this.searchSource(source!, query, options));

    const results = await Promise.allSettled(searchPromises);
    const allResults: PluginSearchResult[] = [];

    for (const result of results) {
      if (result.status === 'fulfilled') {
        allResults.push(...result.value);
      } else {
        console.warn('Plugin search failed for source:', result.reason);
      }
    }

    // Cache results
    if (useCache) {
      this.cache.set(cacheKey, allResults);
      this.cacheExpiry.set(cacheKey, Date.now() + cacheTtl);
    }

    return this.filterResults(allResults, query, maxResults, includePrerelease);
  }

  /**
   * Get plugin details from a specific source
   */
  async getPluginDetails(pluginId: string, sourceId?: string): Promise<PluginPackageInfo | null> {
    const sourcesToSearch = sourceId 
      ? [this.sources.get(sourceId)].filter(Boolean)
      : Array.from(this.sources.values());

    for (const source of sourcesToSearch) {
      try {
        const details = await source.getPluginDetails(pluginId);
        if (details) {
          return details;
        }
      } catch (error) {
        console.warn(`Failed to get plugin details from ${source.id}:`, error);
      }
    }

    return null;
  }

  /**
   * Get available plugin versions
   */
  async getVersions(pluginId: string, sourceId?: string): Promise<string[]> {
    const details = await this.getPluginDetails(pluginId, sourceId);
    return details?.versions || [];
  }

  /**
   * Check if plugin is available
   */
  async isAvailable(pluginId: string, version?: string): Promise<boolean> {
    try {
      const details = await this.getPluginDetails(pluginId);
      if (!details) return false;

      if (version) {
        return details.versions.includes(version);
      }

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get plugin recommendations based on usage patterns
   */
  async getRecommendations(currentPlugins: string[] = [], limit = 10): Promise<PluginSearchResult[]> {
    const recommendations: PluginSearchResult[] = [];

    // Get popular plugins
    const popularQuery: PluginSearchQuery = {
      sortBy: 'downloads',
      sortOrder: 'desc'
    };

    const popular = await this.search(popularQuery, { maxResults: limit * 2 });
    
    // Filter out already installed plugins
    const filtered = popular.filter(plugin => 
      !currentPlugins.includes(plugin.metadata.id)
    );

    recommendations.push(...filtered.slice(0, limit));

    return recommendations;
  }

  /**
   * Get trending plugins
   */
  async getTrending(timeframe: 'day' | 'week' | 'month' = 'week', limit = 10): Promise<PluginSearchResult[]> {
    const query: PluginSearchQuery = {
      sortBy: 'trending',
      sortOrder: 'desc',
      filters: {
        timeframe
      }
    };

    return this.search(query, { maxResults: limit });
  }

  /**
   * Get plugin categories
   */
  async getCategories(): Promise<string[]> {
    const categories = new Set<string>();

    for (const source of this.sources.values()) {
      try {
        const sourceCategories = await source.getCategories();
        sourceCategories.forEach(cat => categories.add(cat));
      } catch (error) {
        console.warn(`Failed to get categories from ${source.id}:`, error);
      }
    }

    return Array.from(categories).sort();
  }

  /**
   * Get plugins by category
   */
  async getByCategory(category: string, limit = 20): Promise<PluginSearchResult[]> {
    const query: PluginSearchQuery = {
      filters: {
        category
      }
    };

    return this.search(query, { maxResults: limit });
  }

  /**
   * Search a specific source
   */
  private async searchSource(
    source: PluginSource,
    query: PluginSearchQuery,
    options: PluginDiscoveryOptions
  ): Promise<PluginSearchResult[]> {
    try {
      return await source.search(query, options);
    } catch (error) {
      console.warn(`Search failed for source ${source.id}:`, error);
      return [];
    }
  }

  /**
   * Filter and sort search results
   */
  private filterResults(
    results: PluginSearchResult[],
    query: PluginSearchQuery,
    maxResults: number,
    includePrerelease: boolean
  ): PluginSearchResult[] {
    let filtered = [...results];

    // Filter out prereleases if not included
    if (!includePrerelease) {
      filtered = filtered.filter(result => 
        !result.metadata.version.includes('-')
      );
    }

    // Apply text search if specified
    if (query.text) {
      const searchText = query.text.toLowerCase();
      filtered = filtered.filter(result => 
        result.metadata.name.toLowerCase().includes(searchText) ||
        result.metadata.description.toLowerCase().includes(searchText) ||
        result.metadata.keywords.some(keyword => 
          keyword.toLowerCase().includes(searchText)
        )
      );
    }

    // Apply filters
    if (query.filters) {
      if (query.filters.type) {
        filtered = filtered.filter(result => 
          result.metadata.type === query.filters!.type
        );
      }

      if (query.filters.author) {
        filtered = filtered.filter(result => 
          result.metadata.author.name.toLowerCase().includes(
            query.filters!.author!.toLowerCase()
          )
        );
      }

      if (query.filters.license) {
        filtered = filtered.filter(result => 
          result.metadata.license === query.filters!.license
        );
      }

      if (query.filters.minDownloads) {
        filtered = filtered.filter(result => 
          (result.stats?.downloads || 0) >= query.filters!.minDownloads!
        );
      }

      if (query.filters.maxAge) {
        const maxDate = new Date(Date.now() - query.filters.maxAge);
        filtered = filtered.filter(result => 
          new Date(result.publishedAt) >= maxDate
        );
      }
    }

    // Sort results
    if (query.sortBy) {
      filtered.sort((a, b) => {
        let comparison = 0;
        
        switch (query.sortBy) {
          case 'name':
            comparison = a.metadata.name.localeCompare(b.metadata.name);
            break;
          case 'downloads':
            comparison = (a.stats?.downloads || 0) - (b.stats?.downloads || 0);
            break;
          case 'rating':
            comparison = (a.stats?.rating || 0) - (b.stats?.rating || 0);
            break;
          case 'updated':
            comparison = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
            break;
          case 'published':
            comparison = new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime();
            break;
          case 'trending':
            comparison = (a.stats?.trendingScore || 0) - (b.stats?.trendingScore || 0);
            break;
          default:
            comparison = 0;
        }

        return query.sortOrder === 'desc' ? -comparison : comparison;
      });
    }

    // Limit results
    return filtered.slice(0, maxResults);
  }

  /**
   * Generate cache key for search query
   */
  private generateCacheKey(query: PluginSearchQuery, sources: string[]): string {
    const key = {
      ...query,
      sources: sources.sort()
    };
    return JSON.stringify(key);
  }

  /**
   * Check if cache entry is valid
   */
  private isCacheValid(key: string, ttl: number): boolean {
    const expiry = this.cacheExpiry.get(key);
    return expiry ? Date.now() < expiry : false;
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
    this.cacheExpiry.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { entries: number; size: number } {
    const entries = this.cache.size;
    const size = JSON.stringify(Array.from(this.cache.entries())).length;
    return { entries, size };
  }
}

/**
 * NPM Plugin Source for discovering plugins from npm registry
 */
export class NpmPluginSource implements PluginSource {
  readonly id = 'npm';
  readonly name = 'NPM Registry';
  readonly url = 'https://registry.npmjs.org';

  async search(query: PluginSearchQuery, options: PluginDiscoveryOptions = {}): Promise<PluginSearchResult[]> {
    const searchText = query.text || 'fluxhttp-plugin';
    const apiUrl = `${this.url}/-/v1/search?text=${encodeURIComponent(searchText)}&size=${options.maxResults || 20}`;

    try {
      const response = await fetch(apiUrl);
      const data = await response.json();

      return data.objects.map((pkg: any) => ({
        metadata: {
          id: pkg.package.name,
          name: pkg.package.name,
          version: pkg.package.version,
          description: pkg.package.description || '',
          author: {
            name: pkg.package.author?.name || 'Unknown'
          },
          license: pkg.package.license || 'Unknown',
          keywords: pkg.package.keywords || [],
          type: this.inferPluginType(pkg.package.keywords || []),
          capabilities: {},
          priority: 0
        },
        source: this.id,
        packageName: pkg.package.name,
        version: pkg.package.version,
        publishedAt: pkg.package.date,
        updatedAt: pkg.package.date,
        stats: {
          downloads: pkg.searchScore || 0,
          rating: 0,
          trendingScore: pkg.searchScore || 0
        }
      }));
    } catch (error) {
      console.error('Failed to search NPM registry:', error);
      return [];
    }
  }

  async getPluginDetails(pluginId: string): Promise<PluginPackageInfo | null> {
    try {
      const response = await fetch(`${this.url}/${pluginId}`);
      const data = await response.json();

      return {
        id: data.name,
        name: data.name,
        description: data.description || '',
        versions: Object.keys(data.versions || {}),
        latestVersion: data['dist-tags']?.latest || '',
        author: data.author?.name || 'Unknown',
        license: data.license || 'Unknown',
        homepage: data.homepage || '',
        repository: data.repository?.url || '',
        keywords: data.keywords || [],
        dependencies: data.dependencies || {},
        peerDependencies: data.peerDependencies || {},
        source: this.id,
        packageName: data.name,
        publishedAt: data.time?.created || new Date().toISOString(),
        updatedAt: data.time?.modified || new Date().toISOString()
      };
    } catch (error) {
      console.error(`Failed to get plugin details for ${pluginId}:`, error);
      return null;
    }
  }

  async getCategories(): Promise<string[]> {
    // NPM doesn't have predefined categories, return common plugin types
    return [
      'authentication',
      'caching',
      'logging',
      'metrics',
      'retry',
      'validation',
      'testing',
      'development',
      'security',
      'performance'
    ];
  }

  private inferPluginType(keywords: string[]): string {
    const typeMap: Record<string, string> = {
      auth: 'auth',
      authentication: 'auth',
      cache: 'cache',
      caching: 'cache',
      retry: 'retry',
      log: 'logging',
      logging: 'logging',
      metrics: 'metrics',
      analytics: 'metrics',
      mock: 'developer',
      test: 'developer',
      debug: 'developer'
    };

    for (const keyword of keywords) {
      const type = typeMap[keyword.toLowerCase()];
      if (type) return type;
    }

    return 'feature';
  }
}

/**
 * GitHub Plugin Source for discovering plugins from GitHub
 */
export class GitHubPluginSource implements PluginSource {
  readonly id = 'github';
  readonly name = 'GitHub';
  readonly url = 'https://api.github.com';

  constructor(private token?: string) {}

  async search(query: PluginSearchQuery, options: PluginDiscoveryOptions = {}): Promise<PluginSearchResult[]> {
    const searchQuery = `fluxhttp plugin ${query.text || ''}`.trim();
    const apiUrl = `${this.url}/search/repositories?q=${encodeURIComponent(searchQuery)}&sort=${query.sortBy || 'stars'}&per_page=${options.maxResults || 20}`;

    const headers: Record<string, string> = {
      'Accept': 'application/vnd.github.v3+json'
    };

    if (this.token) {
      headers['Authorization'] = `token ${this.token}`;
    }

    try {
      const response = await fetch(apiUrl, { headers });
      const data = await response.json();

      return data.items.map((repo: any) => ({
        metadata: {
          id: repo.full_name,
          name: repo.name,
          version: '1.0.0', // Default version for GitHub repos
          description: repo.description || '',
          author: {
            name: repo.owner.login
          },
          license: repo.license?.spdx_id || 'Unknown',
          keywords: repo.topics || [],
          type: 'feature',
          capabilities: {},
          priority: 0
        },
        source: this.id,
        packageName: repo.full_name,
        version: '1.0.0',
        publishedAt: repo.created_at,
        updatedAt: repo.updated_at,
        stats: {
          downloads: repo.stargazers_count,
          rating: repo.stargazers_count / 100,
          trendingScore: repo.stargazers_count + repo.forks_count
        }
      }));
    } catch (error) {
      console.error('Failed to search GitHub:', error);
      return [];
    }
  }

  async getPluginDetails(pluginId: string): Promise<PluginPackageInfo | null> {
    const headers: Record<string, string> = {
      'Accept': 'application/vnd.github.v3+json'
    };

    if (this.token) {
      headers['Authorization'] = `token ${this.token}`;
    }

    try {
      const response = await fetch(`${this.url}/repos/${pluginId}`, { headers });
      const data = await response.json();

      // Get releases for version information
      const releasesResponse = await fetch(`${this.url}/repos/${pluginId}/releases`, { headers });
      const releases = await releasesResponse.json();

      return {
        id: data.full_name,
        name: data.name,
        description: data.description || '',
        versions: releases.map((release: any) => release.tag_name),
        latestVersion: releases[0]?.tag_name || '1.0.0',
        author: data.owner.login,
        license: data.license?.spdx_id || 'Unknown',
        homepage: data.homepage || data.html_url,
        repository: data.html_url,
        keywords: data.topics || [],
        dependencies: {},
        peerDependencies: {},
        source: this.id,
        packageName: data.full_name,
        publishedAt: data.created_at,
        updatedAt: data.updated_at
      };
    } catch (error) {
      console.error(`Failed to get GitHub plugin details for ${pluginId}:`, error);
      return null;
    }
  }

  async getCategories(): Promise<string[]> {
    return [
      'fluxhttp-plugin',
      'http-client',
      'middleware',
      'interceptor',
      'authentication',
      'caching',
      'logging',
      'testing',
      'development'
    ];
  }
}

/**
 * Default plugin discovery instance
 */
export const defaultDiscovery = new PluginDiscovery();

// Register default sources
defaultDiscovery.registerSource(new NpmPluginSource());
// Note: GitHub source requires token for higher rate limits
// defaultDiscovery.registerSource(new GitHubPluginSource());