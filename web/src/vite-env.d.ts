/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_MEDIA_URL: string;
  readonly VITE_BOT_USERNAME: string;
  readonly VITE_SUPPORT_USERNAME: string;
  readonly VITE_CHANNEL_USERNAME: string;
  readonly VITE_MOCK: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
