import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateDefinition, computeScores, validateDefinition, buildScoringContext } from '../src/scoring/engine.js';
import { normalizeValue } from '../src/scoring/normalizers.js';
import { SCORE_DEFINITIONS } from '../src/scoring/definitions.js';
import { CHIPSETS } from '../src/scoring/chipsets.js';
import { specsFor, SPEC_CATALOG } from '../src/ingestion/spec-catalog.js';
import { batteryPoints, CAPACITY_CURVE } from '../src/scoring/derive.js';

describe('normalizers', () => {
  test('linear clamps to 0–100 and supports "lower is better"', () => {
    assert.equal(normalizeValue(5000, { type: 'linear', min: 3000, max: 7000 }).score, 50);
    assert.equal(normalizeValue(9000, { type: 'linear', min: 3000, max: 7000 }).score, 100);
    assert.equal(normalizeValue(160, { type: 'linear', min: 240, max: 160 }).score, 100);
    assert.equal(normalizeValue(1.4, { type: 'linear', min: 2.4, max: 1.4 }).score, 100);
  });
  test('log scale for memory', () => {
    assert.equal(Math.round(normalizeValue(8, { type: 'log', min: 4, max: 16 }).score), 50);
  });
  test('null / unmapped / invalid => null, NEVER 0', () => {
    assert.equal(normalizeValue(null, { type: 'linear', min: 0, max: 1 }).score, null);
    assert.equal(normalizeValue(undefined, { type: 'bool' }).score, null);
    assert.equal(normalizeValue('Gorilla Glass Victus 9', { type: 'map', values: { a: 1 } }).score, null);
    assert.equal(normalizeValue('x', { type: 'linear', min: 0, max: 1 }).score, null);
    assert.equal(normalizeValue(false, { type: 'bool' }).score, 0); // a KNOWN "no" is a real 0
  });
});

describe('score engine', () => {
  const def = {
    key: 't', version: 1,
    groups: [{ id: 'g', weight: 1, factors: [
      { id: 'a', weight: 0.5, path: 'a', normalize: { type: 'linear', min: 0, max: 10 } },
      { id: 'b', weight: 0.5, path: 'b', normalize: { type: 'linear', min: 0, max: 10 } },
    ] }],
  };
  test('weighted average of available factors', () => {
    assert.equal(evaluateDefinition(def, { a: 10, b: 0 }).score, 50);
  });
  test('missing factor is excluded and weights renormalised; recorded in `missing`', () => {
    const r = evaluateDefinition(def, { a: 8, b: null });
    assert.equal(r.score, 80);
    assert.deepEqual(r.missing, ['g.b']);
    assert.equal(r.coverage, 0.5);
  });
  test('nothing scorable => score null, not 0', () => {
    assert.equal(evaluateDefinition(def, {}).score, null);
  });
  test('groups with no data are skipped', () => {
    const d = { key: 'k', version: 1, groups: [
      { id: 'x', weight: 1, factors: [{ id: 'a', weight: 1, path: 'a', normalize: { type: 'linear', min: 0, max: 10 } }] },
      { id: 'y', weight: 1, factors: [{ id: 'b', weight: 1, path: 'b', normalize: { type: 'linear', min: 0, max: 10 } }] },
    ] };
    const r = evaluateDefinition(d, { a: 6 });
    assert.equal(r.score, 60);
    assert.equal(r.groups.y, null);
  });
  test('malformed definitions are rejected', () => {
    assert.throws(() => validateDefinition({ key: 'x', version: 1, groups: [{ id: 'g', weight: 1, factors: [{ id: 'f', weight: 1, path: 'p', normalize: { type: 'nope' } }] }] }));
    assert.throws(() => validateDefinition({ key: 'x', version: 1, groups: [{ id: 'g', weight: 1, factors: [{ id: 'f', weight: 1, derive: 'ghost', normalize: { type: 'bool' } }] }] }));
    SCORE_DEFINITIONS.forEach(validateDefinition); // shipped definitions are valid
  });
});

