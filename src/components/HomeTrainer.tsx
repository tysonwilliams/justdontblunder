import { useRouter, type Href } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { BlunderOverlay } from '@/src/components/Board/BlunderOverlay';
import { ChessBoard } from '@/src/components/Board/ChessBoard';
import { HomeEntryCards } from '@/src/components/home/HomeEntryCards';
import { homeEntryHref, useHomeTrainer, type HomeEntryId } from '@/src/components/home/useHomeTrainer';
import { StreakBadge } from '@/src/components/StreakBadge';
import { BoardLead } from '@/src/components/ui/BoardLead';
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

  if (forceSkeleton()) return <PlaySkeleton cards />;
  if (!drill) return null;

  const showCards = !phone || (slots != null && footFitsExtra(slots.foot, 72));

  return (
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
                  trainer.card.tone === 'danger' ? (trainer.replyReady ? 'Try again' : undefined) : 'Next puzzle'
                }
                onDismiss={
                  trainer.card.tone === 'danger' ? (trainer.replyReady ? trainer.tryAgain : undefined) : trainer.next
                }
                actionTestID={trainer.card.tone === 'danger' ? 'try-again' : undefined}
                secondaryLabel={trainer.card.tone === 'danger' && trainer.replyReady ? 'Next puzzle' : undefined}
                onSecondary={trainer.card.tone === 'danger' && trainer.replyReady ? trainer.next : undefined}
              />
            ) : (
              <View style={[play.guide, phone && play.phoneCard]}>
                {drill.theme === 'hanging' ? (
                  <Text style={[text.body, phone && text.bodyPhone]} numberOfLines={phone ? 2 : undefined}>
                    {drill.prompt}
                  </Text>
                ) : null}
                <Text
                  style={[drill.theme === 'hanging' ? text.muted : text.body, phone && text.mutedPhone]}
                  numberOfLines={phone ? 2 : undefined}>
                  {themeInstruction(drill.theme)}
                </Text>
              </View>
            )
          }
        />
      }
      footer={<HomeEntryCards learnBody={trainer.learn.body} split={split} hidden={!showCards} onOpen={open} />}
    />
  );
}

function StreakSlot({ phone, hydrated, streak }: { phone: boolean; hydrated: boolean; streak: number }) {
  const height = phone ? 22 : 36;
  return (
    <View style={[styles.streak, { height }]}>
      <View style={[styles.streakLayer, { opacity: hydrated ? 0 : 1 }]} pointerEvents="none">
        <Bone width={72} height={height} radius={radii.pill} />
      </View>
      <View style={[styles.streakLayer, { opacity: hydrated && streak > 0 ? 1 : 0 }]} pointerEvents="none">
        <StreakBadge streak={streak} celebrate={hydrated && streak > 0} compact={phone} />
      </View>
      <View style={[styles.streakLayer, { opacity: hydrated && streak === 0 ? 1 : 0 }]} pointerEvents="none">
        <Text style={[text.muted, phone && text.mutedPhone]} numberOfLines={1}>
          No streak yet
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
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
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  streakLayer: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
});
