#!/usr/bin/env node

/**
 * @fileoverview Advanced retry logic examples demonstrating different retry strategies
 * @description Shows how to implement retry logic for failed requests with various backoff strategies
 */

const { create } = require('../../dist/index.js');

console.log('🔄 FluxHTTP Advanced Retry Logic Examples\n');

/**
 * Example 1: Basic exponential backoff retry
 */
async function basicExponentialRetry() {
  console.log('📋 Example 1: Basic exponential backoff retry');
  
  async function requestWithExponentialRetry(url, maxRetries = 3) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`📡 Attempt ${attempt}/${maxRetries}: ${url}`);
        const response = await create().get(url, { timeout: 3000 });
        console.log(`✅ Success on attempt ${attempt}`);
        return response;
      } catch (error) {
        console.log(`⚠️  Attempt ${attempt} failed: ${error.message}`);
        
        if (attempt === maxRetries) {
          console.error(`❌ All ${maxRetries} attempts failed`);
          throw error;
        }
        
        // Exponential backoff: 1s, 2s, 4s...
        const delay = Math.pow(2, attempt - 1) * 1000;
        console.log(`⏱️  Waiting ${delay}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  try {
    // This will sometimes succeed, sometimes fail
    await requestWithExponentialRetry('https://httpbin.org/status/500');
  } catch (error) {
    console.log('💥 Final failure after all retries');
  }
  console.log();
}

/**
 * Example 2: Conditional retry based on error type
 */
async function conditionalRetry() {
  console.log('📋 Example 2: Conditional retry based on error type');
  
  async function requestWithConditionalRetry(url, options = {}) {
    const maxRetries = options.maxRetries || 3;
    const retryableStatusCodes = options.retryableStatusCodes || [500, 502, 503, 504, 429];
    const retryableErrors = options.retryableErrors || ['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND'];
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`📡 Attempt ${attempt}/${maxRetries}`);
        const response = await create().get(url, { timeout: 2000 });
        console.log(`✅ Success on attempt ${attempt}`);
        return response;
      } catch (error) {
        const shouldRetry = (
          attempt < maxRetries && (
            // HTTP error codes that should be retried
            (error.response && retryableStatusCodes.includes(error.response.status)) ||
            // Network errors that should be retried
            (error.code && retryableErrors.includes(error.code))
          )
        );
        
        if (shouldRetry) {
          console.log(`⚠️  Retryable error on attempt ${attempt}: ${error.message}`);
          if (error.response) {
            console.log(`📊 Status: ${error.response.status} ${error.response.statusText}`);
          }
          
          const delay = Math.min(1000 * Math.pow(1.5, attempt - 1), 10000); // Cap at 10s
          console.log(`⏱️  Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          console.log(`🚫 Non-retryable error on attempt ${attempt}: ${error.message}`);
          throw error;
        }
      }
    }
  }
  
  const testCases = [
    { url: 'https://httpbin.org/status/500', description: 'Server Error (retryable)' },
    { url: 'https://httpbin.org/status/404', description: 'Not Found (non-retryable)' },
    { url: 'https://httpbin.org/status/429', description: 'Rate Limited (retryable)' }
  ];
  
  for (const testCase of testCases) {
    console.log(`🧪 Testing ${testCase.description}:`);
    try {
      await requestWithConditionalRetry(testCase.url);
    } catch (error) {
      console.log(`❌ Final result: ${error.message}`);
    }
    console.log();
  }
}

/**
 * Example 3: Retry with jitter to avoid thundering herd
 */
async function retryWithJitter() {
  console.log('📋 Example 3: Retry with jitter to avoid thundering herd');
  
  async function requestWithJitter(url, maxRetries = 3) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`📡 Attempt ${attempt}/${maxRetries}`);
        const response = await create().get(url);
        console.log(`✅ Success on attempt ${attempt}`);
        return response;
      } catch (error) {
        if (attempt === maxRetries) {
          throw error;
        }
        
        // Base delay with exponential backoff
        const baseDelay = Math.pow(2, attempt - 1) * 1000;
        
        // Add random jitter (±25% of base delay)
        const jitter = (Math.random() - 0.5) * 0.5 * baseDelay;
        const totalDelay = Math.max(500, baseDelay + jitter);
        
        console.log(`⚠️  Attempt ${attempt} failed: ${error.message}`);
        console.log(`⏱️  Waiting ${Math.round(totalDelay)}ms (base: ${baseDelay}ms + jitter: ${Math.round(jitter)}ms)`);
        
        await new Promise(resolve => setTimeout(resolve, totalDelay));
      }
    }
  }
  
  // Simulate multiple clients retrying simultaneously
  console.log('🌩️  Simulating multiple clients with jittered retries:');
  
  const clients = Array.from({ length: 3 }, (_, i) => ({
    id: i + 1,
    request: requestWithJitter('https://httpbin.org/status/500')
      .then(() => console.log(`✅ Client ${i + 1} succeeded`))
      .catch(() => console.log(`❌ Client ${i + 1} failed`))
  }));
  
  await Promise.allSettled(clients.map(client => client.request));
  console.log();
}

