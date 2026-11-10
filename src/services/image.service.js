const fs = require('fs');
const sharp = require('sharp');
const logger = require('../utils/logger.utils');
const { createTextOverlaySvg } = require('../utils/svg.utils');

class ImageService {
  /**
   * Applies a text overlay to an image stream/file using Sharp and SVG compositing.
   *
   * @param {Object} params
   * @param {string} params.filePath - Local filesystem path to the uploaded image
   * @param {string} params.text - Text string to overlay
   * @param {Object} [params.options={}] - Custom overlay and output options
   * @returns {Promise<{ stream: import('stream').Readable, contentType: string, format: string }>}
   */
  async applyTextOverlay({ filePath, text, options = {} }) {
    if (!fs.existsSync(filePath)) {
      throw new Error(`Image file not found at: ${filePath}`);
    }

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      const err = new Error("Field 'text' is required for text overlay");
      err.statusCode = 400;
      throw err;
    }

    try {
      // 1. Inspect image metadata
      const imageInstance = sharp(filePath, { failOnError: false });
      const metadata = await imageInstance.metadata();

      if (!metadata.width || !metadata.height) {
        const err = new Error('Invalid or corrupted image: Unable to retrieve dimensions.');
        err.statusCode = 400;
        throw err;
      }

      logger.info('Processing image overlay', {
        dimensions: `${metadata.width}x${metadata.height}`,
        format: metadata.format,
        hasAlpha: metadata.hasAlpha,
      });

      // 2. Parse typography & styling options with intelligent defaults
      const fontSize = options.fontSize
        ? parseInt(options.fontSize, 10)
        : Math.max(18, Math.round(metadata.width * 0.045)); // Auto-scale to ~4.5% of image width

      const fontColor = options.fontColor || '#ffffff';
      const fontFamily = options.fontFamily || 'Arial, Helvetica, sans-serif';
      const fontWeight = options.fontWeight || 'bold';
      const backgroundColor = options.backgroundColor !== undefined ? options.backgroundColor : 'rgba(0, 0, 0, 0.6)';
      const padding = options.padding ? parseInt(options.padding, 10) : Math.round(fontSize * 0.45);
      const borderRadius = options.borderRadius ? parseInt(options.borderRadius, 10) : 8;
      const strokeWidth = options.strokeWidth ? parseInt(options.strokeWidth, 10) : 0;
      const strokeColor = options.strokeColor || '#000000';

      // 3. Generate the dynamic SVG text overlay
      const { svgBuffer, width: overlayWidth, height: overlayHeight } = createTextOverlaySvg({
        text: text.trim(),
        imageWidth: metadata.width,
        imageHeight: metadata.height,
        fontSize,
        fontColor,
        fontFamily,
        fontWeight,
        backgroundColor,
        padding,
        borderRadius,
        strokeWidth,
        strokeColor,
      });

      // 4. Calculate coordinates based on gravity or explicit (x, y)
      const margin = options.margin ? parseInt(options.margin, 10) : Math.round(metadata.height * 0.05);
      const gravity = (options.gravity || 'south').toLowerCase();
      let left = 0;
      let top = 0;

      if (options.x !== undefined && options.y !== undefined) {
        left = Math.max(0, parseInt(options.x, 10));
        top = Math.max(0, parseInt(options.y, 10));
      } else {
        switch (gravity) {
          case 'north':
            left = Math.round((metadata.width - overlayWidth) / 2);
            top = margin;
            break;
          case 'northeast':
            left = metadata.width - overlayWidth - margin;
            top = margin;
            break;
          case 'northwest':
            left = margin;
            top = margin;
            break;
          case 'center':
            left = Math.round((metadata.width - overlayWidth) / 2);
            top = Math.round((metadata.height - overlayHeight) / 2);
            break;
          case 'east':
            left = metadata.width - overlayWidth - margin;
            top = Math.round((metadata.height - overlayHeight) / 2);
            break;
          case 'west':
            left = margin;
            top = Math.round((metadata.height - overlayHeight) / 2);
            break;
          case 'southeast':
            left = metadata.width - overlayWidth - margin;
            top = metadata.height - overlayHeight - margin;
            break;
          case 'southwest':
            left = margin;
            top = metadata.height - overlayHeight - margin;
            break;
          case 'south':
          default:
            left = Math.round((metadata.width - overlayWidth) / 2);
            top = metadata.height - overlayHeight - margin;
            break;
        }
      }

      // Clamp coordinates to image boundaries
      left = Math.max(0, Math.min(left, metadata.width - overlayWidth));
      top = Math.max(0, Math.min(top, metadata.height - overlayHeight));

      // 5. Build the Sharp processing pipeline
      let pipeline = sharp(filePath).composite([
        {
          input: svgBuffer,
          top: Math.round(top),
          left: Math.round(left),
        },
      ]);

      // 6. Handle target output format
      const outputFormat = (options.format || metadata.format || 'png').toLowerCase();
      const quality = options.quality ? Math.min(100, Math.max(1, parseInt(options.quality, 10))) : 85;

      let contentType = 'image/png';
      switch (outputFormat) {
        case 'jpeg':
        case 'jpg':
          pipeline = pipeline.jpeg({ quality, mozjpeg: true });
          contentType = 'image/jpeg';
          break;
        case 'webp':
          pipeline = pipeline.webp({ quality });
          contentType = 'image/webp';
          break;
        case 'avif':
          pipeline = pipeline.avif({ quality });
          contentType = 'image/avif';
          break;
        case 'png':
        default:
          pipeline = pipeline.png({ compressionLevel: 8 });
          contentType = 'image/png';
          break;
      }

      return {
        stream: pipeline,
        contentType,
        format: outputFormat,
      };
    } catch (err) {
      logger.error('Failed to apply text overlay to image', {
        filePath,
        error: err.message,
      });

      if (err.message && err.message.includes('unsupported image format')) {
        const customErr = new Error('The uploaded file is not a supported or valid image format.');
        customErr.statusCode = 400;
        throw customErr;
      }

      throw err;
    }
  }
}

module.exports = new ImageService();

