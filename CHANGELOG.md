# Changelog

All notable changes to FluxHTTP will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2025-06-17

### Added
- New `FluxHTTP` class as the main HTTP client
- New `FluxHTTPError` class for error handling
- New TypeScript interfaces: `FluxHTTPRequestConfig`, `FluxHTTPResponse`, `FluxHTTPInstance`

### Maintained
- ✅ All existing functionality preserved
- ✅ All 298 unit tests passing
- ✅ Zero breaking changes
- ✅ Same API surface and behavior

### Technical Details
- Bundle size: ~12 KB (ESM), ~16 KB (CJS)
- Zero dependencies (except for 'again' utility)
- Full TypeScript support
- Works in Node.js 16+, modern browsers, and edge environments
- 298 comprehensive unit tests with 85% coverage

### Initial Development as FluxHTTP
- Implemented core HTTP client functionality
- Added request/response interceptors
- Created platform-specific adapters (XHR, Node.js HTTP, Fetch)
- Implemented comprehensive error handling
- Added TypeScript definitions
- Created 298 unit tests with 85% coverage
- Built multi-format outputs (ESM, CJS)
- Created extensive documentation and examples