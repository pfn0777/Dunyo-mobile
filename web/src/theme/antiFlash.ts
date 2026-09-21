import { THEME_STORAGE_KEY } from '../lib/themeChoice.ts';

/** Inline script the Vite plugin puts in <head>. It runs before first paint and
 * sets `<html class="dark">` from the stored choice, so there is no light->dark
 * flash. Light is the default: no stored value means no class. Keep it ES5-safe
 * and free of imports — it is not bundled. */
export function antiFlashScript(): string {
  return `(function(){try{var raw=window.localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});if(raw!==null&&JSON.parse(raw).theme==='dark'){document.documentElement.classList.add('dark');}}catch(e){console.error('theme: could not read stored theme',e);}})();`;
}
