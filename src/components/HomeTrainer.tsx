import { useRouter, type Href } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { Square } from 'chess.js';

import { BlunderOverlay } from '@/src/components/Board/BlunderOverlay';
import { ChessBoard, type BoardArrow, type BoardMoveEvent } from '@/src/components/Board/ChessBoard';
import { highlightsForRound } from '@/src/components/Board/highlight';
import { usePunishmentPlayback } from '@/src/components/usePunishmentPlayback';
import { StreakBadge } from '@/src/components/StreakBadge';
import { BoardLead } from '@/src/components/ui/BoardLead';
import { StatusPill } from '@/src/components/ui/Chip';
import { ColorLegend } from '@/src/components/ui/ColorLegend';
import { PlayFrame } from '@/src/components/ui/PlayFrame';
import { play } from '@/src/components/ui/playStyles';
import { ProgressTrack } from '@/src/components/ui/ProgressTrack';
import { text } from '@/src/components/ui/text';
import { useLayout } from '@/src/components/ui/useLayout';
import {
  createHomeSession,
  homePlayPrompt,
  isCorrectDrillMove,
  themeInstruction,
  type DrillPosition,
} from '@/src/logic/drills';
import { punishmentLine, type PunishmentStep } from '@/src/logic/punishment';
import { feedbackForRound } from '@/src/logic/saveFeedback';
import { claimDrillResult } from '@/src/store/drillStats';
import { useProgressStore } from '@/src/store/progress';
import { colors } from '@/src/theme';

type RoundState = 'playing' | 'correct' | 'retry';
type Dest = '/learn' | '/drills' | '/practice';

const RESULT_LINKS: { href: Dest; label: string }[] = [
  { href: '/drills', label: 'Drills' },
  { href: '/learn', label: 'Learn' },
  { href: '/practice', label: 'Practice' },
];

