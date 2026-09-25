import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { loadConfig } from '../src/config.js';
import { createDb } from '../src/db/index.js';
import { runMigrations } from '../src/db/migrate.js';
import { runIngestion } from '../src/ingestion/pipeline.js';
import { StoreAdapter, AdapterNotConfiguredError } from '../src/ingestion/adapters/base.js';
import { withRetry, createPoliteFetcher } from '../src/ingestion/http.js';
import { startScheduler } from '../src/ingestion/scheduler.js';
import { SPEC_CATALOG } from '../src/ingestion/spec-catalog.js';

const config = loadConfig({});
const retry = { retries: 0 };
let db;

/** Adapter that serves whatever listings a test hands it — proves adapters are the only retailer-specific code. */
class FakeAdapter extends StoreAdapter {
  constructor(store, opts, script) {
    super(store, opts);
    this.script = script;
  }
  async fetchListings() {
    const r = this.script[this.store.id];
    if (r instanceof Error) throw r;
    return typeof r === 'function' ? r() : r;
  }
}
const factory = (script) => (store, opts) => new FakeAdapter(store, opts, script);

const specs = { chipsetName: 'Snapdragon 8 Gen 3', fiveG: true, display: { sizeInch: 6.3, refreshRateHz: 120 }, battery: { capacityMah: 4500 } };
const listing = (over = {}) => ({
  sourceProductId: 'sku-1', url: 'https://shop.test/1', title: 'Xiaomi 14 12GB/256GB', price: 2300, available: true, specs, ...over,
});

const one = async (q, p = []) => (await db.query(q, p)).rows;

