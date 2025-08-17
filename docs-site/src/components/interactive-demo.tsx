'use client';

import { useState } from 'react';
import { Play, Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CodeBlock } from '@/components/code-block';
import { cn } from '@/lib/utils';

const examples = [
  {
    id: 'get',
    title: 'GET Request',
    description: 'Fetch data from an API',
    code: `// Simple GET request
const response = await fluxhttp.get('https://jsonplaceholder.typicode.com/posts/1');
console.log('Status:', response.status);
console.log('Data:', response.data);`,
    url: 'https://jsonplaceholder.typicode.com/posts/1',
    method: 'GET',
  },
  {
    id: 'post',
    title: 'POST Request',
    description: 'Send data to an API',
    code: `// POST request with data
const response = await fluxhttp.post('https://jsonplaceholder.typicode.com/posts', {
  title: 'FluxHTTP Demo',
  body: 'This is a demo post from FluxHTTP',
  userId: 1
});
console.log('Status:', response.status);
console.log('Created:', response.data);`,
    url: 'https://jsonplaceholder.typicode.com/posts',
    method: 'POST',
    data: {
      title: 'FluxHTTP Demo',
      body: 'This is a demo post from FluxHTTP',
      userId: 1,
    },
  },
  {
    id: 'params',
    title: 'Query Parameters',
    description: 'GET request with query parameters',
    code: `// GET with query parameters
const response = await fluxhttp.get('https://jsonplaceholder.typicode.com/posts', {
  params: {
    userId: 1,
    _limit: 3
  }
});
console.log('Status:', response.status);
console.log('Posts:', response.data.length);`,
    url: 'https://jsonplaceholder.typicode.com/posts',
    method: 'GET',
    params: { userId: 1, _limit: 3 },
  },
  {
    id: 'headers',
    title: 'Custom Headers',
    description: 'Request with custom headers',
    code: `// Request with custom headers
const response = await fluxhttp.get('https://httpbin.org/headers', {
  headers: {
    'User-Agent': 'FluxHTTP-Demo/1.0',
    'X-Custom-Header': 'demo-value'
  }
});
console.log('Status:', response.status);
console.log('Headers received:', response.data.headers);`,
    url: 'https://httpbin.org/headers',
    method: 'GET',
    headers: {
      'User-Agent': 'FluxHTTP-Demo/1.0',
      'X-Custom-Header': 'demo-value',
    },
  },
];

interface DemoResult {
  status: number;
  statusText: string;
  data: any;
  headers: Record<string, string>;
  duration: number;
}

export function InteractiveDemo() {
  const [activeExample, setActiveExample] = useState(examples[0]);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<DemoResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runExample = async () => {
    setIsLoading(true);
    setError(null);
    setResult(null);

    const startTime = Date.now();

    try {
      // Simulate fluxhttp request with fetch
      const url = new URL(activeExample.url);
      
      if (activeExample.params) {
        Object.entries(activeExample.params).forEach(([key, value]) => {
          url.searchParams.append(key, String(value));
        });
      }

      const options: RequestInit = {
        method: activeExample.method,
        headers: {
          'Content-Type': 'application/json',
          ...activeExample.headers,
        },
      };

      if (activeExample.data && activeExample.method !== 'GET') {
        options.body = JSON.stringify(activeExample.data);
      }

      const response = await fetch(url.toString(), options);
      const data = await response.json();
      const duration = Date.now() - startTime;

      // Convert Headers object to plain object
      const headers: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        headers[key] = value;
      });

      setResult({
        status: response.status,
        statusText: response.statusText,
        data,
        headers,
        duration,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Example Selector */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {examples.map((example) => (
          <Button
            key={example.id}
            variant={activeExample.id === example.id ? 'default' : 'outline'}
            className="h-auto p-4 flex flex-col items-start text-left"
            onClick={() => {
              setActiveExample(example);
              setResult(null);
              setError(null);
            }}
          >
            <div className="font-medium mb-1">{example.title}</div>
            <div className="text-xs text-muted-foreground">
              {example.description}
            </div>
          </Button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Code */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Code</CardTitle>
            <Button
              onClick={runExample}
              disabled={isLoading}
              size="sm"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Running...
                </>
              ) : (
                <>
                  <Play className="mr-2 h-4 w-4" />
                  Run
                </>
              )}
            </Button>
          </CardHeader>
          <CardContent>
            <CodeBlock
              code={activeExample.code}
              language="typescript"
              className="text-sm"
            />
          </CardContent>
        </Card>

        {/* Result */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center">
              Result
              {result && (
                <div className="ml-2 flex items-center text-sm">
                  <CheckCircle className="mr-1 h-4 w-4 text-green-500" />
                  {result.status} ({result.duration}ms)
                </div>
              )}
              {error && (
                <div className="ml-2 flex items-center text-sm">
                  <AlertCircle className="mr-1 h-4 w-4 text-red-500" />
                  Error
                </div>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading && (
              <div className="flex items-center justify-center p-8">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            )}

            {error && (
              <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
                <div className="flex items-center text-destructive mb-2">
                  <AlertCircle className="mr-2 h-4 w-4" />
                  <span className="font-medium">Request Failed</span>
                </div>
                <p className="text-sm text-destructive/80">{error}</p>
              </div>
            )}

            {result && (
              <div className="space-y-4">
                {/* Status */}
                <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <span className="text-sm font-medium">Status</span>
                  <span
                    className={cn(
                      'text-sm font-mono px-2 py-1 rounded',
                      result.status >= 200 && result.status < 300
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                        : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
                    )}
                  >
                    {result.status} {result.statusText}
                  </span>
                </div>

                {/* Response Data */}
                <div>
                  <h4 className="text-sm font-medium mb-2">Response Data</h4>
                  <CodeBlock
                    code={JSON.stringify(result.data, null, 2)}
                    language="json"
                    className="max-h-64 overflow-y-auto"
                  />
                </div>

                {/* Headers (collapsed by default) */}
                <details className="group">
                  <summary className="cursor-pointer text-sm font-medium p-2 hover:bg-muted rounded">
                    Response Headers ({Object.keys(result.headers).length})
                  </summary>
                  <div className="mt-2">
                    <CodeBlock
                      code={JSON.stringify(result.headers, null, 2)}
                      language="json"
                      className="max-h-48 overflow-y-auto"
                    />
                  </div>
                </details>
              </div>
            )}

            {!result && !error && !isLoading && (
              <div className="text-center p-8 text-muted-foreground">
                <Play className="mx-auto h-12 w-12 mb-4 opacity-50" />
                <p>Click "Run" to execute the request</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}