// Guard against a regression that only shows up in production.
//
// api/tsconfig.json uses `moduleResolution: "Bundler"`, which happily accepts
// extensionless relative imports (`from './lib/env'`). Vitest and tsx resolve
// those too, so dev and the test suite stay green -- but `tsc -b` emits them
// verbatim and plain Node ESM refuses to resolve them, so the compiled
// container crash-loops on ERR_MODULE_NOT_FOUND at the very first import.
//
// Every relative import in api/src must therefore carry an explicit extension.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const SRC_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src');

/** Matches `from './x'`, `from "../y"` and dynamic `import('./z')`. */
const RELATIVE_SPECIFIER = /(?:from\s*|import\s*\(\s*)(['"])(\.\.?\/[^'"]+)\1/g;

function collectTsFiles(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      found.push(...collectTsFiles(full));
    } else if (entry.endsWith('.ts')) {
      found.push(full);
    }
  }
  return found;
}

describe('api/src ESM specifiers', () => {
  const files = collectTsFiles(SRC_DIR);

  it('finds source files to check', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it('gives every relative import an explicit extension', () => {
    const offenders: string[] = [];

    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      for (const match of source.matchAll(RELATIVE_SPECIFIER)) {
        const specifier = match[2];
        if (specifier === undefined) {
          continue;
        }
        if (!/\.(js|json)$/.test(specifier)) {
          offenders.push(`${path.relative(SRC_DIR, file)} -> ${specifier}`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });
});
