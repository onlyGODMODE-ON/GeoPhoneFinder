import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { parseTitle, detectBrand } from '../src/domain/title-parser.js';
import { buildIdentity, fillMissing, findSpecConflicts, uuidV5 } from '../src/domain/identity.js';
import { validateListing } from '../src/ingestion/validate.js';
import { normalizeListing } from '../src/ingestion/normalize.js';
import { CHIPSETS, buildChipsetIndex } from '../src/scoring/chipsets.js';

describe('title parsing', () => {
  const cases = [
    ['Samsung Galaxy S24 8GB/256GB Onyx Black', { brand: 'Samsung', model: 'Galaxy S24', ram: 8, storage: 256, color: 'Onyx Black' }],
    ['Galaxy S24 8+256GB', { brand: 'Samsung', model: 'Galaxy S24', ram: 8, storage: 256, color: null }],
    ['Redmi Note 13 Pro 5G (8GB+256GB)', { brand: 'Xiaomi', model: 'Redmi Note 13 Pro 5G', ram: 8, storage: 256, color: null }],
    ['Xiaomi Redmi Note 13 Pro 5G 8/256GB', { brand: 'Xiaomi', model: 'Redmi Note 13 Pro 5G', ram: 8, storage: 256, color: null }],
    ['Apple iPhone 16 128GB Black', { brand: 'Apple', model: 'iPhone 16', ram: null, storage: 128, color: 'Black' }],
    ['iPhone 15 1TB', { brand: 'Apple', model: 'iPhone 15', ram: null, storage: 1024, color: null }],
    ['Nothing Phone (2a) 8GB/128GB', { brand: 'Nothing', model: 'Phone (2a)', ram: 8, storage: 128, color: null }],
    ['Samsung Galaxy S25 12 GB + 512 GB (SM-S931B)', { brand: 'Samsung', model: 'Galaxy S25', ram: 12, storage: 512, color: null }],
    ['Google Pixel 9 12GB/1TB', { brand: 'Google', model: 'Pixel 9', ram: 12, storage: 1024, color: null }],
    // other store styles used by the demo data
    ['Samsung Galaxy A55 5G 8GB RAM 256GB', { brand: 'Samsung', model: 'Galaxy A55 5G', ram: 8, storage: 256, color: null }],
    ['Samsung Galaxy S24 - 8/256GB - Cobalt Violet', { brand: 'Samsung', model: 'Galaxy S24', ram: 8, storage: 256, color: 'Cobalt Violet' }],
    ['Galaxy A35 5G 6/128 GB Awesome Navy', { brand: 'Samsung', model: 'Galaxy A35 5G', ram: 6, storage: 128, color: 'Awesome Navy' }],
  ];
  for (const [title, expected] of cases) {
    test(title, () => assert.deepEqual(parseTitle(title), expected));
  }

  // Titles copied from the real zoommer.ge catalogue: they carry retailer model codes (A376ED, S948, A175F/DS)
  const real = [
    ['Samsung Galaxy A37 A376ED 5G 8/128GB Light Violet', { brand: 'Samsung', model: 'Galaxy A37 5G', ram: 8, storage: 128, color: 'Light Violet' }],
    ['Samsung Galaxy S26 Ultra S948 5G 16/1TB Sky Blue', { brand: 'Samsung', model: 'Galaxy S26 Ultra 5G', ram: 16, storage: 1024, color: 'Sky Blue' }],
    ['Samsung Galaxy A17 A175F/DS LTE 8/256GB Grey', { brand: 'Samsung', model: 'Galaxy A17 LTE', ram: 8, storage: 256, color: 'Grey' }],
    ['Samsung Galaxy S26+ S947 5G 12/256GB Black', { brand: 'Samsung', model: 'Galaxy S26+ 5G', ram: 12, storage: 256, color: 'Black' }],
    ['Xiaomi 17T Pro 5G 12/1TB Blue', { brand: 'Xiaomi', model: '17T Pro 5G', ram: 12, storage: 1024, color: 'Blue' }],
    ['Apple iPhone 17 Pro | 1TB Deep Blue', { brand: 'Apple', model: 'iPhone 17 Pro', ram: null, storage: 1024, color: 'Deep Blue' }],
    ['Realme C85 Pro NFC 4G 8/128GB Green', { brand: 'Realme', model: 'C85 Pro NFC 4G', ram: 8, storage: 128, color: 'Green' }],
  ];
  for (const [title, expected] of real) {
    test(`real title: ${title}`, () => assert.deepEqual(parseTitle(title), expected));
  }
  // A "+" that belongs to the model name (S25+, iPhone 15+) must not be read as the RAM+storage separator.
  const plus = [
    ['Samsung Galaxy S25+ 12GB RAM 256GB', { brand: 'Samsung', model: 'Galaxy S25+', ram: 12, storage: 256, color: null }],
    ['Samsung Galaxy S24+ 12+256GB Cobalt Violet', { brand: 'Samsung', model: 'Galaxy S24+', ram: 12, storage: 256, color: 'Cobalt Violet' }],
    ['Samsung Galaxy S24+ (12GB+512GB) Onyx Black', { brand: 'Samsung', model: 'Galaxy S24+', ram: 12, storage: 512, color: 'Onyx Black' }],
    ['Samsung Galaxy S24+ 12/256GB', { brand: 'Samsung', model: 'Galaxy S24+', ram: 12, storage: 256, color: null }],
    ['Apple iPhone 15+ 256GB Blue', { brand: 'Apple', model: 'iPhone 15+', ram: null, storage: 256, color: 'Blue' }],
    ['Realme 12 Pro+ 5G 8/256GB', { brand: 'Realme', model: '12 Pro+ 5G', ram: 8, storage: 256, color: null }],
    ['OnePlus 12 12/256GB Silky Black', { brand: 'OnePlus', model: '12', ram: 12, storage: 256, color: 'Silky Black' }],
    ['Honor 200 8/256GB', { brand: 'Honor', model: '200', ram: 8, storage: 256, color: null }],
    ['Nothing CMF Phone 1 8/128GB', { brand: 'Nothing', model: 'CMF Phone 1', ram: 8, storage: 128, color: null }],
  ];
  for (const [title, expected] of plus) {
    test(`model "+" is not a separator: ${title}`, () => assert.deepEqual(parseTitle(title), expected));
  }
  test('implausible memory numbers are ignored', () => {
    assert.equal(parseTitle('Galaxy A15 15GB/256GB').ram, null); // 15 GB RAM does not exist
  });
  test('real model names with 1–2 digits are never mistaken for retailer codes', () => {
    for (const name of ['Galaxy S24', 'Galaxy A55 5G', 'Poco X6 Pro 5G', 'Redmi 13C', 'Galaxy S23 FE']) {
      assert.equal(parseTitle(`${name} 8GB/256GB`).model, name);
    }
  });
  test('brand aliases collapse to the manufacturer', () => {
    assert.equal(detectBrand('Poco F6'), 'Xiaomi');
    assert.equal(detectBrand('Galaxy A55'), 'Samsung');
    assert.equal(detectBrand('Fairphone 5'), null);
  });
});

