/**
 * Ids safe to store in scanned_games and source_game_id.
 * The same rejects live in private.is_public_game_id.
 * A fallback id that embeds PGN text must never be uploaded.
 */
const PGN_TAG = /\[[A-Za-z]/;
const MOVE_TEXT = /[0-9]+\./;
const CHESSCOM_FALLBACK = /^c:[0-9]+:/;
const LICHESS_FALLBACK = /^l:[0-9]+:/;
const PASTE_FALLBACK = /^p:/;

export function isPublicGameId(id: string): boolean {
  if (id.length < 1 || id.length > 180) return false;
  if (id.includes('\n') || id.includes('\r')) return false;
  if (PGN_TAG.test(id) || MOVE_TEXT.test(id)) return false;
  if (CHESSCOM_FALLBACK.test(id) || LICHESS_FALLBACK.test(id) || PASTE_FALLBACK.test(id)) return false;
  return true;
}
