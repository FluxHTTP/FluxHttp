import { describe, it, expect, vi } from 'vitest';
import { InterceptorManager } from '../../../src/interceptors/InterceptorManager';

describe('InterceptorManager', () => {
  it('should add and execute interceptors', () => {
    const manager = new InterceptorManager<string>();
    const fulfilled = vi.fn((value: string) => value + ' modified');
    const rejected = vi.fn();

    const id = manager.use(fulfilled, rejected);
    expect(id).toBe(0);
    expect(manager.size).toBe(1);
  });

  it('should eject interceptors', () => {
    const manager = new InterceptorManager<string>();
    const fulfilled = vi.fn();

    const id = manager.use(fulfilled);
    expect(manager.size).toBe(1);

    manager.eject(id);
    expect(manager.size).toBe(0);
  });

  it('should clear all interceptors', () => {
    const manager = new InterceptorManager<string>();

    manager.use(vi.fn());
    manager.use(vi.fn());
    manager.use(vi.fn());

    expect(manager.size).toBe(3);

    manager.clear();
    expect(manager.size).toBe(0);
  });

  it('should iterate over interceptors', () => {
    const manager = new InterceptorManager<string>();
    const interceptors = [vi.fn(), vi.fn(), vi.fn()];

    interceptors.forEach((fn) => manager.use(fn));

    let count = 0;
    manager.forEach(() => {
      count++;
    });

    expect(count).toBe(3);
  });

  it('should support iterator protocol', () => {
    const manager = new InterceptorManager<string>();
    const interceptors = [vi.fn(), vi.fn()];

    interceptors.forEach((fn) => manager.use(fn));

    const items = [...manager];
    expect(items).toHaveLength(2);
  });

  it('should store interceptor options', () => {
    const manager = new InterceptorManager<string>();
    const fulfilled = vi.fn();
    const options = { synchronous: true };

    manager.use(fulfilled, undefined, options);

    const items = [...manager];
    expect(items[0]?.options).toEqual(options);
  });
});
