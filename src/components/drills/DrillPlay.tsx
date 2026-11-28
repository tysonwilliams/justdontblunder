import type { ReactNode } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';

import { BlunderOverlay } from '@/src/components/Board/BlunderOverlay';
import { ChessBoard } from '@/src/components/Board/ChessBoard';
import { DrillsImportNudge } from '@/src/components/drills/DrillsImportNudge';
import type { useDrillSession } from '@/src/components/drills/useDrillSession';
import { DrillToolbar } from '@/src/components/DrillToolbar';
import { controlA11y } from '@/src/components/ui/a11y';
import { BoardLead } from '@/src/components/ui/BoardLead';
import { Button } from '@/src/components/ui/Button';
import { LineBox } from '@/src/components/ui/LineBox';
import { PHONE_PROMPT_HEIGHT } from '@/src/components/ui/phoneSlots';
import { PhoneTray } from '@/src/components/ui/PhoneTray';
import { PlayFrame } from '@/src/components/ui/PlayFrame';
import { play } from '@/src/components/ui/playStyles';
import { ProgressTrack } from '@/src/components/ui/ProgressTrack';
import { PuzzleCount } from '@/src/components/ui/PuzzleCount';
import { text } from '@/src/components/ui/text';
import { useKeyboardShortcuts } from '@/src/components/ui/useKeyboardShortcuts';
import { type DrillMode, type DrillSourceFilter, type ThemeFilter } from '@/src/logic/drillLink';
import { HABIT_PROMPT, themeInstruction, turnPrompt, type DrillTheme } from '@/src/logic/drills';
import { REVIEW_INTERVALS } from '@/src/logic/reviewSchedule';
import { drillStreakExtra } from '@/src/logic/streak';
import { themedStyleSheet } from '@/src/theme/themed';
import { useTheme } from '@/src/theme/useTheme';
import { fonts, fontSizes, lineHeights, radii, spacing } from '@/src/theme';

type Session = ReturnType<typeof useDrillSession>;

type Props = {
  session: Session;
  onMode: (mode: DrillMode) => void;
  onTheme: (theme: ThemeFilter) => void;
  onStreak: (streak: boolean) => void;
  onSource?: (source: DrillSourceFilter) => void;
  phone: boolean;
};

export function DrillPlay({ session, onMode, onTheme, onStreak, onSource, phone }: Props) {
  useTheme();
  const drill = session.drill;

  useKeyboardShortcuts(
    {
      Enter: () => {
        if (session.round === 'correct' || session.round === 'revealed') {
          if (session.runOver) session.showRunSummary();
          else session.next();
          return true;
        }
        if ((session.round === 'retry' || session.round === 'streakEnd') && session.replyReady) {
          if (session.shownIdea) session.showRunSummary();
          else session.tryAgain();
          return true;
        }
        return false;
      },
      ' ': () => {
        if (session.round === 'correct' || session.round === 'revealed') {
          if (session.runOver) session.showRunSummary();
          else session.next();
          return true;
        }
        if ((session.round === 'retry' || session.round === 'streakEnd') && session.replyReady) {
          if (session.shownIdea) session.showRunSummary();
          else session.tryAgain();
          return true;
        }
        return false;
      },
      h: () => {
        if (session.round !== 'playing') return false;
        if (session.unprompted && !session.streak) session.stepHint();
        else session.revealIdea();
        return true;
      },
      r: () => {
        if ((session.round === 'retry' || session.round === 'streakEnd') && session.replyReady) {
          if (session.shownIdea) session.showRunSummary();
          else session.tryAgain();
          return true;
        }
        return false;
      },
      p: () => {
        if ((session.round === 'retry' || session.round === 'streakEnd') && session.replyReady && session.hasReplay) {
          session.replayReply();
          return true;
        }
        return false;
      },
    },
    Boolean(drill),
  );

  if (!drill) return null;
  const toolbar = (
    <DrillToolbar
      mode={session.mode}
      theme={session.theme}
      streak={session.streak}
      source={session.source}
      unprompted={session.unprompted}
      blitzTimer={session.blitzTimer}
      onMode={onMode}
      onTheme={onTheme}
      onStreak={onStreak}
      onSource={onSource}
      onUnprompted={session.setUnprompted}
      onBlitzTimer={session.setBlitzTimer}
    />
  );

  return (
    <PlayFrame
      intro={
        phone ? (
          <PhoneIntro session={session} toolbar={toolbar} />
        ) : (
          <DeskIntro session={session} toolbar={toolbar} />
        )
      }
      board={
        <ChessBoard
          key={`${drill.id}-${session.index}`}
          fen={session.boardFen}
          orientation={session.orientation}
          flipCue={!phone && session.orientation === 'black'}
          hideTurn={phone || (session.streak && session.round === 'playing')}
          interactive={session.round === 'playing'}
          lastMove={session.boardLastMove}
          arrows={session.threatArrow}
          attentionSquares={session.attentionSquares}
          highlightSquares={session.marks.squares}
          highlightTone={session.marks.tone}
          onMove={session.onMove}
        />
      }
      aside={
        <PhoneTray banner={<DrillAside session={session} phone={phone} />}>
          {!session.streak ? <DrillsImportNudge compact={phone} /> : null}
        </PhoneTray>
      }
    />
  );
}

