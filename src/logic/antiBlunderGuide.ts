import type { LessonId } from '@/src/logic/lessons';

export type ChecklistStep = {
  number: string;
  title: string;
  detail: string;
};

export type BlunderTrigger = {
  label: string;
  tip: string;
};

export type TrainingWeek = {
  week: number;
  title: string;
  focus: string;
  dailyHabit: string;
  lessonId: LessonId;
  lessonLabel: string;
  actionHref: string;
  actionLabel: string;
};

/**
 * Repeatable pre-move thinking habit synthesized for beginner-to-intermediate players.
 * Short enough to run before every move in rapid and classical games.
 */
export const PRE_MOVE_STEPS: readonly ChecklistStep[] = [
  {
    number: '1',
    title: "Opponent's last move",
    detail: 'What changed? Check what it attacks, uncovers, or stops defending.',
  },
  {
    number: '2',
    title: 'Loose pieces',
    detail: 'Scan your pieces and pawns. Undefended pieces drop off the board.',
  },
  {
    number: '3',
    title: 'Checks, captures, threats',
    detail: 'Look at their forcing replies first: checks, forks, pins, and captures.',
  },
  {
    number: '4',
    title: 'Before you let go',
    detail: 'Picture your move on the board and check their sharpest reply.',
  },
];

export const TIME_TROUBLE_CHECK = {
  title: 'Under 1 minute',
  summary: 'Threat → Safe move → Check. Spot their threat, pick a solid square, verify it is guarded.',
} as const;

export const BLUNDER_TRIGGERS: readonly BlunderTrigger[] = [
  {
    label: 'Automatic recaptures',
    tip: 'Pause before taking back — check for an in-between check or loose piece.',
  },
  {
    label: 'Tunnel vision',
    tip: 'When you love your attack, stop and ask what they threaten on the other side.',
  },
  {
    label: 'Winning positions',
    tip: 'Relaxing when ahead gives away more games than tough defense does.',
  },
  {
    label: 'Simple endgames',
    tip: 'Fewer pieces raise the stakes — watch hanging pawns, rook checks, and back rank.',
  },
];

export const TRAINING_WEEKS: readonly TrainingWeek[] = [
  {
    week: 1,
    title: 'Build the check',
    focus: 'Slow down before moving. Ask what their last move did and whether anything is loose.',
    dailyHabit: '1 Foundations or Habit lesson + 7 slow daily drills.',
    lessonId: 'routine',
    lessonLabel: 'The 4-step blunder check',
    actionHref: '/drills',
    actionLabel: 'Practice Play',
  },
  {
    week: 2,
    title: 'Forcing moves & traps',
    focus: 'Count attackers vs. defenders and catch forks, pins, and discovered attacks before they land.',
    dailyHabit: '1 Club tactic lesson + 10 rounds of Pick mode.',
    lessonId: 'counting',
    lessonLabel: 'Counting defenders',
    actionHref: '/drills?mode=pick',
    actionLabel: 'Open Pick',
  },
  {
    week: 3,
    title: 'Stay sharp under pressure',
    focus: 'Break tunnel vision, dodge opening greed, and run the short check with a clock running.',
    dailyHabit: 'Clear Review due items + try Unprompted or 15s Blitz.',
    lessonId: 'counterplay',
    lessonLabel: 'Tunnel vision & counterplay',
    actionHref: '/drills?mode=review',
    actionLabel: 'Open Review',
  },
  {
    week: 4,
    title: 'Fix your own games',
    focus: 'Drill the exact mistakes from your recent Chess.com or Lichess games and stay alert in endgames.',
    dailyHabit: 'Import your recent games + review every missed drill.',
    lessonId: 'endgame_safety',
    lessonLabel: 'Endgame traps & loose pawns',
    actionHref: '/progress',
    actionLabel: 'Import games',
  },
];
