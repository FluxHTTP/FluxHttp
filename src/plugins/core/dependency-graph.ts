/**
 * @fileoverview Plugin dependency graph implementation
 * @module @fluxhttp/plugins/core/dependency-graph
 */

/**
 * Plugin dependency graph for managing load order and circular dependency detection
 */
export class PluginDependencyGraph {
  private readonly graph = new Map<string, Set<string>>();
  private readonly inDegree = new Map<string, number>();
  private readonly dependents = new Map<string, Set<string>>();

  /**
   * Add plugin to dependency graph
   */
  addPlugin(id: string, dependencies: string[] = []): void {
    // Initialize plugin if not exists
    if (!this.graph.has(id)) {
      this.graph.set(id, new Set());
      this.inDegree.set(id, 0);
      this.dependents.set(id, new Set());
    }

    // Process dependencies
    for (const depId of dependencies) {
      // Initialize dependency if not exists
      if (!this.graph.has(depId)) {
        this.graph.set(depId, new Set());
        this.inDegree.set(depId, 0);
        this.dependents.set(depId, new Set());
      }

      // Add dependency relationship
      this.graph.get(depId)!.add(id);
      this.dependents.get(id)!.add(depId);
      
      // Increase in-degree for dependent plugin
      this.inDegree.set(id, (this.inDegree.get(id) || 0) + 1);
    }
  }

  /**
   * Remove plugin from dependency graph
   */
  removePlugin(id: string): void {
    if (!this.graph.has(id)) {
      return;
    }

    // Get plugins that depend on this plugin
    const dependentPlugins = this.graph.get(id) || new Set();
    
    // Remove this plugin as a dependency from all dependent plugins
    for (const dependentId of dependentPlugins) {
      const currentInDegree = this.inDegree.get(dependentId) || 0;
      this.inDegree.set(dependentId, Math.max(0, currentInDegree - 1));
      
      // Remove from dependents list
      this.dependents.get(dependentId)?.delete(id);
    }

    // Get plugins that this plugin depends on
    const dependencies = this.dependents.get(id) || new Set();
    
    // Remove this plugin from their dependent lists
    for (const depId of dependencies) {
      this.graph.get(depId)?.delete(id);
    }

    // Remove plugin from all maps
    this.graph.delete(id);
    this.inDegree.delete(id);
    this.dependents.delete(id);
  }

  /**
   * Get topological sort order for plugin loading
   */
  getLoadOrder(): string[] {
    if (this.graph.size === 0) {
      return [];
    }

    const result: string[] = [];
    const queue: string[] = [];
    const inDegreeMap = new Map(this.inDegree);

    // Find all plugins with no dependencies (in-degree 0)
    for (const [pluginId, degree] of inDegreeMap) {
      if (degree === 0) {
        queue.push(pluginId);
      }
    }

    // Process plugins in topological order
    while (queue.length > 0) {
      // Sort queue by plugin ID for deterministic ordering
      queue.sort();
      const current = queue.shift()!;
      result.push(current);

      // Process all plugins that depend on current plugin
      const dependentPlugins = this.graph.get(current) || new Set();
      for (const dependentId of dependentPlugins) {
        const currentDegree = inDegreeMap.get(dependentId) || 0;
        const newDegree = currentDegree - 1;
        inDegreeMap.set(dependentId, newDegree);

        // If all dependencies are resolved, add to queue
        if (newDegree === 0) {
          queue.push(dependentId);
        }
      }
    }

    // Check for circular dependencies
    if (result.length !== this.graph.size) {
      const remaining = Array.from(this.graph.keys()).filter(id => !result.includes(id));
      throw new Error(`Circular dependency detected in plugins: ${remaining.join(', ')}`);
    }

    return result;
  }

  /**
   * Check if plugin has circular dependencies
   */
  hasCircularDependency(id: string): boolean {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    return this.detectCycleRecursive(id, visited, recursionStack);
  }

  /**
   * Get direct dependencies of a plugin
   */
  getDependencies(id: string): string[] {
    return Array.from(this.dependents.get(id) || new Set());
  }

  /**
   * Get direct dependents of a plugin
   */
  getDependents(id: string): string[] {
    return Array.from(this.graph.get(id) || new Set());
  }

  /**
   * Get all transitive dependencies of a plugin
   */
  getAllDependencies(id: string): string[] {
    const visited = new Set<string>();
    const dependencies: string[] = [];

    this.collectDependenciesRecursive(id, visited, dependencies);
    
    return dependencies;
  }

  /**
   * Get all transitive dependents of a plugin
   */
  getAllDependents(id: string): string[] {
    const visited = new Set<string>();
    const dependents: string[] = [];

    this.collectDependentsRecursive(id, visited, dependents);
    
    return dependents;
  }

