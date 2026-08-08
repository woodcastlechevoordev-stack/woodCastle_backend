const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../../config/db');
const {
  generateTotpSecret,
  buildOtpAuthUrl,
  generateQrDataUrl,
  verifyTotpCode,
} = require('../../utils/totp');
const { createError } = require('../../middleware/errorHandler');

function signAdminToken(admin) {
  return jwt.sign(
    { type: 'admin', username: admin.username, role: admin.role },
    process.env.JWT_SECRET,
    {
      subject: admin.id,
      expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    }
  );
}

function signTempToken(admin) {
  return jwt.sign(
    { type: 'admin_temp', username: admin.username },
    process.env.JWT_SECRET,
    {
      subject: admin.id,
      expiresIn: process.env.ADMIN_TEMP_TOKEN_EXPIRES_IN || '5m',
    }
  );
}

async function login(username, password) {
  if (!username || !password) {
    throw createError(400, 'Username and password are required');
  }

  const admin = await prisma.adminUser.findUnique({
    where: { username: String(username).trim() },
  });

  if (!admin) {
    throw createError(401, 'Invalid credentials');
  }

  const ok = await bcrypt.compare(password, admin.passwordHash);
  if (!ok) {
    throw createError(401, 'Invalid credentials');
  }

  if (admin.totpEnabled) {
    return {
      requiresTotp: true,
      tempToken: signTempToken(admin),
    };
  }

  return {
    requiresTotp: false,
    token: signAdminToken(admin),
    admin: {
      id: admin.id,
      username: admin.username,
      email: admin.email,
      totpEnabled: admin.totpEnabled,
      role: admin.role,
    },
  };
}

async function verifyLoginTotp(tempToken, code) {
  if (!tempToken || !code) {
    throw createError(400, 'tempToken and code are required');
  }

  let payload;
  try {
    payload = jwt.verify(tempToken, process.env.JWT_SECRET);
  } catch {
    throw createError(401, 'Invalid or expired temp token');
  }

  if (payload.type !== 'admin_temp') {
    throw createError(401, 'Invalid temp token');
  }

  const admin = await prisma.adminUser.findUnique({ where: { id: payload.sub } });
  if (!admin || !admin.totpEnabled || !admin.totpSecret) {
    throw createError(400, '2FA is not enabled for this admin');
  }

  if (!verifyTotpCode(admin.totpSecret, code)) {
    throw createError(401, 'Invalid authenticator code');
  }

  return {
    token: signAdminToken(admin),
    admin: {
      id: admin.id,
      username: admin.username,
      email: admin.email,
      totpEnabled: admin.totpEnabled,
      role: admin.role,
    },
  };
}

async function setup2fa(adminId) {
  const admin = await prisma.adminUser.findUnique({ where: { id: adminId } });
  if (!admin) throw createError(404, 'Admin not found');

  const secret = generateTotpSecret();
  await prisma.adminUser.update({
    where: { id: adminId },
    data: { totpSecret: secret, totpEnabled: false },
  });

  const otpauthUrl = buildOtpAuthUrl(secret, admin.username);
  const qrCodeDataUrl = await generateQrDataUrl(otpauthUrl);

  return { secret, otpauthUrl, qrCodeDataUrl };
}

async function enable2fa(adminId, code) {
  const admin = await prisma.adminUser.findUnique({ where: { id: adminId } });
  if (!admin?.totpSecret) {
    throw createError(400, 'Run 2FA setup first');
  }

  if (!verifyTotpCode(admin.totpSecret, code)) {
    throw createError(400, 'Invalid authenticator code');
  }

  const updated = await prisma.adminUser.update({
    where: { id: adminId },
    data: { totpEnabled: true },
  });

  return {
    totpEnabled: updated.totpEnabled,
    message: '2FA enabled',
  };
}

async function disable2fa(adminId, password) {
  if (!password) throw createError(400, 'Password is required');

  const admin = await prisma.adminUser.findUnique({ where: { id: adminId } });
  if (!admin) throw createError(404, 'Admin not found');

  const ok = await bcrypt.compare(password, admin.passwordHash);
  if (!ok) throw createError(401, 'Invalid password');

  await prisma.adminUser.update({
    where: { id: adminId },
    data: { totpEnabled: false, totpSecret: null },
  });

  return { totpEnabled: false, message: '2FA disabled' };
}

module.exports = {
  login,
  verifyLoginTotp,
  setup2fa,
  enable2fa,
  disable2fa,
  signAdminToken,
};
