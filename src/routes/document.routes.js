const { Router } = require('express');
const documentController = require('../controllers/document.controller');
const { uploadDocument } = require('../middlewares/upload.middleware');

const router = Router();

/**
 * @route   POST /api/documents/convert
 * @desc    Converts an uploaded document (Word, Excel, PowerPoint, ODT, HTML) to PDF using Gotenberg
 * @access  Public
 */
router.post('/convert', uploadDocument.single('file'), (req, res, next) => {
  documentController.convertDocument(req, res, next);
});

module.exports = router;

