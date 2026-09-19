// Postgres sends `bigint`/`numeric` columns over the wire as strings (the
// node-postgres driver does this to avoid silent precision loss past
// Number.MAX_SAFE_INTEGER). Every route converts them back to `number` at the
// query boundary — right after reading the row, before it goes into a JSON
// response — so the Mini App always receives numbers it can do arithmetic on
// directly, never a string it would have to parse itself.

/** Converts a bigint/numeric column value (string or already-a-number) to a number. */
export function toNumber(value: string | number): number {
  return typeof value === 'number' ? value : Number(value);
}

/** Same as toNumber, but passes null through unchanged (for nullable money columns). */
export function toNullableNumber(value: string | number | null): number | null {
  return value === null ? null : toNumber(value);
}
