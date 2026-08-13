const prisma = require('../../config/db');
const {
  toSlug,
  parsePagination,
  paginatedResult,
  containsInsensitive,
  parseBooleanQuery,
} = require('../../utils/helpers');
const { createError } = require('../../middleware/errorHandler');

const publicSelect = {
  id: true,
  title: true,
  slug: true,
  content: true,
  coverImage: true,
  metaTitle: true,
  metaDescription: true,
  publishedAt: true,
  createdAt: true,
};

async function listPublic(query = {}) {
  const where = { published: true };
  const { page, limit, skip } = parsePagination(query);

  const [items, totalCount] = await Promise.all([
    prisma.blogPost.findMany({
      where,
      orderBy: { publishedAt: 'desc' },
      skip,
      take: limit,
      select: publicSelect,
    }),
    prisma.blogPost.count({ where }),
  ]);

  return paginatedResult(items, totalCount, page, limit);
}

async function getBySlug(slug) {
  const post = await prisma.blogPost.findFirst({
    where: { slug, published: true },
    select: publicSelect,
  });
  if (!post) throw createError(404, 'Blog post not found');
  return post;
}

async function listAdmin(query = {}) {
  const where = {};
  const titleMatch = containsInsensitive(query.search);
  if (titleMatch) where.title = titleMatch;

  const published = parseBooleanQuery(query.published);
  if (published !== undefined) where.published = published;

  return prisma.blogPost.findMany({
    where,
    orderBy: { createdAt: 'desc' },
  });
}

async function create(data) {
  const title = data.title?.trim();
  if (!title) throw createError(400, 'title is required');
  if (!data.content) throw createError(400, 'content is required');

  const slug = data.slug?.trim() || toSlug(title);
  const published = Boolean(data.published);

  return prisma.blogPost.create({
    data: {
      title,
      slug,
      content: data.content,
      coverImage: data.coverImage || null,
      metaTitle: data.metaTitle || null,
      metaDescription: data.metaDescription || null,
      published,
      publishedAt: published ? data.publishedAt || new Date() : null,
    },
  });
}

async function update(id, data) {
  const existing = await prisma.blogPost.findUnique({ where: { id } });
  if (!existing) throw createError(404, 'Blog post not found');

  const title = data.title !== undefined ? data.title.trim() : undefined;
  const slug =
    data.slug !== undefined
      ? data.slug.trim() || toSlug(title || existing.title)
      : undefined;

  let publishedAt = existing.publishedAt;
  if (data.published === true && !existing.published) {
    publishedAt = data.publishedAt || new Date();
  } else if (data.published === false) {
    publishedAt = null;
  } else if (data.publishedAt !== undefined) {
    publishedAt = data.publishedAt;
  }

  return prisma.blogPost.update({
    where: { id },
    data: {
      ...(title !== undefined ? { title } : {}),
      ...(slug !== undefined ? { slug } : {}),
      ...(data.content !== undefined ? { content: data.content } : {}),
      ...(data.coverImage !== undefined ? { coverImage: data.coverImage } : {}),
      ...(data.metaTitle !== undefined ? { metaTitle: data.metaTitle } : {}),
      ...(data.metaDescription !== undefined
        ? { metaDescription: data.metaDescription }
        : {}),
      ...(data.published !== undefined ? { published: Boolean(data.published) } : {}),
      publishedAt,
    },
  });
}

async function remove(id) {
  await prisma.blogPost.delete({ where: { id } });
  return { message: 'Blog post deleted' };
}

module.exports = {
  listPublic,
  getBySlug,
  listAdmin,
  create,
  update,
  remove,
};
