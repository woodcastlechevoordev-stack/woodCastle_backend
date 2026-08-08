const service = require('./enquiries.service');
const { asyncHandler } = require('../../utils/helpers');

const create = asyncHandler(async (req, res) => {
  const result = await service.createEnquiry(req.body);
  res.status(201).json(result);
});

const adminList = asyncHandler(async (req, res) => {
  const enquiries = await service.listAdmin(req.query);
  res.json(enquiries);
});

const update = asyncHandler(async (req, res) => {
  const enquiry = await service.updateStatus(req.params.id, req.body.status);
  res.json(enquiry);
});

module.exports = { create, adminList, update };
