/**
 * @fileoverview Plugin event emitter implementation
 * @module @fluxhttp/plugins/core/events
 */

import type { PluginEventEmitter as IPluginEventEmitter, PluginEventHandler } from '../types';

/**
 * Event listener entry
 */
interface EventListener<T = unknown> {
  handler: PluginEventHandler<T>;
  once: boolean;
  namespace?: string;
}

/**
 * Plugin event emitter implementation
 */
export class PluginEventEmitter implements IPluginEventEmitter {
  private readonly listeners = new Map<string, EventListener[]>();
  private readonly maxListeners = 100;
  private readonly namespace?: string;

  constructor(namespace?: string) {
    this.namespace = namespace;
  }

  /**
   * Emit an event
   */
  emit<T = unknown>(event: string, data?: T): void {
    const fullEvent = this.getFullEventName(event);
    const eventListeners = this.listeners.get(fullEvent);
    
    if (!eventListeners || eventListeners.length === 0) {
      return;
    }

    // Create a copy to avoid issues with listeners modifying the array
    const listenersToCall = [...eventListeners];
    const toRemove: EventListener[] = [];

    for (const listener of listenersToCall) {
      try {
        // Use setTimeout to make async
        setTimeout(() => {
          listener.handler(data, undefined as any); // Context will be provided by registry
        }, 0);

        // Mark once listeners for removal
        if (listener.once) {
          toRemove.push(listener);
        }
      } catch (error) {
        console.error(`Error in event listener for '${fullEvent}':`, error);
      }
    }

    // Remove once listeners
    if (toRemove.length > 0) {
      const remainingListeners = eventListeners.filter(l => !toRemove.includes(l));
      if (remainingListeners.length > 0) {
        this.listeners.set(fullEvent, remainingListeners);
      } else {
        this.listeners.delete(fullEvent);
      }
    }
  }

  /**
   * Listen to an event
   */
  on<T = unknown>(event: string, handler: PluginEventHandler<T>): void {
    this.addListener(event, handler, false);
  }

  /**
   * Listen to an event once
   */
  once<T = unknown>(event: string, handler: PluginEventHandler<T>): void {
    this.addListener(event, handler, true);
  }

  /**
   * Remove event listener
   */
  off<T = unknown>(event: string, handler: PluginEventHandler<T>): void {
    const fullEvent = this.getFullEventName(event);
    const eventListeners = this.listeners.get(fullEvent);
    
    if (!eventListeners) {
      return;
    }

    const index = eventListeners.findIndex(listener => listener.handler === handler);
    if (index > -1) {
      eventListeners.splice(index, 1);
      
      if (eventListeners.length === 0) {
        this.listeners.delete(fullEvent);
      }
    }
  }

  /**
   * Remove all listeners for an event
   */
  removeAllListeners(event?: string): void {
    if (event) {
      const fullEvent = this.getFullEventName(event);
      this.listeners.delete(fullEvent);
    } else {
      // Remove all listeners for this namespace
      if (this.namespace) {
        const prefix = `${this.namespace}:`;
        for (const eventName of this.listeners.keys()) {
          if (eventName.startsWith(prefix)) {
            this.listeners.delete(eventName);
          }
        }
      } else {
        this.listeners.clear();
      }
    }
  }

  /**
   * Get event listener count
   */
  listenerCount(event: string): number {
    const fullEvent = this.getFullEventName(event);
    const eventListeners = this.listeners.get(fullEvent);
    return eventListeners ? eventListeners.length : 0;
  }

  /**
   * Get event names
   */
  eventNames(): string[] {
    const names = Array.from(this.listeners.keys());
    
    if (this.namespace) {
      const prefix = `${this.namespace}:`;
      return names
        .filter(name => name.startsWith(prefix))
        .map(name => name.substring(prefix.length));
    }
    
    return names;
  }

  /**
   * Create child event emitter with namespace
   */
  child(namespace: string): PluginEventEmitter {
    const childNamespace = this.namespace ? `${this.namespace}.${namespace}` : namespace;
    return new PluginEventEmitter(childNamespace);
  }

  /**
   * Get event statistics
   */
  getStats(): Record<string, unknown> {
    const stats: Record<string, unknown> = {
      totalEvents: this.listeners.size,
      totalListeners: 0,
      eventBreakdown: {} as Record<string, number>
    };

    for (const [event, listeners] of this.listeners) {
      stats.totalListeners = (stats.totalListeners as number) + listeners.length;
      (stats.eventBreakdown as Record<string, number>)[event] = listeners.length;
    }

    if (this.namespace) {
      stats.namespace = this.namespace;
    }

    return stats;
  }

  /**
   * Dispose event emitter
   */
  dispose(): void {
    this.removeAllListeners();
  }

  // Private methods

  /**
   * Add event listener
   */
  private addListener<T>(event: string, handler: PluginEventHandler<T>, once: boolean): void {
    const fullEvent = this.getFullEventName(event);
    
    if (!this.listeners.has(fullEvent)) {
      this.listeners.set(fullEvent, []);
    }

    const eventListeners = this.listeners.get(fullEvent)!;
    
    // Check max listeners limit
    if (eventListeners.length >= this.maxListeners) {
      console.warn(
        `Max listeners (${this.maxListeners}) exceeded for event '${fullEvent}'. ` +
        'This might indicate a memory leak.'
      );
    }

    const listener: EventListener<T> = {
      handler,
      once,
      namespace: this.namespace
    };

    eventListeners.push(listener);
  }

  /**
   * Get full event name with namespace
   */
  private getFullEventName(event: string): string {
    return this.namespace ? `${this.namespace}:${event}` : event;
  }
}