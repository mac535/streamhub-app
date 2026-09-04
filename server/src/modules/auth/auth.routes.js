const { Router } = require('express');
const authController = require('./auth.controller');
const { validate } = require('../../middleware/validate.middleware');
const { authenticate } = require('../../middleware/auth.middleware');
const { forcePasswordReset } = require('../../middleware/force-password-reset.middleware');
const { loginSchema, registerSchema } = require('@stream/shared');

const router = Router();

// Public routes
router.post('/login', validate(loginSchema), authController.login);
router.post('/register', validate(registerSchema), authController.register);
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password/:token', authController.resetPassword);

// Protected routes
// GET /me and PUT /change-password are exempt from forcePasswordReset
// (handled inside the middleware itself), so we apply it uniformly.
router.get('/me', authenticate, forcePasswordReset, authController.getProfile);
router.put('/profile', authenticate, forcePasswordReset, authController.updateProfile);
router.put('/change-password', authenticate, authController.changePassword);

module.exports = router;
