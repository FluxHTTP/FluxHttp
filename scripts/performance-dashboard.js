#!/usr/bin/env node
/**
 * Performance Dashboard
 * Visualizes performance metrics over time
 */

const fs = require('fs');
const path = require('path');

function generateDashboard() {
  const resultsPath = path.join(__dirname, '..', 'performance-results.json');
  
  if (!fs.existsSync(resultsPath)) {
    console.log('No performance results found. Run performance tests first.');
    return;
  }
  
  const results = JSON.parse(fs.readFileSync(resultsPath, 'utf8'));
  
  console.log('FluxHTTP Performance Dashboard');
  console.log('==============================\n');
  
  if (results.length === 0) {
    console.log('No performance data available.');
    return;
  }
  
  const latest = results[results.length - 1];
  
  console.log('Latest Results:');
  console.log(`Bundle Size: ${latest.bundleSize.minimal}B (minimal), ${latest.bundleSize.full}B (full)`);
  console.log(`Build Time: ${latest.buildTime.clean}ms (clean), ${latest.buildTime.incremental}ms (incremental)`);
  console.log(`Runtime: ${latest.runtime.instantiation}ms (instantiation)`);
  console.log(`Memory: ${latest.memory.perInstance}KB per instance`);
  
  if (results.length > 1) {
    const previous = results[results.length - 2];
    console.log('\nTrends:');
    
    const bundleDiff = latest.bundleSize.minimal - previous.bundleSize.minimal;
    const buildDiff = latest.buildTime.clean - previous.buildTime.clean;
    
    console.log(`Bundle size change: ${bundleDiff > 0 ? '+' : ''}${bundleDiff}B`);
    console.log(`Build time change: ${buildDiff > 0 ? '+' : ''}${buildDiff}ms`);
  }
}

if (require.main === module) {
  generateDashboard();
}

module.exports = { generateDashboard };
