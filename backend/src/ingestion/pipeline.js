import { createHash, randomUUID } from 'node:crypto';
import { validateListing } from './validate.js';
import { normalizeListing } from './normalize.js';
import { createAdapter } from './adapters/registry.js';
import { AdapterNotConfiguredError } from './adapters/base.js';
import { withRetry } from './http.js';
import { loadActiveDefinitions, loadChipsets, syncReferenceData } from './reference.js';
import { buildChipsetIndex } from '../scoring/chipsets.js';
import { buildScoringContext, computeScores } from '../scoring/engine.js';
import { fillMissing, findSpecConflicts, uuidV5 } from '../domain/identity.js';
import { cleanText, jsonParam, stableStringify } from '../domain/text.js';

const SPEC_GROUPS = ['display', 'battery', 'cameras', 'video', 'connectivity', 'audio', 'body', 'software', 'benchmarks'];

async function log(db, { runId = null, storeId = null, level = 'info', event, message, details = null }) {
  await db.query('INSERT INTO update_logs (run_id, store_id, level, event, message, details) VALUES ($1,$2,$3,$4,$5,$6::jsonb)', [
    runId, storeId, level, event, message, jsonParam(details),
  ]);
}

async function saveSourceRecord(db, { storeId, sourceProductId, variantId = null, status, raw, errors = [], now }) {
  const hash = createHash('sha256').update(stableStringify(raw)).digest('hex');
  await db.query(
    `INSERT INTO source_records (id, store_id, source_product_id, phone_variant_id, status, raw, errors, content_hash, first_seen, last_seen)
     VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8,$9::timestamptz,$9::timestamptz)
     ON CONFLICT (store_id, source_product_id) DO UPDATE SET phone_variant_id=EXCLUDED.phone_variant_id, status=EXCLUDED.status,
       raw=EXCLUDED.raw, errors=EXCLUDED.errors, content_hash=EXCLUDED.content_hash, last_seen=EXCLUDED.last_seen`,
    [uuidV5(`source|${storeId}|${sourceProductId}`), storeId, sourceProductId, variantId, status, JSON.stringify(raw ?? null), JSON.stringify(errors), hash, now.toISOString()],
  );
}

async function uniqueSlug(db, baseSlug, chipsetId, id) {
  const taken = async (slug) => (await db.query('SELECT 1 FROM phone_variants WHERE slug=$1 AND id<>$2', [slug, id])).rows.length > 0;
  if (!(await taken(baseSlug))) return baseSlug;
  if (chipsetId && !(await taken(`${baseSlug}-${chipsetId}`))) return `${baseSlug}-${chipsetId}`;
  return `${baseSlug}-${id.slice(0, 8)}`;
}

