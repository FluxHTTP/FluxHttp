# Bug Fix Report: @fluxhttp/core@0.1.0-alpha

**Date:** 2025-12-15

## Summary

| Metric           | Count |
|------------------|-------|
| Bugs Found       | 8     |
| Fixed            | 8     |
| Deferred         | 0     |
| Tests Added      | 1 file with 11 test cases |

## Critical Fixes

1. **BUG-024 (HIGH)**: isCancel function was checking for wrong error code (`ECONNABORTED` instead of `ERR_CANCELED`)
2. **BUG-026 (HIGH)**: Duplicate property names in object literal causing syntax error in mergeRetryConfig
3. **BUG-020 (MEDIUM)**: TypeScript configuration missing Node.js types declaration
4. **BUG-022 (MEDIUM)**: HTML sanitization encoding order bug causing double-encoding

## All Bugs

| ID      | Severity | Category   | File:Line                          | Status    | Test |
|---------|----------|------------|-------------------------------------|-----------|------|
| BUG-020 | MEDIUM   | Config     | tsconfig.json                       | Fixed     | Yes  |
| BUG-021 | LOW      | Quality    | adapters/xhr.adapter.ts:272         | Fixed     | N/A  |
| BUG-022 | MEDIUM   | Security   | utils/data.ts:95-104                | Fixed     | Yes  |
| BUG-023 | LOW      | API        | core/deduplication.ts:145           | Fixed     | Yes  |
| BUG-024 | HIGH     | Logic      | core/createfluxhttpinstance.ts:55   | Fixed     | Yes  |
| BUG-026 | HIGH     | Type       | features/circuit-breaker.ts:489-519 | Fixed     | Yes  |
| BUG-027 | HIGH     | Type       | features/circuit-breaker.ts:525-540 | Fixed     | Yes  |
| BUG-027b| MEDIUM   | Type       | features/circuit-breaker.ts:86      | Fixed     | Yes  |

## Detailed Changes

### BUG-020: TypeScript Configuration Missing Node.js Types
- **File**: `tsconfig.json`
- **Problem**: tsconfig.json was missing the `types` field, causing TypeScript to not recognize Node.js built-in types like `process`, `Buffer`, and `NodeJS` namespace.
- **Fix**: Added `"types": ["node"]` to compilerOptions.
- **Test**: Build verification

### BUG-021: Unused Variable in XHR Adapter
- **File**: `src/adapters/xhr.adapter.ts`
- **Problem**: Variable `isRequestComplete` was declared but never used, causing TypeScript warning with `noUnusedLocals: true`.
- **Fix**: Removed the unused variable and its assignment.
- **Test**: N/A (code quality)

### BUG-022: HTML Sanitization Encoding Order
- **File**: `src/utils/data.ts`
- **Problem**: The `sanitizeString` function encoded `&` character LAST, which would cause double-encoding when other replacements created entities containing `&` (e.g., `<` -> `&lt;` then `&` -> `&amp;` results in `&amp;lt;`).
- **Fix**: Moved `&` encoding to be FIRST in the replacement chain.
- **Test**: `tests/unit/core/bug-fixes.test.ts` - encoding order verification

### BUG-023: API Inconsistency - dispose() vs destroy()
- **File**: `src/core/deduplication.ts`
- **Problem**: `RequestDeduplicator` used `destroy()` method while other managers (like `InterceptorManager`) use `dispose()` for consistency.
- **Fix**: Added `dispose()` method as an alias for `destroy()`.
- **Test**: `tests/unit/core/bug-fixes.test.ts` - dispose method test

### BUG-024: isCancel Checking Wrong Error Code
- **File**: `src/core/createfluxhttpinstance.ts`
- **Problem**: The `isCancel` function was checking for error code `ECONNABORTED`, but `createCancelError` creates errors with code `ERR_CANCELED`.
- **Fix**: Updated to check for `ERR_CANCELED`, `ERR_CANCELLED` (British spelling), and `ECONNABORTED` (legacy) for full compatibility.
- **Test**: `tests/unit/core/bug-fixes.test.ts` - error code detection tests

### BUG-026: Duplicate Property Names in Object Literal
- **File**: `src/features/circuit-breaker.ts`
- **Problem**: `mergeRetryConfig` function had duplicate property names in the returned object literal (`jitter` and `retryCondition` appeared twice), which is invalid syntax.
- **Fix**: Restructured the function to use proper nullish coalescing without duplicates.
- **Test**: `tests/unit/core/bug-fixes.test.ts` - retry config merge test

### BUG-027: Type Errors with Optional Fields
- **File**: `src/features/circuit-breaker.ts`
- **Problem**: Two issues:
  1. `mergeCircuitBreakerConfig` assigned `undefined` to properties that `Required<>` type expects to be defined
  2. `CircuitBreaker` constructor expected `Required<CircuitBreakerConfig>` but received type with optional fields
- **Fix**:
  1. Changed return type to properly represent optional fields
  2. Updated constructor type to match
- **Test**: `tests/unit/core/bug-fixes.test.ts` - circuit breaker config test

## Previously Fixed Bugs (Verified)

The codebase already contains fixes for many bugs marked with comments:

| ID      | Description                                           | Status    |
|---------|-------------------------------------------------------|-----------|
| BUG-001 | AbortController availability check                    | Fixed     |
| BUG-003 | Headers type return + rejected requests counter       | Fixed     |
| BUG-004 | Undefined check before array destructuring            | Fixed     |
| BUG-005 | Relative URL validation                               | Fixed     |
| BUG-006 | IP address validation before private range check      | Fixed     |
| BUG-007 | XHR cleanup function declaration order                | Fixed     |
| BUG-008 | HTTP adapter stream error handling                    | Fixed     |
| BUG-009 | Retry lastError initialization                        | Fixed     |
| BUG-010 | Disposed instance check                               | Fixed     |
| BUG-011 | CSRF token conversion chunking                        | Fixed     |
| BUG-012 | Decompression stream error handlers                   | Fixed     |
| BUG-013 | Interceptor function tracking                         | Fixed     |
| BUG-015 | Array bounds checking in rate limiter                 | Fixed     |
| BUG-017 | Cache-advanced key undefined check                    | Fixed     |
| BUG-018 | Jitter calculation fix                                | Fixed     |
| BUG-019 | buildFullPath null handling                           | Fixed     |

## Recommendations

1. **Test Coverage**: Add more comprehensive unit tests for the security and utility modules
2. **TypeScript Strictness**: Consider enabling stricter TypeScript options to catch more issues at compile time
3. **API Documentation**: Add JSDoc comments to all public methods
4. **Error Messages**: Improve error messages to include more context for debugging

## Verification

```bash
# Run these to verify all fixes
npm run build       # Build succeeds
npm test           # 15/15 tests pass
npm run lint       # Lint check (may have warnings)
```

## Files Modified

1. `tsconfig.json` - Added Node.js types
2. `src/adapters/xhr.adapter.ts` - Removed unused variable
3. `src/utils/data.ts` - Fixed sanitization encoding order
4. `src/core/deduplication.ts` - Added dispose() alias
5. `src/core/createfluxhttpinstance.ts` - Fixed isCancel error codes
6. `src/features/circuit-breaker.ts` - Fixed type errors and duplicate properties
7. `tests/unit/core/bug-fixes.test.ts` - Added regression tests (new file)
