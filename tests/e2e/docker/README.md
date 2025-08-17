# FluxHTTP E2E Testing with Docker

This directory contains Docker configurations for running FluxHTTP End-to-End (E2E) tests in isolated, consistent environments.

## Quick Start

### Run All E2E Tests
```bash
# From the project root
cd tests/e2e/docker

# Start test servers and run all E2E tests
docker-compose --profile testing up --build

# Or run specific test suites
docker-compose --profile auth-tests up --build
docker-compose --profile performance-tests up --build
docker-compose --profile security-tests up --build
```

### Development Mode
```bash
# Start in development mode with hot reload
docker-compose -f docker-compose.yml -f docker-compose.override.yml up --build

# Run tests in watch mode
docker-compose --profile watch up
```

### View Test Results
```bash
# Start the test results server
docker-compose --profile reports up test-results-server

# Open http://localhost:8080 to view test reports
```

## Architecture

### Services

#### Core Services
- **test-server**: Main HTTP server providing endpoints for E2E tests
- **mock-api-server**: Mock external API server for integration testing
- **e2e-runner**: Playwright test runner with all browsers installed

#### Test Suite Specific Services
- **e2e-auth**: Authentication and authorization tests
- **e2e-files**: File upload/download operation tests
- **e2e-performance**: Performance and load testing
- **e2e-security**: Security vulnerability testing

#### Browser Specific Services
- **e2e-chromium**: Tests running on Chromium
- **e2e-firefox**: Tests running on Firefox
- **e2e-webkit**: Tests running on WebKit

#### Support Services
- **test-results-server**: Nginx server for viewing test reports
- **test-database**: PostgreSQL for data-dependent tests
- **test-redis**: Redis for caching/session tests
- **test-monitor**: Prometheus for metrics collection

### Profiles

Services are organized into profiles for selective execution:

- `testing`: Core test execution services
- `auth-tests`: Authentication specific tests
- `file-tests`: File operation tests
- `performance-tests`: Performance and reliability tests
- `security-tests`: Security testing
- `browser-tests`: Browser-specific test runs
- `reports`: Test result viewing
- `database`: Database-dependent tests
- `cache`: Cache-dependent tests
- `monitoring`: Metrics and monitoring
- `dev-tools`: Development utilities
- `watch`: File watching for development
- `debug`: Debug mode with additional tools

## Usage Examples

### Run Specific Test Suites

```bash
# Authentication tests only
docker-compose --profile auth-tests up --build

# Performance tests with monitoring
docker-compose --profile performance-tests --profile monitoring up --build

# Security tests with database
docker-compose --profile security-tests --profile database up --build
```

### Browser-Specific Testing

```bash
# Test on all browsers
docker-compose --profile browser-tests up --build

# Test on specific browser
docker-compose up e2e-chromium --build
```

### Development Workflow

```bash
# Start development environment
docker-compose -f docker-compose.yml -f docker-compose.override.yml up --build

# In another terminal, run specific tests
docker-compose exec e2e-runner npm run test:e2e -- tests/e2e/specs/auth-flows.spec.ts

# Debug tests
docker-compose --profile debug up
```

### Monitoring and Metrics

```bash
# Start with monitoring
docker-compose --profile monitoring up --build

# View metrics at http://localhost:9090 (Prometheus)
# View test results at http://localhost:8080 (Nginx)
```

## Configuration

### Environment Variables

Set these environment variables to customize the test environment:

```bash
# Test configuration
export E2E_TEST_MODE=true
export NODE_ENV=test
export CI=true

# Server URLs
export BASE_URL=http://test-server:3000
export API_URL=http://mock-api-server:3001

# Test timeouts
export PLAYWRIGHT_TIMEOUT=60000
export TEST_TIMEOUT=120000

# Database configuration (if using database profile)
export POSTGRES_DB=fluxhttp_test
export POSTGRES_USER=test_user
export POSTGRES_PASSWORD=test_password

# Redis configuration (if using cache profile)
export REDIS_URL=redis://test-redis:6379
```

### Volume Mounts

The Docker setup uses several volumes:

- `test-results`: Test output, reports, and artifacts
- `test-uploads`: File upload testing directory
- `test-static`: Static test files
- `test-db-data`: PostgreSQL data (persistent)
- `test-redis-data`: Redis data (persistent)
- `test-metrics-data`: Prometheus metrics (persistent)

### Network Configuration

All services run on the `fluxhttp-test-network` bridge network with subnet `172.20.0.0/16`.

## Files Overview

### Dockerfiles
- `Dockerfile.test-server`: Multi-stage build for test servers
- `Dockerfile.e2e-runner`: Playwright test runner with browsers

### Compose Files
- `docker-compose.yml`: Main service definitions
- `docker-compose.override.yml`: Development overrides

### Configuration Files
- `nginx.conf`: Nginx configuration for test results server
- `init-db.sql`: PostgreSQL initialization script
- `prometheus.yml`: Prometheus monitoring configuration

## Debugging

### View Logs

```bash
# View logs for all services
docker-compose logs

# View logs for specific service
docker-compose logs test-server
docker-compose logs e2e-runner

# Follow logs in real-time
docker-compose logs -f e2e-runner
```

### Interactive Debugging

```bash
# Start debug container
docker-compose --profile debug up debug-runner

# Execute shell in running container
docker-compose exec e2e-runner sh

# Run tests with debug output
docker-compose exec e2e-runner npm run test:e2e:debug
```

### Health Checks

All services include health checks. Check service status:

```bash
docker-compose ps
```

### Resource Monitoring

```bash
# View resource usage
docker stats

# View detailed container info
docker-compose exec e2e-runner cat /proc/meminfo
docker-compose exec e2e-runner df -h
```

## CI/CD Integration

### GitHub Actions

The Docker setup integrates with GitHub Actions workflows:

```yaml
# Example workflow step
- name: Run E2E tests in Docker
  run: |
    cd tests/e2e/docker
    docker-compose --profile testing up --build --abort-on-container-exit
    docker-compose down
```

### Custom CI Environments

For other CI systems, use:

```bash
# Production-like testing
docker-compose -f docker-compose.yml up --build --abort-on-container-exit

# Clean up after tests
docker-compose down --volumes --remove-orphans
```

## Troubleshooting

### Common Issues

1. **Port conflicts**: Change ports in docker-compose.yml if 3000/3001/8080 are in use
2. **Memory issues**: Increase Docker memory limit for performance tests
3. **Browser crashes**: Ensure sufficient memory allocation for Playwright
4. **Network issues**: Check firewall settings for Docker networks

### Clean Up

```bash
# Stop all services
docker-compose down

# Remove volumes (data will be lost)
docker-compose down --volumes

# Remove images
docker-compose down --rmi all

# Complete cleanup
docker-compose down --volumes --remove-orphans --rmi all
```

### Performance Tuning

For better performance:

1. Increase Docker memory limits
2. Use SSD storage for volumes
3. Adjust worker counts in compose files
4. Use `--parallel` flag for docker-compose

## Security Considerations

- All containers run as non-root users
- Network isolation between test environments
- Secrets should be passed via environment variables
- Test data is isolated and automatically cleaned up
- No production credentials should be used

## Contributing

When adding new test scenarios:

1. Update appropriate Dockerfile if new dependencies are needed
2. Add new service definitions to docker-compose.yml
3. Update this README with new usage instructions
4. Add appropriate health checks and resource limits
5. Test locally before committing