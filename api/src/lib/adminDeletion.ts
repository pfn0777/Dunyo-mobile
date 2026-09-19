// The pure decision behind DELETE /admin/admins/:telegramId.
//
// Extracted out of the route handler so it can be unit-tested without a DB,
// the way the rest of this codebase makes impure handlers testable. The two
// guards it enforces are the reason it exists:
//
//   - an owner may not delete themselves, and
//   - the last remaining owner may not be deleted,
//
// because either one would leave the shop with no account able to manage
// admins, which is only recoverable by hand-editing the database.
//
// Note the deliberate fail-CLOSED default: when the owner count is unknown
// (a failed or empty count query) we refuse the delete rather than allow it.
// A guard that disappears when a query misbehaves is not a guard.

import type { AdminRole } from './auth.js';

export interface AdminDeletionInput {
  /** Telegram id of the admin row being deleted. */
  targetId: number;
  /** Role of that row, or null when no such row exists. */
  targetRole: AdminRole | null;
  /** Telegram id of the owner making the request. */
  requesterId: number;
  /** How many rows in admin_users have role 'owner', or null when unknown. */
  ownerCount: number | null;
}

export type AdminDeletionDecision =
  | { ok: true }
  | { ok: false; code: 'cannot_delete_self' | 'cannot_delete_last_owner'; status: 422 }
  | { ok: false; code: 'not_found'; status: 404 };

export function decideAdminDeletion(input: AdminDeletionInput): AdminDeletionDecision {
  if (input.targetId === input.requesterId) {
    return { ok: false, code: 'cannot_delete_self', status: 422 };
  }

  if (input.targetRole === null) {
    return { ok: false, code: 'not_found', status: 404 };
  }

  if (input.targetRole === 'owner') {
    // Unknown count => refuse. See the fail-closed note above.
    if (input.ownerCount === null || input.ownerCount <= 1) {
      return { ok: false, code: 'cannot_delete_last_owner', status: 422 };
    }
  }

  return { ok: true };
}
