import { cleanText } from './text.js';

/**
 * Brand normalisation (PRD "normalized manufacturer name").
 * `words` are tokens that reveal the brand; `strip` are prefixes removed from the model name.
 * Redmi and Poco are Xiaomi products: the manufacturer is normalised to "Xiaomi" while the
 * model keeps its marketing name ("Redmi Note 13 Pro 5G").
 */
const BRANDS = [
  { brand: 'Samsung', words: ['samsung', 'galaxy'], strip: ['samsung'] },
  { brand: 'Apple', words: ['apple', 'iphone'], strip: ['apple'] },
  { brand: 'Google', words: ['google', 'pixel'], strip: ['google'] },
  { brand: 'Xiaomi', words: ['xiaomi', 'redmi', 'poco'], strip: ['xiaomi'] },
  { brand: 'Nothing', words: ['nothing', 'cmf'], strip: ['nothing'] },
  { brand: 'Honor', words: ['honor'], strip: ['honor'] },
  { brand: 'OnePlus', words: ['oneplus'], strip: ['oneplus'] },
  { brand: 'Motorola', words: ['motorola', 'moto'], strip: ['motorola'] },
  { brand: 'Realme', words: ['realme'], strip: ['realme'] },
  { brand: 'Oppo', words: ['oppo'], strip: ['oppo'] },
  { brand: 'Vivo', words: ['vivo'], strip: ['vivo'] },
  { brand: 'Huawei', words: ['huawei'], strip: ['huawei'] },
  { brand: 'Asus', words: ['asus', 'rog', 'zenfone'], strip: ['asus'] },
  { brand: 'Sony', words: ['sony', 'xperia'], strip: ['sony'] },
  { brand: 'RedMagic', words: ['redmagic'], strip: ['redmagic'] },
  { brand: 'Tecno', words: ['tecno'], strip: ['tecno'] },
  { brand: 'Infinix', words: ['infinix'], strip: ['infinix'] },
  { brand: 'itel', words: ['itel'], strip: ['itel'] },
];

const tokens = (s) => String(s).toLowerCase().split(/[^a-z0-9+]+/).filter(Boolean);

/** Canonical brand for a free-text brand or product title, or null if unknown. */
export function detectBrand(text) {
  const toks = tokens(text);
  let best = null;
  for (const entry of BRANDS) {
    for (const w of entry.words) {
      const idx = toks.indexOf(w);
      if (idx !== -1 && (best === null || idx < best.idx)) best = { idx, brand: entry.brand };
    }
  }
  return best?.brand ?? null;
}

/** Removes a leading brand name ("Samsung Galaxy S24" -> "Galaxy S24"). */
export function stripBrandPrefix(model) {
  let out = model;
  for (const { strip } of BRANDS) {
    for (const s of strip) out = out.replace(new RegExp(`^${s}\\b[\\s:-]*`, 'i'), '');
  }
  return out;
}

const toGb = (n, unit) => (String(unit).toLowerCase() === 'tb' ? Number(n) * 1024 : Number(n));

// The RAM number must stand on its own: "S25+ 12GB" must not read the "25+" of the model name as RAM.
const NOT_PART_OF_WORD = '(?<![A-Za-z0-9.])';
// "8GB/256GB", "8/256GB", "8+256GB", "8 GB + 256 GB", "12GB+1TB", "16/1TB", "8GB RAM, 256GB"
const RAM_STORAGE = new RegExp(`${NOT_PART_OF_WORD}(\\d{1,2})\\s*(?:gb)?\\s*(?:ram)?\\s*[/+,|]\\s*(\\d{1,4})\\s*(gb|tb)\\b`, 'gi');
// "8GB RAM 256GB" (no separator)
const RAM_WORD_STORAGE = new RegExp(`${NOT_PART_OF_WORD}(\\d{1,2})\\s*gb\\s*ram\\s+(\\d{1,4})\\s*(gb|tb)\\b`, 'gi');
// "256GB", "1TB"
const STORAGE_ONLY = new RegExp(`${NOT_PART_OF_WORD}(\\d{1,4})\\s*(gb|tb)\\b`, 'gi');

// Only real memory sizes count, so "iPhone 15+ 256GB" is 256 GB (not "15 GB RAM").
const RAM_SIZES = new Set([1, 2, 3, 4, 6, 8, 10, 12, 16, 18, 20, 24, 32]);
const STORAGE_SIZES = new Set([8, 16, 32, 64, 128, 256, 512, 1024, 2048]);

function firstMemory(re, text, withRam) {
  for (const m of text.matchAll(re)) {
    const ram = withRam ? Number(m[1]) : null;
    const storage = withRam ? toGb(m[2], m[3]) : toGb(m[1], m[2]);
    if ((!withRam || RAM_SIZES.has(ram)) && STORAGE_SIZES.has(storage)) return { m, ram, storage };
  }
  return null;
}

// Samsung retailer model codes like "A376ED", "S948", "A175F/DS", "S908B/DS". They are only removed from Samsung
// titles: other brands have real model names such as Vivo X100 Pro or Moto G200 that look the same.
const MODEL_CODE = /\b[A-Z]\d{3}[A-Z]{0,3}(?:\/[A-Z]{1,3})?\b/g;

/**
 * Extracts brand / model / RAM / storage / colour from a retailer product title.
 * The model is what stands BEFORE the memory part, so listings of the same configuration
 * converge on the same model string; what follows (colour) is returned separately.
 */
export function parseTitle(title) {
  const t = cleanText(title, 300);
  let ram = null;
  let storage = null;
  let cutAt = t.length;
  let restFrom = t.length;

  const found = firstMemory(RAM_STORAGE, t, true) ?? firstMemory(RAM_WORD_STORAGE, t, true) ?? firstMemory(STORAGE_ONLY, t, false);
  if (found) {
    ram = found.ram;
    storage = found.storage;
    cutAt = found.m.index;
    restFrom = found.m.index + found.m[0].length;
  }

  let modelRaw = t.slice(0, cutAt).replace(/[\s(\-–,:/|]+$/g, '').trim();
  modelRaw = modelRaw.replace(/\(\s*[A-Z0-9-]{5,}\s*\)/g, '').trim();
  const brand = detectBrand(modelRaw);
  if (brand === 'Samsung') modelRaw = modelRaw.replace(MODEL_CODE, ' ').replace(/\s+/g, ' ').trim();
  const model = stripBrandPrefix(modelRaw).replace(/\s+/g, ' ').trim();

  const rest = t.slice(restFrom).replace(/\([^)]*\)/g, ' ').replace(/^[\s)\]|,;:/-]+/, '').replace(/[\s|,;:/-]+$/, '').trim();
  const color = /^[A-Za-z][A-Za-z\s-]{1,38}$/.test(rest) ? rest : null;

  return { brand, model, ram, storage, color };
}
