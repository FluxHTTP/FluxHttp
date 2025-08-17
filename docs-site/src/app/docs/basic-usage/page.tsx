import { ArrowRight, Code, Check, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CodeBlock } from '@/components/code-block';
import Link from 'next/link';

const httpMethods = [
  {
    method: 'GET',
    description: 'Retrieve data from a server',
    code: `// Simple GET request
const response = await fluxhttp.get('/api/users');

// GET with query parameters
const response = await fluxhttp.get('/api/users', {
  params: {
    page: 1,
    limit: 10,
    sort: 'name'
  }
});`,
  },
  {
    method: 'POST',
    description: 'Send data to create a new resource',
    code: `// POST with JSON data
const response = await fluxhttp.post('/api/users', {
  name: 'John Doe',
  email: 'john@example.com',
  role: 'admin'
});

// POST with form data
const formData = new FormData();
formData.append('name', 'John Doe');
formData.append('avatar', fileInput.files[0]);

const response = await fluxhttp.post('/api/users', formData);`,
  },
  {
    method: 'PUT',
    description: 'Update an existing resource completely',
    code: `// Update entire user record
const response = await fluxhttp.put('/api/users/123', {
  name: 'John Doe Updated',
  email: 'john.updated@example.com',
  role: 'user'
});`,
  },
  {
    method: 'PATCH',
    description: 'Partially update an existing resource',
    code: `// Update only specific fields
const response = await fluxhttp.patch('/api/users/123', {
  email: 'newemail@example.com'
});`,
  },
  {
    method: 'DELETE',
    description: 'Remove a resource from the server',
    code: `// Delete a user
const response = await fluxhttp.delete('/api/users/123');

// Delete with confirmation
const response = await fluxhttp.delete('/api/users/123', {
  headers: {
    'X-Confirm': 'true'
  }
});`,
  },
];

const configOptions = `// All available configuration options
const response = await fluxhttp.get('/api/data', {
  // Request configuration
  timeout: 5000,              // Request timeout in milliseconds
  headers: {                  // Custom headers
    'Authorization': 'Bearer token',
    'Content-Type': 'application/json'
  },
  params: {                   // Query parameters
    page: 1,
    limit: 20
  },
  
  // Response configuration
  responseType: 'json',       // 'json' | 'text' | 'blob' | 'arraybuffer'
  validateStatus: (status) => status < 500, // Custom status validation
  
  // Security
  withCredentials: true,      // Send cookies with request
  auth: {                     // Basic authentication
    username: 'user',
    password: 'pass'
  },
  
  // Advanced options
  maxRedirects: 5,           // Maximum redirects to follow
  maxContentLength: 2000,    // Max response size
  decompress: true,          // Decompress response
  
  // Cancellation
  signal: abortController.signal,
  
  // Progress tracking
  onUploadProgress: (progressEvent) => {
    console.log('Upload progress:', progressEvent.loaded / progressEvent.total);
  },
  onDownloadProgress: (progressEvent) => {
    console.log('Download progress:', progressEvent.loaded / progressEvent.total);
  }
});`;

const responseStructure = `// FluxHTTP response structure
interface fluxhttpResponse<T = any> {
  data: T;                    // Response data
  status: number;             // HTTP status code (200, 404, etc.)
  statusText: string;         // HTTP status message ('OK', 'Not Found')
  headers: Headers;           // Response headers
  config: fluxhttpRequestConfig; // Request configuration used
  request?: any;              // Native request object
}

// Example response
const response = await fluxhttp.get('/api/user/1');
console.log(response.data);       // { id: 1, name: "John" }
console.log(response.status);     // 200
console.log(response.statusText); // "OK"
console.log(response.headers);    // { "content-type": "application/json" }`;

