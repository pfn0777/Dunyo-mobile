import { PGlite } from '@electric-sql/pglite';
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const MIGRATIONS_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../db/migrations',
);

function isTrgmDependent(fileName: string): boolean {
  return fileName.includes('_search_index.');
}

/**
 * Creates a fresh in-memory PGlite database and applies every migration in
 * db/migrations, in filename order.
 *
 * Unlike XUMO MARKET's test bootstrap, no role-creation SQL runs first:
 * Dunyo Mobile has no RLS and no anon/authenticated/service_role roles at
 * all (see the header comment in 0001_init.sql) -- the Fastify API is the
 * sole DB client, so there is nothing to provision here.
 *
 * Migrations that depend on pg_trgm are skipped (and only those) if the
 * extension turns out to be unavailable in this environment; any other
 * migration failing is a hard rethrow.
 */
export async function createTestDb(): Promise<PGlite> {
  const db = new PGlite({ extensions: { pg_trgm } });

  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  let trgmAvailable = true;

  for (const file of files) {
    if (isTrgmDependent(file) && !trgmAvailable) {
      continue;
    }
    const sql = readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
    try {
      await db.exec(sql);
    } catch (err) {
      if (isTrgmDependent(file)) {
        trgmAvailable = false;
        continue;
      }
      throw err;
    }
  }

  return db;
}
