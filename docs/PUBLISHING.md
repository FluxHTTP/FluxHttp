# Publishing Guide for @fluxhttp/core

This document describes the automated publishing process for the FluxHTTP package.

## 🚀 Quick Start

### Automated GitHub Release (Recommended)

1. **Trigger release via GitHub Actions:**
   ```bash
   # Go to GitHub Actions → Release Pipeline → Run workflow
   # Select release type: patch, minor, major, or beta
   # Choose dry-run: false for actual release
   ```

2. **Manual trigger via CLI:**
   ```bash
   # Install GitHub CLI
   gh workflow run release.yml -f release-type=patch -f dry-run=false
   ```

### Local Development Publishing

```bash
# Dry run (test without publishing)
npm run publish:dry

# Publish patch version (1.0.0 → 1.0.1)
npm run publish:patch

# Publish minor version (1.0.0 → 1.1.0) 
npm run publish:minor

# Publish major version (1.0.0 → 2.0.0)
npm run publish:major

# Publish beta version (1.0.0 → 1.0.1-beta.0)
npm run publish:beta

# Semantic release (based on commit messages)
npm run release:semantic
```

## 📋 Publishing Checklist

Before any release, ensure:

- [ ] All tests pass (`npm run test:all`)
- [ ] TypeScript compiles (`npm run typecheck`)
- [ ] ESLint passes (`npm run lint`)
- [ ] Bundle size is within limits (`npm run size`)
- [ ] Security audit passes (`npm run security:check`)
- [ ] Version is appropriate for changes
- [ ] CHANGELOG.md is updated (automated for semantic releases)
- [ ] Git working directory is clean

## 🔄 Release Types

### Patch Release (1.0.0 → 1.0.1)
- **When**: Bug fixes, security patches, performance improvements
- **Command**: `npm run publish:patch`
- **Automatic**: `fix:`, `perf:` commits

### Minor Release (1.0.0 → 1.1.0)
- **When**: New features, new APIs (backward compatible)
- **Command**: `npm run publish:minor`
- **Automatic**: `feat:` commits

### Major Release (1.0.0 → 2.0.0)
- **When**: Breaking changes, API changes
- **Command**: `npm run publish:major`
- **Automatic**: `BREAKING CHANGE:` in commit body

### Beta Release (1.0.0 → 1.0.1-beta.0)
- **When**: Testing new features before stable release
- **Command**: `npm run publish:beta`
- **NPM Tag**: `beta` (install with `npm install @fluxhttp/core@beta`)

## 🤖 Automated Workflows

### GitHub Actions Release Pipeline

**Trigger**: Manual workflow dispatch or semantic release

**Process**:
1. **Pre-Release Validation**
   - Run full test suite
   - TypeScript compilation
   - ESLint validation
   - Security audit
   - Bundle size check
   - Package integrity validation

2. **Version Calculation**
   - Determine next version based on release type
   - Generate changelog from git commits

3. **Release Creation**
   - Update package.json version
   - Build production assets
   - Create git tag
   - Create GitHub release with changelog

4. **NPM Publication**
   - Publish to NPM registry
   - Use appropriate tag (latest/beta)
   - Verify publication success

5. **Post-Release Tasks**
   - Update documentation
   - Notify of success/failure
   - Update release tracking

### Semantic Release (Convention-Based)

**Commit Format**: `type(scope): description`

**Examples**:
```bash
# Patch release
git commit -m "fix: resolve memory leak in interceptor cleanup"

# Minor release  
git commit -m "feat: add WebSocket integration support"

# Major release
git commit -m "feat!: redesign API for better TypeScript support

BREAKING CHANGE: The request config interface has changed.
See migration guide for details."
```

**Types**:
- `feat:` → Minor release (new feature)
- `fix:` → Patch release (bug fix)
- `perf:` → Patch release (performance improvement)
- `refactor:` → Patch release (code refactoring)
- `docs:` → No release (documentation only)
- `test:` → No release (tests only)
- `build:`, `ci:`, `chore:` → No release

## 🔒 Security and Access Control

### Required Secrets

**GitHub Repository Secrets**:
- `NPM_TOKEN` - NPM publishing token with write access
- `GITHUB_TOKEN` - Automatically provided by GitHub Actions

