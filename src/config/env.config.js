const path = require('path');
const fs = require('fs');
require('dotenv').config();

const parseNumber = (val, defaultVal) => {
  const parsed = parseInt(val, 10);
  return Number.isNaN(parsed) ? defaultVal : parsed;
};

const config = {
  env: process.env.NODE_ENV || 'development',
  isProduction: process.env.NODE_ENV === 'production',
  port: parseNumber(process.env.PORT, 5000),
  host: process.env.HOST || '0.0.0.0',

  gotenberg: {
    url: (process.env.GOTENBERG_URL || 'http://localhost:3000').replace(/\/$/, ''),
    timeoutMs: parseNumber(process.env.GOTENBERG_TIMEOUT_MS, 60000),
  },

  uploads: {
    tempDir: path.resolve(process.env.UPLOAD_TEMP_DIR || './uploads/tmp'),
    maxDocumentSizeBytes: parseNumber(process.env.MAX_DOCUMENT_SIZE_BYTES, 52428800), // 50MB
    maxImageSizeBytes: parseNumber(process.env.MAX_IMAGE_SIZE_BYTES, 20971520),       // 20MB
  },

  rateLimit: {
    windowMs: parseNumber(process.env.RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000), // 15 mins
    maxRequests: parseNumber(process.env.RATE_LIMIT_MAX_REQUESTS, 100),
  },
};

// Ensure temp directory exists
if (!fs.existsSync(config.uploads.tempDir)) {
  fs.mkdirSync(config.uploads.tempDir, { recursive: true });
}

module.exports = config;

