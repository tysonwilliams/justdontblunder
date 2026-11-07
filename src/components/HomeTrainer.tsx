import { useRouter, type Href } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BlunderOverlay } from '@/src/components/Board/BlunderOverlay';
import { ChessBoard } from '@/src/components/Board/ChessBoard';
import { HomeEntryCards } from '@/src/components/home/HomeEntryCards';
import { homeEntryHref, useHomeTrainer, type HomeEntryId } from '@/src/components/home/useHomeTrainer';
import { StreakBadge } from '@/src/components/StreakBadge';
import { controlA11y } from '@/src/components/ui/a11y';
import { BoardLead } from '@/src/components/ui/BoardLead';
import { StatusPill } from '@/src/components/ui/Chip';
import { ColorLegend } from '@/src/components/ui/ColorLegend';
import { PlayFrame } from '@/src/components/ui/PlayFrame';
import { play } from '@/src/components/ui/playStyles';
import { ProgressTrack } from '@/src/components/ui/ProgressTrack';
import { text } from '@/src/components/ui/text';
import { useLayout } from '@/src/components/ui/useLayout';
import { themeInstruction } from '@/src/logic/drills';
import { fontSizes, lineHeights, spacing } from '@/src/theme';

const RESULT_LINKS: { id: HomeEntryId; label: string }[] = [
  { id: 'drills', label: 'Drills' },
  { id: 'learn', label: 'Learn' },
  { id: 'practice', label: 'Practice' },
];

export function HomeTrainer() {
  const router = useRouter();
  const { split, phone, tight } = useLayout();
  const trainer = useHomeTrainer();
  const drill = trainer.drill;

  const open = (id: HomeEntryId) => {
    router.push(homeEntryHref(id, trainer.learn.href) as Href);
  };

  if (!drill) return null;

  const feedback = trainer.round !== 'playing';
  const showExtra = !(tight && feedback);
  const showGuide = !tight;

  return (
    <PlayFrame
      asideFirst={!split && feedback && !trainer.watchingReply}
      intro={
        <BoardLead>
          <View style={play.metaRow}>
            <StatusPill>Daily trainer</StatusPill>
            <View style={play.metaRight}>
              <Text style={[text.meta, phone && text.metaPhone]}>
                {trainer.index + 1} / {trainer.total}
              </Text>
              {trainer.hydrated && trainer.streak > 0 ? (
                <StreakBadge streak={trainer.streak} celebrate compact={phone} />
              ) : trainer.hydrated ? (
                <Text style={[text.muted, phone && text.mutedPhone]}>No streak yet</Text>
              ) : (
                <View style={styles.streakSlot} />
              )}
            </View>
          </View>
          <ProgressTrack progress={trainer.progress} />
          <Text style={[text.title, phone && text.titlePhone]}>Stop hanging pieces.</Text>
          {showExtra ? <Text style={[text.habit, phone && text.habitPhone]}>{trainer.prompt}</Text> : null}
          {showExtra ? <ColorLegend /> : null}
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
        trainer.card ? (
          <View style={play.stack}>
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
            {showExtra ? (
              <View style={play.linkRow}>
                {RESULT_LINKS.map((item) => (
                  <Pressable
                    key={item.id}
                    {...controlA11y('button', item.label, false)}
                    onPress={() => open(item.id)}
                    style={[play.link, phone && styles.linkPhone]}>
                    <Text style={[play.linkText, phone && styles.linkTextPhone]}>{item.label}</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
          </View>
        ) : showGuide ? (
          <View style={[play.guide, phone && styles.guidePhone]}>
            {drill.theme === 'hanging' ? (
              <Text style={[text.body, phone && text.bodyPhone]}>{drill.prompt}</Text>
            ) : null}
            <Text style={[drill.theme === 'hanging' ? text.muted : text.body, phone && text.mutedPhone]}>
              {themeInstruction(drill.theme)}
            </Text>
          </View>
        ) : null
      }
      footer={<HomeEntryCards learnBody={trainer.learn.body} split={split} hidden={tight && feedback} onOpen={open} />}
    />
  );
}

const styles = StyleSheet.create({
  streakSlot: {
    minWidth: 72,
    minHeight: 22,
  },
  guidePhone: {
    padding: spacing.sm,
    gap: spacing.xs,
  },
  linkPhone: {
    minHeight: 32,
    paddingHorizontal: spacing[10],
  },
  linkTextPhone: {
    fontSize: fontSizes[13],
    lineHeight: lineHeights[16],
  },
});
