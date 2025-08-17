/**
 * @fileoverview Angular module for FluxHTTP integration
 */

import { NgModule, ModuleWithProviders, Optional, SkipSelf } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HTTP_INTERCEPTORS } from '@angular/common/http';

import { FluxHttpService, FluxHttpCacheService, FluxHttpLoadingService } from './fluxhttp.service';
import {
  FluxHttpRequestInterceptor,
  FluxHttpResponseInterceptor,
  FluxHttpErrorInterceptor,
  FluxHttpRetryInterceptor,
  FluxHttpCacheInterceptor,
} from './interceptors';

import fluxhttp from '../../src/index';
import type { 
  FLUXHTTP_CONFIG, 
  FLUXHTTP_INSTANCE, 
  FluxHttpModuleConfig 
} from './types';

/**
 * Core FluxHTTP module
 * Provides the basic FluxHTTP service without interceptors
 */
@NgModule({
  imports: [CommonModule],
  providers: [
    FluxHttpService,
    FluxHttpCacheService,
    FluxHttpLoadingService,
  ],
})
export class FluxHttpCoreModule {
  constructor(
    @Optional() @SkipSelf() parentModule: FluxHttpCoreModule
  ) {
    if (parentModule) {
      throw new Error('FluxHttpCoreModule is already loaded. Import it in the AppModule only.');
    }
  }
}

/**
 * Main FluxHTTP module for Angular applications
 * 
 * @example
 * ```typescript
 * import { NgModule } from '@angular/core';
 * import { BrowserModule } from '@angular/platform-browser';
 * import { FluxHttpModule } from '@fluxhttp/angular';
 * 
 * import { AppComponent } from './app.component';
 * 
 * @NgModule({
 *   declarations: [AppComponent],
 *   imports: [
 *     BrowserModule,
 *     FluxHttpModule.forRoot({
 *       defaultConfig: {
 *         baseURL: 'https://api.example.com',
 *         timeout: 10000,
 *       },
 *       onError: (error) => {
 *         console.error('Global HTTP Error:', error);
 *       },
 *       provideInterceptors: true,
 *       provideCacheService: true,
 *       provideLoadingState: true,
 *     }),
 *   ],
 *   providers: [],
 *   bootstrap: [AppComponent],
 * })
 * export class AppModule {}
 * ```
 */
@NgModule({
  imports: [FluxHttpCoreModule],
  exports: [FluxHttpCoreModule],
})
export class FluxHttpModule {
  /**
   * Configure FluxHTTP for the root module
   */
  static forRoot(config: FluxHttpModuleConfig = {}): ModuleWithProviders<FluxHttpModule> {
    const {
      instance,
      defaultConfig = {},
      provideInterceptors = true,
      provideErrorHandler = true,
      provideLoadingState = true,
      provideCacheService = true,
      ...restConfig
    } = config;

    const providers: any[] = [
      // Provide configuration
      {
        provide: FLUXHTTP_CONFIG,
        useValue: { ...restConfig, defaultConfig },
      },

      // Provide FluxHTTP instance
      {
        provide: FLUXHTTP_INSTANCE,
        useValue: instance || fluxhttp.create(defaultConfig),
      },
    ];

    // Conditionally provide services
    if (provideCacheService) {
      providers.push(FluxHttpCacheService);
    }

    if (provideLoadingState) {
      providers.push(FluxHttpLoadingService);
    }

    // Conditionally provide interceptors
    if (provideInterceptors) {
      providers.push(
        {
          provide: HTTP_INTERCEPTORS,
          useClass: FluxHttpRequestInterceptor,
          multi: true,
        },
        {
          provide: HTTP_INTERCEPTORS,
          useClass: FluxHttpResponseInterceptor,
          multi: true,
        }
      );

      if (provideErrorHandler) {
        providers.push({
          provide: HTTP_INTERCEPTORS,
          useClass: FluxHttpErrorInterceptor,
          multi: true,
        });
      }

      // Add retry interceptor if retry config is provided
      if (restConfig.retry) {
        providers.push({
          provide: HTTP_INTERCEPTORS,
          useClass: FluxHttpRetryInterceptor,
          multi: true,
        });
      }

      // Add cache interceptor if cache config is provided
      if (provideCacheService && restConfig.cache) {
        providers.push({
          provide: HTTP_INTERCEPTORS,
          useClass: FluxHttpCacheInterceptor,
          multi: true,
        });
      }
    }

    return {
      ngModule: FluxHttpModule,
      providers,
    };
  }

  /**
   * Configure FluxHTTP for feature modules
   */
  static forFeature(config: Partial<FluxHttpModuleConfig> = {}): ModuleWithProviders<FluxHttpModule> {
    const providers: any[] = [];

    // Only provide additional configuration for feature modules
    if (config.defaultConfig) {
      providers.push({
        provide: FLUXHTTP_CONFIG,
        useValue: config,
      });
    }

    return {
      ngModule: FluxHttpModule,
      providers,
    };
  }
}