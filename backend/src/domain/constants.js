/** Business constants from the PRD. Keep them here so the engine has no magic numbers. */

/** PRD §8.1 — automatic, non-configurable tolerance above the user's max budget. */
export const BUDGET_TOLERANCE = 0.05;
/** PRD §9.1 — at most 10 recommendations. */
export const MAX_RESULTS = 10;
/** PRD §17.1 — comparison holds at most 3 phones. */
export const MAX_COMPARE = 3;

/** Storage targets offered in the wizard (PRD §8.3). Values are GB. */
export const STORAGE_OPTIONS = [128, 256, 512, 1024];
/** Ordered ladder used to decide whether a storage size is "nearby" a target. */
export const STORAGE_LADDER = [32, 64, 128, 256, 512, 1024, 2048];

/**
 * Predefined priorities (PRD §8.5). `key` is also the key of the matching score definition.
 * Labels here are the English defaults; the frontend translates them.
 */
export const PRIORITIES = [
  { key: 'gaming', label: 'Gaming' },
  { key: 'camera', label: 'Camera' },
  { key: 'battery', label: 'Battery' },
  { key: 'performance', label: 'Performance' },
  { key: 'display', label: 'Display' },
  { key: 'storage', label: 'Storage' },
  { key: 'ram', label: 'RAM' },
  { key: 'video', label: 'Video' },
  { key: 'selfie', label: 'Selfie' },
  { key: 'speakers', label: 'Speakers' },
  { key: 'connectivity', label: 'Connectivity' },
  { key: 'compact', label: 'Compact / Lightweight' },
  { key: 'durability', label: 'Durability' },
  { key: 'software', label: 'Software / Updates' },
];
export const PRIORITY_KEYS = PRIORITIES.map((p) => p.key);

export const roundMoney = (n) => Math.round(n * 100) / 100;

/** allowedMax = maxPrice × 1.05 (PRD §8.1). Rounded to tetri to avoid float noise. */
export function computeAllowedMax(maxPrice) {
  return roundMoney(maxPrice * (1 + BUDGET_TOLERANCE));
}
