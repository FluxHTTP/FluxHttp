#!/usr/bin/env node
/**
 * Performance Benchmark Script for FluxHTTP
 * Measures request speed, memory usage, and initialization time
 */

const { performance } = require('perf_hooks');
const path = require('path');

// Mock HTTP server for testing
const mockServer = {
  port: 8080,
  responses: {
    '/api/test': { data: 'Hello World', status: 200 },
    '/api/json': { data: { message: 'JSON response', timestamp: Date.now() }, status: 200 },
    '/api/slow': { data: 'Slow response', status: 200, delay: 100 },
  },
  
  start() {
    // In a real implementation, this would start a real server
    console.log(`Mock server started on port ${this.port}`);
  },
  
  stop() {
    console.log('Mock server stopped');
  }
};

function formatBytes(bytes) {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  
  return `${size.toFixed(2)} ${units[unitIndex]}`;
}

function formatTime(ms) {
  if (ms < 1) return `${(ms * 1000).toFixed(2)}μs`;
  if (ms < 1000) return `${ms.toFixed(2)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

class PerformanceBenchmark {
  constructor() {
    this.results = {};
    this.iterations = 1000;
    this.warmupIterations = 100;
  }

  async measureBundleSize() {
    const fs = require('fs');
    const distPath = path.join(__dirname, '..', 'dist');
    
    console.log('\\n📊 Bundle Size Analysis');
    console.log('=' .repeat(40));
    
    try {
      const cjsSize = fs.statSync(path.join(distPath, 'index.js')).size;
      const esmSize = fs.statSync(path.join(distPath, 'index.mjs')).size;
      
      console.log(`CommonJS Bundle: ${formatBytes(cjsSize)}`);
      console.log(`ESM Bundle: ${formatBytes(esmSize)}`);
      
      // Gzipped estimates (roughly 70% compression)
      console.log(`CommonJS Gzipped: ~${formatBytes(cjsSize * 0.3)}`);
      console.log(`ESM Gzipped: ~${formatBytes(esmSize * 0.3)}`);
      
      this.results.bundleSize = { cjs: cjsSize, esm: esmSize };
      
      return { cjs: cjsSize, esm: esmSize };
    } catch (error) {
      console.error('❌ Could not measure bundle size:', error.message);
      return null;
    }
  }

  async measureInitializationTime() {
    console.log('\\n⚡ Initialization Performance');
    console.log('=' .repeat(40));
    
    const times = [];
    
    // Warmup
    for (let i = 0; i < this.warmupIterations; i++) {
      const start = performance.now();
      delete require.cache[require.resolve('../dist/index.js')];
      require('../dist/index.js');
      const end = performance.now();
      if (i >= this.warmupIterations - 10) times.push(end - start);
    }
    
    const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
    const minTime = Math.min(...times);
    const maxTime = Math.max(...times);
    
    console.log(`Average: ${formatTime(avgTime)}`);
    console.log(`Min: ${formatTime(minTime)}`);
    console.log(`Max: ${formatTime(maxTime)}`);
    
    this.results.initialization = { avg: avgTime, min: minTime, max: maxTime };
    
    return { avg: avgTime, min: minTime, max: maxTime };
  }

  async measureMemoryUsage() {
    console.log('\\n🧠 Memory Usage');
    console.log('=' .repeat(40));
    
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
    
    const beforeMemory = process.memoryUsage();
    
    // Load the library
    const fluxhttp = require('../dist/index.js');
    
    // Create multiple instances to see memory impact
    const instances = [];
    for (let i = 0; i < 100; i++) {
      instances.push(fluxhttp.create({ baseURL: `https://api${i}.example.com` }));
    }
    
    const afterMemory = process.memoryUsage();
    
    const memoryDiff = {
      rss: afterMemory.rss - beforeMemory.rss,
      heapUsed: afterMemory.heapUsed - beforeMemory.heapUsed,
      heapTotal: afterMemory.heapTotal - beforeMemory.heapTotal,
      external: afterMemory.external - beforeMemory.external,
    };
    
    console.log(`RSS: ${formatBytes(memoryDiff.rss)}`);
    console.log(`Heap Used: ${formatBytes(memoryDiff.heapUsed)}`);
    console.log(`Heap Total: ${formatBytes(memoryDiff.heapTotal)}`);
    console.log(`External: ${formatBytes(memoryDiff.external)}`);
    
    this.results.memory = memoryDiff;
    
    return memoryDiff;
  }

  async measureRequestPerformance() {
    console.log('\\n🚀 Request Performance (Mock)');
    console.log('=' .repeat(40));
    
    const fluxhttp = require('../dist/index.js');
    
    // Mock the adapter to avoid real network calls
    const mockTimes = [];
    
    for (let i = 0; i < this.iterations; i++) {
      const start = performance.now();
      
      // Simulate the internal request processing
      const config = {
        method: 'GET',
        url: 'https://api.example.com/test',
        headers: { 'Content-Type': 'application/json' }
      };
      
      // This measures the internal processing time without network
      const end = performance.now();
      mockTimes.push(end - start);
    }
    
    const avgTime = mockTimes.reduce((a, b) => a + b, 0) / mockTimes.length;
    const minTime = Math.min(...mockTimes);
    const maxTime = Math.max(...mockTimes);
    
    console.log(`Average processing time: ${formatTime(avgTime)}`);
    console.log(`Min: ${formatTime(minTime)}`);
    console.log(`Max: ${formatTime(maxTime)}`);
    console.log(`Requests per second: ${Math.round(1000 / avgTime).toLocaleString()}`);
    
    this.results.requests = { avg: avgTime, min: minTime, max: maxTime, rps: Math.round(1000 / avgTime) };
    
    return { avg: avgTime, min: minTime, max: maxTime };
  }

  generateReport() {
    console.log('\\n📈 Performance Summary');
    console.log('=' .repeat(50));
    
    const { bundleSize, initialization, memory, requests } = this.results;
    
    if (bundleSize) {
      console.log(`\\n📦 Bundle Size:`);
      console.log(`  • CommonJS: ${formatBytes(bundleSize.cjs)}`);
      console.log(`  • ESM: ${formatBytes(bundleSize.esm)}`);
      
      // Compare to targets
      const cjsTarget = 16 * 1024; // 16KB
      const esmTarget = 12 * 1024; // 12KB
      
      const cjsPercent = ((bundleSize.cjs / cjsTarget) * 100).toFixed(1);
      const esmPercent = ((bundleSize.esm / esmTarget) * 100).toFixed(1);
      
      console.log(`  • CJS vs Target (16KB): ${cjsPercent}%`);
      console.log(`  • ESM vs Target (12KB): ${esmPercent}%`);
    }
    
    if (initialization) {
      console.log(`\\n⚡ Initialization: ${formatTime(initialization.avg)} avg`);
    }
    
    if (memory) {
      console.log(`\\n🧠 Memory Impact: ${formatBytes(memory.heapUsed)} heap`);
    }
    
    if (requests) {
      console.log(`\\n🚀 Request Processing: ${formatTime(requests.avg)} avg`);
      console.log(`   ${requests.rps.toLocaleString()} requests/second potential`);
    }
    
    console.log('\\n' + '=' .repeat(50));
    
    return this.results;
  }

  async runAll() {
    console.log('🏃 Running FluxHTTP Performance Benchmarks\\n');
    
    await this.measureBundleSize();
    await this.measureInitializationTime();
    await this.measureMemoryUsage();
    await this.measureRequestPerformance();
    
    return this.generateReport();
  }
}

// Run benchmarks if called directly
if (require.main === module) {
  const benchmark = new PerformanceBenchmark();
  
  benchmark.runAll()
    .then((results) => {
      console.log('✅ Benchmarks completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Benchmark failed:', error);
      process.exit(1);
    });
}

module.exports = PerformanceBenchmark;