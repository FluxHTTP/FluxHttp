/**
 * @fileoverview WebSocket integration for FluxHTTP
 * @module @fluxhttp/core/features/websocket
 */

import type { fluxhttpRequestConfig, Headers } from '../types';

/**
 * WebSocket connection states
 */
export enum WebSocketState {
  CONNECTING = 0,
  OPEN = 1,
  CLOSING = 2,
  CLOSED = 3
}

/**
 * WebSocket message types
 */
export interface WebSocketMessage {
  /** Message payload */
  data: string | ArrayBuffer | Blob;
  /** Message type */
  type: 'text' | 'binary';
  /** Timestamp when message was sent/received */
  timestamp: number;
  /** Message ID for tracking */
  id?: string;
}

/**
 * WebSocket configuration options
 */
export interface WebSocketConfig {
  /** WebSocket URL */
  url: string;
  /** Supported protocols */
  protocols?: string | string[];
  /** Connection headers */
  headers?: Headers;
  /** Connection timeout in milliseconds */
  timeout?: number;
  /** Automatic reconnection settings */
  reconnection?: {
    /** Whether to enable automatic reconnection */
    enabled: boolean;
    /** Maximum number of reconnection attempts */
    maxAttempts: number;
    /** Initial delay between reconnection attempts */
    delay: number;
    /** Maximum delay between reconnection attempts */
    maxDelay: number;
    /** Backoff strategy */
    backoff: 'exponential' | 'linear' | 'constant';
    /** Custom reconnection condition */
    shouldReconnect?: (event: CloseEvent) => boolean;
  };
  /** Message queuing settings */
  messageQueue?: {
    /** Whether to enable message queuing when disconnected */
    enabled: boolean;
    /** Maximum number of messages to queue */
    maxSize: number;
    /** Time to live for queued messages in milliseconds */
    ttl: number;
    /** Whether to persist queue across reconnections */
    persistent: boolean;
  };
  /** Heartbeat/ping settings */
  heartbeat?: {
    /** Whether to enable heartbeat */
    enabled: boolean;
    /** Heartbeat interval in milliseconds */
    interval: number;
    /** Heartbeat timeout in milliseconds */
    timeout: number;
    /** Heartbeat message payload */
    message: string | ArrayBuffer;
    /** Expected pong response */
    expectedResponse?: string | ArrayBuffer;
  };
  /** Binary message handling */
  binaryType?: 'blob' | 'arraybuffer';
}

/**
 * WebSocket event handlers
 */
export interface WebSocketEventHandlers {
  /** Called when connection opens */
  onOpen?: (event: Event) => void;
  /** Called when message is received */
  onMessage?: (message: WebSocketMessage) => void;
  /** Called when connection closes */
  onClose?: (event: CloseEvent) => void;
  /** Called on connection error */
  onError?: (event: Event) => void;
  /** Called during reconnection attempts */
  onReconnecting?: (attempt: number, delay: number) => void;
  /** Called when reconnection succeeds */
  onReconnected?: () => void;
  /** Called when reconnection fails permanently */
  onReconnectionFailed?: () => void;
  /** Called when a message is queued */
  onMessageQueued?: (message: WebSocketMessage) => void;
  /** Called when queued messages are sent */
  onQueueFlushed?: (count: number) => void;
}

/**
 * Queued message for offline handling
 */
interface QueuedMessage extends WebSocketMessage {
  /** When the message was queued */
  queuedAt: number;
  /** Number of send attempts */
  attempts: number;
}

/**
 * WebSocket client with advanced features
 */
export class FluxWebSocket {
  private ws: WebSocket | null = null;
  private config: Required<WebSocketConfig>;
  private handlers: WebSocketEventHandlers;
  private reconnectionAttempts = 0;
  private reconnectionTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private heartbeatTimeoutTimer: ReturnType<typeof setTimeout> | null = null;
  private messageQueue: QueuedMessage[] = [];
  private isIntentionallyClosed = false;
  private lastActivity = Date.now();

  constructor(config: WebSocketConfig, handlers: WebSocketEventHandlers = {}) {
    this.config = this.mergeDefaultConfig(config);
    this.handlers = handlers;
  }

