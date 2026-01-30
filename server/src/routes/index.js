const router = require('express').Router();

router.use('/auth', require('./auth.routes'));
router.use('/upload', require('./upload.routes'));
router.use('/dashboard', require('./dashboard.routes'));
router.use('/records', require('./record.routes'));
router.use('/config', require('./config.routes'));

module.exports = router;
