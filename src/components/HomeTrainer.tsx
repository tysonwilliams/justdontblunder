import { useRouter, type Href } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import type { Square } from 'chess.js';

import { BlunderOverlay } from '@/src/components/Board/BlunderOverlay';
import { ChessBoard, type BoardArrow, type BoardMoveEvent } from '@/src/components/Board/ChessBoard';
import { highlightsForRound } from '@/src/components/Board/highlight';
import { StreakBadge } from '@/src/components/StreakBadge';
import { BoardLead } from '@/src/components/ui/BoardLead';
import { BoardStage, boardStageIsWide } from '@/src/components/ui/BoardStage';
import { ColorLegend } from '@/src/components/ui/ColorLegend';
import { Screen } from '@/src/components/ui/Screen';
import {
  createHomeSession,
  homePlayPrompt,
  isCorrectDrillMove,
  themeInstruction,
  type DrillPosition,
} from '@/src/logic/drills';
import { createGame } from '@/src/logic/game';
import { feedbackForRound } from '@/src/logic/saveFeedback';
import { bestPunishment } from '@/src/logic/safety';
import { claimDrillResult } from '@/src/store/drillStats';
import { useProgressStore } from '@/src/store/progress';
import { colors, fonts, radii, spacing } from '@/src/theme';

type RoundState = 'playing' | 'correct' | 'retry';
type Dest = '/learn' | '/drills' | '/practice';

const RESULT_LINKS: { href: Dest; label: string }[] = [
  { href: '/drills', label: 'Drills' },
  { href: '/learn', label: 'Learn' },
  { href: '/practice', label: 'Practice' },
];

const ENTRY_CARDS: { href: Dest; title: string; body: string }[] = [
  { href: '/learn', title: 'Learn', body: 'Save the piece. The idea is there if you want it.' },
  { href: '/drills', title: 'Drills', body: 'One miss ends the run.' },
  { href: '/practice', title: 'Practice', body: 'Play White. Black takes what you hang.' },
];

function resultCard(round: RoundState): { title: string; tone: 'success' | 'danger' } | null {
  switch (round) {
    case 'playing':
      return null;
    case 'correct':
      return { title: 'Nice save', tone: 'success' };
    case 'retry':
      return { title: 'Blunder', tone: 'danger' };
    default: {
      const _exhaustive: never = round;
      return _exhaustive;
    }
  }
}

