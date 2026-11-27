import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { BlunderOverlay } from '@/src/components/Board/BlunderOverlay';
import { ChessBoard } from '@/src/components/Board/ChessBoard';
import { sentence, usePracticeGame } from '@/src/components/practice/usePracticeGame';
import { DueTodayLink } from '@/src/components/review/DueTodayLink';
import { MenuButton } from '@/src/components/SettingsMenu';
import { PlaySkeleton } from '@/src/components/ui/Skeleton';
import { forceSkeleton } from '@/src/components/ui/skeletonMode';
import { liveA11y } from '@/src/components/ui/a11y';
import { BoardLead } from '@/src/components/ui/BoardLead';
import { Button } from '@/src/components/ui/Button';
import { ColorLegend } from '@/src/components/ui/ColorLegend';
import { LineBox } from '@/src/components/ui/LineBox';
import { PhoneTray } from '@/src/components/ui/PhoneTray';
import { PlayFrame } from '@/src/components/ui/PlayFrame';
import { play } from '@/src/components/ui/playStyles';
import { text } from '@/src/components/ui/text';
import { useLayout } from '@/src/components/ui/useLayout';
import { HABIT_PROMPT } from '@/src/logic/drills';
import { drillFromBlunder, drillFromHang } from '@/src/logic/personalDrill';
import { useProgressStore } from '@/src/store/progress';
import { spacing } from '@/src/theme';

export function PracticeScreen() {
  const { phone, topNav } = useLayout();
  const game = usePracticeGame();
  const savePersonalDrill = useProgressStore((state) => state.savePersonalDrill);
  const [savedId, setSavedId] = useState<string | null>(null);
  const hangingVisible = !game.feedback && !game.status && game.hangingNow[0];
  const offerKey =
    game.tone === 'danger' && game.blunder
      ? `move:${game.blunder.fen}:${game.blunder.from}${game.blunder.to}`
      : (hangingVisible || game.tone === 'warn') && game.fen.includes(' w ')
        ? `hang:${game.fen}`
        : null;
  const saved = offerKey != null && offerKey === savedId;
  const saveOffer = () => {
    if (!offerKey || saved) return;
    const drill =
      game.tone === 'danger' && game.blunder ? drillFromBlunder(game.blunder) : drillFromHang(game.fen);
    if (!drill) return;
    savePersonalDrill(drill);
    setSavedId(offerKey);
  };
  if (forceSkeleton()) return <PlaySkeleton />;
  const showFeedback = game.feedback != null && (game.tone === 'danger' || !game.gameOver);
  const preMoveHang = !game.feedback && !game.status ? game.hangingNow[0] : undefined;
  const danger = game.tone === 'danger';
  const drillAction = offerKey
    ? {
        label: saved ? 'Saved' : 'Drill this',
        active: saved,
        onPress: saveOffer,
        testID: 'drill-this',
      }
    : undefined;

  return (
    <PlayFrame
      intro={
        <BoardLead gap={phone ? spacing[6] : spacing[10]}>
          <View style={[styles.topRow, phone && styles.topRowPhone]}>
            <DueTodayLink variant="line" />
            <View style={styles.topRight}>
              <ColorLegend compact={phone} />
              {!topNav ? <MenuButton compact={phone} /> : null}
            </View>
          </View>
          <LineBox height={phone ? 24 : 32}>
            <Text style={[text.title, phone && text.titlePhone]} numberOfLines={1}>
              Your game
            </Text>
          </LineBox>
          <LineBox height={phone ? 18 : 22}>
            <Text style={[text.habit, phone && text.habitPhone]} numberOfLines={1}>
              {HABIT_PROMPT}
            </Text>
          </LineBox>
        </BoardLead>
      }
      board={
        <ChessBoard
          fen={game.fen}
          orientation="white"
          interactive={!game.thinking && !game.gameOver && game.fen.includes(' w ')}
          highlightSquares={game.feedback && game.tone === 'danger' ? game.highlights : []}
          attentionSquares={game.tone === 'warn' ? game.highlights : preMoveHang ? preMoveHang.squares : []}
          highlightTone="danger"
          arrows={game.feedback && game.tone === 'success' ? [] : game.arrow}
          lastMove={game.lastMove}
          onMove={game.onMove}
        />
      }
      aside={
        <PhoneTray
          banner={
            showFeedback && game.feedback ? (
              <BlunderOverlay
                visible
                tone={game.tone}
                title={game.feedback.title}
                message={
                  game.gameOver && game.resultLine ? `${game.panelMessage} ${game.resultLine}` : game.panelMessage
                }
                hint={game.feedback.bestMoveHint}
                headerAction={drillAction}
                actionLabel={danger ? 'Try again' : 'Continue'}
                onDismiss={danger ? game.tryAgain : game.dismissFeedback}
                actionTestID={danger ? 'try-again' : undefined}
                secondaryLabel={danger ? 'Continue' : undefined}
                onSecondary={danger ? game.dismissFeedback : undefined}
              />
            ) : game.gameOver ? (
              <View {...liveA11y()} style={[play.guide, phone && play.phoneCard]}>
                <Text style={[text.bodyStrong, phone && text.bodyPhone]} numberOfLines={phone ? 2 : undefined}>
                  {game.resultLine}
                </Text>
                <Button compact={phone} label="Play again" onPress={game.resetBoard} />
              </View>
            ) : game.status ? (
              <View {...liveA11y()} style={[play.guide, phone && play.phoneCard]}>
                <Text style={[text.bodyStrong, phone && text.bodyPhone]} numberOfLines={phone ? 2 : undefined}>
                  {game.status}
                </Text>
              </View>
            ) : game.hangingNow[0] ? (
              <BlunderOverlay
                visible
                tone="warn"
                title="Hanging piece"
                message={sentence(
                  `Before you move: your ${game.hangingNow[0].message.replace('You left the ', '').replace(' hanging', '')} on ${game.hangingNow[0].squares[0]} is hanging`,
                )}
                headerAction={drillAction}
              />
            ) : (
              <View style={[play.guide, phone && play.phoneCard]}>
                <Text style={[text.body, phone && text.bodyPhone]} numberOfLines={phone ? 3 : undefined}>
                  You play White. Black answers. If you leave a piece hanging, they take it.
                </Text>
              </View>
            )
          }
        />
      }
    />
  );
}

const styles = StyleSheet.create({
  topRow: {
    width: '100%',
    minHeight: 32,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  topRowPhone: {
    height: 30,
    minHeight: 30,
    overflow: 'hidden',
  },
  topRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[4],
    flexShrink: 0,
  },
});
