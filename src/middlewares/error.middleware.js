const multer = require('multer');
const logger = require('../utils/logger.utils');
const { cleanupFiles } = require('../utils/file.utils');

/**
 * Global Express error handling middleware.
 */
const errorHandler = async (err, req, res, next) => {
  // Always clean up any uploaded files in request if an error occurs
  const filesToClean = [];
  if (req.file) {
    filesToClean.push(req.file.path);
  }
  if (Array.isArray(req.files)) {
    req.files.forEach((f) => filesToClean.push(f.path));
  } else if (req.files && typeof req.files === 'object') {
    Object.values(req.files).flat().forEach((f) => filesToClean.push(f.path));
  }

  if (filesToClean.length > 0) {
    await cleanupFiles(filesToClean);
  }

  // Handle Multer-specific errors
  if (err instanceof multer.MulterError) {
    logger.warn('Multer upload error', { code: err.code, message: err.message });
    let statusCode = 400;
    let message = err.message;

    if (err.code === 'LIMIT_FILE_SIZE') {
      message = 'Uploaded file exceeds the maximum allowed size limit.';
      statusCode = 413;
    } else if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      message = `Unexpected upload field: ${err.field}`;
    }

    return res.status(statusCode).json({
      success: false,
      error: {
        code: err.code,
        message,
      },
    });
  }

  const statusCode = err.statusCode || (res.statusCode >= 400 ? res.statusCode : 500);
  const isServerFault = statusCode >= 500;

  if (isServerFault) {
    logger.error('Unhandled internal server error', {
      error: err.message,
      stack: err.stack,
      url: req.originalUrl,
      method: req.method,
    });
  } else {
    logger.warn('Client request error', {
      statusCode,
      error: err.message,
      url: req.originalUrl,
    });
  }

  // If response headers already sent, delegate to Express default handler
  if (res.headersSent) {
    return next(err);
  }

  res.status(statusCode).json({
    success: false,
    error: {
      message: isServerFault && process.env.NODE_ENV === 'production'
        ? 'Internal server error occurred while processing your request.'
        : err.message,
      ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
    },
  });
};

/**
 * 404 Route Not Found handler.
 */
const notFoundHandler = (req, res) => {
  res.status(404).json({
    success: false,
    error: {
      message: `Resource not found: ${req.method} ${req.originalUrl}`,
    },
  });
};

module.exports = {
  errorHandler,
  notFoundHandler,
};

