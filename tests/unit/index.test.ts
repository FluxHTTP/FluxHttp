import { describe, it, expect } from 'vitest';
import fluxhttp, {
  create,
  isCancel,
  all,
  spread,
  isFluxHTTPError,
  FluxHTTPError,
} from '../../src/index';

describe('FluxHTTP main exports', () => {
  it('should export default fluxhttp instance', () => {
    expect(fluxhttp).toBeDefined();
    expect(typeof fluxhttp.get).toBe('function');
    expect(typeof fluxhttp.post).toBe('function');
    expect(typeof fluxhttp.create).toBe('function');
  });

  it('should export create function', () => {
    expect(typeof create).toBe('function');
    const instance = create({ baseURL: 'https://test.com' });
    expect(instance.defaults.baseURL).toBe('https://test.com');
  });

  it('should export isCancel function', () => {
    expect(typeof isCancel).toBe('function');
    expect(isCancel({ code: 'ERR_CANCELED' })).toBe(true);
    expect(isCancel({ code: 'ERR_NETWORK' })).toBe(false);
  });

  it('should export all function', async () => {
    expect(typeof all).toBe('function');
    const result = await all([Promise.resolve(1), Promise.resolve(2)]);
    expect(result).toEqual([1, 2]);
  });

  it('should export spread function', () => {
    expect(typeof spread).toBe('function');
    const fn = spread((a: number, b: number) => a + b);
    expect(fn([1, 2])).toBe(3);
  });

  it('should export isFluxHTTPError function', () => {
    expect(typeof isFluxHTTPError).toBe('function');
    const error = new FluxHTTPError('test');
    expect(isFluxHTTPError(error)).toBe(true);
    expect(isFluxHTTPError(new Error('test'))).toBe(false);
  });

  it('should export FluxHTTPError class', () => {
    expect(FluxHTTPError).toBeDefined();
    const error = new FluxHTTPError('test error');
    expect(error.message).toBe('test error');
    expect(error.isFluxHTTPError).toBe(true);
  });
});
