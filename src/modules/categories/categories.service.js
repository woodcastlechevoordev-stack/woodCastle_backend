const prisma = require('../../config/db');
const {
  toSlug,
  parsePagination,
  paginatedResult,
} = require('../../utils/helpers');
const { createError } = require('../../middleware/errorHandler');

const productPublicSelect = {
  id: true,
  name: true,
  slug: true,
  description: true,
  price: true,
  images: true,
  metaTitle: true,
  metaDescription: true,
  createdAt: true,
};

async function listPublic() {
  return prisma.category.findMany({
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      slug: true,
      imageUrl: true,
      metaTitle: true,
      metaDescription: true,
    },
  });
}

async function productsByCategorySlug(slug, query = {}) {
  const category = await prisma.category.findUnique({
    where: { slug },
    select: {
      id: true,
      name: true,
      slug: true,
      imageUrl: true,
      metaTitle: true,
      metaDescription: true,
    },
  });

  if (!category) throw createError(404, 'Category not found');

  const where = { categoryId: category.id, isActive: true };
  const { page, limit, skip } = parsePagination(query);

  const [items, totalCount] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      select: productPublicSelect,
    }),
    prisma.product.count({ where }),
  ]);

  return {
    category,
    ...paginatedResult(items, totalCount, page, limit),
  };
}

async function listAdmin() {
  return prisma.category.findMany({
    orderBy: { name: 'asc' },
    include: { _count: { select: { products: true } } },
  });
}

async function create(data) {
  const name = data.name?.trim();
  if (!name) throw createError(400, 'Name is required');

  const slug = data.slug?.trim() || toSlug(name);

  return prisma.category.create({
    data: {
      name,
      slug,
      imageUrl: data.imageUrl || null,
      metaTitle: data.metaTitle || null,
      metaDescription: data.metaDescription || null,
    },
  });
}

async function update(id, data) {
  const existing = await prisma.category.findUnique({ where: { id } });
  if (!existing) throw createError(404, 'Category not found');

  const name = data.name !== undefined ? data.name.trim() : undefined;
  const slug =
    data.slug !== undefined
      ? data.slug.trim() || toSlug(name || existing.name)
      : undefined;

  return prisma.category.update({
    where: { id },
    data: {
      ...(name !== undefined ? { name } : {}),
      ...(slug !== undefined ? { slug } : {}),
      ...(data.imageUrl !== undefined ? { imageUrl: data.imageUrl } : {}),
      ...(data.metaTitle !== undefined ? { metaTitle: data.metaTitle } : {}),
      ...(data.metaDescription !== undefined
        ? { metaDescription: data.metaDescription }
        : {}),
    },
  });
}

async function remove(id) {
  const productCount = await prisma.product.count({ where: { categoryId: id } });
  if (productCount > 0) {
    throw createError(400, 'Cannot delete category with products');
  }

  await prisma.category.delete({ where: { id } });
  return { message: 'Category deleted' };
}

module.exports = {
  listPublic,
  productsByCategorySlug,
  listAdmin,
  create,
  update,
  remove,
};
