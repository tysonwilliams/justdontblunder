export type MoveSound = 'move' | 'capture' | 'check' | 'fail';

/** Check wins over capture, matching the usual chess-site priority. */
export function soundForSan(san: string): MoveSound {
  if (san.includes('+') || san.includes('#')) return 'check';
  if (san.includes('x')) return 'capture';
  return 'move';
}
