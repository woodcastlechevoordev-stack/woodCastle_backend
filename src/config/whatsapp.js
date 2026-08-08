function getWhatsAppConfig() {
  return {
    provider: process.env.WHATSAPP_PROVIDER || 'stub',
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
    accessToken: process.env.WHATSAPP_ACCESS_TOKEN,
    adminNumber: process.env.WHATSAPP_ADMIN_NUMBER,
  };
}

module.exports = { getWhatsAppConfig };
