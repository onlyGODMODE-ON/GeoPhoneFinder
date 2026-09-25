import { MAX_RESULTS, PRIORITY_KEYS } from './constants.js';
import { normalizeCriteria } from './criteria.js';
import { applicableOffers, primaryOffer, serializeOffer } from './offers.js';
import { serializePhoneCard } from './cards.js';
import { storageFit, summarizeStorageFit } from './storage-fit.js';
import { matchesRequirements } from './spec-filters.js';

/**
 * RECOMMENDATION ENGINE (PRD §9) — pure and deterministic.
 * Same snapshot + same criteria + same `now` => identical output.
 * It knows nothing about retailers: it only reads normalized PhoneRecord / StoreOffer data.
 *
 *   all phones
 *     -> hard filters (price ×1.05, brand, store, optional minimums) => Candidate Array
 *     -> price DESC                                    (stable)
 *     -> lexicographic priority sort                   (stable)
 *     -> weighted FinalScore sort (desc)               (stable)
 *     -> top 10
 *
 * Priority sorting never restarts from the full catalog; it only reorders the candidate array.
 */

/** Weights N, N-1, …, 1 for N priorities (PRD §9.5). */
export function priorityWeights(n) {
  return Array.from({ length: n }, (_, i) => n - i);
}

/**
 * FinalScore = Σ(score_i × weight_i) / Σ(weight_i), clamped to 0–100.
 * A priority whose component score is unknown (null) is EXCLUDED and the remaining weights are
 * re-normalised — missing data is never treated as 0 (PRD §10.1).
 * Returns null if none of the priorities has a score.
 */
export function weightedFinalScore(scores) {
  const weights = priorityWeights(scores.length);
  let num = 0;
  let den = 0;
  scores.forEach((s, i) => {
    if (s === null || s === undefined) return;
    num += s * weights[i];
    den += weights[i];
  });
  if (den === 0) return null;
  return Math.min(100, Math.max(0, num / den));
}

/**
 * OVERALL SCORE — used when the user picked no priorities (searches by price only).
 * Every phone in the price range is judged by ALL of its component scores: the average of the scores we
 * have (= their sum ÷ how many there are). Dividing keeps a phone with an unknown score (e.g. no published RAM)
 * from being punished as if that score were 0; when all scores are known it orders exactly like the sum.
 * Returns null when nothing is scored at all.
 */
export function overallScore(scores) {
  const known = PRIORITY_KEYS.map((k) => scores?.[k]).filter((v) => v !== null && v !== undefined);
  if (!known.length) return null;
  return known.reduce((a, b) => a + b, 0) / known.length;
}

/** FinalScore descending, unknown (null) last. Equal scores keep their order (stable sort). */
const byFinalScoreDesc = (a, b) => {
  if (a.finalScore === b.finalScore) return 0;
  if (a.finalScore === null) return 1;
  if (b.finalScore === null) return -1;
  return b.finalScore - a.finalScore;
};

/** Match = round(FinalScore), always within 0–100 (PRD §9.7). */
export function matchPercentage(finalScore) {
  if (finalScore === null) return null;
  return Math.min(100, Math.max(0, Math.round(finalScore)));
}

/**
 * Lexicographic comparison: Priority #1 first; only if tied compare #2; and so on.
 * Unknown (null) scores rank after any known score. Returns 0 when everything ties, so a
 * stable sort keeps the existing candidate-array (price DESC) order.
 */
export function compareByPriorities(a, b) {
  for (let i = 0; i < a.priorityScores.length; i++) {
    const x = a.priorityScores[i];
    const y = b.priorityScores[i];
    if (x === y) continue;
    if (x === null) return 1;
    if (y === null) return -1;
    return y - x; // higher first
  }
  return 0;
}

/**
 * Builds the Candidate Array: every phone variant that satisfies ALL hard constraints.
 * The applicable price is the cheapest current available offer from an allowed store, so the
 * price filter and the store filter are evaluated on the same offer (PRD §8.1, §8.4).
 */
