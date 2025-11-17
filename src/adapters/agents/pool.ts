import * as http from 'http';
import * as https from 'https';
import type { AgentOptions } from 'http';

/**
 * Connection pool configuration
 * @interface PoolConfig
 */
export interface PoolConfig {
  /** Maximum number of sockets per host */
  maxSockets?: number;
  /** Maximum number of free sockets per host */
  maxFreeSockets?: number;
  /** Socket timeout in milliseconds */
  timeout?: number;
  /** Keep alive timeout in milliseconds */
  keepAliveTimeout?: number;
  /** Whether to keep sockets alive */
  keepAlive?: boolean;
  /** Initial delay for keep alive */
  keepAliveMsecs?: number;
  /** Maximum number of total sockets */
  maxTotalSockets?: number;
  /** Socket scheduling strategy */
  scheduling?: 'lifo' | 'fifo';
}

/**
 * Pool statistics
 * @interface PoolStats
 */
export interface PoolStats {
  /** Number of active sockets */
  activeSockets: number;
  /** Number of free sockets */
  freeSockets: number;
  /** Number of pending requests */
  pendingRequests: number;
  /** Total number of sockets created */
  totalSocketsCreated: number;
  /** Total number of requests handled */
  totalRequests: number;
  /** Number of socket timeouts */
  socketTimeouts: number;
  /** Number of socket errors */
  socketErrors: number;
}

/**
 * Host statistics
 * @interface HostStats
 */
interface HostStats {
  activeSockets: number;
  freeSockets: number;
  pendingRequests: number;
  totalSockets: number;
  requests: number;
  timeouts: number;
  errors: number;
}

/**
 * Custom HTTP agent with connection pooling and monitoring
 * @class PooledHttpAgent
 * @extends {http.Agent}
 */
export class PooledHttpAgent extends http.Agent {
  private config: Required<PoolConfig>;
  private stats: Map<string, HostStats> = new Map();
  private globalStats: PoolStats;
  private destroyed = false;
  private maxHostStats = 100; // Maximum number of hosts to track
  private cleanupTimer: NodeJS.Timeout | null = null;
  // lastCleanup removed - BUG-008 fixed: unused variable

  /**
   * Create a new pooled HTTP agent
   * @param {PoolConfig} [config] - Pool configuration
   */
  constructor(config: PoolConfig = {}) {
    const poolConfig: Required<PoolConfig> = {
      maxSockets: config.maxSockets ?? 256,
      maxFreeSockets: config.maxFreeSockets ?? 256,
      timeout: config.timeout ?? 120000,
      keepAliveTimeout: config.keepAliveTimeout ?? 30000,
      keepAlive: config.keepAlive ?? true,
      keepAliveMsecs: config.keepAliveMsecs ?? 1000,
      maxTotalSockets: config.maxTotalSockets ?? Infinity,
      scheduling: config.scheduling ?? 'lifo',
    };

    const agentOptions: AgentOptions = {
      maxSockets: poolConfig.maxSockets,
      maxFreeSockets: poolConfig.maxFreeSockets,
      timeout: poolConfig.timeout,
      keepAlive: poolConfig.keepAlive,
      keepAliveMsecs: poolConfig.keepAliveMsecs,
      scheduling: poolConfig.scheduling,
    };

    super(agentOptions);

    this.config = poolConfig;
    this.globalStats = {
      activeSockets: 0,
      freeSockets: 0,
      pendingRequests: 0,
      totalSocketsCreated: 0,
      totalRequests: 0,
      socketTimeouts: 0,
      socketErrors: 0,
    };

    this.setupEventListeners();
    this.startStatsCleanupTimer();
  }

