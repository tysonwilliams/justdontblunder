import { useRouter, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';

import { Button } from '@/src/components/ui/Button';
import { text } from '@/src/components/ui/text';
import { reachedAccountMilestone } from '@/src/auth/milestone';
import { accountPromptDismissed, dismissAccountPrompt } from '@/src/auth/promptDismissal';
import { useAccountStore } from '@/src/auth/session';
import { useProgressStore } from '@/src/store/progress';
import { useHydrated } from '@/src/store/useHydrated';
import { useTheme } from '@/src/theme/useTheme';
import { themedStyleSheet } from '@/src/theme/themed';
import { radii, spacing } from '@/src/theme';

/**
 * Inline note on Progress after a streak or a saved drill.
 * It is not a dialog, and it is not mounted on a board screen.
 */
export function AccountPrompt() {
  const router = useRouter();
  useTheme();
  const phase = useAccountStore((state) => state.phase);
  const configured = useAccountStore((state) => state.configured);
  const dailyStreak = useProgressStore((state) => state.dailyStreak);
  const recordStreak = useProgressStore((state) => state.recordStreak);
  const savedDrills = useProgressStore((state) => state.ownDrills.length);
  const progressReady = useHydrated(useProgressStore.persist);
  const [dismissed, setDismissed] = useState<boolean | null>(null);

  useEffect(() => {
    let live = true;
    void accountPromptDismissed().then((value) => {
      if (live) setDismissed(value);
    });
    return () => {
      live = false;
    };
  }, []);

  if (!progressReady || dismissed !== false || phase !== 'guest' || !configured) return null;
  if (!reachedAccountMilestone({ dailyStreak, recordStreak, savedDrills })) return null;

  return (
    <View style={styles.card} testID="account-prompt">
      <Text style={text.body}>
        This progress is on this device. Sign in if you want it on another browser. Play stays open either way.
      </Text>
      <View style={styles.actions}>
        <Button
          label="Sign in"
          variant="secondary"
          fullWidth={false}
          testID="account-prompt-sign-in"
          onPress={() => router.push('/account' as Href)}
        />
        <Button
          label="Not now"
          variant="ghost"
          fullWidth={false}
          testID="account-prompt-dismiss"
          onPress={() => {
            void dismissAccountPrompt().then(() => setDismissed(true));
          }}
        />
      </View>
    </View>
  );
}

const styles = themedStyleSheet((colors) => ({
  card: {
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing[12],
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
}));
