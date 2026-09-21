// Theme store (same shape as cart.ts): the user's choice lives in localStorage
// and is mirrored to Telegram CloudStorage; on start the newer of the two wins.
//
// The <html class="dark"> flag is what actually themes the app (Tailwind
// `darkMode: 'class'` + CSS variables), so it also covers everything rendered
// outside the React tree. `forceTheme` overrides the flag without touching the
// stored choice — used to keep /admin/* dark, then restore the choice on exit.

import { useSyncExternalStore } from 'react';
import type { Theme } from '../theme/tokens.ts';
import { cloudStorageGet, cloudStorageSet, applyTelegramTheme } from './telegram.ts';
import {
  CLOUD_THEME_KEY,
  THEME_STORAGE_KEY,
  defaultChoice,
  otherTheme,
  parseThemeChoice,
  resolveThemeChoice,
  type ThemeChoice,
} from './themeChoice.ts';

const CLOUD_SYNC_DEBOUNCE_MS = 800;

function readLocalStorage(): ThemeChoice | null {
  try {
    return parseThemeChoice(window.localStorage.getItem(THEME_STORAGE_KEY));
  } catch (error) {
    console.error('theme: failed to read localStorage, using default', error);
    return null;
  }
}

function writeLocalStorage(choice: ThemeChoice): void {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(choice));
  } catch (error) {
    console.error('theme: failed to write localStorage', error);
  }
}

export class ThemeStore {
  private choice: ThemeChoice;
  private forced: Theme | null = null;
  private listeners = new Set<() => void>();
  private hydrated = false;
  private cloudSyncTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    // Read synchronously so the very first render already has the stored theme.
    this.choice = readLocalStorage() ?? defaultChoice();
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  /** The user's chosen theme (what the toggle shows), regardless of forcing. */
  getSnapshot = (): Theme => this.choice.theme;

  /** What is actually painted: the forced theme (admin) or the user's choice. */
  effectiveTheme(): Theme {
    return this.forced ?? this.choice.theme;
  }

  private emit(): void {
    for (const listener of this.listeners) listener();
  }

  /** Writes the theme to <html> and Telegram chrome. Idempotent. */
  private apply(): void {
    const theme = this.effectiveTheme();
    document.documentElement.classList.toggle('dark', theme === 'dark');
    applyTelegramTheme(theme);
  }

  /** Call once on app start, before the first render. */
  init(): void {
    this.apply();
  }

  setTheme(theme: Theme): void {
    this.choice = { theme, updatedAt: Date.now() };
    writeLocalStorage(this.choice);
    this.scheduleCloudSync(this.choice);
    this.apply();
    this.emit();
  }

  toggle(): void {
    this.setTheme(otherTheme(this.choice.theme));
  }

  /** `null` releases the override and restores the user's choice. */
  forceTheme(theme: Theme | null): void {
    this.forced = theme;
    this.apply();
  }

  private scheduleCloudSync(choice: ThemeChoice): void {
    if (this.cloudSyncTimer !== null) clearTimeout(this.cloudSyncTimer);
    this.cloudSyncTimer = setTimeout(() => {
      void cloudStorageSet(CLOUD_THEME_KEY, JSON.stringify(choice));
    }, CLOUD_SYNC_DEBOUNCE_MS);
  }

  /** Reconciles with CloudStorage (newer `updatedAt` wins). Call once on app start. */
  async hydrate(): Promise<void> {
    if (this.hydrated) return;
    this.hydrated = true;

    let cloud: ThemeChoice | null = null;
    try {
      cloud = parseThemeChoice(await cloudStorageGet(CLOUD_THEME_KEY));
    } catch (error) {
      console.error('theme: failed to parse CloudStorage value, ignoring it', error);
    }

    // Read after the await: the user may have toggled while CloudStorage was loading.
    const local = readLocalStorage();
    const winner = resolveThemeChoice(local, cloud);
    if (winner.theme === this.choice.theme && winner.updatedAt === this.choice.updatedAt) return;

    this.choice = winner;
    if (winner === cloud) writeLocalStorage(winner);
    this.apply();
    this.emit();
  }
}

export const themeStore = new ThemeStore();

export function useTheme(): { theme: Theme; toggle: () => void } {
  const theme = useSyncExternalStore(themeStore.subscribe, themeStore.getSnapshot);
  return { theme, toggle: () => themeStore.toggle() };
}
