import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { buildVariantImagePaths, deleteFiles, sha256Hex, writeWebp } from '../src/lib/storage';

let mediaDir: string;

beforeEach(async () => {
  mediaDir = await mkdtemp(path.join(tmpdir(), 'dunyo-storage-test-'));
});

afterEach(async () => {
  await rm(mediaDir, { recursive: true, force: true });
});

describe('sha256Hex', () => {
  it('hashes bytes to a lowercase hex digest', async () => {
    const hash = await sha256Hex(new TextEncoder().encode('hello'));
    expect(hash).toBe('2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824');
  });
});

describe('buildVariantImagePaths', () => {
  it('follows the variants/<id>/<hash>-{thumb,main}.webp scheme', () => {
    const paths = buildVariantImagePaths(42, 'abc123');
    expect(paths.thumb).toBe('variants/42/abc123-thumb.webp');
    expect(paths.main).toBe('variants/42/abc123-main.webp');
  });
});

describe('writeWebp', () => {
  it('writes bytes to the resolved path under mediaDir', async () => {
    const bytes = new Uint8Array([1, 2, 3, 4]);
    await writeWebp(mediaDir, 'variants/1/hash-main.webp', bytes);
    const written = await readFile(path.join(mediaDir, 'variants', '1', 'hash-main.webp'));
    expect(Buffer.compare(written, Buffer.from(bytes))).toBe(0);
  });

  it('rejects a relative path traversal payload', async () => {
    const bytes = new Uint8Array([1]);
    await expect(writeWebp(mediaDir, '../../etc/passwd', bytes)).rejects.toThrow();
  });

  it('rejects an absolute path payload', async () => {
    const bytes = new Uint8Array([1]);
    const absolute = process.platform === 'win32' ? 'C:\\Windows\\System32\\evil.webp' : '/etc/passwd';
    await expect(writeWebp(mediaDir, absolute, bytes)).rejects.toThrow();
  });
});

describe('deleteFiles', () => {
  it('deletes a file that resolves inside mediaDir', async () => {
    const filePath = path.join(mediaDir, 'variants', '1', 'hash-main.webp');
    await writeWebp(mediaDir, 'variants/1/hash-main.webp', new Uint8Array([1]));
    await deleteFiles(mediaDir, ['variants/1/hash-main.webp']);
    await expect(readFile(filePath)).rejects.toThrow();
  });

  it('never deletes a file outside mediaDir via a traversal payload', async () => {
    // A sentinel file just outside mediaDir; deleteFiles must never touch it.
    const outsideDir = await mkdtemp(path.join(tmpdir(), 'dunyo-storage-outside-'));
    const sentinelPath = path.join(outsideDir, 'sentinel.txt');
    await writeFile(sentinelPath, 'do-not-delete');

    const relTraversal = path.relative(mediaDir, sentinelPath).split(path.sep).join('/');
    await deleteFiles(mediaDir, [relTraversal, '/etc/passwd']);

    const stillThere = await readFile(sentinelPath, 'utf8');
    expect(stillThere).toBe('do-not-delete');

    await rm(outsideDir, { recursive: true, force: true });
  });

  it('is a no-op for an empty list', async () => {
    await expect(deleteFiles(mediaDir, [])).resolves.toBeUndefined();
  });
});