  /**
   * Merge user config with defaults
   */
  private mergeDefaultConfig(config: WebSocketConfig): Required<WebSocketConfig> {
    return {
      url: config.url,
      protocols: config.protocols || [],
      headers: config.headers || {},
      timeout: config.timeout || 10000,
      reconnection: {
        enabled: true,
        maxAttempts: 5,
        delay: 1000,
        maxDelay: 30000,
        backoff: 'exponential',
        ...config.reconnection
      },
      messageQueue: {
        enabled: true,
        maxSize: 100,
        ttl: 300000, // 5 minutes
        persistent: false,
        ...config.messageQueue
      },
      heartbeat: {
        enabled: false,
        interval: 30000,
        timeout: 5000,
        message: 'ping',
        ...config.heartbeat
      },
      binaryType: config.binaryType || 'arraybuffer'
    };
  }

  /**
   * Connect to WebSocket server
   */
  async connect(): Promise<void> {
    if (this.ws && this.ws.readyState === WebSocketState.OPEN) {
      return; // Already connected
    }

    return new Promise((resolve, reject) => {
      try {
        this.isIntentionallyClosed = false;
        
        // Create WebSocket connection
        if (Array.isArray(this.config.protocols)) {
          this.ws = new WebSocket(this.config.url, this.config.protocols);
        } else if (this.config.protocols) {
          this.ws = new WebSocket(this.config.url, [this.config.protocols]);
        } else {
          this.ws = new WebSocket(this.config.url);
        }

        this.ws.binaryType = this.config.binaryType;

        // Set up event listeners
        this.setupEventListeners();

        // Connection timeout
        const timeout = setTimeout(() => {
          if (this.ws && this.ws.readyState === WebSocketState.CONNECTING) {
            this.ws.close();
            reject(new Error('WebSocket connection timeout'));
          }
        }, this.config.timeout);

        // Handle connection success
        this.ws.onopen = (event) => {
          clearTimeout(timeout);
          this.lastActivity = Date.now();
          this.reconnectionAttempts = 0;
          this.startHeartbeat();
          this.flushMessageQueue();
          this.handlers.onOpen?.(event);
          resolve();
        };

        // Handle connection failure
        this.ws.onerror = (event) => {
          clearTimeout(timeout);
          this.handlers.onError?.(event);
          reject(new Error('WebSocket connection failed'));
        };

      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Set up WebSocket event listeners
   */
  private setupEventListeners(): void {
    if (!this.ws) return;

    this.ws.onmessage = (event) => {
      this.lastActivity = Date.now();
      
      const message: WebSocketMessage = {
        data: event.data,
        type: typeof event.data === 'string' ? 'text' : 'binary',
        timestamp: Date.now(),
        id: this.generateMessageId()
      };

      // Handle heartbeat responses
      if (this.config.heartbeat.enabled && this.isHeartbeatResponse(event.data)) {
        this.handleHeartbeatResponse();
        return;
      }

      this.handlers.onMessage?.(message);
    };

    this.ws.onclose = (event) => {
      this.cleanup();
      this.handlers.onClose?.(event);

      // Handle reconnection
      if (!this.isIntentionallyClosed && this.config.reconnection.enabled) {
        this.handleReconnection(event);
      }
    };

    this.ws.onerror = (event) => {
      this.handlers.onError?.(event);
    };
  }

  /**
   * Send a message through the WebSocket
   */
  send(data: string | ArrayBuffer | Blob, options: { id?: string } = {}): void {
    const message: WebSocketMessage = {
      data,
      type: typeof data === 'string' ? 'text' : 'binary',
      timestamp: Date.now(),
      id: options.id || this.generateMessageId()
    };

    if (this.ws && this.ws.readyState === WebSocketState.OPEN) {
      this.ws.send(data);
    } else if (this.config.messageQueue.enabled) {
      this.queueMessage(message);
    } else {
      throw new Error('WebSocket is not connected and message queuing is disabled');
    }
  }

  /**
   * Queue a message for later sending
   */
  private queueMessage(message: WebSocketMessage): void {
    if (this.messageQueue.length >= this.config.messageQueue.maxSize) {
      // Remove oldest message
      this.messageQueue.shift();
    }

    const queuedMessage: QueuedMessage = {
      ...message,
      queuedAt: Date.now(),
      attempts: 0
    };

    this.messageQueue.push(queuedMessage);
    this.handlers.onMessageQueued?.(message);

    // Clean up expired messages
    this.cleanupExpiredMessages();
  }

  /**
   * Flush queued messages when connection is restored
   */
  private flushMessageQueue(): void {
    if (this.messageQueue.length === 0) return;

    const messagesToSend = [...this.messageQueue];
    this.messageQueue = [];

    for (const message of messagesToSend) {
      try {
        if (this.ws && this.ws.readyState === WebSocketState.OPEN) {
          this.ws.send(message.data);
        }
      } catch (error) {
        // Re-queue failed messages
        this.queueMessage(message);
      }
    }

    this.handlers.onQueueFlushed?.(messagesToSend.length);
  }

  /**
   * Clean up expired messages from queue
   */
  private cleanupExpiredMessages(): void {
    const now = Date.now();
    this.messageQueue = this.messageQueue.filter(
      message => (now - message.queuedAt) < this.config.messageQueue.ttl
    );
  }

  /**
   * Start heartbeat mechanism
   */
  private startHeartbeat(): void {
    if (!this.config.heartbeat.enabled) return;

    this.stopHeartbeat(); // Clean up any existing heartbeat

    this.heartbeatTimer = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocketState.OPEN) {
        this.ws.send(this.config.heartbeat.message);
        
        // Set timeout for heartbeat response
        this.heartbeatTimeoutTimer = setTimeout(() => {
          // No response received, consider connection dead
          this.ws?.close();
        }, this.config.heartbeat.timeout);
      }
    }, this.config.heartbeat.interval);
  }

  /**
   * Stop heartbeat mechanism
   */
  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    if (this.heartbeatTimeoutTimer) {
      clearTimeout(this.heartbeatTimeoutTimer);
      this.heartbeatTimeoutTimer = null;
    }
  }

