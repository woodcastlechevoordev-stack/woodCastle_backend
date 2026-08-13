/**
 * Builds a free wa.me click-to-chat URL for an enquiry.
 * The customer opens this link and taps send themselves — no Business API needed.
 */
function buildEnquiryWhatsAppLink({ enquiry, product }) {
  const adminNumber = String(process.env.WHATSAPP_ADMIN_NUMBER || '').replace(/\D/g, '');

  if (!adminNumber) {
    return null;
  }

  const productLabel = product?.name || 'General enquiry';
  const text = [
    'Hi Woodcastle, I have an enquiry:',
    `Name: ${enquiry.name}`,
    `Phone: ${enquiry.phone}`,
    `Product: ${productLabel}`,
    `Message: ${enquiry.message}`,
  ].join('\n');

  return `https://wa.me/${adminNumber}?text=${encodeURIComponent(text)}`;
}

module.exports = { buildEnquiryWhatsAppLink };
