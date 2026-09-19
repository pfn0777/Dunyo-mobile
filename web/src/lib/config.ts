// Only public, client-safe values. Never add the bot token, DATABASE_URL, or
// any webhook secret here — everything in this module ends up in the browser
// bundle. No VITE_SUPABASE_* here: Dunyo Mobile's backend is the Fastify API
// in api/, not Supabase.

function readEnv(name: keyof ImportMetaEnv, fallback = ''): string {
  const value = import.meta.env[name];
  return typeof value === 'string' ? value : fallback;
}

export const config = {
  apiUrl: readEnv('VITE_API_URL', '/api'),
  mediaUrl: readEnv('VITE_MEDIA_URL', '/media'),
  botUsername: readEnv('VITE_BOT_USERNAME'),
  supportUsername: readEnv('VITE_SUPPORT_USERNAME'),
  channelUsername: readEnv('VITE_CHANNEL_USERNAME'),
  mock: readEnv('VITE_MOCK') === '1',
} as const;

/**
 * Every image URL in the app goes through this one function — never inline
 * `${config.mediaUrl}/...` anywhere else (XUMO had that bug in two admin
 * pages; this app must not reproduce it).
 *
 * An already-absolute URL (blob:, data:, http(s):) is returned unchanged
 * instead of being prefixed — the admin mock's image-upload endpoints return
 * a `URL.createObjectURL()` blob: URL for a freshly "uploaded" image (see
 * lib/mock.ts's createAdminMockClient), and a real server-stored path never
 * starts with a scheme, so this is unambiguous.
 */
export function mediaUrl(path: string | null): string | null {
  if (path === null || path.length === 0) {
    return null;
  }
  if (/^(https?:|data:|blob:)/.test(path)) {
    return path;
  }
  return `${config.mediaUrl}/${path}`;
}