describe('shipped definitions', () => {
  const chipset = (id) => CHIPSETS.find((c) => c.id === id);
  const ctxFor = (modelSpecs, chipsetId, extra = {}) =>
    buildScoringContext({ ...modelSpecs, ...extra }, chipset(chipsetId), 8);

  test('generation score follows PRD §10.2: Gen 8 = 100, Gen 7 = 87.5, Gen 6 = 75', () => {
    const perf = SCORE_DEFINITIONS.find((d) => d.key === 'performance');
    const only = { ...perf, groups: [{ id: 'chipset', weight: 1, factors: perf.groups[0].factors.filter((f) => f.id === 'generation') }] };
    const scoreFor = (rank) => evaluateDefinition(only, { chipset: { generationRank: rank, totalGenerations: 8 } }).score;
    assert.equal(scoreFor(8), 100);
    assert.equal(scoreFor(7), 88); // 87.5 rounds to 88 in the stored integer score
    assert.equal(scoreFor(6), 75);
  });

  test('camera is NOT decided by megapixels alone (200 MP phone vs 50 MP flagship)', () => {
    const cam = SCORE_DEFINITIONS.find((d) => d.key === 'camera');
    const redmi = specsFor({ chipset: '', fiveG: true, d: [6, 1, 1, 60, 'AMOLED', 1000, 'none'], b: [4000, 20, 0], c: { main: { mp: 200, sensorSizeInch: 0.714, aperture: 1.65, ois: true }, ultrawide: { present: true, mp: 8 }, telephoto: { present: false }, opticalZoomMax: 1, front: { mp: 16, autofocus: false } }, v: ['4K', 30, null, '1080p'], n: [], a: [], body: [], sw: [] });
    const s24 = specsFor({ chipset: '', fiveG: true, d: [6, 1, 1, 60, 'AMOLED', 1000, 'none'], b: [4000, 20, 0], c: { main: { mp: 50, sensorSizeInch: 0.641, aperture: 1.8, ois: true }, ultrawide: { present: true, mp: 12 }, telephoto: { present: true, mp: 10, opticalZoom: 3 }, opticalZoomMax: 3, front: { mp: 12, autofocus: true } }, v: ['8K', 120, 'HDR10+', '4K'], n: [], a: [], body: [], sw: [] });
    assert.ok(evaluateDefinition(cam, { cameras: s24.cameras, video: s24.video }).score > evaluateDefinition(cam, { cameras: redmi.cameras, video: redmi.video }).score);
  });

  test('all 14 priorities produce a score for a fully specified flagship', () => {
    const m = specsFor({ chipset: 'x', fiveG: true, d: [6.2, 1080, 2340, 120, 'LTPO AMOLED', 2600, 'HDR10+'], b: [4000, 25, 15],
      c: { main: { mp: 50, sensorSizeInch: 0.641, aperture: 1.8, ois: true }, ultrawide: { present: true, mp: 12 }, telephoto: { present: true, mp: 10, opticalZoom: 3 }, opticalZoomMax: 3, front: { mp: 12, autofocus: true } },
      v: ['8K', 120, 'HDR10+', '4K'], n: ['Wi-Fi 7', 5.4, true, true, 'USB 3.2'], a: [true, true], body: [162, 7.2, 'IP68', 'Gorilla Glass Victus 2', 'Aluminum'], sw: ['Android 15', 7, 7] });
    const ctx = ctxFor({ ...m, ram: 12, storage: 256 }, 'snapdragon-8-elite-galaxy');
    const { values } = computeScores(ctx, SCORE_DEFINITIONS);
    assert.equal(Object.keys(values).length, 14);
    for (const [k, v] of Object.entries(values)) assert.ok(Number.isInteger(v) && v >= 0 && v <= 100, `${k}=${v}`);
  });

  test('unknown chipset => chipset-based scores drop factors instead of becoming 0', () => {
    const ctx = buildScoringContext({ display: { refreshRateHz: 120 } }, null, 8);
    const gaming = evaluateDefinition(SCORE_DEFINITIONS.find((d) => d.key === 'gaming'), ctx);
    assert.equal(gaming.score, 71); // only the refresh-rate factor is scorable
    assert.ok(gaming.missing.includes('gaming.gpu'));
    const perf = evaluateDefinition(SCORE_DEFINITIONS.find((d) => d.key === 'performance'), ctx);
    assert.equal(perf.score, null);
  });
});

