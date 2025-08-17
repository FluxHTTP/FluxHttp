import { ArrowRight, Play, Code, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CodeBlock } from '@/components/code-block';
import Link from 'next/link';

const basicExample = `import fluxhttp from '@fluxhttp/core';

// GET request
const response = await fluxhttp.get('https://jsonplaceholder.typicode.com/posts/1');
console.log(response.data);

// POST request
const newPost = await fluxhttp.post('https://jsonplaceholder.typicode.com/posts', {
  title: 'My New Post',
  body: 'This is the content of my post',
  userId: 1
});
console.log(newPost.data);`;

const instanceExample = `import fluxhttp from '@fluxhttp/core';

// Create a custom instance
const api = fluxhttp.create({
  baseURL: 'https://jsonplaceholder.typicode.com',
  timeout: 5000,
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer your-token-here'
  }
});

// Use the custom instance
const posts = await api.get('/posts');
const user = await api.get('/users/1');
const newPost = await api.post('/posts', {
  title: 'Hello World',
  body: 'My first post',
  userId: 1
});`;

const errorHandlingExample = `import fluxhttp, { fluxhttpError } from '@fluxhttp/core';

try {
  const response = await fluxhttp.get('https://api.example.com/data');
  console.log('Success:', response.data);
} catch (error) {
  if (error instanceof fluxhttpError) {
    // Handle HTTP errors
    console.error('HTTP Error:', error.response?.status);
    console.error('Error Data:', error.response?.data);
  } else {
    // Handle other errors (network, timeout, etc.)
    console.error('Request Error:', error.message);
  }
}`;

const interceptorExample = `import fluxhttp from '@fluxhttp/core';

// Add request interceptor
fluxhttp.interceptors.request.use(
  (config) => {
    // Add auth token to every request
    config.headers.Authorization = \`Bearer \${getAuthToken()}\`;
    console.log('Sending request to:', config.url);
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add response interceptor
fluxhttp.interceptors.response.use(
  (response) => {
    console.log('Received response:', response.status);
    return response;
  },
  (error) => {
    if (error.response?.status === 401) {
      // Handle unauthorized errors
      redirectToLogin();
    }
    return Promise.reject(error);
  }
);`;

const steps = [
  {
    number: 1,
    title: 'Install FluxHTTP',
    description: 'Add FluxHTTP to your project using your preferred package manager.',
    code: 'npm install @fluxhttp/core',
  },
  {
    number: 2,
    title: 'Import and Use',
    description: 'Import FluxHTTP and start making HTTP requests immediately.',
    code: `import fluxhttp from '@fluxhttp/core';

const response = await fluxhttp.get('https://api.example.com/data');`,
  },
  {
    number: 3,
    title: 'Configure (Optional)',
    description: 'Create custom instances with your preferred configuration.',
    code: `const api = fluxhttp.create({
  baseURL: 'https://api.example.com',
  timeout: 5000
});`,
  },
];

