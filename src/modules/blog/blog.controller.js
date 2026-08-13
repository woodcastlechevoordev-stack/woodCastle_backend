const service = require('./blog.service');
const { asyncHandler } = require('../../utils/helpers');

const list = asyncHandler(async (req, res) => {
  const posts = await service.listPublic(req.query);
  res.json(posts);
});

const getBySlug = asyncHandler(async (req, res) => {
  const post = await service.getBySlug(req.params.slug);
  res.json(post);
});

const adminList = asyncHandler(async (req, res) => {
  const posts = await service.listAdmin(req.query);
  res.json(posts);
});

const create = asyncHandler(async (req, res) => {
  const post = await service.create(req.body);
  res.status(201).json(post);
});

const update = asyncHandler(async (req, res) => {
  const post = await service.update(req.params.id, req.body);
  res.json(post);
});

const remove = asyncHandler(async (req, res) => {
  const result = await service.remove(req.params.id);
  res.json(result);
});

module.exports = { list, getBySlug, adminList, create, update, remove };
