import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { recommend, weightedFinalScore, matchPercentage, priorityWeights, overallScore } from '../src/domain/recommend.js';
import { PRIORITY_KEYS } from '../src/domain/constants.js';
import { computeAllowedMax } from '../src/domain/constants.js';
import { CriteriaError } from '../src/domain/errors.js';
import { NOW, offer, phone, snapshot, hoursAgo } from './helpers.js';

const run = (snap, criteria, opts = {}) => recommend(snap, criteria, { now: NOW, ...opts });
const ids = (out) => out.results.map((r) => r.phone.id);

describe('budget tolerance (PRD §8.1)', () => {
  test('allowedMax = maxPrice × 1.05 exactly', () => {
    assert.equal(computeAllowedMax(1000), 1050);
    assert.equal(computeAllowedMax(999), 1048.95);
    assert.equal(computeAllowedMax(500), 525);
  });

  test('the tolerance is derived; a client-supplied one is ignored', () => {
    const out = run(snapshot([phone('a', { price: 1000 })]), { minPrice: 0, maxPrice: 1000, tolerance: 0.5, allowedMax: 9999 });
    assert.equal(out.criteria.allowedMax, 1050);
  });

  test('price hard filter: includes ≤ max×1.05, excludes above and below min', () => {
    const snap = snapshot([
      phone('below', { price: 499.99 }),
      phone('atMin', { price: 500 }),
      phone('atMax', { price: 1000 }),
      phone('atTolerance', { price: 1050 }),
      phone('overTolerance', { price: 1050.01 }),
    ]);
    const out = run(snap, { minPrice: 500, maxPrice: 1000 });
    assert.deepEqual(ids(out).sort(), ['atMax', 'atMin', 'atTolerance']);
    assert.ok(out.results.every((r) => r.primaryOffer.price <= 1050));
  });
});

describe('brand filter (PRD §8.2)', () => {
  const snap = snapshot([
    phone('s', { brand: 'Samsung', price: 800, scores: { gaming: 10 } }),
    phone('x', { brand: 'Xiaomi', price: 700, scores: { gaming: 50 } }),
    phone('a', { brand: 'Apple', price: 900, scores: { gaming: 99 } }),
  ]);

  test('no brands selected => all brands allowed', () => {
    assert.equal(run(snap, { maxPrice: 2000, brands: [] }).results.length, 3);
  });

  test('excluded brands never enter, however well they would score', () => {
    const out = run(snap, { maxPrice: 2000, brands: ['samsung', 'Xiaomi'], priorities: ['gaming'] });
    assert.deepEqual(ids(out), ['x', 's']);
  });
});

describe('store filter (PRD §8.4, §14)', () => {
  test('phone qualifies only with a current offer from a selected store', () => {
    const snap = snapshot([
      phone('onlyAlta', { offers: [offer('alta', 900)] }),
      phone('onlyZoommer', { offers: [offer('zoommer', 900)] }),
    ]);
    assert.deepEqual(ids(run(snap, { maxPrice: 1000, stores: ['alta'] })), ['onlyAlta']);
  });

  test('applicable price is the cheapest offer among SELECTED stores, not overall', () => {
    const snap = snapshot([phone('p', { offers: [offer('zoommer', 900), offer('alta', 1200)] })]);
    const all = run(snap, { minPrice: 0, maxPrice: 1000 });
    assert.equal(all.results[0].primaryOffer.storeId, 'zoommer');
    assert.equal(all.results[0].primaryOffer.price, 900);
    // Alta only => 1200 > 1050 => excluded
    assert.equal(run(snap, { maxPrice: 1000, stores: ['alta'] }).results.length, 0);
  });

  test('primary offer = cheapest current available; all offers are still returned', () => {
    const snap = snapshot([
      phone('p', { offers: [offer('zoommer', 2500), offer('alta', 2450), offer('xiaomi', 2590)] }),
    ]);
    const r = run(snap, { maxPrice: 3000 }).results[0];
    assert.equal(r.primaryOffer.storeId, 'alta');
    assert.equal(r.offers.length, 3);
    assert.equal(r.offers.filter((o) => o.isPrimary).length, 1);
  });

  test('unavailable and stale offers never drive a recommendation', () => {
    const snap = snapshot([
      phone('unavailable', { offers: [offer('zoommer', 500, { available: false })] }),
      phone('stale', { offers: [offer('zoommer', 500, { lastUpdated: hoursAgo(49) })] }),
      phone('fresh', { offers: [offer('zoommer', 500, { lastUpdated: hoursAgo(47) })] }),
      phone('fallback', { offers: [offer('zoommer', 400, { available: false }), offer('alta', 650)] }),
    ]);
    const out = run(snap, { maxPrice: 1000 });
    assert.deepEqual(ids(out).sort(), ['fallback', 'fresh']);
    assert.equal(out.results.find((r) => r.phone.id === 'fallback').primaryOffer.price, 650);
  });

  test('offers of inactive stores are ignored', () => {
    const stores = [
      { id: 'zoommer', name: 'Zoommer', baseUrl: '', active: false },
      { id: 'alta', name: 'Alta', baseUrl: '', active: true },
      { id: 'xiaomi', name: 'X', baseUrl: '', active: true },
    ];
    const snap = snapshot([phone('p', { offers: [offer('zoommer', 500)] })], { stores });
    assert.equal(run(snap, { maxPrice: 1000 }).results.length, 0);
  });
});

