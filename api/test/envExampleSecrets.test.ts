// Guard against a real bot token landing in a committed .env.example.
//
// The example files are tracked and copied around as documentation, so a
// pasted production token there is a leak. The placeholder used in the docs
// (id 123456789) is token-shaped on purpose and is the only allowed match.
// The pre-commit hook (.githooks/pre-commit) enforces the same rule locally.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const BOT_TOKEN_SHAPE = /\b(\d{8,10}):[A-Za-z0-9_-]{35}\b/g;
const DOCS_EXAMPLE_BOT_ID = '123456789';
const EXAMPLE_FILE_NAME = '.env.example';
const SKIPPED_DIRS = new Set(['node_modules', '.git', 'dist']);

function collectExampleFiles(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (!SKIPPED_DIRS.has(entry)) {
        found.push(...collectExampleFiles(full));
      }
    } else if (entry === EXAMPLE_FILE_NAME) {
      found.push(full);
    }
  }
  return found;
}

describe('.env.example files', () => {
  const files = collectExampleFiles(REPO_ROOT);

  it('finds the example files to check', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it('contain no real-looking Telegram bot token', () => {
    const offenders: string[] = [];

    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      for (const match of source.matchAll(BOT_TOKEN_SHAPE)) {
        if (match[1] !== DOCS_EXAMPLE_BOT_ID) {
          offenders.push(path.relative(REPO_ROOT, file));
        }
      }
    }

    expect(offenders).toEqual([]);
  });
});
