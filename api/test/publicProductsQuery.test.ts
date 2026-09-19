import { describe, expect, it } from 'vitest';
import { parseIdsParam, parseProductsListQuery, PRODUCTS_BY_IDS_MAX } from '../src/lib/publicProductsQuery';

describe('parseProductsListQuery', () => {
  it('defaults page to 1 and sort to popular', () => {
    expect(parseProductsListQuery({})).toEqual({
      page: 1,
      q: null,
      categoryId: null,
      brandId: null,
      discountOnly: false,
      sort: 'popular',
    });
  });

  it('clamps a junk page to 1', () => {
    expect(parseProductsListQuery({ page: '0' }).page).toBe(1);
    expect(parseProductsListQuery({ page: '-5' }).page).toBe(1);
    expect(parseProductsListQuery({ page: 'abc' }).page).toBe(1);
  });

  it('accepts a valid page', () => {
    expect(parseProductsListQuery({ page: '3' }).page).toBe(3);
  });

  it('trims and empties out a blank q', () => {
    expect(parseProductsListQuery({ q: '  iphone  ' }).q).toBe('iphone');
    expect(parseProductsListQuery({ q: '   ' }).q).toBeNull();
  });

  it('drops a non-numeric category_id/brand_id instead of throwing', () => {
    expect(parseProductsListQuery({ category_id: 'abc' }).categoryId).toBeNull();
    expect(parseProductsListQuery({ brand_id: '-1' }).brandId).toBeNull();
    expect(parseProductsListQuery({ category_id: '5' }).categoryId).toBe(5);
  });

  it('reads discount_only only from the literal "1"', () => {
    expect(parseProductsListQuery({ discount_only: '1' }).discountOnly).toBe(true);
    expect(parseProductsListQuery({ discount_only: 'true' }).discountOnly).toBe(false);
    expect(parseProductsListQuery({}).discountOnly).toBe(false);
  });

  it('rejects an unknown sort value, falling back to popular', () => {
    expect(parseProductsListQuery({ sort: 'random' }).sort).toBe('popular');
    expect(parseProductsListQuery({ sort: 'discount' }).sort).toBe('discount');
  });
});

describe('parseIdsParam', () => {
  it('parses a comma-separated list', () => {
    expect(parseIdsParam('1,2,3')).toEqual([1, 2, 3]);
  });

  it('drops non-numeric entries', () => {
    expect(parseIdsParam('1,abc,3,-4,0,5.5')).toEqual([1, 3]);
  });

  it('returns an empty array for a missing/blank param', () => {
    expect(parseIdsParam(undefined)).toEqual([]);
    expect(parseIdsParam('  ')).toEqual([]);
  });

  it('caps at 100 ids', () => {
    const raw = Array.from({ length: 150 }, (_, i) => String(i + 1)).join(',');
    const result = parseIdsParam(raw);
    expect(result).toHaveLength(PRODUCTS_BY_IDS_MAX);
    expect(result[0]).toBe(1);
    expect(result[PRODUCTS_BY_IDS_MAX - 1]).toBe(100);
  });

  it('honors a custom max', () => {
    expect(parseIdsParam('1,2,3,4,5', 2)).toEqual([1, 2]);
  });
});
