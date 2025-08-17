'use client';

import { useState } from 'react';
import { Copy, ExternalLink, Code, Zap, Shield, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CodeBlock } from '@/components/code-block';
import { Header } from '@/components/header';
import { Footer } from '@/components/footer';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';

const categories = [
  {
    id: 'basic',
    name: 'Basic Usage',
    icon: <Code className="h-5 w-5" />,
    description: 'Fundamental HTTP operations',
  },
  {
    id: 'advanced',
    name: 'Advanced Features',
    icon: <Zap className="h-5 w-5" />,
    description: 'Interceptors, retry, caching',
  },
  {
    id: 'security',
    name: 'Security',
    icon: <Shield className="h-5 w-5" />,
    description: 'Authentication, CSRF, validation',
  },
  {
    id: 'frameworks',
    name: 'Framework Integration',
    icon: <Globe className="h-5 w-5" />,
    description: 'React, Vue, Angular examples',
  },
];

const examples = {
  basic: [
    {
      title: 'Simple GET Request',
      description: 'Basic GET request to fetch data from an API',
      code: `import fluxhttp from '@fluxhttp/core';

async function fetchUser() {
  try {
    const response = await fluxhttp.get('https://jsonplaceholder.typicode.com/users/1');
    console.log('User:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error fetching user:', error.message);
    throw error;
  }
}

fetchUser();`,
    },
    {
      title: 'POST with JSON Data',
      description: 'Create a new resource with JSON payload',
      code: `import fluxhttp from '@fluxhttp/core';

async function createPost() {
  const newPost = {
    title: 'My New Post',
    body: 'This is the content of my post',
    userId: 1
  };

  try {
    const response = await fluxhttp.post('https://jsonplaceholder.typicode.com/posts', newPost);
    console.log('Created post:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error creating post:', error.message);
    throw error;
  }
}

createPost();`,
    },
    {
      title: 'Query Parameters',
      description: 'GET request with URL query parameters',
      code: `import fluxhttp from '@fluxhttp/core';

async function searchPosts() {
  try {
    const response = await fluxhttp.get('https://jsonplaceholder.typicode.com/posts', {
      params: {
        userId: 1,
        _limit: 5,
        _sort: 'id',
        _order: 'desc'
      }
    });
    
    console.log(\`Found \${response.data.length} posts\`);
    return response.data;
  } catch (error) {
    console.error('Error searching posts:', error.message);
    throw error;
  }
}

searchPosts();`,
    },
    {
      title: 'Custom Headers',
      description: 'Adding custom headers to requests',
      code: `import fluxhttp from '@fluxhttp/core';

async function fetchWithHeaders() {
  try {
    const response = await fluxhttp.get('https://httpbin.org/headers', {
      headers: {
        'User-Agent': 'FluxHTTP-Example/1.0',
        'X-API-Key': 'your-api-key',
        'Accept': 'application/json',
        'X-Custom-Header': 'custom-value'
      }
    });
    
    console.log('Server received headers:', response.data.headers);
    return response.data;
  } catch (error) {
    console.error('Error:', error.message);
    throw error;
  }
}

fetchWithHeaders();`,
    },
  ],
  advanced: [
    {
      title: 'Request Interceptors',
      description: 'Transform requests before they are sent',
      code: `import fluxhttp from '@fluxhttp/core';

// Add a request interceptor
fluxhttp.interceptors.request.use(
  (config) => {
    // Add auth token to every request
    const token = localStorage.getItem('authToken');
    if (token) {
      config.headers.Authorization = \`Bearer \${token}\`;
    }
    
    // Add timestamp to requests
    config.headers['X-Request-Time'] = new Date().toISOString();
    
    console.log('Sending request to:', config.url);
    return config;
  },
  (error) => {
    console.error('Request interceptor error:', error);
    return Promise.reject(error);
  }
);

// Now all requests will include the auth token
async function fetchProtectedData() {
  const response = await fluxhttp.get('/api/protected-endpoint');
  return response.data;
}`,
    },
    {
      title: 'Response Interceptors',
      description: 'Transform responses before they reach your code',
      code: `import fluxhttp from '@fluxhttp/core';

// Add a response interceptor
fluxhttp.interceptors.response.use(
  (response) => {
    // Log successful responses
    console.log(\`✅ \${response.config.method?.toUpperCase()} \${response.config.url} - \${response.status}\`);
    
    // Transform response data if needed
    if (response.data && typeof response.data === 'object') {
      response.data.receivedAt = new Date().toISOString();
    }
    
    return response;
  },
  (error) => {
    // Handle errors globally
    if (error.response?.status === 401) {
      console.log('Unauthorized - redirecting to login');
      // Redirect to login page
      window.location.href = '/login';
    } else if (error.response?.status >= 500) {
      console.error('Server error:', error.response.status);
      // Show user-friendly error message
    }
    
    return Promise.reject(error);
  }
);`,
    },
    {
      title: 'Retry Configuration',
      description: 'Automatic retry with exponential backoff',
      code: `import fluxhttp from '@fluxhttp/core';

const apiClient = fluxhttp.create({
  baseURL: 'https://api.example.com',
  retry: {
    attempts: 3,
    delay: 1000, // Start with 1 second
    maxDelay: 10000, // Max 10 seconds
    backoff: 'exponential',
    retryCondition: (error) => {
      // Retry on network errors and 5xx status codes
      return !error.response || error.response.status >= 500;
    }
  }
});

async function fetchWithRetry() {
  try {
    const response = await apiClient.get('/unreliable-endpoint');
    return response.data;
  } catch (error) {
    console.error('Failed after retries:', error.message);
    throw error;
  }
}`,
    },
    {
      title: 'Request Cancellation',
      description: 'Cancel requests using AbortController',
      code: `import fluxhttp from '@fluxhttp/core';

function createCancellableRequest() {
  const controller = new AbortController();
  
  const request = fluxhttp.get('https://httpbin.org/delay/5', {
    signal: controller.signal
  });
  
  // Cancel after 3 seconds
  setTimeout(() => {
    controller.abort();
    console.log('Request cancelled');
  }, 3000);
  
  return {
    request,
    cancel: () => controller.abort()
  };
}

async function handleCancellableRequest() {
  const { request, cancel } = createCancellableRequest();
  
  try {
    const response = await request;
    console.log('Request completed:', response.data);
  } catch (error) {
    if (error.name === 'AbortError') {
      console.log('Request was cancelled');
    } else {
      console.error('Request failed:', error.message);
    }
  }
}`,
    },
  ],
  security: [
    {
      title: 'JWT Authentication',
      description: 'Handle JWT tokens for API authentication',
      code: `import fluxhttp from '@fluxhttp/core';

class AuthService {
  constructor() {
    this.setupInterceptors();
  }
  
  setupInterceptors() {
    // Add auth token to requests
    fluxhttp.interceptors.request.use((config) => {
      const token = this.getToken();
      if (token) {
        config.headers.Authorization = \`Bearer \${token}\`;
      }
      return config;
    });
    
    // Handle token refresh on 401
    fluxhttp.interceptors.response.use(
      (response) => response,
      async (error) => {
        if (error.response?.status === 401 && !error.config._retry) {
          error.config._retry = true;
          
          try {
            await this.refreshToken();
            const token = this.getToken();
            error.config.headers.Authorization = \`Bearer \${token}\`;
            return fluxhttp.request(error.config);
          } catch (refreshError) {
            this.logout();
            throw refreshError;
          }
        }
        throw error;
      }
    );
  }
  
  getToken() {
    return localStorage.getItem('accessToken');
  }
  
  async refreshToken() {
    const refreshToken = localStorage.getItem('refreshToken');
    const response = await fluxhttp.post('/auth/refresh', {
      refreshToken
    });
    
    localStorage.setItem('accessToken', response.data.accessToken);
    return response.data.accessToken;
  }
  
  logout() {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    window.location.href = '/login';
  }
}

const authService = new AuthService();`,
    },
    {
      title: 'CSRF Protection',
      description: 'Automatic CSRF token handling',
      code: `import fluxhttp from '@fluxhttp/core';

// Configure CSRF protection
const apiClient = fluxhttp.create({
  baseURL: 'https://api.example.com',
  security: {
    csrf: {
      enabled: true,
      tokenHeaderName: 'X-CSRF-Token',
      cookieName: 'csrf-token'
    }
  }
});

// Add CSRF token interceptor
apiClient.interceptors.request.use((config) => {
  if (['post', 'put', 'patch', 'delete'].includes(config.method?.toLowerCase())) {
    const csrfToken = getCsrfToken();
    if (csrfToken) {
      config.headers['X-CSRF-Token'] = csrfToken;
    }
  }
  return config;
});

function getCsrfToken() {
  const meta = document.querySelector('meta[name="csrf-token"]');
  return meta?.getAttribute('content') || '';
}

// Fetch CSRF token before making protected requests
async function fetchCsrfToken() {
  const response = await apiClient.get('/csrf-token');
  return response.data.token;
}`,
    },
    {
      title: 'Rate Limiting',
      description: 'Client-side rate limiting implementation',
      code: `import fluxhttp from '@fluxhttp/core';

class RateLimiter {
  constructor(requestsPerSecond = 10) {
    this.requestsPerSecond = requestsPerSecond;
    this.requests = [];
  }
  
  async waitForSlot() {
    const now = Date.now();
    const secondAgo = now - 1000;
    
    // Remove requests older than 1 second
    this.requests = this.requests.filter(time => time > secondAgo);
    
    if (this.requests.length >= this.requestsPerSecond) {
      const oldestRequest = Math.min(...this.requests);
      const waitTime = 1000 - (now - oldestRequest);
      
      if (waitTime > 0) {
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
    
    this.requests.push(Date.now());
  }
}

const rateLimiter = new RateLimiter(5); // 5 requests per second

// Add rate limiting interceptor
fluxhttp.interceptors.request.use(async (config) => {
  await rateLimiter.waitForSlot();
  return config;
});

// Now all requests will be rate limited
async function makeMultipleRequests() {
  const promises = Array.from({ length: 10 }, (_, i) => 
    fluxhttp.get(\`https://jsonplaceholder.typicode.com/posts/\${i + 1}\`)
  );
  
  const responses = await Promise.all(promises);
  console.log('All requests completed');
  return responses;
}`,
    },
  ],
  frameworks: [
    {
      title: 'React Hook',
      description: 'Custom React hook for API calls',
      code: `import { useState, useEffect } from 'react';
import fluxhttp from '@fluxhttp/core';

function useApi(url, options = {}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  useEffect(() => {
    let cancelled = false;
    
    async function fetchData() {
      try {
        setLoading(true);
        setError(null);
        
        const response = await fluxhttp.get(url, options);
        
        if (!cancelled) {
          setData(response.data);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }
    
    fetchData();
    
    return () => {
      cancelled = true;
    };
  }, [url]);
  
  return { data, loading, error };
}

// Usage in React component
function UserProfile({ userId }) {
  const { data: user, loading, error } = useApi(\`/api/users/\${userId}\`);
  
  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;
  if (!user) return <div>User not found</div>;
  
  return (
    <div>
      <h1>{user.name}</h1>
      <p>{user.email}</p>
    </div>
  );
}`,
    },
    {
      title: 'Vue Composition API',
      description: 'Vue 3 composable for HTTP requests',
      code: `import { ref, computed, onMounted, onUnmounted } from 'vue';
import fluxhttp from '@fluxhttp/core';

export function useApi(url, options = {}) {
  const data = ref(null);
  const loading = ref(false);
  const error = ref(null);
  
  let controller = null;
  
  const execute = async () => {
    loading.value = true;
    error.value = null;
    
    // Cancel previous request
    if (controller) {
      controller.abort();
    }
    
    controller = new AbortController();
    
    try {
      const response = await fluxhttp.get(url, {
        ...options,
        signal: controller.signal
      });
      
      data.value = response.data;
    } catch (err) {
      if (err.name !== 'AbortError') {
        error.value = err;
      }
    } finally {
      loading.value = false;
    }
  };
  
  const refresh = () => execute();
  
  onMounted(() => {
    execute();
  });
  
  onUnmounted(() => {
    if (controller) {
      controller.abort();
    }
  });
  
  return {
    data: computed(() => data.value),
    loading: computed(() => loading.value),
    error: computed(() => error.value),
    refresh
  };
}

// Usage in Vue component
export default {
  setup() {
    const { data: users, loading, error, refresh } = useApi('/api/users');
    
    return {
      users,
      loading,
      error,
      refresh
    };
  }
};`,
    },
    {
      title: 'Angular Service',
      description: 'Angular service with RxJS integration',
      code: `import { Injectable } from '@angular/core';
import { Observable, from, BehaviorSubject } from 'rxjs';
import { map, catchError, tap } from 'rxjs/operators';
import fluxhttp from '@fluxhttp/core';

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private loadingSubject = new BehaviorSubject<boolean>(false);
  public loading$ = this.loadingSubject.asObservable();
  
  constructor() {
    this.setupInterceptors();
  }
  
  private setupInterceptors() {
    fluxhttp.interceptors.request.use((config) => {
      this.loadingSubject.next(true);
      return config;
    });
    
    fluxhttp.interceptors.response.use(
      (response) => {
        this.loadingSubject.next(false);
        return response;
      },
      (error) => {
        this.loadingSubject.next(false);
        return Promise.reject(error);
      }
    );
  }
  
  get<T>(url: string, options?: any): Observable<T> {
    return from(fluxhttp.get(url, options)).pipe(
      map(response => response.data),
      catchError(error => {
        console.error('API Error:', error);
        throw error;
      })
    );
  }
  
  post<T>(url: string, data?: any, options?: any): Observable<T> {
    return from(fluxhttp.post(url, data, options)).pipe(
      map(response => response.data),
      catchError(error => {
        console.error('API Error:', error);
        throw error;
      })
    );
  }
  
  getUsers(): Observable<User[]> {
    return this.get<User[]>('/api/users');
  }
  
  createUser(user: Partial<User>): Observable<User> {
    return this.post<User>('/api/users', user);
  }
}

interface User {
  id: number;
  name: string;
  email: string;
}`,
    },
  ],
};

