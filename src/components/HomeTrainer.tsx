import { useRouter, type Href } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { BlunderOverlay } from '@/src/components/Board/BlunderOverlay';
import { ChessBoard } from '@/src/components/Board/ChessBoard';
import { Welcome } from '@/src/components/home/Welcome';
import { useHomeTrainer } from '@/src/components/home/useHomeTrainer';
import { MenuButton } from '@/src/components/SettingsMenu';
import { StreakBadge } from '@/src/components/StreakBadge';
import { DueTodayLink } from '@/src/components/review/DueTodayLink';
import { BoardLead } from '@/src/components/ui/BoardLead';
import { Button } from '@/src/components/ui/Button';
import { ColorLegend } from '@/src/components/ui/ColorLegend';
import { LineBox } from '@/src/components/ui/LineBox';
import { PhoneTray } from '@/src/components/ui/PhoneTray';
import { PlayFrame } from '@/src/components/ui/PlayFrame';
import { play } from '@/src/components/ui/playStyles';
import { ProgressTrack } from '@/src/components/ui/ProgressTrack';
import { PlaySkeleton } from '@/src/components/ui/Skeleton';
import { forceSkeleton } from '@/src/components/ui/skeletonMode';
import { PuzzleCount } from '@/src/components/ui/PuzzleCount';
import { text } from '@/src/components/ui/text';
import { useLayout } from '@/src/components/ui/useLayout';
import { themeInstruction } from '@/src/logic/drills';
import { spacing } from '@/src/theme';

export function HomeTrainer() {
  const router = useRouter();
  const { phone } = useLayout();
  const trainer = useHomeTrainer();
  const drill = trainer.drill;

  if (forceSkeleton() || !drill) return <PlaySkeleton />;

  return (
    <View style={styles.stage}>
      <PlayFrame
        intro={
          <BoardLead gap={phone ? spacing[6] : spacing[10]}>
            <View style={[styles.meta, phone && styles.metaPhone]}>
              <DueTodayLink variant="pill" />
              <View style={styles.metaRight}>
                {trainer.hydrated && trainer.streak > 0 ? (
                  <StreakBadge streak={trainer.streak} celebrate compact={phone} />
                ) : null}
                <ColorLegend compact={phone} />
                {phone ? <MenuButton compact /> : null}
              </View>
            </View>
            <LineBox height={phone ? 24 : 32}>
              <Text style={[text.title, phone && text.titlePhone]} numberOfLines={1}>
                Stop hanging pieces.
              </Text>
            </LineBox>
            <LineBox height={phone ? 18 : 22}>
              <Text style={[text.habit, phone && text.habitPhone]} numberOfLines={1}>
                {trainer.prompt}
              </Text>
            </LineBox>
            <View style={styles.progressRow}>
              <View style={play.progressGrow}>
                <ProgressTrack progress={trainer.progress} />
              </View>
              <PuzzleCount index={trainer.index} total={trainer.total} spaced={!phone} phone={phone} />
            </View>
          </BoardLead>
        }
        board={
          <ChessBoard
            key={`${drill.id}-${trainer.index}`}
            fen={trainer.boardFen}
            orientation={trainer.orientation}
            flipCue={trainer.orientation === 'black'}
            interactive={trainer.round === 'playing'}
            lastMove={trainer.boardLastMove}
            arrows={trainer.threatArrow}
            attentionSquares={trainer.attentionSquares}
            highlightSquares={trainer.marks.squares}
            highlightTone={trainer.marks.tone}
            onMove={trainer.onMove}
          />
        }
        aside={
          <PhoneTray
            banner={
              trainer.card ? (
                <BlunderOverlay
                  visible
                  tone={trainer.card.tone}
                  title={trainer.card.title}
                  message={trainer.roundCopy}
                  waiting={trainer.card.tone === 'danger' && !trainer.replyReady ? 'Watch the reply.' : undefined}
                  actionLabel={
                    trainer.card.tone === 'danger' ? (trainer.replyReady ? 'Try again' : undefined) : 'Next drill'
                  }
                  onDismiss={
                    trainer.card.tone === 'danger' ? (trainer.replyReady ? trainer.tryAgain : undefined) : trainer.next
                  }
                  actionTestID={trainer.card.tone === 'danger' ? 'try-again' : undefined}
                  secondaryLabel={trainer.card.tone === 'danger' && trainer.replyReady ? 'Next drill' : undefined}
                  onSecondary={trainer.card.tone === 'danger' && trainer.replyReady ? trainer.next : undefined}
                />
              ) : (
                <View style={[play.guide, phone && play.phoneCard, phone && styles.coachCard]}>
                  <Text
                    testID="home-coach"
                    style={[text.muted, phone && text.mutedPhone, styles.coachCopy]}
                    numberOfLines={phone ? 2 : undefined}>
                    {themeInstruction(drill.theme)}
                  </Text>
                  <Button
                    compact={phone}
                    variant="secondary"
                    label="Open all drills"
                    testID="start-drill"
                    onPress={() => router.push('/drills' as Href)}
                  />
                </View>
              )
            }
          />
        }
      />
      <Welcome />
    </View>
  );
}

const styles = StyleSheet.create({
  stage: {
    flex: 1,
    width: '100%',
    minHeight: 0,
  },
  meta: {
    width: '100%',
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  metaPhone: {
    height: 30,
    minHeight: 30,
    overflow: 'hidden',
  },
  metaRight: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: spacing[4],
    flexShrink: 0,
  },
  progressRow: {
    height: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  coachCard: {
    paddingVertical: spacing[4],
    gap: spacing[4],
    justifyContent: 'center',
  },
  coachCopy: {
    width: '100%',
  },
});