describe('battery score: 5000 mAh = 80 (more = more, less = less)', () => {
  const pts = (capacityMah, wiredW = 25, wirelessW = 0) => batteryPoints({ capacityMah, wiredW, wirelessW });
  const batteryDef = SCORE_DEFINITIONS.find((d) => d.key === 'battery');

  test('the anchor: a 5000 mAh phone with normal (25 W) charging scores exactly 80', () => {
    assert.equal(pts(5000), 80);
    assert.equal(CAPACITY_CURVE.find(([mah]) => mah === 5000)[1], 80);
  });
  test('the curve: 4000 → 52, 4500 → 67, 5500 → 89, 6000 → 95', () => {
    assert.deepEqual([4000, 4500, 5500, 6000].map((c) => Math.round(pts(c))), [52, 67, 89, 95]);
  });
  test('strictly monotonic: more capacity always scores more, less always less', () => {
    let prev = -1;
    for (let mah = 2500; mah <= 6900; mah += 100) {
      const p = pts(mah);
      assert.ok(p > prev, `${mah} mAh: ${p} should beat ${prev}`);
      prev = p;
    }
    assert.ok(pts(4999) < 80 && pts(5001) > 80);
  });
  test('charging speed nudges the score; having no wireless charging never subtracts', () => {
    assert.equal(Math.round(pts(5000, 67)), 89);
    assert.equal(Math.round(pts(5000, 18)), 77);
    assert.equal(Math.round(pts(5000, 25, 15)), 83); // wireless adds
    assert.equal(pts(5000, 25, 0), pts(5000, 25, undefined)); // absent == unknown: same
    assert.ok(pts(5000, 120, 50) > pts(5000, 120, 0));
  });
  test('always within 0–100, and unknown capacity is unknown (null), never 0', () => {
    assert.equal(pts(9000, 120, 80), 100);
    assert.ok(pts(1500, 5) >= 0);
    assert.equal(batteryPoints({ wiredW: 30 }), null);
    assert.equal(batteryPoints(null), null);
  });
  test('the stored definition gives 80 to a typical 5000 mAh phone (endurance data missing => excluded)', () => {
    const r = evaluateDefinition(batteryDef, { battery: { capacityMah: 5000, wiredW: 25, wirelessW: 0 } });
    assert.equal(r.score, 80);
    assert.ok(r.missing.includes('battery.endurance'));
    assert.equal(batteryDef.version, 2); // formula changed => new version, history stays explainable
  });
  test('real catalog phones: Galaxy A55 (5000 mAh, 25 W) = 80, iPhone 15 (3349 mAh) far lower, Xiaomi 14 (90 W + 50 W wireless) higher', () => {
    const score = (m) => evaluateDefinition(batteryDef, { battery: specsFor(m).battery }).score;
    const models = Object.fromEntries(SPEC_CATALOG.map((m) => [m.key, m]));
    assert.equal(score(models['samsung-galaxy-a55']), 80);
    assert.ok(score(models['apple-iphone-15']) < 40);
    assert.ok(score(models['xiaomi-14']) > 80);
    assert.ok(score(models['xiaomi-poco-x7-pro-5g']) > score(models['samsung-galaxy-a55'])); // 6000 mAh
  });
});