  /**
   * Check if received message is a heartbeat response
   */
  private isHeartbeatResponse(data: string | ArrayBuffer): boolean {
    if (!this.config.heartbeat.expectedResponse) return false;
    
    if (typeof data === 'string' && typeof this.config.heartbeat.expectedResponse === 'string') {
      return data === this.config.heartbeat.expectedResponse;
    }
    
    // For binary data comparison, convert to string for simplicity
    return false;
  }

  /**
   * Handle heartbeat response
   */
  private handleHeartbeatResponse(): void {
    if (this.heartbeatTimeoutTimer) {
      clearTimeout(this.heartbeatTimeoutTimer);
      this.heartbeatTimeoutTimer = null;
    }
  }

  /**
   * Handle reconnection logic
   */
  private handleReconnection(event: CloseEvent): void {
    const shouldReconnect = this.config.reconnection.shouldReconnect
      ? this.config.reconnection.shouldReconnect(event)
      : true;

    if (!shouldReconnect || this.reconnectionAttempts >= this.config.reconnection.maxAttempts) {
      this.handlers.onReconnectionFailed?.();
      return;
    }

    const delay = this.calculateReconnectionDelay();
    this.reconnectionAttempts++;

    this.handlers.onReconnecting?.(this.reconnectionAttempts, delay);

    this.reconnectionTimer = setTimeout(async () => {
      try {
        await this.connect();
        this.handlers.onReconnected?.();
      } catch (error) {
        // Reconnection failed, will try again
        this.handleReconnection(event);
      }
    }, delay);
  }

  /**
   * Calculate reconnection delay based on strategy
   */
  private calculateReconnectionDelay(): number {
    const { delay, maxDelay, backoff } = this.config.reconnection;
    
    switch (backoff) {
      case 'exponential':
        return Math.min(delay * Math.pow(2, this.reconnectionAttempts - 1), maxDelay);
      case 'linear':
        return Math.min(delay * this.reconnectionAttempts, maxDelay);
      case 'constant':
      default:
        return delay;
    }
  }

  /**
   * Close the WebSocket connection
   */
  close(code?: number, reason?: string): void {
    this.isIntentionallyClosed = true;
    this.cleanup();
    
    if (this.ws) {
      this.ws.close(code, reason);
    }
  }

  /**
   * Cleanup resources
   */
  private cleanup(): void {
    this.stopHeartbeat();
    
    if (this.reconnectionTimer) {
      clearTimeout(this.reconnectionTimer);
      this.reconnectionTimer = null;
    }
  }

