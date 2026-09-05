const express = require('express');
const router = express.Router();
const adminController = require('./admin.controller');

// User Management Routes
router.get('/users/:type', adminController.getUsers);
router.post('/users/dispatch-invite', adminController.dispatchInvite);
router.post('/users/:type', adminController.createUser);
router.delete('/users/:type/:id', adminController.softDeleteUser);
router.put('/users/experts/:id/brcs', adminController.updateExpertBrcs);

// Messaging Routes
router.get('/messages', adminController.getMessages);
router.post('/messages', adminController.broadcastMessage);
router.delete('/messages/:id', adminController.deleteMessage);
router.put('/messages/:id/read', adminController.markMessageRead);

// Onboarding Routes
router.get('/onboard/:token', adminController.validateInvite);
router.post('/onboard/:token', adminController.completeOnboarding);

module.exports = router;