describe('ordering (PRD §9.3 – §9.6)', () => {
  test('no priorities and no scores at all => falls back to price DESC (nothing to rank by)', () => {
    const snap = snapshot([phone('cheap', { price: 600 }), phone('dear', { price: 900 }), phone('mid', { price: 750 })]);
    const out = run(snap, { maxPrice: 1000 });
    assert.deepEqual(ids(out), ['dear', 'mid', 'cheap']);
    assert.equal(out.results[0].finalScore, null);
    assert.equal(out.results[0].match, null);
  });

  test('FinalScore weights are N…1 and normalised (PRD example: 90/84/78 => 86)', () => {
    assert.deepEqual(priorityWeights(3), [3, 2, 1]);
    assert.equal(weightedFinalScore([90, 84, 78]), 86);
    assert.equal(weightedFinalScore([100, 100, 100, 100]), 100);
    assert.equal(weightedFinalScore([0, 0]), 0);
    assert.equal(matchPercentage(86), 86);
    assert.equal(matchPercentage(85.5), 86);
  });

  test('PRD §32 example: Gaming×3 + Camera×2 + Battery×1', () => {
    const snap = snapshot([phone('p', { price: 800, scores: { gaming: 90, camera: 84, battery: 78 } })]);
    const r = run(snap, { minPrice: 500, maxPrice: 1000, priorities: ['gaming', 'camera', 'battery'] }).results[0];
    assert.equal(r.finalScore, 86);
    assert.equal(r.match, 86);
  });

  test('results sort by FinalScore desc', () => {
    const snap = snapshot([
      phone('low', { price: 900, scores: { gaming: 50 } }),
      phone('high', { price: 600, scores: { gaming: 95 } }),
    ]);
    assert.deepEqual(ids(run(snap, { maxPrice: 1000, priorities: ['gaming'] })), ['high', 'low']);
  });

  test('priority order matters: swapping priorities changes the winner', () => {
    const snap = snapshot([
      phone('gamer', { price: 800, scores: { gaming: 95, camera: 40 } }),
      phone('shooter', { price: 800, scores: { gaming: 40, camera: 95 } }),
    ]);
    assert.equal(ids(run(snap, { maxPrice: 1000, priorities: ['gaming', 'camera'] }))[0], 'gamer');
    assert.equal(ids(run(snap, { maxPrice: 1000, priorities: ['camera', 'gaming'] }))[0], 'shooter');
  });

  test('equal FinalScore is broken lexicographically by priority #1, then #2 …', () => {
    // priorities [gaming, camera]: weights 2,1. A: (90*2+30)/3 = 70 ; B: (80*2+50)/3 = 70
    const snap = snapshot([
      phone('B', { price: 900, scores: { gaming: 80, camera: 50 } }),
      phone('A', { price: 700, scores: { gaming: 90, camera: 30 } }),
    ]);
    const out = run(snap, { maxPrice: 1000, priorities: ['gaming', 'camera'] });
    assert.equal(out.results[0].finalScore, out.results[1].finalScore);
    assert.deepEqual(ids(out), ['A', 'B']); // A has the higher priority-#1 score despite the lower price
  });

  test('complete tie preserves candidate-array order (price DESC)', () => {
    const snap = snapshot([
      phone('cheap', { price: 600, scores: { gaming: 70, camera: 70 } }),
      phone('dear', { price: 950, scores: { gaming: 70, camera: 70 } }),
      phone('mid', { price: 800, scores: { gaming: 70, camera: 70 } }),
    ]);
    assert.deepEqual(ids(run(snap, { maxPrice: 1000, priorities: ['gaming', 'camera'] })), ['dear', 'mid', 'cheap']);
  });

  test('missing score is EXCLUDED from FinalScore (not zero) and never invented', () => {
    assert.equal(weightedFinalScore([80, null, 60]), (80 * 3 + 60 * 1) / 4);
    assert.equal(weightedFinalScore([null, null]), null);
    const snap = snapshot([
      phone('known', { price: 800, scores: { gaming: 60, camera: 60 } }),
      phone('partial', { price: 800, scores: { gaming: 60, camera: null } }),
    ]);
    const out = run(snap, { maxPrice: 1000, priorities: ['gaming', 'camera'] });
    const partial = out.results.find((r) => r.phone.id === 'partial');
    assert.equal(partial.finalScore, 60);
    assert.deepEqual(partial.missingPriorities, ['camera']);
    // equal FinalScore, but the phone with complete data wins the lexicographic tie-break
    assert.equal(out.results[0].phone.id, 'known');
  });
});

