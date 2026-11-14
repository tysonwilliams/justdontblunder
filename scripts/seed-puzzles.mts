import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildPuzzleSeedSql, type SeedPuzzle } from '../src/data/sync/puzzleSeed.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const jsonPath = path.join(root, 'src/data/beginner-blunders.json');
const outPath = path.join(root, 'supabase/seeds/puzzles.sql');
const puzzles = JSON.parse(fs.readFileSync(jsonPath, 'utf8')) as SeedPuzzle[];
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, buildPuzzleSeedSql(puzzles));
console.log(`Wrote ${puzzles.length} puzzles to ${path.relative(root, outPath)}`);
