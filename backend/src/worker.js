/**
 * Stand-alone collector process: `npm run worker`.
 * Use it in production together with RUN_SCHEDULER=false on the API servers.
 */
import { loadConfig } from './config.js';
import { createDb } from './db/index.js';
import { runMigrations } from './db/migrate.js';
import { runIngestion } from './ingestion/pipeline.js';
import { startScheduler } from './ingestion/scheduler.js';

const config = loadConfig();
if (!config.databaseUrl) {
  console.error('The worker needs DATABASE_URL (a shared PostgreSQL); an in-memory DB would not be visible to the API.');
  process.exit(1);
}
const db = await createDb(config);
await runMigrations(db);

const run = async () => {
  const r = await runIngestion({ db, config });
  console.log(new Date().toISOString(), JSON.stringify(r.stores.map((s) => ({ store: s.storeId, status: s.status }))));
};
const scheduler = startScheduler({ run, intervalMs: config.ingestIntervalMinutes * 60_000, runImmediately: true });
console.log(`worker started, every ${config.ingestIntervalMinutes} min`);

const stop = async () => {
  scheduler.stop();
  await db.close();
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
