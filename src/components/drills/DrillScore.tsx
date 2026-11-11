import { Text, View } from 'react-native';

import { ChessBoard } from '@/src/components/Board/ChessBoard';
import { highlightsForRound } from '@/src/components/Board/highlight';
import { DrillToolbar, type DrillToolbarProps } from '@/src/components/DrillToolbar';
import type { DrillRunSummary } from '@/src/components/drills/useDrillSession';
import { Button } from '@/src/components/ui/Button';
import { ScoreFrame } from '@/src/components/ui/PlayFrame';
import { play } from '@/src/components/ui/playStyles';
import { text } from '@/src/components/ui/text';
import { useLayout } from '@/src/components/ui/useLayout';
import { themeFilterLabel } from '@/src/logic/drillLink';

type Toolbar = DrillToolbarProps;

export function DrillRunSummary({
  summary,
  toolbar,
  onAgain,
}: {
  summary: DrillRunSummary;
  toolbar: Toolbar;
  onAgain: () => void;
}) {
  const marks = highlightsForRound('streakEnd', summary.lastMove, summary.atRisk);
  const { phone } = useLayout();
  return (
    <ScoreFrame
      toolbar={<DrillToolbar {...toolbar} />}
      board={
        <ChessBoard
          fen={summary.fen}
          orientation={summary.orientation}
          flipCue={summary.orientation === 'black'}
          interactive={false}
          lastMove={summary.lastMove}
          highlightSquares={marks.squares}
          highlightTone={marks.tone}
        />
      }>
      <View style={play.done}>
        {phone ? null : <Text style={text.eyebrow}>Drills</Text>}
        <Text style={[text.title, phone && text.titlePhone]} numberOfLines={1}>
          Streak over
        </Text>
        <Text style={[text.hero, phone && text.heroPhone]}>{summary.saved}</Text>
        <Text style={[text.muted, phone && text.mutedPhone]} numberOfLines={1}>
          saved this run · best {summary.best}
        </Text>
        <View style={play.miss}>
          {phone ? null : <Text style={text.section}>The miss</Text>}
          {summary.playedSan ? (
            <Text style={[text.body, phone && text.bodyPhone]} numberOfLines={1}>
              You played {summary.playedSan}.
            </Text>
          ) : null}
          <Text style={[text.body, phone && text.bodyPhone]} numberOfLines={phone ? 2 : undefined}>
            {summary.missText}
          </Text>
        </View>
        <Button compact={phone} label="Start again" onPress={onAgain} />
      </View>
    </ScoreFrame>
  );
}

export function DrillDone({
  toolbar,
  reviewing,
  streak,
  emptyReview,
  correct,
  total,
  best,
  onRestart,
}: {
  toolbar: Toolbar;
  reviewing: boolean;
  streak: boolean;
  emptyReview: boolean;
  correct: number;
  total: number;
  best: number;
  onRestart: () => void;
}) {
  const pct = total ? Math.round((correct / total) * 100) : 0;
  const { phone } = useLayout();
  return (
    <ScoreFrame toolbar={<DrillToolbar {...toolbar} />}>
      <View style={play.done}>
        {phone ? null : <Text style={text.eyebrow}>Drills</Text>}
        <Text style={[text.title, phone && text.titlePhone]} numberOfLines={2}>
          {emptyReview ? 'Nothing to review' : streak ? 'Clean run' : "That's the set"}
        </Text>
        {emptyReview ? (
          <Text style={[text.muted, phone && text.mutedPhone]} numberOfLines={phone ? 3 : undefined}>
            {toolbar.theme === 'all'
              ? 'You have no misses saved for today.'
              : `No missed ${themeFilterLabel(toolbar.theme).toLowerCase()} puzzles today.`}
          </Text>
        ) : (
          <>
            <Text style={[text.hero, phone && text.heroPhone]}>{streak ? correct : `${correct}/${total}`}</Text>
            <Text style={[text.muted, phone && text.mutedPhone]} numberOfLines={2}>
              {streak ? `in a row · best ${best}` : `${pct}% saved on the first try`}
            </Text>
          </>
        )}
        <Button
          compact={phone}
          label={streak ? 'Run again' : reviewing ? 'Review again' : 'Practice again'}
          onPress={onRestart}
        />
      </View>
    </ScoreFrame>
  );
}
