# Contributing to fluxhttp

First off, thank you for considering contributing to fluxhttp! It's people like you that make fluxhttp such a great tool.

## Code of Conduct

This project and everyone participating in it is governed by our Code of Conduct. By participating, you are expected to uphold this code.

## How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check the issue list as you might find out that you don't need to create one. When you are creating a bug report, please include as many details as possible:

* Use a clear and descriptive title
* Describe the exact steps which reproduce the problem
* Provide specific examples to demonstrate the steps
* Describe the behavior you observed after following the steps
* Explain which behavior you expected to see instead and why
* Include code samples and stack traces if applicable

### Suggesting Enhancements

Enhancement suggestions are tracked as GitHub issues. When creating an enhancement suggestion, please include:

* Use a clear and descriptive title
* Provide a step-by-step description of the suggested enhancement
* Provide specific examples to demonstrate the steps
* Describe the current behavior and explain which behavior you expected to see instead
* Explain why this enhancement would be useful

### Pull Requests

* Fork the repo and create your branch from `main`
* If you've added code that should be tested, add tests
* If you've changed APIs, update the documentation
* Ensure the test suite passes
* Make sure your code lints
* Issue that pull request!

## Development Process

1. Clone the repository
   ```bash
   git clone https://github.com/fluxhttp/core.git
   cd fluxhttp
   ```

2. Install dependencies
   ```bash
   npm install
   ```

3. Create a feature branch
   ```bash
   git checkout -b feature/your-feature-name
   ```

4. Make your changes and commit them
   ```bash
   git add .
   git commit -m "feat: add new feature"
   ```

5. Run tests and linting
   ```bash
   npm run test
   npm run lint
   npm run typecheck
   ```

6. Push to your fork and submit a pull request
   ```bash
   git push origin feature/your-feature-name
   ```

## Development Setup

### Prerequisites

* Node.js >= 16.0.0
* npm >= 7.0.0

### Commands

* `npm run build` - Build the library
* `npm run dev` - Build in watch mode
* `npm test` - Run unit tests
* `npm run test:integration` - Run integration tests
* `npm run test:coverage` - Run tests with coverage
* `npm run lint` - Run ESLint
* `npm run lint:fix` - Fix ESLint issues
* `npm run format` - Format code with Prettier
* `npm run typecheck` - Run TypeScript type checking

### Project Structure

```
src/
├── adapters/      # HTTP adapters (fetch, xhr, http)
├── core/          # Core functionality
├── errors/        # Error classes
├── interceptors/  # Request/response interceptors
├── types/         # TypeScript type definitions
└── utils/         # Utility functions

tests/
├── unit/          # Unit tests
├── integration/   # Integration tests
└── e2e/          # End-to-end tests
```

## Coding Style

* We use TypeScript for type safety
* Follow the existing code style
* Use meaningful variable names
* Write self-documenting code
* Add JSDoc comments for public APIs
* Keep functions small and focused

## Commit Messages

We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

* `feat:` New feature
* `fix:` Bug fix
* `docs:` Documentation only changes
* `style:` Code style changes (formatting, etc)
* `refactor:` Code change that neither fixes a bug nor adds a feature
* `perf:` Performance improvement
* `test:` Adding missing tests
* `chore:` Changes to the build process or auxiliary tools

## Testing

* Write tests for all new features
* Ensure all tests pass before submitting PR
* Aim for 100% code coverage
* Include both positive and negative test cases

## Documentation

* Update README.md if needed
* Update API documentation for new features
* Include JSDoc comments for new functions
* Add examples for new features

## License

By contributing, you agree that your contributions will be licensed under the MIT License.