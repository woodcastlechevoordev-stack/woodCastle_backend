const { getWhatsAppConfig } = require('../config/whatsapp');

/**
 * Sends enquiry notification to the business WhatsApp number.
 * Providers: "meta" (Cloud API), "twilio", or "stub" (logs only).
 */
async function sendEnquiryWhatsApp({ enquiry, product, user }) {
  const config = getWhatsAppConfig();
  const productLabel = product?.name || 'General enquiry';
  const text = [
    'New Woodcastle enquiry',
    `Name: ${enquiry.name}`,
    `Phone: ${enquiry.phone}`,
    `Product: ${productLabel}`,
    `Message: ${enquiry.message}`,
    `Enquiry ID: ${enquiry.id}`,
  ].join('\n');

  if (config.provider === 'meta') {
    return sendViaMeta(config, text);
  }

  if (config.provider === 'twilio') {
    return sendViaTwilioWhatsApp(config, text);
  }

  // eslint-disable-next-line no-console
  console.log(`[WhatsApp:stub]\n${text}`);
  return { ok: true, provider: 'stub' };
}

async function sendViaMeta(config, text) {
  if (!config.phoneNumberId || !config.accessToken || !config.adminNumber) {
    throw Object.assign(new Error('Meta WhatsApp is not configured'), { status: 500 });
  }

  const url = `https://graph.facebook.com/v19.0/${config.phoneNumberId}/messages`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: config.adminNumber.replace(/\D/g, ''),
      type: 'text',
      text: { body: text },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw Object.assign(new Error(`Meta WhatsApp send failed: ${body}`), { status: 502 });
  }

  return { ok: true, provider: 'meta' };
}

async function sendViaTwilioWhatsApp(config, text) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_WHATSAPP_FROM; // e.g. whatsapp:+14155238886

  if (!sid || !token || !from || !config.adminNumber) {
    throw Object.assign(new Error('Twilio WhatsApp is not configured'), { status: 500 });
  }

  const auth = Buffer.from(`${sid}:${token}`).toString('base64');
  const to = config.adminNumber.startsWith('whatsapp:')
    ? config.adminNumber
    : `whatsapp:${config.adminNumber}`;

  const body = new URLSearchParams({
    From: from,
    To: to,
    Body: text,
  });

  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
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
    const errText = await res.text();
    throw Object.assign(new Error(`Twilio WhatsApp send failed: ${errText}`), { status: 502 });
  }

  return { ok: true, provider: 'twilio' };
}

module.exports = { sendEnquiryWhatsApp };
