#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function findTestFiles(dir) {
  const files = [];
  const items = fs.readdirSync(dir);
  
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      files.push(...findTestFiles(fullPath));
    } else if (item.endsWith('.test.js')) {
      files.push(fullPath);
    }
  }
  
  return files;
}

function fixTestFile(filePath) {
  console.log(`Fixing ${filePath}...`);
  
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  
  // Convert require statements to imports
  content = content.replace(
    /const \{ ([^}]+) \} = require\('node:test'\);/,
    "import { $1 } from 'node:test';"
  );
  content = content.replace(
    /const assert = require\('node:assert'\);/,
    "import assert from 'node:assert';"
  );
  
  // Convert fluxhttp require statements
  content = content.replace(
    /const fluxhttp = require\('([^']+)'\);/g,
    "import fluxhttp from '$1';"
  );
  content = content.replace(
    /const \{ ([^}]+) \} = require\('([^']+)'\);/g,
    "import { $1 } from '$2';"
  );
  
  // Add return types to functions
  content = content.replace(
    /\b(beforeEach|afterEach|it)\(([^,]+), \(\) => \{/g,
    '$1($2, (): void => {'
  );
  content = content.replace(
    /\b(beforeEach|afterEach|it)\(([^,]+), async \(\) => \{/g,
    '$1($2, async (): Promise<void> => {'
  );
  
  // Fix function declarations
  content = content.replace(
    /function ([a-zA-Z_][a-zA-Z0-9_]*)\(\) \{/g,
    'function $1(): void {'
  );
  content = content.replace(
    /function ([a-zA-Z_][a-zA-Z0-9_]*)\(([^)]+)\) \{/g,
    'function $1($2): void {'
  );
  
  // Fix arrow functions in class methods
  content = content.replace(
    /(\w+)\(\) \{\}/g,
    '$1(): void {}'
  );
  
  // Fix async arrow functions
  content = content.replace(
    /async \(([^)]*)\) => \(/g,
    'async ($1): Promise<any> => ('
  );
  
  // Fix global type assertions
  content = content.replace(
    /global\.([a-zA-Z_][a-zA-Z0-9_]*) =/g,
    '(global as any).$1 ='
  );
  content = content.replace(
    /delete global\.([a-zA-Z_][a-zA-Z0-9_]*);/g,
    'delete (global as any).$1;'
  );
  content = content.replace(
    /global\.([a-zA-Z_][a-zA-Z0-9_]*)\./g,
    '(global as any).$1.'
  );
  
  // Fix unused parameter names
  content = content.replace(
    /\(([a-zA-Z_][a-zA-Z0-9_]*)\) => \{/g,
    '(_$1) => {'
  );
  content = content.replace(
    /async \(([a-zA-Z_][a-zA-Z0-9_]*)\): Promise<[^>]+> => \{/g,
    'async (_$1): Promise<any> => {'
  );
  
  // Fix response.data type assertions
  content = content.replace(
    /response\.data\.([a-zA-Z_][a-zA-Z0-9_]*)/g,
    '(response.data as any).$1'
  );
  
  // Fix error.response.data type assertions
  content = content.replace(
    /error\.response\.data\.([a-zA-Z_][a-zA-Z0-9_]*)/g,
    '(error.response.data as any).$1'
  );
  
  modified = true;
  
  if (modified) {
    // Rename to .ts extension
    const newPath = filePath.replace('.test.js', '.test.ts');
    fs.writeFileSync(newPath, content);
    
    // Remove old .js file if different
    if (newPath !== filePath) {
      fs.unlinkSync(filePath);
    }
    
    console.log(`✓ Fixed and renamed to ${newPath}`);
  }
}

// Find and fix all test files
const testDirs = ['tests/unit', 'tests/integration'];
for (const testDir of testDirs) {
  if (fs.existsSync(testDir)) {
    const testFiles = findTestFiles(testDir);
    testFiles.forEach(fixTestFile);
  }
}

console.log('All test files have been fixed!');