import { cleanText } from '../domain/text.js';

/**
 * Validation of a RawListing produced by a store adapter (PRD §24, §29).
 * Source content is untrusted: anything malformed is rejected/quarantined instead of being
 * allowed to corrupt normalized data.
 *
 * RawListing contract (what every adapter must return):
 *   sourceProductId  string   retailer product id (kept for traceability)
 *   url              string   http(s) product URL
 *   title            string   retailer product title
 *   price            number   GEL, > 0
 *   available        boolean
 *   brand?, model?   string   optional pre-parsed values (otherwise parsed from `title`)
 *   ram?, storage?   number   GB
 *   imageUrl?        string   http(s) photo of THIS listing (the store's own image)
 *   color?           string   colour as named by the store
 *   specs?           object   { chipsetName, display, battery, cameras, video, connectivity,
 *                              audio, body, software, benchmarks }  (all optional)
 *   fetchedAt?       ISO date when the retailer data was observed
 */
const SPEC_GROUPS = ['display', 'battery', 'cameras', 'video', 'connectivity', 'audio', 'body', 'software', 'benchmarks'];
const MAX_SPECS_BYTES = 20_000;

const isHttpUrl = (s) => {
  try {
    const u = new URL(s);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
};

/** Recursively sanitises strings in a spec object and drops non-JSON values. */
function sanitizeSpec(value, depth = 0) {
  if (depth > 6) return null;
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') return cleanText(value, 120);
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value.slice(0, 20).map((v) => sanitizeSpec(v, depth + 1));
  if (typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (!/^[A-Za-z][A-Za-z0-9_]{0,40}$/.test(k)) continue;
      out[k] = sanitizeSpec(v, depth + 1);
    }
    return out;
  }
  return null;
}

/**
 * @returns {{ ok: true, value: object } | { ok: false, errors: string[] }}
 */
export function validateListing(raw, { now = new Date() } = {}) {
  const errors = [];
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ok: false, errors: ['record is not an object'] };

  const sourceProductId = cleanText(raw.sourceProductId, 200);
  if (!sourceProductId) errors.push('sourceProductId is required');

  const url = typeof raw.url === 'string' ? raw.url.trim() : '';
  if (!isHttpUrl(url)) errors.push('url must be a valid http(s) URL');

  const title = cleanText(raw.title, 300);
  if (!title) errors.push('title is required');

  const price = typeof raw.price === 'string' && raw.price.trim() !== '' ? Number(raw.price) : raw.price;
  if (typeof price !== 'number' || !Number.isFinite(price) || price <= 0 || price >= 100_000) {
    errors.push('price must be a number > 0 and < 100000');
  }
  const currency = raw.currency === undefined ? 'GEL' : String(raw.currency).toUpperCase();
  if (currency !== 'GEL') errors.push(`unsupported currency "${raw.currency}" (GEL only)`);

  if (typeof raw.available !== 'boolean') errors.push('available must be a boolean');

  const intField = (name, min, max) => {
    if (raw[name] === undefined || raw[name] === null) return null;
    const n = Number(raw[name]);
    if (!Number.isInteger(n) || n < min || n > max) {
      errors.push(`${name} must be an integer between ${min} and ${max}`);
      return null;
    }
    return n;
  };
  const ram = intField('ram', 1, 64);
  const storage = intField('storage', 8, 8192);

  let imageUrl = null;
  if (raw.imageUrl) {
    if (isHttpUrl(String(raw.imageUrl))) imageUrl = String(raw.imageUrl);
    else errors.push('imageUrl must be a valid http(s) URL');
  }

  const color = raw.color ? cleanText(raw.color, 40) || null : null;

  let fetchedAt = now;
  if (raw.fetchedAt !== undefined && raw.fetchedAt !== null) {
    const d = new Date(raw.fetchedAt);
    if (Number.isNaN(d.getTime())) errors.push('fetchedAt is not a valid date');
    else if (d.getTime() > now.getTime() + 24 * 3_600_000) errors.push('fetchedAt is in the future');
    else fetchedAt = d;
  }

  let specs = {};
  if (raw.specs !== undefined && raw.specs !== null) {
    if (typeof raw.specs !== 'object' || Array.isArray(raw.specs)) errors.push('specs must be an object');
    else if (JSON.stringify(raw.specs).length > MAX_SPECS_BYTES) errors.push('specs payload too large');
    else {
      specs = {};
      for (const g of SPEC_GROUPS) if (raw.specs[g] != null) specs[g] = sanitizeSpec(raw.specs[g]);
      if (raw.specs.chipsetName) specs.chipsetName = cleanText(raw.specs.chipsetName, 80);
      if (typeof raw.specs.fiveG === 'boolean') specs.fiveG = raw.specs.fiveG;
    }
  }

  if (errors.length) return { ok: false, errors };
  return {
    ok: true,
    value: {
      sourceProductId,
      url,
      title,
      brand: raw.brand ? cleanText(raw.brand, 60) : null,
      model: raw.model ? cleanText(raw.model, 120) : null,
      price: Math.round(price * 100) / 100,
      available: raw.available,
      ram,
      storage,
      imageUrl,
      color,
      specs,
      fetchedAt,
    },
  };
}
