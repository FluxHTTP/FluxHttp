'use client';

import { useState } from 'react';
import { Play, Save, Download, Copy, Settings, Trash2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CodeBlock } from '@/components/code-block';
import { Header } from '@/components/header';
import { Footer } from '@/components/footer';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';

const presets = [
  {
    id: 'get-basic',
    name: 'GET Request',
    description: 'Simple GET request example',
    code: `// Basic GET request
const response = await fluxhttp.get('https://jsonplaceholder.typicode.com/posts/1');
console.log('Status:', response.status);
console.log('Data:', response.data);
return response.data;`,
  },
  {
    id: 'post-json',
    name: 'POST JSON',
    description: 'POST request with JSON data',
    code: `// POST request with JSON data
const response = await fluxhttp.post('https://jsonplaceholder.typicode.com/posts', {
  title: 'FluxHTTP Test',
  body: 'This is a test post from the playground',
  userId: 1
});
console.log('Created:', response.data);
return response.data;`,
  },
  {
    id: 'custom-headers',
    name: 'Custom Headers',
    description: 'Request with custom headers',
    code: `// Request with custom headers
const response = await fluxhttp.get('https://httpbin.org/headers', {
  headers: {
    'User-Agent': 'FluxHTTP-Playground/1.0',
    'X-Custom-Header': 'playground-test',
    'Accept': 'application/json'
  }
});
console.log('Headers received by server:', response.data.headers);
return response.data;`,
  },
  {
    id: 'query-params',
    name: 'Query Parameters',
    description: 'GET request with query parameters',
    code: `// GET with query parameters
const response = await fluxhttp.get('https://jsonplaceholder.typicode.com/posts', {
  params: {
    userId: 1,
    _limit: 5
  }
});
console.log(\`Found \${response.data.length} posts\`);
return response.data;`,
  },
  {
    id: 'error-handling',
    name: 'Error Handling',
    description: 'Handling different types of errors',
    code: `// Error handling example
try {
  const response = await fluxhttp.get('https://httpbin.org/status/404');
  return response.data;
} catch (error) {
  if (error.response) {
    console.log('HTTP Error:', error.response.status);
    console.log('Error data:', error.response.data);
    return {
      error: true,
      status: error.response.status,
      message: error.message
    };
  } else {
    console.log('Network/Other Error:', error.message);
    return {
      error: true,
      message: error.message
    };
  }
}`,
  },
  {
    id: 'timeout',
    name: 'Timeout Handling',
    description: 'Request with timeout configuration',
    code: `// Request with timeout
try {
  const response = await fluxhttp.get('https://httpbin.org/delay/3', {
    timeout: 2000 // 2 seconds timeout
  });
  return response.data;
} catch (error) {
  if (error.code === 'ECONNABORTED') {
    console.log('Request timed out');
    return { error: true, message: 'Request timed out after 2 seconds' };
  }
  throw error;
}`,
  },
];

interface PlaygroundResult {
  output: any;
  logs: string[];
  error?: string;
  duration: number;
}

