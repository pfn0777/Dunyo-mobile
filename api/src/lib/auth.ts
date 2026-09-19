import { validateInitData } from '@dunyo/shared';
import type { TelegramUser } from '@dunyo/shared';
import type { Db } from './db.js';

const AUTH_SCHEME = 'tma';

export interface AuthenticatedUser {
  id: number;
  firstName: string;
  lastName: string | null;
  username: string | null;
}

export type RequireUserResult =
  | { ok: true; user: AuthenticatedUser }
  | { ok: false };

export type AdminRole = 'owner' | 'admin';

export type RequireAdminResult =
  | { ok: true; user: AuthenticatedUser; role: AdminRole }
  | { ok: false; reason: 'unauthenticated' | 'forbidden' };

/** Extracts the initData string from an `Authorization: tma <initData>`
 * header. Returns null if the header is missing or malformed. Pure. */
export function extractInitData(authorizationHeader: string | null): string | null {
  if (authorizationHeader === null) {
    return null;
  }
  const spaceIndex = authorizationHeader.indexOf(' ');
  if (spaceIndex === -1) {
    return null;
  }
  const scheme = authorizationHeader.slice(0, spaceIndex);
  const value = authorizationHeader.slice(spaceIndex + 1).trim();
  if (scheme !== AUTH_SCHEME || value.length === 0) {
    return null;
  }
  return value;
}

function toAuthenticatedUser(telegramUser: TelegramUser): AuthenticatedUser {
  return {
    id: telegramUser.id,
    firstName: telegramUser.first_name,
    lastName: telegramUser.last_name ?? null,
    username: telegramUser.username ?? null,
  };
}

/**
 * Validates `Authorization: tma <initData>` and upserts the user row.
 * Returns the authenticated user on success, or `{ok:false}` (caller must
 * respond 401 {code:"auth_invalid"}) on any failure — missing header, bad
 * signature, or expired auth_date.
 */
export async function requireUser(
  initDataHeader: string | null,
  db: Db,
  botToken: string,
  maxAgeSec: number,
): Promise<RequireUserResult> {
  const initData = extractInitData(initDataHeader);
  if (initData === null) {
    return { ok: false };
  }

  const result = await validateInitData(initData, botToken, { maxAgeSec });
  if (!result.ok) {
    return { ok: false };
  }

  const user = toAuthenticatedUser(result.data.user);

  try {
    await db.query(
      `insert into users (id, first_name, last_name, username)
       values ($1, $2, $3, $4)
       on conflict (id) do update set
         first_name = excluded.first_name,
         last_name = excluded.last_name,
         username = excluded.username`,
      [user.id, user.firstName, user.lastName, user.username],
    );
  } catch (error) {
    console.error('requireUser: failed to upsert user', error);
    return { ok: false };
  }

  return { ok: true, user };
}

/**
 * requireUser plus an admin_users lookup on EVERY call (never cached/trusted
 * from the client). Returns the admin's role on success.
 */
export async function requireAdmin(
  initDataHeader: string | null,
  db: Db,
  botToken: string,
  maxAgeSec: number,
): Promise<RequireAdminResult> {
  const userResult = await requireUser(initDataHeader, db, botToken, maxAgeSec);
  if (!userResult.ok) {
    return { ok: false, reason: 'unauthenticated' };
  }

  let role: AdminRole | null = null;
  try {
    const row = await db.queryOne<{ role: AdminRole }>(
      'select role from admin_users where telegram_id = $1',
      [userResult.user.id],
    );
    role = row?.role ?? null;
  } catch (error) {
    console.error('requireAdmin: admin_users lookup failed', error);
    return { ok: false, reason: 'forbidden' };
  }

  if (role === null) {
    return { ok: false, reason: 'forbidden' };
  }

  return { ok: true, user: userResult.user, role };
}

/** requireAdmin, additionally requiring role === 'owner'. */
export async function requireOwner(
  initDataHeader: string | null,
  db: Db,
  botToken: string,
  maxAgeSec: number,
): Promise<RequireAdminResult> {
  const adminResult = await requireAdmin(initDataHeader, db, botToken, maxAgeSec);
  if (!adminResult.ok) {
    return adminResult;
  }
  if (adminResult.role !== 'owner') {
    return { ok: false, reason: 'forbidden' };
  }
  return adminResult;
}