  /**
   * Setup event listeners for monitoring
   * @private
   */
  private setupEventListeners(): void {
    this.on('connect', (_socket, options) => {
      const host = this.getHostKey(options);
      this.updateHostStats(host, (stats) => {
        stats.totalSockets++;
        stats.activeSockets++;
      });
      this.globalStats.totalSocketsCreated++;
      this.globalStats.activeSockets++;
    });

    this.on('free', (_socket, options) => {
      const host = this.getHostKey(options);
      this.updateHostStats(host, (stats) => {
        stats.activeSockets--;
        stats.freeSockets++;
      });
      this.globalStats.activeSockets--;
      this.globalStats.freeSockets++;
    });

    this.on('remove', (_socket, options) => {
      const host = this.getHostKey(options);
      this.updateHostStats(host, (stats) => {
        if (stats.activeSockets > 0) stats.activeSockets--;
        if (stats.freeSockets > 0) stats.freeSockets--;
      });
      if (this.globalStats.activeSockets > 0) this.globalStats.activeSockets--;
      if (this.globalStats.freeSockets > 0) this.globalStats.freeSockets--;
    });
  }

  /**
   * Get host key for tracking
   * @private
   * @param {any} options - Connection options
   * @returns {string} Host key
   */
  private getHostKey(options: any): string {
    const host = options.host || options.hostname || 'localhost';
    const port = options.port || (options.protocol === 'https:' ? 443 : 80);
    return `${host}:${port}`;
  }

  /**
   * Update host statistics
   * @private
   * @param {string} host - Host key
   * @param {Function} updater - Function to update stats
   */
  private updateHostStats(host: string, updater: (stats: HostStats) => void): void {
    if (this.destroyed) {
      return;
    }
    
    // Check if we need to clean up before adding new host
    if (!this.stats.has(host) && this.stats.size >= this.maxHostStats) {
      this.performStatsCleanup();
    }
    
    if (!this.stats.has(host)) {
      this.stats.set(host, {
        activeSockets: 0,
        freeSockets: 0,
        pendingRequests: 0,
        totalSockets: 0,
        requests: 0,
        timeouts: 0,
        errors: 0,
      });
    }
    const stats = this.stats.get(host)!;
    updater(stats);
  }

  /**
   * Create connection with monitoring
   * @param {any} options - Connection options
   * @param {Function} callback - Callback function
   * @returns {any} Socket
   */
  createConnection(options: any, callback?: any): any {
    const host = this.getHostKey(options);
    
    this.updateHostStats(host, (stats) => {
      stats.requests++;
      stats.pendingRequests++;
    });
    this.globalStats.totalRequests++;
    this.globalStats.pendingRequests++;

    // Use parent class createConnection method with type assertion
    const socket = (http.Agent.prototype as any).createConnection.call(this, options, callback);

    // Monitor socket events
    socket.on('connect', () => {
      this.updateHostStats(host, (stats) => {
        stats.pendingRequests--;
      });
      this.globalStats.pendingRequests--;
    });

    socket.on('error', (_err: any) => {
      this.updateHostStats(host, (stats) => {
        stats.errors++;
        if (stats.pendingRequests > 0) stats.pendingRequests--;
      });
      this.globalStats.socketErrors++;
      if (this.globalStats.pendingRequests > 0) this.globalStats.pendingRequests--;
    });

    // Add timeout handling
    if (this.config.timeout > 0) {
      socket.setTimeout(this.config.timeout, () => {
        this.updateHostStats(host, (stats) => {
          stats.timeouts++;
        });
        this.globalStats.socketTimeouts++;
        socket.destroy();
      });
    }

    return socket;
  }

  /**
   * Get statistics for a specific host
   * @param {string} host - Host key (host:port)
   * @returns {HostStats | undefined} Host statistics
   */
  getHostStats(host: string): HostStats | undefined {
    return this.stats.get(host);
  }

  /**
   * Get global pool statistics
   * @returns {PoolStats} Global statistics
   */
  getStats(): PoolStats {
    return { ...this.globalStats };
  }

  /**
   * Get statistics for all hosts
   * @returns {Map<string, HostStats>} Map of host statistics
   */
  getAllHostStats(): Map<string, HostStats> {
    return new Map(this.stats);
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats.clear();
    this.globalStats = {
      activeSockets: 0,
      freeSockets: 0,
      pendingRequests: 0,
      totalSocketsCreated: 0,
      totalRequests: 0,
      socketTimeouts: 0,
      socketErrors: 0,
    };
  }

