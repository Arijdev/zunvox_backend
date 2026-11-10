const fs = require('fs');
const path = require('path');
const { pipeline } = require('stream/promises');
const logger = require('./logger.utils');

/**
 * Safely removes a file from disk without throwing unhandled exceptions.
 * @param {string} filePath
 */
const safeUnlink = async (filePath) => {
  if (!filePath) return;
  try {
    if (fs.existsSync(filePath)) {
      await fs.promises.unlink(filePath);
      logger.debug('Cleaned up temporary file', { filePath });
    }
  } catch (err) {
    logger.warn('Failed to delete temporary file', { filePath, error: err.message });
  }
};

/**
 * Cleans up multiple files safely.
 * @param {string[]} filePaths
 */
const cleanupFiles = async (filePaths = []) => {
  await Promise.allSettled(filePaths.filter(Boolean).map(safeUnlink));
};

/**
 * Sanitizes a filename to prevent path traversal or invalid characters.
 * @param {string} originalName
 * @param {string} fallbackExtension
 * @returns {string}
 */
const sanitizeFilename = (originalName, fallbackExtension = '.bin') => {
  if (!originalName) return `file_${Date.now()}${fallbackExtension}`;
  const base = path.basename(originalName);
  const sanitized = base.replace(/[^a-zA-Z0-9._-]/g, '_');
  return sanitized.length > 0 ? sanitized : `file_${Date.now()}${fallbackExtension}`;
};

/**
 * Scans a directory and deletes files older than the specified age.
 * Protects against disk accumulation from unexpected process crashes.
 *
 * @param {string} dirPath - Directory to sweep
 * @param {number} [maxAgeMs=1800000] - Max age in ms (default: 30 minutes)
 */
const cleanStaleTempFiles = async (dirPath, maxAgeMs = 30 * 60 * 1000) => {
  try {
    if (!fs.existsSync(dirPath)) return;
    const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
    const now = Date.now();

    for (const entry of entries) {
      if (entry.isFile()) {
        const fullPath = path.join(dirPath, entry.name);
        try {
          const stats = await fs.promises.stat(fullPath);
          if (now - stats.mtimeMs > maxAgeMs) {
            await fs.promises.unlink(fullPath);
            logger.info('Cleaned up stale orphaned temporary file', { file: entry.name });
          }
        } catch {
          // File might have been cleaned up by normal request flow
        }
      }
    }
  } catch (err) {
    logger.warn('Error during stale temp file sweep', { error: err.message });
  }
};

/**
 * Initiates an unref'd interval worker that periodically purges stale temp files.
 * @param {string} dirPath
 * @param {number} [intervalMs=900000] - Sweep interval (default: 15 minutes)
 * @param {number} [maxAgeMs=1800000] - Stale threshold (default: 30 minutes)
 * @returns {NodeJS.Timeout}
 */
const startTempCleanupWorker = (dirPath, intervalMs = 15 * 60 * 1000, maxAgeMs = 30 * 60 * 1000) => {
  // Run an initial sweep at startup
  cleanStaleTempFiles(dirPath, maxAgeMs);

  const timer = setInterval(() => {
    cleanStaleTempFiles(dirPath, maxAgeMs);
  }, intervalMs);

  timer.unref(); // Does not prevent Node process from gracefully exiting
  return timer;
};

module.exports = {
  safeUnlink,
  cleanupFiles,
  sanitizeFilename,
  cleanStaleTempFiles,
  startTempCleanupWorker,
  pipeline,
};
