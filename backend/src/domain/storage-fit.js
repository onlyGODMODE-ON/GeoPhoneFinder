import { STORAGE_LADDER } from './constants.js';

/**
 * Storage is a *preference*, never a hard filter and never stronger than price, brand, store
 * or explicit priorities (PRD §8.3, rule 5). The engine therefore only ANNOTATES each result:
 *
 *   exact   – same size as the target
 *   nearby  – adjacent size on the storage ladder (e.g. 128 GB or 512 GB for a 256 GB target)
 *   other   – anything else
 *   unknown – storage of the variant is not known
 *
 * The target lives in the recommendation criteria, so a future scoring/filtering strategy can
 * use it without touching the data model.
 */
export function storageFit(target, actual) {
  if (!target) return null;
  if (actual === null || actual === undefined) return { target, actual: null, status: 'unknown' };
  if (actual === target) return { target, actual, status: 'exact' };
  const ti = STORAGE_LADDER.indexOf(target);
  const ai = STORAGE_LADDER.indexOf(actual);
  const status = ti >= 0 && ai >= 0 && Math.abs(ti - ai) === 1 ? 'nearby' : 'other';
  return { target, actual, status };
}

export function summarizeStorageFit(target, results) {
  if (!target) return null;
  const counts = { exact: 0, nearby: 0, other: 0, unknown: 0 };
  for (const r of results) counts[r.storageFit?.status ?? 'unknown']++;
  return { target, ...counts };
}
