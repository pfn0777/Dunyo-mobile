// Generates a checkout idempotency key once per distinct cart state and
// reuses it across re-renders / double taps within the same tab, per spec:
// "regenerate when cart changes". Keyed in sessionStorage by a hash of the
// cart lines so the key survives re-renders but not a cart edit.

import type { CartLine } from './cart.ts';

const STORAGE_PREFIX = 'dunyo.checkout.idempotency.';

function hashLines(lines: CartLine[]): string {
  const sorted = [...lines].sort((a, b) => a.variantId - b.variantId);
  const signature = sorted.map((l) => `${l.variantId}:${l.qty}:${l.price}`).join('|');
  let hash = 0;
  for (let i = 0; i < signature.length; i += 1) {
    hash = (Math.imul(31, hash) + signature.charCodeAt(i)) | 0;
  }
  return `h${hash >>> 0}`;
}

export function getOrCreateIdempotencyKey(lines: CartLine[]): string {
  const hash = hashLines(lines);
  const storageKey = `${STORAGE_PREFIX}${hash}`;
  try {
    const existing = window.sessionStorage.getItem(storageKey);
    if (existing !== null) return existing;
    const created = crypto.randomUUID();
    window.sessionStorage.setItem(storageKey, created);
    return created;
  } catch (error) {
    console.error('idempotency: sessionStorage unavailable, generating ephemeral key', error);
    return crypto.randomUUID();
  }
}
