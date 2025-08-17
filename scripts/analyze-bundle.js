#!/usr/bin/env node
/**
 * Bundle Size Analysis Script
 * Analyzes the built bundles to identify size contributors and optimization opportunities
 */

const fs = require('fs');
const path = require('path');

function getFileSizeInKB(filePath) {
  try {
    const stats = fs.statSync(filePath);
    return (stats.size / 1024).toFixed(2);
  } catch (error) {
    return '0.00';
  }
}

function analyzeBundleComposition() {
  const distPath = path.join(__dirname, '..', 'dist');
  
  if (!fs.existsSync(distPath)) {
    console.error('❌ No dist folder found. Run `npm run build` first.');
    return;
  }

  const files = fs.readdirSync(distPath).filter(f => !f.endsWith('.map') && !f.endsWith('.d.ts') && !f.endsWith('.d.mts'));
  
  console.log('📊 Bundle Size Analysis Report');
  console.log('=' .repeat(50));
  
  let cjsTotal = 0;
  let esmTotal = 0;
  const cjsFiles = [];
  const esmFiles = [];
  
  files.forEach(file => {
    const filePath = path.join(distPath, file);
    const sizeKB = parseFloat(getFileSizeInKB(filePath));
    
    if (file.endsWith('.js')) {
      cjsFiles.push({ name: file, size: sizeKB });
      cjsTotal += sizeKB;
    } else if (file.endsWith('.mjs')) {
      esmFiles.push({ name: file, size: sizeKB });
      esmTotal += sizeKB;
    }
  });

  console.log('\n🔍 CommonJS Bundle Analysis:');
  console.log(`Total Size: ${cjsTotal.toFixed(2)} KB (Target: 16 KB)`);
  console.log(`Over Target: +${(cjsTotal - 16).toFixed(2)} KB (${((cjsTotal / 16 - 1) * 100).toFixed(1)}%)`);
  console.log('\nFile Breakdown:');
  cjsFiles
    .sort((a, b) => b.size - a.size)
    .forEach(file => {
      const percentage = ((file.size / cjsTotal) * 100).toFixed(1);
      console.log(`  📄 ${file.name.padEnd(30)} ${file.size.toString().padStart(8)} KB (${percentage}%)`);
    });

  console.log('\n🔍 ESM Bundle Analysis:');
  console.log(`Total Size: ${esmTotal.toFixed(2)} KB (Target: 12 KB)`);
  console.log(`Over Target: +${(esmTotal - 12).toFixed(2)} KB (${((esmTotal / 12 - 1) * 100).toFixed(1)}%)`);
  console.log('\nFile Breakdown:');
  esmFiles
    .sort((a, b) => b.size - a.size)
    .forEach(file => {
      const percentage = ((file.size / esmTotal) * 100).toFixed(1);
      console.log(`  📄 ${file.name.padEnd(30)} ${file.size.toString().padStart(8)} KB (${percentage}%)`);
    });

  console.log('\n📈 Optimization Opportunities:');
  
  // Check for excessive splitting
  const cjsChunks = cjsFiles.filter(f => f.name.startsWith('chunk-')).length;
  const esmChunks = esmFiles.filter(f => f.name.startsWith('chunk-')).length;
  
  if (cjsChunks > 3 || esmChunks > 3) {
    console.log(`  ⚠️  Excessive code splitting: ${cjsChunks} CJS chunks, ${esmChunks} ESM chunks`);
    console.log(`     💡 Consider reducing splitting or bundling more together`);
  }

  // Main bundle analysis
  const mainCjs = cjsFiles.find(f => f.name === 'index.js');
  const mainEsm = esmFiles.find(f => f.name === 'index.mjs');
  
  if (mainCjs && mainCjs.size > 20) {
    console.log(`  ⚠️  Main CJS bundle is large: ${mainCjs.size} KB`);
    console.log(`     💡 Consider reducing main bundle size or lazy loading`);
  }
  
  if (mainEsm && mainEsm.size > 15) {
    console.log(`  ⚠️  Main ESM bundle is large: ${mainEsm.size} KB`);
    console.log(`     💡 Consider reducing main bundle size or lazy loading`);
  }

  console.log('\n🎯 Recommended Actions:');
  console.log('  1. Disable code splitting for smaller bundle');
  console.log('  2. Remove or make security features optional');
  console.log('  3. Simplify adapter selection logic');
  console.log('  4. Reduce TypeScript complexity');
  console.log('  5. Consider making some features optional/lazy-loaded');
  
  console.log('\n' + '='.repeat(50));
}

function analyzeSourceFiles() {
  console.log('\n📁 Source File Analysis');
  console.log('=' .repeat(50));
  
  const srcPath = path.join(__dirname, '..', 'src');
  
  function getDirectorySize(dirPath, dirName = '') {
    let totalSize = 0;
    const files = fs.readdirSync(dirPath);
    const fileDetails = [];
    
    files.forEach(file => {
      const filePath = path.join(dirPath, file);
      const stats = fs.statSync(filePath);
      
      if (stats.isDirectory()) {
        const subDirSize = getDirectorySize(filePath, file);
        fileDetails.push({ name: `${file}/`, size: subDirSize, isDir: true });
        totalSize += subDirSize;
      } else if (file.endsWith('.ts')) {
        const sizeKB = stats.size / 1024;
        fileDetails.push({ name: file, size: sizeKB, isDir: false });
        totalSize += sizeKB;
      }
    });
    
    // Sort by size, largest first
    fileDetails.sort((a, b) => b.size - a.size);
    
    if (dirName) {
      console.log(`\n📂 ${dirName}/ directory:`);
    }
    
    fileDetails.forEach(item => {
      const icon = item.isDir ? '📁' : '📄';
      const size = item.size.toFixed(2);
      console.log(`  ${icon} ${item.name.padEnd(25)} ${size.padStart(8)} KB`);
    });
    
    return totalSize;
  }
  
  const totalSourceSize = getDirectorySize(srcPath);
  console.log(`\n📊 Total Source Size: ${totalSourceSize.toFixed(2)} KB`);
}

if (require.main === module) {
  analyzeBundleComposition();
  analyzeSourceFiles();
}

module.exports = { analyzeBundleComposition, analyzeSourceFiles };