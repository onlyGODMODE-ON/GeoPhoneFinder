import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import ka from '../src/i18n/ka.js';
import en from '../src/i18n/en.js';
import { translate } from '../src/i18n/index.jsx';
import { PRIORITY_KEYS } from '../src/lib/priorities.js';
import { SPEC_GROUPS, SPEC_ROWS, bestIndexes, specCell } from '../src/lib/specs.js';
import { CAMERA_LEVELS, DEFAULT_CRITERIA, REQ_FLAGS, REQ_TIERS, decodeCriteria, encodeCriteria, hasRequirements, toRequest, wizardReducer } from '../src/state/criteria.js';
import { requirementLabels } from '../src/lib/requirements.js';
import { colorFromName } from '../src/lib/color.js';
import { toQuery } from '../src/api/client.js';

describe('i18n', () => {
  test('Georgian and English have exactly the same keys', () => {
    expect(Object.keys(ka).sort()).toEqual(Object.keys(en).sort());
  });
  test('no empty strings and placeholders match between languages', () => {
    for (const k of Object.keys(en)) {
      expect(ka[k], k).toBeTruthy();
      const ph = (s) => (s.match(/\{\w+\}/g) ?? []).sort().join();
      expect(ph(ka[k]), `placeholders of ${k}`).toBe(ph(en[k]));
    }
  });
  test('every dynamically built key exists', () => {
    const keys = [
      ...PRIORITY_KEYS.flatMap((k) => [`priority.${k}`, `priorityHint.${k}`]),
      ...SPEC_ROWS.map((r) => `spec.${r.key}`),
      ...SPEC_GROUPS.map((g) => `specGroup.${g}`),
      ...['exact', 'nearby', 'other', 'unknown'].map((s) => `storageFit.${s}`),
      ...['budget', 'brands', 'stores', 'priorities', 'review'].map((s) => `${s}.title`),
      'adv.title',
      ...['budget', 'brands', 'stores', 'priorities', 'details', 'review'].map((s) => `wizard.step.${s}`),
      ...REQ_FLAGS.map((f) => `adv.${f}`),
      ...REQ_TIERS.map((k) => `adv.tier.${k}`),
      ...CAMERA_LEVELS.map((l) => `adv.level.${l.key}`),
      ...['minRam', 'minStorage', 'minBattery', 'minRefresh', 'minCameraScore', 'vendors', 'minChipsetTier'].map((k) => `reqChip.${k}`),
      ...['relevance', 'price-asc', 'price-desc', 'name'].map((s) => `search.sort.${s}`),
      'search.fiveG', 'search.nfc', 'search.wireless',
    ];
    for (const k of keys) expect(en[k], k).toBeTruthy();
  });
  test('interpolation', () => {
    expect(translate('en', 'card.rank', { n: 3 })).toBe('Rank 3');
    expect(translate('ka', 'card.matchValue', { n: 59 })).toContain('59');
    expect(translate('en', 'no.such.key')).toBe('no.such.key');
  });
  test('the frontend priority list matches the 14 required priorities', () => {
    expect(PRIORITY_KEYS).toHaveLength(14);
  });
});

describe('wizard reducer', () => {
  const ALL = ['zoommer', 'alta', 'xiaomi'];
  const reduce = (s, a) => wizardReducer(s, a);

  test('defaults: all stores (null), all brands ([]), no extra requirements', () => {
    expect(DEFAULT_CRITERIA.stores).toBeNull();
    expect(DEFAULT_CRITERIA.brands).toEqual([]);
    expect(DEFAULT_CRITERIA.requirements).toEqual({});
    expect(hasRequirements(DEFAULT_CRITERIA.requirements)).toBe(false);
  });
  test('budget handles inverted handles', () => {
    expect(reduce(DEFAULT_CRITERIA, { type: 'setBudget', min: 900, max: 400 })).toMatchObject({ minPrice: 400, maxPrice: 900 });
  });
  test('deselecting a store restricts; re-selecting all returns to "no restriction"', () => {
    let s = reduce(DEFAULT_CRITERIA, { type: 'toggleStore', id: 'xiaomi', allIds: ALL });
    expect(s.stores).toEqual(['zoommer', 'alta']);
    s = reduce(s, { type: 'toggleStore', id: 'xiaomi', allIds: ALL });
    expect(s.stores).toBeNull();
  });
  test('the last selected store cannot be removed', () => {
    const s = { ...DEFAULT_CRITERIA, stores: ['alta'] };
    expect(reduce(s, { type: 'toggleStore', id: 'alta', allIds: ALL }).stores).toEqual(['alta']);
  });
  test('priorities: add, no duplicates, reorder, remove', () => {
    let s = reduce(DEFAULT_CRITERIA, { type: 'addPriority', key: 'gaming' });
    s = reduce(s, { type: 'addPriority', key: 'camera' });
    s = reduce(s, { type: 'addPriority', key: 'camera' });
    s = reduce(s, { type: 'addPriority', key: 'battery' });
    expect(s.priorities).toEqual(['gaming', 'camera', 'battery']);
    s = reduce(s, { type: 'movePriority', key: 'battery', dir: -1 });
    expect(s.priorities).toEqual(['gaming', 'battery', 'camera']);
    s = reduce(s, { type: 'movePriority', key: 'gaming', dir: -1 }); // already first: no-op
    expect(s.priorities).toEqual(['gaming', 'battery', 'camera']);
    expect(reduce(s, { type: 'removePriority', key: 'battery' }).priorities).toEqual(['gaming', 'camera']);
  });
});

