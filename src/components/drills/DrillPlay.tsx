import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { BlunderOverlay } from '@/src/components/Board/BlunderOverlay';
import { ChessBoard } from '@/src/components/Board/ChessBoard';
import type { useDrillSession } from '@/src/components/drills/useDrillSession';
import { DrillToolbar } from '@/src/components/DrillToolbar';
import { BoardLead } from '@/src/components/ui/BoardLead';
import { StatusPill } from '@/src/components/ui/Chip';
import { Button } from '@/src/components/ui/Button';
import { ColorLegend } from '@/src/components/ui/ColorLegend';
import { LineBox } from '@/src/components/ui/LineBox';
import { PHONE_PROMPT_HEIGHT } from '@/src/components/ui/phoneSlots';
import { PhoneTray } from '@/src/components/ui/PhoneTray';
import { PlayFrame } from '@/src/components/ui/PlayFrame';
import { play } from '@/src/components/ui/playStyles';
import { ProgressTrack } from '@/src/components/ui/ProgressTrack';
import { text } from '@/src/components/ui/text';
import { type DrillMode, type ThemeFilter } from '@/src/logic/drillLink';
import { HABIT_PROMPT, themeInstruction, themeLabel, turnPrompt, type DrillTheme } from '@/src/logic/drills';
import { spacing } from '@/src/theme';

type Session = ReturnType<typeof useDrillSession>;

type Props = {
  session: Session;
  onMode: (mode: DrillMode) => void;
  onTheme: (theme: ThemeFilter) => void;
  phone: boolean;
};

export function DrillPlay({ session, onMode, onTheme, phone }: Props) {
  const drill = session.drill;
  if (!drill) return null;
  const toolbar = (
    <DrillToolbar mode={session.mode} theme={session.theme} onMode={onMode} onTheme={onTheme} />
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
          hideTurn={phone || (!session.guided && session.round === 'playing')}
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
        <PhoneTray banner={<DrillAside session={session} phone={phone} />} />
      }
    />
  );
}

function PhoneIntro({ session, toolbar }: { session: Session; toolbar: ReactNode }) {
  const drill = session.drill;
  if (!drill) return null;
  const title = session.guided ? drill.prompt : turnPrompt(drill.sideToMove);
  return (
    <BoardLead>
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
        <Text style={[text.meta, text.metaPhone]} numberOfLines={1}>
          {session.index + 1}/{session.session.positions.length}
          {session.mode === 'streak' ? ` · ${session.score.correct}` : ''}
        </Text>
      </View>
    </BoardLead>
  );
}

function DeskIntro({ session, toolbar }: { session: Session; toolbar: ReactNode }) {
  const drill = session.drill;
  if (!drill) return null;
  return (
    <BoardLead>
      {toolbar}
      <View style={play.metaRow}>
        <StatusPill>
          {session.reviewing ? 'Review' : session.mode === 'streak' ? 'Streak' : themeLabel(drill.theme)}
        </StatusPill>
        <Text style={text.meta}>
          {session.index + 1} / {session.session.positions.length}
          {session.mode === 'streak' ? ` · ${session.score.correct} in a row` : ''}
        </Text>
      </View>
      <ProgressTrack progress={session.progress} />
      {session.guided && session.round === 'playing' ? <Text style={text.habit}>{HABIT_PROMPT}</Text> : null}
      {session.guided ? (
        <Text style={text.title}>{drill.prompt}</Text>
      ) : session.round === 'playing' ? (
        <Text style={text.title}>{turnPrompt(drill.sideToMove)}</Text>
      ) : null}
      {session.guided && session.round === 'playing' ? <ColorLegend /> : null}
    </BoardLead>
  );
}

function DrillAside({ session, phone }: { session: Session; phone: boolean }) {
  const drill = session.drill;
  if (!drill) return null;
  if (session.round === 'playing') {
    if (session.guided) return <GuidedAside phone={phone} theme={drill.theme} onReveal={session.revealIdea} />;
    return <StreakAside phone={phone} onReveal={session.revealIdea} />;
  }
  return (
    <DrillFeedback
      round={session.round}
      message={session.roundCopy}
      score={session.score.correct}
      runOver={session.runOver}
      shownIdea={session.shownIdea}
      replyReady={session.replyReady}
      onNext={session.next}
      onAgain={session.tryAgain}
      onDone={session.showRunSummary}
    />
  );
}

function GuidedAside({
  phone,
  theme,
  onReveal,
}: {
  phone: boolean;
  theme: DrillTheme;
  onReveal: () => void;
}) {
  if (phone) {
    return (
      <View style={play.phoneCard}>
        <Text style={[text.muted, text.mutedPhone]} numberOfLines={2}>
          {themeInstruction(theme)}
        </Text>
        <Button compact label="Show the idea" variant="secondary" onPress={onReveal} />
      </View>
    );
  }
  return (
    <View style={play.guide}>
      <Text style={text.body}>{themeInstruction(theme)}</Text>
      <Text style={text.muted}>The amber square is the piece under fire.</Text>
      <Button label="Show the idea" variant="secondary" onPress={onReveal} />
    </View>
  );
}

function StreakAside({ phone, onReveal }: { phone: boolean; onReveal: () => void }) {
  const hint = <Text style={text.muted}>No hints. One miss ends the run.</Text>;
  const action = (
    <Button compact={phone} label="Show the answer" variant="secondary" testID="show-answer" onPress={onReveal} />
  );
  if (phone) {
    return (
      <View style={play.phoneCard}>
        <Text style={[text.muted, text.mutedPhone]} numberOfLines={1}>
          No hints. One miss ends the run.
        </Text>
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
  score,
  runOver,
  shownIdea,
  replyReady,
  onNext,
  onAgain,
  onDone,
}: {
  round: Session['round'];
  message: string;
  score: number;
  runOver: boolean;
  shownIdea: boolean;
  replyReady: boolean;
  onNext: () => void;
  onAgain: () => void;
  onDone: () => void;
}) {
  return (
    <>
      <BlunderOverlay
        visible={round === 'correct'}
        tone="success"
        title="Nice save"
        message={message}
        actionLabel={runOver ? 'Done' : 'Next drill'}
        onDismiss={runOver ? onDone : onNext}
      />
      <BlunderOverlay
        visible={round === 'retry'}
        tone="danger"
        title="Not quite"
        message={message}
        waiting={replyReady ? undefined : 'Watch the reply.'}
        actionLabel={replyReady ? 'Try again' : undefined}
        onDismiss={replyReady ? onAgain : undefined}
        actionTestID="try-again"
      />
      <BlunderOverlay
        visible={round === 'revealed'}
        tone="warn"
        title="Here's the idea"
        message={message}
        actionLabel="Next drill"
        onDismiss={onNext}
      />
      <BlunderOverlay
        visible={round === 'streakEnd'}
        tone="danger"
        title="Streak over"
        message={`${score} in a row. ${message}`}
        waiting={!shownIdea && !replyReady ? 'Watch the reply.' : undefined}
        actionLabel={!replyReady ? undefined : shownIdea ? 'Done' : 'Try again'}
        onDismiss={!replyReady ? undefined : shownIdea ? onDone : onAgain}
        actionTestID={shownIdea ? undefined : 'try-again'}
        secondaryLabel={replyReady && !shownIdea ? 'Done' : undefined}
        onSecondary={replyReady && !shownIdea ? onDone : undefined}
      />
    </>
  );
}

const styles = StyleSheet.create({
  progressRow: {
    height: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
});
