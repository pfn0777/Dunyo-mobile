// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeStore } from '../theme.ts';

const KEY = 'dunyo.theme.v1';

function mockTelegram(cloudValue: string | null): void {
  (window as unknown as { Telegram: unknown }).Telegram = {
    WebApp: {
      CloudStorage: {
        getItem: (_key: string, cb: (error: string | null, value?: string) => void) => cb(null, cloudValue ?? undefined),
        setItem: (_key: string, _value: string, cb?: (error: string | null, ok?: boolean) => void) => cb?.(null, true),
      },
      setHeaderColor: vi.fn(),
      setBackgroundColor: vi.fn(),
    },
  };
}

function clearTelegram(): void {
  delete (window as unknown as { Telegram?: unknown }).Telegram;
}

beforeEach(() => {
  window.localStorage.clear();
  document.documentElement.classList.remove('dark');
  clearTelegram();
});

describe('ThemeStore', () => {
  it('defaults to light when nothing is stored', async () => {
    const store = new ThemeStore();
    await store.hydrate();
    expect(store.getSnapshot()).toBe('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('reads the stored theme synchronously in the constructor (no flash)', () => {
    window.localStorage.setItem(KEY, JSON.stringify({ theme: 'dark', updatedAt: 1 }));
    expect(new ThemeStore().getSnapshot()).toBe('dark');
  });

  it('prefers the newer of localStorage and CloudStorage', async () => {
    window.localStorage.setItem(KEY, JSON.stringify({ theme: 'light', updatedAt: 1000 }));
    mockTelegram(JSON.stringify({ theme: 'dark', updatedAt: 2000 }));
    const store = new ThemeStore();
    await store.hydrate();
    expect(store.getSnapshot()).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(JSON.parse(window.localStorage.getItem(KEY) ?? '{}').theme).toBe('dark');
  });

  it('uses CloudStorage on a fresh device (localStorage empty)', async () => {
    mockTelegram(JSON.stringify({ theme: 'dark', updatedAt: 5 }));
    const store = new ThemeStore();
    await store.hydrate();
    expect(store.getSnapshot()).toBe('dark');
  });

  it('keeps light and logs when both stored values are broken', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    window.localStorage.setItem(KEY, '{broken');
    mockTelegram('{"theme":"sepia","updatedAt":1}');
    const store = new ThemeStore();
    await store.hydrate();
    expect(store.getSnapshot()).toBe('light');
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('toggle persists to localStorage and updates <html>', () => {
    const store = new ThemeStore();
    store.toggle();
    expect(store.getSnapshot()).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(JSON.parse(window.localStorage.getItem(KEY) ?? '{}').theme).toBe('dark');
  });

  it('forceTheme keeps the app dark without changing the stored choice, then restores it', () => {
    const store = new ThemeStore();
    store.setTheme('light');
    store.forceTheme('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(store.getSnapshot()).toBe('light');
    expect(JSON.parse(window.localStorage.getItem(KEY) ?? '{}').theme).toBe('light');
    store.forceTheme(null);
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('tells Telegram the header/background colour of the effective theme', () => {
    mockTelegram(null);
    const webApp = (window as unknown as { Telegram: { WebApp: { setHeaderColor: ReturnType<typeof vi.fn> } } }).Telegram.WebApp;
    const store = new ThemeStore();
    store.setTheme('dark');
    expect(webApp.setHeaderColor).toHaveBeenLastCalledWith('#121316');
    store.setTheme('light');
    expect(webApp.setHeaderColor).toHaveBeenLastCalledWith('#f8f9fa');
  });
});
