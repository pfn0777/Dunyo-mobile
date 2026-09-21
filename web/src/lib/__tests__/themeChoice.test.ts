import { describe, expect, it } from 'vitest';
import { defaultChoice, otherTheme, parseThemeChoice, resolveThemeChoice } from '../themeChoice.ts';

describe('parseThemeChoice', () => {
  it('returns null when nothing is stored', () => {
    expect(parseThemeChoice(null)).toBeNull();
  });

  it('parses a valid value', () => {
    expect(parseThemeChoice('{"theme":"dark","updatedAt":5}')).toEqual({ theme: 'dark', updatedAt: 5 });
  });

  it('throws on malformed JSON, unknown theme, or bad updatedAt (caller logs and falls back)', () => {
    expect(() => parseThemeChoice('{oops')).toThrow();
    expect(() => parseThemeChoice('"dark"')).toThrow();
    expect(() => parseThemeChoice('{"theme":"sepia","updatedAt":1}')).toThrow();
    expect(() => parseThemeChoice('{"theme":"dark"}')).toThrow();
    expect(() => parseThemeChoice('{"theme":"dark","updatedAt":"1"}')).toThrow();
  });
});

describe('resolveThemeChoice', () => {
  const dark = (updatedAt: number) => ({ theme: 'dark' as const, updatedAt });
  const light = (updatedAt: number) => ({ theme: 'light' as const, updatedAt });

  it('defaults to light when nothing is stored anywhere', () => {
    expect(resolveThemeChoice(null, null)).toEqual(defaultChoice());
    expect(defaultChoice().theme).toBe('light');
  });

  it('uses whichever side exists', () => {
    expect(resolveThemeChoice(dark(1), null)).toEqual(dark(1));
    expect(resolveThemeChoice(null, dark(2))).toEqual(dark(2));
  });

  it('newer updatedAt wins', () => {
    expect(resolveThemeChoice(light(1000), dark(2000))).toEqual(dark(2000));
    expect(resolveThemeChoice(dark(3000), light(2000))).toEqual(dark(3000));
  });

  it('local wins on a tie', () => {
    expect(resolveThemeChoice(dark(5), light(5))).toEqual(dark(5));
  });
});

describe('otherTheme', () => {
  it('toggles', () => {
    expect(otherTheme('light')).toBe('dark');
    expect(otherTheme('dark')).toBe('light');
  });
});