/**
 * Example 4: Retry with Retry-After header respect
 */
async function retryWithRetryAfter() {
  console.log('📋 Example 4: Retry with Retry-After header respect');
  
  async function requestWithRetryAfter(url, maxRetries = 3) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`📡 Attempt ${attempt}/${maxRetries}`);
        const response = await create().get(url);
        console.log(`✅ Success on attempt ${attempt}`);
        return response;
      } catch (error) {
        if (attempt === maxRetries) {
          throw error;
        }
        
        let delay = Math.pow(2, attempt - 1) * 1000; // Default exponential backoff
        
        // Check for Retry-After header
        if (error.response && error.response.headers['retry-after']) {
          const retryAfter = error.response.headers['retry-after'];
          
          // Handle both seconds and HTTP date format
          if (/^\\d+$/.test(retryAfter)) {
            // Seconds format
            delay = parseInt(retryAfter, 10) * 1000;
            console.log(`⏰ Server requested ${retryAfter}s delay via Retry-After header`);
          } else {
            // HTTP date format
            const retryDate = new Date(retryAfter);
            const now = new Date();
            delay = Math.max(0, retryDate.getTime() - now.getTime());
            console.log(`⏰ Server requested delay until ${retryAfter}`);
          }
        }
        
        console.log(`⚠️  Attempt ${attempt} failed: ${error.message}`);
        console.log(`⏱️  Waiting ${delay}ms before retry...`);
        
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  try {
    // Note: httpbin.org doesn't actually send Retry-After headers for 429,
    // but this demonstrates how to handle them
    await requestWithRetryAfter('https://httpbin.org/status/429');
  } catch (error) {
    console.log('❌ Request failed after respecting server timing');
  }
  console.log();
}

/**
 * Example 5: Circuit breaker pattern with retry
 */
