const { Router } = require('express');
const imageController = require('../controllers/image.controller');
const { uploadImage } = require('../middlewares/upload.middleware');

const router = Router();

/**
 * @route   POST /api/images/overlay-text
 * @desc    Applies custom text overlay to an uploaded image using Sharp and returns the stream
 * @access  Public
 */
router.post('/overlay-text', uploadImage.single('image'), (req, res, next) => {
  imageController.overlayText(req, res, next);
});

module.exports = router;

