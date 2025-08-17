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
  public token: CancelToken;
  private _cancel: Canceler;

  constructor() {
    let resolvePromise: (cancel: Cancel) => void;
    
    this.token = {
      promise: new Promise<Cancel>((resolve) => {
        resolvePromise = resolve;
      }),
      throwIfRequested() {
        if (this.reason) {
          throw new fluxhttpError('Request cancelled', 'ERR_CANCELLED');
        }
      }
    };

    this._cancel = (message?: string) => {
      if (this.token.reason) return;

      const cancel: Cancel = { message: message || 'Request cancelled' };
      this.token.reason = cancel;
      resolvePromise(cancel);
    };
  }

  cancel(message?: string): void {
    this._cancel(message);
  }

  static source(): CancelTokenSource {
    return new CancelTokenSource();
  }
}

export class CancelToken {
  promise: Promise<Cancel>;
  reason?: Cancel;

  constructor(executor: CancelExecutor) {
    let resolvePromise: (cancel: Cancel) => void;
    
    this.promise = new Promise<Cancel>((resolve) => {
      resolvePromise = resolve;
    });

    executor((message?: string) => {
      if (this.reason) return;

      const cancel: Cancel = { message: message || 'Request cancelled' };
      this.reason = cancel;
      resolvePromise(cancel);
    });
  }

  throwIfRequested(): void {
    if (this.reason) {
      throw new fluxhttpError('Request cancelled', 'ERR_CANCELLED');
    }
  }

  static source = CancelTokenSource.source;
}

export function isCancel(value: unknown): value is Cancel {
  return !!(value && typeof value === 'object' && 'message' in value && !(value instanceof Error));
}