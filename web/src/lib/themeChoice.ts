// Pure decisions for the theme choice: parsing a stored value and picking the
// winner between localStorage and Telegram CloudStorage. No DOM, no storage.

import { THEME_NAMES, type Theme } from '../theme/tokens.ts';

export const DEFAULT_THEME: Theme = 'light';
export const THEME_STORAGE_KEY = 'dunyo.theme.v1';
export const CLOUD_THEME_KEY = 'dunyo_theme_v1';

export interface ThemeChoice {
  theme: Theme;
  updatedAt: number;
}

export function isTheme(value: unknown): value is Theme {
  return typeof value === 'string' && (THEME_NAMES as readonly string[]).includes(value);
}

export function defaultChoice(): ThemeChoice {
  return { theme: DEFAULT_THEME, updatedAt: 0 };
}

/** `null` means "nothing stored". A stored value that is present but malformed
 * throws, so the caller can log it and fall back to the default instead of
 * silently reinterpreting it. */
export function parseThemeChoice(raw: string | null): ThemeChoice | null {
  if (raw === null) return null;
  const value: unknown = JSON.parse(raw);
  if (typeof value !== 'object' || value === null) {
    throw new Error('theme: stored value is not an object');
  }
  const { theme, updatedAt } = value as { theme?: unknown; updatedAt?: unknown };
  if (!isTheme(theme)) {
    throw new Error(`theme: unknown theme "${String(theme)}"`);
  }
  if (typeof updatedAt !== 'number' || !Number.isFinite(updatedAt)) {
    throw new Error('theme: stored updatedAt is not a finite number');
  }
  return { theme, updatedAt };
}

/** Newer `updatedAt` wins; on a tie localStorage wins; nothing stored -> default (light). */
export function resolveThemeChoice(local: ThemeChoice | null, cloud: ThemeChoice | null): ThemeChoice {
  if (local !== null && cloud !== null) {
    return local.updatedAt >= cloud.updatedAt ? local : cloud;
  }
  return local ?? cloud ?? defaultChoice();
}

export function otherTheme(theme: Theme): Theme {
  return theme === 'dark' ? 'light' : 'dark';
}
