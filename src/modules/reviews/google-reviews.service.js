const { createError } = require('../../middleware/errorHandler');

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const PLACE_DETAILS_URL = 'https://maps.googleapis.com/maps/api/place/details/json';

let cache = {
  data: null,
  expiresAt: 0,
};

function getConfig() {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  const placeId = process.env.GOOGLE_PLACE_ID;

  if (!apiKey || !placeId) {
    throw createError(
      503,
      'Google Places is not configured. Set GOOGLE_PLACES_API_KEY and GOOGLE_PLACE_ID.'
    );
  }

  return { apiKey, placeId };
}

function mapReview(review) {
  return {
    authorName: review.author_name || '',
    rating: review.rating ?? null,
    text: review.text || '',
    relativeTimeDescription: review.relative_time_description || '',
    profilePhotoUrl: review.profile_photo_url || null,
  };
}

async function fetchFromGoogle() {
  const { apiKey, placeId } = getConfig();

  const url = new URL(PLACE_DETAILS_URL);
  url.searchParams.set('place_id', placeId);
  url.searchParams.set('fields', 'rating,user_ratings_total,reviews,url');
  url.searchParams.set('key', apiKey);

  let response;
  try {
    response = await fetch(url);
  } catch {
    throw createError(502, 'Failed to reach Google Places API');
  }

  if (!response.ok) {
    throw createError(502, 'Google Places API request failed');
  }

  const payload = await response.json();
  if (payload.status && payload.status !== 'OK') {
    throw createError(
      502,
      payload.error_message || `Google Places API error: ${payload.status}`
    );
  }

  const result = payload.result || {};
  const reviews = Array.isArray(result.reviews) ? result.reviews.slice(0, 5) : [];

  return {
    rating: result.rating ?? null,
    totalReviews: result.user_ratings_total ?? 0,
    mapsUrl:
      result.url || `https://www.google.com/maps/place/?q=place_id:${placeId}`,
    reviews: reviews.map(mapReview),
  };
}

async function getGoogleReviews() {
  const now = Date.now();
  if (cache.data && now < cache.expiresAt) {
    return cache.data;
  }

  try {
    const data = await fetchFromGoogle();
    cache = { data, expiresAt: now + CACHE_TTL_MS };
    return data;
  } catch (err) {
    if (cache.data) return cache.data;
    throw err;
  }
}

module.exports = { getGoogleReviews };
