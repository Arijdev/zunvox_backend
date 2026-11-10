const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const axios = require('axios');
const config = require('../config/env.config');
const logger = require('../utils/logger.utils');

class GotenbergService {
  constructor() {
    this.baseUrl = config.gotenberg.url;
    this.timeout = config.gotenberg.timeoutMs;
  }

  /**
   * Checks the health of the Gotenberg instance.
   * @returns {Promise<{ status: string, details?: any }>}
   */
  async checkHealth() {
    try {
      const response = await axios.get(`${this.baseUrl}/health`, {
        timeout: 5000,
      });
      return { status: 'healthy', details: response.data };
    } catch (err) {
      logger.error('Gotenberg health check failed', { error: err.message, url: this.baseUrl });
      return { status: 'unhealthy', error: err.message };
    }
  }

  /**
   * Converts office documents (Word, Excel, PowerPoint, ODT, RTF, TXT) to PDF using LibreOffice.
   * Streams the input file to Gotenberg and returns the resulting PDF stream.
   *
   * @param {Object} params
   * @param {string} params.filePath - Local filesystem path of uploaded document
   * @param {string} params.originalFilename - Original filename (e.g., document.docx)
   * @param {Object} [params.options={}] - Gotenberg conversion options
   * @returns {Promise<{ stream: import('stream').Readable, contentType: string, filename: string }>}
   */
  async convertOfficeToPdf({ filePath, originalFilename, options = {} }) {
    const endpoint = `${this.baseUrl}/forms/libreoffice/convert`;
    return this._streamGotenbergRequest({
      endpoint,
      filePath,
      originalFilename,
      options,
      outputExtension: '.pdf',
      defaultContentType: 'application/pdf',
    });
  }

  /**
   * Converts HTML files to PDF using Gotenberg Chromium engine.
   *
   * @param {Object} params
   * @param {string} params.filePath - Local path to HTML file
   * @param {string} params.originalFilename - Original filename
   * @param {Object} [params.options={}] - Options such as landscape, marginTop, etc.
   * @returns {Promise<{ stream: import('stream').Readable, contentType: string, filename: string }>}
   */
  async convertHtmlToPdf({ filePath, originalFilename, options = {} }) {
    const endpoint = `${this.baseUrl}/forms/chromium/convert/html`;
    return this._streamGotenbergRequest({
      endpoint,
      filePath,
      // Gotenberg Chromium HTML endpoint expects the main file named 'index.html'
      originalFilename: 'index.html',
      options,
      outputExtension: '.pdf',
      defaultContentType: 'application/pdf',
    });
  }

  /**
   * Converts a remote or internal web URL to PDF using Gotenberg Chromium engine.
   *
   * @param {Object} params
   * @param {string} params.url - Web URL to render (e.g., https://example.com)
   * @param {Object} [params.options={}] - Options (landscape, printBackground, etc.)
   * @returns {Promise<{ stream: import('stream').Readable, contentType: string, filename: string }>}
   */
  async convertUrlToPdf({ url, options = {} }) {
    if (!url || typeof url !== 'string') {
      const err = new Error('A valid URL string is required');
      err.statusCode = 400;
      throw err;
    }

    const endpoint = `${this.baseUrl}/forms/chromium/convert/url`;
    const form = new FormData();
    form.append('url', url.trim());

    if (options.landscape !== undefined) {
      form.append('landscape', String(options.landscape) === 'true' ? 'true' : 'false');
    }
    if (options.printBackground !== undefined) {
      form.append('printBackground', String(options.printBackground) === 'false' ? 'false' : 'true');
    }
    if (options.marginTop) form.append('marginTop', String(options.marginTop));
    if (options.marginBottom) form.append('marginBottom', String(options.marginBottom));
    if (options.marginLeft) form.append('marginLeft', String(options.marginLeft));
    if (options.marginRight) form.append('marginRight', String(options.marginRight));

    try {
      logger.info('Forwarding URL to PDF conversion to Gotenberg', { url });

      const response = await axios.post(endpoint, form, {
        headers: { ...form.getHeaders() },
        responseType: 'stream',
        timeout: this.timeout,
        validateStatus: () => true,
      });

      if (response.status < 200 || response.status >= 300) {
        const errorBody = await this._readStreamToString(response.data);
        const error = new Error(`Gotenberg URL conversion failed (${response.status}): ${errorBody || 'Unknown'}`);
        error.statusCode = response.status >= 400 && response.status < 500 ? 400 : 502;
        throw error;
      }

      return {
        stream: response.data,
        contentType: 'application/pdf',
        filename: 'rendered_url.pdf',
      };
    } catch (err) {
      if (err.code === 'ECONNREFUSED') {
        const connErr = new Error(`Cannot connect to Gotenberg service at ${this.baseUrl}`);
        connErr.statusCode = 503;
        throw connErr;
      }
      throw err;
    }
  }

