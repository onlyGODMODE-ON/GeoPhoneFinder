import { demoListingsFor } from '../demo-data.js';
import { createPoliteFetcher } from '../http.js';

export class AdapterNotConfiguredError extends Error {
  constructor(message) {
    super(message);
    this.name = 'AdapterNotConfiguredError';
  }
}

/**
 * StoreAdapter (PRD §13.3). Each retailer gets one subclass that converts retailer-specific
 * data into the common RawListing contract documented in ingestion/validate.js.
 * Adding a retailer never touches ranking, scoring or UI code.
 *
 * Source priority (PRD §13.1): official API > official feed > structured data > scraping
 * (only where technically, contractually and legally appropriate).
 */
export class StoreAdapter {
  /** @param {{id:string,name:string,baseUrl:string}} store  @param {{mode:'demo'|'live', env?:object, fetcher?:object}} opts */
  constructor(store, { mode = 'demo', env = process.env, fetcher } = {}) {
    this.store = store;
    this.mode = mode;
    this.env = env;
    this.fetcher = fetcher ?? createPoliteFetcher();
  }

  /** Returns RawListing[]; throws on failure (the pipeline retries and preserves previous data). */
  async fetchListings({ now = new Date() } = {}) {
    if (this.mode === 'demo') return demoListingsFor(this.store.id, now);
    return this.fetchLive({ now });
  }

  /**
   * Default live implementation: an official JSON feed whose URL is configured via
   *   FEED_URL_<STOREID>   e.g. FEED_URL_ZOOMMER=https://partner-feed.example/phones.json
   * Override `mapRecord` if the feed is not already in RawListing shape, or override
   * `fetchLive` entirely for an API/HTML integration.
   */
  async fetchLive() {
    const url = this.env[`FEED_URL_${this.store.id.toUpperCase()}`];
    if (!url) {
      throw new AdapterNotConfiguredError(
        `Store "${this.store.id}" has no live integration yet. Set FEED_URL_${this.store.id.toUpperCase()} ` +
          `or implement fetchLive() in its adapter (see docs/ADAPTERS.md).`,
      );
    }
    const data = await this.fetcher.getJson(url);
    const records = Array.isArray(data) ? data : data?.items;
    if (!Array.isArray(records)) throw new Error('feed did not contain an array of records');
    return records.map((r) => this.mapRecord(r));
  }

  /** Maps one retailer record to RawListing. Identity by default. */
  mapRecord(record) {
    return record;
  }
}
