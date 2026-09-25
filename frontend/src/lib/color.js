/**
 * Retail colour names ("Onyx Black", "Awesome Iceblue", "Sky Blue") -> an HSL triple used to tint
 * the generated phone illustration, so each store's listing looks like the colour it actually sells.
 * First matching rule wins, so specific words come before generic ones.
 */
const RULES = [
  [/sky|ice ?blue|light blue|bay|glacier blue/i, [205, 68, 66]],
  [/teal|ocean/i, [176, 55, 38]],
  [/ultramarine|navy|deep blue|cobalt|blue/i, [224, 62, 38]],
  [/lime|lemon green/i, [84, 55, 52]],
  [/green|mint|aloe|wintergreen|jade|clover|sage|pistachio/i, [150, 42, 42]],
  [/violet|purple|lilac|lavender/i, [266, 46, 60]],
  [/pink|peony|rose|coral/i, [338, 62, 72]],
  [/yellow|amber|lemon|gold/i, [45, 86, 58]],
  [/burgundy|wine/i, [345, 55, 30]],
  [/red|crimson/i, [355, 70, 48]],
  [/orange/i, [24, 86, 55]],
  [/white|porcelain|milk|glacier|arctic|cream|pearl|starlight|snow/i, [40, 14, 90]],
  [/black|obsidian|onyx|midnight|graphite|space|phantom|carbon/i, [225, 10, 17]],
  [/silver|shadow|titan(?:ium)?( gr[ae]y)?|gr[ae]y|marble|slate|natural/i, [215, 8, 58]],
];

function hash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h;
}

/** [h, s, l] for a colour name; falls back to a stable hue derived from `seed`. */
export function colorFromName(name, seed = '') {
  const text = String(name ?? '');
  for (const [re, hsl] of RULES) if (re.test(text)) return hsl;
  return [hash(seed || text) % 360, 62, 50];
}

export const hsl = ([h, s, l], dl = 0) => `hsl(${h} ${s}% ${Math.min(96, Math.max(4, l + dl))}%)`;
export const isLight = ([, , l]) => l > 70;