/** Creates or updates one PhoneVariant. Never overwrites known specs from a non-primary source. */
async function upsertVariant(ctx, n, storeId) {
  const { db, runId, stats, now } = ctx;
  const { rows } = await db.query('SELECT * FROM phone_variants WHERE identity_key=$1', [n.identity.key]);
  const incoming = Object.fromEntries(SPEC_GROUPS.map((g) => [g, n.specs[g] ?? null]));

  if (!rows.length) {
    const slug = await uniqueSlug(db, n.identity.baseSlug, n.chipsetId, n.identity.id);
    await db.query(
      `INSERT INTO phone_variants (id, slug, identity_key, brand, model, ram, storage, chipset_id,
         display, battery, cameras, video, connectivity, audio, body, software, benchmarks,
         image_url, source, source_url, source_product_id, last_updated)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10::jsonb,$11::jsonb,$12::jsonb,$13::jsonb,$14::jsonb,$15::jsonb,$16::jsonb,$17::jsonb,$18,$19,$20,$21,$22::timestamptz)`,
      [n.identity.id, slug, n.identity.key, n.brand, n.model, n.ram, n.storage, n.chipsetId,
        ...SPEC_GROUPS.map((g) => jsonParam(incoming[g])),
        n.imageUrl, storeId, n.offer.url, n.offer.sourceProductId, n.offer.lastUpdated.toISOString()],
    );
    stats.variantsCreated++;
    await log(db, { runId, storeId, event: 'variant:created', message: `${n.brand} ${n.model} ${n.ram ?? '?'}/${n.storage ?? '?'}`, details: { id: n.identity.id, slug } });
    return n.identity.id;
  }

  const ex = rows[0];
  const overwrite = ex.source === storeId; // the store that first supplied the specs stays the source of record
  const changed = [];
  const next = {};
  for (const g of SPEC_GROUPS) {
    const before = ex[g] ?? null;
    next[g] = overwrite ? fillMissing(incoming[g], before) : fillMissing(before, incoming[g]);
    if (stableStringify(next[g]) !== stableStringify(before)) changed.push(g);
  }
  const conflicts = findSpecConflicts(ex, incoming);
  if (conflicts.length) {
    await log(db, { runId, storeId, level: 'warn', event: 'spec-conflict', message: `Sources disagree on ${ex.brand} ${ex.model}`, details: { variantId: ex.id, conflicts } });
  }
  if (changed.length) {
    await db.query(
      `UPDATE phone_variants SET display=$2::jsonb, battery=$3::jsonb, cameras=$4::jsonb, video=$5::jsonb, connectivity=$6::jsonb,
         audio=$7::jsonb, body=$8::jsonb, software=$9::jsonb, benchmarks=$10::jsonb WHERE id=$1`,
      [ex.id, ...SPEC_GROUPS.map((g) => jsonParam(next[g]))],
    );
    stats.specChanges++;
    await log(db, { runId, storeId, event: 'change:specs', message: `Specs changed for ${ex.brand} ${ex.model}`, details: { variantId: ex.id, groups: changed } });
  }
  await db.query(
    `UPDATE phone_variants SET image_url = COALESCE(image_url, $2),
       last_updated = GREATEST(last_updated, $3::timestamptz) WHERE id=$1`,
    [ex.id, n.imageUrl, n.offer.lastUpdated.toISOString()],
  );
  return ex.id;
}

async function upsertOffer(ctx, variantId, n, storeId) {
  const { db, runId, stats } = ctx;
  const offerId = uuidV5(`offer|${storeId}|${variantId}`);
  const { rows } = await db.query('SELECT price::float8 AS price, available FROM store_offers WHERE id=$1', [offerId]);
  const o = n.offer;
  await db.query(
    `INSERT INTO store_offers (id, phone_variant_id, store_id, price, currency, available, url, source_product_id, last_updated, stale, image_url, color)
     VALUES ($1,$2,$3,$4,'GEL',$5,$6,$7,$8::timestamptz,FALSE,$9,$10)
     ON CONFLICT (store_id, phone_variant_id) DO UPDATE SET price=EXCLUDED.price, available=EXCLUDED.available, url=EXCLUDED.url,
       source_product_id=EXCLUDED.source_product_id, last_updated=EXCLUDED.last_updated, stale=FALSE,
       image_url=COALESCE(EXCLUDED.image_url, store_offers.image_url), color=COALESCE(EXCLUDED.color, store_offers.color)`,
    [offerId, variantId, storeId, o.price, o.available, o.url, o.sourceProductId, o.lastUpdated.toISOString(), o.imageUrl ?? null, o.color ?? null],
  );
  if (!rows.length) {
    stats.offersCreated++;
    return;
  }
  stats.offersUpdated++;
  const prev = rows[0];
  if (prev.price !== o.price) {
    stats.priceChanges++;
    await log(db, { runId, storeId, event: 'change:price', message: `Price ${prev.price} → ${o.price} GEL`, details: { variantId, old: prev.price, new: o.price } });
  }
  if (prev.available !== o.available) {
    stats.availabilityChanges++;
    await log(db, { runId, storeId, event: 'change:availability', message: `Availability ${prev.available} → ${o.available}`, details: { variantId } });
  }
}

/** Prefer an available listing, then the cheaper one. */
const better = (a, b) => (a.n.offer.available !== b.n.offer.available ? a.n.offer.available : a.n.offer.price < b.n.offer.price);

