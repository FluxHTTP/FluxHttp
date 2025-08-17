# Changelog

All notable changes to @fluxhttp/core will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Known Issues
- Project is in alpha stage and not production-ready
- Many features are under development
- Test coverage needs improvement
- Documentation is being updated for accuracy

## [0.1.0-alpha] - 2025-08-17

### Added
- Basic HTTP client implementation with GET, POST, PUT, DELETE, PATCH, HEAD, OPTIONS methods
- Request/response interceptor system
- Platform-specific adapters (XHR, Node.js HTTP, Fetch)
- Basic error handling with fluxhttpError class
- TypeScript definitions
- Request cancellation support via AbortController
- Basic timeout functionality
- JSON request/response transformation

### In Development ⚠️
- **Security Features**: SecurityManager with CSRF protection, rate limiting, and content validation
- **Retry System**: Automatic retry with exponential backoff
- **Progress Tracking**: Upload/download progress events
- **Response Caching**: Intelligent cache management
- **Performance Optimizations**: Connection pooling and request deduplication

### Changed
- Updated project documentation to reflect alpha status
- Corrected false claims about test coverage and feature completeness
- Updated all import examples to use '@fluxhttp/core'
- Added appropriate disclaimers for unimplemented features

### Fixed
- Documentation accuracy regarding project status
- Package name consistency throughout documentation
- Removed misleading badges and external service references

### Technical Status
- Bundle target: ~12KB ESM / ~16KB CJS
- Zero runtime dependencies
- TypeScript support with strict mode
- Cross-platform compatibility (Node.js 16+, modern browsers)

### Alpha Limitations
- Limited test coverage (under development)
- Many advanced features not yet implemented
- Documentation being updated for accuracy
- Not recommended for production use

### Development Focus
- Core HTTP functionality
- Basic interceptor system
- Cross-platform adapter selection
- TypeScript integration
- Build system optimization