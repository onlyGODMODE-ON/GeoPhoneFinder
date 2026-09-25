/**
 * Tiny in-memory cache (per tab). It makes browser Back/Forward instant: returning to a results or
 * search page shows the previous data immediately instead of a spinner, then quietly refreshes it.
 */
const store = new Map();
const MAX = 60;

export const cacheGet = (key) => store.get(key) ?? null;

export function cacheSet(key, data) {
  store.set(key, { data, at: Date.now() });
  if (store.size > MAX) store.delete(store.keys().next().value);
}

export const cacheClear = () => store.clear();
