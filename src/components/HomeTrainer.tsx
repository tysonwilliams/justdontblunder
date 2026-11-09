import { useRouter, type Href } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { BlunderOverlay } from '@/src/components/Board/BlunderOverlay';
import { ChessBoard } from '@/src/components/Board/ChessBoard';
import { HomeEntryCards } from '@/src/components/home/HomeEntryCards';
import { Welcome } from '@/src/components/home/Welcome';
import { homeEntryHref, useHomeTrainer, type HomeEntryId } from '@/src/components/home/useHomeTrainer';
import { StreakBadge } from '@/src/components/StreakBadge';
import { BoardLead } from '@/src/components/ui/BoardLead';
import { Button } from '@/src/components/ui/Button';
import { StatusPill } from '@/src/components/ui/Chip';
import { ColorLegend } from '@/src/components/ui/ColorLegend';
import { LineBox } from '@/src/components/ui/LineBox';
import { footFitsExtra } from '@/src/components/ui/phoneSlots';
import { PhoneTray } from '@/src/components/ui/PhoneTray';
import { PlayFrame } from '@/src/components/ui/PlayFrame';
import { play } from '@/src/components/ui/playStyles';
import { ProgressTrack } from '@/src/components/ui/ProgressTrack';
import { Bone, PlaySkeleton } from '@/src/components/ui/Skeleton';
import { forceSkeleton } from '@/src/components/ui/skeletonMode';
import { text } from '@/src/components/ui/text';
import { useLayout } from '@/src/components/ui/useLayout';
import { themeInstruction } from '@/src/logic/drills';
import { radii, spacing } from '@/src/theme';

export function HomeTrainer() {
  const router = useRouter();
  const { split, phone, slots } = useLayout();
  const trainer = useHomeTrainer();
  const drill = trainer.drill;

  const open = (id: HomeEntryId) => {
    router.push(homeEntryHref(id, trainer.learn.href) as Href);
  };

  if (forceSkeleton() || !drill) return <PlaySkeleton cards />;

  const showCards = !phone || (slots != null && footFitsExtra(slots.foot, 72));

  return (
    <View style={styles.stage}>
    <PlayFrame
      intro={
        <BoardLead>
          <View style={[styles.meta, phone && styles.metaPhone]}>
            <StatusPill>Daily trainer</StatusPill>
            <View style={play.metaRight}>
              <Text style={[text.meta, phone && text.metaPhone]} numberOfLines={1}>
                {trainer.index + 1} / {trainer.total}
              </Text>
              <StreakSlot phone={phone} hydrated={trainer.hydrated} streak={trainer.streak} />
            </View>
          </View>
          <LineBox height={phone ? 6 : 8}>
            <ProgressTrack progress={trainer.progress} />
          </LineBox>
          <LineBox height={phone ? 22 : 32}>
            <Text style={[text.title, phone && text.titlePhone]} numberOfLines={1}>
              Stop hanging pieces.
            </Text>
          </LineBox>
          <LineBox height={phone ? 18 : 22}>
            <Text style={[text.habit, phone && text.habitPhone]} numberOfLines={1}>
              {trainer.prompt}
            </Text>
          </LineBox>
          <LineBox height={phone ? 24 : 28}>
            <ColorLegend />
          </LineBox>
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
              <View style={[play.guide, phone && play.phoneCard]}>
                <Button
                  label="Start today's drill"
                  testID="start-drill"
                  onPress={() => router.push('/drills' as Href)}
                />
                <Text style={[text.muted, phone && text.mutedPhone]} numberOfLines={phone ? 1 : 2}>
                  {themeInstruction(drill.theme)}
                </Text>
              </View>
            )
          }
        />
      }
      footer={
        <HomeEntryCards
          learnBody={trainer.learn.body}
          drillFen={drill.fen}
          split={split}
          hidden={!showCards}
          onOpen={open}
        />
      }
    />
    <Welcome />
    </View>
  );
}

function StreakSlot({ phone, hydrated, streak }: { phone: boolean; hydrated: boolean; streak: number }) {
  const height = phone ? 22 : 36;
  let body = <Bone width={72} height={height} radius={radii.pill} />;
  if (hydrated && streak > 0) body = <StreakBadge streak={streak} celebrate compact={phone} />;
  if (hydrated && streak === 0) {
    body = (
      <Text style={[text.muted, phone && text.mutedPhone]} numberOfLines={1}>
        No streak yet
      </Text>
    );
  }
  return <View style={[styles.streak, { height }]}>{body}</View>;
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
    height: 24,
    minHeight: 24,
    overflow: 'hidden',
  },
  streak: {
    width: 132,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'flex-end',
    overflow: 'hidden',
  },
});
