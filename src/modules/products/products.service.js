const prisma = require('../../config/db');
const {
  toSlug,
  parsePagination,
  paginatedResult,
} = require('../../utils/helpers');
const { createError } = require('../../middleware/errorHandler');

const publicSelect = {
  id: true,
  name: true,
  slug: true,
  description: true,
  price: true,
  images: true,
  categoryId: true,
  metaTitle: true,
  metaDescription: true,
  createdAt: true,
  category: {
    select: {
      id: true,
      name: true,
      slug: true,
      metaTitle: true,
      metaDescription: true,
    },
  },
};

async function listPublic(query = {}) {
  const where = { isActive: true };
  if (query.categoryId) where.categoryId = query.categoryId;
  if (query.categorySlug) {
    where.category = { slug: query.categorySlug };
  }

  const { page, limit, skip } = parsePagination(query);

  const [items, totalCount] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      select: publicSelect,
    }),
    prisma.product.count({ where }),
  ]);

  return paginatedResult(items, totalCount, page, limit);
}

async function getBySlug(slug) {
  const product = await prisma.product.findFirst({
    where: { slug, isActive: true },
    select: publicSelect,
  });

  if (!product) throw createError(404, 'Product not found');
  return product;
}

async function listAdmin() {
  return prisma.product.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      category: { select: { id: true, name: true, slug: true } },
    },
  });
}

async function create(data) {
  const name = data.name?.trim();
  if (!name) throw createError(400, 'Name is required');
  if (!data.categoryId) throw createError(400, 'categoryId is required');
  if (!data.description) throw createError(400, 'description is required');

  const category = await prisma.category.findUnique({
    where: { id: data.categoryId },
  });
  if (!category) throw createError(400, 'Invalid categoryId');

  const slug = data.slug?.trim() || toSlug(name);

  return prisma.product.create({
    data: {
      name,
      slug,
      description: data.description,
      price: data.price ?? null,
      images: Array.isArray(data.images) ? data.images : [],
      categoryId: data.categoryId,
      isActive: data.isActive !== undefined ? Boolean(data.isActive) : true,
      metaTitle: data.metaTitle || null,
      metaDescription: data.metaDescription || null,
    },
    include: {
      category: { select: { id: true, name: true, slug: true } },
    },
  });
}

async function update(id, data) {
  const existing = await prisma.product.findUnique({ where: { id } });
  if (!existing) throw createError(404, 'Product not found');

  if (data.categoryId) {
    const category = await prisma.category.findUnique({
      where: { id: data.categoryId },
    });
    if (!category) throw createError(400, 'Invalid categoryId');
  }

  const name = data.name !== undefined ? data.name.trim() : undefined;
  const slug =
    data.slug !== undefined
      ? data.slug.trim() || toSlug(name || existing.name)
      : undefined;

  return prisma.product.update({
    where: { id },
    data: {
      ...(name !== undefined ? { name } : {}),
      ...(slug !== undefined ? { slug } : {}),
      ...(data.description !== undefined ? { description: data.description } : {}),
      ...(data.price !== undefined ? { price: data.price } : {}),
      ...(data.images !== undefined
        ? { images: Array.isArray(data.images) ? data.images : [] }
        : {}),
      ...(data.categoryId !== undefined ? { categoryId: data.categoryId } : {}),
      ...(data.isActive !== undefined ? { isActive: Boolean(data.isActive) } : {}),
      ...(data.metaTitle !== undefined ? { metaTitle: data.metaTitle } : {}),
      ...(data.metaDescription !== undefined
        ? { metaDescription: data.metaDescription }
        : {}),
    },
    include: {
      category: { select: { id: true, name: true, slug: true } },
    },
  });
}

async function remove(id) {
  await prisma.product.delete({ where: { id } });
  return { message: 'Product deleted' };
}

module.exports = {
  listPublic,
  getBySlug,
  listAdmin,
  create,
  update,
  remove,
};
