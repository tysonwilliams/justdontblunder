/**
 * Fill each drill's `acceptable` list from Stockfish.
 * A move is kept when it does not drop material and does not allow mate in 1,
 * and its eval is within 150cp of the best — except a longer forced mate
 * (mate in 2+) is not, by itself, a reason to reject.
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';

import { Chess, type Square } from 'chess.js';

import { moveOutcome } from '../src/logic/safety.ts';

type Drill = {
  id: string;
  fen: string;
  sideToMove: 'w' | 'b';
  theme: string;
  solution: string[];
  acceptable?: string[];
};

type Scored = {
  uci: string;
  cp: number | null;
  mate: number | null;
  outcome: number | null;
};

const DEPTH = 12;
const WINDOW = 150;
const path = new URL('../src/data/beginner-blunders.json', import.meta.url);

function analyze(engine: { stdin: NodeJS.WritableStream; stdout: NodeJS.ReadableStream }, fen: string) {
  return new Promise<Map<string, { cp: number | null; mate: number | null }>>((resolve) => {
    const scores = new Map<string, { cp: number | null; mate: number | null }>();
    let buf = '';
    const onData = (chunk: Buffer) => {
      buf += chunk.toString();
      const lines = buf.split('\n');
      buf = lines.pop() ?? '';
      for (const line of lines) {
        if (line.startsWith('bestmove')) {
          engine.stdout.off('data', onData);
          resolve(scores);
          return;
        }
        if (!line.startsWith('info ') || line.includes('lowerbound') || line.includes('upperbound')) continue;
        const depth = Number(line.match(/\bdepth (\d+)/)?.[1] ?? 0);
        if (depth < DEPTH) continue;
        const pv = line.match(/\bpv (\S+)/)?.[1];
        if (!pv) continue;
        const mate = line.match(/\bscore mate (-?\d+)/);
        const cp = line.match(/\bscore cp (-?\d+)/);
        scores.set(pv, {
          cp: cp ? Number(cp[1]) : null,
          mate: mate ? Number(mate[1]) : null,
        });
      }
    };
    engine.stdout.on('data', onData);
    engine.stdin.write(`position fen ${fen}\n`);
    engine.stdin.write(`go depth ${DEPTH}\n`);
  });
}

const drills = JSON.parse(fs.readFileSync(path, 'utf8')) as Drill[];
const engine = spawn('node', ['node_modules/stockfish/scripts/cli.js']);
await new Promise((resolve) => {
  const wait = (chunk: Buffer) => {
    if (chunk.toString().includes('uciok')) {
      engine.stdout.off('data', wait);
      resolve(null);
    }
  };
  engine.stdout.on('data', wait);
  engine.stdin.write('uci\n');
});
engine.stdin.write('setoption name Threads value 2\n');
engine.stdin.write('setoption name MultiPV value 80\n');
engine.stdin.write('ucinewgame\n');

for (const drill of drills) {
  const started = Date.now();
  const scores = await analyze(engine, drill.fen);
  const game = new Chess(drill.fen);
  const scored: Scored[] = [];
  for (const move of game.moves({ verbose: true })) {
    const uci = `${move.from}${move.to}${move.promotion ?? ''}`;
    const found = scores.get(uci) ?? scores.get(uci.slice(0, 4));
    const outcome = moveOutcome(drill.fen, move.from, move.to as Square, drill.sideToMove);
    scored.push({
      uci,
      cp: found?.cp ?? null,
      mate: found?.mate ?? null,
      outcome,
    });
  }
  const numeric = scored.filter((move) => move.cp !== null && (move.outcome ?? -1) >= 0);
  const bestCp = numeric.reduce((best, move) => Math.max(best, move.cp ?? best), -100000);
  const kept = scored.filter((move) => {
    if (move.outcome === null || move.outcome < 0) return false;
    if (move.mate !== null && move.mate < 0) return true;
    if (move.mate !== null && move.mate > 0) return true;
    if (move.cp === null) return false;
    return move.cp >= bestCp - WINDOW;
  });
  const fallback = kept.length ? kept : scored.filter((move) => (move.outcome ?? -1) >= 0);
  fallback.sort((a, b) => (b.cp ?? -100000) - (a.cp ?? -100000));
  drill.acceptable = fallback.map((move) => move.uci);
  drill.solution = [...drill.acceptable];
  console.log(
    `${drill.id} kept ${drill.acceptable.length}/${scored.length} best ${bestCp} ${Date.now() - started}ms`,
  );
}

engine.stdin.write('quit\n');
engine.kill();
fs.writeFileSync(path, `${JSON.stringify(drills, null, 2)}\n`);
console.log('wrote', drills.length);
