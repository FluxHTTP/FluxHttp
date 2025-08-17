# FluxHTTP Documentation Site Deployment Guide

This guide explains how to deploy the FluxHTTP documentation site to various platforms.

## Quick Start

```bash
# Install dependencies
cd docs-site
npm install

# Development
npm run dev

# Production build
npm run build
```

## Deployment Platforms

### 1. GitHub Pages (Recommended)

The site is pre-configured for GitHub Pages deployment using GitHub Actions.

#### Setup:

1. **Enable GitHub Pages:**
   - Go to repository Settings → Pages
   - Source: "GitHub Actions"
   - The workflow in `.github/workflows/deploy.yml` will handle deployment

2. **Automatic Deployment:**
   - Push to `main` branch triggers automatic deployment
   - Site will be available at: `https://[username].github.io/[repository-name]/`

#### Manual Deployment:

```bash
# Build and export
npm run build

# The static files will be in the 'out' directory
# Upload the contents to your web server
```

### 2. Netlify

#### Option A: Git Integration
1. Connect your GitHub repository to Netlify
2. Set build settings:
   - Build command: `cd docs-site && npm run build`
   - Publish directory: `docs-site/out`
   - Node version: 18

#### Option B: Manual Deploy
```bash
# Build the site
npm run build

# Install Netlify CLI
npm install -g netlify-cli

# Deploy
netlify deploy --prod --dir=out
```

### 3. Vercel

#### Option A: Git Integration
1. Connect your GitHub repository to Vercel
2. Set the root directory to `docs-site`
3. Vercel will auto-detect Next.js and configure deployment

#### Option B: CLI Deploy
```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel --prod
```

### 4. Cloudflare Pages

1. Connect your GitHub repository to Cloudflare Pages
2. Set build settings:
   - Build command: `cd docs-site && npm run build`
   - Build output directory: `docs-site/out`
   - Root directory: `/`

### 5. Custom Server

For custom server deployment:

```bash
# Build the static site
npm run build

# Copy the 'out' directory contents to your web server
cp -r out/* /var/www/html/

# Or use rsync for remote deployment
rsync -avz out/ user@server:/var/www/html/
```

## Environment Configuration

### Production Environment Variables

Create a `.env.production` file if needed:

```bash
# Example environment variables
NEXT_PUBLIC_SITE_URL=https://fluxhttp.github.io/docs
NEXT_PUBLIC_GA_ID=G-XXXXXXXXXX
```

### Build Configuration

The site is configured for static export in `next.config.js`:

```javascript
module.exports = {
  output: 'export',
  basePath: process.env.NODE_ENV === 'production' ? '/fluxhttp-docs' : '',
  assetPrefix: process.env.NODE_ENV === 'production' ? '/fluxhttp-docs/' : '',
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
};
```

## Domain Configuration

### Custom Domain Setup

For custom domains (e.g., `docs.fluxhttp.com`):

1. **GitHub Pages:**
   - Add `CNAME` file with your domain
   - Configure DNS CNAME record

2. **Netlify:**
   - Add custom domain in site settings
   - Follow DNS configuration instructions

3. **Vercel:**
   - Add domain in project settings
   - Configure DNS records as instructed

### DNS Configuration

Example DNS records for `docs.fluxhttp.com`:

```
# For GitHub Pages
CNAME docs fluxhttp.github.io

# For Netlify
CNAME docs amazing-site-name.netlify.app

# For Vercel
CNAME docs project-name.vercel.app
```

## Performance Optimization

### Build Optimization

```bash
# Analyze bundle size
npm run build
npm run size

# Enable compression (if supported by hosting)
# Most platforms enable this automatically
```

### CDN Configuration

For better performance, consider:

1. **Image Optimization:**
   - Images are already optimized for static export
   - Consider using a CDN for better global performance

2. **Caching Headers:**
   ```
   # Static assets
   Cache-Control: public, max-age=31536000, immutable

   # HTML files
   Cache-Control: public, max-age=0, must-revalidate
   ```

## Monitoring and Analytics

### Google Analytics

Add to `.env.production`:

```bash
NEXT_PUBLIC_GA_ID=G-XXXXXXXXXX
```

### Performance Monitoring

Consider adding:
- Google PageSpeed Insights monitoring
- Lighthouse CI for build-time performance checks
- Real User Monitoring (RUM) tools

## Troubleshooting

### Common Issues

1. **Build Failures:**
   ```bash
   # Clear cache and rebuild
   rm -rf .next out node_modules
   npm install
   npm run build
   ```

2. **Path Issues:**
   - Check `basePath` configuration in `next.config.js`
   - Ensure all internal links use relative paths

3. **Missing Dependencies:**
   ```bash
   # Install missing peer dependencies
   npm install --legacy-peer-deps
   ```

### Debug Mode

Enable debug logging:

```bash
# Build with debug info
DEBUG=next:* npm run build

# Check bundle analysis
npm run build -- --debug
```

## Security Considerations

### Content Security Policy

Add CSP headers for production:

```
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' https://www.googletagmanager.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:;
```

### HTTPS

Ensure HTTPS is enabled:
- GitHub Pages: Automatic
- Netlify: Automatic
- Vercel: Automatic
- Custom servers: Configure SSL certificates

## Maintenance

### Updates

Regular maintenance tasks:

```bash
# Update dependencies
npm update

# Security audit
npm audit
npm audit fix

# Check for outdated packages
npm outdated
```

### Backup

For important deployments:
- Regular repository backups
- Export content/configuration
- Document deployment procedures

## Support

For deployment issues:

1. Check the [GitHub Issues](https://github.com/fluxhttp/core/issues)
2. Review platform-specific documentation
3. Contact the FluxHTTP team for assistance

## Automation

### CI/CD Pipeline

The included GitHub Actions workflow:
- Runs on every push to main
- Performs linting and type checking
- Builds and deploys automatically
- Includes error reporting

### Custom Workflows

Extend the deployment pipeline:

```yaml
# .github/workflows/deploy.yml
- name: Run tests
  run: npm test

- name: Performance audit
  run: npm run lighthouse

- name: Security scan
  run: npm audit
```

This completes the comprehensive deployment guide for the FluxHTTP documentation site.