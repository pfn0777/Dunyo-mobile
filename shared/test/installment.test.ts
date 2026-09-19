import { describe, expect, it } from 'vitest';
import { installmentMonthly } from '../src/installment.ts';

describe('installmentMonthly', () => {
  it('computes the floored monthly figure for a qualifying price', () => {
    expect(installmentMonthly(17_800_000, 12)).toBe(1_483_000);
    expect(installmentMonthly(14_200_000, 12)).toBe(1_183_000);
  });

  it('returns null below the minimum price', () => {
    expect(installmentMonthly(280_000, 12)).toBeNull();
  });

  it('returns null when months is zero or negative', () => {
    expect(installmentMonthly(5_000_000, 0)).toBeNull();
    expect(installmentMonthly(5_000_000, -1)).toBeNull();
  });

  it('allows a price exactly at the minimum', () => {
    expect(installmentMonthly(1_000_000, 12)).toBe(83_000);
  });

  it('returns null for non-finite inputs', () => {
    expect(installmentMonthly(Number.NaN, 12)).toBeNull();
    expect(installmentMonthly(Number.POSITIVE_INFINITY, 12)).toBeNull();
    expect(installmentMonthly(5_000_000, Number.NaN)).toBeNull();
    expect(installmentMonthly(5_000_000, Number.POSITIVE_INFINITY)).toBeNull();
  });
});
