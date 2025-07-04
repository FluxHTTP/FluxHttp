import type { fluxhttpRequestConfig, Headers } from '../types';
import { isPlainObject, isFormData, isURLSearchParams } from '../utils/data';

/**
 * Default configuration for fluxhttp requests
 * @const {fluxhttpRequestConfig} defaults
 * @description These defaults are merged with user-provided configuration
 */
export const defaults: fluxhttpRequestConfig = {
  method: 'GET',
  timeout: 0,
  headers: {
    Accept: 'application/json, text/plain, */*',
    'User-Agent': 'fluxhttp/0.1.0',
  },

  validateStatus: (status: number): boolean => {
    return status >= 200 && status < 300;
  },

  transformRequest: [
    (data: unknown, headers?: Headers): unknown => {
      if (isFormData(data) || isURLSearchParams(data)) {
        return data;
      }

      if (isPlainObject(data)) {
        if (headers && !headers['content-type']) {
          headers['content-type'] = 'application/json';
        }
        return JSON.stringify(data);
      }

      return data;
    },
  ],

  transformResponse: [
    (data: unknown): unknown => {
      if (typeof data === 'string') {
        try {
          return JSON.parse(data);
        } catch {
          return data;
        }
      }
      return data;
    },
  ],
};
