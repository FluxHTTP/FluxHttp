import { fluxhttpError } from '../errors/fluxhttperror';

export interface CancelToken {
  promise: Promise<Cancel>;
  reason?: Cancel;
  throwIfRequested(): void;
}

export interface Cancel {
  message?: string;
}

export interface CancelExecutor {
  (cancel: Canceler): void;
}

export interface Canceler {
  (message?: string): void;
}

export class CancelTokenSource {
  private _controller: AbortController;
  private _cancel?: Canceler;
  public token: CancelToken;

  constructor() {
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

  cancel(message?: string): void {
    this._cancel?.(message);
  }

  get signal(): AbortSignal {
    return this._controller.signal;
  }
}

export class CancelTokenStatic {
  source(): CancelTokenSource {
    return new CancelTokenSource();
  }

  static source(): CancelTokenSource {
    return new CancelTokenSource();
  }
}

export const CancelToken = new CancelTokenStatic();

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
