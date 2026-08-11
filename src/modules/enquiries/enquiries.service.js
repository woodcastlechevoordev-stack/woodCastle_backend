const prisma = require('../../config/db');
const { buildEnquiryWhatsAppLink } = require('../../utils/whatsappLink');
const { createError } = require('../../middleware/errorHandler');

const ALLOWED_STATUSES = new Set(['new', 'contacted', 'closed']);

const enquiryInclude = {
  product: { select: { id: true, name: true, slug: true } },
  user: { select: { id: true, name: true, phone: true } },
};

async function createEnquiry({ name, phone, message, productId }) {
  if (!name?.trim() || !phone?.trim() || !message?.trim()) {
    throw createError(400, 'name, phone, and message are required');
  }

  const normalizedPhone = String(phone).trim();
  let product = null;

  if (productId) {
    product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) throw createError(400, 'Invalid productId');
  }

  let user = await prisma.user.findUnique({ where: { phone: normalizedPhone } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        name: name.trim(),
        phone: normalizedPhone,
      },
    });
  } else if (user.name !== name.trim()) {
    user = await prisma.user.update({
      where: { id: user.id },
      data: { name: name.trim() },
    });
  }

  const enquiry = await prisma.enquiry.create({
    data: {
      userId: user.id,
      productId: productId || null,
      name: name.trim(),
      phone: normalizedPhone,
      message: message.trim(),
    },
    include: enquiryInclude,
  });

  const whatsappLink = buildEnquiryWhatsAppLink({
    enquiry,
    product: enquiry.product,
  });

  return { enquiry, whatsappLink };
}

async function listAdmin(query = {}) {
  const where = {};
  if (query.status) where.status = query.status;

  return prisma.enquiry.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: enquiryInclude,
  });
}

async function updateStatus(id, status) {
  if (!ALLOWED_STATUSES.has(status)) {
    throw createError(400, 'status must be one of: new, contacted, closed');
  }

  return prisma.enquiry.update({
    where: { id },
    data: { status },
    include: enquiryInclude,
  });
}

module.exports = {
  createEnquiry,
  listAdmin,
  updateStatus,
};
