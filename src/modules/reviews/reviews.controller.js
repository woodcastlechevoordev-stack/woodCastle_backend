const service = require('./reviews.service');
const googleReviews = require('./google-reviews.service');
const { asyncHandler } = require('../../utils/helpers');

const list = asyncHandler(async (req, res) => {
  const reviews = await service.listPublic(req.query);
  res.json(reviews);
});

const listGoogle = asyncHandler(async (req, res) => {
  const data = await googleReviews.getGoogleReviews();
  res.json(data);
});

const adminList = asyncHandler(async (req, res) => {
  const reviews = await service.listAdmin(req.query);
  res.json(reviews);
});

const create = asyncHandler(async (req, res) => {
  const review = await service.create(req.body);
  res.status(201).json(review);
});

const update = asyncHandler(async (req, res) => {
  const review = await service.update(req.params.id, req.body);
  res.json(review);
});

const remove = asyncHandler(async (req, res) => {
  const result = await service.remove(req.params.id);
  res.json(result);
});

module.exports = { list, listGoogle, adminList, create, update, remove };
