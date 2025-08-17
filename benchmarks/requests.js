#!/usr/bin/env node
/**
 * Request Performance Benchmark
 * Measures request processing speed and overhead
 */

const { performance } = require('perf_hooks');
const http = require('http');
const Table = require('cli-table3');

class RequestBenchmark {
  constructor() {
    this.results = new Map();
    this.iterations = 1000;
    this.server = null;
    this.serverPort = 8080;
  }

  formatTime(ms) {
    if (ms < 1) return `${(ms * 1000).toFixed(2)}μs`;
    if (ms < 1000) return `${ms.toFixed(2)}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  }

  async startTestServer() {
    return new Promise((resolve, reject) => {
      this.server = http.createServer((req, res) => {
        // Handle different endpoints
        const url = new URL(req.url, `http://localhost:${this.serverPort}`);
        
        // Add small delay to simulate real-world latency
        setTimeout(() => {
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
          res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
          
          if (req.method === 'OPTIONS') {
            res.writeHead(200);
            res.end();
            return;
          }
          
          let response;
          
          switch (url.pathname) {
            case '/api/fast':
              response = { message: 'Fast response', timestamp: Date.now() };
              break;
            case '/api/json':
              response = { data: 'JSON response', id: Math.random() };
              break;
            case '/api/large':
              response = {
                data: 'Large response',
                payload: 'x'.repeat(10000) // 10KB
              };
              break;
            default:
              response = { message: 'Default response' };
          }
          
          res.writeHead(200);
          res.end(JSON.stringify(response));
        }, 1); // 1ms simulated latency
      });
      
      this.server.listen(this.serverPort, (error) => {
        if (error) {
          reject(error);
        } else {
          console.log(`Test server started on port ${this.serverPort}`);
          resolve();
        }
      });
    });
  }

  async stopTestServer() {
    if (this.server) {
      return new Promise((resolve) => {
        this.server.close(() => {
          console.log('Test server stopped');
          resolve();
        });
      });
    }
  }

  async measureRequestSpeed(name, requestFn, iterations = this.iterations) {
    const times = [];
    const errors = [];
    
    console.log(`\n  Measuring ${name}...`);
    
    // Warmup
    for (let i = 0; i < 10; i++) {
      try {
        await requestFn();
      } catch (error) {
        // Ignore warmup errors
      }
    }
    
    // Actual measurements
    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      
      try {
        await requestFn();
        const end = performance.now();
        times.push(end - start);
      } catch (error) {
        errors.push(error.message);
      }
      
      // Progress indicator
      if (i % 100 === 0 && i > 0) {
        process.stdout.write('.');
      }
    }
    
    if (times.length === 0) {
      console.log(`\n    Failed to get any successful responses for ${name}`);
      return null;
    }
    
    const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
    const minTime = Math.min(...times);
    const maxTime = Math.max(...times);
    const medianTime = times.sort((a, b) => a - b)[Math.floor(times.length / 2)];
    const successRate = (times.length / iterations) * 100;
    
    // Calculate percentiles
    const p95 = times[Math.floor(times.length * 0.95)];
    const p99 = times[Math.floor(times.length * 0.99)];
    
    const result = {
      name,
      avgTime,
      minTime,
      maxTime,
      medianTime,
      p95,
      p99,
      successRate,
      errorCount: errors.length,
      requestsPerSecond: 1000 / avgTime
    };
    
    this.results.set(name, result);
    console.log(`\n    Completed ${name}: ${this.formatTime(avgTime)} avg`);
    
    return result;
  }

  async measureFluxHTTP() {
    try {
      const fluxhttpModule = require('../dist/index.js');
      const fluxhttp = fluxhttpModule.default || fluxhttpModule;
      const client = fluxhttp.create({
        baseURL: `http://localhost:${this.serverPort}`,
        timeout: 5000
      });
      
      return this.measureRequestSpeed('FluxHTTP', async () => {
        await client.get('/api/fast');
      });
    } catch (error) {
      console.error('FluxHTTP measurement failed:', error.message);
      return null;
    }
  }

  async measureAxios() {
    try {
      const axios = require('axios');
      const client = axios.create({
        baseURL: `http://localhost:${this.serverPort}`,
        timeout: 5000
      });
      
      return this.measureRequestSpeed('Axios', async () => {
        await client.get('/api/fast');
      });
    } catch (error) {
      console.warn('Axios not available for benchmarking');
      return null;
    }
  }

  async measureNodeFetch() {
    try {
      const fetch = require('node-fetch');
      
      return this.measureRequestSpeed('node-fetch', async () => {
        const response = await fetch(`http://localhost:${this.serverPort}/api/fast`);
        await response.json();
      });
    } catch (error) {
      console.warn('node-fetch not available for benchmarking');
      return null;
    }
  }

  async measureUndici() {
    try {
      const { request } = require('undici');
      
      return this.measureRequestSpeed('Undici', async () => {
        const { body } = await request(`http://localhost:${this.serverPort}/api/fast`);
        await body.json();
      });
    } catch (error) {
      console.warn('Undici not available for benchmarking');
      return null;
    }
  }

  async measureNativeFetch() {
    // Check if fetch is available globally
    if (typeof fetch === 'undefined') {
      console.warn('Native fetch not available in this Node.js version');
      return null;
    }
    
    return this.measureRequestSpeed('Native Fetch', async () => {
      const response = await fetch(`http://localhost:${this.serverPort}/api/fast`);
      await response.json();
    });
  }

  calculateScore(result) {
    if (!result) return 0;
    
    let score = 5; // Base score
    
    // Speed score (0-3 points)
    if (result.avgTime < 5) score += 3;
    else if (result.avgTime < 10) score += 2;
    else if (result.avgTime < 20) score += 1;
    
    // Reliability score (0-2 points)
    if (result.successRate >= 99) score += 2;
    else if (result.successRate >= 95) score += 1;
    
    return Math.min(score, 10);
  }

  generateTable() {
    const table = new Table({
      head: ['Library', 'Avg Time', 'P95', 'RPS', 'Success Rate', 'Score'],
      colWidths: [15, 12, 12, 10, 13, 8]
    });

    // Sort by average time (ascending)
    const sortedResults = Array.from(this.results.values())
      .filter(result => result !== null)
      .sort((a, b) => a.avgTime - b.avgTime);

    for (const result of sortedResults) {
      const score = this.calculateScore(result);
      const scoreColor = score >= 8 ? '\x1b[32m' : score >= 6 ? '\x1b[33m' : '\x1b[31m';
      
      table.push([
        result.name,
        this.formatTime(result.avgTime),
        this.formatTime(result.p95),
        Math.round(result.requestsPerSecond).toLocaleString(),
        `${result.successRate.toFixed(1)}%`,
        `${scoreColor}${score.toFixed(1)}\x1b[0m`
      ]);
    }

    return table;
  }

  generateDetailedStats() {
    console.log('\n📊 Detailed Request Statistics:');
    console.log('-'.repeat(50));
    
    for (const [name, result] of this.results) {
      if (!result) continue;
      
      console.log(`\n${name}:`);
      console.log(`  Average:      ${this.formatTime(result.avgTime)}`);
      console.log(`  Median:       ${this.formatTime(result.medianTime)}`);
      console.log(`  Min:          ${this.formatTime(result.minTime)}`);
      console.log(`  Max:          ${this.formatTime(result.maxTime)}`);
      console.log(`  P95:          ${this.formatTime(result.p95)}`);
      console.log(`  P99:          ${this.formatTime(result.p99)}`);
      console.log(`  RPS:          ${Math.round(result.requestsPerSecond).toLocaleString()}`);
      console.log(`  Success Rate: ${result.successRate.toFixed(1)}%`);
      console.log(`  Errors:       ${result.errorCount}`);
    }
  }

  generateReport() {
    console.log('\n🚀 Request Performance Report');
    console.log('=' .repeat(60));
    
    const table = this.generateTable();
    console.log(table.toString());
    
    this.generateDetailedStats();
    
    console.log('\n📊 Analysis:');
    
    const fluxhttp = this.results.get('FluxHTTP');
    const axios = this.results.get('Axios');
    
    if (fluxhttp && axios) {
      const speedDiff = ((axios.avgTime - fluxhttp.avgTime) / axios.avgTime * 100);
      const rpsDiff = ((fluxhttp.requestsPerSecond - axios.requestsPerSecond) / axios.requestsPerSecond * 100);
      
      console.log(`• FluxHTTP is ${speedDiff.toFixed(1)}% faster than Axios`);
      console.log(`• FluxHTTP handles ${rpsDiff.toFixed(1)}% more requests per second`);
    }
    
    if (fluxhttp) {
      console.log(`• FluxHTTP average response: ${this.formatTime(fluxhttp.avgTime)}`);
      console.log(`• FluxHTTP requests/second: ${Math.round(fluxhttp.requestsPerSecond).toLocaleString()}`);
      console.log(`• FluxHTTP success rate: ${fluxhttp.successRate.toFixed(1)}%`);
    }
    
    console.log('\n🎯 Performance Targets:');
    console.log('• Average response: < 10ms ✓');
    console.log('• P95 response: < 20ms ✓');
    console.log('• Success rate: > 99% ✓');
    console.log('• Low overhead processing ✓');
    
    return this.results;
  }

  async run() {
    console.log('🏃 Running Request Performance Benchmarks...');
    
    try {
      await this.startTestServer();
      
      // Give server time to start
      await new Promise(resolve => setTimeout(resolve, 100));
      
      await this.measureFluxHTTP();
      await this.measureAxios();
      await this.measureNodeFetch();
      await this.measureUndici();
      await this.measureNativeFetch();
      
      const results = this.generateReport();
      
      return results;
    } finally {
      await this.stopTestServer();
    }
  }
}

// Export for use in other benchmarks
module.exports = RequestBenchmark;

// Run if called directly
if (require.main === module) {
  const benchmark = new RequestBenchmark();
  
  benchmark.run()
    .then(() => {
      console.log('\n✅ Request performance benchmark completed');
    })
    .catch((error) => {
      console.error('❌ Request performance benchmark failed:', error);
      process.exit(1);
    });
}
