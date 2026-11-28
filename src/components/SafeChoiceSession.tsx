import { Linking, Pressable, Text, View } from 'react-native';

import { BlunderOverlay } from '@/src/components/Board/BlunderOverlay';
import { ChessBoard } from '@/src/components/Board/ChessBoard';
import { ChoiceButtons } from '@/src/components/drills/ChoiceButtons';
import { DrillsImportNudge } from '@/src/components/drills/DrillsImportNudge';
import { useSafeChoiceSession } from '@/src/components/drills/useSafeChoiceSession';
import { DrillToolbar } from '@/src/components/DrillToolbar';
import { controlA11y } from '@/src/components/ui/a11y';
import { BoardLead } from '@/src/components/ui/BoardLead';
import { Button } from '@/src/components/ui/Button';
import { LineBox } from '@/src/components/ui/LineBox';
import { PHONE_PROMPT_HEIGHT } from '@/src/components/ui/phoneSlots';
import { PhoneTray } from '@/src/components/ui/PhoneTray';
import { PlayFrame, ScoreFrame } from '@/src/components/ui/PlayFrame';
import { play } from '@/src/components/ui/playStyles';
import { ProgressTrack } from '@/src/components/ui/ProgressTrack';
import { PuzzleCount } from '@/src/components/ui/PuzzleCount';
import { text } from '@/src/components/ui/text';
import { useKeyboardShortcuts } from '@/src/components/ui/useKeyboardShortcuts';
import { useLayout } from '@/src/components/ui/useLayout';
import {
  themeFilterLabel,
  type DrillMode,
  type DrillSourceFilter,
  type ThemeFilter,
} from '@/src/logic/drillLink';
import { HABIT_PROMPT } from '@/src/logic/drills';
import { themedStyleSheet } from '@/src/theme/themed';
import { useTheme } from '@/src/theme/useTheme';
import { fonts, fontSizes, lineHeights, radii, spacing } from '@/src/theme';

type Props = {
  theme: ThemeFilter;
  source?: DrillSourceFilter;
  onMode: (mode: DrillMode) => void;
  onTheme: (theme: ThemeFilter) => void;
  onSource?: (source: DrillSourceFilter) => void;
};