function PhoneIntro({ session, toolbar }: { session: Session; toolbar: ReactNode }) {
  const drill = session.drill;
  if (!drill) return null;
  const title = session.promptVisible ? drill.prompt : turnPrompt(drill.sideToMove);
  return (
    <BoardLead gap={spacing[6]}>
      {toolbar}
      <LineBox height={PHONE_PROMPT_HEIGHT}>
        <Text style={play.phoneTitle} numberOfLines={2}>
          {title}
        </Text>
      </LineBox>
      <View style={styles.progressRow}>
        <View style={play.progressGrow}>
          <ProgressTrack progress={session.progress} />
        </View>
        {session.sourceLabel ? (
          <Text style={styles.phoneSourceTag} numberOfLines={1}>
            Your game
          </Text>
        ) : null}
        {session.blitzTimer && session.round === 'playing' ? (
          <Text
            testID="blitz-clock"
            style={[
              styles.clockPhone,
              session.secondsLeft <= 5 && styles.clockWarnText,
              session.secondsLeft <= 3 && styles.clockDangerText,
            ]}>
            {session.secondsLeft === 0 ? "Time's up" : `${session.secondsLeft}s`}
          </Text>
        ) : null}
        <PuzzleCount
          index={session.index}
          total={session.session.positions.length}
          spaced={false}
          phone
          extra={drillStreakExtra(session.streak, session.score.correct, session.bestPuzzleStreak, true)}
        />
      </View>
    </BoardLead>
  );
}

function DeskIntro({ session, toolbar }: { session: Session; toolbar: ReactNode }) {
  const drill = session.drill;
  if (!drill) return null;
  const task = session.promptVisible ? drill.prompt : session.round === 'playing' ? turnPrompt(drill.sideToMove) : null;
  return (
    <BoardLead gap={spacing[10]}>
      {toolbar}
      {session.sourceLabel || session.reviewing || session.difficulty || session.blitzTimer ? (
        <View style={styles.metaStrip}>
          {session.difficulty ? (
            <View style={styles.tierPill} testID="drill-difficulty">
              <Text style={styles.tierText}>{session.difficulty}</Text>
            </View>
          ) : null}
          {session.blitzTimer && session.round === 'playing' ? (
            <View
              testID="blitz-clock"
              style={[
                styles.clockPill,
                session.secondsLeft <= 5 && styles.clockWarn,
                session.secondsLeft <= 3 && styles.clockDanger,
              ]}>
              <Text
                style={[
                  styles.clockText,
                  session.secondsLeft <= 5 && styles.clockWarnText,
                  session.secondsLeft <= 3 && styles.clockDangerText,
                ]}>
                {session.secondsLeft === 0 ? "Time's up" : `${session.secondsLeft}s`}
              </Text>
            </View>
          ) : null}
          {session.sourceLabel ? (
            session.sourceUrl ? (
              <Pressable
                {...controlA11y('link', `Open game: ${session.sourceLabel}`)}
                testID="drill-source"
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
              <View style={styles.sourcePill} testID="drill-source">
                <Text style={styles.sourceText} numberOfLines={1}>
                  {session.sourceLabel}
                </Text>
              </View>
            )
          ) : null}
          {session.reviewing ? (
            <ReviewMasteryPips saves={session.reviewSaves} ahead={session.practicingAhead} />
          ) : null}
        </View>
      ) : null}
      {task ? (
        <Text style={text.title} testID="drill-task">
          {task}
        </Text>
      ) : null}
      {session.promptVisible && session.round === 'playing' ? <Text style={text.habit}>{HABIT_PROMPT}</Text> : null}
      <View style={styles.progressRow}>
        <View style={play.progressGrow}>
          <ProgressTrack progress={session.progress} />
        </View>
        <PuzzleCount
          index={session.index}
          total={session.session.positions.length}
          spaced
          extra={drillStreakExtra(session.streak, session.score.correct, session.bestPuzzleStreak, false)}
        />
      </View>
    </BoardLead>
  );
}

