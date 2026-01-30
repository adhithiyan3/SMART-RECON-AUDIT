const express = require('express');
const router = express.Router();
const configController = require('../controllers/config.controller');
const auth = require('../middlewares/auth.middleware');
const role = require('../middlewares/role.middleware');

router.get('/', auth.protect, configController.getConfigs);
router.post('/', auth.protect, role(['Admin']), configController.updateConfig);

module.exports = router;
