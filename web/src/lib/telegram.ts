import { extractContactResponse } from './contactResponse.ts';
import { tokensFor, type Theme } from '../theme/tokens.ts';

// Thin typed wrapper around window.Telegram.WebApp. No SDK dependency: the
// real object is injected by the telegram-web-app.js script tag in index.html.
// Every accessor tolerates running outside Telegram (plain browser / mock
// dev) by returning null/no-ops instead of throwing.

interface TelegramCloudStorage {
  getItem(key: string, cb: (error: string | null, value?: string) => void): void;
  setItem(key: string, value: string, cb?: (error: string | null, ok?: boolean) => void): void;
}

interface TelegramLocationManager {
  isInited: boolean;
  isLocationAvailable: boolean;
  init(cb?: () => void): void;
  getLocation(cb: (location: { latitude: number; longitude: number } | null) => void): void;
}

interface TelegramHapticFeedback {
  notificationOccurred(type: 'error' | 'success' | 'warning'): void;
  impactOccurred(style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft'): void;
}

interface TelegramBackButton {
  show(): void;
  hide(): void;
  onClick(cb: () => void): void;
  offClick(cb: () => void): void;
}

interface TelegramMainButton {
  text: string;
  show(): void;
  hide(): void;
  enable(): void;
  disable(): void;
  onClick(cb: () => void): void;
  offClick(cb: () => void): void;
  setParams(params: Record<string, unknown>): void;
}

interface TelegramWebApp {
  initData: string;
  initDataUnsafe: { user?: { id: number; first_name: string; last_name?: string; username?: string } };
  ready(): void;
  expand(): void;
  setHeaderColor(color: string): void;
  setBackgroundColor(color: string): void;
  contentSafeAreaInset?: { top: number; bottom: number; left: number; right: number };
  CloudStorage: TelegramCloudStorage;
  LocationManager?: TelegramLocationManager;
  HapticFeedback?: TelegramHapticFeedback;
  BackButton: TelegramBackButton;
  MainButton: TelegramMainButton;
  requestContact(cb: (granted: boolean, event?: unknown) => void): void;
  openTelegramLink(url: string): void;
  openLink(url: string): void;
}

declare global {
  interface Window {
    Telegram?: { WebApp: TelegramWebApp };
  }
}

export function getWebApp(): TelegramWebApp | null {
  return window.Telegram?.WebApp ?? null;
}

export function isInsideTelegram(): boolean {
  const webApp = getWebApp();
  return webApp !== null && webApp.initData.length > 0;
}

export function getInitData(): string | null {
  const webApp = getWebApp();
  if (webApp === null || webApp.initData.length === 0) {
    return null;
  }
  return webApp.initData;
}

export function initTelegram(): void {
  const webApp = getWebApp();
  if (webApp === null) {
    return;
  }
  webApp.ready();
  webApp.expand();
}

/** Keeps Telegram's own header/background chrome in step with the app theme. */
export function applyTelegramTheme(theme: Theme): void {
  const webApp = getWebApp();
  if (webApp === null) {
    return;
  }
  const color = tokensFor(theme).background;
  webApp.setHeaderColor(color);
  webApp.setBackgroundColor(color);
}

export function cloudStorageGet(key: string): Promise<string | null> {
  return new Promise((resolve) => {
    const webApp = getWebApp();
    if (webApp === null) {
      resolve(null);
      return;
    }
    webApp.CloudStorage.getItem(key, (error, value) => {
      if (error) {
        console.error('cloudStorageGet failed', error);
        resolve(null);
        return;
      }
      resolve(value ?? null);
    });
  });
}

export function cloudStorageSet(key: string, value: string): Promise<void> {
  return new Promise((resolve) => {
    const webApp = getWebApp();
    if (webApp === null) {
      resolve();
      return;
    }
    webApp.CloudStorage.setItem(key, value, (error) => {
      if (error) {
        console.error('cloudStorageSet failed', error);
      }
      resolve();
    });
  });
}

export function requestContact(): Promise<{ granted: boolean; response: string | null }> {
  return new Promise((resolve) => {
    const webApp = getWebApp();
    if (webApp === null) {
      resolve({ granted: false, response: null });
      return;
    }
    try {
      webApp.requestContact((granted, event) => resolve({ granted, response: extractContactResponse(event) }));
    } catch (error) {
      console.error('requestContact: WebApp.requestContact threw', error);
      resolve({ granted: false, response: null });
    }
  });
}

export function getDeviceLocation(): Promise<{ latitude: number; longitude: number } | null> {
  return new Promise((resolve) => {
    const webApp = getWebApp();
    if (webApp === null || webApp.LocationManager === undefined) {
      resolve(null);
      return;
    }
    const manager = webApp.LocationManager;
    const run = (): void => manager.getLocation(resolve);
    if (manager.isInited) {
      run();
    } else {
      manager.init(run);
    }
  });
}

export function isLocationSupported(): boolean {
  return getWebApp()?.LocationManager !== undefined;
}

export function hapticSuccess(): void {
  getWebApp()?.HapticFeedback?.notificationOccurred('success');
}

export function showBackButton(onClick: () => void): () => void {
  const webApp = getWebApp();
  if (webApp === null) {
    return () => {};
  }
  webApp.BackButton.show();
  webApp.BackButton.onClick(onClick);
  return () => {
    webApp.BackButton.offClick(onClick);
    webApp.BackButton.hide();
  };
}

export function openTelegramLink(url: string): void {
  const webApp = getWebApp();
  if (webApp !== null) {
    webApp.openTelegramLink(url);
    return;
  }
  window.open(url, '_blank', 'noopener,noreferrer');
}
