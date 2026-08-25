const slugify = require('slugify');

function toSlug(text) {
  return slugify(String(text), { lower: true, strict: true, trim: true });
}

/**
 * Trailing auto-generated product code, e.g. " DC-02" or " 3SS-10".
 * Spec §5a3 uses a pattern like /\s+[A-Z]{2,4}-\d{2,}$/; digits are allowed
 * in the initials so codes from names like "3 Seater Sofa" still strip.
 * Applied repeatedly so stacked suffixes never become the base name.
 */
const PRODUCT_CODE_SUFFIX = /\s+[A-Z0-9]{2,4}-\d{2,}$/i;

function stripProductCodeSuffix(name) {
  let base = String(name ?? '').trim();
  let stripped = base.replace(PRODUCT_CODE_SUFFIX, '').trim();
  while (stripped !== base) {
    base = stripped;
    stripped = base.replace(PRODUCT_CODE_SUFFIX, '').trim();
  }
  return base;
}

/**
 * Subcategory initials for duplicate product codes (spec §5a3).
 * "Dining Chair" → "DC", "3 Seater Sofa" → "3SS".
 * Always 2–4 chars so the suffix strip pattern can reverse them.
 * Tokens that are only punctuation (e.g. "&") are skipped.
 */
function categoryInitials(name) {
  const words = String(name || '')
    .trim()
    .split(/\s+/)
    .filter((word) => /[A-Za-z0-9]/.test(word));

  let initials = words
    .map((word) => {
      const match = word.match(/[A-Za-z0-9]/);
      return match ? match[0].toUpperCase() : '';
    })
    .join('');

  if (initials.length < 2) {
    const alnum = String(name || '')
      .replace(/[^A-Za-z0-9]/g, '')
      .toUpperCase();
    initials = `${alnum}PR`.slice(0, 2);
  }

  return initials.slice(0, 4);
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
  stripProductCodeSuffix,
  asyncHandler,
  parsePagination,
  paginatedResult,
  containsInsensitive,
  parseBooleanQuery,
};