describe('variant identity (PRD §12)', () => {
  const base = { brand: 'Samsung', model: 'Galaxy S25', ram: 12, storage: 256, chipsetId: 'x', fiveG: true };
  test('same configuration => same id, regardless of casing/spacing', () => {
    assert.equal(buildIdentity(base).id, buildIdentity({ ...base, model: 'galaxy  s25', brand: 'SAMSUNG' }).id);
  });
  test('different RAM / storage / chipset / network => different variants', () => {
    const id = buildIdentity(base).id;
    assert.notEqual(id, buildIdentity({ ...base, ram: 8 }).id); // S25 12/256 vs 8/256
    assert.notEqual(id, buildIdentity({ ...base, storage: 512 }).id);
    assert.notEqual(id, buildIdentity({ ...base, chipsetId: 'y' }).id);
    assert.notEqual(id, buildIdentity({ ...base, fiveG: false }).id);
  });
  test('unknown values are never silently merged with known ones', () => {
    assert.notEqual(buildIdentity(base).id, buildIdentity({ ...base, ram: null }).id);
  });
  test('"+" models are different products: S25 vs S25+, iPhone 15 vs 15+, Pro vs Pro+', () => {
    const b = { brand: 'Samsung', ram: 12, storage: 256, chipsetId: 'x', fiveG: true };
    const s25 = buildIdentity({ ...b, model: 'Galaxy S25' });
    const s25plus = buildIdentity({ ...b, model: 'Galaxy S25+' });
    assert.notEqual(s25.id, s25plus.id);
    assert.notEqual(s25.key, s25plus.key);
    assert.equal(s25plus.baseSlug, 'samsung-galaxy-s25-plus-12gb-256gb'); // readable, and NOT equal to the S25 slug
    assert.notEqual(s25.baseSlug, s25plus.baseSlug);
    assert.notEqual(buildIdentity({ ...b, model: 'Redmi Note 13 Pro' }).id, buildIdentity({ ...b, model: 'Redmi Note 13 Pro+' }).id);
    assert.notEqual(buildIdentity({ brand: 'Apple', model: 'iPhone 15', ram: null, storage: 256 }).id, buildIdentity({ brand: 'Apple', model: 'iPhone 15+', ram: null, storage: 256 }).id);
  });
  test('uuid v5 is deterministic and well-formed', () => {
    assert.equal(uuidV5('a'), uuidV5('a'));
    assert.match(uuidV5('a'), /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
  test('fillMissing never overwrites known data', () => {
    assert.deepEqual(fillMissing({ a: 1, b: null, c: { d: 1 } }, { a: 9, b: 2, c: { d: 9, e: 3 } }), { a: 1, b: 2, c: { d: 1, e: 3 } });
  });
  test('non-identity spec conflicts are detected for review', () => {
    const c = findSpecConflicts({ battery: { capacityMah: 4000 } }, { battery: { capacityMah: 5000 } });
    assert.equal(c.length, 1);
    assert.equal(findSpecConflicts({ battery: { capacityMah: 4000 } }, { battery: { capacityMah: 4050 } }).length, 0);
  });
});

describe('listing validation (PRD §24, §29)', () => {
  const good = { sourceProductId: 'p1', url: 'https://shop.test/p1', title: 'Samsung Galaxy S24 8GB/256GB', price: 2499, available: true };
  test('accepts a well-formed listing', () => {
    const r = validateListing(good);
    assert.equal(r.ok, true);
    assert.equal(r.value.price, 2499);
  });
  const bad = [
    ['non-numeric price', { price: 'abc' }],
    ['negative price', { price: -5 }],
    ['zero price', { price: 0 }],
    ['absurd price', { price: 1e9 }],
    ['bad url', { url: 'javascript:alert(1)' }],
    ['missing id', { sourceProductId: '' }],
    ['foreign currency', { currency: 'USD' }],
    ['non-boolean availability', { available: 'yes' }],
    ['ram out of range', { ram: 1000 }],
    ['future timestamp', { fetchedAt: '2999-01-01T00:00:00Z' }],
  ];
  for (const [name, patch] of bad) {
    test(`rejects ${name}`, () => assert.equal(validateListing({ ...good, ...patch }).ok, false));
  }
  test('strips markup from untrusted text', () => {
    const r = validateListing({ ...good, title: '<script>x</script>Samsung <b>Galaxy</b> S24 8GB/256GB' });
    assert.equal(r.ok, true);
    assert.ok(!/[<>]/.test(r.value.title));
  });
});

describe('normalization', () => {
  const chipsetIndex = buildChipsetIndex(CHIPSETS);
  const listing = (over = {}) =>
    validateListing({
      sourceProductId: 'p', url: 'https://x.test/p', title: 'Galaxy S24 8+256GB', price: 2000, available: true,
      specs: { chipsetName: 'exynos 2400', fiveG: true }, ...over,
    }).value;

  test('resolves brand, model, storage and chipset from messy input', () => {
    const n = normalizeListing(listing(), { chipsetIndex }).value;
    assert.equal(n.brand, 'Samsung');
    assert.equal(n.model, 'Galaxy S24');
    assert.equal(n.chipsetId, 'exynos-2400');
    assert.equal(n.offer.price, 2000);
  });
  test('different retailers converge on the same variant id', () => {
    const a = normalizeListing(listing({ title: 'Samsung Galaxy S24 8GB/256GB Onyx Black' }), { chipsetIndex }).value;
    const b = normalizeListing(listing({ title: 'Galaxy S24 (8GB+256GB)' }), { chipsetIndex }).value;
    assert.equal(a.identity.id, b.identity.id);
  });
  test('unknown chipset is reported, not invented', () => {
    const n = normalizeListing(listing({ specs: { chipsetName: 'Mystery 9000' } }), { chipsetIndex }).value;
    assert.equal(n.chipsetId, null);
    assert.equal(n.chipsetUnknown, 'Mystery 9000');
  });
  test('unknown brand => rejected for quarantine', () => {
    const r = normalizeListing(listing({ title: 'Fairphone 5 8GB/256GB' }), { chipsetIndex });
    assert.equal(r.ok, false);
  });
});
