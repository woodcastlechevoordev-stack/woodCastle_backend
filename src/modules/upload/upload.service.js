const cloudinary = require('cloudinary').v2;
const { createError } = require('../../middleware/errorHandler');

const ALLOWED_FOLDERS = ['products', 'categories', 'offers', 'blog'];

function getCloudinaryConfig() {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    throw createError(500, 'Cloudinary is not configured');
  }

  return { cloudName, apiKey, apiSecret };
}

function createSignature(folderInput) {
  const { cloudName, apiKey, apiSecret } = getCloudinaryConfig();

  const folder = String(folderInput || 'products').trim();
  if (!ALLOWED_FOLDERS.includes(folder)) {
    throw createError(
      400,
      `Invalid folder. Allowed values: ${ALLOWED_FOLDERS.join(', ')}`
    );
  }

  const timestamp = Math.round(Date.now() / 1000);
  const signature = cloudinary.utils.api_sign_request(
    { timestamp, folder },
    apiSecret
  );

  return {
    signature,
    timestamp,
    apiKey,
    cloudName,
    folder,
  };
}

module.exports = {
  ALLOWED_FOLDERS,
  createSignature,
};
