const path = require('path');
const gotenbergService = require('../services/gotenberg.service');
const { safeUnlink } = require('../utils/file.utils');
const logger = require('../utils/logger.utils');

class DocumentController {
  /**
   * Handles document conversion to PDF (Office documents, Word, Excel, PowerPoint, HTML).
   */
  async convertDocument(req, res, next) {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: { message: "No document file uploaded. Please supply a file in the 'file' field." },
      });
    }

    const uploadedFilePath = req.file.path;
    const originalFilename = req.file.originalname;
    const ext = path.extname(originalFilename).toLowerCase();

    // Stream safety tracker
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
        logger.warn('Client disconnected prematurely during document conversion', {
          filename: originalFilename,
        });
        cleanup();
      }
    });

    try {
      const options = {
        landscape: req.body.landscape,
        pdfFormat: req.body.pdfFormat,
        pageRanges: req.body.pageRanges,
        nativePageRanges: req.body.nativePageRanges,
      };

      let result;
      if (ext === '.html' || ext === '.htm' || req.file.mimetype === 'text/html') {
        result = await gotenbergService.convertHtmlToPdf({
          filePath: uploadedFilePath,
          originalFilename,
          options,
        });
      } else {
        result = await gotenbergService.convertOfficeToPdf({
          filePath: uploadedFilePath,
          originalFilename,
          options,
        });
      }

      // Set streaming response headers
      res.setHeader('Content-Type', result.contentType);
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${encodeURIComponent(result.filename)}"`
      );
      res.setHeader('Transfer-Encoding', 'chunked');

      // Forward stream events
      result.stream.on('error', async (streamErr) => {
        logger.error('Error in Gotenberg response stream', { error: streamErr.message });
        await cleanup();
        if (!res.headersSent) {
          return next(streamErr);
        }
        res.destroy(streamErr);
      });

      res.on('finish', cleanup);
      res.on('error', cleanup);

      // Pipe the PDF stream to client
      result.stream.pipe(res);
    } catch (err) {
      await cleanup();
      return next(err);
    }
  }
}

module.exports = new DocumentController();

