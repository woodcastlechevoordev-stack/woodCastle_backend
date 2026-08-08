const express = require('express');
const rateLimit = require('express-rate-limit');
const controller = require('./enquiries.controller');
const adminAuth = require('../../middleware/adminAuth');

const publicRouter = express.Router();
const adminRouter = express.Router();

const enquiryLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many enquiries, try again later' },
});

publicRouter.post('/', enquiryLimiter, controller.create);

adminRouter.get('/', adminAuth, controller.adminList);
adminRouter.patch('/:id', adminAuth, controller.update);

module.exports = { publicRouter, adminRouter };