  /**
   * Update pool configuration
   * @param {PoolConfig} newConfig - New configuration
   */
  updateConfig(newConfig: PoolConfig): void {
    if (newConfig.maxSockets !== undefined) {
      this.maxSockets = newConfig.maxSockets;
      this.config.maxSockets = newConfig.maxSockets;
    }
    if (newConfig.maxFreeSockets !== undefined) {
      this.maxFreeSockets = newConfig.maxFreeSockets;
      this.config.maxFreeSockets = newConfig.maxFreeSockets;
    }
    if (newConfig.timeout !== undefined) {
      this.config.timeout = newConfig.timeout;
    }
    if (newConfig.keepAlive !== undefined) {
      (this as any).keepAlive = newConfig.keepAlive;
      this.config.keepAlive = newConfig.keepAlive;
    }
    if (newConfig.keepAliveMsecs !== undefined) {
      (this as any).keepAliveMsecs = newConfig.keepAliveMsecs;
      this.config.keepAliveMsecs = newConfig.keepAliveMsecs;
    }
  }

  /**
   * Get current configuration
   * @returns {PoolConfig} Current configuration
   */
  getConfig(): PoolConfig {
    return { ...this.config };
  }

  /**
   * Start the statistics cleanup timer
   * @private
   */
  private startStatsCleanupTimer(): void {
    if (this.cleanupTimer || this.destroyed) {
      return;
    }
    
    // Clean up stats every 5 minutes
    this.cleanupTimer = setInterval(() => {
      this.performStatsCleanup();
    }, 5 * 60 * 1000);
  }

  /**
   * Stop the statistics cleanup timer
   * @private
   */
  private stopStatsCleanupTimer(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  /**
   * Perform statistics cleanup for inactive hosts
   * @private
   */
  private performStatsCleanup(): void {
    if (this.destroyed) {
      return;
    }
    
    const hostsToRemove: string[] = [];
    
    this.stats.forEach((stats, host) => {
      // Remove hosts with no active connections and no recent activity
      if (stats.activeSockets === 0 && 
          stats.freeSockets === 0 && 
          stats.pendingRequests === 0) {
        hostsToRemove.push(host);
      }
    });
    
    // If we still have too many hosts, remove the ones with least activity
    if (this.stats.size - hostsToRemove.length > this.maxHostStats) {
      const sortedHosts = Array.from(this.stats.entries())
        .filter(([host]) => !hostsToRemove.includes(host))
        .sort(([, a], [, b]) => {
          // Sort by total activity (requests + sockets)
          const activityA = a.requests + a.totalSockets;
          const activityB = b.requests + b.totalSockets;
          return activityA - activityB;
        });
      
      const excessCount = this.stats.size - hostsToRemove.length - this.maxHostStats;
      for (let i = 0; i < excessCount && i < sortedHosts.length; i++) {
        hostsToRemove.push(sortedHosts[i][0]);
      }
    }

    hostsToRemove.forEach(host => this.stats.delete(host));
  }

  /**
   * Set maximum number of host statistics to track
   * @param {number} max - Maximum number of hosts
   */
  setMaxHostStats(max: number): void {
    if (max > 0) {
      this.maxHostStats = max;
      if (this.stats.size > max) {
        this.performStatsCleanup();
      }
    }
  }

  /**
   * Get current number of tracked hosts
   * @returns {number} Number of hosts being tracked
   */
  getTrackedHostsCount(): number {
    return this.stats.size;
  }

  /**
   * Destroy the agent and close all connections
   */
  destroy(): void {
    if (this.destroyed) return;
    
    this.destroyed = true;
    this.stopStatsCleanupTimer();
    super.destroy();
    this.stats.clear();
  }

  /**
   * Check if agent is healthy
   * @returns {boolean} True if agent is healthy
   */
  isHealthy(): boolean {
    return !this.destroyed && this.globalStats.socketErrors < this.globalStats.totalRequests * 0.1;
  }
}

/**
 * Custom HTTPS agent with connection pooling
 * @class PooledHttpsAgent
 * @extends {https.Agent}
 */
export class PooledHttpsAgent extends https.Agent {
  private httpAgent: PooledHttpAgent;
  private destroyed = false;