### NPM Token Setup

1. **Create NPM Token**:
   ```bash
   npm login
   npm token create --type=automation --cidr=0.0.0.0/0
   ```

2. **Add to GitHub Secrets**:
   - Go to Repository → Settings → Secrets and variables → Actions
   - Add `NPM_TOKEN` with the token value

### Publishing Permissions

- **NPM**: Must be logged in with publish access to `@fluxhttp` scope
- **GitHub**: Must have write access to repository
- **Git**: Must have push access to main branch

## 📊 Release Monitoring

### Verification Steps

After each release, the system automatically:

1. **Verify NPM Publication**
   ```bash
   npm view @fluxhttp/core version
   ```

2. **Check Package Installation**
   ```bash
   npm install @fluxhttp/core@latest
   ```

3. **Validate Bundle Integrity**
   ```bash
   npm pack @fluxhttp/core
   tar -tf fluxhttp-core-*.tgz
   ```

### Rollback Procedures

**If release fails**:

1. **Remove Git Tag**:
   ```bash
   git tag -d v1.2.3
   git push origin :refs/tags/v1.2.3
   ```

2. **Delete GitHub Release**:
   - Go to Releases → Edit → Delete release

3. **Unpublish from NPM** (within 24 hours):
   ```bash
   npm unpublish @fluxhttp/core@1.2.3
   ```

4. **Revert Version in package.json**:
   ```bash
   git checkout HEAD~1 package.json
   git commit -m "revert: rollback failed release"
   ```

## 🔍 Troubleshooting

### Common Issues

**1. Tests Failing in CI**
```bash
# Run tests locally first
npm run test:all
npm run test:coverage

# Check for environment differences
npm run test:integration -- --verbose
```

**2. Bundle Size Exceeded**
```bash
# Analyze bundle size
npm run size
npm run benchmark:bundle

# Check for new dependencies
npm run build -- --analyze
```

**3. NPM Publication Timeout**
```bash
# Check NPM status
npm ping
npm view @fluxhttp/core

# Retry publication
npm publish --registry https://registry.npmjs.org/
```

**4. TypeScript Compilation Errors**
```bash
# Check TypeScript configuration
npm run typecheck -- --listFiles
npm run build -- --verbose
```

### Emergency Procedures

**Critical Security Issue**:
1. Immediately unpublish affected versions
2. Create security patch
3. Fast-track patch release
4. Notify users via GitHub security advisory

**Build System Failure**:
1. Use local publishing scripts as fallback
2. Verify all checks manually
3. Publish with increased monitoring

## 📈 Release Metrics

### Tracking Success

- **Release Frequency**: Target weekly patch releases
- **Time to Release**: < 10 minutes for automated releases
- **Failure Rate**: < 5% of releases should fail
- **Bundle Size**: Maintain < 16KB for CJS, < 12KB for ESM
- **Test Coverage**: Maintain 100% coverage

### Performance Monitoring

```bash
# Bundle size tracking
npm run size

# Performance benchmarks
npm run benchmark:report

# Memory usage analysis
npm run benchmark:memory
```

## 🤝 Contributing to Release Process

### Improving the Pipeline

1. **Update GitHub Actions**:
   - Edit `.github/workflows/release.yml`
   - Test with dry-run releases
   - Update documentation

2. **Enhance Publishing Scripts**:
   - Modify `scripts/publish.js`
   - Add new validation steps
   - Improve error handling

3. **Update Semantic Release Config**:
   - Edit `.releaserc.json`
   - Add new commit types
   - Customize changelog format

### Best Practices

- **Test all changes** with dry-run releases first
- **Document any modifications** to the release process
- **Coordinate with team** before making breaking changes to CI/CD
- **Monitor releases** for the first 24 hours after changes

## 📚 Additional Resources

- [NPM Publishing Best Practices](https://docs.npmjs.com/packages-and-modules/contributing-packages-to-the-registry)
- [Semantic Versioning Specification](https://semver.org/)
- [Conventional Commits](https://www.conventionalcommits.org/)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Semantic Release Documentation](https://semantic-release.gitbook.io/)

---

For questions about the publishing process, please:
1. Check this documentation first
2. Review recent releases for examples
3. Create an issue with the `release` label
4. Contact the maintainers for urgent issues