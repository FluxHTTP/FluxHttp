/**
 * FluxHTTP Examples Runner
 * Runs all example scripts with proper separation and error handling
 */

const path = require('path');

// Import all example modules
const basicUsage = require('./basic-usage');
const advancedConfiguration = require('./advanced-configuration');
const errorHandling = require('./error-handling');
const performanceTesting = require('./performance-testing');
const realWorldScenarios = require('./real-world-scenarios');

// Utility function to create section separators
function printSectionSeparator(title, level = 1) {
  const separator = level === 1 ? '═' : '─';
  const length = level === 1 ? 60 : 40;
  const line = separator.repeat(length);
  
  console.log('\n' + line);
  console.log(title.toUpperCase().padStart((length + title.length) / 2));
  console.log(line + '\n');
}

// Utility function to handle example execution with error boundaries
async function runExampleSafely(exampleName, exampleFunction) {
  try {
    console.log(`Running ${exampleName}...`);
    console.time(exampleName);
    
    await exampleFunction();
    
    console.timeEnd(exampleName);
    console.log(`✅ ${exampleName} completed successfully\n`);
  } catch (error) {
    console.timeEnd(exampleName);
    console.error(`❌ ${exampleName} failed:`, error.message);
    console.error('Stack trace:', error.stack?.split('\n').slice(0, 3).join('\n'));
    console.log(''); // Empty line for separation
  }
}

// Main runner function
async function runAllExamples() {
  console.log('🚀 FluxHTTP Examples Runner');
  console.log('This script demonstrates FluxHTTP\'s capabilities through various examples');
  console.log('Some examples may fail due to network conditions or rate limiting - this is normal');
  
  const startTime = Date.now();
  
  // Track example results
  const results = {
    passed: 0,
    failed: 0,
    total: 0
  };

  try {
    // Basic Usage Examples
    printSectionSeparator('Basic Usage Examples');
    await runExampleSafely('Basic Usage', basicUsage.runBasicExamples);
    
    // Advanced Configuration Examples
    printSectionSeparator('Advanced Configuration Examples');
    await runExampleSafely('Advanced Configuration', advancedConfiguration.runAdvancedExamples);
    
    // Error Handling Examples
    printSectionSeparator('Error Handling Examples');
    await runExampleSafely('Error Handling', errorHandling.runErrorHandlingExamples);
    
    // Performance Testing Examples
    printSectionSeparator('Performance Testing Examples');
    await runExampleSafely('Performance Testing', performanceTesting.runPerformanceExamples);
    
    // Real-World Scenarios
    printSectionSeparator('Real-World Scenarios');
    await runExampleSafely('Real-World Scenarios', realWorldScenarios.runRealWorldScenarios);
    
  } catch (globalError) {
    console.error('❌ Global error in examples runner:', globalError.message);
    console.error(globalError.stack);
  }

  // Summary
  const endTime = Date.now();
  const totalTime = endTime - startTime;
  
  printSectionSeparator('Examples Summary', 2);
  console.log('📊 Execution Summary:');
  console.log(`⏱️  Total execution time: ${(totalTime / 1000).toFixed(2)} seconds`);
  console.log(`📝 Examples run: 5`);
  console.log(`✅ Note: Individual function results may vary based on network conditions`);
  console.log(`🌐 Test endpoints used: JSONPlaceholder, HTTPBin`);
  
  console.log('\n📚 Example Files:');
  console.log('- basic-usage.js: Fundamental HTTP operations');
  console.log('- advanced-configuration.js: Interceptors and custom instances'); 
  console.log('- error-handling.js: Comprehensive error handling');
  console.log('- performance-testing.js: Performance benchmarks');
  console.log('- real-world-scenarios.js: Practical usage patterns');
  
  console.log('\n🔍 To run individual examples:');
  console.log('node examples/basic-usage.js');
  console.log('node examples/advanced-configuration.js');
  console.log('node examples/error-handling.js');
  console.log('node examples/performance-testing.js');
  console.log('node examples/real-world-scenarios.js');
  
  console.log('\n✨ FluxHTTP Examples Demo Complete!');
}

// Individual example runners for selective execution
async function runBasicExamples() {
  printSectionSeparator('Basic Usage Examples Only');
  await runExampleSafely('Basic Usage', basicUsage.runBasicExamples);
}

async function runAdvancedExamples() {
  printSectionSeparator('Advanced Configuration Examples Only');
  await runExampleSafely('Advanced Configuration', advancedConfiguration.runAdvancedExamples);
}

async function runErrorExamples() {
  printSectionSeparator('Error Handling Examples Only');
  await runExampleSafely('Error Handling', errorHandling.runErrorHandlingExamples);
}

async function runPerformanceExamples() {
  printSectionSeparator('Performance Testing Examples Only');
  await runExampleSafely('Performance Testing', performanceTesting.runPerformanceExamples);
}

async function runRealWorldExamples() {
  printSectionSeparator('Real-World Scenarios Only');
  await runExampleSafely('Real-World Scenarios', realWorldScenarios.runRealWorldScenarios);
}

// Command line argument handling
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  switch (command) {
    case 'basic':
      await runBasicExamples();
      break;
    case 'advanced':
      await runAdvancedExamples();
      break;
    case 'errors':
      await runErrorExamples();
      break;
    case 'performance':
      await runPerformanceExamples();
      break;
    case 'real-world':
      await runRealWorldExamples();
      break;
    case 'help':
      console.log('FluxHTTP Examples Runner');
      console.log('');
      console.log('Usage:');
      console.log('  node run-all-examples.js [command]');
      console.log('');
      console.log('Commands:');
      console.log('  (no command)  Run all examples');
      console.log('  basic         Run basic usage examples only');
      console.log('  advanced      Run advanced configuration examples only');
      console.log('  errors        Run error handling examples only');
      console.log('  performance   Run performance testing examples only');
      console.log('  real-world    Run real-world scenarios only');
      console.log('  help          Show this help message');
      break;
    default:
      await runAllExamples();
      break;
  }
}

// Run if this file is executed directly
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Fatal error in examples runner:', error);
    process.exit(1);
  });
}

module.exports = {
  runAllExamples,
  runBasicExamples,
  runAdvancedExamples,
  runErrorExamples,
  runPerformanceExamples,
  runRealWorldExamples,
  printSectionSeparator,
  runExampleSafely
};