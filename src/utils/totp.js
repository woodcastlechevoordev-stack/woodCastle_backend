const { authenticator } = require('otplib');
const QRCode = require('qrcode');

authenticator.options = { window: 1 };

function generateTotpSecret() {
  return authenticator.generateSecret();
}

function buildOtpAuthUrl(secret, username, issuer = 'Woodcastle Admin') {
  return authenticator.keyuri(username, issuer, secret);
}

async function generateQrDataUrl(otpauthUrl) {
  return QRCode.toDataURL(otpauthUrl);
}

function verifyTotpCode(secret, code) {
  if (!secret || !code) return false;
  return authenticator.verify({ token: String(code), secret });
}

module.exports = {
  generateTotpSecret,
  buildOtpAuthUrl,
  generateQrDataUrl,
  verifyTotpCode,
};
