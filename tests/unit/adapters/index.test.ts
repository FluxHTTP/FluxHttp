import { describe, it, expect } from 'vitest';

describe('Adapter exports', () => {
  it('should export adapter functions', async () => {
    const adapterModule = await import('../../../src/adapters/index');

    expect(typeof adapterModule.xhrAdapter).toBe('function');
    expect(typeof adapterModule.fetchAdapter).toBe('function');
    expect(typeof adapterModule.getDefaultAdapter).toBe('function');
  });

  it('should get default adapter for browser environment', async () => {
    // Mock XMLHttpRequest to simulate browser environment
    global.XMLHttpRequest = class MockXHR {} as any;

    const { getDefaultAdapter } = await import('../../../src/adapters/index');
    const adapter = getDefaultAdapter();

    expect(typeof adapter).toBe('function');
  });
});
