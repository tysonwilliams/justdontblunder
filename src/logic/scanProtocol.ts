import type { DrillPosition } from '@/src/logic/drills';

export type ScanSide = 'w' | 'b';

export type ScanWorkerRequest = {
  id: number;
  pgn: string;
  userColor: ScanSide;
  /** Read a pasted game and say whether the PGN parsed. */
  paste?: boolean;
};

export type ScanWorkerResponse = {
  id: number;
  drills: DrillPosition[];
  readable?: boolean;
  error?: string;
};
