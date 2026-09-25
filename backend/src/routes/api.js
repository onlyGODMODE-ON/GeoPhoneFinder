import { MAX_COMPARE, MAX_RESULTS, PRIORITIES, STORAGE_OPTIONS, BUDGET_TOLERANCE } from '../domain/constants.js';
import { recommend } from '../domain/recommend.js';
import { applicableOffers, primaryOffer, serializeOffer } from '../domain/offers.js';
import { serializePhoneDetail } from '../domain/cards.js';
import { findPhone, searchPhones, suggestNames, SORTS } from '../domain/search.js';
import { offerState } from '../domain/freshness.js';

const strArray = { type: 'array', items: { type: 'string', maxLength: 80 }, maxItems: 50 };
const numArray = { type: 'array', items: { type: 'integer', minimum: 1, maximum: 8192 }, maxItems: 20 };

const recommendationBody = {
  type: 'object',
  additionalProperties: false,
  required: ['maxPrice'],
  properties: {
    minPrice: { type: 'number', minimum: 0, maximum: 1_000_000 },
    maxPrice: { type: 'number', exclusiveMinimum: 0, maximum: 1_000_000 },
    brands: strArray,
    stores: { type: 'array', items: { type: 'string', maxLength: 40 }, maxItems: 20 },
    storage: { type: ['integer', 'null'], minimum: 1, maximum: 8192 },
    priorities: { type: 'array', items: { type: 'string', maxLength: 30 }, maxItems: 20 },
    // optional technical minimums (validated again in domain/spec-filters.js)
    requirements: {
      type: 'object',
      additionalProperties: false,
      properties: {
        minRam: { type: ['number', 'null'] },
        minStorage: { type: ['number', 'null'] },
        minBattery: { type: ['number', 'null'] },
        minRefresh: { type: ['number', 'null'] },
        minCameraScore: { type: ['number', 'null'] },
        vendors: { type: 'array', items: { type: 'string', maxLength: 40 }, maxItems: 10 },
        minChipsetTier: { type: ['string', 'null'], maxLength: 20 },
        telephoto: { type: 'boolean' }, ois: { type: 'boolean' }, oled: { type: 'boolean' }, fiveG: { type: 'boolean' },
        nfc: { type: 'boolean' }, esim: { type: 'boolean' }, wireless: { type: 'boolean' }, waterResistant: { type: 'boolean' },
      },
    },
  },
};

const searchQuery = {
  type: 'object',
  properties: {
    q: { type: 'string', maxLength: 100 },
    brand: strArray,
    store: { type: 'array', items: { type: 'string', maxLength: 40 }, maxItems: 20 },
    minPrice: { type: 'number', minimum: 0 },
    maxPrice: { type: 'number', minimum: 0 },
    storage: numArray,
    ram: numArray,
    processor: { type: 'string', maxLength: 60 },
    minRefresh: { type: 'number', minimum: 0, maximum: 500 },
    minBattery: { type: 'number', minimum: 0, maximum: 20000 },
    minCameraScore: { type: 'number', minimum: 0, maximum: 100 },
    fiveG: { type: 'boolean' },
    nfc: { type: 'boolean' },
    wireless: { type: 'boolean' },
    availableOnly: { type: 'boolean' },
    sort: { type: 'string', enum: SORTS },
    page: { type: 'integer', minimum: 1, maximum: 1000 },
    pageSize: { type: 'integer', minimum: 1, maximum: 48 },
  },
};

/** All offers of a phone with freshness state + which one is primary (cheapest current, any active store). */
export function offerView(phone, snapshot, now) {
  const cfg = { staleAfterHours: snapshot.staleAfterHours, recentlyUpdatedHours: snapshot.recentlyUpdatedHours };
  const activeIds = new Set(snapshot.stores.filter((s) => s.active).map((s) => s.id));
  const current = applicableOffers(phone, { allowedStoreIds: activeIds, now, staleAfterHours: snapshot.staleAfterHours });
  const primary = primaryOffer(current);
  const eligibleIds = new Set(current.map((o) => o.id));
  const offers = [...phone.offers]
    .sort((a, b) => Number(eligibleIds.has(b.id)) - Number(eligibleIds.has(a.id)) || a.price - b.price)
    .map((o) => serializeOffer(o, { now, cfg, primaryId: primary?.id ?? null, eligibleIds }));
  return { offers, primaryOffer: offers.find((o) => o.isPrimary) ?? null };
}

