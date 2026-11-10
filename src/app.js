const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const config = require('./config/env.config');
const routes = require('./routes');
const { globalRateLimiter } = require('./middlewares/rateLimiter.middleware');
const { errorHandler, notFoundHandler } = require('./middlewares/error.middleware');

const app = express();

// Security and utility headers
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' }, // Allows images/files to be fetched cross-origin
  })
);

app.use(
  cors({
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// Logging middleware
const morganFormat = config.isProduction ? 'combined' : 'dev';
app.use(morgan(morganFormat));

// Body parsers for JSON and URL-encoded data
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Apply rate limiting to API routes
app.use('/api', globalRateLimiter);

// Mount main application routes
app.use(routes);

// Fallback 404 handler
app.use(notFoundHandler);

// Global centralized error handler
app.use(errorHandler);

module.exports = app;

