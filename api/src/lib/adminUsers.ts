// Shared admin_users lookup used outside the auth.ts requireAdmin/requireOwner
// flow — the webhook (group button re-check, /start gate) and the customer
// channel gate (admin exemption) both need "is this telegram id an admin?"
// without the initData/HTTP auth context that requireAdmin assumes.

import type { Db } from './db.js';

export async function isAdminUser(db: Db, telegramId: number): Promise<boolean> {
  try {
    const row = await db.queryOne<{ telegram_id: number }>(
      'select telegram_id from admin_users where telegram_id = $1',
      [telegramId],
    );
    return row !== null;
  } catch (error) {
    console.error('isAdminUser: admin_users lookup failed', error);
    return false;
  }
}
