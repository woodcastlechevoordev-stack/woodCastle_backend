const service = require('./offers.service');
const { asyncHandler } = require('../../utils/helpers');

const list = asyncHandler(async (req, res) => {
  const offers = await service.listActive();
  res.json(offers);
});

const adminList = asyncHandler(async (req, res) => {
  const offers = await service.listAdmin(req.query);
  res.json(offers);
});

const create = asyncHandler(async (req, res) => {
  const offer = await service.create(req.body);
  res.status(201).json(offer);
});

const update = asyncHandler(async (req, res) => {
  const offer = await service.update(req.params.id, req.body);
  res.json(offer);
});

const remove = asyncHandler(async (req, res) => {
  const result = await service.remove(req.params.id);
  res.json(result);
});

module.exports = { list, adminList, create, update, remove };
