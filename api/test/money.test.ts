import { describe, expect, it } from 'vitest';
import { toNullableNumber, toNumber } from '../src/lib/money';

describe('toNumber', () => {
  it('converts a bigint-string column to a number', () => {
    expect(toNumber('17800000')).toBe(17800000);
  });

  it('passes an already-numeric value through unchanged', () => {
    expect(toNumber(42)).toBe(42);
  });
});

describe('toNullableNumber', () => {
  it('converts a non-null string', () => {
    expect(toNullableNumber('500000')).toBe(500000);
  });

  it('passes null through', () => {
    expect(toNullableNumber(null)).toBeNull();
  });
});
