import { useRouter, type Href } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
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
import { learnCard } from '@/src/logic/lessons';
import { feedbackForRound } from '@/src/logic/saveFeedback';
import { claimDrillResult } from '@/src/store/drillStats';
import { useProgressStore } from '@/src/store/progress';
import { colors } from '@/src/theme';

type RoundState = 'playing' | 'correct' | 'retry';
type EntryId = 'learn' | 'drills' | 'practice';

const RESULT_LINKS: { id: EntryId; label: string }[] = [
  { id: 'drills', label: 'Drills' },
  { id: 'learn', label: 'Learn' },
  { id: 'practice', label: 'Practice' },
];

const ENTRY_CARDS: { id: EntryId; title: string; body: string }[] = [
  { id: 'learn', title: 'Learn', body: 'Save the piece. The idea is there if you want it.' },
  { id: 'drills', title: 'Drills', body: 'One miss ends the run.' },
  { id: 'practice', title: 'Practice', body: 'Play White. Black takes what you hang.' },
];

function entryHref(id: EntryId, learnHref: string): string {
  switch (id) {
    case 'learn':
      return learnHref;
    case 'drills':
      return '/drills';
    case 'practice':
      return '/practice';
    default: {
      const _exhaustive: never = id;
      return _exhaustive;
    }
  }
}

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
  const { split, phone, tight } = useLayout();
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
  const completedLessons = useProgressStore((s) => s.completedLessons);
  const learn = hydrated
    ? learnCard(completedLessons)
    : { href: '/learn', title: 'Learn', body: 'Six short lessons on blunders.' };

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

  const open = (id: EntryId) => {
    router.push(entryHref(id, learn.href) as Href);
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
  const feedback = round !== 'playing';
  const showExtra = !(tight && feedback);
  const showGuide = !tight;

  return (
    <PlayFrame
      asideFirst={!split && feedback && !watchingReply}
      intro={
        <BoardLead>
          <View style={play.metaRow}>
            <StatusPill>Daily trainer</StatusPill>
            <View style={play.metaRight}>
              <Text style={[text.meta, phone && text.metaPhone]}>
                {index + 1} / {total}
              </Text>
              {hydrated && streak > 0 ? (
                <StreakBadge streak={streak} celebrate compact={phone} />
              ) : hydrated ? (
                <Text style={[text.muted, phone && text.mutedPhone]}>No streak yet</Text>
              ) : (
                <View style={styles.streakSlot} />
              )}
            </View>
          </View>
          <ProgressTrack progress={progress} />
          <Text style={[text.title, phone && text.titlePhone]}>Stop hanging pieces.</Text>
          {showExtra ? (
            <Text style={[text.habit, phone && text.habitPhone]}>{homePlayPrompt(drill)}</Text>
          ) : null}
          {showExtra ? <ColorLegend /> : null}
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
              {showExtra ? (
                <View style={play.linkRow}>
                  {RESULT_LINKS.map((item) => (
                    <Pressable
                      key={item.id}
                      accessibilityRole="button"
                      onPress={() => open(item.id)}
                      style={[play.link, phone && styles.linkPhone]}>
                      <Text style={[play.linkText, phone && styles.linkTextPhone]}>{item.label}</Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}
            </View>
          ) : showGuide ? (
            <View style={[play.guide, phone && styles.guidePhone]}>
              {drill.theme === 'hanging' ? (
                <Text style={[text.body, phone && text.bodyPhone]}>{drill.prompt}</Text>
              ) : null}
              <Text style={[drill.theme === 'hanging' ? text.muted : text.body, phone && text.mutedPhone]}>
                {themeInstruction(drill.theme)}
              </Text>
            </View>
          ) : null
        }
      footer={
        <EntryCards learnBody={learn.body} split={split} hidden={tight && feedback} onOpen={open} />
      }
    />
  );
}

function EntryCards({
  learnBody,
  split,
  hidden,
  onOpen,
}: {
  learnBody: string;
  split: boolean;
  hidden: boolean;
  onOpen: (id: EntryId) => void;
}) {
  if (hidden) return null;
  const mode = split ? 'stack' : 'row';
  const cards = ENTRY_CARDS.map((item) => (
    <EntryCard
      key={item.id}
      item={item.id === 'learn' ? { ...item, body: learnBody } : item}
      mode={mode}
      onPress={() => onOpen(item.id)}
    />
  ));

  return <View style={mode === 'stack' ? styles.entryStack : styles.entryGrid}>{cards}</View>;
}

function EntryCard({
  item,
  onPress,
  mode,
}: {
  item: (typeof ENTRY_CARDS)[number];
  onPress: () => void;
  mode: 'stack' | 'row';
}) {
  const { phone } = useLayout();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        play.card,
        phone && styles.cardPhone,
        mode === 'stack' && styles.entryFull,
        mode === 'row' && styles.entryCell,
        pressed && play.cardOn,
      ]}>
      <Text style={[play.cardTitle, phone && styles.cardTitlePhone]} numberOfLines={1}>
        {item.title}
      </Text>
      <Text style={[play.cardBody, phone && styles.cardBodyPhone]} numberOfLines={3}>
        {item.body}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  streakSlot: {
    minWidth: 72,
    minHeight: 22,
  },
  guidePhone: {
    padding: 8,
    gap: 4,
  },
  linkPhone: {
    minHeight: 32,
    paddingHorizontal: 10,
  },
  linkTextPhone: {
    fontSize: 13,
    lineHeight: 16,
  },
  cardPhone: {
    minHeight: 0,
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  cardTitlePhone: {
    fontSize: 13,
    lineHeight: 16,
  },
  cardBodyPhone: {
    marginTop: 2,
    fontSize: 11,
    lineHeight: 14,
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
