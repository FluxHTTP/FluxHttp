import { ArrowRight, Download, Github } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CodeBlock } from '@/components/code-block';
import Link from 'next/link';

const installationCode = `# npm
npm install @fluxhttp/core

# yarn
yarn add @fluxhttp/core

# pnpm
pnpm add @fluxhttp/core`;

const quickExampleCode = `import fluxhttp from '@fluxhttp/core';

// Simple GET request
const response = await fluxhttp.get('https://api.example.com/users');
console.log(response.data);

// POST request with data
const newUser = await fluxhttp.post('/api/users', {
  name: 'John Doe',
  email: 'john@example.com'
});

// Custom instance with base configuration
const api = fluxhttp.create({
  baseURL: 'https://api.example.com',
  timeout: 5000,
  headers: {
    'Authorization': 'Bearer your-token'
  }
});

// Use the custom instance
const users = await api.get('/users');`;

const features = [
  {
    title: 'Zero Dependencies',
    description: 'No external dependencies means smaller bundle sizes and fewer security vulnerabilities.',
  },
  {
    title: 'TypeScript First',
    description: 'Built with TypeScript from the ground up with complete type definitions.',
  },
  {
    title: 'Universal Compatibility',
    description: 'Works seamlessly in browsers, Node.js, and edge runtime environments.',
  },
  {
    title: 'Modern Architecture',
    description: 'Built on modern JavaScript features with automatic adapter selection.',
  },
  {
    title: 'Built-in Security',
    description: 'CSRF protection, rate limiting, and content validation included.',
  },
  {
    title: 'Performance Optimized',
    description: 'Designed for performance with intelligent caching and request deduplication.',
  },
];

export default function DocsHomePage() {
  return (
    <div className="space-y-12">
      {/* Hero Section */}
      <div className="space-y-6">
        <div>
          <h1 className="text-4xl font-bold mb-4">
            FluxHTTP Documentation
          </h1>
          <p className="text-xl text-muted-foreground max-w-3xl">
            FluxHTTP is a modern, zero-dependency HTTP client for JavaScript and TypeScript. 
            Built for performance, security, and developer experience.
          </p>
        </div>

        <div className="flex flex-wrap gap-4">
          <Link href="/docs/quick-start">
            <Button size="lg">
              Get Started
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
          
          <Button variant="outline" size="lg" asChild>
            <a href="https://github.com/fluxhttp/core" target="_blank" rel="noopener noreferrer">
              <Github className="mr-2 h-4 w-4" />
              View on GitHub
            </a>
          </Button>
          
          <Button variant="outline" size="lg" asChild>
            <a href="https://www.npmjs.com/package/@fluxhttp/core" target="_blank" rel="noopener noreferrer">
              <Download className="mr-2 h-4 w-4" />
              npm Package
            </a>
          </Button>
        </div>
      </div>

      {/* Quick Start */}
      <div className="space-y-6">
        <h2 className="text-2xl font-bold">Quick Start</h2>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Installation</CardTitle>
            </CardHeader>
            <CardContent>
              <CodeBlock code={installationCode} language="bash" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Basic Usage</CardTitle>
            </CardHeader>
            <CardContent>
              <CodeBlock code={quickExampleCode} language="typescript" />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Key Features */}
      <div className="space-y-6">
        <h2 className="text-2xl font-bold">Key Features</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <Card key={index}>
              <CardHeader>
                <CardTitle className="text-lg">{feature.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">{feature.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* What Makes FluxHTTP Different */}
      <div className="space-y-6">
        <h2 className="text-2xl font-bold">What Makes FluxHTTP Different?</h2>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="space-y-4">
            <h3 className="text-xl font-semibold">Zero Dependencies</h3>
            <p className="text-muted-foreground">
              Unlike other HTTP clients that bring in dozens of dependencies, FluxHTTP has zero external dependencies. 
              This means smaller bundle sizes, faster installs, and fewer security vulnerabilities in your dependency tree.
            </p>
            
            <h3 className="text-xl font-semibold">Built for Modern JavaScript</h3>
            <p className="text-muted-foreground">
              FluxHTTP is designed from the ground up for modern JavaScript environments. It automatically selects 
              the best adapter (fetch, XHR, or Node.js http) based on your environment.
            </p>
            
            <h3 className="text-xl font-semibold">TypeScript First</h3>
            <p className="text-muted-foreground">
              Complete TypeScript support with intelligent type inference, generic type parameters, 
              and comprehensive type definitions for all APIs.
            </p>
          </div>
          
          <div className="space-y-4">
            <h3 className="text-xl font-semibold">Security by Default</h3>
            <p className="text-muted-foreground">
              Built-in security features including CSRF protection, rate limiting, content validation, 
              and security headers. No additional configuration required.
            </p>
            
            <h3 className="text-xl font-semibold">Performance Optimized</h3>
            <p className="text-muted-foreground">
              Intelligent caching, request deduplication, retry logic with exponential backoff, 
              and memory-efficient streaming support for large responses.
            </p>
            
            <h3 className="text-xl font-semibold">Developer Experience</h3>
            <p className="text-muted-foreground">
              Familiar API inspired by popular libraries, comprehensive error handling, 
              detailed documentation, and extensive examples.
            </p>
          </div>
        </div>
      </div>

      {/* Next Steps */}
      <div className="space-y-6">
        <h2 className="text-2xl font-bold">Next Steps</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Card className="hover:shadow-md transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center">
                <ArrowRight className="mr-2 h-5 w-5" />
                Installation
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4">
                Get FluxHTTP installed and configured in your project.
              </p>
              <Link href="/docs/installation">
                <Button variant="outline" size="sm">
                  Learn More
                </Button>
              </Link>
            </CardContent>
          </Card>
          
          <Card className="hover:shadow-md transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center">
                <ArrowRight className="mr-2 h-5 w-5" />
                Basic Usage
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4">
                Learn the basics of making HTTP requests with FluxHTTP.
              </p>
              <Link href="/docs/basic-usage">
                <Button variant="outline" size="sm">
                  Learn More
                </Button>
              </Link>
            </CardContent>
          </Card>
          
          <Card className="hover:shadow-md transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center">
                <ArrowRight className="mr-2 h-5 w-5" />
                API Reference
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4">
                Complete API reference with all available methods and options.
              </p>
              <Link href="/docs/api">
                <Button variant="outline" size="sm">
                  Learn More
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}