  /**
   * Merges multiple PDF files into a single unified PDF.
   *
   * @param {Object} params
   * @param {Array<{ path: string, originalname: string }>} params.files - Array of files from multer
   * @param {Object} [params.options={}] - Options (e.g. pdfFormat)
   * @returns {Promise<{ stream: import('stream').Readable, contentType: string, filename: string }>}
   */
  async mergePdfs({ files = [], options = {} }) {
    if (!Array.isArray(files) || files.length < 2) {
      const err = new Error('Merging requires at least two PDF files');
      err.statusCode = 400;
      throw err;
    }

    const endpoint = `${this.baseUrl}/forms/pdfengines/merge`;
    const form = new FormData();
    const streamsToClose = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const readStream = fs.createReadStream(file.path);
      streamsToClose.push(readStream);
      form.append('files', readStream, {
        filename: file.originalname || `file_${i + 1}.pdf`,
      });
    }

    if (options.pdfFormat) {
      form.append('pdfFormat', String(options.pdfFormat));
    }

    try {
      logger.info('Forwarding PDF merge request to Gotenberg', { fileCount: files.length });

      const response = await axios.post(endpoint, form, {
        headers: { ...form.getHeaders() },
        responseType: 'stream',
        timeout: this.timeout,
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
        validateStatus: () => true,
      });

      if (response.status < 200 || response.status >= 300) {
        streamsToClose.forEach((s) => !s.destroyed && s.destroy());
        const errorBody = await this._readStreamToString(response.data);
        const error = new Error(`Gotenberg merge failed (${response.status}): ${errorBody || 'Unknown'}`);
        error.statusCode = response.status >= 400 && response.status < 500 ? 400 : 502;
        throw error;
      }

      return {
        stream: response.data,
        contentType: 'application/pdf',
        filename: 'merged_document.pdf',
      };
    } catch (err) {
      streamsToClose.forEach((s) => !s.destroyed && s.destroy());
      if (err.code === 'ECONNREFUSED') {
        const connErr = new Error(`Cannot connect to Gotenberg service at ${this.baseUrl}`);
        connErr.statusCode = 503;
        throw connErr;
      }
      throw err;
    }
  }

  /**
   * Internal helper to stream file to Gotenberg and obtain result stream with comprehensive error handling.
   * @private
   */
  async _streamGotenbergRequest({
    endpoint,
    filePath,
    originalFilename,
    options = {},
    outputExtension = '.pdf',
    defaultContentType = 'application/pdf',
  }) {
    if (!fs.existsSync(filePath)) {
      throw new Error(`Source file does not exist at path: ${filePath}`);
    }

    const form = new FormData();
    const fileStream = fs.createReadStream(filePath);

    // Track stream errors on file input
    fileStream.on('error', (streamErr) => {
      logger.error('Error reading input file stream for Gotenberg', {
        filePath,
        error: streamErr.message,
      });
    });

    // Append file to multipart form data
    form.append('files', fileStream, {
      filename: originalFilename,
    });

    // Append supported Gotenberg conversion parameters
    if (options.pdfFormat) {
      form.append('pdfFormat', String(options.pdfFormat)); // e.g., 'PDF/A-1b'
    }
    if (options.landscape !== undefined) {
      form.append('landscape', String(options.landscape) === 'true' ? 'true' : 'false');
    }
    if (options.nativePageRanges) {
      form.append('nativePageRanges', String(options.nativePageRanges));
    }
    if (options.pageRanges) {
      form.append('pageRanges', String(options.pageRanges));
    }

    try {
      logger.info('Forwarding document conversion request to Gotenberg', {
        endpoint,
        filename: originalFilename,
      });

      const response = await axios.post(endpoint, form, {
        headers: {
          ...form.getHeaders(),
        },
        responseType: 'stream',
        timeout: this.timeout,
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
        validateStatus: () => true, // Handle non-200 manually to read error stream
      });

      // If Gotenberg returned non-2xx status code, parse error stream into readable message
      if (response.status < 200 || response.status >= 300) {
        fileStream.destroy();

        const errorBody = await this._readStreamToString(response.data);
        logger.error('Gotenberg returned an error response', {
          status: response.status,
          responseBody: errorBody,
        });

        const error = new Error(`Gotenberg conversion failed (status ${response.status}): ${errorBody || 'Unknown error'}`);
        error.statusCode = response.status >= 400 && response.status < 500 ? 400 : 502;
        throw error;
      }

      const contentType = response.headers['content-type'] || defaultContentType;
      const baseName = path.parse(originalFilename).name || 'converted';
      const outputFilename = `${baseName}${outputExtension}`;

      return {
        stream: response.data,
        contentType,
        filename: outputFilename,
      };
    } catch (err) {
      // Ensure file read stream is properly closed
      if (!fileStream.destroyed) {
        fileStream.destroy();
      }

      if (err.code === 'ECONNREFUSED') {
        const connErr = new Error(`Cannot connect to Gotenberg service at ${this.baseUrl}. Is the service running?`);
        connErr.statusCode = 503;
        throw connErr;
      }

      if (err.code === 'ECONNABORTED' || err.message.includes('timeout')) {
        const timeoutErr = new Error(`Gotenberg conversion timed out after ${this.timeout}ms`);
        timeoutErr.statusCode = 504;
        throw timeoutErr;
      }

      throw err;
    }
  }

  /**
   * Helper to collect stream data into a string (used when Gotenberg returns an error payload).
   * @private
   */
  _readStreamToString(stream) {
    return new Promise((resolve) => {
      const chunks = [];
      stream.on('data', (chunk) => chunks.push(chunk));
      stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
      stream.on('error', () => resolve('Failed to read error response stream'));
    });
  }
}

module.exports = new GotenbergService();

