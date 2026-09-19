import { describe, expect, it } from 'vitest';
import { discountPercent } from '../discount.ts';

describe('discountPercent', () => {
  it('returns null when there is no old price', () => {
    expect(discountPercent(1000, null)).toBeNull();
  });

  it('rounds the percentage off', () => {
    expect(discountPercent(15000, 20000)).toBe(25);
    expect(discountPercent(9000, 11000)).toBe(18);
  });

  it('returns null for a non-positive old price', () => {
    expect(discountPercent(1000, 0)).toBeNull();
  });
});
