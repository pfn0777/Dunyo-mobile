// Pure helpers for the Excel import flow (web/src/admin/pages/Import.tsx).
// Kept dependency-free (no xlsx, no fetch) so they're cheap to unit test.

import type { ImportResult, ImportRowError } from './types.ts';

// Real Dunyo headers, matching shared/src/importValidation.ts's HEADER_*
// constants exactly (case/apostrophe-insensitive on read, but the sample
// file is written with these canonical spellings).
export const SAMPLE_HEADERS = [
  'nomi',
  'brend',
  'kategoriya',
  'rang',
  'xotira',
  'narxi',
  'eski_narxi',
  'qoldigi',
  'kafolat_oyi',
  'artikul',
] as const;

/** Maps raw SheetJS `sheet_to_json` rows into the plain-object shape
 * `validateImportRow` expects, dropping fully-blank rows (SheetJS sometimes
 * emits a trailing {} for a blank trailing line). */
export function mapSheetRowsToRecords(sheetRows: readonly Record<string, unknown>[]): Record<string, unknown>[] {
  return sheetRows.filter((row) => {
    const values = Object.values(row);
    return values.some((value) => value !== undefined && value !== null && String(value).trim().length > 0);
  });
}

/** Splits `items` into consecutive chunks of at most `batchSize`, e.g.
 * 450 items with batchSize=200 -> [200, 200, 50]. */
export function splitIntoBatches<T>(items: readonly T[], batchSize: number): T[][] {
  if (batchSize <= 0) {
    throw new RangeError('batchSize must be positive');
  }
  const batches: T[][] = [];
  for (let start = 0; start < items.length; start += batchSize) {
    batches.push(items.slice(start, start + batchSize) as T[]);
  }
  return batches;
}

/** Combines per-batch server results (`{created, updated, errors}`) into one
 * running total, in batch order. Row numbers inside each batch's errors are
 * assumed already absolute (the caller remaps each batch's server-relative
 * row numbers back to the sheet's absolute row numbers before aggregating). */
export function aggregateImportResults(results: readonly ImportResult[]): ImportResult {
  return results.reduce<ImportResult>(
    (acc, result) => ({
      created: acc.created + result.created,
      updated: acc.updated + result.updated,
      errors: [...acc.errors, ...result.errors] as ImportRowError[],
    }),
    { created: 0, updated: 0, errors: [] },
  );
}