async function circuitBreakerRetry() {
  console.log('📋 Example 5: Circuit breaker pattern with retry');
  
  class CircuitBreaker {
    constructor(options = {}) {
      this.failureThreshold = options.failureThreshold || 5;
      this.resetTimeout = options.resetTimeout || 60000; // 1 minute
      this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
      this.failureCount = 0;
      this.lastFailureTime = null;
    }
    
    async execute(operation) {
      if (this.state === 'OPEN') {
        if (Date.now() - this.lastFailureTime > this.resetTimeout) {
          console.log('🔄 Circuit breaker transitioning to HALF_OPEN');
          this.state = 'HALF_OPEN';
        } else {
          throw new Error('Circuit breaker is OPEN');
        }
      }
      
      try {
        const result = await operation();
        this.onSuccess();
        return result;
      } catch (error) {
        this.onFailure();
        throw error;
      }
    }
    
    onSuccess() {
      console.log('✅ Circuit breaker: Operation succeeded');
      this.failureCount = 0;
      this.state = 'CLOSED';
    }
    
    onFailure() {
      this.failureCount++;
      this.lastFailureTime = Date.now();
      
      console.log(`⚠️  Circuit breaker: Failure ${this.failureCount}/${this.failureThreshold}`);
      
      if (this.failureCount >= this.failureThreshold) {
        console.log('🚫 Circuit breaker is now OPEN');
        this.state = 'OPEN';
      }
    }
  }
  
  const breaker = new CircuitBreaker({ failureThreshold: 3, resetTimeout: 5000 });
  
  async function resilientRequest(url) {
    return breaker.execute(() => create().get(url, { timeout: 2000 }));
  }
  
  // Simulate multiple failing requests
  for (let i = 1; i <= 6; i++) {
    try {
      console.log(`📡 Request ${i}:`);
      await resilientRequest('https://httpbin.org/status/500');
    } catch (error) {
      console.log(`❌ Request ${i} failed: ${error.message}`);
    }
    
    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  // Wait for reset and try again
  console.log('⏱️  Waiting for circuit breaker reset...');
  await new Promise(resolve => setTimeout(resolve, 5500));
  
  try {
    console.log('📡 Trying after reset:');
    await resilientRequest('https://httpbin.org/status/200');
  } catch (error) {
    console.log('❌ Post-reset request failed:', error.message);
  }
  console.log();
}

/**
 * Example 6: Adaptive retry based on success rate
 */
async function adaptiveRetry() {
  console.log('📋 Example 6: Adaptive retry based on success rate');
  
  class AdaptiveRetryStrategy {
    constructor() {
      this.recentRequests = [];
      this.maxHistory = 10;
    }
    
    recordResult(success, duration) {
      this.recentRequests.push({ success, duration, timestamp: Date.now() });
      
      // Keep only recent requests
      if (this.recentRequests.length > this.maxHistory) {
        this.recentRequests.shift();
      }
    }
    
    getSuccessRate() {
      if (this.recentRequests.length === 0) return 1.0;
      
      const successes = this.recentRequests.filter(r => r.success).length;
      return successes / this.recentRequests.length;
    }
    
    getAverageResponseTime() {
      if (this.recentRequests.length === 0) return 1000;
      
      const total = this.recentRequests.reduce((sum, r) => sum + r.duration, 0);
      return total / this.recentRequests.length;
    }
    
    shouldRetry(attempt, maxRetries) {
      const successRate = this.getSuccessRate();
      const avgResponseTime = this.getAverageResponseTime();
      
      console.log(`📊 Current success rate: ${(successRate * 100).toFixed(1)}%`);
      console.log(`📊 Average response time: ${avgResponseTime.toFixed(0)}ms`);
      
      // Reduce retry attempts if success rate is very low
      const adaptiveMaxRetries = successRate < 0.3 ? Math.max(1, maxRetries - 1) : maxRetries;
      
      return attempt < adaptiveMaxRetries;
    }
    
    getRetryDelay(attempt) {
      const successRate = this.getSuccessRate();
      const avgResponseTime = this.getAverageResponseTime();
      
      // Longer delays for lower success rates
      const baseDelay = Math.pow(2, attempt - 1) * 1000;
      const successMultiplier = Math.max(0.5, 2 - successRate);
      const responseTimeMultiplier = Math.min(2, avgResponseTime / 1000);
      
      return baseDelay * successMultiplier * responseTimeMultiplier;
    }
  }
  
  const strategy = new AdaptiveRetryStrategy();
  
  async function adaptiveRequest(url) {
    const maxRetries = 4;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const startTime = Date.now();
      
      try {
        console.log(`📡 Adaptive attempt ${attempt}`);
        const response = await create().get(url, { timeout: 3000 });
        const duration = Date.now() - startTime;
        
        strategy.recordResult(true, duration);
        console.log(`✅ Success in ${duration}ms`);
        return response;
      } catch (error) {
        const duration = Date.now() - startTime;
        strategy.recordResult(false, duration);
        
        if (!strategy.shouldRetry(attempt, maxRetries)) {
          console.log('❌ Adaptive strategy suggests stopping retries');
          throw error;
        }
        
        const delay = strategy.getRetryDelay(attempt);
        console.log(`⚠️  Failed in ${duration}ms, retrying in ${delay.toFixed(0)}ms`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  // Test with a mix of success and failure
  const testUrls = [
    'https://httpbin.org/status/500',
    'https://httpbin.org/status/200',
    'https://httpbin.org/status/500',
    'https://httpbin.org/status/500'
  ];
  
  for (let i = 0; i < testUrls.length; i++) {
    console.log(`🧪 Test request ${i + 1}:`);
    try {
      await adaptiveRequest(testUrls[i]);
    } catch (error) {
      console.log(`❌ Final failure: ${error.message}`);
    }
    console.log();
  }
}

/**
 * Run all examples
 */
async function runAllExamples() {
  console.log('🚀 Running all retry logic examples...\n');
  
  await basicExponentialRetry();
  await conditionalRetry();
  await retryWithJitter();
  await retryWithRetryAfter();
  await circuitBreakerRetry();
  await adaptiveRetry();
  
  console.log('✨ All retry logic examples completed!');
}

// Run examples if this file is executed directly
if (require.main === module) {
  runAllExamples().catch(error => {
    console.error('💥 Fatal error:', error);
    process.exit(1);
  });
}

module.exports = {
  basicExponentialRetry,
  conditionalRetry,
  retryWithJitter,
  retryWithRetryAfter,
  circuitBreakerRetry,
  adaptiveRetry,
  runAllExamples
};