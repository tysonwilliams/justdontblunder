import { Text, View } from 'react-native';

import { BlunderOverlay } from '@/src/components/Board/BlunderOverlay';
import { ChessBoard } from '@/src/components/Board/ChessBoard';
import { sentence, usePracticeGame } from '@/src/components/practice/usePracticeGame';
import { liveA11y } from '@/src/components/ui/a11y';
import { BoardLead } from '@/src/components/ui/BoardLead';
import { Button } from '@/src/components/ui/Button';
import { ColorLegend } from '@/src/components/ui/ColorLegend';
import { PlayFrame } from '@/src/components/ui/PlayFrame';
import { play } from '@/src/components/ui/playStyles';
import { text } from '@/src/components/ui/text';
import { useLayout } from '@/src/components/ui/useLayout';
import { HABIT_PROMPT } from '@/src/logic/drills';

export function PracticeScreen() {
  const { split, phone, tight } = useLayout();
  const game = usePracticeGame();
  const showFeedback = game.feedback != null && (game.tone === 'danger' || !game.gameOver);
  const showExtra = !(tight && showFeedback);
  const preMoveHang = !game.feedback && !game.status ? game.hangingNow[0] : undefined;

  return (
    <PlayFrame
      asideFirst={!split && showFeedback && game.tone !== 'danger'}
      intro={
        <BoardLead>
          <Text style={text.eyebrow}>Practice</Text>
          <Text style={[text.title, phone && text.titlePhone]}>Your game</Text>
          {showExtra ? <Text style={[text.habit, phone && text.habitPhone]}>{HABIT_PROMPT}</Text> : null}
          {showExtra ? (
            <Text style={[text.body, phone && text.bodyPhone]} numberOfLines={phone ? 2 : undefined}>
              You play White. Black answers. If you leave a piece hanging, they take it.
            </Text>
          ) : null}
          {showExtra ? <ColorLegend /> : null}
        </BoardLead>
      }
      board={
        <ChessBoard
          key={game.boardKey}
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
        <View style={play.stack}>
          {game.feedback && (game.tone === 'danger' || !game.gameOver) ? (
            <BlunderOverlay
              visible
              tone={game.tone}
              title={game.feedback.title}
              message={game.gameOver && game.resultLine ? `${game.panelMessage} ${game.resultLine}` : game.panelMessage}
              hint={game.feedback.bestMoveHint}
              actionLabel={game.tone === 'danger' ? 'Try again' : 'Continue'}
              onDismiss={game.tone === 'danger' ? game.tryAgain : game.dismissFeedback}
              actionTestID={game.tone === 'danger' ? 'try-again' : undefined}
              secondaryLabel={game.tone === 'danger' ? 'Continue' : undefined}
              onSecondary={game.tone === 'danger' ? game.dismissFeedback : undefined}
            />
          ) : game.gameOver ? (
            <View {...liveA11y()} style={play.guide}>
              <Text style={text.bodyStrong}>{game.resultLine}</Text>
              <Button label="New game" onPress={game.resetBoard} />
            </View>
          ) : game.status ? (
            <View {...liveA11y()} style={play.guide}>
              <Text style={[text.bodyStrong, phone && text.bodyPhone]}>{game.status}</Text>
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
          ) : null}
          {!game.gameOver ? <Button label="New game" variant="secondary" onPress={game.resetBoard} /> : null}
        </View>
      }
    />
  );
}
