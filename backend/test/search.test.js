import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { georgianToLatin, matchScore, queryTokens, searchIndex, withinOneEdit } from '../src/domain/search-match.js';
import { searchPhones, suggestNames } from '../src/domain/search.js';
import { NOW, phone, snapshot } from './helpers.js';

// model = id, brand = brand (see helpers.phone)
const catalog = snapshot([
  phone('Galaxy A55 5G', { brand: 'Samsung', price: 1300 }),
  phone('Galaxy S24', { brand: 'Samsung', price: 2400 }),
  phone('iPhone 15', { brand: 'Apple', price: 2700 }),
  phone('Pixel 9', { brand: 'Google', price: 2500 }),
  phone('Poco F6', { brand: 'Xiaomi', price: 1100 }),
]);
const find = (params) => searchPhones(catalog, { pageSize: 48, ...params }, { now: NOW });
const names = (r) => r.items.map((i) => i.phone.model);

describe('query tokens', () => {
  test('latin words, digits, punctuation and case', () => {
    assert.deepEqual(queryTokens('  Galaxy   S24!! '), ['galaxy', 's24']);
    assert.deepEqual(queryTokens('iPhone-15,PRO'), ['iphone', '15', 'pro']);
    assert.deepEqual(queryTokens('galaxy galaxy'), ['galaxy']);
  });
  test('empty / symbol-only query = no query', () => {
    assert.deepEqual(queryTokens(''), []);
    assert.deepEqual(queryTokens(undefined), []);
    assert.deepEqual(queryTokens('  ++ -- '), []);
  });
  test('Georgian brand and model words map to their latin names (inflections too)', () => {
    assert.deepEqual(queryTokens('სამსუნგი'), ['samsung']);
    assert.deepEqual(queryTokens('სამსუნგის გალაქსი'), ['samsung', 'galaxy']);
    assert.deepEqual(queryTokens('აიფონი 15'), ['iphone', '15']);
    assert.deepEqual(queryTokens('პიქსელი'), ['pixel']);
    assert.deepEqual(queryTokens('ქსიაომი პოკო'), ['xiaomi', 'poco']);
    assert.deepEqual(queryTokens('აიფონი15'), ['iphone', '15']); // glued to a number
  });
  test('unknown Georgian words are transliterated letter by letter', () => {
    assert.equal(georgianToLatin('ტელეფონი'), 'telefoni');
    assert.ok(queryTokens('ბარათი')[0].length > 0);
  });
});

describe('typo tolerance helper', () => {
  test('one substitution / insertion / deletion', () => {
    assert.ok(withinOneEdit('samsung', 'samsng'));
    assert.ok(withinOneEdit('galaxy', 'galxy'));
    assert.ok(withinOneEdit('pixel', 'pixxel'));
    assert.ok(withinOneEdit('poco', 'poca'));
    assert.ok(!withinOneEdit('poco', 'pako')); // two letters off
    assert.ok(!withinOneEdit('samsung', 'apple'));
    assert.ok(!withinOneEdit('galaxy', 'gxlxy'));
  });
});

describe('loose matching — ANY word, part of a word, or letter shows the phone', () => {
  test('a single letter matches every phone whose name contains it', () => {
    assert.deepEqual(names(find({ q: 'x' })).sort(), ['Galaxy A55 5G', 'Galaxy S24', 'Pixel 9', 'Poco F6']); // gala-x-y, pi-x-el, Xiaomi
  });
  test('part of a word, from the start or the middle', () => {
    assert.deepEqual(names(find({ q: 'sam' })).sort(), ['Galaxy A55 5G', 'Galaxy S24']);
    assert.deepEqual(names(find({ q: 'hone' })), ['iPhone 15']); // inside "iphone"
    assert.deepEqual(names(find({ q: 'ixe' })), ['Pixel 9']);
  });
  test('a query with several words matches when ANY of them matches', () => {
    const got = names(find({ q: 'pixel poco' })).sort();
    assert.deepEqual(got, ['Pixel 9', 'Poco F6']);
    const wide = names(find({ q: 'galaxy nothing-at-all' })).sort();
    assert.deepEqual(wide, ['Galaxy A55 5G', 'Galaxy S24']); // one word is enough
  });
  test('better matches come first: more words matched, exact word before part of a word', () => {
    assert.deepEqual(names(find({ q: 'galaxy s24' }))[0], 'Galaxy S24'); // both words
    assert.equal(names(find({ q: 'galaxy s24' })).length, 2); // ...and the other Galaxy still shown
    assert.deepEqual(names(find({ q: 'pixel' }))[0], 'Pixel 9');
    assert.ok(matchScore(['pixel'], searchIndex(catalog.phones[3])) > matchScore(['pix'], searchIndex(catalog.phones[3])));
  });
  test('typos are forgiven (one letter off, words of 4+ letters)', () => {
    assert.deepEqual(names(find({ q: 'samsng' })).sort(), ['Galaxy A55 5G', 'Galaxy S24']);
    assert.deepEqual(names(find({ q: 'galxy' })).sort(), ['Galaxy A55 5G', 'Galaxy S24']);
    assert.deepEqual(names(find({ q: 'ipone' })), ['iPhone 15']);
  });
  test('memory sizes and processors are searchable too', () => {
    assert.equal(find({ q: '256' }).total, 5); // helper phones are all 256 GB
  });
  test('nothing in common => no results', () => {
    assert.equal(find({ q: 'zzzzzz' }).total, 0);
    assert.equal(find({ q: 'qqq' }).total, 0);
  });
  test('no query, or a query with no letters/digits, shows everything', () => {
    assert.equal(find({}).total, 5);
    assert.equal(find({ q: '   ' }).total, 5);
    assert.equal(find({ q: '+-' }).total, 5);
  });
});

describe('Georgian queries', () => {
  test('brand words', () => {
    assert.deepEqual(names(find({ q: 'სამსუნგი' })).sort(), ['Galaxy A55 5G', 'Galaxy S24']);
    assert.deepEqual(names(find({ q: 'აიფონი' }))[0], 'iPhone 15');
    assert.deepEqual(names(find({ q: 'პიქსელი' })), ['Pixel 9']);
    assert.deepEqual(names(find({ q: 'პოკო' })), ['Poco F6']);
  });
  test('mixed Georgian + latin', () => {
    assert.deepEqual(names(find({ q: 'გალაქსი s24' }))[0], 'Galaxy S24');
  });
});

describe('text search combines with the other filters (those stay strict)', () => {
  test('brand filter narrows a loose text match', () => {
    assert.deepEqual(names(find({ q: 'galaxy pixel', brands: ['Google'] })), ['Pixel 9']);
  });
  test('price filter narrows it too', () => {
    assert.deepEqual(names(find({ q: 'galaxy', maxPrice: 1500 })), ['Galaxy A55 5G']);
  });
});

describe('live suggestions', () => {
  test('use the same loose matching and rank best first', () => {
    assert.deepEqual(suggestNames(catalog, 'pix'), ['Google Pixel 9']);
    assert.deepEqual(suggestNames(catalog, 'x')[0] !== undefined, true);
    assert.deepEqual(suggestNames(catalog, 'გალაქსი').sort(), ['Samsung Galaxy A55 5G', 'Samsung Galaxy S24']);
    assert.deepEqual(suggestNames(catalog, 'galxy s24')[0], 'Samsung Galaxy S24');
    assert.deepEqual(suggestNames(catalog, ''), []);
    assert.deepEqual(suggestNames(catalog, 'zzzzzz'), []);
  });
});
