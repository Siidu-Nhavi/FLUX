const express = require('express');
const { signup, login, logout, me, forgotPassword, resendVerification, resetPassword } = require('../controller/auth');
const { validateAuth } = require('../middleware/validate');
const { requireAuth } = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/signup', validateAuth('signup'), signup);
router.post('/login', validateAuth('login'), login);
router.post('/forgot-password', validateAuth('email'), forgotPassword);
router.post('/resend-verification', validateAuth('email'), resendVerification);
router.post('/logout', requireAuth, logout);
router.get('/me', requireAuth, me);
router.post('/reset-password', requireAuth, validateAuth('reset'), resetPassword);

module.exports = router;
