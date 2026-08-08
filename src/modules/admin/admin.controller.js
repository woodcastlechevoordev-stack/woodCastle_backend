const adminService = require('./admin.service');
const { asyncHandler } = require('../../utils/helpers');

const login = asyncHandler(async (req, res) => {
  const result = await adminService.login(req.body.username, req.body.password);
  res.json(result);
});

const verifyTotp = asyncHandler(async (req, res) => {
  const result = await adminService.verifyLoginTotp(req.body.tempToken, req.body.code);
  res.json(result);
});

const setup2fa = asyncHandler(async (req, res) => {
  const result = await adminService.setup2fa(req.admin.id);
  res.json(result);
});

const enable2fa = asyncHandler(async (req, res) => {
  const result = await adminService.enable2fa(req.admin.id, req.body.code);
  res.json(result);
});

const disable2fa = asyncHandler(async (req, res) => {
  const result = await adminService.disable2fa(req.admin.id, req.body.password);
  res.json(result);
});

module.exports = {
  login,
  verifyTotp,
  setup2fa,
  enable2fa,
  disable2fa,
};
