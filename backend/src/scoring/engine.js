import { normalizeValue, NORMALIZER_TYPES } from './normalizers.js';
import { DERIVATIONS } from './derive.js';

export function getPath(obj, path) {
  let cur = obj;
  for (const part of path.split('.')) {
    if (cur === null || cur === undefined) return undefined;
    cur = cur[part];
  }
  return cur;
}

/** Throws if a definition is malformed. Run before storing/using a definition. */
export function validateDefinition(def) {
  const where = `definition "${def?.key}"`;
  if (!def?.key || !Number.isInteger(def.version) || !Array.isArray(def.groups) || !def.groups.length) {
    throw new Error(`${where}: needs key, integer version and non-empty groups`);
  }
  for (const g of def.groups) {
    if (!g.id || !(g.weight > 0) || !Array.isArray(g.factors) || !g.factors.length) {
      throw new Error(`${where}: group "${g.id}" needs id, positive weight and factors`);
    }
    for (const f of g.factors) {
      if (!f.id || !(f.weight > 0)) throw new Error(`${where}: factor "${f.id}" needs id and positive weight`);
      if (!f.path && !f.derive) throw new Error(`${where}: factor "${f.id}" needs path or derive`);
      if (f.derive && !DERIVATIONS[f.derive]) throw new Error(`${where}: unknown derive "${f.derive}"`);
      if (!f.normalize || !NORMALIZER_TYPES.includes(f.normalize.type)) {
        throw new Error(`${where}: factor "${f.id}" has invalid normalize.type`);
      }
    }
  }
  return def;
}

/**
 * Evaluates one score definition against a scoring context.
 *
 * Missing data policy (PRD §10.1): a factor without data is excluded and the remaining
 * weights are re-normalised; it is listed in `missing`. If nothing can be scored the
 * result is `score: null` — never 0.
 */
export function evaluateDefinition(def, ctx) {
  const groups = {};
  const missing = [];
  let accWeighted = 0;
  let accWeight = 0;
  let coverageNum = 0;
  let coverageDen = 0;

  for (const g of def.groups) {
    let fSum = 0;
    let fAvail = 0;
    let fAcc = 0;
    for (const f of g.factors) {
      const raw = f.derive ? DERIVATIONS[f.derive](ctx) : getPath(ctx, f.path);
      const { score } = normalizeValue(raw, f.normalize);
      fSum += f.weight;
      if (score === null) {
        missing.push(`${g.id}.${f.id}`);
        continue;
      }
      fAvail += f.weight;
      fAcc += f.weight * score;
    }
    coverageDen += g.weight;
    coverageNum += g.weight * (fAvail / fSum);
    if (fAvail === 0) {
      groups[g.id] = null;
      continue;
    }
    const groupScore = fAcc / fAvail;
    groups[g.id] = Math.round(groupScore);
    accWeighted += g.weight * groupScore;
    accWeight += g.weight;
  }

  const score = accWeight > 0 ? Math.min(100, Math.max(0, Math.round(accWeighted / accWeight))) : null;
  return {
    key: def.key,
    version: def.version,
    score,
    coverage: Math.round((coverageNum / coverageDen) * 100) / 100,
    groups,
    missing,
  };
}

/** Evaluates every definition and returns the structure stored in phone_variants.scores. */
export function computeScores(ctx, definitions, now = new Date()) {
  const values = {};
  const details = {};
  for (const def of definitions) {
    const r = evaluateDefinition(def, ctx);
    values[def.key] = r.score;
    details[def.key] = {
      version: r.version,
      coverage: r.coverage,
      groups: r.groups,
      missing: r.missing,
    };
  }
  return { values, details, computedAt: now.toISOString() };
}

/** Builds the flat object the scoring definitions read from. */
export function buildScoringContext(variant, chipset, totalGenerations) {
  return {
    ram: variant.ram ?? null,
    storage: variant.storage ?? null,
    display: variant.display ?? null,
    battery: variant.battery ?? null,
    cameras: variant.cameras ?? null,
    video: variant.video ?? null,
    connectivity: variant.connectivity ?? null,
    audio: variant.audio ?? null,
    body: variant.body ?? null,
    software: variant.software ?? null,
    benchmarks: variant.benchmarks ?? null,
    chipset: chipset
      ? {
          generationRank: chipset.generationRank,
          totalGenerations,
          performanceTier: chipset.performanceTier,
          cpuScore: chipset.cpuScore,
          gpuScore: chipset.gpuScore,
          architectureScore: chipset.architectureScore,
        }
      : null,
  };
}
