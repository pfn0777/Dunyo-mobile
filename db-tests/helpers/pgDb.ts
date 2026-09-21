import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import type { Queryable } from './queryable.ts';

const MIGRATIONS_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../db/migrations',
);

const PG_INT8_OID = 20;
// Enough connections for the widest concurrent burst in the tests.
const POOL_MAX = 30;

export interface PgTestDb extends Queryable {
  pool: pg.Pool;
  close(): Promise<void>;
}

/**
 * Connects to a real Postgres (TEST_DATABASE_URL), wipes the `public` schema
 * and applies every migration in filename order. Unlike PGlite this gives
 * true multi-connection concurrency, which is the point of these tests.
 *
 * bigint columns (ids, money) are parsed to JS numbers so fixtures and
 * assertions behave the same as against PGlite.
 */
export async function createPgTestDb(connectionString: string): Promise<PgTestDb> {
  const pool = new pg.Pool({
    connectionString,
    max: POOL_MAX,
    types: {
      getTypeParser: ((oid: number, format?: 'text' | 'binary') =>
        oid === PG_INT8_OID
          ? Number
          : pg.types.getTypeParser(oid, format as 'text')) as typeof pg.types.getTypeParser,
    },
  });

  await pool.query('drop schema if exists public cascade; create schema public;');

  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();
  for (const file of files) {
    await pool.query(readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8'));
  }

  return {
    pool,
    query: async <T>(sql: string, params?: unknown[]) => {
      const res = await pool.query(sql, params);
      return { rows: res.rows as T[] };
    },
    close: () => pool.end(),
  };
}
