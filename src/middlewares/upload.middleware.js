const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const config = require('../config/env.config');
const { sanitizeFilename } = require('../utils/file.utils');

// Disk storage ensures that large files (up to 50MB+) do not overwhelm process memory
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, config.uploads.tempDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const uniqueName = `${uuidv4()}_${sanitizeFilename(file.originalname, ext)}`;
    cb(null, uniqueName);
  },
});

// Allowed document MIME types and extensions
const ALLOWED_DOCUMENT_MIMES = [
  // Microsoft Word / Office
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'application/msword', // .doc
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
  'application/vnd.ms-excel', // .xls
  'application/vnd.openxmlformats-officedocument.presentationml.presentation', // .pptx
  'application/vnd.ms-powerpoint', // .ppt
  // OpenDocument
  'application/vnd.oasis.opendocument.text', // .odt
  'application/vnd.oasis.opendocument.spreadsheet', // .ods
  'application/vnd.oasis.opendocument.presentation', // .odp
  // Text and web
  'text/plain',
  'text/html',
  'text/rtf',
  'application/rtf',
  // PDF
  'application/pdf',
];

const ALLOWED_DOCUMENT_EXTENSIONS = [
  '.docx', '.doc', '.xlsx', '.xls', '.pptx', '.ppt',
  '.odt', '.ods', '.odp', '.txt', '.html', '.htm', '.rtf', '.pdf',
];

// Allowed image MIME types and extensions
const ALLOWED_IMAGE_MIMES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
  'image/tiff',
  'image/gif',
  'image/svg+xml',
];

const ALLOWED_IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.avif', '.tiff', '.gif', '.svg'];

const documentFileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const mime = file.mimetype.toLowerCase();

  const isExtAllowed = ALLOWED_DOCUMENT_EXTENSIONS.includes(ext);
  const isMimeAllowed = ALLOWED_DOCUMENT_MIMES.includes(mime) || mime === 'application/octet-stream';

  if (isExtAllowed || isMimeAllowed) {
    return cb(null, true);
  }

  const error = new Error(`Unsupported document type (${file.originalname}). Allowed: ${ALLOWED_DOCUMENT_EXTENSIONS.join(', ')}`);
  error.statusCode = 400;
  cb(error, false);
};

const imageFileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const mime = file.mimetype.toLowerCase();

  const isExtAllowed = ALLOWED_IMAGE_EXTENSIONS.includes(ext);
  const isMimeAllowed = ALLOWED_IMAGE_MIMES.includes(mime);

  if (isExtAllowed || isMimeAllowed) {
    return cb(null, true);
  }

  const error = new Error(`Unsupported image format (${file.originalname}). Allowed: ${ALLOWED_IMAGE_EXTENSIONS.join(', ')}`);
  error.statusCode = 400;
  cb(error, false);
};

const uploadDocument = multer({
  storage,
  limits: {
    fileSize: config.uploads.maxDocumentSizeBytes,
    files: 10, // Supports single or multiple document conversion
  },
  fileFilter: documentFileFilter,
});

const uploadImage = multer({
  storage,
  limits: {
    fileSize: config.uploads.maxImageSizeBytes,
    files: 1,
  },
  fileFilter: imageFileFilter,
});

module.exports = {
  uploadDocument,
  uploadImage,
};

