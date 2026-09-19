// Pure decision for the required-channel gate, extracted out of
// RequireSubscription so the branches can be unit tested without rendering.

import type { Me } from './types.ts';

export interface SubscriptionGateInput {
  /** VITE_MOCK=1 */
  mock: boolean;
  insideTelegram: boolean;
  /** The ['me'] query state. */
  isLoading: boolean;
  isError: boolean;
  me: Me | undefined;
  /** channelState.ts: a request came back 403 channel_required. */
  flagged: boolean;
}

/**
 * - `bypass`  — nothing to check (mock run, or not inside Telegram, where
 *               RequireAuth already owns the screen)
 * - `loading` — the profile has not arrived yet
 * - `gate`    — show the "join the channel" screen
 * - `allow`   — render the shop
 */
export type SubscriptionGateDecision = 'bypass' | 'loading' | 'gate' | 'allow';

export function decideSubscriptionGate(input: SubscriptionGateInput): SubscriptionGateDecision {
  if (input.mock) {
    // The mock client still reports channel_required so the screen can be
    // exercised with ?simulate=not_subscribed.
    return input.me?.channel_required === true ? 'gate' : 'bypass';
  }
  if (!input.insideTelegram) {
    return 'bypass';
  }
  if (input.flagged) {
    return 'gate';
  }
  if (input.isLoading) {
    return 'loading';
  }
  // Fail open, like the server does: an unreachable /me must not close the shop.
  if (input.isError || input.me === undefined) {
    return 'allow';
  }
  return input.me.channel_required ? 'gate' : 'allow';
}
