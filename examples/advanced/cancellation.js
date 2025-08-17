#!/usr/bin/env node

/**
 * @fileoverview Request cancellation examples demonstrating different cancellation patterns
 * @description Shows how to cancel requests using CancelToken and various cancellation strategies
 */

const fluxhttp = require('../../dist/index.js').default;
const { CancelToken } = require('../../dist/index.js');

console.log('🚫 FluxHTTP Advanced Request Cancellation Examples\n');

/**
 * Example 1: Basic request cancellation with CancelToken
 */
async function basicCancellation() {
  console.log('📋 Example 1: Basic request cancellation with CancelToken');
  
  const source = CancelToken.source();
  
  // Start a long-running request
  const requestPromise = fluxhttp.get('https://httpbin.org/delay/5', {
    cancelToken: source.token
  });
  
  // Cancel the request after 2 seconds
  setTimeout(() => {
    console.log('⏰ Cancelling request after 2 seconds...');
    source.cancel('Request cancelled by user');
  }, 2000);
  
  try {
    const response = await requestPromise;
    console.log('✅ Request completed:', response.status);
  } catch (error) {
    if (fluxhttp.isCancel(error)) {
      console.log('🚫 Request was cancelled:', error.message);
    } else {
      console.error('❌ Other error:', error.message);
    }
  }
  console.log();
}

/**
 * Example 2: User-initiated cancellation simulation
 */
async function userInitiatedCancellation() {
  console.log('📋 Example 2: User-initiated cancellation simulation');
  
  const source = CancelToken.source();
  let requestCompleted = false;
  
  // Simulate user clicking "cancel" button
  const simulateUserCancel = () => {
    setTimeout(() => {
      if (!requestCompleted) {
        console.log('👤 User clicked cancel button');
        source.cancel('User cancelled the operation');
      }
    }, 1500);
  };
  
  // Start the request
  console.log('📡 Starting file download simulation...');
  simulateUserCancel();
  
  try {
    const response = await fluxhttp.get('https://httpbin.org/delay/3', {
      cancelToken: source.token
    });
    
    requestCompleted = true;
    console.log('✅ Download completed successfully');
    console.log('📄 Response size:', JSON.stringify(response.data).length, 'bytes');
  } catch (error) {
    if (fluxhttp.isCancel(error)) {
      console.log('🚫 Download cancelled by user');
      console.log('💾 Cleaning up partial download...');
    } else {
      console.error('❌ Download failed:', error.message);
    }
  }
  console.log();
}

/**
 * Example 3: Timeout-based cancellation
 */
async function timeoutBasedCancellation() {
  console.log('📋 Example 3: Timeout-based cancellation');
  
  const source = CancelToken.source();
  const timeoutMs = 3000; // 3 seconds
  
  // Set up automatic cancellation after timeout
  const timeoutId = setTimeout(() => {
    console.log(`⏰ Request timed out after ${timeoutMs}ms`);
    source.cancel('Request timed out');
  }, timeoutMs);
  
  try {
    console.log(`📡 Starting request with ${timeoutMs}ms timeout...`);
    const response = await fluxhttp.get('https://httpbin.org/delay/5', {
      cancelToken: source.token
    });
    
    // Clear timeout if request completes in time
    clearTimeout(timeoutId);
    console.log('✅ Request completed within timeout');
  } catch (error) {
    clearTimeout(timeoutId);
    
    if (fluxhttp.isCancel(error)) {
      console.log('🚫 Request cancelled due to timeout');
    } else {
      console.error('❌ Request failed:', error.message);
    }
  }
  console.log();
}

/**
 * Example 4: Race condition handling with cancellation
 */
async function raceConditionCancellation() {
  console.log('📋 Example 4: Race condition handling with cancellation');
  
  const sources = [
    CancelToken.source(),
    CancelToken.source(),
    CancelToken.source()
  ];
  
  const requests = [
    fluxhttp.get('https://httpbin.org/delay/1', { cancelToken: sources[0].token }),
    fluxhttp.get('https://httpbin.org/delay/2', { cancelToken: sources[1].token }),
    fluxhttp.get('https://httpbin.org/delay/3', { cancelToken: sources[2].token })
  ];
  
  try {
    console.log('🏁 Starting race between 3 requests...');
    
    // Use Promise.race to get the first successful response
    const firstResponse = await Promise.race(
      requests.map(async (request, index) => {
        try {
          const response = await request;
          return { index, response, success: true };
        } catch (error) {
          if (!fluxhttp.isCancel(error)) {
            throw error;
          }
          return { index, error, success: false };
        }
      })
    );
    
    if (firstResponse.success) {
      console.log(`🏆 Request ${firstResponse.index + 1} won the race!`);
      
      // Cancel the remaining requests
      sources.forEach((source, index) => {
        if (index !== firstResponse.index) {
          console.log(`🚫 Cancelling slower request ${index + 1}`);
          source.cancel('Faster request completed');
        }
      });
      
      console.log('📄 Winner response status:', firstResponse.response.status);
    }
  } catch (error) {
    console.error('❌ All requests failed:', error.message);
    
    // Cancel any remaining requests
    sources.forEach(source => source.cancel('Race failed'));
  }
  console.log();
}

/**
 * Example 5: Conditional cancellation based on response
 */
