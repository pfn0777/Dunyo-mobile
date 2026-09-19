import { describe, expect, it } from 'vitest';
import {
  channelChatId,
  channelLink,
  decideGate,
  isSubscribedStatus,
  isUserNotFoundDescription,
  normalizeChannelHandle,
} from '../src/lib/channelGate';

const NOW = Date.parse('2026-09-18T10:00:00Z');

function gate(overrides: Partial<Parameters<typeof decideGate>[0]> = {}) {
  return decideGate({
    requiredChannel: 'dunyo_mobile_kanali',
    cachedSubscribed: true,
    checkedAt: new Date(NOW - 60_000).toISOString(),
    nowMs: NOW,
    ttlSec: 600,
    ...overrides,
  });
}

describe('normalizeChannelHandle', () => {
  it('accepts a handle with and without the @', () => {
    expect(normalizeChannelHandle('@dunyo_mobile_kanali')).toBe('dunyo_mobile_kanali');
    expect(normalizeChannelHandle('dunyo_mobile_kanali')).toBe('dunyo_mobile_kanali');
    expect(normalizeChannelHandle('  @dunyo_mobile_kanali  ')).toBe('dunyo_mobile_kanali');
  });

  it('accepts a -100 channel id', () => {
    expect(normalizeChannelHandle('-1001234567890')).toBe('-1001234567890');
  });

  it('rejects anything Telegram would not accept', () => {
    expect(normalizeChannelHandle('')).toBeNull();
    expect(normalizeChannelHandle('   ')).toBeNull();
    expect(normalizeChannelHandle('abc')).toBeNull();
    expect(normalizeChannelHandle('1channel')).toBeNull();
    expect(normalizeChannelHandle('has space')).toBeNull();
    expect(normalizeChannelHandle('https://t.me/kanal')).toBeNull();
    expect(normalizeChannelHandle('-100123')).toBeNull();
  });
});

describe('channelChatId', () => {
  it('usernames get an @, numeric ids are sent as-is', () => {
    expect(channelChatId('dunyo_mobile_kanali')).toBe('@dunyo_mobile_kanali');
    expect(channelChatId('-1001234567890')).toBe('-1001234567890');
  });
});

describe('channelLink', () => {
  it('only a username has a t.me link', () => {
    expect(channelLink('dunyo_mobile_kanali')).toBe('https://t.me/dunyo_mobile_kanali');
    expect(channelLink('-1001234567890')).toBeNull();
  });
});

describe('isSubscribedStatus', () => {
  it('members, admins and the creator are subscribed', () => {
    expect(isSubscribedStatus('member', undefined)).toBe(true);
    expect(isSubscribedStatus('administrator', undefined)).toBe(true);
    expect(isSubscribedStatus('creator', undefined)).toBe(true);
  });

  it('left and kicked are not subscribed', () => {
    expect(isSubscribedStatus('left', undefined)).toBe(false);
    expect(isSubscribedStatus('kicked', undefined)).toBe(false);
    expect(isSubscribedStatus('something_new', undefined)).toBe(false);
  });

  it('restricted counts only while still a member', () => {
    expect(isSubscribedStatus('restricted', true)).toBe(true);
    expect(isSubscribedStatus('restricted', false)).toBe(false);
    expect(isSubscribedStatus('restricted', undefined)).toBe(false);
  });
});

describe('isUserNotFoundDescription', () => {
  it('only a "user not found" style 400 is a definitive answer', () => {
    expect(isUserNotFoundDescription('Bad Request: user not found')).toBe(true);
    expect(isUserNotFoundDescription('Bad Request: PARTICIPANT_ID_INVALID')).toBe(true);
    expect(isUserNotFoundDescription('Bad Request: chat not found')).toBe(false);
    expect(isUserNotFoundDescription('Bad Request: member list is inaccessible')).toBe(false);
    expect(isUserNotFoundDescription(null)).toBe(false);
  });
});

describe('decideGate', () => {
  it('no configured channel switches the gate off', () => {
    expect(gate({ requiredChannel: null })).toBe('off');
    expect(gate({ requiredChannel: '' })).toBe('off');
  });

  it('a fresh cache is trusted in both directions', () => {
    expect(gate({ cachedSubscribed: true })).toBe('allow');
    expect(gate({ cachedSubscribed: false })).toBe('block');
  });

  it('never checked means ask Telegram', () => {
    expect(gate({ checkedAt: null })).toBe('recheck');
  });

  it('the cache expires exactly at the TTL', () => {
    const justInside = new Date(NOW - 599_000).toISOString();
    const atTtl = new Date(NOW - 600_000).toISOString();
    expect(gate({ checkedAt: justInside })).toBe('allow');
    expect(gate({ checkedAt: atTtl })).toBe('recheck');
  });

  it('an unparseable or future timestamp forces a re-check', () => {
    expect(gate({ checkedAt: 'not a date' })).toBe('recheck');
    expect(gate({ checkedAt: new Date(NOW + 60_000).toISOString() })).toBe('recheck');
  });
});
