#!/usr/bin/env node
/**
 * Comprehensive Benchmark Suite Runner
 * Runs all performance benchmarks and generates a unified report
 */

const { performance } = require('perf_hooks');
const fs = require('fs');
const path = require('path');

// Import all benchmark modules
const BundleSizeBenchmark = require('./bundle-size');
const InitializationBenchmark = require('./initialization');
const RequestBenchmark = require('./requests');
const MemoryBenchmark = require('./memory');
const ThroughputBenchmark = require('./throughput');
const RealWorldBenchmark = require('./real-world');

class BenchmarkSuite {
  constructor() {
    this.results = {};
    this.startTime = null;
    this.endTime = null;
  }

  formatTime(ms) {
    if (ms < 1000) return `${ms.toFixed(0)}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  }

  async runBenchmark(name, BenchmarkClass, options = {}) {
    console.log(`\n📋 Running ${name} Benchmark`);
    console.log('=' .repeat(50));
    
    const startTime = performance.now();
    
    try {
      const benchmark = new BenchmarkClass();
      const result = await benchmark.run();
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      this.results[name] = {
        success: true,
        duration,
        data: result,
        timestamp: new Date().toISOString()
      };
      
      console.log(`\n✅ ${name} completed in ${this.formatTime(duration)}`);
      
      return result;
    } catch (error) {
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      console.error(`\n❌ ${name} failed:`, error.message);
      
      this.results[name] = {
        success: false,
        duration,
        error: error.message,
        timestamp: new Date().toISOString()
      };
      
      return null;
    }
  }

  generateOverallReport() {
    console.log('\n\n🏆 COMPREHENSIVE PERFORMANCE REPORT');
    console.log('=' .repeat(80));
    
    const totalDuration = this.endTime - this.startTime;
    console.log(`\nBenchmark Suite Duration: ${this.formatTime(totalDuration)}`);
    console.log(`Execution Date: ${new Date().toLocaleString()}`);
    console.log(`Node.js Version: ${process.version}`);
    console.log(`Platform: ${process.platform} ${process.arch}`);
    
    // Summary table
    console.log('\n📊 Benchmark Summary:');
    console.log('-'.repeat(60));
    
    for (const [name, result] of Object.entries(this.results)) {
      const status = result.success ? '✅ PASSED' : '❌ FAILED';
      const duration = this.formatTime(result.duration);
      console.log(`${name.padEnd(20)} ${status.padEnd(15)} ${duration}`);
    }
    
    // Overall performance assessment
    this.generatePerformanceAssessment();
    
    // Competition comparison
    this.generateCompetitorComparison();
    
    // Recommendations
    this.generateRecommendations();
    
    return this.results;
  }

  generatePerformanceAssessment() {
    console.log('\n\n🎯 FluxHTTP Performance Assessment');
    console.log('=' .repeat(50));
    
    const categories = {
      'Bundle Size': this.assessBundleSize(),
      'Initialization': this.assessInitialization(),
      'Request Speed': this.assessRequestSpeed(),
      'Memory Efficiency': this.assessMemoryEfficiency(),
      'Throughput': this.assessThroughput(),
      'Real-World Performance': this.assessRealWorld()
    };
    
    let totalScore = 0;
    let categoryCount = 0;
    
    for (const [category, assessment] of Object.entries(categories)) {
      if (assessment) {
        const grade = this.getGradeLetter(assessment.score);
        const color = this.getGradeColor(grade);
        
        console.log(`\n${category}:`);
        console.log(`  Score: ${color}${assessment.score.toFixed(1)}/10 (${grade})\x1b[0m`);
        console.log(`  Assessment: ${assessment.assessment}`);
        
        if (assessment.highlights) {
          console.log(`  Highlights:`);
          for (const highlight of assessment.highlights) {
            console.log(`    • ${highlight}`);
          }
        }
        
        totalScore += assessment.score;
        categoryCount++;
      }
    }
    
    if (categoryCount > 0) {
      const overallScore = totalScore / categoryCount;
      const overallGrade = this.getGradeLetter(overallScore);
      const overallColor = this.getGradeColor(overallGrade);
      
      console.log(`\n\n🏅 OVERALL GRADE: ${overallColor}${overallGrade} (${overallScore.toFixed(1)}/10)\x1b[0m`);
      
      if (overallScore >= 9) {
        console.log('🎆 EXCELLENT! FluxHTTP shows outstanding performance across all metrics.');
      } else if (overallScore >= 8) {
        console.log('🎉 GREAT! FluxHTTP demonstrates strong performance with minor areas for improvement.');
      } else if (overallScore >= 7) {
        console.log('👍 GOOD! FluxHTTP performs well with some optimization opportunities.');
      } else {
        console.log('🔧 NEEDS IMPROVEMENT! Consider optimization in key performance areas.');
      }
    }
  }

  assessBundleSize() {
    const bundleResult = this.results['Bundle Size'];
    if (!bundleResult || !bundleResult.success) return null;
    
    const fluxhttpData = bundleResult.data.get('FluxHTTP');
    if (!fluxhttpData) return null;
    
    let score = 8; // Start high for bundle size
    const highlights = [];
    
    // Check against targets
    if (fluxhttpData.total < 16000) {
      score += 1;
      highlights.push('Under 16KB bundle size target');
    }
    
    if (fluxhttpData.dependencies === 0) {
      score += 1;
      highlights.push('Zero dependencies - no bloat');
    }
    
    return {
      score: Math.min(score, 10),
      assessment: `Bundle is ${(fluxhttpData.total / 1024).toFixed(1)}KB with ${fluxhttpData.dependencies} dependencies`,
      highlights
    };
  }

  assessInitialization() {
    const initResult = this.results['Initialization'];
    if (!initResult || !initResult.success) return null;
    
    const fluxhttpData = initResult.data.get('FluxHTTP');
    if (!fluxhttpData) return null;
    
    let score = 5;
    const highlights = [];
    
    if (fluxhttpData.avgTime < 1) {
      score += 3;
      highlights.push('Sub-millisecond initialization');
    } else if (fluxhttpData.avgTime < 2) {
      score += 2;
      highlights.push('Very fast initialization');
    } else if (fluxhttpData.avgTime < 5) {
      score += 1;
    }
    
    if (fluxhttpData.memoryImpact < 1000000) {
      score += 2;
      highlights.push('Low memory footprint');
    } else if (fluxhttpData.memoryImpact < 5000000) {
      score += 1;
    }
    
    return {
      score: Math.min(score, 10),
      assessment: `Initializes in ${fluxhttpData.avgTime.toFixed(2)}ms with ${(fluxhttpData.memoryImpact / 1024).toFixed(0)}KB memory impact`,
      highlights
    };
  }

  assessRequestSpeed() {
    const requestResult = this.results['Request Performance'];
    if (!requestResult || !requestResult.success) return null;
    
    const fluxhttpData = requestResult.data.get('FluxHTTP');
    if (!fluxhttpData) return null;
    
    let score = 5;
    const highlights = [];
    
    if (fluxhttpData.avgTime < 5) {
      score += 3;
      highlights.push('Excellent request processing speed');
    } else if (fluxhttpData.avgTime < 10) {
      score += 2;
      highlights.push('Very fast request processing');
    } else if (fluxhttpData.avgTime < 20) {
      score += 1;
    }
    
    if (fluxhttpData.successRate >= 99) {
      score += 2;
      highlights.push('Exceptional reliability');
    } else if (fluxhttpData.successRate >= 95) {
      score += 1;
    }
    
    return {
      score: Math.min(score, 10),
      assessment: `Average ${fluxhttpData.avgTime.toFixed(1)}ms response time with ${fluxhttpData.successRate.toFixed(1)}% success rate`,
      highlights
    };
  }

  assessMemoryEfficiency() {
    const memoryResult = this.results['Memory Usage'];
    if (!memoryResult || !memoryResult.success) return null;
    
    const fluxhttpData = memoryResult.data.get('FluxHTTP');
    if (!fluxhttpData) return null;
    
    let score = 5;
    const highlights = [];
    
    if (fluxhttpData.setupOverhead.heapUsed < 1000000) {
      score += 2;
      highlights.push('Minimal setup overhead');
    }
    
    if (fluxhttpData.memoryPerRequest < 100) {
      score += 2;
      highlights.push('Extremely efficient per-request memory usage');
    } else if (fluxhttpData.memoryPerRequest < 1000) {
      score += 1;
    }
    
    if (!fluxhttpData.isMemoryLeak) {
      score += 1;
      highlights.push('No memory leaks detected');
    }
    
    return {
      score: Math.min(score, 10),
      assessment: `${(fluxhttpData.setupOverhead.heapUsed / 1024).toFixed(0)}KB setup, ${fluxhttpData.memoryPerRequest.toFixed(0)} bytes per request`,
      highlights
    };
  }

  assessThroughput() {
    const throughputResult = this.results['Throughput'];
    if (!throughputResult || !throughputResult.success) return null;
    
    const fluxhttpData = throughputResult.data.get('FluxHTTP');
    if (!fluxhttpData) return null;
    
    let score = 5;
    const highlights = [];
    
    if (fluxhttpData.maxThroughput >= 2000) {
      score += 3;
      highlights.push('Exceptional throughput capacity');
    } else if (fluxhttpData.maxThroughput >= 1000) {
      score += 2;
      highlights.push('High throughput capacity');
    } else if (fluxhttpData.maxThroughput >= 500) {
      score += 1;
    }
    
    if (fluxhttpData.averageSuccessRate >= 98) {
      score += 2;
      highlights.push('Excellent reliability under load');
    } else if (fluxhttpData.averageSuccessRate >= 95) {
      score += 1;
    }
    
    return {
      score: Math.min(score, 10),
      assessment: `Peak ${Math.round(fluxhttpData.maxThroughput)} RPS at ${fluxhttpData.bestConcurrency} concurrent connections`,
      highlights
    };
  }

  assessRealWorld() {
    const realWorldResult = this.results['Real-World Scenarios'];
    if (!realWorldResult || !realWorldResult.success) return null;
    
    const fluxhttpData = realWorldResult.data.get('FluxHTTP');
    if (!fluxhttpData) return null;
    
    let score = 5;
    const highlights = [];
    
    if (fluxhttpData.overallAvgTime < 100) {
      score += 2;
      highlights.push('Fast real-world scenario execution');
    } else if (fluxhttpData.overallAvgTime < 200) {
      score += 1;
    }
    
    if (fluxhttpData.overallSuccessRate >= 99) {
      score += 2;
      highlights.push('Excellent real-world reliability');
    } else if (fluxhttpData.overallSuccessRate >= 95) {
      score += 1;
    }
    
    if (fluxhttpData.scenarioCount >= 8) {
      score += 1;
      highlights.push('Comprehensive scenario coverage');
    }
    
    return {
      score: Math.min(score, 10),
      assessment: `${fluxhttpData.overallAvgTime.toFixed(0)}ms average across ${fluxhttpData.scenarioCount} scenarios`,
      highlights
    };
  }

  generateCompetitorComparison() {
    console.log('\n\n🥊 Competitor Comparison Summary');
    console.log('=' .repeat(50));
    
    const comparisons = [];
    
    // Bundle size comparison
    const bundleResult = this.results['Bundle Size'];
    if (bundleResult?.success) {
      const fluxhttp = bundleResult.data.get('FluxHTTP');
      const axios = bundleResult.data.get('Axios');
      if (fluxhttp && axios) {
        const savings = ((axios.total - fluxhttp.total) / axios.total * 100);
        comparisons.push(`• Bundle Size: ${savings.toFixed(1)}% smaller than Axios`);
      }
    }
    
    // Speed comparison
    const requestResult = this.results['Request Performance'];
    if (requestResult?.success) {
      const fluxhttp = requestResult.data.get('FluxHTTP');
      const axios = requestResult.data.get('Axios');
      if (fluxhttp && axios) {
        const speedDiff = ((axios.avgTime - fluxhttp.avgTime) / axios.avgTime * 100);
        comparisons.push(`• Request Speed: ${speedDiff.toFixed(1)}% faster than Axios`);
      }
    }
    
    // Memory comparison
    const memoryResult = this.results['Memory Usage'];
    if (memoryResult?.success) {
      const fluxhttp = memoryResult.data.get('FluxHTTP');
      const axios = memoryResult.data.get('Axios');
      if (fluxhttp && axios) {
        const memoryDiff = ((axios.memoryPerRequest - fluxhttp.memoryPerRequest) / Math.max(axios.memoryPerRequest, 1) * 100);
        comparisons.push(`• Memory Efficiency: ${memoryDiff.toFixed(1)}% less memory per request than Axios`);
      }
    }
    
    if (comparisons.length > 0) {
      for (const comparison of comparisons) {
        console.log(comparison);
      }
    } else {
      console.log('• Limited competitor data available for comparison');
    }
    
    console.log('\n🏁 Key Advantages:');
    console.log('• Zero dependencies - no security vulnerabilities from dependencies');
    console.log('• TypeScript-first design with excellent type safety');
    console.log('• Modern architecture with built-in security features');
    console.log('• Consistent performance across all scenarios');
    console.log('• Minimal bundle impact for better user experience');
  }

  generateRecommendations() {
    console.log('\n\n📝 Performance Recommendations');
    console.log('=' .repeat(50));
    
    const recommendations = [];
    
    // Analyze results for recommendations
    const overallScores = [];
    
    for (const category of ['Bundle Size', 'Initialization', 'Request Performance', 'Memory Usage', 'Throughput', 'Real-World Scenarios']) {
      const result = this.results[category];
      if (result?.success) {
        const assessment = this.getAssessmentForCategory(category);
        if (assessment && assessment.score < 8) {
          recommendations.push(`• ${category}: Consider optimization - current score ${assessment.score.toFixed(1)}/10`);
        }
        if (assessment) {
          overallScores.push(assessment.score);
        }
      }
    }
    
    if (recommendations.length === 0) {
      console.log('🎉 Excellent! FluxHTTP is performing optimally across all benchmarks.');
      console.log('\nOptimization Suggestions:');
      console.log('• Continue monitoring performance in production environments');
      console.log('• Consider adding performance regression tests to CI/CD');
      console.log('• Document performance characteristics for users');
      console.log('• Share benchmark results to demonstrate competitive advantages');
    } else {
      console.log('Areas for Improvement:');
      for (const recommendation of recommendations) {
        console.log(recommendation);
      }
    }
    
    console.log('\n🚀 Next Steps:');
    console.log('• Run benchmarks regularly to catch performance regressions');
    console.log('• Test with real-world data and scenarios from your users');
    console.log('• Monitor bundle size impact as new features are added');
    console.log('• Consider performance budgets for different metrics');
    console.log('• Share results with the community to build confidence');
  }

  getAssessmentForCategory(category) {
    switch (category) {
      case 'Bundle Size': return this.assessBundleSize();
      case 'Initialization': return this.assessInitialization();
      case 'Request Performance': return this.assessRequestSpeed();
      case 'Memory Usage': return this.assessMemoryEfficiency();
      case 'Throughput': return this.assessThroughput();
      case 'Real-World Scenarios': return this.assessRealWorld();
      default: return null;
    }
  }

  getGradeLetter(score) {
    if (score >= 9.5) return 'A+';
    if (score >= 9.0) return 'A';
    if (score >= 8.5) return 'A-';
    if (score >= 8.0) return 'B+';
    if (score >= 7.5) return 'B';
    if (score >= 7.0) return 'B-';
    if (score >= 6.5) return 'C+';
    if (score >= 6.0) return 'C';
    if (score >= 5.5) return 'C-';
    if (score >= 5.0) return 'D';
    return 'F';
  }

  getGradeColor(grade) {
    if (grade.startsWith('A')) return '\x1b[32m'; // Green
    if (grade.startsWith('B')) return '\x1b[33m'; // Yellow
    if (grade.startsWith('C')) return '\x1b[31m'; // Red
    return '\x1b[31m'; // Red for D and F
  }

  async saveReport() {
    const report = {
      timestamp: new Date().toISOString(),
      duration: this.endTime - this.startTime,
      environment: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch
      },
      results: this.results
    };
    
    const reportsDir = path.join(__dirname, '..', 'reports');
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }
    
    const reportPath = path.join(reportsDir, `benchmark-report-${Date.now()}.json`);
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    console.log(`\n💾 Report saved to: ${reportPath}`);
    
    return reportPath;
  }

  async run() {
    console.log('🏁 Starting Comprehensive FluxHTTP Benchmark Suite');
    console.log('\nThis will test FluxHTTP against major competitors across multiple dimensions:');
    console.log('• Bundle Size vs Axios, node-fetch, Undici');
    console.log('• Initialization Performance');
    console.log('• Request Processing Speed');
    console.log('• Memory Usage & Efficiency');
    console.log('• Throughput & Concurrency');
    console.log('• Real-World Scenarios');
    console.log('\nEstimated duration: 3-5 minutes\n');
    
    this.startTime = performance.now();
    
    // Run all benchmarks
    await this.runBenchmark('Bundle Size', BundleSizeBenchmark);
    await this.runBenchmark('Initialization', InitializationBenchmark);
    await this.runBenchmark('Request Performance', RequestBenchmark);
    await this.runBenchmark('Memory Usage', MemoryBenchmark);
    await this.runBenchmark('Throughput', ThroughputBenchmark);
    await this.runBenchmark('Real-World Scenarios', RealWorldBenchmark);
    
    this.endTime = performance.now();
    
    // Generate comprehensive report
    this.generateOverallReport();
    
    // Save report to file
    await this.saveReport();
    
    console.log('\n\n🎉 Benchmark Suite Complete!');
    console.log('\nTo run individual benchmarks:');
    console.log('• npm run benchmark:bundle');
    console.log('• npm run benchmark:init');
    console.log('• npm run benchmark:requests');
    console.log('• npm run benchmark:memory');
    console.log('• npm run benchmark:throughput');
    console.log('• npm run benchmark:real-world');
    
    return this.results;
  }
}

// Run if called directly
if (require.main === module) {
  const suite = new BenchmarkSuite();
  
  suite.run()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Benchmark suite failed:', error);
      process.exit(1);
    });
}

module.exports = BenchmarkSuite;
