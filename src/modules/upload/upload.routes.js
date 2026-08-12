const express = require('express');
const controller = require('./upload.controller');
const adminAuth = require('../../middleware/adminAuth');

const adminRouter = express.Router();

adminRouter.post('/signature', adminAuth, controller.createSignature);

module.exports = { adminRouter };
