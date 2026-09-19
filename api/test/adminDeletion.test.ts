import { describe, expect, it } from 'vitest';

import { decideAdminDeletion } from '../src/lib/adminDeletion.js';

const OWNER = 100;

describe('decideAdminDeletion', () => {
  it('allows an owner to delete a plain admin', () => {
    expect(
      decideAdminDeletion({ targetId: 200, targetRole: 'admin', requesterId: OWNER, ownerCount: 1 }),
    ).toEqual({ ok: true });
  });

  it('refuses self-deletion, even when other owners exist', () => {
    expect(
      decideAdminDeletion({ targetId: OWNER, targetRole: 'owner', requesterId: OWNER, ownerCount: 5 }),
    ).toEqual({ ok: false, code: 'cannot_delete_self', status: 422 });
  });

  it('checks self-deletion before existence, so deleting yourself never reports not_found', () => {
    expect(
      decideAdminDeletion({ targetId: OWNER, targetRole: null, requesterId: OWNER, ownerCount: 1 }),
    ).toEqual({ ok: false, code: 'cannot_delete_self', status: 422 });
  });

  it('reports not_found for a telegram id that is not an admin', () => {
    expect(
      decideAdminDeletion({ targetId: 200, targetRole: null, requesterId: OWNER, ownerCount: 2 }),
    ).toEqual({ ok: false, code: 'not_found', status: 404 });
  });

  it('refuses to delete the last owner', () => {
    expect(
      decideAdminDeletion({ targetId: 200, targetRole: 'owner', requesterId: OWNER, ownerCount: 1 }),
    ).toEqual({ ok: false, code: 'cannot_delete_last_owner', status: 422 });
  });

  it('allows deleting an owner when another owner remains', () => {
    expect(
      decideAdminDeletion({ targetId: 200, targetRole: 'owner', requesterId: OWNER, ownerCount: 2 }),
    ).toEqual({ ok: true });
  });

  it('fails CLOSED when the owner count is unknown', () => {
    // A guard that vanishes when its count query misbehaves is not a guard.
    expect(
      decideAdminDeletion({ targetId: 200, targetRole: 'owner', requesterId: OWNER, ownerCount: null }),
    ).toEqual({ ok: false, code: 'cannot_delete_last_owner', status: 422 });
  });

  it('does not consult the owner count when deleting a plain admin', () => {
    expect(
      decideAdminDeletion({ targetId: 200, targetRole: 'admin', requesterId: OWNER, ownerCount: null }),
    ).toEqual({ ok: true });
  });
});
