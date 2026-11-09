import { Text, View } from 'react-native';

import { BlunderOverlay } from '@/src/components/Board/BlunderOverlay';
import { ChessBoard } from '@/src/components/Board/ChessBoard';
import { sentence, usePracticeGame } from '@/src/components/practice/usePracticeGame';
import { useEnginePhase } from '@/src/engine/useEnginePhase';
import { PlaySkeleton } from '@/src/components/ui/Skeleton';
import { forceSkeleton } from '@/src/components/ui/skeletonMode';
import { liveA11y } from '@/src/components/ui/a11y';
import { BoardLead } from '@/src/components/ui/BoardLead';
import { Button } from '@/src/components/ui/Button';
import { ColorLegend } from '@/src/components/ui/ColorLegend';
import { LineBox } from '@/src/components/ui/LineBox';
import { footFitsExtra } from '@/src/components/ui/phoneSlots';
import { PhoneTray } from '@/src/components/ui/PhoneTray';
import { PlayFrame } from '@/src/components/ui/PlayFrame';
import { play } from '@/src/components/ui/playStyles';
import { text } from '@/src/components/ui/text';
import { useLayout } from '@/src/components/ui/useLayout';
import { HABIT_PROMPT } from '@/src/logic/drills';

export function PracticeScreen() {
  const { phone, slots } = useLayout();
  const engine = useEnginePhase();
  const game = usePracticeGame();
  if (forceSkeleton() || engine === 'warming') return <PlaySkeleton />;
  const showFeedback = game.feedback != null && (game.tone === 'danger' || !game.gameOver);
  const preMoveHang = !game.feedback && !game.status ? game.hangingNow[0] : undefined;
  const showNewGame = !game.gameOver && (!phone || (slots != null && footFitsExtra(slots.foot, 44)));

  return (
    <PlayFrame
      intro={
        <BoardLead>
          <LineBox height={phone ? 16 : 16}>
            <Text style={text.eyebrow} numberOfLines={1}>
              Practice
            </Text>
          </LineBox>
          <LineBox height={phone ? 22 : 32}>
            <Text style={[text.title, phone && text.titlePhone]} numberOfLines={1}>
              Your game
            </Text>
          </LineBox>
          <LineBox height={phone ? 18 : 22}>
            <Text style={[text.habit, phone && text.habitPhone]} numberOfLines={1}>
              {HABIT_PROMPT}
            </Text>
          </LineBox>
          {phone ? null : (
            <Text style={text.body}>
              You play White. Black answers. If you leave a piece hanging, they take it.
            </Text>
          )}
          <LineBox height={phone ? 24 : 28}>
            <ColorLegend />
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
                actionLabel={game.tone === 'danger' ? 'Try again' : 'Continue'}
                onDismiss={game.tone === 'danger' ? game.tryAgain : game.dismissFeedback}
                actionTestID={game.tone === 'danger' ? 'try-again' : undefined}
                secondaryLabel={game.tone === 'danger' ? 'Continue' : undefined}
                onSecondary={game.tone === 'danger' ? game.dismissFeedback : undefined}
              />
            ) : game.gameOver ? (
              <View {...liveA11y()} style={[play.guide, phone && play.phoneCard]}>
                <Text style={[text.bodyStrong, phone && text.bodyPhone]} numberOfLines={phone ? 2 : undefined}>
                  {game.resultLine}
                </Text>
                <Button compact={phone} label="New game" onPress={game.resetBoard} />
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
              />
            ) : (
              <View style={[play.guide, phone && play.phoneCard]}>
                <Text style={[text.body, phone && text.bodyPhone]} numberOfLines={phone ? 3 : undefined}>
                  You play White. Black answers. If you leave a piece hanging, they take it.
                </Text>
              </View>
            )
          }>
          {showNewGame ? <Button compact={phone} label="New game" variant="secondary" onPress={game.resetBoard} /> : null}
        </PhoneTray>
      }
    />
  );
}
