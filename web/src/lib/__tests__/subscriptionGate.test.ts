import { describe, expect, it } from 'vitest';
import { decideSubscriptionGate } from '../subscriptionGate.ts';
import type { Me } from '../types.ts';

const BASE_ME: Me = {
  id: 1,
  first_name: 'A',
  last_name: null,
  username: null,
  phone: null,
  phone_verified: false,
  is_admin: false,
  admin_role: null,
  channel_required: false,
  channel_username: null,
};

describe('decideSubscriptionGate', () => {
  it('bypasses when running the mock and the mock profile does not require the channel', () => {
    expect(
      decideSubscriptionGate({ mock: true, insideTelegram: false, isLoading: false, isError: false, me: BASE_ME, flagged: false }),
    ).toBe('bypass');
  });

  it('gates when running the mock and ?simulate=not_subscribed flags the mock profile', () => {
    expect(
      decideSubscriptionGate({
        mock: true,
        insideTelegram: false,
        isLoading: false,
        isError: false,
        me: { ...BASE_ME, channel_required: true },
        flagged: false,
      }),
    ).toBe('gate');
  });

  it('bypasses outside Telegram (RequireAuth owns that screen instead)', () => {
    expect(
      decideSubscriptionGate({ mock: false, insideTelegram: false, isLoading: false, isError: false, me: undefined, flagged: false }),
    ).toBe('bypass');
  });

  it('gates immediately when a request already came back 403 channel_required', () => {
    expect(
      decideSubscriptionGate({ mock: false, insideTelegram: true, isLoading: false, isError: false, me: BASE_ME, flagged: true }),
    ).toBe('gate');
  });

  it('shows loading while the first /me request is in flight', () => {
    expect(
      decideSubscriptionGate({ mock: false, insideTelegram: true, isLoading: true, isError: false, me: undefined, flagged: false }),
    ).toBe('loading');
  });

  it('fails open (allow) when /me errors, like the server does', () => {
    expect(
      decideSubscriptionGate({ mock: false, insideTelegram: true, isLoading: false, isError: true, me: undefined, flagged: false }),
    ).toBe('allow');
  });

  it('allows when /me reports channel_required=false', () => {
    expect(
      decideSubscriptionGate({ mock: false, insideTelegram: true, isLoading: false, isError: false, me: BASE_ME, flagged: false }),
    ).toBe('allow');
  });

  it('gates when /me reports channel_required=true', () => {
    expect(
      decideSubscriptionGate({
        mock: false,
        insideTelegram: true,
        isLoading: false,
        isError: false,
        me: { ...BASE_ME, channel_required: true },
        flagged: false,
      }),
    ).toBe('gate');
  });
});
