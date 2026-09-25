import { PRIORITY_KEYS } from './constants.js';
import { keyOf } from './text.js';
import { applicableOffers, primaryOffer, serializeOffer } from './offers.js';
import { serializePhoneCard, phoneName } from './cards.js';
import { matchesRequirements } from './spec-filters.js';
import { matchScore, queryTokens, searchIndex } from './search-match.js';

/**
 * Search & filters over normalized phone variants (PRD §15).
 * Reuses the same card shape as recommendations so the UI can share components.
 */
export const SORTS = ['relevance', 'price-asc', 'price-desc', 'name', ...PRIORITY_KEYS.map((k) => `score:${k}`)];

const nameKey = (p) => keyOf(phoneName(p));

export function searchPhones(snapshot, params = {}, { now = new Date() } = {}) {
  const cfg = { staleAfterHours: snapshot.staleAfterHours, recentlyUpdatedHours: snapshot.recentlyUpdatedHours };
  const activeIds = snapshot.stores.filter((s) => s.active).map((s) => s.id);
  const storesSelected = Array.isArray(params.stores) && params.stores.length > 0;
  const allowedStoreIds = new Set(storesSelected ? params.stores.filter((s) => activeIds.includes(s)) : activeIds);

  const tokens = queryTokens(params.q);
  const brands = (params.brands ?? []).map((b) => b.toLowerCase());
  const processor = params.processor ? keyOf(params.processor) : '';
  const requirements = {
    minBattery: params.minBattery, minRefresh: params.minRefresh, minCameraScore: params.minCameraScore,
    fiveG: params.fiveG, nfc: params.nfc, wireless: params.wireless,
  };

  const rows = [];
  for (const phone of snapshot.phones) {
    // Loose text match: ANY word / part of a word / letter of the query may match (see search-match.js).
    let rel = 0;
    if (tokens.length) {
      rel = matchScore(tokens, searchIndex(phone));
      if (rel === 0) continue;
    }
    if (brands.length && !brands.includes(phone.brand.toLowerCase())) continue;
    if (params.storage?.length && !params.storage.includes(phone.storage)) continue;
    if (params.ram?.length && !params.ram.includes(phone.ram)) continue;
    if (processor && !keyOf(`${phone.chipset?.name ?? ''} ${phone.chipset?.vendor ?? ''}`).includes(processor)) continue;
    if (!matchesRequirements(phone, requirements)) continue;

    const offers = applicableOffers(phone, { allowedStoreIds, now, staleAfterHours: snapshot.staleAfterHours });
    const primary = primaryOffer(offers);
    const priceFiltered = params.minPrice != null || params.maxPrice != null;
    if ((storesSelected || priceFiltered || params.availableOnly) && !primary) continue;
    if (primary) {
      if (params.minPrice != null && primary.price < params.minPrice) continue;
      if (params.maxPrice != null && primary.price > params.maxPrice) continue;
    }
    rows.push({ phone, offers, primary, rel });
  }

  const sort = SORTS.includes(params.sort) ? params.sort : tokens.length ? 'relevance' : 'price-asc';
  const price = (r, dir) => (r.primary ? r.primary.price : dir > 0 ? Infinity : -Infinity); // phones without an offer go last
  const byName = (a, b) => nameKey(a.phone).localeCompare(nameKey(b.phone)) || (a.phone.ram ?? 0) - (b.phone.ram ?? 0) || (a.phone.storage ?? 0) - (b.phone.storage ?? 0);
  const cmp = {
    relevance: (a, b) => b.rel - a.rel || price(a, 1) - price(b, 1) || byName(a, b),
    'price-asc': (a, b) => (price(a, 1) === price(b, 1) ? byName(a, b) : price(a, 1) - price(b, 1)),
    'price-desc': (a, b) => {
      const x = a.primary ? a.primary.price : -1;
      const y = b.primary ? b.primary.price : -1;
      return y - x || byName(a, b);
    },
    name: byName,
  }[sort] ?? ((a, b) => {
    const k = sort.slice('score:'.length);
    return (b.phone.scores[k] ?? -1) - (a.phone.scores[k] ?? -1) || byName(a, b);
  });
  rows.sort(cmp);

  const pageSize = Math.min(Math.max(Number(params.pageSize) || 12, 1), 48);
  const total = rows.length;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(Number(params.page) || 1, 1), pages);
  const items = rows.slice((page - 1) * pageSize, page * pageSize).map((r) => {
    const eligibleIds = new Set(r.offers.map((o) => o.id));
    return {
      phone: serializePhoneCard(r.phone),
      primaryOffer: r.primary ? serializeOffer(r.primary, { now, cfg, primaryId: r.primary.id, eligibleIds }) : null,
      offerCount: r.phone.offers.length,
    };
  });
  return { items, total, page, pages, pageSize, sort };
}

/** Live suggestions: distinct "Brand Model" names, best match first (same loose matching as the search). */
export function suggestNames(snapshot, q, limit = 8) {
  const tokens = queryTokens(q);
  if (!tokens.length) return [];
  const best = new Map();
  for (const p of snapshot.phones) {
    const score = matchScore(tokens, searchIndex(p));
    if (score === 0) continue;
    const name = phoneName(p);
    if (!best.has(name) || best.get(name) < score) best.set(name, score);
  }
  return [...best]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([name]) => name);
}

export function findPhone(snapshot, idOrSlug) {
  return snapshot.phones.find((p) => p.id === idOrSlug || p.slug === idOrSlug) ?? null;
}
