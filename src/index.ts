import { createFluxHTTPInstance, defaults } from './core';

const fluxhttp = createFluxHTTPInstance(defaults);

export default fluxhttp;
export { fluxhttp };

export * from './types';
export { FluxHTTPError } from './errors';

export const create = fluxhttp.create.bind(fluxhttp);
export const isCancel = fluxhttp.isCancel.bind(fluxhttp);
export const all = fluxhttp.all.bind(fluxhttp);
export const spread = fluxhttp.spread.bind(fluxhttp);
export const isFluxHTTPError = fluxhttp.isFluxHTTPError.bind(fluxhttp);
