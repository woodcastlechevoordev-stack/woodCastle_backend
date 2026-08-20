const sanitizeHtml = require('sanitize-html');

/**
 * Sanitize rich-text HTML from Tiptap before sending to the public site.
 * Allows formatting tags the editor produces; strips everything else.
 * Spec §5a2 — sanitize on the way out.
 */
const ALLOWED_TAGS = [
  'p',
  'br',
  'b',
  'strong',
  'i',
  'em',
  'u',
  's',
  'span',
  'ul',
  'ol',
  'li',
  'table',
  'thead',
  'tbody',
  'tr',
  'th',
  'td',
  'h1',
  'h2',
  'h3',
  'h4',
];

const SANITIZE_OPTIONS = {
  allowedTags: ALLOWED_TAGS,
  allowedAttributes: {
    span: ['style'],
    th: ['colspan', 'rowspan'],
    td: ['colspan', 'rowspan'],
  },
  allowedStyles: {
    span: {
      // Tiptap text color / highlight
      color: [/^#(0x)?[0-9a-f]+$/i, /^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/],
      'background-color': [
        /^#(0x)?[0-9a-f]+$/i,
        /^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/,
      ],
    },
  },
  // Drop any unexpected attrs/tags rather than escaping into visible text
  disallowedTagsMode: 'discard',
};

function sanitizeRichText(html) {
  if (html === null || html === undefined) return html;
  if (typeof html !== 'string') return html;
  return sanitizeHtml(html, SANITIZE_OPTIONS);
}

module.exports = { sanitizeRichText };
