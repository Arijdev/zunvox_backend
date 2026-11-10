const { Router } = require('express');
const healthController = require('../controllers/health.controller');

const router = Router();

/**
 * @route   GET /health
 * @desc    Comprehensive system and Gotenberg integration health check
 * @access  Public
 */
router.get('/', (req, res) => {
  healthController.getHealth(req, res);
});

module.exports = router;

