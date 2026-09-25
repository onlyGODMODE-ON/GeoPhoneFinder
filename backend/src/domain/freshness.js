/**
 * Offer freshness (PRD §13.4, §28). The engine recomputes freshness from `lastUpdated`
 * and an explicit `now`, so the same dataset + same `now` always yields the same result.
 */
const HOUR = 3_600_000;

export function toMs(value) {
  return value instanceof Date ? value.getTime() : new Date(value).getTime();
}

export function isStale(lastUpdated, now, staleAfterHours) {
  const t = toMs(lastUpdated);
  if (!Number.isFinite(t)) return true;
  return toMs(now) - t > staleAfterHours * HOUR;
}

export function isRecentlyUpdated(lastUpdated, now, recentHours) {
  const t = toMs(lastUpdated);
  return Number.isFinite(t) && toMs(now) - t <= recentHours * HOUR;
}

/** An offer may drive an active recommendation only if it is available AND not stale. */
export function isOfferCurrent(offer, now, staleAfterHours) {
  return offer.available === true && !isStale(offer.lastUpdated, now, staleAfterHours);
}

/** 'unavailable' | 'stale' | 'current' — plus a separate recentlyUpdated flag. */
export function offerState(offer, now, cfg) {
  const stale = isStale(offer.lastUpdated, now, cfg.staleAfterHours);
  const state = !offer.available ? 'unavailable' : stale ? 'stale' : 'current';
  return {
    state,
    stale,
    recentlyUpdated: !stale && isRecentlyUpdated(offer.lastUpdated, now, cfg.recentlyUpdatedHours),
  };
}