describe('result set (PRD §9.1, rule 14)', () => {
  test('at most 10 results; fewer matches => actual number; no duplicates', () => {
    const many = Array.from({ length: 15 }, (_, i) => phone(`p${i}`, { price: 500 + i * 10, scores: { gaming: i } }));
    const out = run(snapshot(many), { maxPrice: 1000, priorities: ['gaming'] });
    assert.equal(out.results.length, 10);
    assert.equal(out.candidateCount, 15);
    assert.equal(new Set(ids(out)).size, 10);
    assert.deepEqual(out.results.map((r) => r.rank), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);

    const few = run(snapshot(many.slice(0, 3)), { maxPrice: 1000 });
    assert.equal(few.results.length, 3);
  });

  test('no match => empty results, not an error', () => {
    const out = run(snapshot([phone('a', { price: 5000 })]), { maxPrice: 1000 });
    assert.deepEqual(out.results, []);
    assert.equal(out.candidateCount, 0);
  });

  test('deterministic: identical input gives identical output', () => {
    const snap = snapshot(
      Array.from({ length: 12 }, (_, i) => phone(`p${i}`, { price: 600 + (i % 4) * 50, scores: { gaming: i % 3, camera: i % 5 } })),
    );
    const c = { maxPrice: 1000, priorities: ['gaming', 'camera'] };
    assert.deepEqual(run(snap, c), run(snap, c));
  });

  test('candidate array is filtered ONCE: priorities never widen the set', () => {
    const snap = snapshot([
      phone('in', { price: 800, scores: { gaming: 10 } }),
      phone('out', { price: 2000, scores: { gaming: 100 } }),
    ]);
    assert.deepEqual(ids(run(snap, { maxPrice: 1000, priorities: ['gaming'] })), ['in']);
  });
});

describe('storage target (PRD §8.3)', () => {
  const snap = snapshot([
    phone('s128', { price: 900, storage: 128, scores: { gaming: 80 } }),
    phone('s256', { price: 800, storage: 256, scores: { gaming: 70 } }),
    phone('s1024', { price: 700, storage: 1024, scores: { gaming: 60 } }),
  ]);

  test('annotates exact / nearby / other but never overrides priorities or reorders', () => {
    const withTarget = run(snap, { maxPrice: 1000, storage: 256, priorities: ['gaming'] });
    const without = run(snap, { maxPrice: 1000, priorities: ['gaming'] });
    assert.deepEqual(ids(withTarget), ids(without));
    const fit = Object.fromEntries(withTarget.results.map((r) => [r.phone.id, r.storageFit.status]));
    assert.deepEqual(fit, { s128: 'nearby', s256: 'exact', s1024: 'other' });
    assert.deepEqual(withTarget.storageSummary, { target: 256, exact: 1, nearby: 1, other: 1, unknown: 0 });
  });

  test('storage is never a hard filter', () => {
    assert.equal(run(snap, { maxPrice: 1000, storage: 512 }).results.length, 3);
  });
});

