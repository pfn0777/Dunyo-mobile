import { describe, expect, it } from 'vitest';
import { compositeOver, contrastRatio, WCAG_AA_LARGE_OR_UI, WCAG_AA_TEXT } from '../contrast.ts';
import { THEME_NAMES, tokensFor, type TokenName } from '../tokens.ts';

// Surfaces normal text sits on: page, cards, low containers.
const TEXT_BACKGROUNDS: TokenName[] = ['surface', 'surface-container', 'surface-container-low'];
// Tokens used as text colour (`text-*` classes).
const TEXT_FOREGROUNDS: TokenName[] = [
  'on-surface',
  'on-surface-variant',
  'outline',
  'secondary',
  'primary-text',
  'installment-text',
  'error',
  'tertiary',
];
// Filled surfaces with their label colour (buttons, badges, toast, chips).
const FILLED_PAIRS: Array<[fg: TokenName, bg: TokenName]> = [
  ['on-primary', 'primary'],
  ['on-secondary', 'secondary'],
  ['on-tertiary', 'tertiary'],
  ['on-error', 'error'],
  ['on-primary-container', 'primary-container'],
  ['on-secondary-container', 'secondary-container'],
  ['on-error-container', 'error-container'],
  ['inverse-on-surface', 'inverse-surface'],
];
// Non-text UI parts (icons, focus/active accents) need 3:1 against the page.
const UI_ON_SURFACE: TokenName[] = ['primary', 'installment', 'outline'];
// Deliberately not checked: `outline-variant` (decorative hairline borders),
// the `*-fixed*` / `surface-tint` / `inverse-primary` tokens (unused for text).

describe.each(THEME_NAMES)('%s theme contrast (WCAG AA)', (theme) => {
  const tokens = tokensFor(theme);

  // Skeletons/placeholder tiles are decorative, but must not disappear into the
  // page or a card. Dark deliberately keeps the original skeleton == card colour
  // (unchanged look), so the card check is light-only.
  const skeletonBackgrounds = theme === 'light' ? (['surface', 'surface-container'] as const) : (['surface'] as const);
  for (const bg of skeletonBackgrounds) {
    it(`skeleton is distinguishable from ${bg} (>= 1.1)`, () => {
      const ratio = contrastRatio(tokens.skeleton, tokens[bg]);
      expect(ratio, `skeleton ${tokens.skeleton} on ${bg} ${tokens[bg]} = ${ratio.toFixed(2)}`).toBeGreaterThanOrEqual(1.1);
    });
  }

  for (const bg of TEXT_BACKGROUNDS) {
    for (const fg of TEXT_FOREGROUNDS) {
      it(`text ${fg} on ${bg} >= ${WCAG_AA_TEXT}`, () => {
        const ratio = contrastRatio(tokens[fg], tokens[bg]);
        expect(ratio, `${fg} ${tokens[fg]} on ${bg} ${tokens[bg]} = ${ratio.toFixed(2)}`).toBeGreaterThanOrEqual(WCAG_AA_TEXT);
      });
    }
  }

  for (const [fg, bg] of FILLED_PAIRS) {
    it(`label ${fg} on ${bg} >= ${WCAG_AA_TEXT}`, () => {
      const ratio = contrastRatio(tokens[fg], tokens[bg]);
      expect(ratio, `${fg} ${tokens[fg]} on ${bg} ${tokens[bg]} = ${ratio.toFixed(2)}`).toBeGreaterThanOrEqual(WCAG_AA_TEXT);
    });
  }

  for (const fg of UI_ON_SURFACE) {
    it(`UI ${fg} on surface >= ${WCAG_AA_LARGE_OR_UI}`, () => {
      const ratio = contrastRatio(tokens[fg], tokens.surface);
      expect(ratio, `${fg} ${tokens[fg]} on surface = ${ratio.toFixed(2)}`).toBeGreaterThanOrEqual(WCAG_AA_LARGE_OR_UI);
    });
  }
});

// Component boundaries (WCAG 1.4.11 non-text contrast, 3:1).
// Keep in sync with `border-outline/80` in States.tsx (ErrorState button) and
// ProductSheet.tsx (storage chip); those are light-only, dark keeps its own look.
const BORDER_OUTLINE_ALPHA = 0.8;
// Darkest colour swatch in the mock catalogue; the swatch ring must stay visible on it.
const DARKEST_SWATCH = '#2b2b2b';

describe('component borders (3:1 non-text contrast)', () => {
  const light = tokensFor('light');

  it('light: outline/80 border stands out from the page, cards and the sheet', () => {
    const pairs: Array<[over: TokenName, against: TokenName]> = [
      ['surface-container', 'surface'], // ErrorState button on the page
      ['surface-container', 'surface-container'],
      ['surface-container-low', 'surface-container-low'], // storage chip on the sheet
    ];
    for (const [over, against] of pairs) {
      const border = compositeOver(light.outline, BORDER_OUTLINE_ALPHA, light[over]);
      const ratio = contrastRatio(border, light[against]);
      expect(ratio, `${over} border vs ${against} = ${ratio.toFixed(2)}`).toBeGreaterThanOrEqual(WCAG_AA_LARGE_OR_UI);
    }
  });

  it.each(THEME_NAMES)('%s: the solid outline swatch ring stands out from the sheet', (theme) => {
    const tokens = tokensFor(theme);
    expect(contrastRatio(tokens.outline, tokens['surface-container-low'])).toBeGreaterThanOrEqual(WCAG_AA_LARGE_OR_UI);
  });

  // In dark the darkest swatch is only 1.2:1 from the sheet, so the ring is what
  // shows it; it must read against the swatch too. (In light the swatch itself
  // is far darker than the sheet.)
  it('dark: the ring also stands out from the darkest swatch', () => {
    expect(contrastRatio(tokensFor('dark').outline, DARKEST_SWATCH)).toBeGreaterThanOrEqual(WCAG_AA_LARGE_OR_UI);
    expect(contrastRatio(tokensFor('dark')['surface-container-low'], DARKEST_SWATCH)).toBeLessThan(WCAG_AA_LARGE_OR_UI);
  });
});
