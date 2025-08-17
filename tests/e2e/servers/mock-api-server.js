const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-API-Key']
}));

app.use(express.json());

// Mock external APIs for testing
const mockData = {
  users: [
    { id: 1, name: 'John Doe', email: 'john@example.com', active: true },
    { id: 2, name: 'Jane Smith', email: 'jane@example.com', active: true },
    { id: 3, name: 'Bob Johnson', email: 'bob@example.com', active: false }
  ],
  posts: [
    { id: 1, title: 'First Post', content: 'This is the first post', userId: 1 },
    { id: 2, title: 'Second Post', content: 'This is the second post', userId: 2 },
    { id: 3, title: 'Third Post', content: 'This is the third post', userId: 1 }
  ]
};

// API key validation middleware
const requireApiKey = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  if (!apiKey || apiKey !== 'test-api-key-123') {
    return res.status(401).json({ error: 'Invalid API key' });
  }
  next();
};

// JSONPlaceholder-like API for testing
app.get('/api/users', (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const start = (page - 1) * limit;
  const end = start + limit;
  
  const users = mockData.users.slice(start, end);
  
  res.json({
    data: users,
    pagination: {
      page,
      limit,
      total: mockData.users.length,
      totalPages: Math.ceil(mockData.users.length / limit)
    }
  });
});

app.get('/api/users/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const user = mockData.users.find(u => u.id === id);
  
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  
  res.json({ data: user });
});

app.post('/api/users', (req, res) => {
  const { name, email } = req.body;
  
  if (!name || !email) {
    return res.status(400).json({ error: 'Name and email are required' });
  }
  
  const newUser = {
    id: mockData.users.length + 1,
    name,
    email,
    active: true
  };
  
  mockData.users.push(newUser);
  
  res.status(201).json({ data: newUser });
});

app.put('/api/users/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const userIndex = mockData.users.findIndex(u => u.id === id);
  
  if (userIndex === -1) {
    return res.status(404).json({ error: 'User not found' });
  }
  
  const { name, email, active } = req.body;
  const updatedUser = {
    ...mockData.users[userIndex],
    ...(name && { name }),
    ...(email && { email }),
    ...(typeof active === 'boolean' && { active })
  };
  
  mockData.users[userIndex] = updatedUser;
  
  res.json({ data: updatedUser });
});

app.delete('/api/users/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const userIndex = mockData.users.findIndex(u => u.id === id);
  
  if (userIndex === -1) {
    return res.status(404).json({ error: 'User not found' });
  }
  
  mockData.users.splice(userIndex, 1);
  
  res.status(204).send();
});

// Posts API
app.get('/api/posts', (req, res) => {
  const userId = req.query.userId ? parseInt(req.query.userId) : null;
  let posts = mockData.posts;
  
  if (userId) {
    posts = posts.filter(p => p.userId === userId);
  }
  
  res.json({ data: posts });
});

app.get('/api/posts/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const post = mockData.posts.find(p => p.id === id);
  
  if (!post) {
    return res.status(404).json({ error: 'Post not found' });
  }
  
  res.json({ data: post });
});

// Protected API endpoint requiring API key
app.get('/api/protected/data', requireApiKey, (req, res) => {
  res.json({
    data: {
      secret: 'This is protected data',
      timestamp: Date.now(),
      apiKey: req.headers['x-api-key']
    }
  });
});

// Webhook simulation endpoint
app.post('/webhooks/test', (req, res) => {
  console.log('Webhook received:', req.body);
  
  // Simulate webhook processing
  setTimeout(() => {
    res.json({
      received: true,
      timestamp: Date.now(),
      data: req.body
    });
  }, 100);
});

// Real-world API simulations

// GitHub-like API
app.get('/github/repos/:owner/:repo', (req, res) => {
  const { owner, repo } = req.params;
  
  res.json({
    id: 12345,
    name: repo,
    full_name: `${owner}/${repo}`,
    owner: {
      login: owner,
      id: 67890,
      type: 'User'
    },
    description: `A mock repository for ${repo}`,
    stargazers_count: Math.floor(Math.random() * 1000),
    watchers_count: Math.floor(Math.random() * 100),
    language: 'JavaScript',
    created_at: '2023-01-01T00:00:00Z',
    updated_at: new Date().toISOString()
  });
});