describe('criteria validation', () => {
  const snap = snapshot([phone('a', { price: 800 })]);
  test('rejects bad budgets, unknown stores and unknown priorities', () => {
    assert.throws(() => run(snap, { minPrice: 900, maxPrice: 500 }), CriteriaError);
    assert.throws(() => run(snap, { maxPrice: 'abc' }), CriteriaError);
    assert.throws(() => run(snap, { maxPrice: 1000, stores: ['nope'] }), CriteriaError);
    assert.throws(() => run(snap, { maxPrice: 1000, priorities: ['telepathy'] }), CriteriaError);
  });

  test('priorities are de-duplicated and keep their order', () => {
    const out = run(snap, { maxPrice: 1000, priorities: ['camera', 'gaming', 'camera'] });
    assert.deepEqual(out.criteria.priorities, ['camera', 'gaming']);
  });

  test('all stores selected explicitly == no store restriction', () => {
    const s = snapshot([phone('a', { offers: [offer('xiaomi', 800)] })]);
    const all = run(s, { maxPrice: 1000, stores: ['zoommer', 'alta', 'xiaomi'] });
    assert.equal(all.storeRestricted, false);
    assert.equal(all.results.length, 1);
  });
});

describe('optional technical requirements (minimums for knowledgeable users)', () => {
  const chip = (vendor, tier) => ({ id: vendor, name: `${vendor} ${tier}`, vendor, performanceTier: tier });
  const snap = snapshot([
    phone('full', { price: 900, ram: 12, storage: 512, battery: { capacityMah: 5000, wirelessW: 15 }, display: { refreshRateHz: 120, panel: 'LTPO AMOLED' }, chipset: chip('Qualcomm', 'flagship'), cameras: { main: { ois: true }, telephoto: { present: true } }, connectivity: { fiveG: true, nfc: true, esim: true }, body: { ipRating: 'IP68' }, scores: { camera: 80 } }),
    phone('mid', { price: 700, ram: 8, storage: 128, battery: { capacityMah: 4500, wirelessW: 0 }, display: { refreshRateHz: 90, panel: 'IPS LCD' }, chipset: chip('MediaTek', 'mid'), cameras: { main: { ois: false }, telephoto: { present: false } }, connectivity: { fiveG: false, nfc: false }, body: { ipRating: 'IP54' }, scores: { camera: 50 } }),
    phone('unknown', { price: 800, ram: null, storage: null }), // nothing is known about this one
  ]);
  const ids = (c) => run(snap, { maxPrice: 2000, ...c }).results.map((r) => r.phone.id).sort();

  test('no requirements => nothing is filtered', () => {
    assert.deepEqual(ids({}), ['full', 'mid', 'unknown']);
    assert.deepEqual(ids({ requirements: { minRam: null, oled: false, vendors: [] } }), ['full', 'mid', 'unknown']);
  });
  test('numeric minimums', () => {
    assert.deepEqual(ids({ requirements: { minRam: 8 } }), ['full', 'mid']);
    assert.deepEqual(ids({ requirements: { minRam: 12 } }), ['full']);
    assert.deepEqual(ids({ requirements: { minStorage: 256 } }), ['full']);
    assert.deepEqual(ids({ requirements: { minBattery: 4800 } }), ['full']);
    assert.deepEqual(ids({ requirements: { minRefresh: 120 } }), ['full']);
    assert.deepEqual(ids({ requirements: { minCameraScore: 70 } }), ['full']);
  });
  test('processor vendor and minimum tier', () => {
    assert.deepEqual(ids({ requirements: { vendors: ['qualcomm'] } }), ['full']);
    assert.deepEqual(ids({ requirements: { vendors: ['Qualcomm', 'MediaTek'] } }), ['full', 'mid']);
    assert.deepEqual(ids({ requirements: { minChipsetTier: 'upper-mid' } }), ['full']);
    assert.deepEqual(ids({ requirements: { minChipsetTier: 'mid' } }), ['full', 'mid']);
  });
  test('feature flags', () => {
    for (const flag of ['telephoto', 'ois', 'oled', 'fiveG', 'nfc', 'esim', 'wireless', 'waterResistant']) {
      assert.deepEqual(ids({ requirements: { [flag]: true } }), ['full'], flag);
    }
  });
  test('a requirement on an UNKNOWN value never matches (no assumptions)', () => {
    assert.ok(!ids({ requirements: { minRam: 1 } }).includes('unknown'));
    assert.ok(!ids({ requirements: { fiveG: true } }).includes('unknown'));
  });
  test('requirements combine with priorities without widening the candidate set', () => {
    const out = run(snap, { maxPrice: 2000, priorities: ['camera'], requirements: { minRam: 8 } });
    assert.deepEqual(out.results.map((r) => r.phone.id), ['full', 'mid']);
    assert.equal(out.candidateCount, 2);
    assert.deepEqual(out.criteria.requirements, { minRam: 8 });
  });
  test('invalid requirements are rejected', () => {
    assert.throws(() => run(snap, { maxPrice: 1000, requirements: { minRam: 9999 } }), CriteriaError);
    assert.throws(() => run(snap, { maxPrice: 1000, requirements: { minChipsetTier: 'godlike' } }), CriteriaError);
  });
});

