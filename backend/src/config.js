import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

const bool = (v, d) =>
  v === undefined || v === '' ? d : ['1', 'true', 'yes', 'on'].includes(String(v).toLowerCase());
const int = (v, d) => {
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : d;
};

/**
 * All runtime configuration comes from environment variables (see .env.example).
 * Nothing in here is retailer-specific.
 */
export function loadConfig(env = process.env) {
  const nodeEnv = env.NODE_ENV || 'development';
  const port = int(env.PORT, 3001);
  return {
    nodeEnv,
    isProd: nodeEnv === 'production',
    host: env.HOST || '0.0.0.0',
    port,

    // Database. DATABASE_URL => PostgreSQL. Empty => embedded PGlite (real Postgres compiled to WASM),
    // handy for local development and tests. PGLITE_DIR persists it to disk.
    databaseUrl: env.DATABASE_URL || null,
    pgSsl: env.PGSSL === 'require',
    pgliteDir: env.PGLITE_DIR || null,

    // 'demo' = adapters read bundled sample data. 'live' = adapters call the real retailers (you implement them).
    adapterMode: env.ADAPTER_MODE === 'live' ? 'live' : 'demo',

    // An offer older than this is "stale" and is excluded from active recommendations.
    staleAfterHours: int(env.STALE_AFTER_HOURS, 48),
    // An offer newer than this is flagged "recently updated" in the UI.
    recentlyUpdatedHours: int(env.RECENTLY_UPDATED_HOURS, 6),

    ingestOnStart: bool(env.INGEST_ON_START, true),
    runScheduler: bool(env.RUN_SCHEDULER, true),
    ingestIntervalMinutes: int(env.INGEST_INTERVAL_MINUTES, 60),

    adminToken: env.ADMIN_TOKEN || null,
    corsOrigin: env.CORS_ORIGIN ? env.CORS_ORIGIN.split(',').map((s) => s.trim()) : null,
    rateLimitMax: int(env.RATE_LIMIT_MAX, 240),
    catalogCacheSeconds: int(env.CATALOG_CACHE_SECONDS, 60),

    siteUrl: (env.SITE_URL || `http://localhost:${port}`).replace(/\/$/, ''),
    frontendDist: env.FRONTEND_DIST || path.resolve(here, '../../frontend/dist'),
  };
}
