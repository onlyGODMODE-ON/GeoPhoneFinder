/** Strips HTML tags / control characters and collapses whitespace. Source content is untrusted (PRD §29). */
export function cleanText(value, maxLen = 300) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/<[^>]*>/g, ' ')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLen);
}

/** "+" is part of a product's identity (Galaxy S25 vs S25+, Pro vs Pro+), so it becomes the word "plus". */
const plusToWord = (s) => String(s).replace(/\+/g, ' plus ');

export function slugify(s) {
  return plusToWord(s)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Lowercase alphanumeric-only comparison key. */
export const keyOf = (s) =>
  plusToWord(s ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/** JSON.stringify with sorted keys — safe for comparing JSONB values whose key order differs. */
export function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  return `{${Object.keys(value)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`)
    .join(',')}}`;
}

export const jsonParam = (v) => (v === null || v === undefined ? null : JSON.stringify(v));
