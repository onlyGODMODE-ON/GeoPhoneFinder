import { keyOf } from './text.js';

/**
 * LOOSE SEARCH MATCHING.
 *
 * A phone is shown when ANY part of the query matches ANY part of its name — a whole word, the start
 * of a word, a few letters from the middle of a word, even a single letter. Results are then ranked so
 * the best matches come first (exact word > start of word > letters inside a word > typo), and a phone
 * matching all words comes before one matching only some.
 *
 * Georgian input works too: "სამსუნგი" finds Samsung, "აიფონი" finds iPhone. Known words are mapped
 * through a small dictionary, everything else is transliterated letter by letter.
 */

// Longest keys first so "გალაქსი" is preferred over a shorter prefix. Inflected forms ("სამსუნგის") match by prefix.
const KA_WORDS = {
  სამსუნგი: 'samsung', სამსუნგ: 'samsung', სამსუნღი: 'samsung',
  გალაქსი: 'galaxy', გალაქსის: 'galaxy',
  აიფონი: 'iphone', აიფონ: 'iphone', აიფონის: 'iphone',
  ეპლი: 'apple', ეფლი: 'apple', აპლი: 'apple', ეპლ: 'apple',
  პიქსელი: 'pixel', პიქსელ: 'pixel',
  გუგლი: 'google', გუგლ: 'google',
  შაომი: 'xiaomi', სიაომი: 'xiaomi', ქსიაომი: 'xiaomi', შიაომი: 'xiaomi', ქსიომი: 'xiaomi',
  რედმი: 'redmi', პოკო: 'poco',
  ნათინგი: 'nothing', ნოთინგი: 'nothing',
  ჰონორი: 'honor', ჰუავეი: 'huawei', ვანპლასი: 'oneplus', ვანპლუსი: 'oneplus', რეალმი: 'realme', ოპო: 'oppo', ვივო: 'vivo', მოტოროლა: 'motorola',
  პრო: 'pro', ულტრა: 'ultra', მაქსი: 'max', მაქს: 'max', პლუსი: 'plus', პლუს: 'plus', მინი: 'mini', ნოუთი: 'note', ნოუტი: 'note',
  ფე: 'fe', ფოლდი: 'fold', ფლიპი: 'flip', ლაიტი: 'lite',
};
const KA_WORD_KEYS = Object.keys(KA_WORDS).sort((a, b) => b.length - a.length);

const KA_LETTERS = {
  ა: 'a', ბ: 'b', გ: 'g', დ: 'd', ე: 'e', ვ: 'v', ზ: 'z', თ: 't', ი: 'i', კ: 'k', ლ: 'l', მ: 'm', ნ: 'n', ო: 'o', პ: 'p',
  ჟ: 'zh', რ: 'r', ს: 's', ტ: 't', უ: 'u', ფ: 'f', ქ: 'k', ღ: 'gh', ყ: 'q', შ: 'sh', ჩ: 'ch', ც: 'ts', ძ: 'dz',
  წ: 'ts', ჭ: 'ch', ხ: 'kh', ჯ: 'j', ჰ: 'h',
};

export function georgianToLatin(word) {
  for (const key of KA_WORD_KEYS) if (word.startsWith(key)) return KA_WORDS[key];
  return [...word].map((ch) => KA_LETTERS[ch] ?? '').join('');
}

/** Query -> lowercase latin/digit tokens. Empty array = no query (show everything). */
export function queryTokens(q) {
  const raw = String(q ?? '').toLowerCase().normalize('NFKD');
  const out = [];
  for (const chunk of raw.split(/[^\p{L}\p{N}]+/u)) {
    if (!chunk) continue;
    for (const [, ka, other] of chunk.matchAll(/([\u10A0-\u10FF]+)|([^\u10A0-\u10FF]+)/g)) {
      if (ka) out.push(georgianToLatin(ka));
      else out.push(other.replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, ''));
    }
  }
  return [...new Set(out.filter(Boolean))];
}

/** true if a and b differ by at most one insertion, deletion or substitution. */
export function withinOneEdit(a, b) {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  if (a.length === b.length) return a.slice(i + 1) === b.slice(i + 1); // substitution
  const [long, short] = a.length > b.length ? [a, b] : [b, a];
  return long.slice(i + 1) === short.slice(i); // insertion / deletion
}

/** Words a phone can be found by: brand, model, chipset and memory sizes. */
export function searchIndex(phone) {
  const words = keyOf(
    `${phone.brand} ${phone.model} ${phone.chipset?.name ?? ''} ${phone.ram ? `${phone.ram}gb` : ''} ${phone.storage ? `${phone.storage}gb` : ''}`,
  ).split(' ').filter(Boolean);
  return { words, text: words.join(' '), name: keyOf(`${phone.brand} ${phone.model}`) };
}

/**
 * Score of one phone for the query tokens. 0 = no match at all.
 *   exact word 6 · start of a word 5 · letters inside a word 3 · one-typo 2
 * +10 when every token matched, +8 when the name starts with the whole query.
 */
export function matchScore(tokens, index) {
  if (!tokens.length) return 0;
  let total = 0;
  let matched = 0;
  for (const t of tokens) {
    let best = 0;
    for (const w of index.words) {
      if (w === t) best = 6;
      else if (best < 5 && w.startsWith(t)) best = 5;
      else if (best < 3 && w.includes(t)) best = 3;
      else if (best < 2 && t.length >= 4 && withinOneEdit(w, t)) best = 2;
      if (best === 6) break;
    }
    if (best === 0 && index.text.includes(t)) best = 3; // spans two words, e.g. "galaxys24"
    if (best > 0) {
      matched += 1;
      total += best;
    }
  }
  if (matched === 0) return 0;
  if (matched === tokens.length) total += 10;
  if (index.name.startsWith(tokens.join(' '))) total += 8;
  return total;
}
