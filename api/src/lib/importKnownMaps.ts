// Builds the knownBrands/knownCategories lookup maps that
// @dunyo/shared's validateImportRow needs, from the brands/categories rows
// already in the DB. The normalization here MUST match
// shared/src/importValidation.ts's private normalizeKey exactly (trim,
// lowercase, then fold curly/backtick apostrophe variants to a straight
// one) — otherwise a brand name that round-trips fine inside shared's own
// tests could still fail to resolve here purely because of a normalization
// mismatch between the two modules. It is duplicated rather than imported
// because normalizeKey is a private, unexported implementation detail of
// importValidation.ts.

const APOSTROPHE_VARIANTS = /[‘’ʻʼ`]/g;

export function normalizeImportKey(value: string): string {
  return value.trim().toLowerCase().replace(APOSTROPHE_VARIANTS, "'");
}

export interface NamedRow {
  id: number;
  name: string;
}

/** Builds a normalized-name -> id lookup map for validateImportRow's
 * knownBrands/knownCategories parameters. */
export function buildKnownNameMap(rows: readonly NamedRow[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const row of rows) {
    map.set(normalizeImportKey(row.name), row.id);
  }
  return map;
}
