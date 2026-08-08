const express = require('express');
const controller = require('./admin.controller');
const adminAuth = require('../../middleware/adminAuth');

const router = express.Router();

router.post('/login', controller.login);
router.post('/login/verify-totp', controller.verifyTotp);

router.post('/2fa/setup', adminAuth, controller.setup2fa);
router.post('/2fa/enable', adminAuth, controller.enable2fa);
router.post('/2fa/disable', adminAuth, controller.disable2fa);

module.exports = router;
