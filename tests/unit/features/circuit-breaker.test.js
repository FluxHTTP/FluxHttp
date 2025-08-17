/**
 * @fileoverview Tests for circuit breaker and advanced retry mechanisms
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { 
  CircuitBreaker, 
  AdvancedRetryMechanism, 
  CircuitState 
} from '../../../src/features/circuit-breaker.js';

describe('CircuitBreaker', () => {
  it('should initialize with closed state', () => {
    const config = {
      failureThreshold: 0.5,
      successThreshold: 3,
      timeout: 60000,
      monitoringWindow: 60000,
      minimumRequests: 10,
      name: 'test-circuit'
    };
    
    const circuitBreaker = new CircuitBreaker(config);
    assert.strictEqual(circuitBreaker.getState(), CircuitState.CLOSED);
  });

  it('should execute successful request', async () => {
    const config = {
      failureThreshold: 0.5,
      successThreshold: 3,
      timeout: 60000,
      monitoringWindow: 60000,
      minimumRequests: 10,
      name: 'test-circuit'
    };
    
    const circuitBreaker = new CircuitBreaker(config);
    
    const mockRequest = async () => ({
      data: 'success',
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {}
    });
    
    const response = await circuitBreaker.execute(mockRequest);
    assert.strictEqual(response.data, 'success');
    assert.strictEqual(circuitBreaker.getState(), CircuitState.CLOSED);
  });

  it('should get circuit breaker stats', () => {
    const config = {
      failureThreshold: 0.5,
      successThreshold: 3,
      timeout: 60000,
      monitoringWindow: 60000,
      minimumRequests: 10,
      name: 'test-circuit'
    };
    
    const circuitBreaker = new CircuitBreaker(config);
    const stats = circuitBreaker.getStats();
    
    assert.strictEqual(typeof stats.state, 'string');
    assert.strictEqual(typeof stats.totalRequests, 'number');
    assert.strictEqual(typeof stats.failedRequests, 'number');
    assert.strictEqual(typeof stats.successfulRequests, 'number');
    assert.strictEqual(typeof stats.failureRate, 'number');
  });

  it('should reset circuit breaker', () => {
    const config = {
      failureThreshold: 0.5,
      successThreshold: 3,
      timeout: 60000,
      monitoringWindow: 60000,
      minimumRequests: 10,
      name: 'test-circuit'
    };
    
    const circuitBreaker = new CircuitBreaker(config);
    circuitBreaker.reset();
    
    assert.strictEqual(circuitBreaker.getState(), CircuitState.CLOSED);
  });

  it('should force circuit states', () => {
    const config = {
      failureThreshold: 0.5,
      successThreshold: 3,
      timeout: 60000,
      monitoringWindow: 60000,
      minimumRequests: 10,
      name: 'test-circuit'
    };
    
    const circuitBreaker = new CircuitBreaker(config);
    
    circuitBreaker.forceOpen();
    assert.strictEqual(circuitBreaker.getState(), CircuitState.OPEN);
    
    circuitBreaker.forceClosed();
    assert.strictEqual(circuitBreaker.getState(), CircuitState.CLOSED);
  });
});

describe('AdvancedRetryMechanism', () => {
  it('should initialize with default config', () => {
    const retryMechanism = new AdvancedRetryMechanism();
    assert.ok(retryMechanism);
  });

  it('should execute successful request without retry', async () => {
    const retryMechanism = new AdvancedRetryMechanism();
    
    const mockRequest = async () => ({
      data: 'success',
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {}
    });
    
    const response = await retryMechanism.executeWithRetry(mockRequest);
    assert.strictEqual(response.data, 'success');
  });

  it('should retry on retryable error', async () => {
    const retryMechanism = new AdvancedRetryMechanism({
      maxAttempts: 3,
      initialDelay: 10
    });
    
    let attemptCount = 0;
    const mockRequest = async () => {
      attemptCount++;
      if (attemptCount < 3) {
        const error = new Error('Network error');
        error.code = 'NETWORK_ERROR';
        throw error;
      }
      return {
        data: 'success',
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {}
      };
    };
    
    const response = await retryMechanism.executeWithRetry(mockRequest);
    assert.strictEqual(response.data, 'success');
    assert.strictEqual(attemptCount, 3);
  });

  it('should get circuit breaker stats', () => {
    const retryMechanism = new AdvancedRetryMechanism();
    const stats = retryMechanism.getAllCircuitBreakerStats();
    assert.strictEqual(typeof stats, 'object');
  });

  it('should reset all circuit breakers', () => {
    const retryMechanism = new AdvancedRetryMechanism();
    retryMechanism.resetAllCircuitBreakers();
    // Should not throw
    assert.ok(true);
  });
});