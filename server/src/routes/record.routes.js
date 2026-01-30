const router = require('express').Router();
const auth = require('../middlewares/auth.middleware');
const role = require('../middlewares/role.middleware');
const ctrl = require('../controllers/record.controller');

router.get('/', auth.protect, ctrl.getReconciliationResults);
router.get('/:id/timeline', auth.protect, ctrl.getRecordTimeline);
router.put('/:id/correct', auth.protect, role(['Admin', 'Analyst']), ctrl.correctRecord);

module.exports = router;
