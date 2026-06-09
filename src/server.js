require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const path = require('path');
const apiRouter = require('./routes/api');
const { initDb } = require('./db');
const errorHandler = require('./middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 3000;

// Security Middlewares
app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      'script-src': ["'self'", "'unsafe-inline'", "'unsafe-eval'", 'https://cdn.jsdelivr.net', 'https://cdnjs.cloudflare.com'],
      'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      'font-src': ["'self'", 'https://fonts.gstatic.com'],
      'img-src': ["'self'", 'data:']
    }
  }
}));

app.use(cors());
app.use(express.json());

// Custom request logger
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl} - ${res.statusCode} (${duration}ms)`);
  });
  next();
});

// Rate Limiting to prevent brute force/DDoS (100 requests per 15 mins per IP)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Too many requests from this IP, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false
});
app.use('/api/', limiter);

// Serve static assets from public folder (Dashboard UI and styles)
app.use(express.static(path.join(__dirname, '../public')));

// Bind API Routes
app.use('/api', apiRouter);

// Global Error Handler
app.use(errorHandler);

// Initialize database and start the server
async function startServer() {
  try {
    console.log('Initializing database schema...');
    await initDb();
    console.log('Database schema initialization completed.');

    // If running tests, do not start listening on a network port to prevent conflicts
    if (process.env.NODE_ENV !== 'test') {
      app.listen(PORT, () => {
        console.log(`=========================================`);
        console.log(`Verda MVP Server is active on port ${PORT}`);
        console.log(`=========================================`);
      });
    }
  } catch (error) {
    console.error('Fatal initialization error:', error);
    process.exit(1);
  }
}

startServer();

module.exports = app; // Export app for integration tests (supertest)
