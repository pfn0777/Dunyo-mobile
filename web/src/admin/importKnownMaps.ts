// Builds the knownBrands/knownCategories lookup maps that
// @dunyo/shared's validateImportRow needs, from the brands/categories rows
// already loaded in the admin panel. The normalization here MUST match
// api/src/lib/importKnownMaps.ts's normalizeImportKey exactly (trim,
// lowercase, then fold curly/backtick apostrophe variants to a straight
// one) — otherwise a brand name that resolves server-side during the real
// import could still fail to resolve in this client-side preview table
// purely because of a normalization mismatch between the two copies. It is
// duplicated (not imported) because normalizeKey is a private, unexported
// implementation detail of shared/src/importValidation.ts, and this module
// must not import from api/.

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
