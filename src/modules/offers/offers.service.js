const prisma = require('../../config/db');
const { createError } = require('../../middleware/errorHandler');
const {
  containsInsensitive,
  parseBooleanQuery,
} = require('../../utils/helpers');

async function listActive() {
  const now = new Date();

  return prisma.offer.findMany({
    where: {
      isActive: true,
      AND: [
        { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
        { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
      ],
    },
    orderBy: { createdAt: 'desc' },
  });
}

async function listAdmin(query = {}) {
  const where = {};
  const titleMatch = containsInsensitive(query.search);
  if (titleMatch) where.title = titleMatch;

  const isActive = parseBooleanQuery(query.isActive);
  if (isActive !== undefined) where.isActive = isActive;

  return prisma.offer.findMany({
    where,
    orderBy: { createdAt: 'desc' },
  });
}

async function create(data) {
  const title = data.title?.trim();
  if (!title) throw createError(400, 'title is required');

  return prisma.offer.create({
    data: {
      title,
      description: data.description || null,
      bannerImage: data.bannerImage || null,
      discountText: data.discountText || null,
      linkUrl: data.linkUrl || null,
      isActive: data.isActive !== undefined ? Boolean(data.isActive) : true,
      startsAt: data.startsAt || null,
      endsAt: data.endsAt || null,
    },
  });
}

async function update(id, data) {
  const existing = await prisma.offer.findUnique({ where: { id } });
  if (!existing) throw createError(404, 'Offer not found');

  return prisma.offer.update({
    where: { id },
    data: {
      ...(data.title !== undefined ? { title: data.title.trim() } : {}),
      ...(data.description !== undefined ? { description: data.description } : {}),
      ...(data.bannerImage !== undefined ? { bannerImage: data.bannerImage } : {}),
      ...(data.discountText !== undefined ? { discountText: data.discountText } : {}),
      ...(data.linkUrl !== undefined ? { linkUrl: data.linkUrl } : {}),
      ...(data.isActive !== undefined ? { isActive: Boolean(data.isActive) } : {}),
      ...(data.startsAt !== undefined ? { startsAt: data.startsAt } : {}),
      ...(data.endsAt !== undefined ? { endsAt: data.endsAt } : {}),
    },
  });
}

async function remove(id) {
  await prisma.offer.delete({ where: { id } });
  return { message: 'Offer deleted' };
}

module.exports = {
  listActive,
  listAdmin,
  create,
  update,
  remove,
};
