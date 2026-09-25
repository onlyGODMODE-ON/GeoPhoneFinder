import { loadChipsets } from '../ingestion/reference.js';

const iso = (d) => (d instanceof Date ? d.toISOString() : new Date(d).toISOString());

/**
 * Loads the normalized catalog into the in-memory PhoneRecord shape the engine works on.
 * Order is deterministic (brand, model, ram, storage, id) so ranking ties are reproducible.
 */
export async function loadSnapshot(db, config, now = new Date()) {
  const chipsets = await loadChipsets(db);
  const chipsetById = new Map(chipsets.map((c) => [c.id, c]));

  const { rows: stores } = await db.query('SELECT id, name, base_url AS "baseUrl", active FROM stores ORDER BY id');
  const { rows: variants } = await db.query(
    'SELECT * FROM phone_variants ORDER BY brand, model, ram NULLS FIRST, storage NULLS FIRST, id',
  );
  const { rows: offers } = await db.query(
    `SELECT o.id, o.phone_variant_id AS "variantId", o.store_id AS "storeId", s.name AS "storeName",
            o.price::float8 AS price, o.available, o.url, o.source_product_id AS "sourceProductId", o.last_updated AS "lastUpdated",
            o.image_url AS "imageUrl", o.color
       FROM store_offers o JOIN stores s ON s.id = o.store_id
      ORDER BY o.phone_variant_id, o.price, o.store_id`,
  );

  const byVariant = new Map();
  for (const o of offers) {
    if (!byVariant.has(o.variantId)) byVariant.set(o.variantId, []);
    byVariant.get(o.variantId).push({ ...o, lastUpdated: iso(o.lastUpdated) });
  }

  const phones = variants.map((v) => ({
    id: v.id,
    slug: v.slug,
    brand: v.brand,
    model: v.model,
    ram: v.ram,
    storage: v.storage,
    imageUrl: v.image_url,
    chipset: v.chipset_id ? (chipsetById.get(v.chipset_id) ?? null) : null,
    display: v.display,
    battery: v.battery,
    cameras: v.cameras,
    video: v.video,
    connectivity: v.connectivity,
    audio: v.audio,
    body: v.body,
    software: v.software,
    benchmarks: v.benchmarks,
    scores: v.scores?.values ?? {},
    scoreDetails: v.scores?.details ?? {},
    source: v.source,
    sourceUrl: v.source_url,
    sourceProductId: v.source_product_id,
    lastUpdated: iso(v.last_updated),
    offers: (byVariant.get(v.id) ?? []).map(({ variantId, ...o }) => o),
  }));

  return {
    phones,
    stores,
    chipsets,
    generatedAt: now.toISOString(),
    staleAfterHours: config.staleAfterHours,
    recentlyUpdatedHours: config.recentlyUpdatedHours,
  };
}

/** Latest ingestion run per store — powers the freshness/transparency endpoint. */
export async function loadIngestionStatus(db) {
  const { rows } = await db.query(
    `SELECT DISTINCT ON (store_id) store_id AS "storeId", status, started_at AS "startedAt", finished_at AS "finishedAt", stats
       FROM ingestion_runs ORDER BY store_id, started_at DESC`,
  );
  const { rows: ok } = await db.query(
    `SELECT store_id AS "storeId", max(finished_at) AS "lastSuccessAt"
       FROM ingestion_runs WHERE status IN ('success','partial') GROUP BY store_id`,
  );
  const lastOk = new Map(ok.map((r) => [r.storeId, r.lastSuccessAt]));
  return rows.map((r) => ({
    storeId: r.storeId,
    lastRunStatus: r.status,
    lastRunAt: r.finishedAt ? iso(r.finishedAt) : iso(r.startedAt),
    lastSuccessAt: lastOk.get(r.storeId) ? iso(lastOk.get(r.storeId)) : null,
    stats: r.stats,
  }));
}
