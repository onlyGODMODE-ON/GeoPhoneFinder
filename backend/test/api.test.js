import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { loadConfig } from '../src/config.js';
import { createDb } from '../src/db/index.js';
import { runMigrations } from '../src/db/migrate.js';
import { runIngestion } from '../src/ingestion/pipeline.js';
import { buildApp } from '../src/app.js';

let db, app, catalog, config;

before(async () => {
  config = loadConfig({ ADMIN_TOKEN: 'secret', CATALOG_CACHE_SECONDS: '0', SITE_URL: 'https://phones.test' });
  db = await createDb({ databaseUrl: process.env.TEST_DATABASE_URL });
  if (db.kind === 'postgres') await db.exec('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  await runMigrations(db);
  ({ app, catalog } = await buildApp({ config, db }));
  await runIngestion({ db, config, retry: { retries: 0 } });
  catalog.invalidate();
});
after(async () => {
  await app.close();
  await db.close();
});

const get = async (url) => {
  const res = await app.inject({ method: 'GET', url });
  return { status: res.statusCode, body: res.headers['content-type']?.includes('json') ? res.json() : res.body, headers: res.headers };
};
const post = async (url, payload, headers) => {
  const res = await app.inject({ method: 'POST', url, payload, headers });
  return { status: res.statusCode, body: res.json() };
};

describe('GET /api/meta', () => {
  test('exposes wizard options, bounds and demo flag', async () => {
    const { status, body } = await get('/api/meta');
    assert.equal(status, 200);
    assert.deepEqual(body.brands.map((b) => b.name), ['Apple', 'Asus', 'Google', 'Honor', 'Huawei', 'Infinix', 'itel', 'Motorola', 'Nothing', 'OnePlus', 'Oppo', 'Realme', 'RedMagic', 'Samsung', 'Sony', 'Tecno', 'Vivo', 'Xiaomi']);
    assert.ok(body.phoneCount >= 90, `phoneCount ${body.phoneCount}`);
    assert.deepEqual(body.stores.map((x) => x.id).sort(), ['alta', 'elit', 'gstore', 'istore', 'megatechnica', 'xiaomi', 'zoommer']);
    assert.equal(body.priorities.length, 14);
    assert.equal(body.maxResults, 10);
    assert.equal(body.maxCompare, 3);
    assert.equal(body.demo, true);
    assert.ok(body.price.min < 500 && body.price.max > 4000, JSON.stringify(body.price));
  });
});

describe('POST /api/recommendations', () => {
  const scenario = { minPrice: 500, maxPrice: 1000, brands: ['Samsung', 'Xiaomi', 'Google'], storage: 256, stores: ['zoommer', 'alta'], priorities: ['gaming', 'camera', 'battery'] };

  test('PRD §32 scenario: only in-budget, allowed-brand, allowed-store phones', async () => {
    const { status, body } = await post('/api/recommendations', scenario);
    assert.equal(status, 200);
    assert.equal(body.criteria.allowedMax, 1050);
    assert.ok(body.results.length > 0 && body.results.length <= 10);
    for (const r of body.results) {
      assert.ok(r.primaryOffer.price >= 500 && r.primaryOffer.price <= 1050, `${r.phone.name} ${r.primaryOffer.price}`);
      assert.ok(['Samsung', 'Xiaomi', 'Google'].includes(r.phone.brand));
      assert.ok(['zoommer', 'alta'].includes(r.primaryOffer.storeId));
      assert.ok(r.match >= 0 && r.match <= 100);
    }
    const scores = body.results.map((r) => r.finalScore);
    assert.deepEqual(scores, [...scores].sort((a, b) => b - a));
    assert.equal(new Set(body.results.map((r) => r.phone.id)).size, body.results.length);
  });

  test('the cheapest CURRENT offer among selected stores is primary; stale/unavailable never are', async () => {
    const { body } = await post('/api/recommendations', { minPrice: 1290, maxPrice: 1300, stores: ['zoommer', 'alta'] });
    const a55 = body.results.find((r) => r.phone.slug === 'samsung-galaxy-a55-5g-8gb-256gb');
    // Alta's 1279 offer is stale (5 days old) on purpose => Zoommer's 1299 is primary
    assert.equal(a55.primaryOffer.storeId, 'zoommer');
    const stale = a55.offers.find((o) => o.storeId === 'alta');
    assert.equal(stale.state, 'stale');
    assert.equal(stale.eligible, false);
  });

  test('a store that stopped selling a phone => unavailable, excluded', async () => {
    const { body } = await post('/api/recommendations', { minPrice: 1250, maxPrice: 1300, stores: ['zoommer'] });
    assert.ok(!body.results.some((r) => r.phone.slug === 'xiaomi-poco-f6-12gb-512gb'));
  });

  test('price only (no priorities) => ranked by the overall score of ALL scores, not by price', async () => {
    const { body } = await post('/api/recommendations', { minPrice: 800, maxPrice: 1200 });
    assert.equal(body.rankedBy, 'overall');
    assert.ok(body.candidateCount > 10, `range holds ${body.candidateCount} phones`);
    assert.equal(body.results.length, 10);
    const scores = body.results.map((r) => r.finalScore);
    assert.deepEqual(scores, [...scores].sort((a, b) => b - a)); // best first
    for (const r of body.results) {
      assert.ok(r.primaryOffer.price >= 800 && r.primaryOffer.price <= 1260);
      assert.equal(r.match, Math.round(r.finalScore));
      assert.deepEqual(r.priorityScores, []);
    }
    // the Top 10 is NOT simply the 10 most expensive phones of the range
    const prices = body.results.map((r) => r.primaryOffer.price);
    assert.notDeepEqual(prices, [...prices].sort((a, b) => b - a));
  });
  test('with priorities the response says so', async () => {
    assert.equal((await post('/api/recommendations', { maxPrice: 1500, priorities: ['camera'] })).body.rankedBy, 'priorities');
  });

  test('no match => 200 with empty results', async () => {
    const { status, body } = await post('/api/recommendations', { minPrice: 10, maxPrice: 20 });
    assert.equal(status, 200);
    assert.deepEqual(body.results, []);
  });

  test('never more than 10 and rank is sequential', async () => {
    const { body } = await post('/api/recommendations', { maxPrice: 6000, priorities: ['camera'] });
    assert.equal(body.results.length, 10);
    assert.ok(body.candidateCount > 10);
    assert.deepEqual(body.results.map((r) => r.rank), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  test('phones with unknown data are ranked without inventing scores', async () => {
    const { body } = await post('/api/recommendations', { maxPrice: 6000, priorities: ['ram'], brands: ['Apple'] });
    for (const r of body.results) {
      assert.equal(r.priorityScores[0].score, null); // Apple does not publish RAM
      assert.deepEqual(r.missingPriorities, ['ram']);
      assert.equal(r.finalScore, null);
    }
  });

  test('bad input => 400 with details', async () => {
    assert.equal((await post('/api/recommendations', { maxPrice: 'abc' })).status, 400);
    assert.equal((await post('/api/recommendations', {})).status, 400);
    const r = await post('/api/recommendations', { maxPrice: 1000, priorities: ['telepathy'] });
    assert.equal(r.status, 400);
    assert.match(r.body.details[0], /telepathy/);
    assert.equal((await post('/api/recommendations', { maxPrice: 1000, stores: ['nope'] })).status, 400);
  });

  test('clients cannot change the 5% tolerance', async () => {
    const { body } = await post('/api/recommendations', { maxPrice: 1000, tolerance: 0.5, allowedMax: 5000 });
    assert.equal(body.criteria.allowedMax, 1050);
  });
});

describe('POST /api/recommendations — optional requirements', () => {
  test('minimums are hard filters and are echoed back', async () => {
    const { status, body } = await post('/api/recommendations', { maxPrice: 6000, requirements: { minRam: 12, vendors: ['Qualcomm'], minRefresh: 120 } });
    assert.equal(status, 200);
    assert.deepEqual(body.criteria.requirements, { minRam: 12, vendors: ['Qualcomm'], minRefresh: 120 });
    assert.ok(body.results.length > 0);
    for (const r of body.results) {
      assert.ok(r.phone.ram >= 12);
      assert.equal(r.phone.chipset.vendor, 'Qualcomm');
      assert.ok(r.phone.highlights.refreshRateHz >= 120);
    }
  });
  test('telephoto + water resistance + wireless charging', async () => {
    const { body } = await post('/api/recommendations', { maxPrice: 6000, requirements: { telephoto: true, waterResistant: true, wireless: true } });
    assert.ok(body.results.length > 0);
    for (const r of body.results) assert.equal(r.phone.chipset !== null, true);
    const detail = await Promise.all(body.results.map((r) => get(`/api/phones/${r.phone.slug}`)));
    for (const d of detail) {
      const sp = d.body.phone.specs;
      assert.equal(sp.cameras.telephoto.present, true);
      assert.match(sp.body.ipRating, /^IP6[7-9]|^IP68/);
      assert.ok(sp.battery.wirelessW > 0);
    }
  });
  test('an empty requirements object changes nothing', async () => {
    const a = await post('/api/recommendations', { maxPrice: 2500, priorities: ['camera'] });
    const b = await post('/api/recommendations', { maxPrice: 2500, priorities: ['camera'], requirements: {} });
    assert.deepEqual(a.body.results.map((r) => r.phone.id), b.body.results.map((r) => r.phone.id));
  });
  test('invalid requirement => 400', async () => {
    assert.equal((await post('/api/recommendations', { maxPrice: 1000, requirements: { minRam: 9999 } })).status, 400);
    assert.equal((await post('/api/recommendations', { maxPrice: 1000, requirements: { minChipsetTier: 'godlike' } })).status, 400);
  });
});

describe('battery score in the catalog (5000 mAh = 80)', () => {
  test('Galaxy A55 (5000 mAh / 25 W / no wireless) = 80; more capacity => more, less => less', async () => {
    const score = async (slug) => (await get(`/api/phones/${slug}`)).body.phone.scores.battery;
    assert.equal(await score('samsung-galaxy-a55-5g-8gb-256gb'), 80);
    assert.ok((await score('xiaomi-poco-x7-pro-5g-8gb-256gb')) > 80); // 6000 mAh
    assert.ok((await score('apple-iphone-15-128gb')) < 40); // 3349 mAh
    assert.ok((await score('samsung-galaxy-s24-8gb-256gb')) < 80); // 4000 mAh
  });
});

describe('server readiness (no more "reload until it works")', () => {
  test('while the first ingestion runs the API answers 503 + Retry-After and /health says not ready', async () => {
    const { app: warming } = await buildApp({ config, db, isReady: () => false });
    const meta = await warming.inject({ method: 'GET', url: '/api/meta' });
    assert.equal(meta.statusCode, 503);
    assert.equal(meta.headers['retry-after'], '2');
    assert.equal(meta.json().error, 'starting');
    assert.equal((await warming.inject({ method: 'POST', url: '/api/recommendations', payload: { maxPrice: 1000 } })).statusCode, 503);
    const health = await warming.inject({ method: 'GET', url: '/api/health' });
    assert.equal(health.statusCode, 200);
    assert.equal(health.json().ready, false);
    await warming.close();
  });
  test('ready => normal answers', async () => {
    assert.equal((await get('/api/health')).body.ready, true);
  });
});

describe('catalog cache is stale-while-revalidate', () => {
  test('an expired copy is returned instantly while it refreshes in the background', async () => {
    const { createCatalogService } = await import('../src/services/catalog-service.js');
    let loads = 0;
    const counting = { ...db, query: (sql, ...rest) => { if (String(sql).includes('FROM phone_variants')) loads += 1; return db.query(sql, ...rest); } };
    let now = new Date('2026-01-01T00:00:00Z');
    const svc = createCatalogService({ db: counting, config: { ...config, catalogCacheSeconds: 60 }, clock: () => now });
    const first = await svc.getSnapshot();
    assert.equal(loads, 1);
    assert.equal(await svc.getSnapshot(), first); // fresh: same object, no query
    assert.equal(loads, 1);
    now = new Date(now.getTime() + 120_000); // expired
    const stale = await svc.getSnapshot(); // does NOT wait for the database
    assert.equal(stale, first);
    await new Promise((r) => setTimeout(r, 300)); // background refresh finishes
    assert.equal(loads, 2);
    assert.notEqual(await svc.getSnapshot(), first);
  });
});

describe('search', () => {
  test('finds by brand, model and product name', async () => {
    assert.ok((await get('/api/phones?q=samsung')).body.items.every((i) => i.phone.brand === 'Samsung'));
    const s24 = (await get('/api/phones?q=galaxy%20s24')).body;
    assert.ok(s24.items.length > 4, 'loose matching also lists the other Galaxy phones');
    assert.ok(s24.items.slice(0, 4).every((i) => /S24/.test(i.phone.model)), 'but the S24 family comes first');
    assert.ok((await get('/api/phones?q=poco')).body.items.every((i) => i.phone.brand === 'Xiaomi'));
    assert.equal((await get('/api/phones?q=zzzzzz')).body.total, 0);
  });

  test('applies technical, price and store filters', async () => {
    const f = (await get('/api/phones?brand=Samsung&storage=256&minRefresh=120&maxPrice=1500&store=zoommer')).body;
    assert.ok(f.total > 0);
    for (const i of f.items) {
      assert.equal(i.phone.storage, 256);
      assert.ok(i.phone.highlights.refreshRateHz >= 120);
      assert.ok(i.primaryOffer.price <= 1500);
      assert.equal(i.primaryOffer.storeId, 'zoommer');
    }
    const g = (await get('/api/phones?processor=snapdragon&fiveG=true&wireless=true')).body;
    assert.ok(g.items.every((i) => /Snapdragon/.test(i.phone.chipset.name)));
  });

  test('sorts and paginates', async () => {
    const asc = (await get('/api/phones?sort=price-asc&pageSize=5')).body;
    assert.equal(asc.items.length, 5);
    const prices = asc.items.map((i) => i.primaryOffer.price);
    assert.deepEqual(prices, [...prices].sort((a, b) => a - b));
    const p2 = (await get('/api/phones?sort=price-asc&pageSize=5&page=2')).body;
    assert.equal(p2.page, 2);
    assert.notEqual(p2.items[0].phone.id, asc.items[0].phone.id);
  });

  test('live suggestions', async () => {
    const { body } = await get('/api/phones/suggest?q=pix');
    assert.ok(body.suggestions.includes('Google Pixel 9'));
  });
});

describe('product details', () => {
  test('works by slug and by id, exposes source + freshness + all offers', async () => {
    const bySlug = (await get('/api/phones/samsung-galaxy-s24-8gb-256gb')).body;
    assert.equal(bySlug.phone.name, 'Samsung Galaxy S24');
    assert.ok(bySlug.offers.length >= 4, 'sold by several stores');
    const current = bySlug.offers.filter((o) => o.eligible);
    assert.equal(bySlug.primaryOffer.price, Math.min(...current.map((o) => o.price)));
    assert.ok(bySlug.offers.every((o) => o.color && o.url.startsWith('https://')));
    assert.ok(bySlug.phone.lastUpdated && bySlug.phone.source && bySlug.phone.sourceUrl);
    assert.ok(bySlug.phone.scoreDetails.camera.groups);
    const byId = (await get(`/api/phones/${bySlug.phone.id}`)).body;
    assert.equal(byId.phone.slug, bySlug.phone.slug);
  });
  test('404 for unknown phones', async () => {
    assert.equal((await get('/api/phones/nope')).status, 404);
  });
  test('the chipset carries its real name, core layout and a GPU model name, for the processor question', async () => {
    const { body } = await get('/api/phones/samsung-galaxy-s24-8gb-256gb');
    const chip = body.phone.specs.chipset;
    assert.equal(chip.name, 'Exynos 2400');
    assert.match(chip.cores, /core/);
    assert.ok(typeof chip.gpu === 'string' && chip.gpu.length > 0, 'chipset.gpu must be a real GPU model name');
    assert.ok(Number.isInteger(chip.cpuScore) && chip.cpuScore >= 0 && chip.cpuScore <= 100);
    assert.ok(Number.isInteger(chip.gpuScore) && chip.gpuScore >= 0 && chip.gpuScore <= 100);
    assert.ok(['entry', 'mid', 'upper-mid', 'flagship'].includes(chip.performanceTier));
  });
});

describe('comparison', () => {
  test('returns up to 3 phones', async () => {
    const { status, body } = await get('/api/compare?ids=samsung-galaxy-s24-8gb-256gb,google-pixel-9-12gb-256gb,apple-iphone-16-256gb');
    assert.equal(status, 200);
    assert.equal(body.phones.length, 3);
  });
  test('rejects more than 3', async () => {
    const r = await get('/api/compare?ids=a,b,c,d');
    assert.equal(r.status, 400);
    assert.equal(r.body.error, 'too_many');
  });
  test('reports unknown ids without failing', async () => {
    const { body } = await get('/api/compare?ids=google-pixel-9-12gb-256gb,ghost');
    assert.equal(body.phones.length, 1);
    assert.deepEqual(body.missing, ['ghost']);
  });
});

describe('freshness, SEO and admin', () => {
  test('status shows per-store freshness incl. stale + unavailable offers', async () => {
    const { body } = await get('/api/status');
    const alta = body.stores.find((s) => s.id === 'alta');
    assert.ok(alta.offers.stale >= 1);
    assert.ok(body.stores.find((s) => s.id === 'zoommer').offers.unavailable >= 1);
    assert.ok(alta.lastIngestion.lastSuccessAt);
  });
  test('robots.txt and sitemap.xml', async () => {
    const robots = (await get('/robots.txt')).body;
    assert.match(robots, /Disallow: \/results/);
    assert.match(robots, /Sitemap: https:\/\/phones\.test\/sitemap\.xml/);
    const sitemap = (await get('/sitemap.xml')).body;
    assert.match(sitemap, /<loc>https:\/\/phones\.test\/phone\/samsung-galaxy-s24-8gb-256gb<\/loc>/);
  });
  test('admin ingest needs the token', async () => {
    assert.equal((await post('/api/admin/ingest', {})).status, 401);
    const ok = await post('/api/admin/ingest', {}, { 'x-admin-token': 'secret' });
    assert.equal(ok.status, 200);
    assert.equal(ok.body.stores.length, 7);
  });
});

describe('SPA shell + SEO (production build present)', () => {
  let shellApp;
  before(async () => {
    const cfg = loadConfig({ CATALOG_CACHE_SECONDS: '0', SITE_URL: 'https://phones.test', FRONTEND_DIST: new URL('./fixtures/spa-shell', import.meta.url).pathname });
    ({ app: shellApp } = await buildApp({ config: cfg, db }));
  });
  after(() => shellApp.close());
  const html = async (method, url) => shellApp.inject({ method, url });

  test('product page: unique title, ONE description, canonical, JSON-LD, crawlable text', async () => {
    const res = await html('GET', '/phone/samsung-galaxy-s24-8gb-256gb');
    assert.equal(res.statusCode, 200);
    const b = res.body;
    assert.match(b, /<title>Samsung Galaxy S24 8GB\/256GB — /);
    assert.equal((b.match(/<meta name="description"/g) ?? []).length, 1);
    assert.match(b, /<link rel="canonical" href="https:\/\/phones\.test\/phone\/samsung-galaxy-s24-8gb-256gb">/);
    const ld = JSON.parse(b.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)[1]);
    assert.equal(ld['@type'], 'Product');
    assert.equal(ld.offers.priceCurrency, 'GEL');
    assert.match(b, /<h1>Samsung Galaxy S24 8GB\/256GB<\/h1>/);
    assert.ok(!/noindex/.test(b));
  });
  test('canonical is the slug URL even when opened by UUID', async () => {
    const id = (await get('/api/phones/samsung-galaxy-s24-8gb-256gb')).body.phone.id;
    assert.match((await html('GET', `/phone/${id}`)).body, /canonical" href="https:\/\/phones\.test\/phone\/samsung-galaxy-s24-8gb-256gb"/);
  });
  test('unknown product => real 404 status', async () => {
    assert.equal((await html('GET', '/phone/nope')).statusCode, 404);
  });
  test('filter/result/compare pages are noindex; home is not', async () => {
    for (const u of ['/results?max=1000', '/search?brand=Samsung', '/compare']) assert.match((await html('GET', u)).body, /name="robots" content="noindex,follow"/, u);
    assert.ok(!/noindex/.test((await html('GET', '/')).body));
  });
  test('HEAD works for monitors/crawlers; unknown /api paths stay JSON 404', async () => {
    assert.equal((await html('HEAD', '/')).statusCode, 200);
    const r = await html('GET', '/api/nothing');
    assert.equal(r.statusCode, 404);
    assert.equal(r.json().error, 'not_found');
  });
  test('descriptions and titles are HTML-escaped (untrusted store data)', async () => {
    const { esc } = await import('../src/services/seo.js');
    assert.equal(esc('<img src=x onerror=alert(1)>"\''), '&lt;img src=x onerror=alert(1)&gt;&quot;&#39;');
  });
});
