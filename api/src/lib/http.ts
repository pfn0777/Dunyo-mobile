// Small HTTP helpers shared by every route: a uniform error body shape and
// CORS origin handling restricted to a configured allow-list.
//
// Unlike XUMO (Deno's standard Request/Response), this runs on Fastify, so
// route handlers build a plain { status, body } result and send it via
// `reply.code(status).send(body)` instead of constructing a Response object.
// resolveAllowedOrigin is also what Phase 3b passes into @fastify/cors's
// `origin` option.

export const MAX_BODY_BYTES = 2 * 1024 * 1024; // 2 MB: generous for JSON bodies, passed as Fastify's bodyLimit.

const ALLOWED_REQUEST_HEADERS = 'authorization, content-type, x-idempotency-key';
const ALLOWED_METHODS = 'GET, POST, PUT, PATCH, DELETE, OPTIONS';

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

// This exact shape — { error: { code, message, details? } } — is a public API
// contract the Mini App branches on. Never change its shape without updating
// every frontend call site.
export interface ApiErrorBody {
  error: ApiError;
}

/** Picks the Access-Control-Allow-Origin value: the request origin if it is
 * in the allow-list, otherwise null (meaning: do not allow / omit header). */
export function resolveAllowedOrigin(
  requestOrigin: string | null,
  allowedOrigins: readonly string[],
): string | null {
  if (requestOrigin === null) {
    return null;
  }
  return allowedOrigins.includes(requestOrigin) ? requestOrigin : null;
}

export function buildCorsHeaders(
  requestOrigin: string | null,
  allowedOrigins: readonly string[],
): Record<string, string> {
  const allowedOrigin = resolveAllowedOrigin(requestOrigin, allowedOrigins);
  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': ALLOWED_METHODS,
    'Access-Control-Allow-Headers': ALLOWED_REQUEST_HEADERS,
    Vary: 'Origin',
  };
  if (allowedOrigin !== null) {
    headers['Access-Control-Allow-Origin'] = allowedOrigin;
  }
  return headers;
}

export interface HttpResult<T> {
  status: number;
  body: T;
}

export function jsonResult<T>(body: T, status: number): HttpResult<T> {
  return { status, body };
}

/**
 * `details` carries any extra fields a client needs to react to the error —
 * e.g. create_order's `items:[{variant_id, available}]` for stock_changed,
 * `items:[{variant_id, price}]` for price_changed, or `min_order_amount`/
 * `items_total` for min_order. Omitted (not serialized) when there is none.
 */
export function errorResult(
  code: string,
  message: string,
  status: number,
  details?: Record<string, unknown>,
): HttpResult<ApiErrorBody> {
  return { status, body: { error: { code, message, details } } };
}