export function buildCandidates(snapshot, criteria, now) {
  const activeIds = snapshot.stores.filter((s) => s.active).map((s) => s.id);
  const allowedStoreIds = new Set(
    criteria.stores.length ? criteria.stores.filter((id) => activeIds.includes(id)) : activeIds,
  );
  const brandFilter = criteria.brands.length ? new Set(criteria.brands.map((b) => b.toLowerCase())) : null;
  const cfg = { allowedStoreIds, now, staleAfterHours: snapshot.staleAfterHours };

  const candidates = [];
  for (const phone of snapshot.phones) {
    if (brandFilter && !brandFilter.has(phone.brand.toLowerCase())) continue; // brand: hard
    if (!matchesRequirements(phone, criteria.requirements)) continue; // optional user minimums: hard

    const offers = applicableOffers(phone, cfg); // store + freshness: hard
    const primary = primaryOffer(offers);
    if (!primary) continue;

    // price: hard — price >= minPrice && price <= maxPrice × 1.05
    if (primary.price < criteria.minPrice || primary.price > criteria.allowedMax) continue;

    candidates.push({ phone, primary, price: primary.price, eligibleOffers: offers });
  }
  return { candidates, allowedStoreIds };
}

export function recommend(snapshot, rawCriteria, { now = new Date(), limit = MAX_RESULTS } = {}) {
  const criteria = normalizeCriteria(rawCriteria, snapshot);
  const cfg = { staleAfterHours: snapshot.staleAfterHours, recentlyUpdatedHours: snapshot.recentlyUpdatedHours };

  const { candidates, allowedStoreIds } = buildCandidates(snapshot, criteria, now);

  // Stage 1 — candidate array sorted by price DESC. Array#sort is stable, so equal prices keep
  // the snapshot's deterministic order.
  const candidateArray = [...candidates].sort((a, b) => b.price - a.price);

  let ordered;
  let rankedBy = 'priorities';
  if (criteria.priorities.length === 0) {
    // No priorities: judge every candidate by all its scores and rank by that overall score.
    // Ties keep the candidate-array order (price DESC) because the sort is stable.
    rankedBy = 'overall';
    ordered = candidateArray
      .map((c) => ({ ...c, priorityScores: [], finalScore: overallScore(c.phone.scores) }))
      .sort(byFinalScoreDesc);
  } else {
    const scored = candidateArray.map((c) => {
      const priorityScores = criteria.priorities.map((k) => c.phone.scores[k] ?? null);
      return { ...c, priorityScores, finalScore: weightedFinalScore(priorityScores) };
    });
    // Stage 2 — lexicographic priority sort (stable => ties keep price DESC order).
    const byPriority = [...scored].sort(compareByPriorities);
    // Stage 3 — FinalScore DESC (stable => ties keep the lexicographic order from stage 2).
    // Net effect = FinalScore ↓, priority #1 ↓, #2 ↓ …, then candidate order (PRD §9.6).
    ordered = [...byPriority].sort(byFinalScoreDesc);
  }

  // Never duplicate phones to fill the Top 10 (PRD rule 14) — each candidate is a distinct variant.
  const results = ordered.slice(0, limit).map((c, i) => {
    const eligibleIds = new Set(c.eligibleOffers.map((o) => o.id));
    const offers = [...c.phone.offers]
      .sort((a, b) => Number(eligibleIds.has(b.id)) - Number(eligibleIds.has(a.id)) || a.price - b.price)
      .map((o) => serializeOffer(o, { now, cfg, primaryId: c.primary.id, eligibleIds }));
    return {
      rank: i + 1,
      phone: serializePhoneCard(c.phone),
      primaryOffer: offers.find((o) => o.isPrimary),
      offers,
      finalScore: c.finalScore === null ? null : Math.round(c.finalScore * 100) / 100,
      match: matchPercentage(c.finalScore),
      priorityScores: criteria.priorities.map((key, idx) => ({ key, score: c.priorityScores[idx] })),
      missingPriorities: criteria.priorities.filter((_, idx) => c.priorityScores[idx] === null),
      storageFit: storageFit(criteria.storage, c.phone.storage),
    };
  });

  return {
    criteria,
    rankedBy, // 'priorities' = weighted priority score · 'overall' = average of all scores (no priorities chosen)
    candidateCount: candidates.length,
    storeRestricted: criteria.stores.length > 0 && allowedStoreIds.size < snapshot.stores.filter((s) => s.active).length,
    results,
    storageSummary: summarizeStorageFit(criteria.storage, results),
    generatedAt: now.toISOString(),
  };
}