function ReviewMasteryPips({ saves, ahead }: { saves: number; ahead: boolean }) {
  const total = REVIEW_INTERVALS.length;
  const filled = Math.min(total, Math.max(0, saves));
  return (
    <View style={styles.masteryPill} testID="review-mastery">
      <View style={styles.pipRow}>
        {REVIEW_INTERVALS.map((gap, i) => (
          <View key={gap} style={[styles.pip, i < filled && styles.pipOn]} />
        ))}
      </View>
      <Text style={styles.masteryText}>
        {ahead ? `Extra practice · ${filled}/${total}` : `Mastery ${filled}/${total}`}
      </Text>
    </View>
  );
}

function DrillAside({ session, phone }: { session: Session; phone: boolean }) {
  const drill = session.drill;
  if (!drill) return null;
  if (session.round === 'playing') {
    if (session.streak) return <StreakAside phone={phone} onReveal={session.revealIdea} />;
    return (
      <GuidedAside
        phone={phone}
        theme={drill.theme}
        unprompted={session.unprompted}
        hintStep={session.hintStep}
        timeUp={session.blitzTimer && session.secondsLeft === 0}
        onHint={session.stepHint}
        onReveal={session.revealIdea}
      />
    );
  }
  return (
    <DrillFeedback
      round={session.round}
      message={session.roundCopy}
      compactNote={session.compactNote}
      score={session.score.correct}
      runOver={session.runOver}
      shownIdea={session.shownIdea}
      replyReady={session.replyReady}
      hasReplay={session.hasReplay}
      onNext={session.next}
      onAgain={session.tryAgain}
      onReplay={session.replayReply}
      onSkipReply={session.skipReply}
      onDone={session.showRunSummary}
    />
  );
}

function GuidedAside({
  phone,
  theme,
  unprompted,
  hintStep,
  timeUp,
  onHint,
  onReveal,
}: {
  phone: boolean;
  theme: DrillTheme;
  unprompted: boolean;
  hintStep: number;
  timeUp: boolean;
  onHint: () => void;
  onReveal: () => void;
}) {
  const hintLabel =
    hintStep === 0 ? 'Hint (1/3)' : hintStep === 1 ? 'Hint (2/3)' : 'Show the idea';
  const unpromptedCopy = timeUp
    ? "Time's up — check their threats first, then play."
    : hintStep === 0
      ? 'Scan the board yourself and play any safe move.'
      : hintStep === 1
        ? 'Check the amber piece under fire.'
        : themeInstruction(theme);

  if (phone) {
    return (
      <View style={[play.phoneCard, styles.ideaCard]}>
        <Text style={[text.muted, text.mutedPhone]} numberOfLines={2}>
          {unprompted ? unpromptedCopy : timeUp ? "Time's up — check their threats, then play." : themeInstruction(theme)}
        </Text>
        <View style={styles.phoneHintRow}>
          {unprompted && hintStep < 2 ? (
            <Button
              compact
              label={hintLabel}
              variant="secondary"
              testID="progressive-hint"
              onPress={onHint}
              style={[styles.trayButton, styles.actionFlex]}
            />
          ) : null}
          <Button
            compact
            label="Show the idea"
            variant="secondary"
            onPress={onReveal}
            style={[styles.trayButton, unprompted && hintStep < 2 ? styles.actionFlex : undefined]}
          />
        </View>
      </View>
    );
  }
  return (
    <View style={play.guide}>
      <Text style={text.body}>
        {unprompted ? unpromptedCopy : timeUp ? "Time's up — spot the threat, then play." : themeInstruction(theme)}
      </Text>
      <Text style={text.muted}>
        {unprompted
          ? hintStep === 0
            ? 'Unprompted mode hides the danger highlight. Tap Hint for a step-by-step nudge, or right-click to draw arrows.'
            : hintStep === 1
              ? 'Step 1 of 3: threatened piece highlighted. Tap Hint again for the attacker arrow.'
              : 'Step 2 of 3: threat arrow shown. Tap Show the idea to see a safe move.'
          : 'The amber square is the piece under fire. Right-click to draw calculation arrows.'}
      </Text>
      {unprompted && hintStep < 2 ? (
        <Button label={hintLabel} variant="secondary" testID="progressive-hint" onPress={onHint} />
      ) : null}
      <Button label="Show the idea" variant={unprompted && hintStep < 2 ? 'ghost' : 'secondary'} onPress={onReveal} />
    </View>
  );
}

function StreakAside({ phone, onReveal }: { phone: boolean; onReveal: () => void }) {
  const hint = <Text style={text.muted}>No hints. One miss ends the run.</Text>;
  const action = (
    <Button
      compact={phone}
      label="Show the answer"
      variant="secondary"
      testID="show-answer"
      onPress={onReveal}
      style={phone ? styles.trayButton : undefined}
    />
  );
  if (phone) {
    return (
      <View style={[play.phoneCard, styles.ideaCard]}>
        <Text style={[text.muted, text.mutedPhone]}>No hints. One miss ends the run.</Text>
        {action}
      </View>
    );
  }
  return (
    <View style={play.guide}>
      {hint}
      {action}
    </View>
  );
}

