const prisma = require('../../config/db');
const {
  toSlug,
  parsePagination,
  paginatedResult,
  containsInsensitive,
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
      parentId: true,
      metaTitle: true,
      metaDescription: true,
    },
  },
};

async function assertLeafCategory(categoryId) {
  const category = await prisma.category.findUnique({
    where: { id: categoryId },
    include: { _count: { select: { children: true } } },
  });
  if (!category) throw createError(400, 'Invalid categoryId');
  if (!category.parentId || category._count.children > 0) {
    throw createError(
      400,
      'Products must be assigned to a subcategory (leaf level), not a top-level category'
    );
  }
  return category;
}

async function listPublic(query = {}) {
  const where = { isActive: true };
  const categorySlug = query.category || query.categorySlug;
  if (categorySlug) {
    where.category = { slug: categorySlug };
  } else if (query.categoryId) {
    where.categoryId = query.categoryId;
  }

  const nameOrDescription = containsInsensitive(query.search);
  if (nameOrDescription) {
    where.OR = [
      { name: nameOrDescription },
      { description: nameOrDescription },
    ];
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

async function listAdmin(query = {}) {
  const where = {};
  if (query.categoryId) where.categoryId = query.categoryId;

  const nameOrDescription = containsInsensitive(query.search);
  if (nameOrDescription) {
    where.OR = [
      { name: nameOrDescription },
      { description: nameOrDescription },
    ];
  }

  return prisma.product.findMany({
    where,
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

  await assertLeafCategory(data.categoryId);

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
    await assertLeafCategory(data.categoryId);
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
