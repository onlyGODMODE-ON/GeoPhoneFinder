import { loadSnapshot, loadIngestionStatus } from '../repo/catalog.js';

/**
 * In-memory cache in front of the database (PRD §26 "cache normalized product data").
 * The cache is dropped after every ingestion run and expires after `catalogCacheSeconds`.
 */
export function createCatalogService({ db, config, clock = () => new Date() }) {
  let cache = null;
  let inflight = null;

  function refresh(now) {
    if (!inflight) {
      inflight = loadSnapshot(db, config, now)
        .then((snapshot) => {
          cache = { snapshot, at: now.getTime() };
          return snapshot;
        })
        .finally(() => {
          inflight = null;
        });
    }
    return inflight;
  }

  /**
   * Fresh copy => return it. Expired copy => return it INSTANTLY and refresh in the background, so a slow or busy
   * database (e.g. while an ingestion run holds the embedded PGlite) never makes a page request wait.
   * Only the very first call, or catalogCacheSeconds = 0, waits for the database.
   */
  async function getSnapshot() {
    const now = clock();
    const ttlMs = config.catalogCacheSeconds * 1000;
    if (cache && now.getTime() - cache.at < ttlMs) return cache.snapshot;
    if (cache && ttlMs > 0) {
      refresh(now).catch(() => {}); // keep serving the old copy if the refresh fails
      return cache.snapshot;
    }
    return refresh(now);
  }

  return {
    getSnapshot,
    /** Drop the copy after an ingestion run and warm the next one in the background. */
    invalidate: () => {
      cache = null;
      refresh(clock()).catch(() => {});
    },
    now: clock,
    ingestionStatus: () => loadIngestionStatus(db),
  };
}
