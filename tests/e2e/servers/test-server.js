const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    // Allow all file types for testing
    cb(null, true);
  }
});

// Middleware
app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-CSRF-Token', 'X-Custom-Header']
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve static files
app.use('/static', express.static(path.join(__dirname, '../static')));

// In-memory storage for session/auth testing
const sessions = new Map();
const users = new Map([
  ['testuser', { password: 'testpass', id: 1, email: 'test@example.com' }],
  ['admin', { password: 'admin123', id: 2, email: 'admin@example.com', role: 'admin' }]
]);

// Authentication middleware
const requireAuth = (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token || !sessions.has(token)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  req.user = sessions.get(token);
  next();
};

// Rate limiting simulation
const rateLimiter = new Map();
const rateLimit = (limit = 10, window = 60000) => (req, res, next) => {
  const key = req.ip;
  const now = Date.now();
  
  if (!rateLimiter.has(key)) {
    rateLimiter.set(key, { count: 1, resetTime: now + window });
    return next();
  }
  
  const data = rateLimiter.get(key);
  if (now > data.resetTime) {
    data.count = 1;
    data.resetTime = now + window;
    return next();
  }
  
  if (data.count >= limit) {
    return res.status(429).json({ 
      error: 'Too Many Requests',
      retryAfter: Math.ceil((data.resetTime - now) / 1000)
    });
  }
  
  data.count++;
  next();
};

// Basic routes
app.get('/', (req, res) => {
  res.json({ 
    message: 'FluxHTTP E2E Test Server',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

// Echo route for testing request/response
app.all('/echo', (req, res) => {
  res.json({
    method: req.method,
    headers: req.headers,
    query: req.query,
    body: req.body,
    url: req.url,
    timestamp: Date.now()
  });
});

// Authentication routes
app.post('/auth/login', (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }
  
  const user = users.get(username);
  if (!user || user.password !== password) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  
  const token = `token_${Date.now()}_${Math.random().toString(36)}`;
  sessions.set(token, { ...user, username });
  
  res.json({
    token,
    user: { id: user.id, username, email: user.email, role: user.role },
    expiresIn: 3600
  });
});

app.post('/auth/refresh', requireAuth, (req, res) => {
  const oldToken = req.headers.authorization?.replace('Bearer ', '');
  sessions.delete(oldToken);
  
  const newToken = `token_${Date.now()}_${Math.random().toString(36)}`;
  sessions.set(newToken, req.user);
  
  res.json({ token: newToken, expiresIn: 3600 });
});

app.post('/auth/logout', requireAuth, (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  sessions.delete(token);
  res.json({ message: 'Logged out successfully' });
});

app.get('/auth/profile', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

// File upload/download routes
app.post('/files/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  
  res.json({
    filename: req.file.filename,
    originalName: req.file.originalname,
    size: req.file.size,
    mimetype: req.file.mimetype,
    path: `/files/download/${req.file.filename}`
  });
});

app.post('/files/upload-multiple', upload.array('files', 5), (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: 'No files uploaded' });
  }
  
  const files = req.files.map(file => ({
    filename: file.filename,
    originalName: file.originalname,
    size: file.size,
    mimetype: file.mimetype,
    path: `/files/download/${file.filename}`
  }));
  
  res.json({ files });
});

app.get('/files/download/:filename', (req, res) => {
  const { filename } = req.params;
  const filePath = path.join(__dirname, '../uploads', filename);
  
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File not found' });
  }
  
  res.download(filePath);
});

// Large data endpoints
app.get('/data/large', (req, res) => {
  const size = parseInt(req.query.size) || 1000;
  const data = Array.from({ length: size }, (_, i) => ({
    id: i,
    name: `Item ${i}`,
    value: Math.random() * 1000,
    description: `Description for item ${i}`.repeat(10)
  }));
  
  res.json({ data, count: size });
});

