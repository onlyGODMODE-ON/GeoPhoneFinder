/** mAh -> points. Anchor: 5000 mAh = 80. More capacity = more points, less capacity = fewer. */
export const CAPACITY_CURVE = [[2000, 0], [3000, 20], [3500, 35], [4000, 52], [4500, 67], [5000, 80], [5500, 89], [6000, 95], [6500, 98], [7000, 100]];
/** Wired charging W -> points added/removed. 25 W is the neutral point, so a typical 5000 mAh / 25 W phone scores exactly 80. */
export const WIRED_ADJUSTMENT = [[0, -6], [18, -3], [25, 0], [45, 5], [67, 9], [90, 11], [120, 12]];

/** Piecewise-linear interpolation over [[x, y], …] sorted by x; clamps outside the table. */
export function interpolate(table, x) {
  if (x <= table[0][0]) return table[0][1];
  for (let i = 1; i < table.length; i++) {
    const [x1, y1] = table[i];
    if (x <= x1) {
      const [x0, y0] = table[i - 1];
      return y0 + ((x - x0) / (x1 - x0)) * (y1 - y0);
    }
  }
  return table[table.length - 1][1];
}

/**
 * Battery points 0–100: capacity sets the score, charging nudges it. Faster wired charging adds up to 12,
 * wireless charging adds 2–5. Not having wireless charging never subtracts anything.
 * Unknown capacity => null (unknown, never 0).
 */
export function batteryPoints(battery) {
  const cap = battery?.capacityMah;
  if (typeof cap !== 'number' || !Number.isFinite(cap)) return null;
  let points = interpolate(CAPACITY_CURVE, cap);
  if (typeof battery.wiredW === 'number') points += interpolate(WIRED_ADJUSTMENT, battery.wiredW);
  if (typeof battery.wirelessW === 'number' && battery.wirelessW > 0) points += battery.wirelessW >= 50 ? 5 : battery.wirelessW >= 15 ? 3 : 2;
  return Math.min(100, Math.max(0, points));
}

/**
 * Named derivations for factors that need more than one input field.
 * Definitions stored in the database reference these by name.
 */
export const DERIVATIONS = {
  batteryPoints: (ctx) => batteryPoints(ctx.battery),
  /** Megapixels of the display panel. */
  displayMegapixels(ctx) {
    const r = ctx.display?.resolution;
    if (!r?.width || !r?.height) return null;
    return (r.width * r.height) / 1e6;
  },
  /** PRD §10.2: GenerationScore = generationRank / totalGenerations × 100 */
  generationScore(ctx) {
    const c = ctx.chipset;
    if (!c || !c.generationRank || !c.totalGenerations) return null;
    return (c.generationRank / c.totalGenerations) * 100;
  },
};
