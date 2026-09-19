import { describe, expect, it } from 'vitest';
import { readEnv } from '../src/lib/env';

const VALID: Record<string, string> = {
  DATABASE_URL: 'postgres://user:pass@localhost:5432/dunyo',
  TELEGRAM_BOT_TOKEN: 'bot-token',
  TELEGRAM_WEBHOOK_SECRET: 'webhook-secret',
  WEBAPP_URL: 'https://app.example.com',
  MEDIA_DIR: '/srv/dunyo/media',
};

function getEnvFrom(values: Record<string, string>): (key: string) => string | undefined {
  return (key) => values[key];
}

describe('readEnv', () => {
  it('succeeds with all required vars and applies defaults', () => {
    const env = readEnv(getEnvFrom(VALID));
    expect(env.INIT_DATA_MAX_AGE_SEC).toBe(86400);
    expect(env.PORT).toBe(3000);
    expect(env.ALLOWED_ORIGINS.length).toBe(0);
  });

  it('throws when a required var is missing', () => {
    const { DATABASE_URL: _unused, ...rest } = VALID;
    expect(() => readEnv(getEnvFrom(rest))).toThrow();
  });

  it('throws when MEDIA_DIR is missing', () => {
    const { MEDIA_DIR: _unused, ...rest } = VALID;
    expect(() => readEnv(getEnvFrom(rest))).toThrow();
  });

  it('parses ALLOWED_ORIGINS as a trimmed comma-separated list', () => {
    const env = readEnv(getEnvFrom({ ...VALID, ALLOWED_ORIGINS: 'https://a.com, https://b.com ,https://c.com' }));
    expect(env.ALLOWED_ORIGINS.length).toBe(3);
    expect(env.ALLOWED_ORIGINS[1]).toBe('https://b.com');
  });

  it('rejects a non-positive INIT_DATA_MAX_AGE_SEC', () => {
    expect(() => readEnv(getEnvFrom({ ...VALID, INIT_DATA_MAX_AGE_SEC: '0' }))).toThrow();
  });

  it('parses a custom PORT', () => {
    const env = readEnv(getEnvFrom({ ...VALID, PORT: '4000' }));
    expect(env.PORT).toBe(4000);
  });

  it('rejects a non-positive PORT', () => {
    expect(() => readEnv(getEnvFrom({ ...VALID, PORT: '0' }))).toThrow();
    expect(() => readEnv(getEnvFrom({ ...VALID, PORT: 'abc' }))).toThrow();
  });
});
