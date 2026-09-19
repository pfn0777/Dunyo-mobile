// Thin `pg` layer: a small Db interface (query/queryOne/tx) plus typed
// wrappers around the two order RPCs defined in db/migrations/0003_rpc.sql.
//
// Postgres error codes matter here: create_order/set_order_status raise
// 22023 for a client-input bug (must map to HTTP 400) and XX000 for a
// server-side bug (must map to HTTP 500). Every raised error is re-thrown as
// a typed PgRpcError carrying that code so callers can branch on
// `error.code === '22023'` exactly like XUMO's callers did.
//
// Everything here is parameterized ($1, $2, ...) — never string-concatenate
// user input into SQL.

import { Pool, type PoolClient, type QueryResultRow } from 'pg';
import type { OrderStatus } from '@dunyo/shared';
import type { Env } from './env.js';
import type { CreateOrderRpcResult } from './orderErrors.js';

export function createPool(env: Pick<Env, 'DATABASE_URL'>): Pool {
  return new Pool({ connectionString: env.DATABASE_URL });
}

export interface Db {
  query<T extends QueryResultRow = QueryResultRow>(sql: string, params?: unknown[]): Promise<T[]>;
  queryOne<T extends QueryResultRow = QueryResultRow>(sql: string, params?: unknown[]): Promise<T | null>;
  tx<T>(fn: (db: Db) => Promise<T>): Promise<T>;
}

type Querier = Pick<Pool | PoolClient, 'query'>;

function buildDb(querier: Querier, txImpl: Db['tx']): Db {
  return {
    async query<T extends QueryResultRow = QueryResultRow>(sql: string, params: unknown[] = []): Promise<T[]> {
      const result = await querier.query<T>(sql, params);
      return result.rows;
    },
    async queryOne<T extends QueryResultRow = QueryResultRow>(sql: string, params: unknown[] = []): Promise<T | null> {
      const result = await querier.query<T>(sql, params);
      return result.rows[0] ?? null;
    },
    tx: txImpl,
  };
}

/** Builds the Db facade over a Pool. `tx` checks out a dedicated client,
 * runs BEGIN/COMMIT/ROLLBACK around the callback, and always releases it. */
export function createDb(pool: Pool): Db {
  const tx: Db['tx'] = async (fn) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      // Nested tx() calls inside the callback just reuse the same client/
      // transaction instead of opening a new one.
      const clientDb: Db = buildDb(client, async (innerFn) => innerFn(clientDb));
      const result = await fn(clientDb);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        console.error('db: rollback failed', rollbackError);
      }
      throw error;
    } finally {
      client.release();
    }
  };
  return buildDb(pool, tx);
}

// ---------------------------------------------------------------------------
// RPC error handling
// ---------------------------------------------------------------------------

export class PgRpcError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'PgRpcError';
    this.code = code;
  }
}

function toPgRpcError(error: unknown): PgRpcError {
  if (error instanceof PgRpcError) {
    return error;
  }
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = (error as { code?: unknown }).code;
    if (typeof code === 'string') {
      const message = error instanceof Error ? error.message : `Postgres error ${code}`;
      return new PgRpcError(code, message);
    }
  }
  const message = error instanceof Error ? error.message : 'Unknown Postgres RPC error';
  return new PgRpcError('XX000', message);
}

// ---------------------------------------------------------------------------
// Typed RPC wrappers
// ---------------------------------------------------------------------------

export async function createOrderRpc(db: Db, userId: number, payload: unknown): Promise<CreateOrderRpcResult> {
  try {
    const row = await db.queryOne<{ result: CreateOrderRpcResult }>(
      'select public.create_order($1, $2::jsonb) as result',
      [userId, JSON.stringify(payload)],
    );
    if (row === null) {
      throw new PgRpcError('XX000', 'create_order returned no row');
    }
    return row.result;
  } catch (error) {
    throw toPgRpcError(error);
  }
}

export type SetOrderStatusRpcResult =
  | { ok: true; order_id: number; from: OrderStatus; to: OrderStatus; user_id: number; order_no: string }
  | { ok: false; code: 'invalid_transition'; from: OrderStatus; to: OrderStatus };

export async function setOrderStatusRpc(
  db: Db,
  orderId: number,
  to: OrderStatus,
  adminId: number,
  trackingNote: string | null,
): Promise<SetOrderStatusRpcResult> {
  try {
    const row = await db.queryOne<{ result: SetOrderStatusRpcResult }>(
      'select public.set_order_status($1, $2::public.order_status, $3, $4) as result',
      [orderId, to, adminId, trackingNote],
    );
    if (row === null) {
      throw new PgRpcError('XX000', 'set_order_status returned no row');
    }
    return row.result;
  } catch (error) {
    throw toPgRpcError(error);
  }
}
