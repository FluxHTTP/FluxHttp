# FluxHTTP Integration Tests

This directory contains comprehensive integration tests for FluxHTTP that test against real HTTP endpoints. These tests verify that FluxHTTP works correctly with actual network requests and responses.

## Test Files

### `basic-real.test.js` ✅ WORKING
A reliable, comprehensive test suite covering core functionality:
- **Core HTTP Methods**: GET, POST, PUT, DELETE, PATCH
- **Query Parameters**: Simple and array parameters
- **Headers**: Custom header handling
- **Response Handling**: JSON, XML, HTML responses
- **Error Handling**: 404, 500, timeout errors
- **Interceptors**: Request and response interceptors
- **Concurrent Requests**: Multiple parallel requests
- **Authentication**: Basic auth success/failure
- **Large Data**: JSON payloads and text uploads

**Status**: All tests passing (30+ test cases)

### `http-methods.test.js` ⚠️ NEEDS FIXES
Comprehensive test of all HTTP methods against httpbin.org:
- All HTTP methods with various data types
- Query parameter handling
- Custom headers
- Authentication scenarios
- Edge cases and robustness testing

**Status**: Partially working, needs JSON parsing fixes

### `interceptors-real.test.js` ⚠️ NEEDS FIXES  
Tests interceptor functionality with real network scenarios:
- Request interceptors (auth, URL modification, data transformation)
- Response interceptors (data transformation, caching, validation)
- Error handling interceptors
- Chained interceptors
- Real-world scenarios (logging, rate limiting, caching)

**Status**: Updated with JSON parsing helper, needs verification

### `error-scenarios.test.js` ⚠️ NEEDS FIXES
Tests error handling and edge cases:
- HTTP error status codes (400, 401, 403, 404, 500, etc.)
- Timeout scenarios
- Network errors
- SSL/TLS errors
- Request cancellation
- Error context and debugging

**Status**: Updated with JSON parsing helper, needs verification

### `performance-real.test.js` ⚠️ NEEDS FIXES
Tests performance characteristics:
- Request latency and throughput
- Data transfer performance
- Memory efficiency
- Caching and optimization
- Stress testing
- Resource cleanup

**Status**: Updated with JSON parsing helper, needs verification

### `concurrent-requests.test.js` ⚠️ NEEDS FIXES
Tests parallel request handling:
- Basic concurrent requests
- High-volume concurrent requests
- Error handling in concurrent scenarios
- Request cancellation
- Resource management
- Real-world concurrent scenarios

**Status**: Updated with JSON parsing helper, needs verification

### `large-payloads.test.js` ⚠️ NEEDS FIXES
Tests large data handling:
- Large upload payloads (text, JSON, binary)
- Large download responses
- Memory efficiency
- Progress tracking
- Streaming and chunked transfer
- Performance optimization

**Status**: Updated with JSON parsing helper, needs verification

## Test Infrastructure

### JSON Response Parsing Helper
All test files include a `parseResponseData()` helper function that handles the difference between Node.js HTTP adapter (returns strings) and browser fetch adapter (auto-parses JSON):

```javascript
function parseResponseData(data) {
  if (typeof data === 'string') {
    try {
      return JSON.parse(data);
    } catch {
      return data;
    }
  }
  return data;
}
```

### Test Endpoints
Tests primarily use [httpbin.org](https://httpbin.org) which provides:
- `/get` - Returns GET request data
- `/post` - Returns POST request data  
- `/put`, `/patch`, `/delete` - Return respective method data
- `/json` - Returns sample JSON
- `/status/{code}` - Returns specified HTTP status
- `/delay/{seconds}` - Introduces delay
- `/basic-auth/{user}/{pass}` - Basic authentication
- `/bearer` - Bearer token authentication
- And many more endpoints for testing

### Running Integration Tests

```bash
# Run all integration tests
npm run test:integration

# Run a specific test file
node --test tests/integration/basic-real.test.js --test-timeout=20000

# Run with custom timeout
node --test tests/integration/basic-real.test.js --test-timeout=30000

# Run specific test by name pattern
node --test tests/integration/basic-real.test.js --test-name-pattern "should handle GET"
```

### Test Configuration
- **Timeout**: Most tests use 10-30 second timeouts to account for network conditions
- **Base URL**: `https://httpbin.org`
- **User Agent**: Each test file uses a specific user agent for identification
- **Error Handling**: Tests are designed to be resilient to network issues

## Network Considerations

These integration tests make real network requests and may be affected by:
- Network connectivity issues
- httpbin.org availability
- Firewall restrictions
- Rate limiting
- Network latency

For CI/CD environments, consider:
- Running tests in parallel carefully to avoid rate limits
- Using mock servers for more predictable testing
- Having fallback endpoints if httpbin.org is unavailable
- Implementing retry logic for flaky network conditions

## Maintenance

When updating these tests:
1. Always use the `parseResponseData()` helper for JSON responses
2. Include proper error handling for network issues
3. Use appropriate timeouts for network operations
4. Test both success and failure scenarios
5. Verify tests work in different network conditions
6. Keep tests focused and atomic

## Recommendations

For the most reliable integration testing:
1. **Start with `basic-real.test.js`** - it's proven to work and covers core functionality
2. **Fix the other test files gradually** by addressing specific JSON parsing issues
3. **Consider using a local mock server** for more predictable testing in CI/CD
4. **Add retry logic** for tests that might be affected by network conditions
5. **Monitor test reliability** and adjust timeouts as needed