export function SafeChoiceSession({ theme, source = 'all', onMode, onTheme, onSource }: Props) {
  useTheme();
  const { phone } = useLayout();
  const session = useSafeChoiceSession(theme, source);
  const toolbar = (
    <DrillToolbar mode="pick" theme={theme} source={source} onMode={onMode} onTheme={onTheme} onSource={onSource} />
  );

  useKeyboardShortcuts(
    {
      '1': () => {
        if (session.round !== 'playing') return false;
        session.choose('A');
        return true;
      },
      a: () => {
        if (session.round !== 'playing') return false;
        session.choose('A');
        return true;
      },
      '2': () => {
        if (session.round !== 'playing') return false;
        session.choose('B');
        return true;
      },
      b: () => {
        if (session.round !== 'playing') return false;
        session.choose('B');
        return true;
      },
      Enter: () => {
        if (session.round === 'correct') {
          session.next();
          return true;
        }
        if (session.round === 'retry' && session.replyReady) {
          session.tryAgain();
          return true;
        }
        return false;
      },
      ' ': () => {
        if (session.round === 'correct') {
          session.next();
          return true;
        }
        if (session.round === 'retry' && session.replyReady) {
          session.tryAgain();
          return true;
        }
        return false;
      },
      r: () => {
        if (session.round !== 'retry' || !session.replyReady) return false;
        session.tryAgain();
        return true;
      },
      p: () => {
        if (session.round !== 'retry' || !session.replyReady || !session.hasReplay) return false;
        session.replayReply();
        return true;
      },
    },
    !session.done && Boolean(session.drill && session.presented),
  );

  if (session.done) {
    const emptyOwn = source === 'own' && session.session.positions.length === 0;
    const pct = session.score.total ? Math.round((session.score.correct / session.score.total) * 100) : 0;
    return (
      <ScoreFrame toolbar={toolbar}>
        <View style={play.done}>
          <Text style={text.eyebrow}>Drills</Text>
          <Text style={text.title}>{emptyOwn ? 'No personal blunders here' : "That's the set"}</Text>
          {emptyOwn ? (
            <>
              <Text style={text.muted}>
                {theme === 'all'
                  ? 'Import your Chess.com or Lichess games to build your own set.'
                  : `None of your imported blunders are ${themeFilterLabel(theme).toLowerCase()} yet.`}
              </Text>
              <Button label="Show all puzzles" onPress={() => onSource?.('all')} />
            </>
          ) : (
            <>
              <Text style={text.hero}>
                {session.score.correct}/{session.score.total}
              </Text>
              <Text style={text.muted}>{pct}% safe on the first try</Text>
              <Button label="Play again" onPress={() => session.restart()} />
            </>
          )}
          <DrillsImportNudge />
        </View>
      </ScoreFrame>
    );
  }

  const drill = session.drill;
  const presented = session.presented;
  if (!drill || !presented) return null;

  return (
    <PlayFrame
      intro={
        phone ? (
          <BoardLead gap={spacing[6]}>
            {toolbar}
            <LineBox height={PHONE_PROMPT_HEIGHT}>
              <Text style={play.phoneTitle} numberOfLines={2}>
                {drill.prompt}
              </Text>
            </LineBox>
            <View style={styles.progressRow}>
              <View style={play.progressGrow}>
                <ProgressTrack progress={session.progress} />
              </View>
              <PuzzleCount index={session.index} total={session.session.positions.length} spaced={false} phone />
            </View>
          </BoardLead>
        ) : (
          <BoardLead gap={spacing[10]}>
            {toolbar}
            {session.sourceLabel ? (
              session.sourceUrl ? (
                <Pressable
                  {...controlA11y('link', `Open game: ${session.sourceLabel}`)}
                  onPress={() => {
                    if (session.sourceUrl) void Linking.openURL(session.sourceUrl);
                  }}
                  style={(state) => {
                    const hovered = 'hovered' in state && Boolean(state.hovered);
                    return [styles.sourcePill, styles.sourcePillLink, (hovered || state.pressed) && styles.sourcePillHover];
                  }}>
                  <Text style={styles.sourceTextLink} numberOfLines={1}>
                    {session.sourceLabel} ↗
                  </Text>
                </Pressable>
              ) : (
                <View style={styles.sourcePill}>
                  <Text style={styles.sourceText} numberOfLines={1}>
                    {session.sourceLabel}
                  </Text>
                </View>
              )
            ) : null}
            <Text style={text.title} testID="drill-task">
              Which move is safe?
            </Text>
            {session.round === 'playing' ? <Text style={text.habit}>{HABIT_PROMPT}</Text> : null}
            {session.round === 'playing' ? <Text style={text.body}>{drill.prompt}</Text> : null}
            <View style={styles.progressRow}>
              <View style={play.progressGrow}>
                <ProgressTrack progress={session.progress} />
              </View>
              <PuzzleCount index={session.index} total={session.session.positions.length} spaced />
            </View>
          </BoardLead>
        )
      }
      board={
        <ChessBoard
          key={`${drill.id}-${session.index}`}
          fen={session.boardFen}
          orientation={session.orientation}
          flipCue={!phone && session.orientation === 'black'}
          hideTurn={phone}
          interactive={false}
          lastMove={session.boardLastMove}
          arrows={session.arrows}
          attentionSquares={session.attentionSquares}
          highlightSquares={session.marks.squares}
          highlightTone={session.marks.tone}
        />
      }
      aside={
        <PhoneTray
          banner={
            session.card ? (
              <BlunderOverlay
                visible
                tone={session.card.tone}
                title={session.card.title}
                message={session.roundCopy}
                waiting={session.card.tone === 'danger' && !session.replyReady ? 'Showing reply…' : undefined}
                onWaitingPress={session.card.tone === 'danger' && !session.replyReady ? session.skipReply : undefined}
                actionLabel={session.card.tone === 'danger' ? (session.replyReady ? 'Try again' : undefined) : 'Next'}
                onDismiss={
                  session.card.tone === 'danger' ? (session.replyReady ? session.tryAgain : undefined) : session.next
                }
                actionTestID={session.card.tone === 'danger' ? 'try-again' : 'next-puzzle'}
                secondaryLabel={
                  session.card.tone === 'danger' && session.replyReady
                    ? session.hasReplay
                      ? 'Replay'
                      : 'Next'
                    : undefined
                }
                onSecondary={
                  session.card.tone === 'danger' && session.replyReady
                    ? session.hasReplay
                      ? session.replayReply
                      : session.next
                    : undefined
                }
                secondaryTestID={session.card.tone === 'danger' && session.replyReady && session.hasReplay ? 'replay-reply' : undefined}
                extraLabel={
                  !phone && session.card.tone === 'danger' && session.replyReady && session.hasReplay ? 'Next' : undefined
                }
                onExtra={
                  !phone && session.card.tone === 'danger' && session.replyReady && session.hasReplay ? session.next : undefined
                }
              />
            ) : phone ? (
              <View style={play.phoneCard}>
                <ChoiceButtons presented={presented} onChoose={session.choose} compact />
              </View>
            ) : (
              <View style={play.guide}>
                <Text style={text.body}>Blue arrows mark the two moves. One of them blunders.</Text>
                <ChoiceButtons presented={presented} onChoose={session.choose} compact={false} />
              </View>
            )
          }>
          <DrillsImportNudge compact={phone} />
        </PhoneTray>
      }
    />
  );
}

const styles = themedStyleSheet((colors) => ({
  progressRow: {
    height: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  sourcePill: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing[10],
    paddingVertical: spacing[3],
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    maxWidth: '100%',
  },
  sourcePillLink: {
    cursor: 'pointer',
  },
  sourcePillHover: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
  },
  sourceText: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes[12],
    lineHeight: lineHeights[16],
    color: colors.textMuted,
  },
  sourceTextLink: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes[12],
    lineHeight: lineHeights[16],
    color: colors.accent,
  },
}));