export async function apiRoutes(api, { catalog, config, runIngest, isReady = () => true }) {
  api.get('/health', async () => ({ status: 'ok', ready: isReady() }));

  api.get('/meta', async () => {
    const snap = await catalog.getSnapshot();
    const now = catalog.now();
    const activeStores = snap.stores.filter((s) => s.active);
    const activeIds = new Set(activeStores.map((s) => s.id));

    const brands = new Map();
    let min = Infinity;
    let max = 0;
    for (const p of snap.phones) {
      brands.set(p.brand, (brands.get(p.brand) ?? 0) + 1);
      const best = primaryOffer(applicableOffers(p, { allowedStoreIds: activeIds, now, staleAfterHours: snap.staleAfterHours }));
      if (best) {
        min = Math.min(min, best.price);
        max = Math.max(max, best.price);
      }
    }
    const step = 50;
    return {
      brands: [...brands].map(([name, count]) => ({ name, count })).sort((a, b) => a.name.localeCompare(b.name)),
      stores: activeStores.map(({ id, name, baseUrl }) => ({ id, name, baseUrl })),
      priorities: PRIORITIES,
      storageOptions: STORAGE_OPTIONS,
      ramOptions: [...new Set(snap.phones.map((p) => p.ram).filter(Boolean))].sort((a, b) => a - b),
      processors: [...new Set(snap.chipsets.map((c) => c.vendor))].sort(),
      price: Number.isFinite(min) ? { min: Math.floor(min / step) * step, max: Math.ceil(max / step) * step } : { min: 0, max: 5000 },
      maxResults: MAX_RESULTS,
      maxCompare: MAX_COMPARE,
      budgetTolerance: BUDGET_TOLERANCE, // display only — clients cannot change it
      demo: config.adapterMode === 'demo',
      staleAfterHours: snap.staleAfterHours,
      phoneCount: snap.phones.length,
      generatedAt: snap.generatedAt,
    };
  });

  api.post('/recommendations', { schema: { body: recommendationBody } }, async (req) => {
    const snap = await catalog.getSnapshot();
    return recommend(snap, req.body, { now: catalog.now() });
  });

  api.get('/phones', { schema: { querystring: searchQuery } }, async (req) => {
    const q = req.query;
    const snap = await catalog.getSnapshot();
    return searchPhones(
      snap,
      { ...q, brands: q.brand, stores: q.store },
      { now: catalog.now() },
    );
  });

  api.get('/phones/suggest', { schema: { querystring: { type: 'object', properties: { q: { type: 'string', maxLength: 100 } } } } }, async (req) => {
    const snap = await catalog.getSnapshot();
    return { suggestions: suggestNames(snap, req.query.q) };
  });

  api.get('/phones/:idOrSlug', async (req, reply) => {
    const snap = await catalog.getSnapshot();
    const phone = findPhone(snap, req.params.idOrSlug);
    if (!phone) return reply.code(404).send({ error: 'not_found', message: 'Phone not found' });
    return { phone: serializePhoneDetail(phone), ...offerView(phone, snap, catalog.now()) };
  });

  api.get('/compare', { schema: { querystring: { type: 'object', properties: { ids: { type: 'string', maxLength: 400 } } } } }, async (req, reply) => {
    const ids = [...new Set((req.query.ids ?? '').split(',').map((s) => s.trim()).filter(Boolean))];
    if (ids.length > MAX_COMPARE) {
      return reply.code(400).send({ error: 'too_many', message: `You can compare up to ${MAX_COMPARE} phones`, max: MAX_COMPARE });
    }
    const snap = await catalog.getSnapshot();
    const now = catalog.now();
    const phones = [];
    const missing = [];
    for (const id of ids) {
      const p = findPhone(snap, id);
      if (!p) missing.push(id);
      else phones.push({ phone: serializePhoneDetail(p), ...offerView(p, snap, now) });
    }
    return { phones, missing, max: MAX_COMPARE };
  });

  // Freshness / transparency: what data do we have and how old is it (PRD §13.4, §28).
  api.get('/status', async () => {
    const snap = await catalog.getSnapshot();
    const now = catalog.now();
    const runs = new Map((await catalog.ingestionStatus()).map((r) => [r.storeId, r]));
    const cfg = { staleAfterHours: snap.staleAfterHours, recentlyUpdatedHours: snap.recentlyUpdatedHours };
    return {
      demo: config.adapterMode === 'demo',
      staleAfterHours: snap.staleAfterHours,
      stores: snap.stores.map((s) => {
        const counts = { total: 0, current: 0, stale: 0, unavailable: 0 };
        for (const p of snap.phones) {
          for (const o of p.offers) {
            if (o.storeId !== s.id) continue;
            counts.total++;
            counts[offerState(o, now, cfg).state]++;
          }
        }
        return { id: s.id, name: s.name, active: s.active, offers: counts, lastIngestion: runs.get(s.id) ?? null };
      }),
    };
  });

  // Manual trigger for operators. Disabled unless ADMIN_TOKEN is configured. No user accounts in the MVP.
  api.post('/admin/ingest', async (req, reply) => {
    if (!config.adminToken) return reply.code(404).send({ error: 'not_found' });
    if (req.headers['x-admin-token'] !== config.adminToken) return reply.code(401).send({ error: 'unauthorized' });
    return runIngest();
  });
}
