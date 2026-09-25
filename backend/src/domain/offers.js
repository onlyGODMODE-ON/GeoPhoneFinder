import { isOfferCurrent, offerState } from './freshness.js';

/**
 * Cheapest current, available offer first; ties broken by store id so results are deterministic.
 */
export function compareOffers(a, b) {
  return a.price - b.price || (a.storeId < b.storeId ? -1 : a.storeId > b.storeId ? 1 : 0);
}

/**
 * Offers that may drive an active recommendation for this phone:
 * available, not stale, from an active store, and (when restricted) from a selected store.
 * PRD §8.4 / §14.
 */
export function applicableOffers(phone, { allowedStoreIds, now, staleAfterHours }) {
  return phone.offers
    .filter((o) => allowedStoreIds.has(o.storeId) && isOfferCurrent(o, now, staleAfterHours))
    .sort(compareOffers);
}

/** PRD §14: the primary offer is the cheapest current available offer from the selected store set. */
export function primaryOffer(offers) {
  return offers.length ? offers[0] : null;
}

/** Shapes an offer for API responses, including freshness state (PRD §13.4). */
export function serializeOffer(offer, { now, cfg, primaryId = null, eligibleIds = null }) {
  const st = offerState(offer, now, cfg);
  return {
    id: offer.id,
    storeId: offer.storeId,
    storeName: offer.storeName,
    price: offer.price,
    currency: 'GEL',
    url: offer.url,
    imageUrl: offer.imageUrl ?? null,
    color: offer.color ?? null,
    available: offer.available,
    state: st.state,
    stale: st.stale,
    recentlyUpdated: st.recentlyUpdated,
    lastUpdated: offer.lastUpdated,
    isPrimary: primaryId !== null && offer.id === primaryId,
    // "eligible" = would count toward a recommendation for the current store selection
    eligible: eligibleIds ? eligibleIds.has(offer.id) : st.state === 'current',
  };
}