async function conditionalCancellation() {
  console.log('📋 Example 5: Conditional cancellation based on response');
  
  const sources = [
    CancelToken.source(),
    CancelToken.source()
  ];
  
  // Request 1: Check server status
  const statusCheck = fluxhttp.get('https://httpbin.org/status/200', {
    cancelToken: sources[0].token
  });
  
  // Request 2: Long-running data fetch
  const dataFetch = fluxhttp.get('https://httpbin.org/delay/4', {
    cancelToken: sources[1].token
  });
  
  try {
    console.log('📡 Checking server status before starting main request...');
    
    const statusResponse = await statusCheck;
    console.log('✅ Server status check passed:', statusResponse.status);
    
    console.log('📡 Server is healthy, proceeding with data fetch...');
    
    // Simulate condition that might require cancellation
    setTimeout(() => {
      console.log('⚠️  Business logic requires cancellation');
      sources[1].cancel('Business logic condition met');
    }, 2000);
    
    const dataResponse = await dataFetch;
    console.log('✅ Data fetch completed:', dataResponse.status);
  } catch (error) {
    if (fluxhttp.isCancel(error)) {
      console.log('🚫 Request cancelled based on business logic');
    } else {
      console.error('❌ Request failed:', error.message);
      
      // Cancel any pending requests on error
      sources.forEach(source => source.cancel('Error occurred'));
    }
  }
  console.log();
}

/**
 * Example 6: Cancellation with cleanup operations
 */
async function cancellationWithCleanup() {
  console.log('📋 Example 6: Cancellation with cleanup operations');
  
  const source = CancelToken.source();
  const resources = {
    fileHandle: null,
    tempData: new Set(),
    connections: []
  };
  
  // Set up cleanup on cancellation
  source.token.promise.then(cancel => {
    console.log('🧹 Performing cleanup operations...');
    console.log(`   Reason: ${cancel.message}`);
    console.log('   Closing file handles...');
    console.log('   Clearing temporary data...');
    console.log('   Releasing connections...');
    
    // Simulate cleanup
    resources.tempData.clear();
    resources.connections.length = 0;
    
    console.log('✅ Cleanup completed');
  });
  
  try {
    console.log('📡 Starting resource-intensive operation...');
    
    // Simulate resource allocation
    resources.tempData.add('temp1');
    resources.tempData.add('temp2');
    resources.connections.push('conn1', 'conn2');
    
    // Cancel after 2 seconds
    setTimeout(() => {
      console.log('💾 Cancelling operation to preserve resources');
      source.cancel('Resource conservation');
    }, 2000);
    
    const response = await fluxhttp.get('https://httpbin.org/delay/5', {
      cancelToken: source.token
    });
    
    console.log('✅ Operation completed successfully');
  } catch (error) {
    if (fluxhttp.isCancel(error)) {
      console.log('🚫 Operation cancelled, cleanup triggered');
    } else {
      console.error('❌ Operation failed:', error.message);
    }
  }
  console.log();
}

/**
 * Example 7: Multiple request cancellation patterns
 */
async function multipleRequestCancellation() {
  console.log('📋 Example 7: Multiple request cancellation patterns');
  
  // Global cancellation token for all requests
  const globalSource = CancelToken.source();
  
  // Individual cancellation tokens for specific requests
  const individualSources = [
    CancelToken.source(),
    CancelToken.source(),
    CancelToken.source()
  ];
  
  const requests = individualSources.map((source, index) => {
    // Combine global and individual cancellation
    const combinedToken = CancelToken.source();
    
    // Cancel if either global or individual token is cancelled
    globalSource.token.promise.then(cancel => {
      combinedToken.cancel(`Global: ${cancel.message}`);
    });
    
    source.token.promise.then(cancel => {
      combinedToken.cancel(`Individual ${index + 1}: ${cancel.message}`);
    });
    
    return fluxhttp.get(`https://httpbin.org/delay/${index + 2}`, {
      cancelToken: combinedToken.token
    }).then(response => ({
      index: index + 1,
      status: response.status,
      success: true
    })).catch(error => {
      if (fluxhttp.isCancel(error)) {
        return {
          index: index + 1,
          message: error.message,
          success: false,
          cancelled: true
        };
      }
      throw error;
    });
  });
  
  // Cancel individual request after 1.5 seconds
  setTimeout(() => {
    console.log('🚫 Cancelling request 2 individually');
    individualSources[1].cancel('Individual timeout');
  }, 1500);
  
  // Cancel all remaining requests after 3 seconds
  setTimeout(() => {
    console.log('🚫 Global cancellation triggered');
    globalSource.cancel('Global shutdown');
  }, 3000);
  
  try {
    console.log('📡 Starting multiple requests with different cancellation strategies...');
    
    const results = await Promise.all(requests);
    
    console.log('📊 Results summary:');
    results.forEach(result => {
      if (result.success) {
        console.log(`✅ Request ${result.index}: Completed (${result.status})`);
      } else if (result.cancelled) {
        console.log(`🚫 Request ${result.index}: Cancelled (${result.message})`);
      } else {
        console.log(`❌ Request ${result.index}: Failed`);
      }
    });
  } catch (error) {
    console.error('❌ Unexpected error:', error.message);
  }
  console.log();
}

/**
 * Run all examples
 */
async function runAllExamples() {
  console.log('🚀 Running all cancellation examples...\n');
  
  await basicCancellation();
  await userInitiatedCancellation();
  await timeoutBasedCancellation();
  await raceConditionCancellation();
  await conditionalCancellation();
  await cancellationWithCleanup();
  await multipleRequestCancellation();
  
  console.log('✨ All cancellation examples completed!');
}

// Run examples if this file is executed directly
if (require.main === module) {
  runAllExamples().catch(error => {
    console.error('💥 Fatal error:', error);
    process.exit(1);
  });
}

module.exports = {
  basicCancellation,
  userInitiatedCancellation,
  timeoutBasedCancellation,
  raceConditionCancellation,
  conditionalCancellation,
  cancellationWithCleanup,
  multipleRequestCancellation,
  runAllExamples
};