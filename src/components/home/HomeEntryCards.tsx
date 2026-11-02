import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { HomeEntryId } from '@/src/components/home/useHomeTrainer';
import { controlA11y } from '@/src/components/ui/a11y';
import { play } from '@/src/components/ui/playStyles';
import { useLayout } from '@/src/components/ui/useLayout';
import { fontSizes, lineHeights, spacing } from '@/src/theme';

const ENTRY_CARDS: { id: HomeEntryId; title: string; body: string }[] = [
  { id: 'learn', title: 'Learn', body: 'Save the piece. The idea is there if you want it.' },
  { id: 'drills', title: 'Drills', body: 'One miss ends the run.' },
  { id: 'practice', title: 'Practice', body: 'Play White. Black takes what you hang.' },
];

export function HomeEntryCards({
  learnBody,
  split,
  hidden,
  onOpen,
}: {
  learnBody: string;
  split: boolean;
  hidden: boolean;
  onOpen: (id: HomeEntryId) => void;
}) {
  if (hidden) return null;
  const mode = split ? 'stack' : 'row';
  return (
    <View style={mode === 'stack' ? styles.entryStack : styles.entryGrid}>
      {ENTRY_CARDS.map((item) => (
        <EntryCard
          key={item.id}
          item={item.id === 'learn' ? { ...item, body: learnBody } : item}
          mode={mode}
          onPress={() => onOpen(item.id)}
        />
      ))}
    </View>
  );
}

function EntryCard({
  item,
  onPress,
  mode,
}: {
  item: (typeof ENTRY_CARDS)[number];
  onPress: () => void;
  mode: 'stack' | 'row';
}) {
  const { phone } = useLayout();
  return (
    <Pressable
      {...controlA11y('button', item.title, false)}
      onPress={onPress}
      style={({ pressed }) => [
        play.card,
        phone && styles.cardPhone,
        mode === 'stack' && styles.entryFull,
        mode === 'row' && styles.entryCell,
        pressed && play.cardOn,
      ]}>
      <Text style={[play.cardTitle, phone && styles.cardTitlePhone]} numberOfLines={1}>
        {item.title}
      </Text>
      <Text style={[play.cardBody, phone && styles.cardBodyPhone]} numberOfLines={3}>
        {item.body}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  cardPhone: {
    minHeight: 0,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  cardTitlePhone: {
    fontSize: fontSizes[13],
    lineHeight: lineHeights[16],
  },
  cardBodyPhone: {
    marginTop: spacing.xxs,
    fontSize: fontSizes[11],
    lineHeight: lineHeights[14],
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
