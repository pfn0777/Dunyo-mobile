export const IMPORT_MAX_ROWS = 5000;
export const IMPORT_MAX_FILE_BYTES = 5 * 1024 * 1024;
export const IMPORT_BATCH_SIZE = 200;

const DEFAULT_WARRANTY_MONTHS = 12;

export interface ImportedVariantRow {
  name: string;
  brandId: number;
  categoryId: number;
  colorName: string;
  storageGb: number | null;
  price: number;
  oldPrice: number | null;
  stock: number;
  warrantyMonths: number;
  sku: string | null;
}

export type ImportRowResult =
  | { ok: true; rowNumber: number; value: ImportedVariantRow }
  | { ok: false; rowNumber: number; errors: string[] };

const HEADER_NAME = 'nomi';
const HEADER_BRAND = 'brend';
const HEADER_CATEGORY = 'kategoriya';
const HEADER_COLOR = 'rang';
const HEADER_STORAGE = 'xotira';
const HEADER_PRICE = 'narxi';
const HEADER_OLD_PRICE = 'eski_narxi';
const HEADER_STOCK = 'qoldigi';
const HEADER_WARRANTY = 'kafolat_oyi';
const HEADER_SKU = 'artikul';

const APOSTROPHE_VARIANTS = /[‘’ʻʼ`]/g;

function normalizeApostrophes(value: string): string {
  return value.replace(APOSTROPHE_VARIANTS, "'");
}

function normalizeKey(value: string): string {
  return normalizeApostrophes(value.trim().toLowerCase());
}

function buildHeaderLookup(raw: Record<string, unknown>): Map<string, unknown> {
  const lookup = new Map<string, unknown>();
  for (const [key, value] of Object.entries(raw)) {
    lookup.set(normalizeKey(key), value);
  }
  return lookup;
}

function valueToTrimmedString(value: unknown): string | null {
  if (typeof value === 'string') {
    return value.trim();
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  return null;
}

/** Parses an integer from a number or a numeric string that may contain spaces/NBSP as thousand separators ("1 200 000"). */
function parseIntegerField(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isInteger(value) ? value : null;
  }
  if (typeof value === 'string') {
    const compact = value.replace(/\s/g, '');
    if (!/^\d+$/.test(compact)) {
      return null;
    }
    return Number.parseInt(compact, 10);
  }
  return null;
}

/**
 * Resolves a free-text lookup value (brand/category name) against a
 * case-insensitive, apostrophe-normalized map, the same way header names
 * are normalized.
 */
function lookupByName(map: ReadonlyMap<string, number>, name: string): number | null {
  return map.get(normalizeKey(name)) ?? null;
}

/**
 * Validates one Excel import row against the spec rules for a product
 * variant. Header lookup is case-insensitive, trimmed, and tolerant of
 * straight/curly apostrophe variants in header names.
 */
export function validateImportRow(
  raw: Record<string, unknown>,
  rowNumber: number,
  knownBrands: ReadonlyMap<string, number>,
  knownCategories: ReadonlyMap<string, number>,
): ImportRowResult {
  const lookup = buildHeaderLookup(raw);
  const errors: string[] = [];

  const name = valueToTrimmedString(lookup.get(HEADER_NAME));
  if (name === null || name.length === 0) {
    errors.push("Nomi bo'sh bo'lmasligi kerak");
  }

  const brandNameRaw = valueToTrimmedString(lookup.get(HEADER_BRAND));
  let brandId: number | null = null;
  if (brandNameRaw === null || brandNameRaw.length === 0) {
    errors.push("Brend bo'sh bo'lmasligi kerak");
  } else {
    brandId = lookupByName(knownBrands, brandNameRaw);
    if (brandId === null) {
      errors.push(`Brend topilmadi: ${brandNameRaw}`);
    }
  }

  const categoryNameRaw = valueToTrimmedString(lookup.get(HEADER_CATEGORY));
  let categoryId: number | null = null;
  if (categoryNameRaw === null || categoryNameRaw.length === 0) {
    errors.push("Kategoriya bo'sh bo'lmasligi kerak");
  } else {
    categoryId = lookupByName(knownCategories, categoryNameRaw);
    if (categoryId === null) {
      errors.push(`Kategoriya topilmadi: ${categoryNameRaw}`);
    }
  }

  const colorName = valueToTrimmedString(lookup.get(HEADER_COLOR));
  if (colorName === null || colorName.length === 0) {
    errors.push("Rang bo'sh bo'lmasligi kerak");
  }

  const storageRaw = valueToTrimmedString(lookup.get(HEADER_STORAGE));
  let storageGb: number | null = null;
  let storageValid = true;
  if (storageRaw !== null && storageRaw.length > 0) {
    const parsedStorage = parseIntegerField(storageRaw);
    if (parsedStorage === null || parsedStorage <= 0) {
      errors.push("Xotira bo'sh yoki musbat butun son (GB) bo'lishi kerak");
      storageValid = false;
    } else {
      storageGb = parsedStorage;
    }
  }

  const price = parseIntegerField(lookup.get(HEADER_PRICE));
  if (price === null || price <= 0) {
    errors.push("Narxi musbat butun son bo'lishi kerak");
  }

  const oldPriceRaw = valueToTrimmedString(lookup.get(HEADER_OLD_PRICE));
  let oldPrice: number | null = null;
  let oldPriceValid = true;
  if (oldPriceRaw !== null && oldPriceRaw.length > 0) {
    const parsedOldPrice = parseIntegerField(oldPriceRaw);
    if (parsedOldPrice === null || parsedOldPrice <= 0) {
      errors.push("Eski narxi bo'sh yoki musbat butun son bo'lishi kerak");
      oldPriceValid = false;
    } else if (price !== null && parsedOldPrice <= price) {
      errors.push("Eski narxi yangi narxidan katta bo'lishi kerak");
      oldPriceValid = false;
    } else {
      oldPrice = parsedOldPrice;
    }
  }

  const stock = parseIntegerField(lookup.get(HEADER_STOCK));
  if (stock === null || stock < 0) {
    errors.push("Qoldig'i 0 yoki musbat butun son bo'lishi kerak");
  }

  const warrantyRaw = valueToTrimmedString(lookup.get(HEADER_WARRANTY));
  let warrantyMonths: number | null = DEFAULT_WARRANTY_MONTHS;
  let warrantyValid = true;
  if (warrantyRaw !== null && warrantyRaw.length > 0) {
    const parsedWarranty = parseIntegerField(warrantyRaw);
    if (parsedWarranty === null || parsedWarranty < 0) {
      errors.push("Kafolat oyi 0 yoki musbat butun son bo'lishi kerak");
      warrantyMonths = null;
      warrantyValid = false;
    } else {
      warrantyMonths = parsedWarranty;
    }
  }

  const skuRaw = valueToTrimmedString(lookup.get(HEADER_SKU));
  const sku = skuRaw !== null && skuRaw.length > 0 ? skuRaw : null;

  if (
    errors.length > 0 ||
    name === null ||
    brandId === null ||
    categoryId === null ||
    colorName === null ||
    !storageValid ||
    price === null ||
    !oldPriceValid ||
    stock === null ||
    !warrantyValid ||
    warrantyMonths === null
  ) {
    return { ok: false, rowNumber, errors };
  }

  return {
    ok: true,
    rowNumber,
    value: {
      name,
      brandId,
      categoryId,
      colorName,
      storageGb,
      price,
      oldPrice,
      stock,
      warrantyMonths,
      sku,
    },
  };
}
