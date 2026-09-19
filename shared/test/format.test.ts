import { describe, expect, it } from 'vitest';
import { formatSom } from '../src/format.ts';

describe('formatSom', () => {
  it('groups thousands with a regular space', () => {
    expect(formatSom(67500)).toBe("67 500 so'm");
    expect(formatSom(1250000)).toBe("1 250 000 so'm");
    expect(formatSom(0)).toBe("0 so'm");
  });
});
