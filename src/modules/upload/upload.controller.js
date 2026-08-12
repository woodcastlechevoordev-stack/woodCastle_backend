const service = require('./upload.service');
const { asyncHandler } = require('../../utils/helpers');

const createSignature = asyncHandler(async (req, res) => {
  const result = service.createSignature(req.body?.folder);
  res.json(result);
});

module.exports = { createSignature };
