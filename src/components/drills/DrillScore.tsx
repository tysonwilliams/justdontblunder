import { Text, View } from 'react-native';

import { ChessBoard } from '@/src/components/Board/ChessBoard';
import { highlightsForRound } from '@/src/components/Board/highlight';
import { DrillsImportNudge } from '@/src/components/drills/DrillsImportNudge';
import { DrillToolbar, type DrillToolbarProps } from '@/src/components/DrillToolbar';
import type { DrillRunSummary as DrillRunSummaryData } from '@/src/components/drills/useDrillSession';
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
  summary: DrillRunSummaryData;
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
  upcomingCount = 0,
  correct,
  total,
  best,
  onRestart,
  onPracticeAhead,
}: {
  toolbar: Toolbar;
  reviewing: boolean;
  streak: boolean;
  emptyReview: boolean;
  upcomingCount?: number;
  correct: number;
  total: number;
  best: number;
  onRestart: () => void;
  onPracticeAhead?: () => void;
}) {
  const pct = total ? Math.round((correct / total) * 100) : 0;
  const { phone } = useLayout();
  const caughtUp = reviewing && !emptyReview;
  return (
    <ScoreFrame toolbar={<DrillToolbar {...toolbar} />}>
      <View style={play.done}>
        {phone ? null : <Text style={text.eyebrow}>Drills</Text>}
        <Text style={[text.title, phone && text.titlePhone]} numberOfLines={2}>
          {emptyReview
            ? 'All caught up'
            : caughtUp
              ? 'Reviews complete'
              : streak
                ? 'Clean run'
                : "That's the set"}
        </Text>
        {emptyReview ? (
          <Text style={[text.muted, phone && text.mutedPhone]} numberOfLines={phone ? 3 : undefined}>
            {toolbar.theme === 'all'
              ? upcomingCount > 0
                ? `Nothing is due today. ${upcomingCount} ${upcomingCount === 1 ? 'position is' : 'positions are'} scheduled for later.`
                : 'Nothing is due today. Misses from drills and games show up here automatically.'
              : `No ${themeFilterLabel(toolbar.theme).toLowerCase()} puzzles are due right now.`}
          </Text>
        ) : (
          <>
            <Text style={[text.hero, phone && text.heroPhone]}>{streak ? correct : `${correct}/${total}`}</Text>
            <Text style={[text.muted, phone && text.mutedPhone]} numberOfLines={2}>
              {streak
                ? `in a row · best ${best}`
                : caughtUp
                  ? `${pct}% saved on the first try · scheduled for later`
                  : `${pct}% saved on the first try`}
            </Text>
          </>
        )}
        {emptyReview || caughtUp ? (
          <>
            <Button
              compact={phone}
              label="Play drills"
              testID="review-play-drills"
              onPress={() => toolbar.onMode('play')}
            />
            {upcomingCount > 0 && onPracticeAhead ? (
              <Button
                compact={phone}
                variant="secondary"
                label={`Practice ahead (${upcomingCount})`}
                testID="review-practice-ahead"
                onPress={onPracticeAhead}
              />
            ) : null}
          </>
        ) : (
          <Button
            compact={phone}
            label={streak ? 'Run again' : 'Practice again'}
            onPress={onRestart}
          />
        )}
        <DrillsImportNudge />
      </View>
    </ScoreFrame>
  );
}
