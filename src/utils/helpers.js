const slugify = require('slugify');

function toSlug(text) {
  return slugify(String(text), { lower: true, strict: true, trim: true });
}

/**
 * Subcategory initials for duplicate product codes (spec §5a3).
 * "Dining Chair" → "DC", "3 Seater Sofa" → "3SS".
 * Tokens that are only punctuation (e.g. "&") are skipped.
 */
function categoryInitials(name) {
  const initials = String(name || '')
    .trim()
    .split(/\s+/)
    .filter((word) => /[A-Za-z0-9]/.test(word))
    .map((word) => {
      const match = word.match(/[A-Za-z0-9]/);
      return match ? match[0].toUpperCase() : '';
    })
    .join('');
  return initials || 'P';
}

function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

/**
 * Parse ?page=&limit= for list endpoints.
 * Defaults: page=1, limit=12. Caps limit at 100.
 */
function parsePagination(query = {}) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 12));
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}

function paginatedResult(items, totalCount, page, limit) {
  const totalPages = Math.max(1, Math.ceil(totalCount / limit) || 1);
  return { items, page, totalPages, totalCount };
}

function containsInsensitive(value) {
  const term = String(value ?? '').trim();
  if (!term) return null;
  return { contains: term, mode: 'insensitive' };
}

function parseBooleanQuery(value) {
  if (value === undefined || value === null || value === '') return undefined;
  const normalized = String(value).toLowerCase();
  if (normalized === 'true' || normalized === '1') return true;
  if (normalized === 'false' || normalized === '0') return false;
  return undefined;
}

module.exports = {
  toSlug,
  categoryInitials,
  asyncHandler,
  parsePagination,
  paginatedResult,
  containsInsensitive,
  parseBooleanQuery,
};
