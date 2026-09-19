import { describe, expect, it } from 'vitest';
import { buildMeResponse } from '../src/lib/meResponse';

const userRow = {
  id: 42,
  first_name: 'Ali',
  last_name: null,
  username: 'ali',
  phone: null,
  phone_verified: false,
};

const GATE_OFF = { requiredChannel: null, blocked: false };
const GATE_BLOCKED = { requiredChannel: 'dunyo_mobile_kanali', blocked: true };

describe('buildMeResponse', () => {
  it('non-admin gets is_admin=false and admin_role=null', () => {
    const result = buildMeResponse(userRow, null, GATE_OFF);
    expect(result.is_admin).toBe(false);
    expect(result.admin_role).toBeNull();
    expect(result.id).toBe(42);
  });

  it('admin row present gives is_admin=true and the matching role', () => {
    const result = buildMeResponse(userRow, { telegram_id: 42, role: 'admin' }, GATE_OFF);
    expect(result.is_admin).toBe(true);
    expect(result.admin_role).toBe('admin');
  });

  it('owner row gives admin_role=owner', () => {
    const result = buildMeResponse(userRow, { telegram_id: 42, role: 'owner' }, GATE_OFF);
    expect(result.is_admin).toBe(true);
    expect(result.admin_role).toBe('owner');
  });

  it('passes through all user fields unchanged', () => {
    const result = buildMeResponse(userRow, null, GATE_OFF);
    expect(result.first_name).toBe('Ali');
    expect(result.username).toBe('ali');
    expect(result.last_name).toBeNull();
    expect(result.phone).toBeNull();
    expect(result.phone_verified).toBe(false);
  });

  it('gate off means no channel fields for the client to act on', () => {
    const result = buildMeResponse(userRow, null, GATE_OFF);
    expect(result.channel_required).toBe(false);
    expect(result.channel_username).toBeNull();
  });

  it('a blocked customer gets channel_required with the channel to join', () => {
    const result = buildMeResponse(userRow, null, GATE_BLOCKED);
    expect(result.channel_required).toBe(true);
    expect(result.channel_username).toBe('dunyo_mobile_kanali');
  });

  it('admins are exempt from the channel gate', () => {
    const result = buildMeResponse(userRow, { telegram_id: 42, role: 'admin' }, GATE_BLOCKED);
    expect(result.channel_required).toBe(false);
    expect(result.channel_username).toBe('dunyo_mobile_kanali');
  });

  it('a numeric channel id is not exposed as a link target', () => {
    const result = buildMeResponse(userRow, null, { requiredChannel: '-1001234567890', blocked: true });
    expect(result.channel_required).toBe(true);
    expect(result.channel_username).toBeNull();
  });
});
