# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Essential Commands

### Build Commands
```bash
npm run build          # Build for production (CommonJS + ESM)
npm run dev           # Build in watch mode
npm run clean         # Clean dist and coverage directories
npm run build:check   # Run typecheck and lint before building
```

### Testing Commands
```bash
npm test              # Run basic tests (tests/basic.test.js)
npm run test:unit     # Run unit tests  
npm run test:integration  # Run integration tests
npm run test:all      # Run all tests
npm run test:coverage # Run tests with coverage report using c8
npm run test:watch    # Run tests in watch mode

# Run a single test file
node --test tests/basic.test.js

# Run tests matching a pattern
node --test tests/**/*.test.js --test-name-pattern "should create instance"

# Run with coverage locally
npx c8 node --test tests/basic.test.js
```

### Code Quality Commands
```bash
npm run lint          # Run ESLint
npm run lint:fix      # Fix ESLint issues
npm run typecheck     # Run TypeScript type checking
npm run format        # Format code with Prettier
npm run size          # Check bundle sizes after building
```

### Release Commands
```bash
npm run release       # Patch release (1.0.0 -> 1.0.1)
npm run release:minor # Minor release (1.0.0 -> 1.1.0)
npm run release:major # Major release (1.0.0 -> 2.0.0)
npm run release:beta  # Beta release (1.0.0 -> 1.0.1-beta.0)
npm pack             # Create package tarball for testing
npm run pack:test    # Test package creation
```

### Security & Performance Commands
```bash
npm run security:check # Run security audit
npm run size          # Check bundle sizes (must build first)
npm run examples:all  # Run all example scripts
```

## Architecture Overview

### Core Design Principles
fluxhttp is designed as a zero-dependency HTTP client with three main architectural layers:

1. **Core Layer**: The `fluxhttp` class and instance creation logic
2. **Adapter Layer**: Platform-specific HTTP implementations (xhr, http, fetch)
3. **Interceptor Layer**: Request/response transformation pipeline

### Key Components

#### 1. fluxhttp Class (`src/core/fluxhttp.ts`)
- Central class implementing the HTTP client interface
- Manages configuration defaults and interceptors
- Routes requests through the interceptor pipeline
- Methods: `request()`, `get()`, `post()`, `put()`, `delete()`, `patch()`, `head()`, `options()`

#### 2. Adapter System (`src/adapters/`)
- **Auto-detection**: `getDefaultAdapter()` selects the appropriate adapter based on the environment
- **XHR Adapter**: For browser environments with XMLHttpRequest
- **HTTP Adapter**: For Node.js environments using native http/https modules
- **Fetch Adapter**: For modern environments with fetch API
- Each adapter converts fluxhttpRequestConfig to platform-specific requests

#### 3. Interceptor Pipeline (`src/interceptors/`)
- **InterceptorManager**: Manages request/response interceptors with insertion order
- **dispatchRequest**: Orchestrates the request flow through interceptors
- Supports synchronous and asynchronous interceptors
- Enables request/response transformation, error handling, and retry logic

#### 4. Error Handling (`src/errors/`)
- **fluxhttpError**: Custom error class with request/response context
- Error creation utilities for different error types (timeout, network, cancel)
- Maintains full error context for debugging

#### 5. Type System (`src/types/`)
- Comprehensive TypeScript interfaces for all public APIs
- Request/response configuration types
- Separate types for internal and external APIs

### Request Flow
1. User calls a method (e.g., `fluxhttp.get()`)
2. Configuration is merged with defaults
3. Request passes through request interceptors
4. Appropriate adapter is selected and invoked
5. Response passes through response interceptors
6. Final response or error is returned to user

### Security Features (`src/core/security.ts`)
- Built-in SecurityManager with configurable policies
- CSRF token management
- Rate limiting
- Content validation
- Security headers injection
- Request/response validation

### Caching System (`src/core/cache.ts`)
- CacheManager with multiple storage backends
- Memory, LocalStorage, SessionStorage, and CacheAPI support
- Request/response caching interceptors
- Cache invalidation strategies

### Retry System (`src/core/retry.ts`)
- Exponential backoff strategy
- Configurable retry conditions
- Integration with interceptor pipeline
- Respects Retry-After headers

### Build Configuration
- **tsup**: Modern bundler for TypeScript (tsup.config.ts)
- Dual build output: CommonJS (.js) and ESM (.mjs)
- TypeScript declarations generated for both formats
- Source maps included for debugging
- Minified output with tree-shaking
- Platform: neutral, with Node.js built-ins externalized

### Testing Strategy
- **Node.js Test Runner**: Built-in test runner (no external dependencies)
- **c8**: Coverage reporting tool
- Test files: TypeScript tests in tests/unit and tests/integration
- Basic test entry: tests/basic.test.js
- Mock adapters for testing without network calls
- Cross-platform testing for browser/Node.js compatibility

### Package Structure
```
@fluxhttp/core
├── dist/
│   ├── index.js      # CommonJS entry
│   ├── index.mjs     # ESM entry
│   ├── index.d.ts    # TypeScript declarations
│   └── *.map         # Source maps
├── src/
│   ├── adapters/     # Platform-specific implementations
│   ├── core/         # Core classes and utilities
│   ├── errors/       # Error handling
│   ├── interceptors/ # Request/response pipeline
│   ├── security/     # Security modules
│   ├── types/        # TypeScript definitions
│   └── utils/        # Shared utilities
└── tests/
    ├── unit/         # Unit tests
    ├── integration/  # Integration tests
    └── basic.test.js # Basic test entry point
```

### Critical Files
- `src/index.ts`: Main entry point and exports
- `src/core/createfluxhttpinstance.ts`: Factory function for creating instances (lowercase naming)
- `src/core/fluxhttp.ts`: Main fluxhttp class implementation
- `src/interceptors/dispatchRequest.ts`: Core request dispatching logic
- `src/adapters/index.ts`: Adapter selection logic

### Development Workflow
1. Make changes in `src/`
2. Run `npm run dev` for watch mode
3. Write/update tests in `tests/`
4. Run `npm run test:watch` for test feedback
5. Ensure `npm run typecheck` passes
6. Run `npm run lint:fix` to fix style issues
7. Build with `npm run build` before committing

### Important Notes
- **File naming**: Core files use lowercase (e.g., `fluxhttp.ts`, `createfluxhttpinstance.ts`, `canceltoken.ts`)
- **Zero dependencies**: This package has NO production dependencies
- **Bundle limits**: 16KB for CommonJS, 12KB for ESM (enforced by size-limit)
- **Security**: Built-in security features via SecurityManager
- **Type exports**: All types are exported from src/types/index.ts