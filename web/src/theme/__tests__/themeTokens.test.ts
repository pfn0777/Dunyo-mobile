import { describe, expect, it } from 'vitest';
import { cssVarName, hexToChannels, themeCss } from '../css.ts';
import { darkTokens, lightTokens, TOKEN_NAMES } from '../tokens.ts';

describe('theme tokens', () => {
  it('light and dark define exactly the same token names', () => {
    expect(Object.keys(lightTokens).sort()).toEqual(Object.keys(darkTokens).sort());
  });

  it('every value is a #rrggbb colour', () => {
    for (const tokens of [darkTokens, lightTokens]) {
      for (const [name, value] of Object.entries(tokens)) {
        expect(value, name).toMatch(/^#[0-9a-f]{6}$/i);
      }
    }
  });

  it('the light theme actually differs from dark for the page surface', () => {
    expect(lightTokens.surface).not.toBe(darkTokens.surface);
  });

  it('nasiya (installment) is mint in dark and emerald in light, independent of secondary', () => {
    expect(darkTokens.installment).toBe('#43ffbb');
    expect(lightTokens.installment).toBe('#059669');
    expect(lightTokens.secondary).toBe('#575e70');
  });
});

describe('themeCss', () => {
  it('converts hex to space-separated channels', () => {
    expect(hexToChannels('#ffd682')).toBe('255 214 130');
    expect(hexToChannels('#000000')).toBe('0 0 0');
  });

  it('rejects malformed colours instead of emitting broken CSS', () => {
    expect(() => hexToChannels('ffd682')).toThrow();
    expect(() => hexToChannels('#fff')).toThrow();
  });

  it('emits every token in both :root (light) and :root.dark blocks', () => {
    const css = themeCss();
    const [lightBlock, darkBlock] = css.split('\n');
    expect(lightBlock?.startsWith(':root{color-scheme:light;')).toBe(true);
    expect(darkBlock?.startsWith(':root.dark{color-scheme:dark;')).toBe(true);
    for (const name of TOKEN_NAMES) {
      expect(lightBlock).toContain(`${cssVarName(name)}:`);
      expect(darkBlock).toContain(`${cssVarName(name)}:`);
    }
  });
});
