const service = require('./categories.service');
const { asyncHandler } = require('../../utils/helpers');

const list = asyncHandler(async (req, res) => {
  const categories = await service.listPublic();
  res.json(categories);
});

const productsBySlug = asyncHandler(async (req, res) => {
  const result = await service.productsByCategorySlug(
    req.params.slug,
    req.query
  );
  res.json(result);
});

const adminList = asyncHandler(async (req, res) => {
  const categories = await service.listAdmin();
  res.json(categories);
});

const create = asyncHandler(async (req, res) => {
  const category = await service.create(req.body);
  res.status(201).json(category);
});

const update = asyncHandler(async (req, res) => {
  const category = await service.update(req.params.id, req.body);
  res.json(category);
});

const remove = asyncHandler(async (req, res) => {
  const result = await service.remove(req.params.id);
  res.json(result);
});

module.exports = { list, productsBySlug, adminList, create, update, remove };
