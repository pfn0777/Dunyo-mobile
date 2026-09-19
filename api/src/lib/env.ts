// Reads required runtime configuration from environment variables and fails
// fast (at module load, before any request is handled) if something needed
// to run safely is missing.

export const DEFAULT_INIT_DATA_MAX_AGE_SEC = 86400;
export const DEFAULT_PORT = 3000;

export interface Env {
  DATABASE_URL: string;
  TELEGRAM_BOT_TOKEN: string;
  TELEGRAM_WEBHOOK_SECRET: string;
  WEBAPP_URL: string;
  MEDIA_DIR: string;
  PORT: number;
  INIT_DATA_MAX_AGE_SEC: number;
  ALLOWED_ORIGINS: readonly string[];
}

const REQUIRED_STRING_KEYS = [
  'DATABASE_URL',
  'TELEGRAM_BOT_TOKEN',
  'TELEGRAM_WEBHOOK_SECRET',
  'WEBAPP_URL',
  'MEDIA_DIR',
] as const;

/** Pure env reader, dependency-injected so it can be unit tested without
 * touching process.env directly. See loadEnv() for the real entry point. */
export function readEnv(getEnv: (key: string) => string | undefined): Env {
  const missing: string[] = [];
  const values: Record<string, string> = {};

  for (const key of REQUIRED_STRING_KEYS) {
    const value = getEnv(key);
    if (value === undefined || value.length === 0) {
      missing.push(key);
      continue;
    }
    values[key] = value;
  }

  if (missing.length > 0) {
    throw new Error(`Missing required environment variable(s): ${missing.join(', ')}`);
  }

  const rawMaxAge = getEnv('INIT_DATA_MAX_AGE_SEC');
  const maxAge = rawMaxAge === undefined || rawMaxAge.length === 0
    ? DEFAULT_INIT_DATA_MAX_AGE_SEC
    : Number.parseInt(rawMaxAge, 10);
  if (!Number.isInteger(maxAge) || maxAge <= 0) {
    throw new Error(`INIT_DATA_MAX_AGE_SEC must be a positive integer, got: ${String(rawMaxAge)}`);
  }

  const rawPort = getEnv('PORT');
  const port = rawPort === undefined || rawPort.length === 0
    ? DEFAULT_PORT
    : Number.parseInt(rawPort, 10);
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error(`PORT must be a positive integer, got: ${String(rawPort)}`);
  }

  const rawOrigins = getEnv('ALLOWED_ORIGINS') ?? '';
  const allowedOrigins = rawOrigins
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);

  return {
    DATABASE_URL: values['DATABASE_URL']!,
    TELEGRAM_BOT_TOKEN: values['TELEGRAM_BOT_TOKEN']!,
    TELEGRAM_WEBHOOK_SECRET: values['TELEGRAM_WEBHOOK_SECRET']!,
    WEBAPP_URL: values['WEBAPP_URL']!,
    MEDIA_DIR: values['MEDIA_DIR']!,
    PORT: port,
    INIT_DATA_MAX_AGE_SEC: maxAge,
    ALLOWED_ORIGINS: allowedOrigins,
  };
}

/**
 * Loads env config from process.env. Call once per process (module scope) so
 * a misconfigured deployment fails immediately instead of on the first request.
 */
export function loadEnv(): Env {
  return readEnv((key) => process.env[key]);
}