describe('criteria <-> URL', () => {
  test('round trip keeps everything, including priority ORDER', () => {
    const c = { minPrice: 500, maxPrice: 1000, brands: ['Samsung', 'Xiaomi'], storage: 256, stores: ['zoommer', 'alta'], priorities: ['camera', 'gaming', 'battery'], requirements: {} };
    expect(decodeCriteria(encodeCriteria(c))).toEqual(c);
  });
  test('"all stores" is not written to the URL', () => {
    expect(encodeCriteria({ ...DEFAULT_CRITERIA }).has('store')).toBe(false);
    expect(decodeCriteria(new URLSearchParams('max=900')).stores).toBeNull();
  });
  test('garbage input falls back to safe defaults', () => {
    const c = decodeCriteria(new URLSearchParams('min=abc&max=-5&storage=zzz'));
    expect(c.minPrice).toBe(DEFAULT_CRITERIA.minPrice);
    expect(c.maxPrice).toBe(DEFAULT_CRITERIA.maxPrice);
    expect(c.storage).toBeNull();
  });
  test('request payload never contains a tolerance', () => {
    const r = toRequest({ ...DEFAULT_CRITERIA });
    expect(Object.keys(r).sort()).toEqual(['brands', 'maxPrice', 'minPrice', 'priorities', 'requirements', 'storage', 'stores']);
    expect(r.requirements).toEqual({});
    expect(r.stores).toEqual([]);
  });
});

describe('optional requirements', () => {
  const reduce = (s, a) => wizardReducer(s, a);
  test('set / clear a requirement; empty values remove it', () => {
    let s = reduce(DEFAULT_CRITERIA, { type: 'setRequirement', key: 'minRam', value: 8 });
    s = reduce(s, { type: 'setRequirement', key: 'fiveG', value: true });
    expect(s.requirements).toEqual({ minRam: 8, fiveG: true });
    s = reduce(s, { type: 'setRequirement', key: 'fiveG', value: false });
    s = reduce(s, { type: 'setRequirement', key: 'minRam', value: null });
    expect(s.requirements).toEqual({});
    expect(hasRequirements(s.requirements)).toBe(false);
  });
  test('vendors toggle on/off and disappear when empty', () => {
    let s = reduce(DEFAULT_CRITERIA, { type: 'toggleVendor', name: 'Qualcomm' });
    s = reduce(s, { type: 'toggleVendor', name: 'Apple' });
    expect(s.requirements.vendors).toEqual(['Qualcomm', 'Apple']);
    s = reduce(reduce(s, { type: 'toggleVendor', name: 'Qualcomm' }), { type: 'toggleVendor', name: 'Apple' });
    expect(s.requirements).toEqual({});
  });
  test('URL round trip keeps every requirement; garbage is ignored', () => {
    const c = { ...DEFAULT_CRITERIA, requirements: { minRam: 12, minStorage: 256, vendors: ['Qualcomm', 'Apple'], minChipsetTier: 'upper-mid', minCameraScore: 60, minRefresh: 120, minBattery: 5000, telephoto: true, oled: true, waterResistant: true } };
    expect(decodeCriteria(encodeCriteria(c)).requirements).toEqual(c.requirements);
    const bad = decodeCriteria(new URLSearchParams('r.minRam=9999&r.tier=godlike&r.flag=hackme&r.flag=nfc'));
    expect(bad.requirements).toEqual({ nfc: true });
  });
  test('request carries only real requirements', () => {
    expect(toRequest({ ...DEFAULT_CRITERIA, requirements: { minRam: 8, oled: false, vendors: [] } }).requirements).toEqual({ minRam: 8 });
  });
  test('labels are human readable', () => {
    const t = (k, v) => `${k}${v ? JSON.stringify(v) : ''}`;
    expect(requirementLabels({ minRam: 8, fiveG: true }, t)).toEqual(['reqChip.minRam{"n":8}', 'adv.fiveG']);
    expect(requirementLabels({}, t)).toEqual([]);
  });
  test('reset clears requirements too', () => {
    const s = reduce({ ...DEFAULT_CRITERIA, requirements: { minRam: 8 }, brands: ['Samsung'] }, { type: 'reset' });
    expect(s.requirements).toEqual({});
    expect(s.brands).toEqual([]);
  });
});

