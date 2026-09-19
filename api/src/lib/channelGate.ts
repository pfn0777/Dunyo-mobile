// Pure decision logic for the required-channel gate, extracted out of
// channelCheck.ts so it can be unit tested without a DB or a Telegram call.
//
// The gate is a marketing filter, not a permission boundary: whenever the
// membership cannot be determined it must fail open (see channelCheck.ts).

/** How long a getChatMember answer is trusted before it is re-checked. */
export const CHANNEL_CHECK_TTL_SEC = 600;

// Public channel usernames: 5-32 chars, must start with a letter. Numeric
// -100… ids are accepted too, for a channel without a public username.
const CHANNEL_USERNAME_PATTERN = /^[A-Za-z][A-Za-z0-9_]{4,31}$/;
const CHANNEL_ID_PATTERN = /^-100[0-9]{5,16}$/;

// Telegram answers a getChatMember for a user who has no relationship with the
// chat with a 400 instead of status:"left". That is a definitive "not a
// member", unlike "chat not found" / "member list is inaccessible", which mean
// the bot itself cannot see the channel.
const USER_NOT_FOUND_FRAGMENTS: readonly string[] = ['user not found', 'PARTICIPANT_ID_INVALID'];

const SUBSCRIBED_STATUSES: readonly string[] = ['creator', 'administrator', 'member'];

/**
 * Normalizes a channel as typed by an admin ("@name", "name", "-1001234567890")
 * into the value Telegram's chat_id accepts. Returns null when it is not a
 * usable channel reference.
 */
export function normalizeChannelHandle(input: string): string | null {
  const trimmed = input.trim();
  if (trimmed.length === 0) {
    return null;
  }
  if (CHANNEL_ID_PATTERN.test(trimmed)) {
    return trimmed;
  }
  const withoutAt = trimmed.startsWith('@') ? trimmed.slice(1) : trimmed;
  return CHANNEL_USERNAME_PATTERN.test(withoutAt) ? withoutAt : null;
}

/** The chat_id value to send to Telegram for a normalized channel. */
export function channelChatId(channel: string): string {
  return channel.startsWith('-') ? channel : `@${channel}`;
}

/** The t.me link for a normalized channel; null for a channel without a username. */
export function channelLink(channel: string): string | null {
  return channel.startsWith('-') ? null : `https://t.me/${channel}`;
}

/**
 * Whether a getChatMember status counts as subscribed. `restricted` members are
 * still in the chat only while is_member is true.
 */
export function isSubscribedStatus(status: string, isMember: boolean | undefined): boolean {
  if (status === 'restricted') {
    return isMember === true;
  }
  return SUBSCRIBED_STATUSES.includes(status);
}

/** True when a Telegram 400 description means "this user was never in the chat". */
export function isUserNotFoundDescription(description: string | null): boolean {
  if (description === null) {
    return false;
  }
  const lowered = description.toLowerCase();
  return USER_NOT_FOUND_FRAGMENTS.some((fragment) => lowered.includes(fragment.toLowerCase()));
}

export interface GateInput {
  /** settings.required_channel, already normalized; null/empty disables the gate. */
  requiredChannel: string | null;
  /** users.channel_subscribed */
  cachedSubscribed: boolean;
  /** users.channel_checked_at as an ISO string, null when never checked. */
  checkedAt: string | null;
  nowMs: number;
  ttlSec: number;
}

/**
 * - `off`     — no channel configured, let everyone through
 * - `allow`   — fresh cache says subscribed
 * - `block`   — fresh cache says not subscribed
 * - `recheck` — no cache or a stale one, ask Telegram
 */
export type GateDecision = 'off' | 'allow' | 'block' | 'recheck';

export function decideGate(input: GateInput): GateDecision {
  if (input.requiredChannel === null || input.requiredChannel.length === 0) {
    return 'off';
  }
  if (input.checkedAt === null) {
    return 'recheck';
  }
  const checkedMs = Date.parse(input.checkedAt);
  if (Number.isNaN(checkedMs)) {
    return 'recheck';
  }
  const ageSec = (input.nowMs - checkedMs) / 1000;
  if (ageSec < 0 || ageSec >= input.ttlSec) {
    return 'recheck';
  }
  return input.cachedSubscribed ? 'allow' : 'block';
}
