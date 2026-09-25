/**
 * Supported retailers. They are DATA (rows in the `stores` table), never conditions in the engine.
 * `adapterKey` selects the integration class in adapters/registry.js.
 * Rows are only inserted when missing, so toggling `active` in the database persists.
 *
 * baseUrl status:
 *   ✔ verified   – zoommer.ge, alta.ge, istore.com.ge
 *   ? UNVERIFIED – best guesses, please confirm before going live
 */
export const STORES = [
  { id: 'zoommer', name: 'Zoommer', baseUrl: 'https://zoommer.ge', adapterKey: 'zoommer' },
  { id: 'alta', name: 'Alta', baseUrl: 'https://alta.ge', adapterKey: 'alta' },
  { id: 'elit', name: 'Elit Electronics', baseUrl: 'https://eliteelectronics.ge', adapterKey: 'elit' }, // UNVERIFIED
  { id: 'megatechnica', name: 'Megatechnica', baseUrl: 'https://megatechnica.ge', adapterKey: 'megatechnica' }, // UNVERIFIED
  { id: 'istore', name: 'iStore', baseUrl: 'https://istore.com.ge', adapterKey: 'istore' },
  { id: 'gstore', name: 'GStore', baseUrl: 'https://gstore.ge', adapterKey: 'gstore' }, // UNVERIFIED
  // TODO: replace with the real Xiaomi Georgia storefront URL.
  { id: 'xiaomi', name: 'Xiaomi Georgia', baseUrl: 'https://www.mi.com/global/', adapterKey: 'xiaomi' },
];

/**
 * Link used by DEMO data. Live adapters return the exact product-page URL of the store, but the demo
 * has no real product pages, so it points to a search restricted to the store's own domain for this
 * exact phone + memory size. (Store search URL formats are not verified, a site-restricted web search
 * is the only pattern that works for every domain.)
 */
export function storeSearchUrl(baseUrl, query) {
  const host = new URL(baseUrl).host.replace(/^www\./, '');
  return `https://www.google.com/search?q=${encodeURIComponent(`site:${host} ${query}`)}`;
}
