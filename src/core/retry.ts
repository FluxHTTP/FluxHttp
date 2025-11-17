import type { fluxhttpRequestConfig, RetryConfig } from '../types';
import type { fluxhttpError } from '../errors';

export interface RetryStrategy {
  shouldRetry(error: fluxhttpError, attempt: number, config: RetryConfig): boolean;
  getDelay(attempt: number, config: RetryConfig, error?: fluxhttpError): number;
}

export class ExponentialBackoffStrategy implements RetryStrategy {
  shouldRetry(error: fluxhttpError, attempt: number, config: RetryConfig): boolean {
    const maxAttempts = config.attempts || 3;

    if (attempt >= maxAttempts) {
      return false;
    }

    // Check custom retry condition first
    if (config.retryCondition) {
      return config.retryCondition(error);
    }

    // Default retry conditions
    return this.isRetryableError(error);
  }

  private isRetryableError(error: fluxhttpError): boolean {
    // Network errors
    if (error.code === 'ERR_NETWORK' || error.code === 'ETIMEDOUT') {
      return true;
    }

    // Server errors (5xx)
    if (error.response && error.response.status >= 500) {
      return true;
    }

    // Rate limiting (429)
    if (error.response && error.response.status === 429) {
      return true;
    }

    // Connection errors
    if (error.code === 'ECONNREFUSED' || error.code === 'ECONNRESET') {
      return true;
    }

    return false;
  }

  getDelay(attempt: number, config: RetryConfig, error?: fluxhttpError): number {
    const baseDelay = config.delay || 1000;
    const maxDelay = config.maxDelay || 30000;
    const backoff = config.backoff || 'exponential';

    let delay: number;

    switch (backoff) {
      case 'linear':
        delay = baseDelay * (attempt + 1);
        break;
      case 'constant':
        delay = baseDelay;
        break;
      case 'exponential':
      default:
        delay = baseDelay * Math.pow(2, attempt);
        break;
    }

    // Add jitter to prevent thundering herd
    const jitter = Math.random() * 0.1 * delay;
    delay += jitter;

    // Check for Retry-After header
    if (error?.response?.headers?.['retry-after']) {
      const retryAfter = parseInt(error.response.headers['retry-after'] as string, 10);
      if (!isNaN(retryAfter)) {
        delay = Math.max(delay, retryAfter * 1000);
      }
    }

    return Math.min(delay, maxDelay);
  }
}

export async function executeWithRetry<T>(
  operation: () => Promise<T>,
  config: fluxhttpRequestConfig,
  strategy: RetryStrategy = new ExponentialBackoffStrategy()
): Promise<T> {
  const retryConfig = config.retry;

  if (!retryConfig || !retryConfig.attempts || retryConfig.attempts <= 0) {
    return operation();
  }

  let lastError: fluxhttpError;
  let attempt = 0;

  while (attempt < (retryConfig.attempts || 3)) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as fluxhttpError;

      if (!strategy.shouldRetry(lastError, attempt, retryConfig)) {
        throw lastError;
      }

      const delay = strategy.getDelay(attempt, retryConfig, lastError);

      // Log retry attempt (could be replaced with proper logging)
      if (typeof process !== 'undefined' && process.env && process.env.NODE_ENV !== 'test') {
        // Retry attempt logged internally
      }

      await new Promise((resolve) => setTimeout(resolve, delay));
      attempt++;
    }
  }

  throw lastError!;
}

export const defaultRetryConfig: RetryConfig = {
  attempts: 3,
  delay: 1000,
  maxDelay: 30000,
  backoff: 'exponential',
  retryCondition: undefined,
};
