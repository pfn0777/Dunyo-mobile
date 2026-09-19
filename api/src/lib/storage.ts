// Filesystem-backed media storage (no Supabase Storage here: one VPS, a
// plain disk volume served by Caddy at /media/*).
//
// Security: this is the one place a path-traversal payload could land, since
// every path is built from a client-influenced id (variant/banner/category/
// brand id) or hash. Every write/delete resolves the final absolute path and
// asserts it stays inside mediaDir before touching the filesystem — never
// interpolate a client-supplied string into a path without that check.

import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  // crypto.subtle.digest types its input as requiring an ArrayBuffer-backed
  // BufferSource; Uint8Array's generic buffer type is wider (ArrayBufferLike),
  // so an explicit cast is needed even though the runtime accepts any typed array.
  const digest = await crypto.subtle.digest('SHA-256', bytes as unknown as BufferSource);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

/** Resolves `relPath` against `mediaDir` and asserts the result stays inside
 * it. Rejects `..` traversal and absolute paths (path.resolve treats an
 * absolute `relPath` as replacing the base entirely, which this check catches
 * too since the result then falls outside mediaDir). */
function resolveSafePath(mediaDir: string, relPath: string): string {
  const root = path.resolve(mediaDir);
  const resolved = path.resolve(root, relPath);
  if (resolved !== root && !resolved.startsWith(root + path.sep)) {
    throw new Error(`storage: path escapes media root: ${relPath}`);
  }
  return resolved;
}

/** Writes a validated WebP buffer to disk under mediaDir, creating any
 * missing parent directories. Throws (never silently drops the write) when
 * relPath would escape mediaDir. */
export async function writeWebp(mediaDir: string, relPath: string, bytes: Uint8Array): Promise<void> {
  const absolutePath = resolveSafePath(mediaDir, relPath);
  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, bytes);
}

/** Deletes each path under mediaDir, best-effort: a missing file is not an
 * error, and a path that fails to resolve safely (or fails to delete) is
 * logged and skipped rather than aborting the rest of the batch. */
export async function deleteFiles(mediaDir: string, relPaths: readonly string[]): Promise<void> {
  for (const relPath of relPaths) {
    if (relPath.length === 0) {
      continue;
    }
    try {
      const absolutePath = resolveSafePath(mediaDir, relPath);
      await rm(absolutePath, { force: true });
    } catch (error) {
      console.error(`storage: failed to delete ${relPath}`, error);
    }
  }
}

/** Path scheme for a variant's two image sizes: variants/<id>/<hash>-thumb.webp
 * and variants/<id>/<hash>-main.webp. Banners/categories/brands follow the
 * same "<kind>/<id>/<hash>.webp" shape, built inline at the call site. */
export function buildVariantImagePaths(variantId: number, hash: string): { thumb: string; main: string } {
  return {
    thumb: `variants/${variantId}/${hash}-thumb.webp`,
    main: `variants/${variantId}/${hash}-main.webp`,
  };
}