  /**
   * Check if one plugin depends on another (directly or transitively)
   */
  isDependentOn(pluginId: string, dependencyId: string): boolean {
    const allDependencies = this.getAllDependencies(pluginId);
    return allDependencies.includes(dependencyId);
  }

  /**
   * Get dependency path between two plugins
   */
  getDependencyPath(from: string, to: string): string[] | null {
    const visited = new Set<string>();
    const path: string[] = [];

    if (this.findPathRecursive(from, to, visited, path)) {
      return path;
    }

    return null;
  }

  /**
   * Get graph statistics
   */
  getStats(): {
    totalPlugins: number;
    totalDependencies: number;
    cyclicDependencies: boolean;
    rootPlugins: string[];
    leafPlugins: string[];
    loadOrder: string[];
  } {
    const totalPlugins = this.graph.size;
    let totalDependencies = 0;

    for (const dependencies of this.dependents.values()) {
      totalDependencies += dependencies.size;
    }

    // Find root plugins (no dependencies)
    const rootPlugins = Array.from(this.inDegree.entries())
      .filter(([, degree]) => degree === 0)
      .map(([id]) => id);

    // Find leaf plugins (no dependents)
    const leafPlugins = Array.from(this.graph.entries())
      .filter(([, dependents]) => dependents.size === 0)
      .map(([id]) => id);

    let cyclicDependencies = false;
    let loadOrder: string[] = [];

    try {
      loadOrder = this.getLoadOrder();
    } catch (error) {
      cyclicDependencies = true;
    }

    return {
      totalPlugins,
      totalDependencies,
      cyclicDependencies,
      rootPlugins,
      leafPlugins,
      loadOrder
    };
  }

  /**
   * Export graph in DOT format for visualization
   */
  toDotFormat(): string {
    const lines = ['digraph PluginDependencies {'];
    lines.push('  rankdir=TB;');
    lines.push('  node [shape=box];');

    // Add nodes
    for (const pluginId of this.graph.keys()) {
      lines.push(`  "${pluginId}";`);
    }

    // Add edges
    for (const [pluginId, dependents] of this.graph) {
      for (const dependentId of dependents) {
        lines.push(`  "${pluginId}" -> "${dependentId}";`);
      }
    }

    lines.push('}');
    return lines.join('\n');
  }

  /**
   * Clear all plugins from the graph
   */
  clear(): void {
    this.graph.clear();
    this.inDegree.clear();
    this.dependents.clear();
  }

  /**
   * Get size of the graph
   */
  get size(): number {
    return this.graph.size;
  }

  /**
   * Check if plugin exists in graph
   */
  hasPlugin(id: string): boolean {
    return this.graph.has(id);
  }

  // Private methods

  /**
   * Recursively detect cycles using DFS
   */
  private detectCycleRecursive(
    id: string,
    visited: Set<string>,
    recursionStack: Set<string>
  ): boolean {
    if (recursionStack.has(id)) {
      return true; // Cycle detected
    }

    if (visited.has(id)) {
      return false; // Already processed
    }

    visited.add(id);
    recursionStack.add(id);

    // Check all dependents
    const dependents = this.graph.get(id) || new Set();
    for (const dependentId of dependents) {
      if (this.detectCycleRecursive(dependentId, visited, recursionStack)) {
        return true;
      }
    }

    recursionStack.delete(id);
    return false;
  }

  /**
   * Recursively collect all dependencies
   */
  private collectDependenciesRecursive(
    id: string,
    visited: Set<string>,
    dependencies: string[]
  ): void {
    if (visited.has(id)) {
      return;
    }

    visited.add(id);

    const directDependencies = this.dependents.get(id) || new Set();
    for (const depId of directDependencies) {
      dependencies.push(depId);
      this.collectDependenciesRecursive(depId, visited, dependencies);
    }
  }

  /**
   * Recursively collect all dependents
   */
  private collectDependentsRecursive(
    id: string,
    visited: Set<string>,
    dependents: string[]
  ): void {
    if (visited.has(id)) {
      return;
    }

    visited.add(id);

    const directDependents = this.graph.get(id) || new Set();
    for (const depId of directDependents) {
      dependents.push(depId);
      this.collectDependentsRecursive(depId, visited, dependents);
    }
  }

  /**
   * Find path between two plugins using DFS
   */
  private findPathRecursive(
    current: string,
    target: string,
    visited: Set<string>,
    path: string[]
  ): boolean {
    if (current === target) {
      path.push(current);
      return true;
    }

    if (visited.has(current)) {
      return false;
    }

    visited.add(current);
    path.push(current);

    const dependents = this.graph.get(current) || new Set();
    for (const dependentId of dependents) {
      if (this.findPathRecursive(dependentId, target, visited, path)) {
        return true;
      }
    }

    path.pop();
    return false;
  }
}