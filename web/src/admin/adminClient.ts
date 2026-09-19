import type { AdminApiClient } from './types.ts';

let cached: Promise<AdminApiClient> | null = null;

/** Mirrors lib/client.ts's getClient(): VITE_MOCK=1 pulls in the in-memory
 * mock (dead-code-eliminated from production builds), otherwise the real
 * fetch-based admin client. */
export function getAdminClient(): Promise<AdminApiClient> {
  if (cached === null) {
    cached =
      import.meta.env.VITE_MOCK === '1'
        ? import('../lib/mock.ts').then((m) => m.createAdminMockClient())
        : import('./adminApi.ts').then((m) => m.adminApiClient);
  }
  return cached;
}
