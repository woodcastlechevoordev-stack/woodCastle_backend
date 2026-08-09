const express = require('express');
const controller = require('./bulk-import.controller');
const adminAuth = require('../../middleware/adminAuth');

const adminRouter = express.Router();

adminRouter.post('/preview', adminAuth, ...controller.preview);
adminRouter.post('/confirm', adminAuth, controller.confirm);
adminRouter.get('/history', adminAuth, controller.history);

module.exports = { adminRouter };