describe('colours', () => {
  test('store colour names map to distinct, sensible hues', () => {
    const hue = (n) => colorFromName(n)[0];
    expect(colorFromName('Onyx Black')[2]).toBeLessThan(25); // dark
    expect(colorFromName('Porcelain')[2]).toBeGreaterThan(80); // light
    expect(hue('Awesome Lilac')).toBeGreaterThan(250);
    expect(Math.abs(hue('Sky Blue') - hue('Navy'))).toBeGreaterThan(10);
    expect(colorFromName('Wintergreen')[0]).toBeGreaterThan(100);
  });
  test('unknown / missing colour falls back to a stable hue', () => {
    expect(colorFromName(null, 'Samsung Galaxy S24')).toEqual(colorFromName(undefined, 'Samsung Galaxy S24'));
  });
});

describe('comparison helpers', () => {
  test('best value: higher / lower, ties, unknowns', () => {
    expect(bestIndexes([4000, 5000, 4500], 'higher')).toEqual([1]);
    expect(bestIndexes([187, 165, 190], 'lower')).toEqual([1]);
    expect(bestIndexes([5000, 5000, 4000], 'higher')).toEqual([0, 1]);
    expect(bestIndexes([5000, 5000], 'higher')).toEqual([]); // all equal => no "best"
    expect(bestIndexes([null, 4000], 'higher')).toEqual([]); // need 2 known values
    expect(bestIndexes(['a', 'b'], undefined)).toEqual([]);
  });
  test('unknown spec is null, never 0', () => {
    const row = SPEC_ROWS.find((r) => r.key === 'battery');
    expect(specCell(row, { specs: { battery: {} } }, (k) => k)).toEqual({ text: null, value: null });
    expect(specCell(row, { specs: { battery: { capacityMah: 5000 } } }, (k) => k).text).toBe('5000 mAh');
  });
});

describe('api client', () => {
  test('toQuery repeats array keys and skips empty values', () => {
    expect(toQuery({ q: 'galaxy', brand: ['Samsung', 'Xiaomi'], minPrice: '', fiveG: true, nfc: false })).toBe('?q=galaxy&brand=Samsung&brand=Xiaomi&fiveG=true');
    expect(toQuery({})).toBe('');
  });
});

describe('rank badge stays visible (regression: numbers were hidden behind the phone photo)', () => {
  const css = readFileSync(new URL('../src/styles/components.css', import.meta.url), 'utf8');
  const rule = (selector) => css.match(new RegExp(`(?:^|\\n)${selector.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&')} \\{([^}]*)\\}`))?.[1] ?? '';

  test('the badge has an explicit z-index above the illustration', () => {
    const z = (r) => Number(/z-index:\s*(\d+)/.exec(r)?.[1] ?? 0);
    expect(z(rule('.rank'))).toBeGreaterThan(z(rule('.phone-illustration')));
  });
  test('the badge is in the top-left corner of the photo box and does NOT push the photo down', () => {
    expect(rule('.rank')).toMatch(/top:\s*0/);
    expect(rule('.rank')).toMatch(/left:\s*0/);
    expect(rule('.rank')).toMatch(/position:\s*absolute/); // out of the flow => the photo keeps its place
    expect(css).not.toMatch(/phone-card__media--ranked/);
    expect(rule('.phone-card__media')).not.toMatch(/padding-top/);
  });
  test('the media box is its own stacking context', () => {
    expect(rule('.phone-card__media')).toMatch(/isolation:\s*isolate/);
  });
});
