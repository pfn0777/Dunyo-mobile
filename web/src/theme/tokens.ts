// Single source of truth for the colour tokens of both themes.
//
// `darkTokens` is the original "Dunyo Luxury Tech" palette (design/stitch/*.html).
// `lightTokens` comes from the Stitch "Light" screens (design/stitch/light/*.html)
// with the deviations listed next to each entry, all forced by the WCAG AA
// contrast test in __tests__/themeContrast.test.ts.
//
// Only colours differ between themes — fonts, spacing and radii are shared and
// stay in tailwind.config.ts.

export const darkTokens = {
  'on-primary': '#402d00',
  'on-tertiary-fixed': '#001a41',
  'secondary-fixed-dim': '#00e2a0',
  'on-primary-fixed': '#261900',
  'primary-fixed-dim': '#edc062',
  'on-secondary-container': '#005f41',
  'on-surface-variant': '#d1c5b2',
  tertiary: '#cddbff',
  'surface-container-low': '#1b1b1f',
  'outline-variant': '#4e4637',
  'tertiary-fixed': '#d8e2ff',
  'secondary-container': '#00e2a0',
  'surface-container-lowest': '#0d0e11',
  'tertiary-container': '#a2bfff',
  'on-secondary-fixed': '#002114',
  'error-container': '#93000a',
  'on-secondary': '#003825',
  'on-tertiary': '#002e69',
  'inverse-primary': '#7a5900',
  'inverse-surface': '#e3e2e6',
  background: '#121316',
  primary: '#ffd682',
  'primary-fixed': '#ffdea1',
  'tertiary-fixed-dim': '#adc6ff',
  'surface-container': '#1f1f23',
  surface: '#121316',
  'surface-container-highest': '#343538',
  'on-tertiary-container': '#004aa2',
  'on-error-container': '#ffdad6',
  'surface-dim': '#121316',
  'on-background': '#e3e2e6',
  'inverse-on-surface': '#303034',
  error: '#ffb4ab',
  'secondary-fixed': '#43ffbb',
  'on-error': '#690005',
  'on-secondary-fixed-variant': '#005138',
  'surface-variant': '#343538',
  'primary-container': '#e5b95c',
  'surface-container-high': '#292a2d',
  'on-surface': '#e3e2e6',
  'on-primary-container': '#654900',
  'on-primary-fixed-variant': '#5c4300',
  'surface-tint': '#edc062',
  outline: '#9a8f7e',
  'surface-bright': '#38393c',
  secondary: '#43ffbb',
  'on-tertiary-fixed-variant': '#004494',
  // Semantic tokens added for the light theme (dark values reproduce today's look).
  // `installment` = fills/icons/borders; `installment-text` = text (needs AA in light).
  installment: '#43ffbb',
  'installment-text': '#43ffbb',
  // Gold used as *text* (light `primary` is too pale on white to be AA).
  'primary-text': '#ffd682',
  // Loading skeletons and missing-image tiles: must stand out from both the page
  // and the (white, in light) cards they sit on. Dark keeps today's surface-container.
  skeleton: '#1f1f23',
} as const;

export type TokenName = keyof typeof darkTokens;

export const lightTokens: Record<TokenName, string> = {
  // Deviation: Stitch has white here (3.46:1 on the gold); dark brown passes AA.
  'on-primary': '#281900',
  'on-tertiary-fixed': '#271900',
  'secondary-fixed-dim': '#c0c6db',
  'on-primary-fixed': '#281900',
  'primary-fixed-dim': '#f7bd56',
  'on-secondary-container': '#5c6274',
  'on-surface-variant': '#4f4536',
  tertiary: '#795600',
  'surface-container-low': '#f3f4f5',
  'outline-variant': '#e5e7eb',
  'tertiary-fixed': '#ffdea7',
  'secondary-container': '#d9dff5',
  'surface-container-lowest': '#ffffff',
  'tertiary-container': '#986d00',
  'on-secondary-fixed': '#141b2b',
  'error-container': '#ffdad6',
  'on-secondary': '#ffffff',
  'on-tertiary': '#ffffff',
  'inverse-primary': '#f7bd56',
  'inverse-surface': '#2e3132',
  background: '#f8f9fa',
  primary: '#b3811e',
  'primary-fixed': '#ffdeac',
  'tertiary-fixed-dim': '#f5be4f',
  'surface-container': '#ffffff',
  surface: '#f8f9fa',
  'surface-container-highest': '#e1e3e4',
  'on-tertiary-container': '#fffbff',
  'on-error-container': '#93000a',
  'surface-dim': '#d9dadb',
  'on-background': '#191c1d',
  'inverse-on-surface': '#f0f1f2',
  error: '#ba1a1a',
  'secondary-fixed': '#dce2f7',
  'on-error': '#ffffff',
  'on-secondary-fixed-variant': '#404758',
  'surface-variant': '#e1e3e4',
  'primary-container': '#9a6c01',
  'surface-container-high': '#e7e8e9',
  'on-surface': '#191c1d',
  'on-primary-container': '#fffbff',
  'on-primary-fixed-variant': '#5f4100',
  'surface-tint': '#7e5700',
  // Deviation: Stitch #827564 is 4.26:1 on the page background, too weak for the
  // grey helper text that uses this token.
  outline: '#6f6353',
  'surface-bright': '#f8f9fa',
  secondary: '#575e70',
  'on-tertiary-fixed-variant': '#5e4200',
  // Stitch uses emerald #059669 for installment fills/icons (3.6:1 — fine for UI).
  installment: '#059669',
  // Deviation: emerald as text is 3.57:1; #047857 is 5.2:1 on the page background.
  'installment-text': '#047857',
  // Darkest gold that stays close to the brand `primary`: 5.26:1 on #f8f9fa.
  'primary-text': '#8a6100',
  // Light: surface-container is white, identical to a card, so it would vanish.
  skeleton: '#e1e3e4',
};

export const THEME_NAMES = ['light', 'dark'] as const;
export type Theme = (typeof THEME_NAMES)[number];

export const TOKEN_NAMES = Object.keys(darkTokens) as TokenName[];

export function tokensFor(theme: Theme): Record<TokenName, string> {
  return theme === 'dark' ? darkTokens : lightTokens;
}
