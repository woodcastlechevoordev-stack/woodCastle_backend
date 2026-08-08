const prisma = require('../../config/db');
const { sendEnquiryWhatsApp } = require('../../utils/whatsappSender');
const { createError } = require('../../middleware/errorHandler');

const ALLOWED_STATUSES = new Set(['new', 'contacted', 'closed']);

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
        isVerified: false,
      },
    });
  } else if (user.name !== name.trim() && !user.isVerified) {
    user = await prisma.user.update({
      where: { id: user.id },
      data: { name: name.trim() },
    });
  }

  let enquiry = await prisma.enquiry.create({
    data: {
      userId: user.id,
      productId: productId || null,
      name: name.trim(),
      phone: normalizedPhone,
      message: message.trim(),
    },
    include: {
      product: { select: { id: true, name: true, slug: true } },
      user: { select: { id: true, name: true, phone: true, isVerified: true } },
    },
  });

  let whatsappSent = false;
  try {
    await sendEnquiryWhatsApp({
      enquiry,
      product: enquiry.product,
      user: enquiry.user,
    });
    whatsappSent = true;
    enquiry = await prisma.enquiry.update({
      where: { id: enquiry.id },
      data: { whatsappSent: true },
      include: {
        product: { select: { id: true, name: true, slug: true } },
        user: { select: { id: true, name: true, phone: true, isVerified: true } },
      },
    });
  } catch (err) {
    // Enquiry is saved even if WhatsApp fails — log and continue
    // eslint-disable-next-line no-console
    console.error('WhatsApp send failed:', err.message);
  }

  return {
    enquiry,
    whatsappSent,
    requiresPhoneVerification: !user.isVerified,
    message: user.isVerified
      ? 'Enquiry submitted'
      : 'Enquiry submitted — verify your phone to complete registration',
  };
}

async function listAdmin(query = {}) {
  const where = {};
  if (query.status) where.status = query.status;

  return prisma.enquiry.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      product: { select: { id: true, name: true, slug: true } },
      user: {
        select: { id: true, name: true, phone: true, isVerified: true },
      },
    },
  });
}

async function updateStatus(id, status) {
  if (!ALLOWED_STATUSES.has(status)) {
    throw createError(400, 'status must be one of: new, contacted, closed');
  }

  return prisma.enquiry.update({
    where: { id },
    data: { status },
    include: {
      product: { select: { id: true, name: true, slug: true } },
      user: {
        select: { id: true, name: true, phone: true, isVerified: true },
      },
    },
  });
}

module.exports = {
  createEnquiry,
  listAdmin,
  updateStatus,
};
