import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { themeCss } from './src/theme/css.ts';
import { antiFlashScript } from './src/theme/antiFlash.ts';

// Injects the colour CSS variables (from src/theme/tokens.ts, the single source
// of truth) and the anti-flash script into <head>, so the right theme is painted
// on the very first frame.
function themePlugin(): Plugin {
  return {
    name: 'dunyo-theme',
    transformIndexHtml() {
      return [
        { tag: 'style', attrs: { id: 'theme-vars' }, children: themeCss(), injectTo: 'head-prepend' },
        { tag: 'script', children: antiFlashScript(), injectTo: 'head-prepend' },
      ];
    },
  };
}

// Dunyo Mobile customer mini app. Runs as a static site behind Caddy, so we
// keep the build plain (no SSR). The dev proxy lets `npm run dev` talk to a
// locally running API/media server without CORS config.
export default defineConfig({
  plugins: [react(), themePlugin()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3000',
      '/media': 'http://localhost:3000',
    },
  },
});
