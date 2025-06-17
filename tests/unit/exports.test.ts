import { describe, it, expect } from 'vitest';

describe('Module exports', () => {
  it('should export all core modules', async () => {
    const coreModule = await import('../../src/core/index');
    expect(coreModule.FluxHTTP).toBeDefined();
    expect(coreModule.createFluxHTTPInstance).toBeDefined();
    expect(coreModule.defaults).toBeDefined();
    expect(coreModule.mergeConfig).toBeDefined();
    expect(coreModule.buildFullPath).toBeDefined();
  });

  it('should export all error modules', async () => {
    const errorModule = await import('../../src/errors/index');
    expect(errorModule.FluxHTTPError).toBeDefined();
    expect(errorModule.createError).toBeDefined();
    expect(errorModule.createRequestError).toBeDefined();
    expect(errorModule.createResponseError).toBeDefined();
    expect(errorModule.createTimeoutError).toBeDefined();
    expect(errorModule.createNetworkError).toBeDefined();
    expect(errorModule.createCancelError).toBeDefined();
  });

  it('should export all interceptor modules', async () => {
    const interceptorModule = await import('../../src/interceptors/index');
    expect(interceptorModule.InterceptorManager).toBeDefined();
    expect(interceptorModule.dispatchRequest).toBeDefined();
  });

  it('should export all type modules', async () => {
    const typeModule = await import('../../src/types/index');
    // Types are compile-time only, so we just check the module loads
    expect(typeModule).toBeDefined();
  });

  it('should export all util modules', async () => {
    const utilModule = await import('../../src/utils/index');
    expect(utilModule.buildURL).toBeDefined();
    expect(utilModule.serializeParams).toBeDefined();
    expect(utilModule.combineURLs).toBeDefined();
    expect(utilModule.isAbsoluteURL).toBeDefined();
    expect(utilModule.normalizeHeaders).toBeDefined();
    expect(utilModule.mergeHeaders).toBeDefined();
    expect(utilModule.setContentTypeIfUnset).toBeDefined();
    expect(utilModule.isFormData).toBeDefined();
    expect(utilModule.isURLSearchParams).toBeDefined();
    expect(utilModule.isArrayBuffer).toBeDefined();
    expect(utilModule.isBlob).toBeDefined();
    expect(utilModule.isStream).toBeDefined();
    expect(utilModule.isPlainObject).toBeDefined();
    expect(utilModule.transformRequestData).toBeDefined();
    expect(utilModule.transformResponseData).toBeDefined();
  });
});
