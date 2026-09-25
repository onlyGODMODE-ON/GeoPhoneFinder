/**
 * ⚠ DEMO DATA — for local development only.
 * Prices, availability and store assortments below are ILLUSTRATIVE, not real Georgian market
 * data (the real market already sells newer models than this catalog). Nothing here was
 * downloaded from the retailers. Real data comes from store adapters (see docs/ADAPTERS.md).
 *
 * Listings intentionally carry NO specs: like a real retailer feed they only have title, price,
 * colour, availability and a link. The pipeline joins the specs from the spec catalog.
 */
import { MORE_PRICE_ROWS, SPEC_CATALOG } from './spec-catalog.js';
import { STORES, storeSearchUrl } from './stores.js';

const byKey = Object.fromEntries(SPEC_CATALOG.map((m) => [m.key, m]));
const storeById = Object.fromEntries(STORES.map((s) => [s.id, s]));

// [modelKey, ram, storage, priceGEL, extras?]   extras: { available:false } | { ageHours } | { color }
const OFFERS = {
  zoommer: [
    ['xiaomi-redmi-13c', 4, 128, 339], ['xiaomi-redmi-13c', 8, 256, 429],
    ['xiaomi-redmi-note-13-pro-5g', 8, 256, 889], ['xiaomi-redmi-note-13-pro-5g', 12, 512, 1069],
    ['xiaomi-poco-x6-pro-5g', 8, 256, 899], ['xiaomi-poco-x6-pro-5g', 12, 512, 1069],
    ['xiaomi-poco-f6', 8, 256, 1119], ['xiaomi-poco-f6', 12, 512, 1299, { available: false }],
    ['nothing-phone-2a', 8, 128, 789], ['nothing-phone-2a', 12, 256, 899],
    ['samsung-galaxy-a35', 6, 128, 899], ['samsung-galaxy-a35', 8, 256, 999],
    ['samsung-galaxy-a55', 8, 128, 1159], ['samsung-galaxy-a55', 8, 256, 1299], ['samsung-galaxy-a55', 12, 256, 1399],
    ['samsung-galaxy-s24-fe', 8, 128, 1699], ['samsung-galaxy-s24-fe', 8, 256, 1849],
    ['xiaomi-14t', 12, 256, 1759], ['xiaomi-14t', 12, 512, 1999],
    ['xiaomi-14', 12, 256, 2399], ['xiaomi-14', 12, 512, 2599],
    ['google-pixel-8a', 8, 128, 1649], ['google-pixel-8a', 8, 256, 1849],
    ['google-pixel-9', 12, 128, 2449], ['google-pixel-9', 12, 256, 2749],
    ['samsung-galaxy-s24', 8, 128, 2299], ['samsung-galaxy-s24', 8, 256, 2499],
    ['samsung-galaxy-s25', 12, 128, 2749], ['samsung-galaxy-s25', 12, 256, 2999], ['samsung-galaxy-s25', 12, 512, 3399],
    ['apple-iphone-15', null, 128, 2699], ['apple-iphone-15', null, 256, 3099],
    ['apple-iphone-16', null, 128, 3099], ['apple-iphone-16', null, 256, 3499], ['apple-iphone-16', null, 512, 4199],
  ],
  alta: [
    ['xiaomi-redmi-13c', 4, 128, 345], ['xiaomi-redmi-13c', 8, 256, 439],
    ['xiaomi-redmi-note-13-pro-5g', 8, 256, 879, { color: 'Midnight Black' }],
    ['xiaomi-redmi-note-13-pro-5g', 8, 256, 889, { color: 'Ocean Teal' }], // duplicate listing of the same variant
    ['xiaomi-redmi-note-13-pro-5g', 12, 512, 1059],
    ['xiaomi-poco-x6-pro-5g', 8, 256, 909], ['xiaomi-poco-x6-pro-5g', 12, 512, 1079],
    ['xiaomi-poco-f6', 8, 256, 1129],
    ['nothing-phone-2a', 8, 128, 779], ['nothing-phone-2a', 12, 256, 909],
    ['samsung-galaxy-a35', 6, 128, 889], ['samsung-galaxy-a35', 8, 256, 1019],
    ['samsung-galaxy-a55', 8, 128, 1149], ['samsung-galaxy-a55', 8, 256, 1279, { ageHours: 120 }], // stale on purpose
    ['samsung-galaxy-s24-fe', 8, 128, 1679], ['samsung-galaxy-s24-fe', 8, 256, 1859],
    ['xiaomi-14t', 12, 256, 1749],
    ['google-pixel-8a', 8, 128, 1669],
    ['google-pixel-9', 12, 128, 2429], ['google-pixel-9', 12, 256, 2699],
    ['samsung-galaxy-s24', 8, 128, 2279], ['samsung-galaxy-s24', 8, 256, 2469],
    ['samsung-galaxy-s25', 12, 128, 2729], ['samsung-galaxy-s25', 12, 256, 2949], ['samsung-galaxy-s25', 12, 512, 3349],
    ['apple-iphone-15', null, 128, 2649], ['apple-iphone-15', null, 256, 3049],
    ['apple-iphone-16', null, 128, 3049], ['apple-iphone-16', null, 256, 3449],
  ],
  xiaomi: [
    ['xiaomi-redmi-13c', 4, 128, 319], ['xiaomi-redmi-13c', 8, 256, 409],
    ['xiaomi-redmi-note-13-pro-5g', 8, 256, 849], ['xiaomi-redmi-note-13-pro-5g', 12, 512, 1029],
    ['xiaomi-poco-x6-pro-5g', 8, 256, 869], ['xiaomi-poco-x6-pro-5g', 12, 512, 1039],
    ['xiaomi-poco-f6', 8, 256, 1089], ['xiaomi-poco-f6', 12, 512, 1259],
    ['xiaomi-14t', 12, 256, 1699], ['xiaomi-14t', 12, 512, 1949],
    ['xiaomi-14', 12, 256, 2299], ['xiaomi-14', 12, 512, 2549],
  ],
};

