import type { Config } from 'tailwindcss';
import { cssVarName } from './src/theme/css.ts';
import { TOKEN_NAMES } from './src/theme/tokens.ts';

// Fonts, spacing and radii come from design/stitch/home.html's `tailwind.config`
// (Stitch "Dunyo Luxury Tech") and are shared by both themes; only colours change.
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      // Values live in src/theme/tokens.ts and reach the page as CSS variables
      // (injected by the Vite plugin). `<alpha-value>` keeps `bg-primary/10` etc. working.
      colors: Object.fromEntries(
        TOKEN_NAMES.map((name) => [name, `rgb(var(${cssVarName(name)}) / <alpha-value>)`]),
      ),
      borderRadius: {
        DEFAULT: '0.25rem',
        lg: '0.5rem',
        xl: '0.75rem',
        full: '9999px',
      },
      spacing: {
        'space-xs': '0.25rem',
        margin: '1rem',
        'space-md': '0.75rem',
        'space-xl': '1.75rem',
        gutter: '0.75rem',
        'space-sm': '0.5rem',
        'space-lg': '1.25rem',
      },
      fontFamily: {
        'headline-md': ['Plus Jakarta Sans'],
        'price-badge': ['Space Grotesk'],
        'body-md': ['Plus Jakarta Sans'],
        'label-md': ['Space Grotesk'],
        'label-lg': ['Space Grotesk'],
        'headline-xl-mobile': ['Plus Jakarta Sans'],
        'label-sm': ['Space Grotesk'],
        'price-headline': ['Space Grotesk'],
        'body-sm': ['Plus Jakarta Sans'],
        'headline-lg-mobile': ['Plus Jakarta Sans'],
        'headline-lg': ['Plus Jakarta Sans'],
        'body-lg': ['Plus Jakarta Sans'],
        'headline-xl': ['Plus Jakarta Sans'],
      },
      fontSize: {
        'headline-md': ['18px', { lineHeight: '24px', letterSpacing: '-0.01em', fontWeight: '700' }],
        'price-badge': ['11px', { lineHeight: '14px', letterSpacing: '0.02em', fontWeight: '700' }],
        'body-md': ['14px', { lineHeight: '20px', fontWeight: '400' }],
        'label-md': ['12px', { lineHeight: '16px', letterSpacing: '0.03em', fontWeight: '600' }],
        'label-lg': ['14px', { lineHeight: '18px', letterSpacing: '0.02em', fontWeight: '600' }],
        'headline-xl-mobile': ['26px', { lineHeight: '32px', letterSpacing: '-0.02em', fontWeight: '800' }],
        'label-sm': ['10px', { lineHeight: '14px', letterSpacing: '0.05em', fontWeight: '700' }],
        'price-headline': ['18px', { lineHeight: '22px', letterSpacing: '-0.02em', fontWeight: '700' }],
        'body-sm': ['12px', { lineHeight: '16px', fontWeight: '400' }],
        'headline-lg-mobile': ['20px', { lineHeight: '26px', letterSpacing: '-0.015em', fontWeight: '700' }],
        'headline-lg': ['24px', { lineHeight: '30px', letterSpacing: '-0.015em', fontWeight: '700' }],
        'body-lg': ['16px', { lineHeight: '24px', fontWeight: '500' }],
        'headline-xl': ['32px', { lineHeight: '40px', letterSpacing: '-0.02em', fontWeight: '800' }],
      },
    },
  },
  plugins: [],
} satisfies Config;
