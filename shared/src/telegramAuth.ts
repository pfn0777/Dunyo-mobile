import { normalizePhone } from './phone.ts';

const HMAC_ALGORITHM = 'SHA-256';
const WEBAPP_DATA_KEY = 'WebAppData';
const HASH_FIELD = 'hash';
const FUTURE_SKEW_SEC = 5;

export type ValidationErrorCode =
  | 'missing_hash'
  | 'bad_hash'
  | 'expired'
  | 'bad_auth_date'
  | 'bad_payload'
  | 'user_mismatch';

export type ValidationResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: ValidationErrorCode };

export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}

export interface InitDataPayload {
  user: TelegramUser;
  authDate: number;
  queryId?: string;
}

export interface ContactPayload {
  userId: number;
  phone: string;
}

interface VerifyOptions {
  maxAgeSec: number;
  nowSec?: number;
}

async function hmacSha256(keyBytes: BufferSource, message: string): Promise<ArrayBuffer> {
  const cryptoKey = await globalThis.crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'HMAC', hash: HMAC_ALGORITHM },
    false,
    ['sign'],
  );
  return globalThis.crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(message));
}

function bufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * Computes the Telegram Mini App data-check hash per the documented algorithm:
 * secret_key = HMAC_SHA256(key="WebAppData", message=botToken)
 * hash = hex(HMAC_SHA256(key=secret_key, message=dataCheckString))
 */
async function computeExpectedHash(dataCheckString: string, botToken: string): Promise<string> {
  const secretKey = await hmacSha256(new TextEncoder().encode(WEBAPP_DATA_KEY), botToken);
  const signature = await hmacSha256(secretKey, dataCheckString);
  return bufferToHex(signature);
}

interface ParsedFields {
  fields: Map<string, string>;
  dataCheckString: string;
  hash: string | null;
}

function parseInitDataString(raw: string): ParsedFields {
  const params = new URLSearchParams(raw);
  const fields = new Map<string, string>();
  let hash: string | null = null;
  for (const [key, value] of params.entries()) {
    if (key === HASH_FIELD) {
      hash = value;
      continue;
    }
    fields.set(key, value);
  }
  const dataCheckString = Array.from(fields.keys())
    .sort()
    .map((key) => `${key}=${fields.get(key) ?? ''}`)
    .join('\n');
  return { fields, dataCheckString, hash };
}

function checkAuthDate(
  fields: Map<string, string>,
  opts: VerifyOptions,
): { ok: true; authDate: number } | { ok: false; code: ValidationErrorCode } {
  const rawAuthDate = fields.get('auth_date');
  if (rawAuthDate === undefined || !/^\d+$/.test(rawAuthDate)) {
    return { ok: false, code: 'bad_auth_date' };
  }
  const authDate = Number.parseInt(rawAuthDate, 10);
  const now = opts.nowSec ?? Math.floor(Date.now() / 1000);
  if (authDate - now > FUTURE_SKEW_SEC) {
    return { ok: false, code: 'bad_auth_date' };
  }
  if (now - authDate > opts.maxAgeSec) {
    return { ok: false, code: 'expired' };
  }
  return { ok: true, authDate };
}

async function verifyAndParse(
  raw: string,
  botToken: string,
  opts: VerifyOptions,
): Promise<
  | { ok: true; fields: Map<string, string>; authDate: number }
  | { ok: false; code: ValidationErrorCode }
> {
  const { fields, dataCheckString, hash } = parseInitDataString(raw);
  if (hash === null) {
    return { ok: false, code: 'missing_hash' };
  }
  const expectedHash = await computeExpectedHash(dataCheckString, botToken);
  if (!constantTimeEqual(hash, expectedHash)) {
    return { ok: false, code: 'bad_hash' };
  }
  const authDateResult = checkAuthDate(fields, opts);
  if (!authDateResult.ok) {
    return authDateResult;
  }
  return { ok: true, fields, authDate: authDateResult.authDate };
}

/**
 * Validates Telegram Mini App `initData` per the documented algorithm and
 * returns the parsed user/auth_date payload on success.
 */
export async function validateInitData(
  initData: string,
  botToken: string,
  opts: VerifyOptions,
): Promise<ValidationResult<InitDataPayload>> {
  const verified = await verifyAndParse(initData, botToken, opts);
  if (!verified.ok) {
    return verified;
  }

  const rawUser = verified.fields.get('user');
  if (rawUser === undefined) {
    return { ok: false, code: 'bad_payload' };
  }

  let user: TelegramUser;
  try {
    const parsed: unknown = JSON.parse(rawUser);
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      typeof (parsed as { id?: unknown }).id !== 'number' ||
      typeof (parsed as { first_name?: unknown }).first_name !== 'string'
    ) {
      return { ok: false, code: 'bad_payload' };
    }
    user = parsed as TelegramUser;
  } catch {
    return { ok: false, code: 'bad_payload' };
  }

  return {
    ok: true,
    data: {
      user,
      authDate: verified.authDate,
      queryId: verified.fields.get('query_id'),
    },
  };
}

/**
 * Validates the signed `response` string produced by WebApp.requestContact,
 * using the same HMAC algorithm as initData. Succeeds only when the
 * contact's user_id matches the caller's own Telegram id.
 */
export async function validateContactResponse(
  response: string,
  botToken: string,
  expectedUserId: number,
  opts: VerifyOptions,
): Promise<ValidationResult<ContactPayload>> {
  const verified = await verifyAndParse(response, botToken, opts);
  if (!verified.ok) {
    return verified;
  }

  const rawContact = verified.fields.get('contact');
  if (rawContact === undefined) {
    return { ok: false, code: 'bad_payload' };
  }

  let contact: { user_id: unknown; phone_number: unknown };
  try {
    const parsed: unknown = JSON.parse(rawContact);
    if (typeof parsed !== 'object' || parsed === null) {
      return { ok: false, code: 'bad_payload' };
    }
    contact = parsed as { user_id: unknown; phone_number: unknown };
  } catch {
    return { ok: false, code: 'bad_payload' };
  }

  if (typeof contact.user_id !== 'number' || typeof contact.phone_number !== 'string') {
    return { ok: false, code: 'bad_payload' };
  }

  if (contact.user_id !== expectedUserId) {
    return { ok: false, code: 'user_mismatch' };
  }

  const phone = normalizePhone(contact.phone_number);
  if (phone === null) {
    return { ok: false, code: 'bad_payload' };
  }

  return { ok: true, data: { userId: contact.user_id, phone } };
}