app.post('/data/large', (req, res) => {
  // Simulate processing large payloads
  const { data } = req.body;
  
  if (!data || !Array.isArray(data)) {
    return res.status(400).json({ error: 'Invalid data format' });
  }
  
  // Simulate processing time
  setTimeout(() => {
    res.json({ 
      processed: data.length,
      timestamp: Date.now(),
      message: 'Large payload processed successfully'
    });
  }, 100);
});

// Delay simulation
app.get('/delay/:ms', (req, res) => {
  const delay = Math.min(parseInt(req.params.ms) || 0, 10000); // Max 10s
  
  setTimeout(() => {
    res.json({ 
      delay,
      message: `Delayed response after ${delay}ms`,
      timestamp: Date.now()
    });
  }, delay);
});

// Error simulation routes
app.get('/error/:code', (req, res) => {
  const code = parseInt(req.params.code) || 500;
  const message = req.query.message || `Simulated ${code} error`;
  
  res.status(code).json({ 
    error: message,
    code,
    timestamp: Date.now()
  });
});

app.get('/timeout', (req, res) => {
  // Never respond - simulates timeout
  setTimeout(() => {
    res.json({ message: 'This should timeout before reaching here' });
  }, 30000);
});

// Rate limited endpoint
app.get('/limited', rateLimit(5, 60000), (req, res) => {
  res.json({ 
    message: 'Rate limited endpoint',
    timestamp: Date.now()
  });
});

// CORS test endpoints
app.options('/cors-test', (req, res) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.sendStatus(200);
});

app.get('/cors-test', (req, res) => {
  res.json({ message: 'CORS test successful' });
});

// CSRF token endpoint
app.get('/csrf-token', (req, res) => {
  const token = `csrf_${Date.now()}_${Math.random().toString(36)}`;
  res.json({ csrfToken: token });
});

// Streaming data endpoint
app.get('/stream', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/plain',
    'Transfer-Encoding': 'chunked'
  });
  
  let count = 0;
  const interval = setInterval(() => {
    res.write(`data chunk ${count}\n`);
    count++;
    
    if (count >= 10) {
      clearInterval(interval);
      res.end();
    }
  }, 100);
});

// Redirect endpoints
app.get('/redirect/:code/:count?', (req, res) => {
  const code = parseInt(req.params.code) || 302;
  const count = parseInt(req.params.count) || 1;
  
  if (count > 1) {
    return res.redirect(code, `/redirect/${code}/${count - 1}`);
  }
  
  res.redirect(code, '/');
});

// Concurrent requests test
app.get('/concurrent/:id', (req, res) => {
  const { id } = req.params;
  const delay = Math.random() * 1000; // Random delay up to 1s
  
  setTimeout(() => {
    res.json({
      id,
      delay: Math.round(delay),
      timestamp: Date.now()
    });
  }, delay);
});

// Memory stress test
app.get('/memory-stress', (req, res) => {
  const size = parseInt(req.query.size) || 1000000; // 1MB default
  const data = 'x'.repeat(size);
  
  res.json({
    size,
    data,
    timestamp: Date.now()
  });
});

// WebSocket endpoint simulation (for testing WebSocket-like behavior)
app.get('/websocket-sim', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*'
  });
  
  let eventId = 0;
  const interval = setInterval(() => {
    res.write(`id: ${eventId}\n`);
    res.write(`data: ${JSON.stringify({ 
      id: eventId, 
      message: `Event ${eventId}`, 
      timestamp: Date.now() 
    })}\n\n`);
    eventId++;
    
    if (eventId >= 5) {
      clearInterval(interval);
      res.end();
    }
  }, 1000);
  
  req.on('close', () => {
    clearInterval(interval);
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: err.message,
    timestamp: Date.now()
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    error: 'Not found',
    path: req.path,
    timestamp: Date.now()
  });
});

const server = app.listen(PORT, () => {
  console.log(`FluxHTTP E2E Test Server running on port ${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
  });
});

module.exports = app;