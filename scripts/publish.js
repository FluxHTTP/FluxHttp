#!/usr/bin/env node

/**
 * @fileoverview Automated publishing script for @fluxhttp/core
 * This script handles local publishing, version management, and package validation
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Colors for terminal output
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

function log(message, color = colors.white) {
  console.log(`${color}${message}${colors.reset}`);
}

function logStep(step, message) {
  log(`\n${colors.bold}${colors.cyan}[${step}]${colors.reset} ${message}`);
}

function logSuccess(message) {
  log(`${colors.green}✅ ${message}${colors.reset}`);
}

function logError(message) {
  log(`${colors.red}❌ ${message}${colors.reset}`);
}

function logWarning(message) {
  log(`${colors.yellow}⚠️  ${message}${colors.reset}`);
}

function execCommand(command, options = {}) {
  try {
    const result = execSync(command, { 
      encoding: 'utf8', 
      stdio: options.silent ? 'pipe' : 'inherit',
      ...options 
    });
    return result;
  } catch (error) {
    if (!options.ignoreErrors) {
      logError(`Command failed: ${command}`);
      logError(error.message);
      process.exit(1);
    }
    return null;
  }
}

function getPackageVersion() {
  const packagePath = path.join(__dirname, '..', 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  return packageJson.version;
}

function updatePackageVersion(newVersion) {
  const packagePath = path.join(__dirname, '..', 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  packageJson.version = newVersion;
  fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2) + '\n');
}

function validateEnvironment() {
  logStep('ENV', 'Validating environment...');
  
  // Check Node.js version
  const nodeVersion = process.version;
  const requiredVersion = 'v16.0.0';
  if (nodeVersion < requiredVersion) {
    logError(`Node.js ${requiredVersion} or higher is required. Current: ${nodeVersion}`);
    process.exit(1);
  }
  logSuccess(`Node.js version: ${nodeVersion}`);
  
  // Check npm login status
  try {
    const whoami = execCommand('npm whoami', { silent: true });
    logSuccess(`Logged in as: ${whoami.trim()}`);
  } catch {
    logError('Not logged in to npm. Run: npm login');
    process.exit(1);
  }
  
  // Check git status
  try {
    const status = execCommand('git status --porcelain', { silent: true });
    if (status.trim()) {
      logWarning('Working directory has uncommitted changes');
      log('Uncommitted changes:');
      log(status);
    } else {
      logSuccess('Working directory is clean');
    }
  } catch {
    logWarning('Not in a git repository');
  }
}

function runPrePublishChecks() {
  logStep('CHECKS', 'Running pre-publish validation...');
  
  // TypeScript check
  logStep('CHECKS', 'Running TypeScript validation...');
  execCommand('npm run typecheck');
  logSuccess('TypeScript validation passed');
  
  // Linting
  logStep('CHECKS', 'Running ESLint...');
  execCommand('npm run lint');
  logSuccess('ESLint validation passed');
  
  // Build
  logStep('CHECKS', 'Building package...');
  execCommand('npm run build');
  logSuccess('Build completed');
  
  // Tests
  logStep('CHECKS', 'Running tests...');
  execCommand('npm run test:all');
  logSuccess('All tests passed');
  
  // Security audit
  logStep('CHECKS', 'Running security audit...');
  execCommand('npm run security:check');
  logSuccess('Security audit passed');
  
  // Bundle size check
  logStep('CHECKS', 'Checking bundle size...');
  execCommand('npm run size');
  logSuccess('Bundle size validation passed');
}

function calculateNextVersion(currentVersion, releaseType) {
  const [major, minor, patch] = currentVersion.split('.').map(Number);
  
  switch (releaseType) {
    case 'major':
      return `${major + 1}.0.0`;
    case 'minor':
      return `${major}.${minor + 1}.0`;
    case 'patch':
      return `${major}.${minor}.${patch + 1}`;
    case 'beta':
      return `${major}.${minor}.${patch + 1}-beta.0`;
    default:
      throw new Error(`Invalid release type: ${releaseType}`);
  }
}

function validatePackage() {
  logStep('VALIDATE', 'Validating package structure...');
  
  // Check required files exist
  const requiredFiles = [
    'dist/index.js',
    'dist/index.mjs',
    'dist/index.d.ts',
    'package.json',
    'README.md',
    'LICENSE'
  ];
  
  for (const file of requiredFiles) {
    const filePath = path.join(__dirname, '..', file);
    if (!fs.existsSync(filePath)) {
      logError(`Required file missing: ${file}`);
      process.exit(1);
    }
  }
  logSuccess('All required files present');
  
  // Validate package.json
  const packagePath = path.join(__dirname, '..', 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  
  const requiredFields = ['name', 'version', 'description', 'main', 'module', 'types'];
  for (const field of requiredFields) {
    if (!packageJson[field]) {
      logError(`Missing required package.json field: ${field}`);
      process.exit(1);
    }
  }
  logSuccess('package.json validation passed');
  
  // Test package installation
  logStep('VALIDATE', 'Testing package installation...');
  execCommand('npm pack --dry-run');
  logSuccess('Package validation passed');
}

function publishPackage(releaseType, dryRun = false) {
  const currentVersion = getPackageVersion();
  const nextVersion = calculateNextVersion(currentVersion, releaseType);
  
  logStep('PUBLISH', `Publishing ${releaseType} release: ${currentVersion} → ${nextVersion}`);
  
  if (dryRun) {
    logWarning('DRY RUN MODE - No actual publishing will occur');
  }
  
  // Update version
  if (!dryRun) {
    updatePackageVersion(nextVersion);
    logSuccess(`Version updated to ${nextVersion}`);
  }
  
  // Create git tag
  if (!dryRun) {
    try {
      execCommand(`git add package.json`);
      execCommand(`git commit -m "chore: release v${nextVersion}"`);
      execCommand(`git tag v${nextVersion}`);
      logSuccess(`Git tag created: v${nextVersion}`);
    } catch (error) {
      logWarning('Git operations failed (this is okay for testing)');
    }
  }
  
  // Publish to npm
  const publishCommand = releaseType === 'beta' 
    ? 'npm publish --tag beta'
    : 'npm publish';
  
  if (dryRun) {
    log(`Would run: ${publishCommand}`);
  } else {
    execCommand(publishCommand);
    logSuccess(`Package published to npm: @fluxhttp/core@${nextVersion}`);
  }
  
  // Verify publication
  if (!dryRun) {
    logStep('VERIFY', 'Verifying publication...');
    setTimeout(() => {
      try {
        const publishedVersion = execCommand('npm view @fluxhttp/core version', { silent: true }).trim();
        if (publishedVersion === nextVersion) {
          logSuccess(`Publication verified: @fluxhttp/core@${publishedVersion}`);
        } else {
          logWarning(`Version mismatch. Expected: ${nextVersion}, Found: ${publishedVersion}`);
        }
      } catch (error) {
        logWarning('Could not verify publication (npm may be slow to update)');
      }
    }, 10000);
  }
  
  return nextVersion;
}

function showUsage() {
  log(`
${colors.bold}${colors.cyan}FluxHTTP Publishing Script${colors.reset}

Usage: node scripts/publish.js [options] <release-type>

Release Types:
  ${colors.green}patch${colors.reset}   - Bug fixes (1.0.0 → 1.0.1)
  ${colors.green}minor${colors.reset}   - New features (1.0.0 → 1.1.0) 
  ${colors.green}major${colors.reset}   - Breaking changes (1.0.0 → 2.0.0)
  ${colors.green}beta${colors.reset}    - Beta release (1.0.0 → 1.0.1-beta.0)

Options:
  ${colors.yellow}--dry-run${colors.reset}    - Validate without publishing
  ${colors.yellow}--skip-checks${colors.reset} - Skip pre-publish validation
  ${colors.yellow}--help${colors.reset}       - Show this help message

Examples:
  ${colors.cyan}node scripts/publish.js patch${colors.reset}
  ${colors.cyan}node scripts/publish.js minor --dry-run${colors.reset}
  ${colors.cyan}node scripts/publish.js beta${colors.reset}

Environment Variables:
  ${colors.yellow}NPM_TOKEN${colors.reset}    - NPM authentication token (for CI)
  ${colors.yellow}CI${colors.reset}           - Set to 'true' for CI mode
`);
}

function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.length === 0) {
    showUsage();
    return;
  }
  
  const dryRun = args.includes('--dry-run');
  const skipChecks = args.includes('--skip-checks');
  const releaseType = args.find(arg => !arg.startsWith('--'));
  
  if (!releaseType || !['patch', 'minor', 'major', 'beta'].includes(releaseType)) {
    logError('Invalid or missing release type');
    showUsage();
    process.exit(1);
  }
  
  try {
    log(`${colors.bold}${colors.magenta}🚀 FluxHTTP Publishing Pipeline${colors.reset}`);
    log(`${colors.cyan}Release Type: ${releaseType}${colors.reset}`);
    log(`${colors.cyan}Dry Run: ${dryRun}${colors.reset}`);
    
    // Step 1: Environment validation
    validateEnvironment();
    
    // Step 2: Pre-publish checks
    if (!skipChecks) {
      runPrePublishChecks();
    } else {
      logWarning('Skipping pre-publish checks');
    }
    
    // Step 3: Package validation
    validatePackage();
    
    // Step 4: Publishing
    const newVersion = publishPackage(releaseType, dryRun);
    
    // Success summary
    log(`\n${colors.bold}${colors.green}🎉 Publication ${dryRun ? 'simulation' : 'completed'} successfully!${colors.reset}`);
    log(`${colors.cyan}Version: ${newVersion}${colors.reset}`);
    
    if (!dryRun) {
      log(`${colors.cyan}Install: npm install @fluxhttp/core@${newVersion}${colors.reset}`);
      log(`${colors.cyan}NPM: https://www.npmjs.com/package/@fluxhttp/core${colors.reset}`);
    }
    
  } catch (error) {
    logError(`Publication failed: ${error.message}`);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  log('\n\n🛑 Publishing interrupted by user');
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  logError(`Uncaught exception: ${error.message}`);
  process.exit(1);
});

if (require.main === module) {
  main();
}

module.exports = {
  validateEnvironment,
  runPrePublishChecks,
  validatePackage,
  publishPackage
};