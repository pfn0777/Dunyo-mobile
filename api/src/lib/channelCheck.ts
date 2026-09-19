// Required-channel gate, used on every customer request and by the bot's
// /start and "I joined" button.
//
// Fail-open by design: this is a marketing filter, not a permission boundary.
// A Telegram outage, a bot removed from the channel or a DB error must never
// stop customers from ordering, so anything other than a definitive "not a
// member" answer lets the user through and is logged. The decision itself
// lives in the pure decideGate() (channelGate.ts); this module only wires it
// up to Postgres and Telegram.

import { getChatMember } from './telegram.js';
import { channelChatId, CHANNEL_CHECK_TTL_SEC, decideGate, normalizeChannelHandle } from './channelGate.js';
import type { Db } from './db.js';

export interface ChannelState {
  /** The normalized channel, or null when the gate is switched off. */
  requiredChannel: string | null;
  /** True only when the user is definitely not subscribed to a configured channel. */
  blocked: boolean;
}

const GATE_OFF: ChannelState = { requiredChannel: null, blocked: false };

/** Reads settings.required_channel; null when unset, blank or malformed. */
export async function loadRequiredChannel(db: Db): Promise<string | null> {
  let raw: string | null;
  try {
    const row = await db.queryOne<{ required_channel: string | null }>(
      'select required_channel from settings where id = 1',
    );
    raw = row?.required_channel ?? null;
  } catch (error) {
    console.error('channelCheck: failed to read required_channel', error);
    return null;
  }
  if (raw === null) {
    return null;
  }
  const normalized = normalizeChannelHandle(raw);
  if (normalized === null) {
    console.error(`channelCheck: settings.required_channel is not a usable channel: ${raw}`);
  }
  return normalized;
}

interface CachedMembership {
  channel_subscribed: boolean;
  channel_checked_at: string | null;
}

async function loadCachedMembership(db: Db, userId: number): Promise<CachedMembership | null> {
  try {
    return await db.queryOne<CachedMembership>(
      'select channel_subscribed, channel_checked_at from users where id = $1',
      [userId],
    );
  } catch (error) {
    console.error('channelCheck: failed to read cached membership', error);
    return null;
  }
}

/** Only ever called with a definitive Telegram answer — never cache a
 * non-definitive one (see resolveChannelState below). */
async function cacheMembership(db: Db, userId: number, subscribed: boolean): Promise<void> {
  try {
    await db.query(
      'update users set channel_subscribed = $1, channel_checked_at = now() where id = $2',
      [subscribed, userId],
    );
  } catch (error) {
    console.error('channelCheck: failed to cache membership', error);
  }
}

/**
 * Resolves whether the user may use the shop, asking Telegram only when the
 * cached answer is missing, older than the TTL, or `force` is set (the user
 * just pressed "I joined").
 */
export async function resolveChannelState(
  db: Db,
  botToken: string,
  userId: number,
  options: { force?: boolean } = {},
): Promise<ChannelState> {
  const [requiredChannel, cached] = await Promise.all([
    loadRequiredChannel(db),
    loadCachedMembership(db, userId),
  ]);

  if (requiredChannel === null) {
    return GATE_OFF;
  }

  const decision = decideGate({
    requiredChannel,
    cachedSubscribed: cached?.channel_subscribed ?? false,
    checkedAt: cached?.channel_checked_at ?? null,
    nowMs: Date.now(),
    ttlSec: CHANNEL_CHECK_TTL_SEC,
  });

  if (decision === 'off') {
    return GATE_OFF;
  }
  if (!(options.force ?? false)) {
    if (decision === 'allow') {
      return { requiredChannel, blocked: false };
    }
    if (decision === 'block') {
      return { requiredChannel, blocked: true };
    }
  }

  const member = await getChatMember(botToken, channelChatId(requiredChannel), userId);
  if (!member.ok) {
    // Membership unknown: let the user through and do NOT cache it, so the
    // next request retries instead of trusting a failure for the whole TTL.
    return { requiredChannel, blocked: false };
  }

  await cacheMembership(db, userId, member.subscribed);
  return { requiredChannel, blocked: !member.subscribed };
}
