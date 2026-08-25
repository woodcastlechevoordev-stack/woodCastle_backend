const service = require('./pages.service');
const { asyncHandler } = require('../../utils/helpers');

const getByKey = asyncHandler(async (req, res) => {
  const page = await service.getByKey(req.params.key);
  res.json(page);
});

const update = asyncHandler(async (req, res) => {
  const page = await service.upsert(req.params.key, req.body);
  res.json(page);
});

const adminList = asyncHandler(async (req, res) => {
  const pages = await service.listAdmin();
  res.json(pages);
});

const adminGetByKey = asyncHandler(async (req, res) => {
  const page = await service.getByKey(req.params.key);
  res.json(page);
});

module.exports = { getByKey, update, adminList, adminGetByKey };
