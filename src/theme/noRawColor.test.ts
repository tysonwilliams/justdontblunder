import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  '.expo',
  'dist',
  'web-build',
  'coverage',
  '.cursor',
  'agent-tools',
  '.vercel',
]);

const CODE = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.css']);

/** Piece artwork and the theme module are the only places a color literal may live. */
function allowed(rel: string): boolean {
  const norm = rel.split(path.sep).join('/');
  if (norm === 'src/components/Board/pieceSvgs.ts') return true;
  if (norm === 'src/theme' || norm.startsWith('src/theme/')) return true;
  return false;
}

const COLOR =
  /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})\b|rgba?\(|hsla?\(/g;

function walk(dir: string, out: string[]): void {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const abs = path.join(dir, name);
    const stat = statSync(abs);
    if (stat.isDirectory()) {
      walk(abs, out);
      continue;
    }
    if (!CODE.has(path.extname(name))) continue;
    out.push(abs);
  }
}

describe('raw colors', () => {
  it('fails when a hex or rgb color is introduced outside the theme', () => {
    const files: string[] = [];
    walk(root, files);
    const hits: string[] = [];
    for (const abs of files) {
      const rel = path.relative(root, abs);
      if (allowed(rel)) continue;
      const text = readFileSync(abs, 'utf8');
      const lines = text.split('\n');
      for (let i = 0; i < lines.length; i += 1) {
        COLOR.lastIndex = 0;
        if (COLOR.test(lines[i] ?? '')) hits.push(`${rel}:${i + 1}: ${lines[i]?.trim()}`);
      }
    }
    expect(hits).toEqual([]);
  });
});
