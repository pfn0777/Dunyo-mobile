import { describe, expect, it } from 'vitest';
import { aggregateImportResults, mapSheetRowsToRecords, SAMPLE_HEADERS, splitIntoBatches } from '../importHelpers.ts';

describe('SAMPLE_HEADERS', () => {
  it('matches the real Dunyo import headers', () => {
    expect(SAMPLE_HEADERS).toEqual([
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
    ]);
  });
});

describe('mapSheetRowsToRecords', () => {
  it('passes through non-empty rows unchanged', () => {
    const rows = [{ nomi: 'iPhone 15', narxi: 9850000 }];
    expect(mapSheetRowsToRecords(rows)).toEqual(rows);
  });

  it('drops fully-blank trailing rows', () => {
    const rows = [{ nomi: 'iPhone 15', narxi: 9850000 }, {}, { nomi: '', narxi: '' }];
    expect(mapSheetRowsToRecords(rows)).toEqual([{ nomi: 'iPhone 15', narxi: 9850000 }]);
  });
});

describe('splitIntoBatches', () => {
  it('splits 450 rows into 200/200/50 batches', () => {
    const items = Array.from({ length: 450 }, (_, i) => i);
    const batches = splitIntoBatches(items, 200);
    expect(batches.map((b) => b.length)).toEqual([200, 200, 50]);
    expect(batches.flat()).toEqual(items);
  });

  it('returns a single batch when items fit within batchSize', () => {
    expect(splitIntoBatches([1, 2, 3], 200)).toEqual([[1, 2, 3]]);
  });

  it('returns an empty array for no items', () => {
    expect(splitIntoBatches([], 200)).toEqual([]);
  });

  it('throws for a non-positive batchSize', () => {
    expect(() => splitIntoBatches([1], 0)).toThrow(RangeError);
  });
});

describe('aggregateImportResults', () => {
  it('sums created/updated and concatenates errors across batches, remapped to absolute row numbers', () => {
    const result = aggregateImportResults([
      { created: 150, updated: 40, errors: [{ rowNumber: 12, errors: ['bad'] }] },
      { created: 5, updated: 190, errors: [] },
      { created: 0, updated: 50, errors: [{ rowNumber: 447, errors: ['bad2'] }] },
    ]);
    expect(result.created).toBe(155);
    expect(result.updated).toBe(280);
    expect(result.errors).toEqual([
      { rowNumber: 12, errors: ['bad'] },
      { rowNumber: 447, errors: ['bad2'] },
    ]);
  });

  it('returns zeros for an empty batch list', () => {
    expect(aggregateImportResults([])).toEqual({ created: 0, updated: 0, errors: [] });
  });
});
