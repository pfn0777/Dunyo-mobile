// Turns one parsed multipart field into a validated-upload decision, without
// touching Fastify's request/multipart types — those only describe how the
// bytes got here, not whether they're an acceptable image, so this stays
// pure and unit-testable. validateWebpUpload (validators.ts) already checks
// content-type/size/magic-bytes; this module adds the two things a route
// handler discovers only from the multipart parser itself: a missing field,
// and a file that @fastify/multipart truncated because it hit the configured
// per-file size limit (WEBP_MAX_BYTES) before we ever got to measure it.

import { validateWebpUpload, type WebpUploadValidationResult } from './validators.js';

export interface MultipartFileInfo {
  mimetype: string;
  size: number;
  truncated: boolean;
}

export type FieldUploadResult = { ok: true; bytes: Uint8Array } | { ok: false; code: string };

/**
 * `field` is null when the multipart form had no part with that fieldname at
 * all. A truncated file is rejected as "too_large" without ever reaching
 * validateWebpUpload — its buffer was cut short by the parser, so neither its
 * true size nor its trailing magic bytes can be trusted.
 */
export function decideFieldUpload(
  fieldName: string,
  field: MultipartFileInfo | null,
  bytes: Uint8Array | null,
): FieldUploadResult {
  if (field === null || bytes === null) {
    return { ok: false, code: `missing_${fieldName}` };
  }
  if (field.truncated) {
    return { ok: false, code: `${fieldName}_too_large` };
  }
  const validation: WebpUploadValidationResult = validateWebpUpload(field.mimetype, field.size, bytes);
  if (!validation.ok) {
    return { ok: false, code: `${fieldName}_${validation.code}` };
  }
  return { ok: true, bytes };
}
