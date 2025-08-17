import { CheckCircle, Terminal, Package } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CodeBlock } from '@/components/code-block';

const installCommands = {
  npm: 'npm install @fluxhttp/core',
  yarn: 'yarn add @fluxhttp/core',
  pnpm: 'pnpm add @fluxhttp/core',
  bun: 'bun add @fluxhttp/core',
};

const cdnUsage = `<!-- Via CDN -->
<script src="https://unpkg.com/@fluxhttp/core@latest/dist/index.min.js"></script>
<script>
  // FluxHTTP is available as global 'fluxhttp'
  fluxhttp.get('https://api.example.com/data')
    .then(response => console.log(response.data));
</script>`;

const esmUsage = `// ES Modules
import fluxhttp from '@fluxhttp/core';

// CommonJS
const fluxhttp = require('@fluxhttp/core');

// TypeScript
import fluxhttp, { fluxhttpResponse, fluxhttpError } from '@fluxhttp/core';`;

const bundlerConfig = `// webpack.config.js
module.exports = {
  resolve: {
    fallback: {
      // FluxHTTP is designed to work without polyfills
      // but some bundlers may require these for Node.js modules
      "http": false,
      "https": false,
      "stream": false,
      "buffer": false
    }
  }
};

// vite.config.js
export default {
  define: {
    global: 'globalThis',
  }
};`;

const packageJsonExample = `{
  "name": "my-app",
  "version": "1.0.0",
  "dependencies": {
    "@fluxhttp/core": "^0.1.0"
  },
  "scripts": {
    "start": "node app.js"
  }
}`;

const requirements = [
  { name: 'Node.js', version: '16.0.0+', description: 'For server-side usage' },
  { name: 'TypeScript', version: '4.5+', description: 'For TypeScript projects (optional)' },
  { name: 'Modern Browsers', version: 'ES2018+', description: 'Chrome 63+, Firefox 58+, Safari 12+' },
];

export default function InstallationPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-4">Installation</h1>
        <p className="text-lg text-muted-foreground">
          Get FluxHTTP installed and configured in your project in minutes.
        </p>
      </div>

      {/* Requirements */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <CheckCircle className="mr-2 h-5 w-5" />
            Requirements
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {requirements.map((req, index) => (
              <div key={index} className="p-4 border rounded-lg">
                <h3 className="font-semibold">{req.name}</h3>
                <p className="text-sm text-primary font-mono">{req.version}</p>
                <p className="text-sm text-muted-foreground mt-1">{req.description}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Package Manager Installation */}
      <div className="space-y-4">
        <h2 className="text-2xl font-bold flex items-center">
          <Package className="mr-2 h-6 w-6" />
          Package Manager Installation
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Object.entries(installCommands).map(([manager, command]) => (
            <Card key={manager}>
              <CardHeader>
                <CardTitle className="text-lg capitalize">{manager}</CardTitle>
              </CardHeader>
              <CardContent>
                <CodeBlock code={command} language="bash" />
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Package.json Example</CardTitle>
          </CardHeader>
          <CardContent>
            <CodeBlock code={packageJsonExample} language="json" />
          </CardContent>
        </Card>
      </div>

      {/* CDN Installation */}
      <div className="space-y-4">
        <h2 className="text-2xl font-bold">CDN Installation</h2>
        <p className="text-muted-foreground">
          For quick prototyping or when you can't use a package manager, you can include FluxHTTP via CDN.
        </p>
        
        <Card>
          <CardHeader>
            <CardTitle>CDN Usage</CardTitle>
          </CardHeader>
          <CardContent>
            <CodeBlock code={cdnUsage} language="html" />
          </CardContent>
        </Card>
      </div>

      {/* Import Methods */}
      <div className="space-y-4">
        <h2 className="text-2xl font-bold">Import Methods</h2>
        <p className="text-muted-foreground">
          FluxHTTP supports multiple import methods to work with your preferred module system.
        </p>
        
        <Card>
          <CardHeader>
            <CardTitle>Module Imports</CardTitle>
          </CardHeader>
          <CardContent>
            <CodeBlock code={esmUsage} language="typescript" />
          </CardContent>
        </Card>
      </div>

      {/* Bundler Configuration */}
      <div className="space-y-4">
        <h2 className="text-2xl font-bold">Bundler Configuration</h2>
        <p className="text-muted-foreground">
          FluxHTTP is designed to work out of the box with modern bundlers, but here are some common configurations.
        </p>
        
        <Card>
          <CardHeader>
            <CardTitle>Bundler Setup</CardTitle>
          </CardHeader>
          <CardContent>
            <CodeBlock code={bundlerConfig} language="javascript" />
          </CardContent>
        </Card>
      </div>

      {/* Platform Support */}
      <div className="space-y-4">
        <h2 className="text-2xl font-bold">Platform Support</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Browser</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center">
                  <CheckCircle className="mr-2 h-4 w-4 text-green-500" />
                  Chrome 63+
                </li>
                <li className="flex items-center">
                  <CheckCircle className="mr-2 h-4 w-4 text-green-500" />
                  Firefox 58+
                </li>
                <li className="flex items-center">
                  <CheckCircle className="mr-2 h-4 w-4 text-green-500" />
                  Safari 12+
                </li>
                <li className="flex items-center">
                  <CheckCircle className="mr-2 h-4 w-4 text-green-500" />
                  Edge 79+
                </li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Node.js</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center">
                  <CheckCircle className="mr-2 h-4 w-4 text-green-500" />
                  Node.js 16+
                </li>
                <li className="flex items-center">
                  <CheckCircle className="mr-2 h-4 w-4 text-green-500" />
                  CommonJS
                </li>
                <li className="flex items-center">
                  <CheckCircle className="mr-2 h-4 w-4 text-green-500" />
                  ES Modules
                </li>
                <li className="flex items-center">
                  <CheckCircle className="mr-2 h-4 w-4 text-green-500" />
                  TypeScript
                </li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Edge Runtime</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center">
                  <CheckCircle className="mr-2 h-4 w-4 text-green-500" />
                  Vercel Edge
                </li>
                <li className="flex items-center">
                  <CheckCircle className="mr-2 h-4 w-4 text-green-500" />
                  Cloudflare Workers
                </li>
                <li className="flex items-center">
                  <CheckCircle className="mr-2 h-4 w-4 text-green-500" />
                  Deno
                </li>
                <li className="flex items-center">
                  <CheckCircle className="mr-2 h-4 w-4 text-green-500" />
                  Bun
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Verification */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Terminal className="mr-2 h-5 w-5" />
            Verify Installation
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground mb-4">
            Create a simple test file to verify FluxHTTP is working correctly:
          </p>
          <CodeBlock
            code={`// test.js
import fluxhttp from '@fluxhttp/core';

async function test() {
  try {
    const response = await fluxhttp.get('https://httpbin.org/get');
    console.log('✅ FluxHTTP is working!');
    console.log('Status:', response.status);
    console.log('Data:', response.data);
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

test();`}
            language="javascript"
          />
          <p className="text-sm text-muted-foreground mt-4">
            Run with: <code className="bg-muted px-1 py-0.5 rounded">node test.js</code>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}