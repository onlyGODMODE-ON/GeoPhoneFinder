import { loadConfig } from './config.js';
import { createDb } from './db/index.js';
import { runMigrations } from './db/migrate.js';
import { syncReferenceData } from './ingestion/reference.js';
import { buildApp } from './app.js';
import { startScheduler } from './ingestion/scheduler.js';

const config = loadConfig();
const db = await createDb(config);
await runMigrations(db);
await syncReferenceData(db);

// The catalog is "ready" at once when the database already has phones. On a fresh (empty) database the API
// starts listening immediately and answers 503 until the first ingestion is done — the frontend retries by itself,
// so opening the site while the server is still warming up no longer needs a manual reload.
const { rows } = await db.query('SELECT count(*)::int AS n FROM phone_variants');
let ready = rows[0].n > 0 || !config.ingestOnStart;

const { app, runIngest } = await buildApp({
  config,
  db,
  logger: { level: config.isProd ? 'info' : 'warn', transport: undefined },
  isReady: () => ready,
});

let scheduler = null;
if (config.runScheduler) {
  scheduler = startScheduler({ run: runIngest, intervalMs: config.ingestIntervalMinutes * 60_000, logger: app.log });
}

await app.listen({ host: config.host, port: config.port });
console.log(`\n  PhoneFinder API listening on http://localhost:${config.port}  (db: ${db.kind}, adapters: ${config.adapterMode})`);

if (config.ingestOnStart) {
  if (!ready) console.log('  loading the catalog (first start) …');
  runIngest()
    .catch((err) => app.log.error(err, 'startup ingestion failed'))
    .finally(() => {
      if (!ready) console.log('  catalog ready\n');
      ready = true; // even if it failed: serve what exists instead of a permanent 503
    });
}

const shutdown = async (signal) => {
  console.log(`\n${signal} received, shutting down…`);
  scheduler?.stop();
  await app.close();
  await db.close();
  process.exit(0);
};
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