const ENTRY_CARDS: { href: string; title: string; body: string }[] = [
  {
    href: '/drills?pick=1',
    title: 'Pick the safe move',
    body: 'Two moves. One blunders. Tap the safe one.',
  },
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
  const { split, contentW } = useLayout();
  const [session] = useState(() => createHomeSession());
  const [index, setIndex] = useState(0);
  const [round, setRound] = useState<RoundState>('playing');
  const [lastMove, setLastMove] = useState<{ from: Square; to: Square } | null>(null);
  const [displayFen, setDisplayFen] = useState<string | null>(null);
  const [boardKey, setBoardKey] = useState(0);
  const [replayLine, setReplayLine] = useState<PunishmentStep[]>([]);
  const [hydrated, setHydrated] = useState(() => useProgressStore.persist.hasHydrated());
  const resultCounted = useRef(false);
  const replayActive = round === 'retry';
  const playback = usePunishmentPlayback(replayActive, replayLine);
  const replyReady = !replayActive || playback.done;

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

  const open = (href: string) => {
    router.push(href as Href);
  };

  const next = () => {
    if (total === 0) return;
    resultCounted.current = false;
    setRound('playing');
    setLastMove(null);
    setDisplayFen(null);
    setReplayLine([]);
    setIndex((i) => (i + 1) % total);
    setBoardKey((k) => k + 1);
  };

  const tryAgain = () => {
    setReplayLine([]);
    setRound('playing');
    setLastMove(null);
    setDisplayFen(null);
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
    if (ok) setReplayLine([]);
    else setReplayLine(punishmentLine(drill, event.from, event.to));
    setRound(ok ? 'correct' : 'retry');
    return ok;
  };

  if (!drill) return null;

  const boardFen = playback.fen ?? displayFen ?? drill.fen;
  const boardLastMove = playback.move ?? lastMove;
  const progress = (index + (round === 'playing' ? 0 : 1)) / total;
  const marks = highlightsForRound(round, lastMove, drill.atRiskSquare);
  const card = resultCard(round);
  const roundCopy = feedbackForRound(round, drill, lastMove) ?? '';
  const threatArrow: BoardArrow[] = playback.arrow
    ? [{ from: playback.arrow.from, to: playback.arrow.to, color: colors.danger }]
    : [];
  const watchingReply = replayActive && !playback.done;

  return (
    <PlayFrame
      asideFirst={!split && round !== 'playing' && !watchingReply}
      intro={
        <BoardLead>
          <View style={play.metaRow}>
            <StatusPill>Daily trainer</StatusPill>
            <View style={play.metaRight}>
              <Text style={text.meta}>
                {index + 1} / {total}
              </Text>
              {hydrated && streak > 0 ? (
                <StreakBadge streak={streak} celebrate />
              ) : hydrated ? (
                <Text style={text.muted}>No streak yet</Text>
              ) : (
                <View style={styles.streakSlot} />
              )}
            </View>
          </View>
          <ProgressTrack progress={progress} />
          <Text style={text.title}>Stop hanging pieces.</Text>
          <Text style={text.habit}>{homePlayPrompt(drill)}</Text>
          <ColorLegend />
        </BoardLead>
      }
      board={
          <ChessBoard
            key={`${drill.id}-${boardKey}`}
            fen={boardFen}
            orientation={orientation}
            flipCue={orientation === 'black'}
            interactive={round === 'playing'}
            lastMove={boardLastMove}
            arrows={threatArrow}
            attentionSquares={round === 'playing' ? [drill.atRiskSquare] : []}
            highlightSquares={marks.squares}
            highlightTone={marks.tone}
            onMove={onMove}
          />
        }
      aside={
          card ? (
            <View style={play.stack}>
              <BlunderOverlay
                visible
                tone={card.tone}
                title={card.title}
                message={roundCopy}
                waiting={card.tone === 'danger' && !replyReady ? 'Watch the reply.' : undefined}
                actionLabel={
                  card.tone === 'danger' ? (replyReady ? 'Try again' : undefined) : 'Next puzzle'
                }
                onDismiss={card.tone === 'danger' ? (replyReady ? tryAgain : undefined) : next}
                actionTestID={card.tone === 'danger' ? 'try-again' : undefined}
                secondaryLabel={card.tone === 'danger' && replyReady ? 'Next puzzle' : undefined}
                onSecondary={card.tone === 'danger' && replyReady ? next : undefined}
              />
              <View style={play.linkRow}>
                {RESULT_LINKS.map((item) => (
                  <Pressable
                    key={item.href}
                    accessibilityRole="button"
                    onPress={() => open(item.href)}
                    style={play.link}>
                    <Text style={play.linkText}>{item.label}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : (
            <View style={play.guide}>
              {drill.theme === 'hanging' ? <Text style={text.body}>{drill.prompt}</Text> : null}
              <Text style={drill.theme === 'hanging' ? text.muted : text.body}>
                {themeInstruction(drill.theme)}
              </Text>
            </View>
          )
        }
      footer={<EntryCards split={split} contentW={contentW} onOpen={open} />}
    />
  );
}

const CARD_PEEK = 28;

function EntryCards({
  split,
  contentW,
  onOpen,
}: {
  split: boolean;
  contentW: number;
  onOpen: (href: string) => void;
}) {
  const mode = split ? 'stack' : contentW >= 640 ? 'row' : 'slide';
  const slideW = Math.max(220, contentW - CARD_PEEK);
  const cards = ENTRY_CARDS.map((item) => (
    <EntryCard key={item.href} item={item} mode={mode} slideW={slideW} onPress={() => onOpen(item.href)} />
  ));

  if (mode === 'slide') {
    return (
      <ScrollView
        horizontal
        nestedScrollEnabled
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        style={{ width: contentW }}
        contentContainerStyle={[styles.entryRow, { paddingRight: CARD_PEEK }]}>
        {cards}
      </ScrollView>
    );
  }

  return <View style={mode === 'stack' ? styles.entryStack : styles.entryGrid}>{cards}</View>;
}

function EntryCard({
  item,
  onPress,
  mode,
  slideW,
}: {
  item: (typeof ENTRY_CARDS)[number];
  onPress: () => void;
  mode: 'stack' | 'row' | 'slide';
  slideW: number;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        play.card,
        mode === 'stack' && styles.entryFull,
        mode === 'row' && styles.entryCell,
        mode === 'slide' && { width: slideW, flexBasis: slideW, flexGrow: 0, flexShrink: 0 },
        pressed && play.cardOn,
      ]}>
      <Text style={play.cardTitle}>{item.title}</Text>
      <Text style={play.cardBody} numberOfLines={3}>
        {item.body}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  streakSlot: {
    minWidth: 108,
    minHeight: 36,
  },
  entryStack: {
    width: '100%',
    gap: 8,
  },
  entryRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 8,
  },
  entryGrid: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 8,
  },
  entryFull: {
    width: '100%',
    flexGrow: 0,
  },
  entryCell: {
    flex: 1,
    minWidth: 0,
  },
});