export default function QuickStartPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-4">Quick Start Guide</h1>
        <p className="text-lg text-muted-foreground">
          Get up and running with FluxHTTP in less than 5 minutes. This guide will walk you through 
          the basics of making HTTP requests, configuring instances, and handling errors.
        </p>
      </div>

      {/* Step-by-step guide */}
      <div className="space-y-8">
        <h2 className="text-2xl font-bold">Getting Started</h2>
        
        {steps.map((step, index) => (
          <Card key={index} className="relative">
            <CardHeader>
              <div className="flex items-center">
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground font-bold text-sm mr-4">
                  {step.number}
                </div>
                <CardTitle className="text-xl">{step.title}</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4">{step.description}</p>
              <CodeBlock code={step.code} language={index === 0 ? 'bash' : 'typescript'} />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Basic Usage */}
      <div className="space-y-4">
        <h2 className="text-2xl font-bold flex items-center">
          <Code className="mr-2 h-6 w-6" />
          Basic Usage
        </h2>
        <p className="text-muted-foreground">
          FluxHTTP provides a simple API for making HTTP requests. Here are the most common patterns:
        </p>
        
        <Card>
          <CardHeader>
            <CardTitle>Simple Requests</CardTitle>
          </CardHeader>
          <CardContent>
            <CodeBlock code={basicExample} language="typescript" showLineNumbers />
          </CardContent>
        </Card>
      </div>

      {/* Creating Instances */}
      <div className="space-y-4">
        <h2 className="text-2xl font-bold">Creating Custom Instances</h2>
        <p className="text-muted-foreground">
          For applications that make multiple requests to the same API, creating a custom instance 
          with shared configuration is recommended:
        </p>
        
        <Card>
          <CardHeader>
            <CardTitle>Custom Instance</CardTitle>
          </CardHeader>
          <CardContent>
            <CodeBlock code={instanceExample} language="typescript" showLineNumbers />
          </CardContent>
        </Card>
      </div>

      {/* Error Handling */}
      <div className="space-y-4">
        <h2 className="text-2xl font-bold">Error Handling</h2>
        <p className="text-muted-foreground">
          FluxHTTP provides comprehensive error handling with detailed error information:
        </p>
        
        <Card>
          <CardHeader>
            <CardTitle>Handling Errors</CardTitle>
          </CardHeader>
          <CardContent>
            <CodeBlock code={errorHandlingExample} language="typescript" showLineNumbers />
          </CardContent>
        </Card>
      </div>

      {/* Interceptors */}
      <div className="space-y-4">
        <h2 className="text-2xl font-bold">Interceptors</h2>
        <p className="text-muted-foreground">
          Use interceptors to transform requests and responses automatically:
        </p>
        
        <Card>
          <CardHeader>
            <CardTitle>Request & Response Interceptors</CardTitle>
          </CardHeader>
          <CardContent>
            <CodeBlock code={interceptorExample} language="typescript" showLineNumbers />
          </CardContent>
        </Card>
      </div>

      {/* Key Features */}
      <div className="space-y-4">
        <h2 className="text-2xl font-bold flex items-center">
          <Zap className="mr-2 h-6 w-6" />
          Key Features
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Zero Dependencies</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                No external dependencies means smaller bundle sizes and fewer security vulnerabilities.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">TypeScript Support</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Built with TypeScript from the ground up with complete type definitions.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Universal Compatibility</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Works seamlessly in browsers, Node.js, and edge runtime environments.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Built-in Security</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                CSRF protection, rate limiting, and content validation included by default.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Automatic Retry</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Configurable retry logic with exponential backoff for failed requests.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Smart Caching</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Intelligent caching and request deduplication to improve performance.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Next Steps */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Play className="mr-2 h-5 w-5" />
            Next Steps
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground mb-6">
            Now that you've got the basics down, explore more advanced features and configurations:
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Link href="/docs/basic-usage">
              <Button variant="outline" className="w-full justify-start h-auto p-4">
                <div className="text-left">
                  <div className="font-medium">Basic Usage</div>
                  <div className="text-sm text-muted-foreground">
                    Learn all HTTP methods and options
                  </div>
                </div>
                <ArrowRight className="ml-auto h-4 w-4" />
              </Button>
            </Link>
            
            <Link href="/docs/configuration">
              <Button variant="outline" className="w-full justify-start h-auto p-4">
                <div className="text-left">
                  <div className="font-medium">Configuration</div>
                  <div className="text-sm text-muted-foreground">
                    Advanced configuration options
                  </div>
                </div>
                <ArrowRight className="ml-auto h-4 w-4" />
              </Button>
            </Link>
            
            <Link href="/docs/interceptors">
              <Button variant="outline" className="w-full justify-start h-auto p-4">
                <div className="text-left">
                  <div className="font-medium">Interceptors</div>
                  <div className="text-sm text-muted-foreground">
                    Transform requests and responses
                  </div>
                </div>
                <ArrowRight className="ml-auto h-4 w-4" />
              </Button>
            </Link>
            
            <Link href="/docs/api">
              <Button variant="outline" className="w-full justify-start h-auto p-4">
                <div className="text-left">
                  <div className="font-medium">API Reference</div>
                  <div className="text-sm text-muted-foreground">
                    Complete API documentation
                  </div>
                </div>
                <ArrowRight className="ml-auto h-4 w-4" />
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}