export default function ExamplesPage() {
  const [activeCategory, setActiveCategory] = useState('basic');

  const copyCode = async (code: string) => {
    await navigator.clipboard.writeText(code);
    toast.success('Code copied to clipboard');
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-4">Code Examples</h1>
          <p className="text-lg text-muted-foreground">
            Practical examples showing how to use FluxHTTP in real-world scenarios. 
            Copy and paste these examples into your projects.
          </p>
        </div>

        {/* Category Tabs */}
        <div className="flex flex-wrap gap-2 mb-8 p-1 bg-muted rounded-lg">
          {categories.map((category) => (
            <Button
              key={category.id}
              variant={activeCategory === category.id ? "default" : "ghost"}
              className="flex items-center gap-2"
              onClick={() => setActiveCategory(category.id)}
            >
              {category.icon}
              <span className="hidden sm:inline">{category.name}</span>
              <span className="sm:hidden">{category.name.split(' ')[0]}</span>
            </Button>
          ))}
        </div>

        {/* Category Description */}
        <div className="mb-8">
          {categories.map((category) => (
            activeCategory === category.id && (
              <div key={category.id} className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg">
                {category.icon}
                <div>
                  <h2 className="text-xl font-semibold">{category.name}</h2>
                  <p className="text-muted-foreground">{category.description}</p>
                </div>
              </div>
            )
          ))}
        </div>

        {/* Examples Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {examples[activeCategory as keyof typeof examples]?.map((example, index) => (
            <Card key={index} className="flex flex-col">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{example.title}</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      {example.description}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyCode(example.code)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex-1">
                <CodeBlock
                  code={example.code}
                  language="typescript"
                  className="h-full"
                />
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Additional Resources */}
        <div className="mt-12">
          <h2 className="text-2xl font-bold mb-6">Additional Resources</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Code className="mr-2 h-5 w-5" />
                  Playground
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-4">
                  Test FluxHTTP code directly in your browser with our interactive playground.
                </p>
                <Button asChild variant="outline">
                  <a href="/playground">
                    Try it out
                    <ExternalLink className="ml-2 h-4 w-4" />
                  </a>
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Code className="mr-2 h-5 w-5" />
                  API Reference
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-4">
                  Complete API documentation with all available methods and options.
                </p>
                <Button asChild variant="outline">
                  <a href="/docs/api">
                    View docs
                    <ExternalLink className="ml-2 h-4 w-4" />
                  </a>
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <ExternalLink className="mr-2 h-5 w-5" />
                  GitHub
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-4">
                  View the source code, report issues, and contribute to FluxHTTP.
                </p>
                <Button asChild variant="outline">
                  <a 
                    href="https://github.com/fluxhttp/core" 
                    target="_blank" 
                    rel="noopener noreferrer"
                  >
                    GitHub repo
                    <ExternalLink className="ml-2 h-4 w-4" />
                  </a>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}