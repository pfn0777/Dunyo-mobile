import { describe, expect, it } from 'vitest';
import { decideFieldUpload } from '../src/lib/uploadField';
import { WEBP_MAX_BYTES } from '../src/lib/validators';

// Minimal valid "RIFF....WEBP" header, padded to look like a real file.
function validWebpBytes(size = 20): Uint8Array {
  const bytes = new Uint8Array(size);
  const header = [0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50];
  header.forEach((byte, i) => {
    bytes[i] = byte;
  });
  return bytes;
}

describe('decideFieldUpload', () => {
  it('accepts a valid webp field', () => {
    const bytes = validWebpBytes();
    const result = decideFieldUpload('thumb', { mimetype: 'image/webp', size: bytes.length, truncated: false }, bytes);
    expect(result).toEqual({ ok: true, bytes });
  });

  it('reports a missing field distinctly, with the field name in the code', () => {
    expect(decideFieldUpload('main', null, null)).toEqual({ ok: false, code: 'missing_main' });
  });

  it('rejects a truncated upload as too_large without inspecting its bytes', () => {
    const bytes = validWebpBytes();
    const result = decideFieldUpload(
      'thumb',
      { mimetype: 'image/webp', size: WEBP_MAX_BYTES, truncated: true },
      bytes,
    );
    expect(result).toEqual({ ok: false, code: 'thumb_too_large' });
  });

  it('rejects the wrong content type, prefixed with the field name', () => {
    const bytes = validWebpBytes();
    const result = decideFieldUpload('image', { mimetype: 'image/png', size: bytes.length, truncated: false }, bytes);
    expect(result).toEqual({ ok: false, code: 'image_invalid_content_type' });
  });

  it('rejects bytes that fail the WebP magic-byte check', () => {
    const bytes = new Uint8Array(20); // all zeros — not a RIFF/WEBP header
    const result = decideFieldUpload('main', { mimetype: 'image/webp', size: bytes.length, truncated: false }, bytes);
    expect(result).toEqual({ ok: false, code: 'main_invalid_magic_bytes' });
  });
});
