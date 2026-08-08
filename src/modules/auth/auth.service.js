const jwt = require('jsonwebtoken');
const prisma = require('../../config/db');
const {
  generateOtp,
  hashOtp,
  otpExpiresAt,
  sendOtp,
  verifyTwilioOtp,
} = require('../../utils/otp');
const { createError } = require('../../middleware/errorHandler');

function signUserToken(user) {
  return jwt.sign(
    { type: 'user', phone: user.phone },
    process.env.JWT_SECRET,
    {
      subject: user.id,
      expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    }
  );
}

async function sendOtpForPhone(phone) {
  if (!phone || String(phone).trim().length < 8) {
    throw createError(400, 'Valid phone number is required');
  }

  const normalized = String(phone).trim();
  const provider = process.env.OTP_PROVIDER || 'dev';

  if (provider === 'twilio') {
    await sendOtp(normalized, null);
    return { message: 'OTP sent', provider: 'twilio' };
  }

  const otp = generateOtp();
  const otpHash = hashOtp(otp);

  await prisma.otpRequest.create({
    data: {
      phone: normalized,
      otpHash,
      expiresAt: otpExpiresAt(),
    },
  });

  await sendOtp(normalized, otp);

  return {
    message: 'OTP sent',
    provider: 'dev',
    // Only exposed in non-production for easier frontend testing
    ...(process.env.NODE_ENV !== 'production' ? { debugOtp: otp } : {}),
  };
}

async function verifyOtpForPhone(phone, otp) {
  if (!phone || !otp) {
    throw createError(400, 'Phone and OTP are required');
  }

  const normalized = String(phone).trim();
  const provider = process.env.OTP_PROVIDER || 'dev';

  let valid = false;

  if (provider === 'twilio') {
    valid = await verifyTwilioOtp(normalized, String(otp));
  } else {
    const request = await prisma.otpRequest.findFirst({
      where: {
        phone: normalized,
        verified: false,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!request) {
      throw createError(400, 'OTP expired or not found');
    }

    valid = request.otpHash === hashOtp(String(otp));

    if (valid) {
      await prisma.otpRequest.update({
        where: { id: request.id },
        data: { verified: true },
      });
    }
  }

  if (!valid) {
    throw createError(400, 'Invalid OTP');
  }

  let user = await prisma.user.findUnique({ where: { phone: normalized } });

  if (!user) {
    user = await prisma.user.create({
      data: {
        name: normalized,
        phone: normalized,
        isVerified: true,
      },
    });
  } else if (!user.isVerified) {
    user = await prisma.user.update({
      where: { id: user.id },
      data: { isVerified: true },
    });
  }

  const token = signUserToken(user);

  return {
    token,
    user: {
      id: user.id,
      name: user.name,
      phone: user.phone,
      email: user.email,
      isVerified: user.isVerified,
    },
  };
}

module.exports = {
  sendOtpForPhone,
  verifyOtpForPhone,
  signUserToken,
};
