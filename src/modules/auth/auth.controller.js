const authService = require('./auth.service');
const { asyncHandler } = require('../../utils/helpers');

const sendOtp = asyncHandler(async (req, res) => {
  const result = await authService.sendOtpForPhone(req.body.phone);
  res.json(result);
});

const verifyOtp = asyncHandler(async (req, res) => {
  const result = await authService.verifyOtpForPhone(req.body.phone, req.body.otp);
  res.json(result);
});

module.exports = { sendOtp, verifyOtp };
