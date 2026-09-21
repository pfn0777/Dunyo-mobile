import { describe, expect, it } from 'vitest';

// Customer components must take colours from theme tokens so both themes work.
// The admin panel is always dark and keeps using the shared tokens as before.
const sources = import.meta.glob('../../**/*.tsx', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

const customerFiles = Object.entries(sources).filter(
  ([path]) => !path.includes('/admin/') && !path.includes('/__tests__/'),
);

// Deliberate exceptions, each with the reason it is theme-independent.
const ALLOWED: Array<{ file: string; snippet: string; why: string }> = [
  { file: 'ProductSheet.tsx', snippet: '#888888', why: 'neutral swatch fallback when a variant has no colour hex' },
  { file: 'FloatingCartPill.tsx', snippet: 'bg-white/15', why: 'translucent chip on the always-inverted cart pill' },
];

// Modal/sheet scrims dim whatever is behind them, so they are the same in both themes.
const SCRIM = /^bg-black\/(?:40|50)$/;

function offences(pattern: RegExp): string[] {
  const found: string[] = [];
  for (const [path, source] of customerFiles) {
    for (const match of source.matchAll(pattern)) {
      const snippet = match[0];
      const allowed = SCRIM.test(snippet) || ALLOWED.some((a) => path.endsWith(a.file) && a.snippet === snippet);
      if (!allowed) found.push(`${path}: ${snippet}`);
    }
  }
  return found;
}

describe('customer components use theme tokens only', () => {
  it('scans a meaningful number of files', () => {
    expect(customerFiles.length).toBeGreaterThan(15);
  });

  it('no hard-coded hex colours (inline style, SVG fill/stroke, arbitrary values)', () => {
    expect(offences(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g)).toEqual([]);
  });

  it('no rgb()/rgba()/hsl() literals', () => {
    expect(offences(/\b(?:rgba?|hsla?)\(/g)).toEqual([]);
  });

  it('no SVG fill/stroke with a fixed colour name', () => {
    expect(offences(/\b(?:fill|stroke)="(?:white|black|#[0-9a-fA-F]+)"/g)).toEqual([]);
  });

  it('no fixed white/black text or backgrounds outside dark: variants and the allowlist', () => {
    expect(offences(/(?<![\w:-])(?:text|bg|border)-(?:white|black)(?:\/\d+)?(?![\w-])/g)).toEqual([]);
  });

  it('gold text uses text-primary-text, never bare text-primary (AA on light)', () => {
    expect(offences(/(?<![\w-])text-primary(?![\w-])/g)).toEqual([]);
  });
});
