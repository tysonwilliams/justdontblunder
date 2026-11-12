import type { DrillPosition } from '@/src/logic/drills';

export type ScanSide = 'w' | 'b';

export type ScanWorkerRequest = {
  id: number;
  pgn: string;
  userColor: ScanSide;
};

export type ScanWorkerResponse = {
  id: number;
  drills: DrillPosition[];
  error?: string;
};
