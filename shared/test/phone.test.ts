import { describe, expect, it } from 'vitest';
import { normalizePhone } from '../src/phone.ts';

describe('normalizePhone', () => {
  it('normalizes a formatted +998 number', () => {
    expect(normalizePhone('+998 90 123-45-67')).toBe('+998901234567');
  });

  it('normalizes a bare 998-prefixed number', () => {
    expect(normalizePhone('998901234567')).toBe('+998901234567');
  });

  it('normalizes a 9-digit local number', () => {
    expect(normalizePhone('901234567')).toBe('+998901234567');
  });

  it('rejects a non-Uzbek country code', () => {
    expect(normalizePhone('+79991234567')).toBeNull();
  });

  it('rejects an 8-digit number', () => {
    expect(normalizePhone('90123456')).toBeNull();
  });
});
