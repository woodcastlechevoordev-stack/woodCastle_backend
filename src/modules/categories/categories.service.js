const prisma = require('../../config/db');
const {
  toSlug,
  parsePagination,
  paginatedResult,
  containsInsensitive,
} = require('../../utils/helpers');
const { createError } = require('../../middleware/errorHandler');

const categoryPublicSelect = {
  id: true,
  name: true,
  slug: true,
  imageUrl: true,
  metaTitle: true,
  metaDescription: true,
  parentId: true,
};

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
  const categories = await prisma.category.findMany({
    where: { parentId: null },
    orderBy: { name: 'asc' },
    select: {
      ...categoryPublicSelect,
      children: {
        orderBy: { name: 'asc' },
        select: categoryPublicSelect,
      },
    },
  });

  return categories;
}

async function productsByCategorySlug(slug, query = {}) {
  const category = await prisma.category.findUnique({
    where: { slug },
    select: {
      ...categoryPublicSelect,
      children: { select: { id: true } },
    },
  });

  if (!category) throw createError(404, 'Category not found');

  // Leaf subcategory → its products; top-level → products from all children
  const categoryIds =
    category.children.length > 0
      ? category.children.map((c) => c.id)
      : [category.id];

  const where = { categoryId: { in: categoryIds }, isActive: true };
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

  const { children: _children, ...categoryPublic } = category;

  return {
    category: categoryPublic,
    ...paginatedResult(items, totalCount, page, limit),
  };
}

async function listAdmin(query = {}) {
  const where = {};
  const nameMatch = containsInsensitive(query.search);
  if (nameMatch) where.name = nameMatch;

  return prisma.category.findMany({
    where,
    orderBy: { name: 'asc' },
    include: {
      parent: { select: { id: true, name: true, slug: true } },
      children: { select: { id: true, name: true, slug: true } },
      _count: { select: { products: true } },
    },
  });
}

async function assertValidParent(parentId) {
  if (!parentId) return null;

  const parent = await prisma.category.findUnique({ where: { id: parentId } });
  if (!parent) throw createError(400, 'Invalid parentId');
  if (parent.parentId) {
    throw createError(
      400,
      'Parent must be a top-level category (nested deeper than 2 levels is not supported)'
    );
  }
  return parent;
}

async function create(data) {
  const name = data.name?.trim();
  if (!name) throw createError(400, 'Name is required');

  const slug = data.slug?.trim() || toSlug(name);
  const parentId = data.parentId || null;

  await assertValidParent(parentId);

  return prisma.category.create({
    data: {
      name,
      slug,
      imageUrl: data.imageUrl || null,
      metaTitle: data.metaTitle || null,
      metaDescription: data.metaDescription || null,
      parentId,
    },
    include: {
      parent: { select: { id: true, name: true, slug: true } },
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

  let parentId;
  if (data.parentId !== undefined) {
    parentId = data.parentId || null;
    if (parentId === id) {
      throw createError(400, 'Category cannot be its own parent');
    }
    await assertValidParent(parentId);

    // Prevent turning a parent with children into a subcategory
    if (parentId) {
      const childCount = await prisma.category.count({
        where: { parentId: id },
      });
      if (childCount > 0) {
        throw createError(
          400,
          'Cannot nest a category that already has subcategories'
        );
      }
    }
  }

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
      ...(parentId !== undefined ? { parentId } : {}),
    },
    include: {
      parent: { select: { id: true, name: true, slug: true } },
      children: { select: { id: true, name: true, slug: true } },
    },
  });
}

async function remove(id) {
  const existing = await prisma.category.findUnique({
    where: { id },
    include: {
      _count: { select: { products: true, children: true } },
    },
  });
  if (!existing) throw createError(404, 'Category not found');

  if (existing._count.children > 0) {
    throw createError(
      400,
      'Cannot delete category while it still has subcategories — reassign or remove those first'
    );
  }

  if (existing._count.products > 0) {
    throw createError(
      400,
      'Cannot delete category while it still has products — reassign or remove those first'
    );
  }

  await prisma.category.delete({ where: { id } });

  return {
    message: 'Category deleted',
    name: existing.name,
  };
}

module.exports = {
  listPublic,
  productsByCategorySlug,
  listAdmin,
  create,
  update,
  remove,
};
