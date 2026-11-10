const http = require('http');
const app = require('./app');
const config = require('./config/env.config');
const logger = require('./utils/logger.utils');
const { startTempCleanupWorker } = require('./utils/file.utils');

const server = http.createServer(app);

// Start background temporary file sweeper (every 15m, cleans files older than 30m)
startTempCleanupWorker(config.uploads.tempDir);

// Graceful shutdown management
const shutdown = (signal) => {
  logger.info(`Received ${signal}. Gracefully shutting down HTTP server...`);

  server.close(() => {
    logger.info('HTTP server closed successfully.');
    process.exit(0);
  });

  // Force shutdown if connections do not close in 15 seconds
  setTimeout(() => {
    logger.error('Forcefully terminating process due to lingering connections.');
    process.exit(1);
  }, 15000).unref();
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Promise Rejection', { reason, promise });
});

process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception', { error: err.message, stack: err.stack });
  process.exit(1);
});

server.listen(config.port, config.host, () => {
  logger.info(`Zunvox Backend Server is running in [${config.env}] mode`, {
    host: config.host,
    port: config.port,
    gotenbergUrl: config.gotenberg.url,
  });
});

