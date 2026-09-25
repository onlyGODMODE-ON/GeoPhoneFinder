import { PRIORITY_KEYS, computeAllowedMax } from './constants.js';
import { CriteriaError } from './errors.js';
import { normalizeRequirements } from './spec-filters.js';

const toNumber = (v) => (typeof v === 'string' && v.trim() !== '' ? Number(v) : v);

/**
 * Validates and normalises the wizard state ("recommendation state").
 *
 *  - minPrice / maxPrice : the user's displayed budget. The 5 % tolerance is derived, never input.
 *  - brands   : [] => all brands allowed (PRD §8.2)
 *  - stores   : [] => all active stores (PRD §8.4)
 *  - storage  : target in GB or null (preference only)
 *  - priorities: ordered, de-duplicated, predefined keys only (PRD §8.5)
 *  - requirements: OPTIONAL technical minimums for users who know phones (see spec-filters.js)
 */
export function normalizeCriteria(raw = {}, snapshot) {
  const errors = [];

  const minPrice = raw.minPrice === undefined || raw.minPrice === null ? 0 : toNumber(raw.minPrice);
  const maxPrice = toNumber(raw.maxPrice);
  if (!Number.isFinite(minPrice) || minPrice < 0) errors.push('minPrice must be a number >= 0');
  if (!Number.isFinite(maxPrice) || maxPrice <= 0 || maxPrice > 1_000_000) {
    errors.push('maxPrice must be a number between 0 and 1,000,000');
  }
  if (Number.isFinite(minPrice) && Number.isFinite(maxPrice) && minPrice > maxPrice) {
    errors.push('minPrice must not be greater than maxPrice');
  }

  const knownBrands = new Map();
  for (const p of snapshot.phones) knownBrands.set(p.brand.toLowerCase(), p.brand);
  const brands = [];
  for (const b of Array.isArray(raw.brands) ? raw.brands : []) {
    const key = String(b).trim().toLowerCase();
    if (!key) continue;
    const canonical = knownBrands.get(key) ?? String(b).trim();
    if (!brands.includes(canonical)) brands.push(canonical);
  }

  const storeIds = new Set(snapshot.stores.map((s) => s.id));
  const stores = [];
  for (const s of Array.isArray(raw.stores) ? raw.stores : []) {
    if (!storeIds.has(s)) {
      errors.push(`unknown store "${s}"`);
      continue;
    }
    if (!stores.includes(s)) stores.push(s);
  }

  let storage = raw.storage === undefined || raw.storage === '' ? null : toNumber(raw.storage);
  if (storage !== null && (!Number.isInteger(storage) || storage <= 0 || storage > 8192)) {
    errors.push('storage must be a positive integer (GB) or null');
    storage = null;
  }

  const priorities = [];
  for (const p of Array.isArray(raw.priorities) ? raw.priorities : []) {
    if (!PRIORITY_KEYS.includes(p)) {
      errors.push(`unknown priority "${p}"`);
      continue;
    }
    if (!priorities.includes(p)) priorities.push(p); // order preserved, first occurrence wins
  }

  const req = normalizeRequirements(raw.requirements);
  errors.push(...req.errors);

  if (errors.length) throw new CriteriaError('Invalid recommendation criteria', errors);

  return {
    minPrice,
    maxPrice,
    allowedMax: computeAllowedMax(maxPrice),
    brands,
    stores,
    storage,
    priorities,
    requirements: req.value,
  };
}
