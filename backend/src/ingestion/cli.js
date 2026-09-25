import { loadConfig } from '../config.js';
import { createDb } from '../db/index.js';
import { runMigrations } from '../db/migrate.js';
import { runIngestion } from './pipeline.js';

const config = loadConfig();
if (!config.databaseUrl && !config.pgliteDir) {
  console.warn('⚠ No DATABASE_URL / PGLITE_DIR: using an in-memory database, results are discarded when this command exits.');
}
const db = await createDb(config);
await runMigrations(db);
const result = await runIngestion({ db, config });
console.log(JSON.stringify(result, null, 2));
await db.close();