export function HomeTrainer() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const wide = boardStageIsWide(width);
  const [session] = useState(() => createHomeSession());
  const [index, setIndex] = useState(0);
  const [round, setRound] = useState<RoundState>('playing');
  const [lastMove, setLastMove] = useState<{ from: Square; to: Square } | null>(null);
  const [displayFen, setDisplayFen] = useState<string | null>(null);
  const [boardKey, setBoardKey] = useState(0);
  const [hydrated, setHydrated] = useState(() => useProgressStore.persist.hasHydrated());
  const resultCounted = useRef(false);

  const markDrillResult = useProgressStore((s) => s.markDrillResult);
  const recordMiss = useProgressStore((s) => s.recordMiss);
  const streak = useProgressStore((s) => s.dailyStreak);

  const drill: DrillPosition | undefined = session.positions[index];
  const total = session.positions.length;

  const orientation = useMemo(
    () => (drill?.sideToMove === 'b' ? 'black' : 'white') as 'white' | 'black',
    [drill?.sideToMove],
  );

  useEffect(() => {
    const unsub = useProgressStore.persist.onFinishHydration(() => setHydrated(true));
    if (useProgressStore.persist.hasHydrated()) setHydrated(true);
    return () => {
      unsub();
    };
  }, []);

  const open = (href: Dest) => {
    router.push(href as Href);
  };

  const next = () => {
    if (total === 0) return;
    resultCounted.current = false;
    setRound('playing');
    setLastMove(null);
    setDisplayFen(null);
    setIndex((i) => (i + 1) % total);
    setBoardKey((k) => k + 1);
  };

  const recordFirstResult = (correct: boolean) => {
    if (!drill) return;
    const claim = claimDrillResult(resultCounted.current);
    resultCounted.current = claim.claimed;
    if (!claim.recorded) return;
    markDrillResult(correct, drill.theme);
    if (!correct) recordMiss(drill.id);
  };

  const onMove = (event: BoardMoveEvent) => {
    if (!drill || round !== 'playing') return false;
    setDisplayFen(event.afterFen);
    setLastMove({ from: event.from, to: event.to });
    const ok = isCorrectDrillMove(drill, event.from, event.to);
    recordFirstResult(ok);
    setRound(ok ? 'correct' : 'retry');
    return ok;
  };

  if (!drill) return null;

  const boardFen = displayFen ?? drill.fen;
  const progress = (index + (round === 'playing' ? 0 : 1)) / total;
  const marks = highlightsForRound(round, lastMove, drill.atRiskSquare);
  const card = resultCard(round);
  const roundCopy = feedbackForRound(round, drill, lastMove) ?? '';
  const threatArrow: BoardArrow[] = [];
  if (lastMove && round === 'retry') {
    const hit = bestPunishment(createGame(boardFen).fen());
    if (hit) threatArrow.push({ from: hit.from, to: hit.to, color: colors.danger });
  }

  return (
    <Screen maxWidth={wide ? 1120 : 560}>
      <BoardLead>
        <View style={styles.metaRow}>
          <Text style={styles.chip}>Daily trainer</Text>
          <View style={styles.metaRight}>
            <Text style={styles.count}>
              {index + 1} / {total}
            </Text>
            {hydrated && streak > 0 ? (
              <StreakBadge streak={streak} celebrate />
            ) : hydrated ? (
              <Text style={styles.zero}>No streak yet</Text>
            ) : null}
          </View>
        </View>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${Math.round(progress * 100)}%` }]} />
        </View>
        <Text style={styles.heading}>Stop hanging pieces.</Text>
        <Text style={styles.prompt}>{homePlayPrompt(drill)}</Text>
        <ColorLegend />
      </BoardLead>

      <BoardStage
        asideFirst={!wide && round !== 'playing'}
        board={
          <ChessBoard
            key={`${drill.id}-${boardKey}`}
            fen={boardFen}
            orientation={orientation}
            flipCue={orientation === 'black'}
            interactive={round === 'playing'}
            lastMove={lastMove}
            arrows={threatArrow}
            attentionSquares={round === 'playing' ? [drill.atRiskSquare] : []}
            highlightSquares={marks.squares}
            highlightTone={marks.tone}
            onMove={onMove}
          />
        }
        aside={
          card ? (
            <View style={styles.result}>
              <BlunderOverlay
                visible
                tone={card.tone}
                title={card.title}
                message={roundCopy}
                actionLabel="Next puzzle"
                onDismiss={next}
              />
              <View style={styles.linkRow}>
                {RESULT_LINKS.map((item) => (
                  <Pressable
                    key={item.href}
                    accessibilityRole="button"
                    onPress={() => open(item.href)}
                    style={styles.link}>
                    <Text style={styles.linkText}>{item.label}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : (
            <View style={styles.guide}>
              {drill.theme === 'hanging' ? <Text style={styles.hint}>{drill.prompt}</Text> : null}
              <Text style={drill.theme === 'hanging' ? styles.hintMuted : styles.hint}>
                {themeInstruction(drill.theme)}
              </Text>
            </View>
          )
        }
      />

      <View style={[styles.cards, !wide && styles.cardsStacked]}>
        {ENTRY_CARDS.map((item) => (
          <Pressable
            key={item.href}
            accessibilityRole="button"
            onPress={() => open(item.href)}
            style={({ pressed }) => [styles.card, pressed && styles.cardOn]}>
            <Text style={styles.cardTitle}>{item.title}</Text>
            <Text style={styles.cardBody}>{item.body}</Text>
          </Pressable>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  metaRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  chip: {
    fontFamily: fonts.bodyBold,
    color: colors.accent,
    fontSize: 14,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    backgroundColor: colors.accentSoft,
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.pill,
  },
  count: {
    fontFamily: fonts.bodyBold,
    color: colors.text,
    fontSize: 15,
  },
  zero: {
    fontFamily: fonts.bodyBold,
    color: colors.text,
    fontSize: 15,
    lineHeight: 22,
  },
  track: {
    height: 4,
    borderRadius: 99,
    backgroundColor: colors.bgSoft,
    overflow: 'hidden',
  },
  fill: {
    height: 4,
    backgroundColor: colors.accent,
  },
  heading: {
    fontFamily: fonts.display,
    color: colors.text,
    fontSize: 26,
    lineHeight: 32,
    letterSpacing: -0.4,
  },
  prompt: {
    fontFamily: fonts.bodyBold,
    color: colors.warn,
    fontSize: 18,
    lineHeight: 26,
  },
  guide: {
    gap: spacing.sm,
  },
  hint: {
    fontFamily: fonts.body,
    color: colors.text,
    fontSize: 16,
    lineHeight: 24,
  },
  hintMuted: {
    fontFamily: fonts.body,
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 22,
  },
  result: {
    gap: spacing.sm,
  },
  linkRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  link: {
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.bgElevated,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
  linkText: {
    fontFamily: fonts.bodyBold,
    color: colors.text,
    fontSize: 16,
  },
  cards: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  cardsStacked: {
    flexDirection: 'column',
  },
  card: {
    flex: 1,
    backgroundColor: colors.bgElevated,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    padding: spacing.md,
    minHeight: 88,
    justifyContent: 'center',
    cursor: 'pointer',
  },
  cardOn: {
    backgroundColor: colors.bgSoft,
  },
  cardTitle: {
    fontFamily: fonts.bodyBold,
    color: colors.text,
    fontSize: 18,
  },
  cardBody: {
    marginTop: 6,
    fontFamily: fonts.body,
    color: colors.text,
    fontSize: 15,
    lineHeight: 22,
  },
});