async function ingestStore({ db, store, adapter, chipsetIndex, now, retry }) {
  const runId = randomUUID();
  const stats = {
    fetched: 0, normalized: 0, quarantined: 0, duplicates: 0, variantsCreated: 0, offersCreated: 0,
    offersUpdated: 0, priceChanges: 0, availabilityChanges: 0, specChanges: 0, markedUnavailable: 0,
  };
  const ctx = { db, runId, stats, now };
  await db.query("INSERT INTO ingestion_runs (id, store_id, started_at, status) VALUES ($1,$2,$3::timestamptz,'running')", [runId, store.id, now.toISOString()]);
  const finish = (status) =>
    db.query('UPDATE ingestion_runs SET finished_at=$2::timestamptz, status=$3, stats=$4::jsonb WHERE id=$1', [runId, new Date().toISOString(), status, JSON.stringify(stats)]);

  // 1. Collect (bounded retries). On failure previous valid data is preserved and freshness ages naturally.
  let listings;
  try {
    listings = await withRetry(() => adapter.fetchListings({ now }), {
      ...retry,
      shouldRetry: (e) => !(e instanceof AdapterNotConfiguredError),
      onRetry: (e, attempt, delay) => log(db, { runId, storeId: store.id, level: 'warn', event: 'collect:retry', message: `${e.message} — retry ${attempt} in ${delay}ms` }),
    });
    if (!Array.isArray(listings) || listings.length === 0) throw new Error('adapter returned no listings (treated as a failure to protect existing data)');
  } catch (err) {
    await log(db, { runId, storeId: store.id, level: 'error', event: 'collect:failed', message: err.message });
    await finish('failed');
    return { storeId: store.id, status: 'failed', error: err.message, stats };
  }
  stats.fetched = listings.length;

  // 2. Validate + normalize. Malformed records are quarantined, never allowed to corrupt data.
  const accepted = [];
  for (const raw of listings) {
    const v = validateListing(raw, { now });
    const spid = cleanText(raw?.sourceProductId, 200) || `unknown-${createHash('sha1').update(stableStringify(raw)).digest('hex').slice(0, 12)}`;
    let errors = v.ok ? null : v.errors;
    let n = null;
    if (v.ok) {
      const r = normalizeListing(v.value, { chipsetIndex });
      if (r.ok) n = r.value;
      else errors = r.errors;
    }
    if (!n) {
      stats.quarantined++;
      await saveSourceRecord(db, { storeId: store.id, sourceProductId: spid, status: 'quarantined', raw, errors, now });
      await log(db, { runId, storeId: store.id, level: 'warn', event: 'validation:quarantined', message: `Record ${spid} quarantined`, details: { errors } });
      continue;
    }
    if (n.chipsetUnknown) {
      await log(db, { runId, storeId: store.id, level: 'warn', event: 'chipset:unknown', message: `Unknown chipset "${n.chipsetUnknown}" for ${n.brand} ${n.model}` });
    }
    accepted.push({ raw, n });
  }

  // 3. One active offer per (store, variant): duplicate source listings collapse to the best one.
  const winners = new Map();
  const duplicateLineage = []; // saved after the variant exists (FK)
  for (const item of accepted) {
    const id = item.n.identity.id;
    const cur = winners.get(id);
    if (!cur) {
      winners.set(id, item);
      continue;
    }
    stats.duplicates++;
    const winner = better(item, cur) ? item : cur;
    const loser = winner === item ? cur : item;
    winners.set(id, winner);
    duplicateLineage.push({ sourceProductId: loser.n.offer.sourceProductId, variantId: id, raw: loser.raw });
    await log(db, { runId, storeId: store.id, event: 'duplicate-listing', message: `Duplicate listing ${loser.n.offer.sourceProductId} merged into ${winner.n.offer.sourceProductId}` });
  }

  // 4. Persist variants + offers.
  for (const { raw, n } of winners.values()) {
    const variantId = await upsertVariant(ctx, n, store.id);
    await upsertOffer(ctx, variantId, n, store.id);
    await saveSourceRecord(db, { storeId: store.id, sourceProductId: n.offer.sourceProductId, variantId, status: 'normalized', raw, now });
    stats.normalized++;
  }
  for (const d of duplicateLineage) {
    await saveSourceRecord(db, { storeId: store.id, sourceProductId: d.sourceProductId, variantId: d.variantId, status: 'normalized', raw: d.raw, now });
  }

  // 5. Anything this store no longer lists is marked unavailable (only after a successful collection).
  const seen = new Set(winners.keys());
  const { rows: existing } = await db.query('SELECT id, phone_variant_id AS "variantId", available FROM store_offers WHERE store_id=$1', [store.id]);
  for (const row of existing) {
    if (!seen.has(row.variantId) && row.available) {
      await db.query('UPDATE store_offers SET available=FALSE, last_updated=$2::timestamptz WHERE id=$1', [row.id, now.toISOString()]);
      stats.markedUnavailable++;
      await log(db, { runId, storeId: store.id, event: 'offer:unlisted', message: 'Offer no longer listed by the store — marked unavailable', details: { variantId: row.variantId } });
    }
  }

  const status = stats.quarantined > 0 ? 'partial' : 'success';
  await finish(status);
  return { storeId: store.id, status, stats };
}