export default function PlaygroundPage() {
  const [activePreset, setActivePreset] = useState(presets[0]);
  const [code, setCode] = useState(activePreset.code);
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<PlaygroundResult | null>(null);

  const runCode = async () => {
    setIsRunning(true);
    setResult(null);

    const logs: string[] = [];
    const originalConsole = console.log;
    console.log = (...args) => {
      logs.push(args.map(arg => typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)).join(' '));
      originalConsole(...args);
    };

    const startTime = Date.now();

    try {
      // Create a mock fluxhttp object that uses fetch
      const fluxhttp = {
        get: async (url: string, config: any = {}) => {
          const fullUrl = new URL(url);
          if (config.params) {
            Object.entries(config.params).forEach(([key, value]) => {
              fullUrl.searchParams.append(key, String(value));
            });
          }

          const response = await fetch(fullUrl.toString(), {
            method: 'GET',
            headers: config.headers,
            signal: config.timeout ? AbortSignal.timeout(config.timeout) : undefined,
          });

          if (!response.ok && !config.validateStatus?.(response.status)) {
            const error = new Error(`Request failed with status ${response.status}`);
            (error as any).response = {
              status: response.status,
              statusText: response.statusText,
              data: await response.json().catch(() => ({})),
            };
            (error as any).code = response.status >= 500 ? 'ECONNRESET' : 'ERR_BAD_REQUEST';
            throw error;
          }

          return {
            data: await response.json(),
            status: response.status,
            statusText: response.statusText,
            headers: Object.fromEntries(response.headers.entries()),
          };
        },
        post: async (url: string, data: any, config: any = {}) => {
          const response = await fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...config.headers,
            },
            body: JSON.stringify(data),
            signal: config.timeout ? AbortSignal.timeout(config.timeout) : undefined,
          });

          if (!response.ok) {
            const error = new Error(`Request failed with status ${response.status}`);
            (error as any).response = {
              status: response.status,
              statusText: response.statusText,
              data: await response.json().catch(() => ({})),
            };
            throw error;
          }

          return {
            data: await response.json(),
            status: response.status,
            statusText: response.statusText,
            headers: Object.fromEntries(response.headers.entries()),
          };
        },
      };

      // Execute the code
      const asyncFunction = new Function('fluxhttp', `
        return (async () => {
          ${code}
        })();
      `);

      const output = await asyncFunction(fluxhttp);
      const duration = Date.now() - startTime;

      setResult({
        output,
        logs,
        duration,
      });

      toast.success(`Code executed successfully in ${duration}ms`);
    } catch (error: any) {
      const duration = Date.now() - startTime;
      setResult({
        output: null,
        logs,
        error: error.message,
        duration,
      });

      toast.error('Code execution failed');
    } finally {
      console.log = originalConsole;
      setIsRunning(false);
    }
  };

  const copyCode = async () => {
    await navigator.clipboard.writeText(code);
    toast.success('Code copied to clipboard');
  };

  const saveCode = () => {
    const blob = new Blob([code], { type: 'text/javascript' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'fluxhttp-playground.js';
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Code saved as file');
  };

  const clearResult = () => {
    setResult(null);
  };

  const loadPreset = (preset: typeof presets[0]) => {
    setActivePreset(preset);
    setCode(preset.code);
    setResult(null);
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-4">FluxHTTP Playground</h1>
          <p className="text-lg text-muted-foreground">
            Test FluxHTTP code snippets directly in your browser. Try different examples or write your own code.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Presets Sidebar */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Examples</CardTitle>
              </CardHeader>
              <CardContent className="p-3">
                <div className="space-y-2">
                  {presets.map((preset) => (
                    <Button
                      key={preset.id}
                      variant={activePreset.id === preset.id ? "default" : "ghost"}
                      className="w-full justify-start h-auto p-3"
                      onClick={() => loadPreset(preset)}
                    >
                      <div className="text-left">
                        <div className="font-medium text-sm">{preset.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {preset.description}
                        </div>
                      </div>
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3 space-y-6">
            {/* Code Editor */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg">Code Editor</CardTitle>
                <div className="flex items-center space-x-2">
                  <Button variant="outline" size="sm" onClick={copyCode}>
                    <Copy className="mr-2 h-4 w-4" />
                    Copy
                  </Button>
                  <Button variant="outline" size="sm" onClick={saveCode}>
                    <Download className="mr-2 h-4 w-4" />
                    Save
                  </Button>
                  <Button onClick={runCode} disabled={isRunning}>
                    <Play className="mr-2 h-4 w-4" />
                    {isRunning ? 'Running...' : 'Run Code'}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="relative">
                  <textarea
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    className="w-full h-64 p-4 font-mono text-sm bg-muted border rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                    placeholder="Write your FluxHTTP code here..."
                  />
                </div>
              </CardContent>
            </Card>

            {/* Results */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg">
                  Output
                  {result && (
                    <span className="ml-2 text-sm font-normal text-muted-foreground">
                      ({result.duration}ms)
                    </span>
                  )}
                </CardTitle>
                {result && (
                  <Button variant="outline" size="sm" onClick={clearResult}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Clear
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                {!result ? (
                  <div className="text-center p-8 text-muted-foreground">
                    <Play className="mx-auto h-12 w-12 mb-4 opacity-50" />
                    <p>Click "Run Code" to see the output</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Error */}
                    {result.error && (
                      <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
                        <h4 className="font-medium text-destructive mb-2">Error</h4>
                        <pre className="text-sm text-destructive/80 whitespace-pre-wrap">
                          {result.error}
                        </pre>
                      </div>
                    )}

                    {/* Console Logs */}
                    {result.logs.length > 0 && (
                      <div>
                        <h4 className="font-medium mb-2">Console Output</h4>
                        <div className="bg-muted p-3 rounded-lg font-mono text-sm">
                          {result.logs.map((log, index) => (
                            <div key={index} className="mb-1">
                              {log}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Return Value */}
                    {result.output !== undefined && (
                      <div>
                        <h4 className="font-medium mb-2">Return Value</h4>
                        <CodeBlock
                          code={JSON.stringify(result.output, null, 2)}
                          language="json"
                        />
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Tips */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Tips</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 text-sm">
                  <div className="flex items-start">
                    <div className="w-2 h-2 rounded-full bg-primary mt-2 mr-3 flex-shrink-0"></div>
                    <div>
                      <strong>Use console.log()</strong> to debug your code and see intermediate values.
                    </div>
                  </div>
                  <div className="flex items-start">
                    <div className="w-2 h-2 rounded-full bg-primary mt-2 mr-3 flex-shrink-0"></div>
                    <div>
                      <strong>Return values</strong> from your code will be displayed in the output section.
                    </div>
                  </div>
                  <div className="flex items-start">
                    <div className="w-2 h-2 rounded-full bg-primary mt-2 mr-3 flex-shrink-0"></div>
                    <div>
                      <strong>Try the examples</strong> on the left to learn different FluxHTTP patterns.
                    </div>
                  </div>
                  <div className="flex items-start">
                    <div className="w-2 h-2 rounded-full bg-primary mt-2 mr-3 flex-shrink-0"></div>
                    <div>
                      <strong>Use async/await</strong> for cleaner code when working with promises.
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}