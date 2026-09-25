import { loadConfig } from '../config.js';
import { createDb } from './index.js';
import { runMigrations } from './migrate.js';

const config = loadConfig();
const db = await createDb(config);
await runMigrations(db, (m) => console.log(m));
console.log(`migrations up to date (${db.kind})`);
await db.close();
