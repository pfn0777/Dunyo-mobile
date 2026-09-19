import { describe, expect, it } from 'vitest';
import { decideInstallmentLine } from '../installmentLine.ts';
import { INSTALLMENT_MIN_PRICE } from '../../../../shared/src/installment.ts';

describe('decideInstallmentLine', () => {
  it('returns the monthly estimate for a price at or above the threshold', () => {
    expect(decideInstallmentLine(17_800_000, 12)).toEqual({ monthly: 1_483_000, months: 12 });
  });

  it('returns null below INSTALLMENT_MIN_PRICE (e.g. a cheap accessory)', () => {
    expect(decideInstallmentLine(280_000, 12)).toBeNull();
    expect(decideInstallmentLine(INSTALLMENT_MIN_PRICE - 1, 12)).toBeNull();
  });

  it('returns null for a non-positive months value (no dividing by zero)', () => {
    expect(decideInstallmentLine(5_000_000, 0)).toBeNull();
    expect(decideInstallmentLine(5_000_000, -1)).toBeNull();
  });

  it('carries the months through so the badge can render "0-0-N"', () => {
    expect(decideInstallmentLine(6_000_000, 6)?.months).toBe(6);
  });
});
