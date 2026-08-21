const prisma = require('../../config/db');
const { containsInsensitive } = require('../../utils/helpers');
const { createError } = require('../../middleware/errorHandler');

const publicSelect = {
  id: true,
  customerName: true,
  rating: true,
  reviewText: true,
  customerPhoto: true,
  productId: true,
  createdAt: true,
};

function parseRating(value) {
  const rating = Number(value);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw createError(400, 'rating must be an integer between 1 and 5');
  }
  return rating;
}

async function assertProductExists(productId) {
  if (!productId) return null;
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true },
  });
  if (!product) throw createError(400, 'Invalid productId');
  return product;
}

async function listPublic(query = {}) {
  const where = { isActive: true };

  if (query.productId) {
    where.productId = query.productId;
  } else {
    where.productId = null;
  }

  return prisma.review.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    select: publicSelect,
  });
}

async function listAdmin(query = {}) {
  const where = {};

  if (query.productId === 'null' || query.productId === 'none') {
    where.productId = null;
  } else if (query.productId) {
    where.productId = query.productId;
  }

  const search = containsInsensitive(query.search);
  if (search) {
    where.OR = [{ customerName: search }, { reviewText: search }];
  }

  return prisma.review.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      product: { select: { id: true, name: true, slug: true } },
    },
  });
}

async function create(data) {
  const customerName = data.customerName?.trim();
  const reviewText = data.reviewText?.trim();
  if (!customerName) throw createError(400, 'customerName is required');
  if (!reviewText) throw createError(400, 'reviewText is required');
  if (data.rating === undefined || data.rating === null || data.rating === '') {
    throw createError(400, 'rating is required');
  }

  const rating = parseRating(data.rating);
  const productId = data.productId || null;
  await assertProductExists(productId);

  return prisma.review.create({
    data: {
      customerName,
      rating,
      reviewText,
      customerPhoto: data.customerPhoto || null,
      productId,
      isActive: data.isActive !== undefined ? Boolean(data.isActive) : true,
    },
    include: {
      product: { select: { id: true, name: true, slug: true } },
    },
  });
}

async function update(id, data) {
  const existing = await prisma.review.findUnique({ where: { id } });
  if (!existing) throw createError(404, 'Review not found');

  let productId;
  if (data.productId !== undefined) {
    productId = data.productId || null;
    await assertProductExists(productId);
  }

  return prisma.review.update({
    where: { id },
    data: {
      ...(data.customerName !== undefined
        ? { customerName: data.customerName.trim() }
        : {}),
      ...(data.rating !== undefined ? { rating: parseRating(data.rating) } : {}),
      ...(data.reviewText !== undefined
        ? { reviewText: data.reviewText.trim() }
        : {}),
      ...(data.customerPhoto !== undefined
        ? { customerPhoto: data.customerPhoto || null }
        : {}),
      ...(productId !== undefined ? { productId } : {}),
      ...(data.isActive !== undefined ? { isActive: Boolean(data.isActive) } : {}),
    },
    include: {
      product: { select: { id: true, name: true, slug: true } },
    },
  });
}

async function remove(id) {
  const existing = await prisma.review.findUnique({ where: { id } });
  if (!existing) throw createError(404, 'Review not found');
  await prisma.review.delete({ where: { id } });
  return { message: 'Review deleted' };
}

module.exports = {
  listPublic,
  listAdmin,
  create,
  update,
  remove,
};
