import { Pressable, StyleSheet, Text, View } from 'react-native';

import { MiniBoard } from '@/src/components/Board/MiniBoard';
import type { HomeEntryId } from '@/src/components/home/useHomeTrainer';
import { controlA11y } from '@/src/components/ui/a11y';
import { IconBoard, IconDrill, IconTrain } from '@/src/components/ui/icons';
import { play } from '@/src/components/ui/playStyles';
import { ProgressTrack } from '@/src/components/ui/ProgressTrack';
import { useLayout } from '@/src/components/ui/useLayout';
import { LESSONS } from '@/src/logic/lessons';
import { useProgressStore } from '@/src/store/progress';
import { useTheme } from '@/src/theme/useTheme';
import { fontSizes, lineHeights, spacing } from '@/src/theme';

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

const ENTRY_CARDS: {
  id: HomeEntryId;
  title: string;
  body: string;
  Icon: typeof IconTrain;
}[] = [
  { id: 'learn', title: 'Learn', body: 'Save the piece. The idea is there if you want it.', Icon: IconTrain },
  { id: 'drills', title: 'Drills', body: 'One miss ends the run.', Icon: IconDrill },
  { id: 'practice', title: 'Practice', body: 'Play White. Black takes what you hang.', Icon: IconBoard },
];

export function HomeEntryCards({
  learnBody,
  drillFen,
  split,
  hidden,
  onOpen,
}: {
  learnBody: string;
  drillFen: string;
  split: boolean;
  hidden: boolean;
  onOpen: (id: HomeEntryId) => void;
}) {
  const completedLessons = useProgressStore((state) => state.completedLessons);
  const drillsCompleted = useProgressStore((state) => state.drillsCompleted);
  const drillsCorrect = useProgressStore((state) => state.drillsCorrect);
  const practiceMoves = useProgressStore((state) => state.practiceMoves);
  const saves = useProgressStore((state) => state.blundersAvoided);
  const learnFen = LESSONS[0]?.cards[0]?.fen ?? START_FEN;
  const progress = {
    learn: completedLessons.length / Math.max(1, LESSONS.length),
    drills: drillsCompleted > 0 ? drillsCorrect / drillsCompleted : 0,
    practice: practiceMoves > 0 ? Math.min(1, saves / practiceMoves) : 0,
  };
  const fens = { learn: learnFen, drills: drillFen, practice: START_FEN };

  if (hidden) return null;
  const mode = split ? 'stack' : 'row';
  return (
    <View style={mode === 'stack' ? styles.entryStack : styles.entryGrid}>
      {ENTRY_CARDS.map((item) => (
        <EntryCard
          key={item.id}
          item={item.id === 'learn' ? { ...item, body: learnBody } : item}
          fen={fens[item.id]}
          progress={progress[item.id]}
          mode={mode}
          onPress={() => onOpen(item.id)}
        />
      ))}
    </View>
  );
}

function EntryCard({
  item,
  fen,
  progress,
  onPress,
  mode,
}: {
  item: (typeof ENTRY_CARDS)[number];
  fen: string;
  progress: number;
  onPress: () => void;
  mode: 'stack' | 'row';
}) {
  const { phone } = useLayout();
  const { colors } = useTheme();
  const Icon = item.Icon;
  return (
    <Pressable
      {...controlA11y('button', item.title, false)}
      onPress={onPress}
      style={({ pressed }) => [
        play.card,
        phone ? styles.cardPhone : styles.cardDesk,
        mode === 'stack' && styles.entryFull,
        mode === 'row' && styles.entryCell,
        pressed && play.cardOn,
      ]}>
      {phone ? null : <MiniBoard fen={fen} size={64} />}
      <View style={styles.copy}>
        <View style={styles.titleRow}>
          {phone ? <MiniBoard fen={fen} size={22} /> : null}
          <Icon color={colors.accent} size={phone ? 13 : 18} />
          <Text style={[play.cardTitle, phone && styles.cardTitlePhone, styles.title]} numberOfLines={1}>
            {item.title}
          </Text>
        </View>
        <ProgressTrack progress={progress} />
        {phone ? null : (
          <Text style={play.cardBody} numberOfLines={2}>
            {item.body}
          </Text>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  cardPhone: {
    height: 64,
    minHeight: 64,
    flexDirection: 'column',
    alignItems: 'stretch',
    justifyContent: 'center',
    gap: spacing[2],
    paddingHorizontal: spacing[6],
    paddingVertical: spacing[6],
    overflow: 'hidden',
  },
  cardDesk: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 84,
  },
  copy: {
    flex: 1,
    minWidth: 0,
    gap: spacing[6],
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[4],
    minWidth: 0,
  },
  title: {
    flexShrink: 1,
  },
  cardTitlePhone: {
    fontSize: fontSizes[13],
    lineHeight: lineHeights[16],
  },
  entryStack: {
    width: '100%',
    gap: spacing.sm,
  },
  entryGrid: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: spacing.sm,
  },
  entryFull: {
    width: '100%',
    flexGrow: 0,
  },
  entryCell: {
    flex: 1,
    minWidth: 0,
  },
});
