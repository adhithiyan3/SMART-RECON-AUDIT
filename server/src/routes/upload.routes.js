// routes/upload.routes.js
const router = require('express').Router();
const multer = require('multer');
const uploadController = require('../controllers/upload.controller');
const auth = require('../middlewares/auth.middleware');
const role = require('../middlewares/role.middleware');

const upload = multer({ dest: 'uploads/' });

router.post('/check-duplicate', auth.protect, uploadController.checkDuplicate);

router.get(
  '/history',
  auth.protect,
  uploadController.getUploadHistory
);

router.get(
  '/active',
  auth.protect,
  uploadController.getActiveJob
);

router.post(
  '/',
  auth.protect,
  role(['Admin', 'Analyst']),
  upload.single('file'),
  uploadController.uploadFile
);

router.get(
  '/:id',
  auth.protect,
  uploadController.getJobStatus
);

router.post(
  '/:id/map',
  auth.protect,
  role(['Admin', 'Analyst']),
  uploadController.submitMapping
);

module.exports = router;
