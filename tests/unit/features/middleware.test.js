/**
 * @fileoverview Tests for middleware system
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { 
  MiddlewarePipeline, 
  MiddlewareComposer 
} from '../../../src/features/middleware.js';

describe('MiddlewarePipeline', () => {
  it('should initialize with default config', () => {
    const pipeline = new MiddlewarePipeline();
    assert.ok(pipeline);
  });

  it('should add request middleware', () => {
    const pipeline = new MiddlewarePipeline();
    
    const middleware = {
      name: 'test-middleware',
      execute: (context) => context
    };
    
    pipeline.addRequestMiddleware(middleware);
    const stats = pipeline.getStats();
    assert.strictEqual(stats.requestMiddleware, 1);
  });

  it('should add response middleware', () => {
    const pipeline = new MiddlewarePipeline();
    
    const middleware = {
      name: 'test-response-middleware',
      execute: (context) => context
    };
    
    pipeline.addResponseMiddleware(middleware);
    const stats = pipeline.getStats();
    assert.strictEqual(stats.responseMiddleware, 1);
  });

  it('should add error middleware', () => {
    const pipeline = new MiddlewarePipeline();
    
    const middleware = {
      name: 'test-error-middleware',
      execute: (context) => context
    };
    
    pipeline.addErrorMiddleware(middleware);
    const stats = pipeline.getStats();
    assert.strictEqual(stats.errorMiddleware, 1);
  });

  it('should execute request middleware pipeline', async () => {
    const pipeline = new MiddlewarePipeline();
    
    const middleware = {
      name: 'test-middleware',
      execute: (context) => {
        context.metadata.set('processed', true);
        return context;
      }
    };
    
    pipeline.addRequestMiddleware(middleware);
    
    const config = { url: 'https://example.com', method: 'GET' };
    const result = await pipeline.executeRequestMiddleware(config);
    
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.context.metadata.get('processed'), true);
  });

  it('should remove middleware by name', () => {
    const pipeline = new MiddlewarePipeline();
    
    const middleware = {
      name: 'removable-middleware',
      execute: (context) => context
    };
    
    pipeline.addRequestMiddleware(middleware);
    assert.strictEqual(pipeline.getStats().requestMiddleware, 1);
    
    const removed = pipeline.removeMiddleware('removable-middleware');
    assert.strictEqual(removed, true);
    assert.strictEqual(pipeline.getStats().requestMiddleware, 0);
  });

  it('should enable/disable middleware', () => {
    const pipeline = new MiddlewarePipeline();
    
    const middleware = {
      name: 'toggleable-middleware',
      execute: (context) => context
    };
    
    pipeline.addRequestMiddleware(middleware);
    
    const enabled = pipeline.setMiddlewareEnabled('toggleable-middleware', false);
    assert.strictEqual(enabled, true);
    
    const disabled = pipeline.setMiddlewareEnabled('toggleable-middleware', true);
    assert.strictEqual(disabled, true);
  });

  it('should get middleware metrics', () => {
    const pipeline = new MiddlewarePipeline();
    
    const middleware = {
      name: 'metrics-middleware',
      execute: (context) => context
    };
    
    pipeline.addRequestMiddleware(middleware);
    
    const allMetrics = pipeline.getMetrics();
    assert.strictEqual(typeof allMetrics, 'object');
    assert.ok('metrics-middleware' in allMetrics);
  });

  it('should clear all middleware', () => {
    const pipeline = new MiddlewarePipeline();
    
    const middleware = {
      name: 'clearable-middleware',
      execute: (context) => context
    };
    
    pipeline.addRequestMiddleware(middleware);
    assert.strictEqual(pipeline.getStats().totalMiddleware, 1);
    
    pipeline.clear();
    assert.strictEqual(pipeline.getStats().totalMiddleware, 0);
  });
});

describe('MiddlewareComposer', () => {
  it('should compose request middleware', () => {
    const middleware1 = {
      name: 'middleware-1',
      execute: (context) => {
        context.metadata.set('step1', true);
        return context;
      }
    };
    
    const middleware2 = {
      name: 'middleware-2',
      execute: (context) => {
        context.metadata.set('step2', true);
        return context;
      }
    };
    
    const composed = MiddlewareComposer.composeRequest([middleware1, middleware2]);
    assert.ok(composed);
    assert.strictEqual(typeof composed.execute, 'function');
  });

  it('should create conditional middleware', () => {
    const middleware = {
      name: 'base-middleware',
      execute: (context) => context
    };
    
    const condition = (context) => context.config.method === 'POST';
    const conditional = MiddlewareComposer.conditional(middleware, condition);
    
    assert.ok(conditional);
    assert.strictEqual(conditional.name, 'conditional-base-middleware');
    assert.ok(conditional.conditions);
  });

  it('should create once middleware', () => {
    const middleware = {
      name: 'once-middleware',
      execute: (context) => {
        context.metadata.set('executed', true);
        return context;
      }
    };
    
    const once = MiddlewareComposer.once(middleware);
    assert.ok(once);
    assert.strictEqual(once.name, 'once-once-middleware');
  });

  it('should create retry middleware', () => {
    const middleware = {
      name: 'retry-middleware',
      execute: (context) => context
    };
    
    const withRetry = MiddlewareComposer.withRetry(middleware, 3, 100);
    assert.ok(withRetry);
    assert.strictEqual(withRetry.name, 'retry-retry-middleware');
  });
});