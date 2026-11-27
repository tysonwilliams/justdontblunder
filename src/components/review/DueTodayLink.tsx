import { useRouter, type Href } from 'expo-router';
import { Pressable, StyleSheet, Text } from 'react-native';

import { controlA11y } from '@/src/components/ui/a11y';
import { StatusPill } from '@/src/components/ui/Chip';
import { text } from '@/src/components/ui/text';
import { drillHref } from '@/src/logic/drillLink';
import { dueTodayCount, dueTodayLabel } from '@/src/logic/reviewSchedule';
import { useProgressStore } from '@/src/store/progress';
import { useHydrated } from '@/src/store/useHydrated';

import { spacing } from '@/src/theme';

/** Due count for Home and Practice. The phone lead stays a fixed height, so this replaces a line that is already there. */
export function DueTodayLink({ variant }: { variant: 'pill' | 'line' }) {
  const router = useRouter();
  const hydrated = useHydrated(useProgressStore.persist);
  const review = useProgressStore((state) => state.review);
  const due = hydrated ? dueTodayCount(review) : 0;
  const label = hydrated ? dueTodayLabel(due) : 'Due today';
  const open = () => {
    router.push(drillHref('review') as Href);
  };
  if (variant === 'pill') {
    return (
      <StatusPill onPress={open} testID="due-today" label={label} active={due > 0} shrink>
        {label}
      </StatusPill>
    );
  }
  return (
    <Pressable
      {...controlA11y('button', label)}
      testID="due-today"
      hitSlop={spacing.sm}
      onPress={open}
      style={(state) => [styles.line, state.pressed && styles.pressed]}>
      <Text style={text.eyebrow} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  line: {
    alignSelf: 'center',
    maxWidth: '100%',
    minWidth: 0,
    padding: 0,
    cursor: 'pointer',
  },
  pressed: {
    opacity: 0.72,
  },
});
