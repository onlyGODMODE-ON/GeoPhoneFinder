/**
 * Tiny database facade so the rest of the code does not care whether it talks to
 * PostgreSQL (`pg`) or the embedded PGlite. Both speak the same SQL dialect.
 *
 *   db.query(sql, params) -> { rows }
 *   db.exec(sql)          -> run a multi-statement script (migrations)
 *   db.tx(fn)             -> fn({ query }) inside BEGIN/COMMIT
 *   db.close()
 */
export async function createDb({ databaseUrl, pgSsl = false, pgliteDir = null } = {}) {
  if (databaseUrl) {
    const { default: pg } = await import('pg');
    const pool = new pg.Pool({
      connectionString: databaseUrl,
      max: 10,
      ssl: pgSsl ? { rejectUnauthorized: false } : undefined,
    });
    return {
      kind: 'postgres',
      query: (sql, params = []) => pool.query(sql, params),
      exec: (sql) => pool.query(sql),
      async tx(fn) {
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          const out = await fn({ query: (s, p = []) => client.query(s, p) });
          await client.query('COMMIT');
          return out;
        } catch (err) {
          await client.query('ROLLBACK').catch(() => {});
          throw err;
        } finally {
          client.release();
        }
      },
      close: () => pool.end(),
    };
  }

  const { PGlite } = await import('@electric-sql/pglite');
  const pglite = new PGlite(pgliteDir || undefined); // undefined => in-memory
  await pglite.waitReady;
  return {
    kind: 'pglite',
    query: (sql, params = []) => pglite.query(sql, params),
    exec: (sql) => pglite.exec(sql),
    tx: (fn) => pglite.transaction((t) => fn({ query: (s, p = []) => t.query(s, p) })),
    close: () => pglite.close(),
  };
}