function DrillFeedback({
  round,
  message,
  compactNote,
  score,
  runOver,
  shownIdea,
  replyReady,
  hasReplay,
  onNext,
  onAgain,
  onReplay,
  onSkipReply,
  onDone,
}: {
  round: Session['round'];
  message: string;
  compactNote?: string;
  score: number;
  runOver: boolean;
  shownIdea: boolean;
  replyReady: boolean;
  hasReplay: boolean;
  onNext: () => void;
  onAgain: () => void;
  onReplay: () => void;
  onSkipReply: () => void;
  onDone: () => void;
}) {
  return (
    <>
      <BlunderOverlay
        visible={round === 'correct'}
        tone="success"
        title="Nice save"
        message={message}
        compactNote={compactNote}
        actionLabel={runOver ? 'Done' : 'Next drill'}
        onDismiss={runOver ? onDone : onNext}
      />
      <BlunderOverlay
        visible={round === 'retry'}
        tone="danger"
        title="Blunder"
        message={message}
        compactNote={compactNote}
        waiting={replyReady ? undefined : 'Showing reply…'}
        onWaitingPress={replyReady ? undefined : onSkipReply}
        actionLabel={replyReady ? 'Try again' : undefined}
        onDismiss={replyReady ? onAgain : undefined}
        actionTestID="try-again"
        secondaryLabel={replyReady && hasReplay ? 'Replay' : undefined}
        onSecondary={replyReady && hasReplay ? onReplay : undefined}
        secondaryTestID="replay-reply"
      />
      <BlunderOverlay
        visible={round === 'revealed'}
        tone="warn"
        title="Here's the idea"
        message={message}
        compactNote={compactNote}
        actionLabel="Next drill"
        onDismiss={onNext}
      />
      <BlunderOverlay
        visible={round === 'streakEnd'}
        tone="danger"
        title="Streak over"
        message={`${score} in a row. ${message}`}
        compactNote={compactNote}
        waiting={!shownIdea && !replyReady ? 'Showing reply…' : undefined}
        onWaitingPress={!shownIdea && !replyReady ? onSkipReply : undefined}
        actionLabel={!replyReady ? undefined : shownIdea ? 'Done' : 'Try again'}
        onDismiss={!replyReady ? undefined : shownIdea ? onDone : onAgain}
        actionTestID={shownIdea ? undefined : 'try-again'}
        secondaryLabel={replyReady && !shownIdea ? (hasReplay ? 'Replay' : 'Done') : undefined}
        onSecondary={replyReady && !shownIdea ? (hasReplay ? onReplay : onDone) : undefined}
        secondaryTestID={replyReady && !shownIdea && hasReplay ? 'replay-reply' : undefined}
        extraLabel={replyReady && !shownIdea && hasReplay ? 'Done' : undefined}
        onExtra={replyReady && !shownIdea && hasReplay ? onDone : undefined}
      />
    </>
  );
}

const styles = themedStyleSheet((colors) => ({
  progressRow: {
    height: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  phoneSourceTag: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes[11],
    lineHeight: lineHeights[14],
    color: colors.accent,
    flexShrink: 0,
  },
  metaStrip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing[6],
  },
  tierPill: {
    paddingHorizontal: spacing[10],
    paddingVertical: spacing[3],
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceRaised,
  },
  tierText: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes[12],
    lineHeight: lineHeights[16],
    color: colors.text,
  },
  clockPill: {
    paddingHorizontal: spacing[10],
    paddingVertical: spacing[3],
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
  },
  clockWarn: {
    borderColor: colors.warning,
    backgroundColor: colors.warningSoft,
  },
  clockDanger: {
    borderColor: colors.danger,
    backgroundColor: colors.dangerSoft,
  },
  clockText: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes[12],
    lineHeight: lineHeights[16],
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  clockPhone: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes[12],
    lineHeight: lineHeights[16],
    color: colors.textMuted,
    fontVariant: ['tabular-nums'],
  },
  clockWarnText: {
    color: colors.warning,
  },
  clockDangerText: {
    color: colors.danger,
  },
  sourcePill: {
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
  masteryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[6],
    paddingHorizontal: spacing[10],
    paddingVertical: spacing[3],
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  pipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  pip: {
    width: 7,
    height: 7,
    borderRadius: radii.pill,
    backgroundColor: colors.borderStrong,
  },
  pipOn: {
    backgroundColor: colors.accent,
  },
  masteryText: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes[12],
    lineHeight: lineHeights[16],
    color: colors.textMuted,
  },
  ideaCard: {
    paddingVertical: spacing[4],
    gap: spacing[2],
  },
  phoneHintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[6],
  },
  actionFlex: {
    flex: 1,
    minWidth: 0,
  },
  trayButton: {
    minHeight: 40,
  },
}));
