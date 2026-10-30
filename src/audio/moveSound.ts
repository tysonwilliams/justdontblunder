export type MoveSound = 'move' | 'capture' | 'fail';

/** Capture covers checks and mates too — one clip for any decisive contact. */
export function soundForSan(san: string): MoveSound {
  if (san.includes('x') || san.includes('+') || san.includes('#')) return 'capture';
  return 'move';
}