before(async () => {
  db = await createDb({ databaseUrl: process.env.TEST_DATABASE_URL });
  if (db.kind === 'postgres') await db.exec('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  await runMigrations(db);
});
after(() => db.close());
beforeEach(async () => {
  await db.exec('TRUNCATE store_offers, source_records, score_snapshots, update_logs, ingestion_runs, phone_variants CASCADE');
});

const ingest = (script, storeIds = ['zoommer']) => runIngestion({ db, config, retry, storeIds, adapterFactory: factory(script) });

describe('ingestion pipeline', () => {
  test('a new retailer needs only an adapter: data reaches the normalized model', async () => {
    const r = await ingest({ zoommer: [listing()] });
    assert.equal(r.stores[0].status, 'success');
    const [v] = await one('SELECT brand, model, ram, storage, source, source_product_id, source_url FROM phone_variants');
    assert.deepEqual([v.brand, v.model, v.ram, v.storage, v.source], ['Xiaomi', '14', 12, 256, 'zoommer']);
    assert.equal(v.source_product_id, 'sku-1');
    assert.equal(v.source_url, 'https://shop.test/1');
    const [o] = await one('SELECT price::float8 AS price, currency, available FROM store_offers');
    assert.deepEqual([o.price, o.currency, o.available], [2300, 'GEL', true]);
  });

  test('same phone from two retailers => ONE variant with TWO offers', async () => {
    await ingest({ zoommer: [listing()], alta: [listing({ sourceProductId: 'a-9', title: 'Xiaomi 14 (12GB+256GB) Black', price: 2250 })] }, ['zoommer', 'alta']);
    assert.equal((await one('SELECT * FROM phone_variants')).length, 1);
    assert.equal((await one('SELECT * FROM store_offers')).length, 2);
  });

  test('materially different configurations are NOT merged (S25 12/256 vs 8/256)', async () => {
    await ingest({ zoommer: [listing({ sourceProductId: 'a', title: 'Samsung Galaxy S25 12GB/256GB' }), listing({ sourceProductId: 'b', title: 'Samsung Galaxy S25 8GB/256GB' })] });
    assert.equal((await one('SELECT * FROM phone_variants')).length, 2);
  });

  test('second run is idempotent; price + availability changes are detected and logged', async () => {
    await ingest({ zoommer: [listing()] });
    await ingest({ zoommer: [listing()] });
    assert.equal((await one('SELECT * FROM store_offers')).length, 1);
    await ingest({ zoommer: [listing({ price: 2100, available: false })] });
    const [o] = await one('SELECT price::float8 AS price, available FROM store_offers');
    assert.deepEqual([o.price, o.available], [2100, false]);
    const events = (await one('SELECT event FROM update_logs')).map((e) => e.event);
    assert.ok(events.includes('change:price') && events.includes('change:availability'));
  });

  test('duplicate listings of one variant in one store collapse into a single offer', async () => {
    const r = await ingest({ zoommer: [listing({ sourceProductId: 'red', price: 2400 }), listing({ sourceProductId: 'blue', price: 2300 })] });
    assert.equal(r.stores[0].stats.duplicates, 1);
    const offers = await one('SELECT price::float8 AS price, source_product_id FROM store_offers');
    assert.equal(offers.length, 1);
    assert.equal(offers[0].price, 2300);
    assert.equal((await one('SELECT * FROM source_records')).length, 2); // lineage of both kept
  });

  test('malformed records are quarantined and never reach normalized tables', async () => {
    const r = await ingest({ zoommer: [listing(), listing({ sourceProductId: 'bad', price: 'free' }), listing({ sourceProductId: 'bad2', title: 'Fairphone 5 8GB/256GB' })] });
    assert.equal(r.stores[0].status, 'partial');
    assert.equal(r.stores[0].stats.quarantined, 2);
    assert.equal((await one('SELECT * FROM store_offers')).length, 1);
    const q = await one("SELECT source_product_id, errors FROM source_records WHERE status='quarantined' ORDER BY 1");
    assert.deepEqual(q.map((x) => x.source_product_id), ['bad', 'bad2']);
  });

  test('collector failure: previous valid data is preserved, failure logged, other stores unaffected', async () => {
    await ingest({ zoommer: [listing()], alta: [listing({ sourceProductId: 'a1', price: 2200 })] }, ['zoommer', 'alta']);
    const r = await ingest({ zoommer: new Error('ECONNRESET'), alta: [listing({ sourceProductId: 'a1', price: 2150 })] }, ['zoommer', 'alta']);
    assert.equal(r.stores.find((s) => s.storeId === 'zoommer').status, 'failed');
    assert.equal(r.stores.find((s) => s.storeId === 'alta').status, 'success');
    const offers = Object.fromEntries((await one('SELECT store_id, price::float8 AS price, available FROM store_offers')).map((o) => [o.store_id, o]));
    assert.equal(offers.zoommer.price, 2300); // untouched
    assert.equal(offers.zoommer.available, true); // a failed run must NOT mark offers unavailable
    assert.equal(offers.alta.price, 2150);
    assert.ok((await one("SELECT * FROM update_logs WHERE event='collect:failed'")).length >= 1);
  });

  test('an empty feed is treated as a failure, not "everything sold out"', async () => {
    await ingest({ zoommer: [listing()] });
    const r = await ingest({ zoommer: [] });
    assert.equal(r.stores[0].status, 'failed');
    assert.equal((await one('SELECT available FROM store_offers'))[0].available, true);
  });

  test('a phone the store stops listing is marked unavailable', async () => {
    await ingest({ zoommer: [listing(), listing({ sourceProductId: 'two', title: 'Xiaomi 14 12GB/512GB', price: 2600 })] });
    await ingest({ zoommer: [listing()] });
    const rows = await one('SELECT v.storage, o.available FROM store_offers o JOIN phone_variants v ON v.id=o.phone_variant_id ORDER BY v.storage');
    assert.deepEqual(rows.map((r) => [r.storage, r.available]), [[256, true], [512, false]]);
  });

  test('non-primary sources only FILL missing specs, never overwrite them', async () => {
    const honor = { title: 'Honor Magic6 Lite 8GB/256GB' }; // not in the spec catalog => only the listing's own specs count
    await ingest({ zoommer: [listing({ ...honor, specs: { chipsetName: 'Snapdragon 8 Gen 3', battery: { capacityMah: 4500 }, display: { sizeInch: 6.3, refreshRateHz: 120 } } })] });
    await ingest({ alta: [listing({ ...honor, sourceProductId: 'x', specs: { chipsetName: 'Snapdragon 8 Gen 3', battery: { capacityMah: 9999 }, display: { sizeInch: 6.3, refreshRateHz: 60, panel: 'AMOLED' } } })] }, ['alta']);
    const [v] = await one('SELECT battery, display FROM phone_variants');
    assert.equal(v.battery.capacityMah, 4500);
    assert.equal(v.display.refreshRateHz, 120);
    assert.equal(v.display.panel, 'AMOLED'); // gap filled
    assert.ok((await one("SELECT * FROM update_logs WHERE event='spec-conflict'")).length >= 1);
  });

  test('scores are stored, versioned and snapshotted', async () => {
    await ingest({ zoommer: [listing()] });
    const [v] = await one('SELECT scores FROM phone_variants');
    assert.ok(Number.isInteger(v.scores.values.gaming));
    assert.equal(v.scores.details.gaming.version, 1);
    assert.equal((await one('SELECT * FROM score_snapshots')).length, 1);
    await ingest({ zoommer: [listing()] });
    assert.equal((await one('SELECT * FROM score_snapshots')).length, 1); // unchanged => no new snapshot
  });

  test('live mode without a feed fails clearly instead of inventing data', async () => {
    const a = new StoreAdapter({ id: 'zoommer' }, { mode: 'live', env: {} });
    await assert.rejects(() => a.fetchListings(), AdapterNotConfiguredError);
  });
});

describe('spec catalog, photos and colours', () => {
  test('a bare listing (title/price/url only) gets its specs and scores from the catalog', async () => {
    await ingest({ zoommer: [{ sourceProductId: 'b1', url: 'https://shop.test/b1', title: 'Samsung Galaxy A55 A556B 5G 8/256GB Awesome Navy', price: 1299, available: true }] });
    const [v] = await one('SELECT model, chipset_id, battery, scores FROM phone_variants');
    assert.equal(v.model, 'Galaxy A55 5G'); // retailer model code A556B removed
    assert.equal(v.chipset_id, 'exynos-1480');
    assert.equal(v.battery.capacityMah, 5000);
    assert.ok(Number.isInteger(v.scores.values.battery));
  });
  test('a model that is not in the catalog is still stored — with unknown (null) scores, never invented ones', async () => {
    await ingest({ zoommer: [{ sourceProductId: 'n1', url: 'https://shop.test/n1', title: 'Samsung Galaxy S26 Ultra S948 5G 16/1TB Sky Blue', price: 4499, available: true }] });
    const [v] = await one('SELECT model, ram, storage, chipset_id, scores FROM phone_variants');
    assert.deepEqual([v.model, v.ram, v.storage, v.chipset_id], ['Galaxy S26 Ultra 5G', 16, 1024, null]);
    assert.equal(v.scores.values.battery, null);
    assert.equal(v.scores.values.ram, 100); // RAM/storage come from the title itself, so those scores exist
  });
  test('each store keeps ITS OWN photo, colour and exact product URL on the offer', async () => {
    const base = { title: 'Samsung Galaxy A55 5G 8/256GB', available: true };
    await ingest({
      zoommer: [{ ...base, sourceProductId: 'z', url: 'https://zoommer.ge/samsung-galaxy-a55-8-256-navy', imageUrl: 'https://cdn.zoommer.ge/a55-navy.jpg', color: 'Navy', price: 1299 }],
      alta: [{ ...base, sourceProductId: 'a', url: 'https://alta.ge/mobiles/samsung-galaxy-a55-p123', imageUrl: 'https://cdn.alta.ge/a55.png', title: 'Samsung Galaxy A55 5G 8+256GB Lilac', price: 1279 }],
    }, ['zoommer', 'alta']);
    const offers = Object.fromEntries((await one('SELECT store_id, url, image_url, color FROM store_offers')).map((o) => [o.store_id, o]));
    assert.equal((await one('SELECT * FROM phone_variants')).length, 1);
    assert.deepEqual(offers.zoommer, { store_id: 'zoommer', url: 'https://zoommer.ge/samsung-galaxy-a55-8-256-navy', image_url: 'https://cdn.zoommer.ge/a55-navy.jpg', color: 'Navy' });
    assert.equal(offers.alta.url, 'https://alta.ge/mobiles/samsung-galaxy-a55-p123');
    assert.equal(offers.alta.color, 'Lilac'); // colour read from the title when the feed has no colour field
  });
  test('an image URL that is not http(s) is rejected (quarantined)', async () => {
    const r = await ingest({ zoommer: [{ ...listing(), imageUrl: 'javascript:alert(1)' }] });
    assert.equal(r.stores[0].stats.quarantined, 1);
  });
});

describe('demo data for all stores', () => {
  test('seven differently-worded title styles converge on the SAME variants (one per catalog variant); only the 3 broken records are quarantined', async () => {
    const r = await runIngestion({ db, config, retry, adapterFactory: undefined });
    assert.equal(r.stores.length, 7);
    const expected = SPEC_CATALOG.reduce((n, m) => n + m.variants.length, 0);
    assert.ok(expected >= 90, `demo catalog has ${expected} variants`);
    assert.equal(Number((await one('SELECT count(*) AS n FROM phone_variants'))[0].n), expected);
    const quarantined = (await one("SELECT source_product_id FROM source_records WHERE status='quarantined'")).map((x) => x.source_product_id).sort();
    assert.deepEqual(quarantined, ['alta-broken-1', 'alta-unknown-brand', 'zoommer-broken-1']);
    assert.equal(Number((await one('SELECT count(*) AS n FROM phone_variants WHERE chipset_id IS NULL'))[0].n), 0);
  });
  test('every demo offer links to ITS store and to the exact phone + memory size, and has a colour', async () => {
    await runIngestion({ db, config, retry });
    const rows = await one("SELECT o.store_id, o.url, o.color, v.brand, v.model, v.storage FROM store_offers o JOIN phone_variants v ON v.id = o.phone_variant_id");
    assert.ok(rows.length > 100);
    const domains = { zoommer: 'zoommer.ge', alta: 'alta.ge', elit: 'eliteelectronics.ge', megatechnica: 'megatechnica.ge', istore: 'istore.com.ge', gstore: 'gstore.ge', xiaomi: 'mi.com' };
    for (const r of rows) {
      const q = decodeURIComponent(new URL(r.url).searchParams.get('q'));
      assert.ok(q.startsWith(`site:${domains[r.store_id]}`), `${r.store_id}: ${q}`);
      assert.ok(q.includes(r.model) && q.includes(`${r.storage}GB`), `${q} should name ${r.model} ${r.storage}GB`);
      assert.ok(r.color);
    }
  });
});

describe('polite HTTP + retries', () => {
  test('withRetry uses bounded exponential backoff', async () => {
    const delays = [];
    let calls = 0;
    const out = await withRetry(async () => { calls++; if (calls < 3) throw new Error('boom'); return 'ok'; }, { retries: 3, baseDelayMs: 100, sleep: async (ms) => delays.push(ms) });
    assert.equal(out, 'ok');
    assert.deepEqual(delays, [100, 200]);
    await assert.rejects(() => withRetry(async () => { throw new Error('always'); }, { retries: 2, sleep: async () => {} }), /always/);
  });

  test('fetcher caches responses, rate-limits per host and does not retry 4xx', async () => {
    let clock = 0;
    const sleeps = [];
    let hits = 0;
    const f = createPoliteFetcher({
      minIntervalMs: 1000, ttlMs: 60_000, now: () => clock, sleep: async (ms) => { sleeps.push(ms); clock += ms; },
      fetchImpl: async (url) => { hits++; return url.includes('gone') ? { ok: false, status: 404 } : { ok: true, json: async () => ({ n: hits }) }; },
    });
    assert.deepEqual(await f.getJson('https://h.test/a'), { n: 1 });
    assert.deepEqual(await f.getJson('https://h.test/a'), { n: 1 }); // cached
    assert.equal(hits, 1);
    await f.getJson('https://h.test/b');
    assert.equal(sleeps[0], 1000); // second request to same host had to wait
    await assert.rejects(() => f.getJson('https://h.test/gone'), /404/);
    assert.equal(hits, 3); // 404 not retried
  });

  test('scheduler never overlaps runs', async () => {
    let active = 0;
    let maxActive = 0;
    const s = startScheduler({ intervalMs: 1e9, logger: { warn() {}, error() {} }, run: async () => { active++; maxActive = Math.max(maxActive, active); await new Promise((r) => setTimeout(r, 30)); active--; } });
    await Promise.all([s.tick(), s.tick(), s.tick()]);
    s.stop();
    assert.equal(maxActive, 1);
  });
});
