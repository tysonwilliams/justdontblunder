import { useRouter, type Href } from 'expo-router';
import { Text, View } from 'react-native';

import { Button } from '@/src/components/ui/Button';
import { text } from '@/src/components/ui/text';
import { useProgressStore, type Experience } from '@/src/store/progress';
import { useHydrated } from '@/src/store/useHydrated';
import { useTheme } from '@/src/theme/useTheme';
import { themedStyleSheet } from '@/src/theme/themed';
import { radii, spacing } from '@/src/theme/tokens';

const CHOICES: readonly { id: Experience; label: string; href: Href }[] = [
  { id: 'new', label: "I'm brand new", href: '/learn' },
  { id: 'basics', label: 'I know the basics', href: '/drills' },
];

/** First-run choice. Sits over Home only, so other screens keep their board still. */
export function Welcome() {
  const router = useRouter();
  const { colors } = useTheme();
  const hydrated = useHydrated(useProgressStore.persist);
  const experience = useProgressStore((state) => state.experience);
  const welcomeSkipped = useProgressStore((state) => state.welcomeSkipped);
  const setExperience = useProgressStore((state) => state.setExperience);
  const skipWelcome = useProgressStore((state) => state.skipWelcome);

  if (!hydrated || experience || welcomeSkipped) return null;

  return (
    <View style={[styles.scrim, { backgroundColor: colors.overlay }]} testID="welcome">
      <View style={styles.card}>
        <Text style={text.eyebrow}>Welcome</Text>
        <Text style={text.title}>How much chess have you played?</Text>
        <Text style={text.body}>We'll start you in the right place. You can change this later in Progress.</Text>
        {CHOICES.map((choice) => (
          <Button
            key={choice.id}
            label={choice.label}
            variant={choice.id === 'new' ? 'primary' : 'secondary'}
            testID={`welcome-${choice.id}`}
            onPress={() => {
              setExperience(choice.id);
              router.push(choice.href);
            }}
          />
        ))}
        <Button label="Skip" variant="ghost" testID="welcome-skip" onPress={skipWelcome} />
      </View>
    </View>
  );
}

const styles = themedStyleSheet((colors) => ({
  scrim: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    zIndex: 30,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
}));
