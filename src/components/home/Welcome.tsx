import { Link, useRouter, type Href } from 'expo-router';
import { Modal, Text, View } from 'react-native';

import { BrandMark } from '@/src/components/ui/BrandMark';
import { Button } from '@/src/components/ui/Button';
import { text } from '@/src/components/ui/text';
import { useKeyboardShortcuts } from '@/src/components/ui/useKeyboardShortcuts';
import { accountsConfigured } from '@/src/auth/session';
import { claimOnboarding, shouldOfferWelcome } from '@/src/logic/onboardingPrompt';
import { useProgressStore, type Experience } from '@/src/store/progress';
import { useHydrated } from '@/src/store/useHydrated';
import { useTheme } from '@/src/theme/useTheme';
import { themedStyleSheet } from '@/src/theme/themed';
import { fonts, fontSizes, layout, lineHeights, radii, shadows, spacing } from '@/src/theme/tokens';

const CHOICES: readonly { id: Experience; label: string; href: Href }[] = [
  { id: 'new', label: "I'm brand new", href: '/learn' },
  { id: 'basics', label: 'I know the basics', href: '/drills' },
  { id: 'intermediate', label: 'Club player (1000+ · no hints)', href: '/drills' },
];

/** First-run choice. Sits over Home in a viewport-centered Modal so desktop nav rail does not shift it off-center. */
export function Welcome() {
  const router = useRouter();
  const { colors } = useTheme();
  const hydrated = useHydrated(useProgressStore.persist);
  const experience = useProgressStore((state) => state.experience);
  const welcomeSkipped = useProgressStore((state) => state.welcomeSkipped);
  const setExperience = useProgressStore((state) => state.setExperience);
  const skipWelcome = useProgressStore((state) => state.skipWelcome);

  const visible = shouldOfferWelcome({ hydrated, experience, welcomeSkipped }) && claimOnboarding('welcome');
  useKeyboardShortcuts({ Escape: skipWelcome }, visible);

  if (!visible) return null;

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={skipWelcome}>
      <View style={[styles.scrim, { backgroundColor: colors.overlay }]} testID="welcome">
        <View style={styles.card}>
          <View style={styles.brandRow}>
            <BrandMark size={30} />
            <Text style={text.eyebrow}>Just Don't Blunder</Text>
          </View>
          <Text style={text.title}>How much chess have you played?</Text>
          <Text style={text.body}>We'll start you in the right place. You can change this anytime in Settings.</Text>
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
          {accountsConfigured() ? (
            <Link href={'/account' as Href} testID="welcome-sign-in" style={styles.link}>
              <Text style={styles.linkText}>Have an account? Sign in</Text>
            </Link>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = themedStyleSheet((colors) => ({
  scrim: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: layout.gutter,
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
    ...shadows.dialog,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[10],
  },
  link: {
    alignSelf: 'center',
    paddingVertical: spacing[2],
    cursor: 'pointer',
  },
  linkText: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes[15],
    lineHeight: lineHeights[22],
    color: colors.accent,
    textAlign: 'center',
  },
}));
