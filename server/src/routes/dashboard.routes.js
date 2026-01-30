const router = require('express').Router();
const auth = require('../middlewares/auth.middleware');

router.get('/summary', auth.protect, require('../controllers/dashboard.controller').summary);
router.get('/users', auth.protect, require('../controllers/dashboard.controller').getUsers);

module.exports = router;
