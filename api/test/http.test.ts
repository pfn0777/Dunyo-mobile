import { describe, expect, it } from 'vitest';
import { buildCorsHeaders, errorResult, resolveAllowedOrigin } from '../src/lib/http';

const ALLOWED = ['https://dunyo.example.com', 'https://admin.dunyo.example.com'];

describe('resolveAllowedOrigin', () => {
  it('allows an origin in the allow-list', () => {
    expect(resolveAllowedOrigin('https://dunyo.example.com', ALLOWED)).toBe('https://dunyo.example.com');
  });

  it('rejects an origin not in the allow-list', () => {
    expect(resolveAllowedOrigin('https://evil.example.com', ALLOWED)).toBeNull();
  });

  it('rejects a null origin', () => {
    expect(resolveAllowedOrigin(null, ALLOWED)).toBeNull();
  });
});

describe('buildCorsHeaders', () => {
  it('omits Access-Control-Allow-Origin for a disallowed origin', () => {
    const headers = buildCorsHeaders('https://evil.example.com', ALLOWED);
    expect(headers['Access-Control-Allow-Origin']).toBeUndefined();
  });

  it('exposes the required request headers', () => {
    const headers = buildCorsHeaders('https://dunyo.example.com', ALLOWED);
    expect(headers['Access-Control-Allow-Headers']).toContain('x-idempotency-key');
    expect(headers['Access-Control-Allow-Headers']).toContain('authorization');
  });

  // Regression: PUT /favorites/:variantId is the only PUT route, and leaving
  // it out of the allow-list would make the browser block the preflight.
  it('allows every method the api routes use', () => {
    const headers = buildCorsHeaders('https://dunyo.example.com', ALLOWED);
    const allowed = headers['Access-Control-Allow-Methods']!;
    for (const method of ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']) {
      expect(allowed).toContain(method);
    }
  });
});

describe('errorResult', () => {
  it('produces the { error: { code, message, details } } envelope', () => {
    const result = errorResult('bad_request', 'Bad request', 400);
    expect(result.status).toBe(400);
    expect(result.body).toEqual({ error: { code: 'bad_request', message: 'Bad request', details: undefined } });
  });

  it('serializes without a details key when details is omitted', () => {
    const result = errorResult('bad_request', 'Bad request', 400);
    expect(JSON.parse(JSON.stringify(result.body))).toEqual({
      error: { code: 'bad_request', message: 'Bad request' },
    });
  });

  it('preserves details when provided', () => {
    const result = errorResult('stock_changed', 'Stock changed', 409, {
      items: [{ variant_id: 7, available: 1 }],
    });
    expect(result.body.error.details).toEqual({ items: [{ variant_id: 7, available: 1 }] });
  });
});
