// Pure builder for the GET /me response body, extracted out of the route
// handler so it can be unit tested without a DB.

export interface MeUserRow {
  id: number;
  first_name: string;
  last_name: string | null;
  username: string | null;
  phone: string | null;
  phone_verified: boolean;
}

export interface MeAdminRow {
  telegram_id: number;
  role: 'owner' | 'admin';
}

export interface MeChannelState {
  /** The required channel, or null when the gate is switched off. */
  requiredChannel: string | null;
  /** True when the user is definitely not subscribed. */
  blocked: boolean;
}

export interface MeResponseBody {
  id: number;
  first_name: string;
  last_name: string | null;
  username: string | null;
  phone: string | null;
  phone_verified: boolean;
  is_admin: boolean;
  admin_role: 'owner' | 'admin' | null;
  /** True when the Mini App must show the "join the channel" screen. */
  channel_required: boolean;
  /** Channel to link to; null when the gate is off or the channel has no username. */
  channel_username: string | null;
}

/**
 * `adminRow` is null when the caller has no admin_users row (not an admin).
 * Admins are exempt from the channel gate, so shop staff can never lock
 * themselves out of the admin panel — the client needs no logic of its own,
 * `channel_required` already accounts for it.
 */
export function buildMeResponse(
  userRow: MeUserRow,
  adminRow: MeAdminRow | null,
  channel: MeChannelState,
): MeResponseBody {
  const isAdmin = adminRow !== null;
  const channelUsername = channel.requiredChannel !== null && !channel.requiredChannel.startsWith('-')
    ? channel.requiredChannel
    : null;
  return {
    id: userRow.id,
    first_name: userRow.first_name,
    last_name: userRow.last_name,
    username: userRow.username,
    phone: userRow.phone,
    phone_verified: userRow.phone_verified,
    is_admin: isAdmin,
    admin_role: adminRow?.role ?? null,
    channel_required: channel.blocked && !isAdmin,
    channel_username: channelUsername,
  };
}