/** Recomputes every component score with the active definitions; stores a snapshot when they change. */
export async function recomputeScores(db, { now = new Date() } = {}) {
  const definitions = await loadActiveDefinitions(db);
  const chipsets = await loadChipsets(db);
  const byId = new Map(chipsets.map((c) => [c.id, c]));
  const totalGenerations = Math.max(1, ...chipsets.map((c) => c.generationRank));
  const { rows } = await db.query('SELECT * FROM phone_variants ORDER BY id');
  let updated = 0;
  for (const v of rows) {
    const ctx = buildScoringContext(v, byId.get(v.chipset_id), totalGenerations);
    const result = computeScores(ctx, definitions, now);
    const before = stableStringify({ values: v.scores?.values ?? null, details: v.scores?.details ?? null });
    const after = stableStringify({ values: result.values, details: result.details });
    if (before === after) continue;
    await db.query('UPDATE phone_variants SET scores=$2::jsonb WHERE id=$1', [v.id, JSON.stringify(result)]);
    const versions = Object.fromEntries(definitions.map((d) => [d.key, d.version]));
    await db.query('INSERT INTO score_snapshots (phone_variant_id, versions, scores) VALUES ($1,$2::jsonb,$3::jsonb)', [v.id, JSON.stringify(versions), JSON.stringify(result.values)]);
    updated++;
  }
  return { updated, total: rows.length };
}

/**
 * Runs the whole collection → normalization → variant resolution → scoring flow.
 * Every store is isolated: one failing retailer never breaks the others (PRD §5).
 */
export async function runIngestion({ db, config, logger = console, now = new Date(), storeIds = null, adapterFactory = createAdapter, retry = { retries: 3, baseDelayMs: 500 } }) {
  await syncReferenceData(db, (m) => logger.warn?.(m));
  const chipsetIndex = buildChipsetIndex(await loadChipsets(db));
  const { rows } = await db.query('SELECT id, name, base_url AS "baseUrl", adapter_key AS "adapterKey" FROM stores WHERE active ORDER BY id');
  const stores = rows.filter((s) => !storeIds || storeIds.includes(s.id));

  const results = [];
  for (const store of stores) {
    try {
      const adapter = adapterFactory(store, { mode: config.adapterMode });
      results.push(await ingestStore({ db, store, adapter, chipsetIndex, now, retry }));
    } catch (err) {
      await log(db, { storeId: store.id, level: 'error', event: 'ingest:crashed', message: err.message });
      results.push({ storeId: store.id, status: 'failed', error: err.message });
    }
  }

  const staleBefore = new Date(now.getTime() - config.staleAfterHours * 3_600_000);
  await db.query('UPDATE store_offers SET stale = (last_updated < $1::timestamptz)', [staleBefore.toISOString()]);
  const scores = await recomputeScores(db, { now });
  return { stores: results, scores };
}
