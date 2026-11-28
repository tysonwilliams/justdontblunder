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
import { formatDueWhen } from '@/src/logic/reviewSchedule';
import { fonts, fontSizes, lineHeights, spacing } from '@/src/theme';
import { themedStyleSheet } from '@/src/theme/themed';
import { useTheme } from '@/src/theme/useTheme';

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
  emptyOwn = false,
  practicingAhead = false,
  upcomingCount = 0,
  upcomingNextDays = null,
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
  emptyOwn?: boolean;
  practicingAhead?: boolean;
  upcomingCount?: number;
  upcomingNextDays?: number | null;
  correct: number;
  total: number;
  best: number;
  onRestart: () => void;
  onPracticeAhead?: () => void;
}) {
  useTheme();
  const pct = total ? Math.round((correct / total) * 100) : 0;
  const { phone } = useLayout();
  const caughtUp = reviewing && !emptyReview;
  const nextWhen = upcomingNextDays != null ? formatDueWhen(upcomingNextDays) : null;
  const reviewButtonLabel = caughtUp
    ? `Review again (${upcomingCount})`
    : `Review early (${upcomingCount})`;

  return (
    <ScoreFrame toolbar={<DrillToolbar {...toolbar} />}>
      <View style={play.done}>
        {phone ? null : <Text style={text.eyebrow}>Drills</Text>}
        <Text style={[text.title, phone && text.titlePhone]} numberOfLines={2}>
          {emptyOwn
            ? 'No personal blunders here'
            : emptyReview
              ? 'All caught up'
              : caughtUp
                ? practicingAhead
                  ? 'Extra practice complete'
                  : 'Reviews complete'
                : streak
                  ? 'Clean run'
                  : "That's the set"}
        </Text>
        {emptyOwn ? (
          <Text style={[text.muted, phone && text.mutedPhone]} numberOfLines={phone ? 3 : undefined}>
            {toolbar.theme === 'all'
              ? 'Import your Chess.com or Lichess games to build your own blunder set.'
              : `None of your imported blunders are ${themeFilterLabel(toolbar.theme).toLowerCase()} yet.`}
          </Text>
        ) : emptyReview ? (
          <Text style={[text.muted, phone && text.mutedPhone]} numberOfLines={phone ? 3 : undefined}>
            {toolbar.theme === 'all'
              ? upcomingCount > 0
                ? nextWhen
                  ? `Nothing due today. ${upcomingCount} ${upcomingCount === 1 ? 'position returns' : 'positions return'} ${nextWhen}.`
                  : `Nothing due today. ${upcomingCount} ${upcomingCount === 1 ? 'position is' : 'positions are'} scheduled for later.`
                : 'Nothing due today. Misses from drills and games show up here automatically.'
              : upcomingCount > 0 && nextWhen
                ? `No ${themeFilterLabel(toolbar.theme).toLowerCase()} puzzles due today. ${upcomingCount} ${upcomingCount === 1 ? 'returns' : 'return'} ${nextWhen}.`
                : `No ${themeFilterLabel(toolbar.theme).toLowerCase()} puzzles are due right now.`}
          </Text>
        ) : (
          <>
            <Text style={[text.hero, phone && text.heroPhone]}>{streak ? correct : `${correct}/${total}`}</Text>
            <Text style={[text.muted, phone && text.mutedPhone]} numberOfLines={2}>
              {streak
                ? `in a row · best ${best}`
                : caughtUp
                  ? practicingAhead
                    ? `${pct}% saved on the first try · review schedule unchanged`
                    : nextWhen
                      ? `${pct}% saved on the first try · next review ${nextWhen}`
                      : `${pct}% saved on the first try · scheduled for later`
                  : `${pct}% saved on the first try`}
            </Text>
          </>
        )}
        {emptyOwn ? (
          <Button
            compact={phone}
            label="Show all puzzles"
            testID="own-show-all"
            onPress={() => toolbar.onSource?.('all')}
          />
        ) : emptyReview || caughtUp ? (
          <>
            <Button
              compact={phone}
              label="Play drills"
              testID="review-play-drills"
              onPress={() => toolbar.onMode('play')}
            />
            {upcomingCount > 0 && onPracticeAhead ? (
              <View style={styles.extraBlock}>
                <Button
                  compact={phone}
                  variant="secondary"
                  label={reviewButtonLabel}
                  testID="review-practice-ahead"
                  onPress={onPracticeAhead}
                />
                <Text style={styles.extraHint} numberOfLines={2}>
                  Extra practice — won’t change your review schedule.
                </Text>
              </View>
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

const styles = themedStyleSheet((colors) => ({
  extraBlock: {
    width: '100%',
    gap: spacing[6],
  },
  extraHint: {
    fontFamily: fonts.body,
    fontSize: fontSizes[12],
    lineHeight: lineHeights[16],
    color: colors.textDim,
    textAlign: 'center',
  },
}));
