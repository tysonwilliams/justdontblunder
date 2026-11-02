import { Text, View } from 'react-native';

import { BlunderOverlay } from '@/src/components/Board/BlunderOverlay';
import { ChessBoard } from '@/src/components/Board/ChessBoard';
import { ChoiceButtons } from '@/src/components/drills/ChoiceButtons';
import { useSafeChoiceSession } from '@/src/components/drills/useSafeChoiceSession';
import { DrillToolbar } from '@/src/components/DrillToolbar';
import { BoardLead } from '@/src/components/ui/BoardLead';
import { StatusPill } from '@/src/components/ui/Chip';
import { Button } from '@/src/components/ui/Button';
import { ColorLegend } from '@/src/components/ui/ColorLegend';
import { PlayFrame, ScoreFrame } from '@/src/components/ui/PlayFrame';
import { play } from '@/src/components/ui/playStyles';
import { ProgressTrack } from '@/src/components/ui/ProgressTrack';
import { text } from '@/src/components/ui/text';
import { useLayout } from '@/src/components/ui/useLayout';
import { sessionForTheme, type DrillMode, type ThemeFilter } from '@/src/logic/drillLink';
import { HABIT_PROMPT, themeLabel } from '@/src/logic/drills';

type Props = {
  theme: ThemeFilter;
  onMode: (mode: DrillMode) => void;
  onTheme: (theme: ThemeFilter) => void;
};

export function SafeChoiceSession({ theme, onMode, onTheme }: Props) {
  const { split, phone } = useLayout();
  const session = useSafeChoiceSession(theme);
  const toolbar = <DrillToolbar mode="pick" theme={theme} onMode={onMode} onTheme={onTheme} />;

  if (session.done) {
    const pct = session.score.total ? Math.round((session.score.correct / session.score.total) * 100) : 0;
    return (
      <ScoreFrame toolbar={toolbar}>
        <View style={play.done}>
          <Text style={text.eyebrow}>Drills</Text>
          <Text style={text.title}>That's the set</Text>
          <Text style={text.hero}>
            {session.score.correct}/{session.score.total}
          </Text>
          <Text style={text.muted}>{pct}% safe on the first try</Text>
          <Button label="Play again" onPress={() => session.begin(sessionForTheme(theme))} />
        </View>
      </ScoreFrame>
    );
  }

  const drill = session.drill;
  const presented = session.presented;
  if (!drill || !presented) return null;

  return (
    <PlayFrame
      asideFirst={!split && session.round !== 'playing' && !session.watchingReply}
      intro={
        phone ? (
          <BoardLead>
            {toolbar}
            {session.round === 'playing' ? (
              <>
                <Text style={play.phoneTitle} numberOfLines={2}>
                  {drill.prompt}
                </Text>
                <View style={play.metaRow}>
                  <View style={play.progressGrow}>
                    <ProgressTrack progress={session.progress} />
                  </View>
                  <Text style={text.meta}>
                    {session.index + 1}/{session.session.positions.length}
                  </Text>
                </View>
              </>
            ) : null}
          </BoardLead>
        ) : (
          <BoardLead>
            {toolbar}
            <View style={play.metaRow}>
              <StatusPill>{themeLabel(drill.theme)}</StatusPill>
              <Text style={text.meta}>
                {session.index + 1} / {session.session.positions.length}
              </Text>
            </View>
            <ProgressTrack progress={session.progress} />
            {session.round === 'playing' ? <Text style={text.habit}>{HABIT_PROMPT}</Text> : null}
            <Text style={text.title}>Which move is safe?</Text>
            {session.round === 'playing' ? <Text style={text.body}>{drill.prompt}</Text> : null}
            {session.round === 'playing' ? <ColorLegend /> : null}
          </BoardLead>
        )
      }
      board={
        <ChessBoard
          key={`${drill.id}-${session.boardKey}`}
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
        session.card ? (
          <BlunderOverlay
            visible
            tone={session.card.tone}
            title={session.card.title}
            message={session.roundCopy}
            waiting={session.card.tone === 'danger' && !session.replyReady ? 'Watch the reply.' : undefined}
            actionLabel={session.card.tone === 'danger' ? (session.replyReady ? 'Try again' : undefined) : 'Next'}
            onDismiss={session.card.tone === 'danger' ? (session.replyReady ? session.tryAgain : undefined) : session.next}
            actionTestID={session.card.tone === 'danger' ? 'try-again' : 'next-puzzle'}
            secondaryLabel={session.card.tone === 'danger' && session.replyReady ? 'Next' : undefined}
            onSecondary={session.card.tone === 'danger' && session.replyReady ? session.next : undefined}
          />
        ) : phone ? (
          <ChoiceButtons presented={presented} onChoose={session.choose} compact />
        ) : (
          <View style={play.guide}>
            <Text style={text.body}>Blue arrows mark the two moves. One of them blunders.</Text>
            <ChoiceButtons presented={presented} onChoose={session.choose} compact={false} />
          </View>
        )
      }
    />
  );
}