  /**
   * Generate unique message ID
   */
  private generateMessageId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get current connection state
   */
  getState(): WebSocketState {
    return this.ws ? this.ws.readyState : WebSocketState.CLOSED;
  }

  /**
   * Check if connection is open
   */
  isConnected(): boolean {
    return this.ws?.readyState === WebSocketState.OPEN;
  }

  /**
   * Get connection statistics
   */
  getStats(): {
    state: WebSocketState;
    reconnectionAttempts: number;
    queuedMessages: number;
    lastActivity: number;
    isIntentionallyClosed: boolean;
  } {
    return {
      state: this.getState(),
      reconnectionAttempts: this.reconnectionAttempts,
      queuedMessages: this.messageQueue.length,
      lastActivity: this.lastActivity,
      isIntentionallyClosed: this.isIntentionallyClosed
    };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<WebSocketConfig>): void {
    this.config = this.mergeDefaultConfig({ ...this.config, ...newConfig });
  }
}

/**
 * WebSocket integration with FluxHTTP
 */
export class WebSocketIntegration {
  private connections = new Map<string, FluxWebSocket>();

  /**
   * Create a new WebSocket connection
   */
  createConnection(
    name: string,
    config: WebSocketConfig,
    handlers?: WebSocketEventHandlers
  ): FluxWebSocket {
    const ws = new FluxWebSocket(config, handlers);
    this.connections.set(name, ws);
    return ws;
  }

  /**
   * Get an existing connection
   */
  getConnection(name: string): FluxWebSocket | undefined {
    return this.connections.get(name);
  }

  /**
   * Remove a connection
   */
  removeConnection(name: string): boolean {
    const connection = this.connections.get(name);
    if (connection) {
      connection.close();
      return this.connections.delete(name);
    }
    return false;
  }

  /**
   * Get all connection names
   */
  getConnectionNames(): string[] {
    return Array.from(this.connections.keys());
  }

  /**
   * Close all connections
   */
  closeAll(): void {
    for (const connection of this.connections.values()) {
      connection.close();
    }
    this.connections.clear();
  }

  /**
   * Get statistics for all connections
   */
  getAllStats(): Record<string, ReturnType<FluxWebSocket['getStats']>> {
    const stats: Record<string, ReturnType<FluxWebSocket['getStats']>> = {};
    
    for (const [name, connection] of this.connections) {
      stats[name] = connection.getStats();
    }
    
    return stats;
  }
}

/**
 * Unified HTTP + WebSocket client configuration
 */
export interface UnifiedClientConfig extends fluxhttpRequestConfig {
  /** WebSocket configuration */
  websocket?: Record<string, WebSocketConfig>;
  /** Default WebSocket connection name */
  defaultWebSocket?: string;
}

/**
 * Unified client for HTTP and WebSocket communication
 */
export class UnifiedClient {
  private wsIntegration = new WebSocketIntegration();

  constructor(private config: UnifiedClientConfig = {}) {
    // Initialize configured WebSocket connections
    if (config.websocket) {
      for (const [name, wsConfig] of Object.entries(config.websocket)) {
        this.wsIntegration.createConnection(name, wsConfig);
      }
    }
  }

  /**
   * Get WebSocket integration instance
   */
  getWebSocketIntegration(): WebSocketIntegration {
    return this.wsIntegration;
  }

  /**
   * Send message via WebSocket
   */
  sendWebSocketMessage(
    data: string | ArrayBuffer | Blob,
    connectionName?: string
  ): void {
    const name = connectionName || this.config.defaultWebSocket;
    if (!name) {
      throw new Error('No WebSocket connection specified');
    }

    const connection = this.wsIntegration.getConnection(name);
    if (!connection) {
      throw new Error(`WebSocket connection '${name}' not found`);
    }

    connection.send(data);
  }

  /**
   * Close WebSocket connection
   */
  closeWebSocket(connectionName?: string): void {
    const name = connectionName || this.config.defaultWebSocket;
    if (name) {
      this.wsIntegration.removeConnection(name);
    }
  }

  /**
   * Close all connections
   */
  dispose(): void {
    this.wsIntegration.closeAll();
  }
}

export default FluxWebSocket;