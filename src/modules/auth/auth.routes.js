const express = require('express');
const rateLimit = require('express-rate-limit');
const controller = require('./auth.controller');

const router = express.Router();

const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many OTP requests, try again later' },
});

router.post('/send-otp', otpLimiter, controller.sendOtp);
router.post('/verify-otp', otpLimiter, controller.verifyOtp);

module.exports = router;
