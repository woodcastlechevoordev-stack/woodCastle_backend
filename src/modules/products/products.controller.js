const service = require('./products.service');
const { asyncHandler } = require('../../utils/helpers');

const list = asyncHandler(async (req, res) => {
  const products = await service.listPublic(req.query);
  res.json(products);
});

const getBySlug = asyncHandler(async (req, res) => {
  const product = await service.getBySlug(req.params.slug);
  res.json(product);
});

const adminList = asyncHandler(async (req, res) => {
  const products = await service.listAdmin(req.query);
  res.json(products);
});

const checkDuplicateName = asyncHandler(async (req, res) => {
  const result = await service.checkDuplicateName(req.query);
  res.json(result);
});

const create = asyncHandler(async (req, res) => {
  const product = await service.create(req.body);
  res.status(201).json(product);
});

const update = asyncHandler(async (req, res) => {
  const product = await service.update(req.params.id, req.body);
  res.json(product);
});

const remove = asyncHandler(async (req, res) => {
  const result = await service.remove(req.params.id);
  res.json(result);
});

module.exports = {
  list,
  getBySlug,
  adminList,
  checkDuplicateName,
  create,
  update,
  remove,
};