// Deliberately broken records so the validation / quarantine path is visible in the demo.
const BROKEN = {
  zoommer: [{ sourceProductId: 'zoommer-broken-1', url: 'https://zoommer.ge/#demo-broken', title: 'Samsung Galaxy A06 4GB/64GB', price: 'N/A', available: true }],
  alta: [
    { sourceProductId: 'alta-broken-1', url: 'not-a-url', title: 'Samsung Galaxy A16 4GB/128GB', price: 499, available: true },
    { sourceProductId: 'alta-unknown-brand', url: 'https://alta.ge/#demo-fairphone', title: 'Fairphone 5 8GB/256GB', price: 1600, available: true },
  ],
  xiaomi: [],
};


/** Deterministic 32-bit hash: derived demo prices/colours are stable between runs. */
function hash32(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// Stores whose demo offers are derived from Zoommer's price list (different assortment, small price
// differences, a few unavailable / stale offers) so every store has plausible but distinct data.
const DERIVED = {
  elit: { sells: (m) => ['Samsung', 'Xiaomi'].includes(m.brand), factor: 1.01 },
  megatechnica: { sells: () => true, factor: 0.99 }, // general electronics superstore: carries every brand
  istore: { sells: (m) => m.brand === 'Apple', factor: 1.03 },
  gstore: { sells: (m) => !['Apple'].includes(m.brand), factor: 0.98 }, // budget-to-mid generalist, skips Apple
};

function deriveOffers(storeKey, { sells, factor }, base = OFFERS.zoommer) {
  const rows = [];
  for (const [key, ram, storage, price] of base) {
    if (!sells(byKey[key])) continue;
    const h = hash32(`${storeKey}|${key}|${ram}|${storage}`);
    if (h % 5 === 0) continue; // not stocked here
    const jitter = ((h % 7) - 3) / 100;
    const p = Math.max(50, Math.round((price * factor * (1 + jitter)) / 10) * 10 - 1);
    const extra = h % 13 === 0 ? { available: false } : h % 19 === 0 ? { ageHours: 90 } : {};
    rows.push([key, ram, storage, p, extra]);
  }
  return rows;
}


// Base prices (GEL, illustrative) for the additional models. They are Zoommer's rows; every other store derives its own.
const EXTRA = [
  ['samsung-galaxy-s25-ultra', 12, 256, 4299], ['samsung-galaxy-s25-ultra', 12, 512, 4699], ['samsung-galaxy-s25-ultra', 12, 1024, 5299],
  ['samsung-galaxy-s25-plus', 12, 256, 3499], ['samsung-galaxy-s25-plus', 12, 512, 3899],
  ['samsung-galaxy-s24-ultra', 12, 256, 3399], ['samsung-galaxy-s24-ultra', 12, 512, 3699], ['samsung-galaxy-s24-ultra', 12, 1024, 4199],
  ['samsung-galaxy-s24-plus', 12, 256, 2799], ['samsung-galaxy-s24-plus', 12, 512, 3099],
  ['samsung-galaxy-s23-fe', 8, 128, 1499], ['samsung-galaxy-s23-fe', 8, 256, 1599],
  ['samsung-galaxy-a25-5g', 6, 128, 629], ['samsung-galaxy-a25-5g', 8, 256, 729],
  ['samsung-galaxy-a16-5g', 4, 128, 499], ['samsung-galaxy-a16-5g', 6, 128, 549], ['samsung-galaxy-a16-5g', 8, 256, 649],
  ['samsung-galaxy-a15', 4, 128, 419], ['samsung-galaxy-a15', 6, 128, 469], ['samsung-galaxy-a15', 8, 256, 549],
  ['apple-iphone-16-pro-max', null, 256, 4699], ['apple-iphone-16-pro-max', null, 512, 5299], ['apple-iphone-16-pro-max', null, 1024, 5899],
  ['apple-iphone-16-pro', null, 128, 3899], ['apple-iphone-16-pro', null, 256, 4299], ['apple-iphone-16-pro', null, 512, 4899], ['apple-iphone-16-pro', null, 1024, 5499],
  ['apple-iphone-16-plus', null, 128, 3499], ['apple-iphone-16-plus', null, 256, 3899], ['apple-iphone-16-plus', null, 512, 4499],
  ['apple-iphone-15-pro', null, 128, 3299], ['apple-iphone-15-pro', null, 256, 3699], ['apple-iphone-15-pro', null, 512, 4299], ['apple-iphone-15-pro', null, 1024, 4899],
  ['apple-iphone-14', null, 128, 2199], ['apple-iphone-14', null, 256, 2499], ['apple-iphone-14', null, 512, 2999],
  ['apple-iphone-13', null, 128, 1799], ['apple-iphone-13', null, 256, 2099],
  ['google-pixel-8-pro', 12, 128, 2599], ['google-pixel-8-pro', 12, 256, 2799], ['google-pixel-8-pro', 12, 512, 3199],
  ['google-pixel-7a', 8, 128, 1299],
  ['xiaomi-14t-pro', 12, 256, 2299], ['xiaomi-14t-pro', 12, 512, 2499],
  ['xiaomi-13t', 8, 256, 1499], ['xiaomi-13t', 12, 256, 1599],
  ['xiaomi-redmi-note-14-pro-5g', 8, 256, 929], ['xiaomi-redmi-note-14-pro-5g', 12, 512, 1099],
  ['xiaomi-poco-x7-pro-5g', 8, 256, 979], ['xiaomi-poco-x7-pro-5g', 12, 512, 1149],
  ['xiaomi-redmi-12-5g', 4, 128, 379], ['xiaomi-redmi-12-5g', 8, 256, 449],
  ['honor-200', 8, 256, 1199], ['honor-200', 12, 512, 1399],
  ['oneplus-12', 12, 256, 2599], ['oneplus-12', 16, 512, 2999],
  ['realme-12-pro-plus-5g', 8, 256, 1199], ['realme-12-pro-plus-5g', 12, 512, 1349],
  ['nothing-cmf-phone-1', 8, 128, 399], ['nothing-cmf-phone-1', 8, 256, 469],
];
EXTRA.push(...MORE_PRICE_ROWS);
OFFERS.zoommer.push(...EXTRA);
OFFERS.alta.push(...deriveOffers('alta', { sells: () => true, factor: 0.99 }, EXTRA));
OFFERS.xiaomi.push(...deriveOffers('xiaomi', { sells: (m) => m.brand === 'Xiaomi', factor: 0.97 }, EXTRA));

for (const [storeKey, cfg] of Object.entries(DERIVED)) OFFERS[storeKey] = deriveOffers(storeKey, cfg);

const needsBrand = (m) => !/^(Galaxy|iPhone|Pixel|Redmi|Poco)/.test(m.model);
const mem = (ram, st) => (ram ? `${ram}/${st}GB` : `${st}GB`);

// Every store words its titles differently, like real retailers. The pipeline must still converge on ONE variant.
const STYLES = {
  zoommer: (m, ram, st, x) => `${m.brand} ${m.model} ${mem(ram, st)} ${x.color}`,
  alta: (m, ram, st, x) => `${m.brand} ${m.model} ${ram ? `${ram}+` : ''}${st}GB ${x.color}`,
  xiaomi: (m, ram, st) => `${needsBrand(m) ? `${m.brand} ` : ''}${m.model} (${ram ? `${ram}GB+` : ''}${st}GB)`,
  elit: (m, ram, st) => `${m.brand} ${m.model} ${ram ? `${ram}GB RAM ` : ''}${st}GB`,
  megatechnica: (m, ram, st, x) => `${m.brand} ${m.model} - ${mem(ram, st)} - ${x.color}`,
  istore: (m, ram, st, x) => `${m.model} ${st}GB ${x.color}`,
  gstore: (m, ram, st, x) => `${needsBrand(m) ? `${m.brand} ` : ''}${m.model} ${ram ? `${ram}/` : ''}${st} GB ${x.color}`,
};

/** Raw listings exactly as a retailer adapter would hand them to the pipeline. */
export function demoListingsFor(storeKey, now = new Date()) {
  const store = storeById[storeKey];
  const out = [];
  OFFERS[storeKey].forEach(([key, ram, storage, price, extra = {}], i) => {
    const m = byKey[key];
    const h = hash32(`${storeKey}|${key}|${ram}|${storage}|color`);
    const color = extra.color ?? (m.colors.length ? m.colors[h % m.colors.length] : 'Black');
    const sourceProductId = `${storeKey}-${key}-${ram ?? 'x'}-${storage}${extra.color ? `-${extra.color.toLowerCase().replace(/\W+/g, '')}` : ''}`;
    out.push({
      sourceProductId,
      url: storeSearchUrl(store.baseUrl, `${m.brand} ${m.model} ${ram ? `${ram}GB ` : ''}${storage}GB`),
      title: STYLES[storeKey](m, ram, storage, { ...extra, color }),
      color,
      price,
      currency: 'GEL',
      available: extra.available !== false,
      fetchedAt: new Date(now.getTime() - (extra.ageHours ?? 0) * 3_600_000 - (i % 5) * 60_000).toISOString(),
    });
  });
  out.push(...(BROKEN[storeKey] ?? []));
  return out;
}

export const DEMO_STORE_KEYS = Object.keys(OFFERS);