// Twitter-like API
app.get('/twitter/tweets', requireApiKey, (req, res) => {
  const count = parseInt(req.query.count) || 10;
  
  const tweets = Array.from({ length: count }, (_, i) => ({
    id: `tweet_${Date.now()}_${i}`,
    text: `This is tweet number ${i + 1}`,
    user: {
      id: `user_${i % 3}`,
      name: ['Alice', 'Bob', 'Charlie'][i % 3],
      screen_name: ['alice', 'bob', 'charlie'][i % 3]
    },
    created_at: new Date(Date.now() - (i * 60000)).toISOString(),
    retweet_count: Math.floor(Math.random() * 100),
    favorite_count: Math.floor(Math.random() * 200)
  }));
  
  res.json({ data: tweets });
});

// Weather API simulation
app.get('/weather/current', (req, res) => {
  const { lat, lon, city } = req.query;
  
  if (!lat && !lon && !city) {
    return res.status(400).json({ error: 'Location required (lat/lon or city)' });
  }
  
  res.json({
    location: city || `${lat},${lon}`,
    temperature: Math.floor(Math.random() * 40) - 10, // -10 to 30°C
    humidity: Math.floor(Math.random() * 100),
    description: ['sunny', 'cloudy', 'rainy', 'snowy'][Math.floor(Math.random() * 4)],
    wind_speed: Math.floor(Math.random() * 20),
    timestamp: Date.now()
  });
});

// Payment API simulation
app.post('/payments/charge', requireApiKey, (req, res) => {
  const { amount, currency, source } = req.body;
  
  if (!amount || !currency || !source) {
    return res.status(400).json({ 
      error: 'Missing required fields: amount, currency, source' 
    });
  }
  
  // Simulate payment processing
  setTimeout(() => {
    const success = Math.random() > 0.1; // 90% success rate
    
    if (success) {
      res.json({
        id: `charge_${Date.now()}_${Math.random().toString(36)}`,
        amount,
        currency,
        status: 'succeeded',
        created: Date.now()
      });
    } else {
      res.status(402).json({
        error: 'Payment failed',
        code: 'card_declined',
        message: 'Your card was declined'
      });
    }
  }, 500);
});

// Rate limited API (simulates real API limits)
const apiCallCounts = new Map();
app.get('/api/rate-limited', (req, res) => {
  const apiKey = req.headers['x-api-key'] || 'anonymous';
  const now = Date.now();
  const windowStart = Math.floor(now / 60000) * 60000; // 1-minute windows
  
  const key = `${apiKey}_${windowStart}`;
  const currentCount = apiCallCounts.get(key) || 0;
  
  if (currentCount >= 100) { // 100 requests per minute
    return res.status(429).json({
      error: 'Rate limit exceeded',
      limit: 100,
      window: 60,
      retry_after: 60 - Math.floor((now - windowStart) / 1000)
    });
  }
  
  apiCallCounts.set(key, currentCount + 1);
  
  res.json({
    message: 'API call successful',
    remaining: 99 - currentCount,
    reset_time: windowStart + 60000
  });
});

// Server-sent events simulation
app.get('/api/events', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*'
  });
  
  let eventCount = 0;
  const interval = setInterval(() => {
    const event = {
      id: eventCount,
      type: 'update',
      data: {
        message: `Event ${eventCount}`,
        timestamp: Date.now(),
        random: Math.random()
      }
    };
    
    res.write(`id: ${eventCount}\n`);
    res.write(`event: update\n`);
    res.write(`data: ${JSON.stringify(event.data)}\n\n`);
    
    eventCount++;
    
    if (eventCount >= 10) {
      clearInterval(interval);
      res.end();
    }
  }, 1000);
  
  req.on('close', () => {
    clearInterval(interval);
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'mock-api-server',
    timestamp: Date.now() 
  });
});

// Error handling
app.use((err, req, res, next) => {
  console.error('Mock API Server error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: err.message 
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    error: 'Endpoint not found',
    path: req.path 
  });
});

const server = app.listen(PORT, () => {
  console.log(`Mock API Server running on port ${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down Mock API Server gracefully');
  server.close(() => {
    console.log('Mock API Server terminated');
  });
});

module.exports = app;