  /**
   * Create a new pooled HTTPS agent
   * @param {PoolConfig} [config] - Pool configuration
   */
  constructor(config: PoolConfig = {}) {
    const agentOptions: AgentOptions = {
      maxSockets: config.maxSockets ?? 256,
      maxFreeSockets: config.maxFreeSockets ?? 256,
      timeout: config.timeout ?? 120000,
      keepAlive: config.keepAlive ?? true,
      keepAliveMsecs: config.keepAliveMsecs ?? 1000,
      scheduling: config.scheduling ?? 'lifo',
    };

    super(agentOptions);
    
    // Use composition to reuse HTTP agent logic
    this.httpAgent = new PooledHttpAgent(config);
  }

  /**
   * Get statistics for a specific host
   * @param {string} host - Host key (host:port)
   * @returns {HostStats | undefined} Host statistics
   */
  getHostStats(host: string): HostStats | undefined {
    return this.httpAgent.getHostStats(host);
  }

  /**
   * Get global pool statistics
   * @returns {PoolStats} Global statistics
   */
  getStats(): PoolStats {
    return this.httpAgent.getStats();
  }

  /**
   * Get statistics for all hosts
   * @returns {Map<string, HostStats>} Map of host statistics
   */
  getAllHostStats(): Map<string, HostStats> {
    return this.httpAgent.getAllHostStats();
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.httpAgent.resetStats();
  }

  /**
   * Update pool configuration
   * @param {PoolConfig} newConfig - New configuration
   */
  updateConfig(newConfig: PoolConfig): void {
    this.httpAgent.updateConfig(newConfig);
    
    if (newConfig.maxSockets !== undefined) {
      this.maxSockets = newConfig.maxSockets;
    }
    if (newConfig.maxFreeSockets !== undefined) {
      this.maxFreeSockets = newConfig.maxFreeSockets;
    }
    if (newConfig.keepAlive !== undefined) {
      (this as any).keepAlive = newConfig.keepAlive;
    }
    if (newConfig.keepAliveMsecs !== undefined) {
      (this as any).keepAliveMsecs = newConfig.keepAliveMsecs;
    }
  }

  /**
   * Get current configuration
   * @returns {PoolConfig} Current configuration
   */
  getConfig(): PoolConfig {
    return this.httpAgent.getConfig();
  }

  /**
   * Set maximum number of host statistics to track
   * @param {number} max - Maximum number of hosts
   */
  setMaxHostStats(max: number): void {
    this.httpAgent.setMaxHostStats(max);
  }

  /**
   * Get current number of tracked hosts
   * @returns {number} Number of hosts being tracked
   */
  getTrackedHostsCount(): number {
    return this.httpAgent.getTrackedHostsCount();
  }

  /**
   * Destroy the agent and close all connections
   */
  destroy(): void {
    if (this.destroyed) return;
    
    this.destroyed = true;
    super.destroy();
    this.httpAgent.destroy();
  }

  /**
   * Check if agent is healthy
   * @returns {boolean} True if agent is healthy
   */
  isHealthy(): boolean {
    return this.httpAgent.isHealthy();
  }
}

/**
 * Connection pool manager
 * @class ConnectionPoolManager
 */
export class ConnectionPoolManager {
  private httpAgent: PooledHttpAgent;
  private httpsAgent: PooledHttpsAgent;
  private destroyed = false;

  /**
   * Create a new connection pool manager
   * @param {PoolConfig} [config] - Pool configuration
   */
  constructor(config: PoolConfig = {}) {
    this.httpAgent = new PooledHttpAgent(config);
    this.httpsAgent = new PooledHttpsAgent(config);
  }

