import { createHash } from 'node:crypto';
import { keyOf, slugify } from './text.js';

/**
 * PRODUCT IDENTITY & VARIANT RESOLUTION (PRD §12).
 *
 * Two listings are the same PhoneVariant only if ALL of these match:
 *   brand, model, RAM, storage, chipset, 5G/4G.
 * Unknown values are part of the key ("na") so a listing with missing data is never silently
 * merged with a fully specified one. Same brand + model alone is NOT enough.
 */
const NAMESPACE = '6f9a1c52-3b7d-4d8e-9c1a-5e2f0a7b4c11';

/** Deterministic UUID v5 so ids are stable across re-imports and environments. */
export function uuidV5(name, namespace = NAMESPACE) {
  const ns = Buffer.from(namespace.replace(/-/g, ''), 'hex');
  const hash = createHash('sha1').update(ns).update(name, 'utf8').digest();
  const b = Buffer.from(hash.subarray(0, 16));
  b[6] = (b[6] & 0x0f) | 0x50;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = b.toString('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

const na = (v) => (v === null || v === undefined ? 'na' : String(v));
const network = (fiveG) => (fiveG === true ? '5g' : fiveG === false ? '4g' : 'na');

export function formatStorage(gb) {
  return gb >= 1024 && gb % 1024 === 0 ? `${gb / 1024}tb` : `${gb}gb`;
}

/** The fields that make two phones "materially different". */
export function identityKey({ brand, model, ram, storage, chipsetId, fiveG }) {
  return ['v1', keyOf(brand), keyOf(model), na(ram), na(storage), na(chipsetId), network(fiveG)].join('|');
}

export function buildIdentity(fields) {
  const key = identityKey(fields);
  const parts = [fields.brand, fields.model];
  if (fields.ram) parts.push(`${fields.ram}gb`);
  if (fields.storage) parts.push(formatStorage(fields.storage));
  return { key, id: uuidV5(key), baseSlug: slugify(parts.join(' ')) };
}

/**
 * Fields that must NOT differ for an incoming listing to be merged into an existing variant.
 * (They are all part of the identity key already; this list documents/enforces the rule and is
 * used to detect *non-identity* spec conflicts that are logged for review.)
 */
export const CONFLICT_CHECKS = [
  { path: 'battery.capacityMah', tolerance: 0.05 },
  { path: 'display.sizeInch', tolerance: 0.03 },
];

const get = (o, p) => p.split('.').reduce((a, k) => (a == null ? undefined : a[k]), o);

/** Returns the specs whose values disagree beyond tolerance between two listings of one variant. */
export function findSpecConflicts(existing, incoming) {
  const out = [];
  for (const { path, tolerance } of CONFLICT_CHECKS) {
    const a = get(existing, path);
    const b = get(incoming, path);
    if (typeof a !== 'number' || typeof b !== 'number') continue;
    if (Math.abs(a - b) / Math.max(a, b) > tolerance) out.push({ path, existing: a, incoming: b });
  }
  return out;
}

/** Deep merge that only FILLS missing (null/undefined) values — never overwrites known data. */
export function fillMissing(base, extra) {
  if (base === null || base === undefined) return extra ?? base;
  if (extra === null || extra === undefined) return base;
  if (typeof base !== 'object' || typeof extra !== 'object' || Array.isArray(base) || Array.isArray(extra)) return base;
  const out = { ...base };
  for (const k of Object.keys(extra)) out[k] = fillMissing(base[k], extra[k]);
  return out;
}
