import { CHIPSETS } from '../scoring/chipsets.js';
import { SCORE_DEFINITIONS } from '../scoring/definitions.js';
import { validateDefinition } from '../scoring/engine.js';
import { PRIORITY_KEYS } from '../domain/constants.js';
import { STORES } from './stores.js';
import { stableStringify } from '../domain/text.js';

/** Inserts missing stores; updates descriptive fields but never the `active` flag. */
export async function syncStores(db) {
  for (const s of STORES) {
    await db.query(
      `INSERT INTO stores (id, name, base_url, adapter_key, active) VALUES ($1,$2,$3,$4,TRUE)
       ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, base_url = EXCLUDED.base_url, adapter_key = EXCLUDED.adapter_key`,
      [s.id, s.name, s.baseUrl, s.adapterKey],
    );
  }
}

export async function syncChipsets(db) {
  for (const c of CHIPSETS) {
    await db.query(
      `INSERT INTO chipsets (id, vendor, name, aliases, generation_rank, performance_tier, cpu_score, gpu_score, architecture_score, cores, gpu, released)
       VALUES ($1,$2,$3,$4::jsonb,$5,$6,$7,$8,$9,$10,$11,$12)
       ON CONFLICT (id) DO UPDATE SET vendor=EXCLUDED.vendor, name=EXCLUDED.name, aliases=EXCLUDED.aliases,
         generation_rank=EXCLUDED.generation_rank, performance_tier=EXCLUDED.performance_tier, cpu_score=EXCLUDED.cpu_score,
         gpu_score=EXCLUDED.gpu_score, architecture_score=EXCLUDED.architecture_score, cores=EXCLUDED.cores, gpu=EXCLUDED.gpu, released=EXCLUDED.released`,
      [c.id, c.vendor, c.name, JSON.stringify(c.aliases ?? []), c.generationRank, c.performanceTier, c.cpuScore, c.gpuScore, c.architectureScore, c.cores ?? null, c.gpu ?? null, c.released ?? null],
    );
  }
}

/** Syncs code-defined score formulas into `score_definitions` (versioned). */
export async function syncScoreDefinitions(db, warn = () => {}) {
  for (const def of SCORE_DEFINITIONS) {
    validateDefinition(def);
    const { rows } = await db.query('SELECT definition FROM score_definitions WHERE key=$1 AND version=$2', [def.key, def.version]);
    if (!rows.length) {
      await db.query('INSERT INTO score_definitions (key, version, label, definition, active) VALUES ($1,$2,$3,$4::jsonb,TRUE)', [
        def.key, def.version, def.label, JSON.stringify(def),
      ]);
    } else if (stableStringify(rows[0].definition) !== stableStringify(def)) {
      warn(`score definition "${def.key}" v${def.version} changed without a version bump — updated in place. Bump \`version\` to keep history explainable.`);
      await db.query('UPDATE score_definitions SET label=$3, definition=$4::jsonb WHERE key=$1 AND version=$2', [
        def.key, def.version, def.label, JSON.stringify(def),
      ]);
    }
    const latest = Math.max(...SCORE_DEFINITIONS.filter((d) => d.key === def.key).map((d) => d.version));
    await db.query('UPDATE score_definitions SET active = (version = $2) WHERE key = $1', [def.key, latest]);
  }
}

export async function syncReferenceData(db, warn) {
  await syncStores(db);
  await syncChipsets(db);
  await syncScoreDefinitions(db, warn);
}

export async function loadActiveDefinitions(db) {
  const { rows } = await db.query('SELECT definition FROM score_definitions WHERE active');
  return rows
    .map((r) => r.definition)
    .sort((a, b) => PRIORITY_KEYS.indexOf(a.key) - PRIORITY_KEYS.indexOf(b.key));
}

export async function loadChipsets(db) {
  const { rows } = await db.query(
    `SELECT id, vendor, name, aliases, generation_rank AS "generationRank", performance_tier AS "performanceTier",
            cpu_score AS "cpuScore", gpu_score AS "gpuScore", architecture_score AS "architectureScore", cores, gpu, released
       FROM chipsets ORDER BY id`,
  );
  return rows;
}