  /**
   * Get HTTP agent
   * @returns {PooledHttpAgent} HTTP agent
   */
  getHttpAgent(): PooledHttpAgent {
    return this.httpAgent;
  }

  /**
   * Get HTTPS agent
   * @returns {PooledHttpsAgent} HTTPS agent
   */
  getHttpsAgent(): PooledHttpsAgent {
    return this.httpsAgent;
  }

  /**
   * Get agent for protocol
   * @param {string} protocol - Protocol (http: or https:)
   * @returns {PooledHttpAgent | PooledHttpsAgent} Appropriate agent
   */
  getAgent(protocol: string): PooledHttpAgent | PooledHttpsAgent {
    return protocol === 'https:' ? this.httpsAgent : this.httpAgent;
  }

  /**
   * Get combined statistics
   * @returns {PoolStats} Combined statistics
   */
  getStats(): PoolStats {
    const httpStats = this.httpAgent.getStats();
    const httpsStats = this.httpsAgent.getStats();

    return {
      activeSockets: httpStats.activeSockets + httpsStats.activeSockets,
      freeSockets: httpStats.freeSockets + httpsStats.freeSockets,
      pendingRequests: httpStats.pendingRequests + httpsStats.pendingRequests,
      totalSocketsCreated: httpStats.totalSocketsCreated + httpsStats.totalSocketsCreated,
      totalRequests: httpStats.totalRequests + httpsStats.totalRequests,
      socketTimeouts: httpStats.socketTimeouts + httpsStats.socketTimeouts,
      socketErrors: httpStats.socketErrors + httpsStats.socketErrors,
    };
  }

  /**
   * Update configuration for both agents
   * @param {PoolConfig} config - New configuration
   */
  updateConfig(config: PoolConfig): void {
    this.httpAgent.updateConfig(config);
    this.httpsAgent.updateConfig(config);
  }

  /**
   * Reset statistics for both agents
   */
  resetStats(): void {
    this.httpAgent.resetStats();
    this.httpsAgent.resetStats();
  }

  /**
   * Set maximum number of host statistics to track for both agents
   * @param {number} max - Maximum number of hosts
   */
  setMaxHostStats(max: number): void {
    this.httpAgent.setMaxHostStats(max);
    this.httpsAgent.setMaxHostStats(max);
  }

  /**
   * Get total number of tracked hosts across both agents
   * @returns {number} Total number of hosts being tracked
   */
  getTotalTrackedHostsCount(): number {
    return this.httpAgent.getTrackedHostsCount() + this.httpsAgent.getTrackedHostsCount();
  }

  /**
   * Destroy both agents
   */
  destroy(): void {
    if (this.destroyed) return;
    
    this.destroyed = true;
    this.httpAgent.destroy();
    this.httpsAgent.destroy();
  }

  /**
   * Check if the pool manager has been destroyed
   * @returns {boolean} True if destroyed
   */
  isDestroyed(): boolean {
    return this.destroyed;
  }

  /**
   * Check if both agents are healthy
   * @returns {boolean} True if both agents are healthy
   */
  isHealthy(): boolean {
    return this.httpAgent.isHealthy() && this.httpsAgent.isHealthy();
  }
}

/**
 * Default connection pool manager instance
 */
export const defaultPoolManager = new ConnectionPoolManager();

// Clean up default pool manager on process exit
if (typeof process !== 'undefined' && process.on) {
  process.on('exit', () => {
    defaultPoolManager.destroy();
  });
  
  process.on('SIGTERM', () => {
    defaultPoolManager.destroy();
    process.exit(0);
  });
  
  process.on('SIGINT', () => {
    defaultPoolManager.destroy();
    process.exit(0);
  });
}

/**
 * Create a new connection pool manager
 * @param {PoolConfig} [config] - Pool configuration
 * @returns {ConnectionPoolManager} New pool manager
 */
export function createPoolManager(config?: PoolConfig): ConnectionPoolManager {
  return new ConnectionPoolManager(config);
}