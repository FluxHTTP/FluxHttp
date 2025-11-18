import { fluxhttpError } from '../errors/fluxhttperror';

/**
 * Cancel token interface for request cancellation
 * @interface CancelToken
 */
export interface CancelToken {
  /** Promise that resolves when cancellation is requested */
  promise: Promise<Cancel>;
  /** Cancellation reason if cancelled */
  reason?: Cancel;
  /** Throw error if cancellation was requested */
  throwIfRequested(): void;
}

/**
 * Cancel object containing cancellation message
 * @interface Cancel
 */
export interface Cancel {
  /** Optional cancellation message */
  message?: string;
}

/**
 * Executor function for CancelToken constructor
 * @interface CancelExecutor
 */
export interface CancelExecutor {
  (cancel: Canceler): void;
}

/**
 * Function to trigger cancellation
 * @interface Canceler
 */
export interface Canceler {
  (message?: string): void;
}

/**
 * Source for creating cancel tokens
 * @class CancelTokenSource
 * @description Creates a cancel token and provides a method to cancel requests
 *
 * @example
 * ```typescript
 * const source = CancelTokenSource.source();
 *
 * // Make request with cancel token
 * fluxhttp.get('/api/data', {
 *   cancelToken: source.token
 * }).catch(error => {
 *   if (isCancel(error)) {
 *     console.log('Request cancelled:', error.message);
 *   }
 * });
 *
 * // Cancel the request
 * source.cancel('User cancelled operation');
 * ```
 */
export class CancelTokenSource {
  private _controller: AbortController;
  private _cancel?: Canceler;
  public token: CancelToken;

  /**
   * Create a new cancel token source
   * @constructor
   */
  constructor() {
    // BUG-001 FIX: Check if AbortController is available
    if (typeof AbortController === 'undefined') {
      throw new Error('AbortController is not available in this environment. Please use a polyfill or upgrade your runtime.');
    }
    this._controller = new AbortController();

    let resolvePromise: (cancel: Cancel) => void;

    this.token = {
      promise: new Promise<Cancel>((resolve) => {
        resolvePromise = resolve;
      }),
      throwIfRequested: (): void => {
        if (this.token.reason) {
          throw new fluxhttpError(this.token.reason.message || 'Request canceled', 'ECONNABORTED');
        }
      },
    };

    this._cancel = (message?: string): void => {
      if (this.token.reason) {
        return;
      }

      const cancel: Cancel = { message };
      this.token.reason = cancel;
      this._controller.abort();
      resolvePromise(cancel);
    };
  }

  /**
   * Cancel the associated request
   * @param {string} [message] - Optional cancellation message
   * @returns {void}
   */
  cancel(message?: string): void {
    this._cancel?.(message);
  }

  /**
   * Get the AbortSignal for modern cancellation
   * @returns {AbortSignal} AbortController signal
   */
  get signal(): AbortSignal {
    return this._controller.signal;
  }
}

/**
 * Static class for creating cancel token sources
 * @class CancelTokenStatic
 * @description Factory for creating CancelTokenSource instances
 */
export class CancelTokenStatic {
  /**
   * Create a new cancel token source
   * @returns {CancelTokenSource} New cancel token source
   * @example
   * ```typescript
   * const source = CancelToken.source();
   * ```
   */
  source(): CancelTokenSource {
    return new CancelTokenSource();
  }

  /**
   * Static method to create a new cancel token source
   * @static
   * @returns {CancelTokenSource} New cancel token source
   */
  static source(): CancelTokenSource {
    return new CancelTokenSource();
  }
}

/** Default CancelToken instance */
export const CancelToken = new CancelTokenStatic();

/**
 * Check if a value is a cancellation
 * @function isCancel
 * @param {unknown} value - Value to check
 * @returns {boolean} True if value is a Cancel object
 * @example
 * ```typescript
 * try {
 *   await fluxhttp.get('/api/data', { cancelToken });
 * } catch (error) {
 *   if (isCancel(error)) {
 *     console.log('Request was cancelled');
 *   } else {
 *     console.error('Request failed:', error);
 *   }
 * }
 * ```
 */
export function isCancel(value: unknown): value is Cancel {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  // Check if it's an Error object (has Error-specific properties)
  if ('name' in value && 'stack' in value && value instanceof Error) {
    return false;
  }

  const keys = Object.keys(value);

  // Empty object {} is a valid Cancel
  if (keys.length === 0) {
    return true;
  }

  // Object with only message property is a valid Cancel
  if (keys.length === 1 && keys[0] === 'message') {
    return true;
  }

  // Object with message and other non-Error properties is also valid Cancel
  return 'message' in value && !('name' in value) && !('stack' in value);
}
