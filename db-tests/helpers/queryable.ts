/**
 * The minimal query surface the fixtures and RPC helpers need. PGlite
 * satisfies it directly; a `pg.Pool` is adapted in `pgDb.ts`.
 */
export interface Queryable {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  query<T = any>(sql: string, params?: any[]): Promise<{ rows: T[] }>;
}
