/**
 * Turns one raw spec value into a 0–100 score. Returns `{ score: null, reason }`
 * when the value is missing or cannot be interpreted — NEVER 0 (PRD §10.1).
 */
const clamp = (x) => Math.min(100, Math.max(0, x));

export function normalizeValue(value, spec) {
  if (value === null || value === undefined) return { score: null, reason: 'missing' };

  switch (spec.type) {
    case 'linear': {
      // If min > max the scale is inverted ("lower is better"), e.g. weight or aperture.
      const n = Number(value);
      if (typeof value === 'boolean' || !Number.isFinite(n)) return { score: null, reason: 'invalid' };
      return { score: clamp(((n - spec.min) / (spec.max - spec.min)) * 100) };
    }
    case 'log': {
      const n = Number(value);
      if (typeof value === 'boolean' || !Number.isFinite(n) || n <= 0) return { score: null, reason: 'invalid' };
      const r = (Math.log(n) - Math.log(spec.min)) / (Math.log(spec.max) - Math.log(spec.min));
      return { score: clamp(r * 100) };
    }
    case 'bool': {
      if (typeof value !== 'boolean') return { score: null, reason: 'invalid' };
      return { score: value ? 100 : 0 };
    }
    case 'map': {
      const key = String(value).trim().toLowerCase();
      const table = spec.values;
      if (Object.prototype.hasOwnProperty.call(table, key)) return { score: table[key] };
      return { score: null, reason: 'unmapped' };
    }
    default:
      throw new Error(`Unknown normalizer type "${spec.type}"`);
  }
}

export const NORMALIZER_TYPES = ['linear', 'log', 'bool', 'map'];
