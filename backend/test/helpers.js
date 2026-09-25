export const NOW = new Date('2026-01-10T12:00:00Z');
const hoursAgo = (h) => new Date(NOW.getTime() - h * 3_600_000).toISOString();

export const STORES = [
  { id: 'zoommer', name: 'Zoommer', baseUrl: 'https://zoommer.ge', active: true },
  { id: 'alta', name: 'Alta', baseUrl: 'https://alta.ge', active: true },
  { id: 'xiaomi', name: 'Xiaomi Georgia', baseUrl: 'https://mi.example', active: true },
];

let seq = 0;
export function offer(storeId, price, extra = {}) {
  seq += 1;
  return {
    id: `offer-${seq}`,
    storeId,
    storeName: STORES.find((s) => s.id === storeId)?.name ?? storeId,
    price,
    available: true,
    url: `https://example.test/${storeId}/${seq}`,
    sourceProductId: `sp-${seq}`,
    lastUpdated: hoursAgo(1),
    ...extra,
  };
}

/** Builds a PhoneRecord. `offers` defaults to a single Zoommer offer at `price`. */
export function phone(id, { brand = 'Samsung', price, offers, scores = {}, storage = 256, ram = 8, ...spec } = {}) {
  return {
    id,
    slug: id,
    brand,
    model: id,
    ram,
    storage,
    imageUrl: null,
    chipset: null,
    display: null,
    battery: null,
    cameras: null,
    connectivity: null,
    scores,
    scoreDetails: {},
    source: 'test',
    sourceUrl: 'https://example.test',
    sourceProductId: id,
    lastUpdated: hoursAgo(1),
    offers: offers ?? [offer('zoommer', price)],
    ...spec,
  };
}

export function snapshot(phones, overrides = {}) {
  return { phones, stores: STORES, staleAfterHours: 48, recentlyUpdatedHours: 6, ...overrides };
}

export { hoursAgo };
