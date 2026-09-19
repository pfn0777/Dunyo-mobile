import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { validateContactResponse, validateInitData } from '../src/telegramAuth.ts';

const BOT_TOKEN = '123456:TEST-BOT-TOKEN-abcDEF';
const MAX_AGE_SEC = 86400;

/**
 * Independent reference implementation of the Telegram data-check hash,
 * built with Node's node:crypto (not Web Crypto) so it verifies the
 * production implementation rather than duplicating its own bug.
 */
function referenceHash(fields: Record<string, string>, botToken: string): string {
  const dataCheckString = Object.keys(fields)
    .sort()
    .map((key) => `${key}=${fields[key]}`)
    .join('\n');
  const secretKey = createHmac('sha256', 'WebAppData').update(botToken).digest();
  return createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
}

function buildInitData(fields: Record<string, string>, botToken: string): string {
  const hash = referenceHash(fields, botToken);
  const params = new URLSearchParams({ ...fields, hash });
  return params.toString();
}

function nowSec(): number {
  return Math.floor(Date.now() / 1000);
}

describe('validateInitData', () => {
  it('accepts a correctly signed payload', async () => {
    const fields = {
      auth_date: String(nowSec()),
      query_id: 'AAH123',
      user: JSON.stringify({ id: 42, first_name: 'Ali' }),
    };
    const initData = buildInitData(fields, BOT_TOKEN);
    const result = await validateInitData(initData, BOT_TOKEN, { maxAgeSec: MAX_AGE_SEC });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.user.id).toBe(42);
      expect(result.data.user.first_name).toBe('Ali');
    }
  });

  it('rejects when one character of the hash is changed', async () => {
    const fields = {
      auth_date: String(nowSec()),
      user: JSON.stringify({ id: 42, first_name: 'Ali' }),
    };
    const validHash = referenceHash(fields, BOT_TOKEN);
    const tamperedHash = (validHash[0] === 'a' ? 'b' : 'a') + validHash.slice(1);
    const params = new URLSearchParams({ ...fields, hash: tamperedHash });
    const result = await validateInitData(params.toString(), BOT_TOKEN, { maxAgeSec: MAX_AGE_SEC });
    expect(result).toEqual({ ok: false, code: 'bad_hash' });
  });

  it('rejects auth_date older than 24 hours plus one second', async () => {
    const staleAuthDate = nowSec() - (MAX_AGE_SEC + 1);
    const fields = {
      auth_date: String(staleAuthDate),
      user: JSON.stringify({ id: 42, first_name: 'Ali' }),
    };
    const initData = buildInitData(fields, BOT_TOKEN);
    const result = await validateInitData(initData, BOT_TOKEN, { maxAgeSec: MAX_AGE_SEC });
    expect(result).toEqual({ ok: false, code: 'expired' });
  });

  it('rejects when hash is missing', async () => {
    const params = new URLSearchParams({
      auth_date: String(nowSec()),
      user: JSON.stringify({ id: 42, first_name: 'Ali' }),
    });
    const result = await validateInitData(params.toString(), BOT_TOKEN, { maxAgeSec: MAX_AGE_SEC });
    expect(result).toEqual({ ok: false, code: 'missing_hash' });
  });
});

describe('validateContactResponse', () => {
  it('rejects a contact belonging to a different user_id', async () => {
    const fields = {
      auth_date: String(nowSec()),
      contact: JSON.stringify({ user_id: 999, phone_number: '+998901234567' }),
    };
    const response = buildInitData(fields, BOT_TOKEN);
    const result = await validateContactResponse(response, BOT_TOKEN, 42, { maxAgeSec: MAX_AGE_SEC });
    expect(result).toEqual({ ok: false, code: 'user_mismatch' });
  });

  it('accepts a matching user_id and returns the normalized phone', async () => {
    const fields = {
      auth_date: String(nowSec()),
      contact: JSON.stringify({ user_id: 42, phone_number: '998 90 123-45-67' }),
    };
    const response = buildInitData(fields, BOT_TOKEN);
    const result = await validateContactResponse(response, BOT_TOKEN, 42, { maxAgeSec: MAX_AGE_SEC });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.phone).toBe('+998901234567');
    }
  });
});