const errorHandling = `import fluxhttp, { fluxhttpError } from '@fluxhttp/core';

async function handleRequest() {
  try {
    const response = await fluxhttp.get('/api/data');
    return response.data;
  } catch (error) {
    if (error instanceof fluxhttpError) {
      // HTTP error (4xx, 5xx)
      console.log('Status:', error.response?.status);
      console.log('Status Text:', error.response?.statusText);
      console.log('Error Data:', error.response?.data);
      console.log('Request Config:', error.config);
      
      // Handle specific error codes
      switch (error.response?.status) {
        case 401:
          // Unauthorized - redirect to login
          redirectToLogin();
          break;
        case 403:
          // Forbidden - show access denied message
          showAccessDenied();
          break;
        case 404:
          // Not found - show 404 page
          show404();
          break;
        case 422:
          // Validation error - show form errors
          showValidationErrors(error.response.data);
          break;
        case 500:
          // Server error - show error message
          showServerError();
          break;
        default:
          // Generic error
          showGenericError(error.message);
      }
    } else {
      // Network error, timeout, etc.
      console.log('Network Error:', error.message);
      
      if (error.code === 'ECONNABORTED') {
        // Request timeout
        showTimeoutError();
      } else if (error.code === 'ERR_NETWORK') {
        // Network connectivity issue
        showNetworkError();
      } else {
        // Other error
        showGenericError(error.message);
      }
    }
    
    throw error; // Re-throw if needed
  }
}`;

const instanceCreation = `import fluxhttp from '@fluxhttp/core';

// Create a custom instance with default configuration
const apiClient = fluxhttp.create({
  baseURL: 'https://api.example.com',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  }
});

// Use the custom instance
const users = await apiClient.get('/users');
const newUser = await apiClient.post('/users', userData);

// Create multiple instances for different APIs
const authAPI = fluxhttp.create({
  baseURL: 'https://auth.example.com',
  timeout: 5000
});

const dataAPI = fluxhttp.create({
  baseURL: 'https://data.example.com',
  timeout: 15000,
  headers: {
    'Authorization': 'Bearer ' + getAuthToken()
  }
});`;

