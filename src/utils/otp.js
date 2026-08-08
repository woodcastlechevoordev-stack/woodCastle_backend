const crypto = require('crypto');

const OTP_TTL_MS = 5 * 60 * 1000;

function generateOtp(length = 6) {
  const max = 10 ** length;
  const num = crypto.randomInt(0, max);
  return String(num).padStart(length, '0');
}

function hashOtp(otp) {
  return crypto.createHash('sha256').update(String(otp)).digest('hex');
}

function otpExpiresAt(from = new Date()) {
  return new Date(from.getTime() + OTP_TTL_MS);
}

/**
 * Send OTP via configured provider.
 * "dev" logs the code to the console (local development).
 * "twilio" uses Twilio Verify when credentials are present.
 */
async function sendOtp(phone, otp) {
  const provider = process.env.OTP_PROVIDER || 'dev';

  if (provider === 'twilio') {
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    const serviceSid = process.env.TWILIO_VERIFY_SERVICE_SID;

    if (!sid || !token || !serviceSid) {
      throw Object.assign(new Error('Twilio Verify is not configured'), { status: 500 });
    }

    const auth = Buffer.from(`${sid}:${token}`).toString('base64');
    const body = new URLSearchParams({ To: phone, Channel: 'sms' });

    const res = await fetch(
      `https://verify.twilio.com/v2/Services/${serviceSid}/Verifications`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body,
      }
    );

    if (!res.ok) {
      const text = await res.text();
      throw Object.assign(new Error(`Twilio send failed: ${text}`), { status: 502 });
    }

    return { provider: 'twilio', external: true };
  }

  // Default: development stub — OTP is logged, never sent over SMS
  // eslint-disable-next-line no-console
  console.log(`[OTP:dev] phone=${phone} code=${otp}`);
  return { provider: 'dev', external: false };
}

/**
 * For Twilio Verify, verification is done via their Check API (otp not stored locally).
 */
async function verifyTwilioOtp(phone, otp) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const serviceSid = process.env.TWILIO_VERIFY_SERVICE_SID;
  const auth = Buffer.from(`${sid}:${token}`).toString('base64');
  const body = new URLSearchParams({ To: phone, Code: otp });

  const res = await fetch(
    `https://verify.twilio.com/v2/Services/${serviceSid}/VerificationCheck`,
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    }
  );

  if (!res.ok) {
    return false;
  }

  const data = await res.json();
  return data.status === 'approved';
}

module.exports = {
  generateOtp,
  hashOtp,
  otpExpiresAt,
  sendOtp,
  verifyTwilioOtp,
  OTP_TTL_MS,
};
