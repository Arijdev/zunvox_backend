const path = require('path');
const imageService = require('../services/image.service');
const { safeUnlink } = require('../utils/file.utils');
const logger = require('../utils/logger.utils');

class ImageController {
  /**
   * Applies text overlay to an uploaded image and streams the processed image back.
   */
  async overlayText(req, res, next) {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: { message: "No image uploaded. Please provide an image in the 'image' field." },
      });
    }

    const { text } = req.body;
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      await safeUnlink(req.file.path);
      return res.status(400).json({
        success: false,
        error: { message: "The 'text' field is required and cannot be empty." },
      });
    }

    const uploadedFilePath = req.file.path;
    const originalFilename = req.file.originalname;

    let streamCleanedUp = false;
    const cleanup = async () => {
      if (!streamCleanedUp) {
        streamCleanedUp = true;
        await safeUnlink(uploadedFilePath);
      }
    };

    // Client abort listener: stop processing and release resources
    req.on('close', () => {
      if (!res.writableEnded) {
        logger.warn('Client disconnected prematurely during image overlay', {
          filename: originalFilename,
        });
        cleanup();
      }
    });

    try {
      const options = {
        fontSize: req.body.fontSize,
        fontColor: req.body.fontColor,
        fontFamily: req.body.fontFamily,
        fontWeight: req.body.fontWeight,
        backgroundColor: req.body.backgroundColor,
        padding: req.body.padding,
        borderRadius: req.body.borderRadius,
        strokeWidth: req.body.strokeWidth,
        strokeColor: req.body.strokeColor,
        gravity: req.body.gravity,
        margin: req.body.margin,
        x: req.body.x,
        y: req.body.y,
        format: req.body.format,
        quality: req.body.quality,
      };

      const result = await imageService.applyTextOverlay({
        filePath: uploadedFilePath,
        text,
        options,
      });

      const baseName = path.parse(originalFilename).name || 'image';
      const outputFilename = `${baseName}_overlay.${result.format}`;

      // Set streaming response headers
      res.setHeader('Content-Type', result.contentType);
      res.setHeader(
        'Content-Disposition',
        `inline; filename="${encodeURIComponent(outputFilename)}"`
      );
      res.setHeader('Transfer-Encoding', 'chunked');

      // Forward stream events
      result.stream.on('error', async (streamErr) => {
        logger.error('Error during Sharp image streaming pipeline', { error: streamErr.message });
        await cleanup();
        if (!res.headersSent) {
          return next(streamErr);
        }
        res.destroy(streamErr);
      });

      res.on('finish', cleanup);
      res.on('error', cleanup);

      // Pipe the Sharp output stream directly to the HTTP response
      result.stream.pipe(res);
    } catch (err) {
      await cleanup();
      return next(err);
    }
  }
}

module.exports = new ImageController();

