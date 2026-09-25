import { clamp } from '../lib/format.js';

/**
 * Wizard ("recommendation state"). All ranking/filtering happens on the server;
 * the UI only collects choices.
 *   stores: null   => all stores (default, no restriction)
 *   brands: []     => all brands
 *   requirements   => OPTIONAL technical minimums for users who know phones; {} = none
 *   storage        => legacy exact-size preference (not asked in the wizard any more, API still supports it)
 */
export const DEFAULT_CRITERIA = Object.freeze({
  minPrice: 500,
  maxPrice: 1500,
  brands: [],
  storage: null,
  stores: null,
  priorities: [],
  requirements: {},
});

export const REQ_FLAGS = ['telephoto', 'ois', 'oled', 'fiveG', 'nfc', 'esim', 'wireless', 'waterResistant'];
export const REQ_TIERS = ['entry', 'mid', 'upper-mid', 'flagship'];
const REQ_NUMBERS = { minRam: [1, 64], minStorage: [8, 8192], minBattery: [1000, 20000], minRefresh: [30, 500], minCameraScore: [0, 100] };

/** Camera "levels" shown to the user, mapped to the backend camera score (0–100). */
export const CAMERA_LEVELS = [
  { key: 'good', score: 50 },
  { key: 'great', score: 60 },
  { key: 'top', score: 70 },
];

export const hasRequirements = (r) => Object.keys(r ?? {}).length > 0;

/** Drops empty values so an untouched form is exactly `{}`. */
export function cleanRequirements(r = {}) {
  const out = {};
  for (const k of Object.keys(REQ_NUMBERS)) if (Number.isFinite(r[k])) out[k] = r[k];
  for (const k of REQ_FLAGS) if (r[k] === true) out[k] = true;
  if (Array.isArray(r.vendors) && r.vendors.length) out.vendors = [...new Set(r.vendors)];
  if (REQ_TIERS.includes(r.minChipsetTier)) out.minChipsetTier = r.minChipsetTier;
  return out;
}

export function toRequest(c) {
  return {
    minPrice: c.minPrice,
    maxPrice: c.maxPrice,
    brands: c.brands,
    storage: c.storage,
    stores: c.stores ?? [],
    priorities: c.priorities,
    requirements: cleanRequirements(c.requirements),
  };
}

export function encodeCriteria(c) {
  const p = new URLSearchParams();
  p.set('min', String(c.minPrice));
  p.set('max', String(c.maxPrice));
  c.brands.forEach((b) => p.append('brand', b));
  if (c.storage) p.set('storage', String(c.storage));
  if (c.stores) c.stores.forEach((s) => p.append('store', s));
  c.priorities.forEach((k) => p.append('priority', k));
  const r = cleanRequirements(c.requirements);
  for (const k of Object.keys(REQ_NUMBERS)) if (r[k] !== undefined) p.set(`r.${k}`, String(r[k]));
  r.vendors?.forEach((v) => p.append('r.vendor', v));
  if (r.minChipsetTier) p.set('r.tier', r.minChipsetTier);
  REQ_FLAGS.forEach((f) => r[f] && p.append('r.flag', f));
  return p;
}

const numOr = (v, d) => {
  const n = Number(v);
  return v !== null && v !== '' && Number.isFinite(n) ? n : d;
};

/** Reads criteria from a URL. Unknown/garbled values fall back to defaults; the server validates again. */
export function decodeCriteria(params) {
  let minPrice = Math.max(0, numOr(params.get('min'), DEFAULT_CRITERIA.minPrice));
  let maxPrice = numOr(params.get('max'), DEFAULT_CRITERIA.maxPrice);
  if (maxPrice <= 0) maxPrice = DEFAULT_CRITERIA.maxPrice;
  if (minPrice > maxPrice) [minPrice, maxPrice] = [maxPrice, minPrice];
  const stores = params.getAll('store');
  const storage = numOr(params.get('storage'), null);

  const requirements = {};
  for (const [k, [lo, hi]] of Object.entries(REQ_NUMBERS)) {
    const n = numOr(params.get(`r.${k}`), null);
    if (n !== null && n >= lo && n <= hi) requirements[k] = n;
  }
  const vendors = params.getAll('r.vendor');
  if (vendors.length) requirements.vendors = [...new Set(vendors)];
  const tier = params.get('r.tier');
  if (REQ_TIERS.includes(tier)) requirements.minChipsetTier = tier;
  params.getAll('r.flag').filter((f) => REQ_FLAGS.includes(f)).forEach((f) => { requirements[f] = true; });

  return {
    minPrice,
    maxPrice,
    brands: [...new Set(params.getAll('brand'))],
    storage: storage && storage > 0 ? storage : null,
    stores: stores.length ? [...new Set(stores)] : null,
    priorities: [...new Set(params.getAll('priority'))],
    requirements,
  };
}

export function wizardReducer(state, action) {
  switch (action.type) {
    case 'setBudget': {
      let { min, max } = action;
      min = Math.max(0, min);
      if (min > max) [min, max] = [max, min];
      return { ...state, minPrice: min, maxPrice: max };
    }
    case 'toggleBrand': {
      const has = state.brands.includes(action.name);
      return { ...state, brands: has ? state.brands.filter((b) => b !== action.name) : [...state.brands, action.name] };
    }
    case 'setBrands':
      return { ...state, brands: [...action.brands] };
    case 'setStorage':
      return { ...state, storage: action.storage };
    case 'toggleStore': {
      const current = state.stores ?? action.allIds;
      const has = current.includes(action.id);
      if (has && current.length === 1) return state; // at least one store must remain selected
      const next = has ? current.filter((s) => s !== action.id) : [...current, action.id];
      const coversAll = action.allIds.every((id) => next.includes(id));
      return { ...state, stores: coversAll ? null : next };
    }
    case 'setStores':
      return { ...state, stores: action.stores };
    case 'addPriority':
      return state.priorities.includes(action.key) ? state : { ...state, priorities: [...state.priorities, action.key] };
    case 'removePriority':
      return { ...state, priorities: state.priorities.filter((k) => k !== action.key) };
    case 'movePriority': {
      const i = state.priorities.indexOf(action.key);
      const j = clamp(i + action.dir, 0, state.priorities.length - 1);
      if (i < 0 || i === j) return state;
      const next = [...state.priorities];
      [next[i], next[j]] = [next[j], next[i]];
      return { ...state, priorities: next };
    }
    case 'setRequirement': {
      // value null / '' / false removes the requirement
      const next = { ...state.requirements };
      if (action.value === null || action.value === undefined || action.value === '' || action.value === false) delete next[action.key];
      else next[action.key] = action.value;
      return { ...state, requirements: next };
    }
    case 'toggleVendor': {
      const cur = state.requirements.vendors ?? [];
      const vendors = cur.includes(action.name) ? cur.filter((v) => v !== action.name) : [...cur, action.name];
      const next = { ...state.requirements };
      if (vendors.length) next.vendors = vendors;
      else delete next.vendors;
      return { ...state, requirements: next };
    }
    case 'clearRequirements':
      return { ...state, requirements: {} };
    case 'load':
      return { ...DEFAULT_CRITERIA, ...action.criteria, requirements: { ...(action.criteria.requirements ?? {}) } };
    case 'reset':
      return { ...DEFAULT_CRITERIA, requirements: {} };
    default:
      return state;
  }
}