describe('price-only search (no priorities): the phones in the range are ranked by ALL their scores', () => {
  const all = (v) => Object.fromEntries(PRIORITY_KEYS.map((k) => [k, v]));

  test('overall score = the average of the known component scores (sum ÷ count)', () => {
    assert.equal(overallScore({ gaming: 90, camera: 60 }), 75);
    assert.equal(overallScore(all(80)), 80);
    assert.equal(overallScore({ gaming: 90, camera: null }), 90); // unknown is skipped, not counted as 0
    assert.equal(overallScore({}), null);
    assert.equal(overallScore({ gaming: null }), null);
  });

  test('ranked by overall score — NOT by price', () => {
    const snap = snapshot([
      phone('dearMeh', { price: 950, scores: all(50) }),
      phone('cheapGood', { price: 600, scores: all(90) }),
      phone('midOk', { price: 800, scores: all(70) }),
    ]);
    const out = run(snap, { minPrice: 500, maxPrice: 1000 });
    assert.equal(out.rankedBy, 'overall');
    assert.deepEqual(ids(out), ['cheapGood', 'midOk', 'dearMeh']);
    assert.deepEqual(out.results.map((r) => r.finalScore), [90, 70, 50]);
    assert.deepEqual(out.results.map((r) => r.match), [90, 70, 50]);
    assert.deepEqual(out.results.map((r) => r.rank), [1, 2, 3]);
  });

  test('the price range still decides WHICH phones are considered', () => {
    const snap = snapshot([phone('inRange', { price: 800, scores: all(40) }), phone('tooDear', { price: 2000, scores: all(100) }), phone('tooCheap', { price: 100, scores: all(100) })]);
    assert.deepEqual(ids(run(snap, { minPrice: 500, maxPrice: 1000 })), ['inRange']);
  });

  test('a phone with an unknown score is not punished as if it were 0', () => {
    const partial = { gaming: 80, camera: 80 }; // 12 other scores unknown
    const snap = snapshot([phone('complete', { price: 700, scores: all(75) }), phone('partial', { price: 700, scores: partial })]);
    assert.deepEqual(ids(run(snap, { maxPrice: 1000 })), ['partial', 'complete']); // 80 > 75
  });

  test('equal overall scores keep the price-DESC order; phones with no scores go last', () => {
    const snap = snapshot([
      phone('noScores', { price: 990 }),
      phone('cheap', { price: 600, scores: all(70) }),
      phone('dear', { price: 900, scores: all(70) }),
    ]);
    assert.deepEqual(ids(run(snap, { maxPrice: 1000 })), ['dear', 'cheap', 'noScores']);
    assert.equal(run(snap, { maxPrice: 1000 }).results[2].finalScore, null);
  });

  test('Top 10 = the 10 best-scoring phones of the range, not the 10 most expensive', () => {
    const many = Array.from({ length: 15 }, (_, i) => phone(`p${i}`, { price: 500 + i * 10, scores: all(i === 0 ? 99 : 40 + i) })); // p0 is the cheapest AND the best
    const out = run(snapshot(many), { maxPrice: 1000 });
    assert.equal(out.results.length, 10);
    assert.equal(out.results[0].phone.id, 'p0');
    assert.ok(!ids(out).includes('p1'), 'the weakest phone (p1, score 41) drops out of the Top 10');
    const scores = out.results.map((r) => r.finalScore);
    assert.deepEqual(scores, [...scores].sort((a, b) => b - a));
  });

  test('with priorities the ranking is still the weighted priority score', () => {
    const snap = snapshot([phone('a', { price: 700, scores: { gaming: 90 } })]);
    assert.equal(run(snap, { maxPrice: 1000, priorities: ['gaming'] }).rankedBy, 'priorities');
  });
});
