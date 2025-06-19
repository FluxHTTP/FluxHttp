import { createfluxhttpInstance, defaults } from './core';

const fluxhttp = createfluxhttpInstance(defaults);

export default fluxhttp;

export * from './types';
export { fluxhttpError } from './errors';
export { CancelToken, CancelTokenSource, type Cancel, type Canceler } from './core/canceltoken';
export {
  SecurityManager,
  defaultSecurity,
  createSecurityConfig,
  type SecurityConfig,
} from './core/security';
export {
  securityRequestInterceptor,
  securityResponseInterceptor,
  createSecurityRequestInterceptor,
  createSecurityResponseInterceptor,
} from './interceptors/security';

export const create = fluxhttp.create.bind(fluxhttp);
export const isCancel = fluxhttp.isCancel.bind(fluxhttp);
export const all = fluxhttp.all.bind(fluxhttp);
export const spread = fluxhttp.spread.bind(fluxhttp);
export const isfluxhttpError = fluxhttp.isfluxhttpError.bind(fluxhttp);
