const { Router } = require('express');
const documentRoutes = require('./document.routes');
const imageRoutes = require('./image.routes');
const healthRoutes = require('./health.routes');

const router = Router();

router.use('/health', healthRoutes);
router.use('/api/documents', documentRoutes);
router.use('/api/images', imageRoutes);

module.exports = router;

