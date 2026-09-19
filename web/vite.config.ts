import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Dunyo Mobile customer mini app. Runs as a static site behind Caddy, so we
// keep the build plain (no SSR). The dev proxy lets `npm run dev` talk to a
// locally running API/media server without CORS config.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3000',
      '/media': 'http://localhost:3000',
    },
  },
});
