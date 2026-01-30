const router = require('express').Router();
const ctrl = require('../controllers/auth.controller');
const validate = require('../middlewares/validate.middleware');
const { signupSchema, signinSchema } = require('../validators/auth.validator');

router.post('/signup', validate(signupSchema), ctrl.signup);
router.post('/signin', validate(signinSchema), ctrl.signin);
router.get('/me', require('../middlewares/auth.middleware').protect, ctrl.getMe);

module.exports = router;