export default function BasicUsagePage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-4">Basic Usage</h1>
        <p className="text-lg text-muted-foreground">
          Learn the fundamentals of making HTTP requests with FluxHTTP. This guide covers 
          all HTTP methods, configuration options, and error handling.
        </p>
      </div>

      {/* HTTP Methods */}
      <div className="space-y-6">
        <h2 className="text-2xl font-bold">HTTP Methods</h2>
        <p className="text-muted-foreground">
          FluxHTTP supports all standard HTTP methods. Each method has a dedicated function 
          that makes the API intuitive and type-safe.
        </p>

        <div className="space-y-6">
          {httpMethods.map((method, index) => (
            <Card key={index}>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <code className="bg-primary/10 text-primary px-2 py-1 rounded text-sm font-mono mr-3">
                    {method.method}
                  </code>
                  {method.description}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CodeBlock code={method.code} language="typescript" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Configuration Options */}
      <div className="space-y-4">
        <h2 className="text-2xl font-bold">Configuration Options</h2>
        <p className="text-muted-foreground">
          FluxHTTP provides extensive configuration options to customize your requests. 
          You can set these options globally on an instance or per-request.
        </p>
        
        <Card>
          <CardHeader>
            <CardTitle>Request Configuration</CardTitle>
          </CardHeader>
          <CardContent>
            <CodeBlock code={configOptions} language="typescript" showLineNumbers />
          </CardContent>
        </Card>
      </div>

      {/* Response Structure */}
      <div className="space-y-4">
        <h2 className="text-2xl font-bold">Response Structure</h2>
        <p className="text-muted-foreground">
          All FluxHTTP requests return a response object with a consistent structure 
          containing the data, status, headers, and configuration.
        </p>
        
        <Card>
          <CardHeader>
            <CardTitle>Response Object</CardTitle>
          </CardHeader>
          <CardContent>
            <CodeBlock code={responseStructure} language="typescript" showLineNumbers />
          </CardContent>
        </Card>
      </div>

      {/* Error Handling */}
      <div className="space-y-4">
        <h2 className="text-2xl font-bold">Error Handling</h2>
        <p className="text-muted-foreground">
          FluxHTTP provides comprehensive error handling with detailed error information 
          for both HTTP errors and network issues.
        </p>
        
        <Card>
          <CardHeader>
            <CardTitle>Handling Errors</CardTitle>
          </CardHeader>
          <CardContent>
            <CodeBlock code={errorHandling} language="typescript" showLineNumbers />
          </CardContent>
        </Card>

        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
          <div className="flex items-start">
            <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 mr-2 mt-0.5" />
            <div>
              <h4 className="font-medium text-amber-800 dark:text-amber-200">Error Types</h4>
              <ul className="mt-2 text-sm text-amber-700 dark:text-amber-300 space-y-1">
                <li><strong>HTTP Errors:</strong> 4xx and 5xx status codes with response data</li>
                <li><strong>Network Errors:</strong> Connection issues, DNS failures</li>
                <li><strong>Timeout Errors:</strong> Request exceeded the timeout limit</li>
                <li><strong>Cancellation Errors:</strong> Request was cancelled by the user</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Creating Instances */}
      <div className="space-y-4">
        <h2 className="text-2xl font-bold">Creating Custom Instances</h2>
        <p className="text-muted-foreground">
          For applications that make multiple requests with similar configuration, 
          creating custom instances helps reduce code duplication and improves maintainability.
        </p>
        
        <Card>
          <CardHeader>
            <CardTitle>Instance Creation</CardTitle>
          </CardHeader>
          <CardContent>
            <CodeBlock code={instanceCreation} language="typescript" showLineNumbers />
          </CardContent>
        </Card>

        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <div className="flex items-start">
            <Check className="h-5 w-5 text-blue-600 dark:text-blue-400 mr-2 mt-0.5" />
            <div>
              <h4 className="font-medium text-blue-800 dark:text-blue-200">Best Practices</h4>
              <ul className="mt-2 text-sm text-blue-700 dark:text-blue-300 space-y-1">
                <li>Create separate instances for different APIs or services</li>
                <li>Set common headers and base URLs on instances</li>
                <li>Use instance-level interceptors for auth and error handling</li>
                <li>Configure timeouts appropriate for your API's response times</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Next Steps */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Code className="mr-2 h-5 w-5" />
            Next Steps
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground mb-6">
            Now that you understand the basics, explore more advanced features:
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Link href="/docs/interceptors">
              <Button variant="outline" className="w-full justify-start h-auto p-4">
                <div className="text-left">
                  <div className="font-medium">Interceptors</div>
                  <div className="text-sm text-muted-foreground">
                    Transform requests and responses automatically
                  </div>
                </div>
                <ArrowRight className="ml-auto h-4 w-4" />
              </Button>
            </Link>
            
            <Link href="/docs/configuration">
              <Button variant="outline" className="w-full justify-start h-auto p-4">
                <div className="text-left">
                  <div className="font-medium">Advanced Configuration</div>
                  <div className="text-sm text-muted-foreground">
                    Detailed configuration options and patterns
                  </div>
                </div>
                <ArrowRight className="ml-auto h-4 w-4" />
              </Button>
            </Link>
            
            <Link href="/docs/retry">
              <Button variant="outline" className="w-full justify-start h-auto p-4">
                <div className="text-left">
                  <div className="font-medium">Retry Logic</div>
                  <div className="text-sm text-muted-foreground">
                    Automatic retry with exponential backoff
                  </div>
                </div>
                <ArrowRight className="ml-auto h-4 w-4" />
              </Button>
            </Link>
            
            <Link href="/docs/security">
              <Button variant="outline" className="w-full justify-start h-auto p-4">
                <div className="text-left">
                  <div className="font-medium">Security Features</div>
                  <div className="text-sm text-muted-foreground">
                    CSRF protection, rate limiting, and more
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