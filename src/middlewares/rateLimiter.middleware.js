const rateLimit = require('express-rate-limit');
const config = require('../config/env.config');

const globalRateLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxRequests,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      message: 'Too many requests from this IP address, please try again later.',
    },
  },
});

module.exports = {
  globalRateLimiter,
};

