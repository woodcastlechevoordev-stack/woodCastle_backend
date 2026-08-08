const prisma = require('../../config/db');
const { createError } = require('../../middleware/errorHandler');

async function getByKey(key) {
  const page = await prisma.staticPage.findUnique({ where: { key } });
  if (!page) throw createError(404, 'Page not found');
  return page;
}

async function upsert(key, data) {
  if (!data.title || !data.content) {
    throw createError(400, 'title and content are required');
  }

  return prisma.staticPage.upsert({
    where: { key },
    create: {
      key,
      title: data.title,
      content: data.content,
    },
    update: {
      title: data.title,
      content: data.content,
    },
  });
}

async function listAdmin() {
  return prisma.staticPage.findMany({ orderBy: { key: 'asc' } });
}

module.exports = { getByKey, upsert, listAdmin };
