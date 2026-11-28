import { useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { ChessAccountForm } from '@/src/components/chess/ChessAccountForm';
import { controlA11y } from '@/src/components/ui/a11y';
import { Button } from '@/src/components/ui/Button';
import { IconX } from '@/src/components/ui/icons';
import { Sheet } from '@/src/components/ui/Sheet';
import { useLayout } from '@/src/components/ui/useLayout';
import { useProgressStore } from '@/src/store/progress';
import { useHydrated } from '@/src/store/useHydrated';
import { themedStyleSheet } from '@/src/theme/themed';
import { useTheme } from '@/src/theme/useTheme';
import { fonts, fontSizes, lineHeights, radii, spacing } from '@/src/theme';

let sessionDismissed = false;

export function resetDrillsNudgeForTests(): void {
  sessionDismissed = false;
}

type Props = {
  /** Compact strip on phone below the fixed 88px feedback tray; fuller calm card on desktop or end-of-set screens. */
  compact?: boolean;
};

/**
 * Gentle, non-blocking nudge on Drills inviting players to import their own recent
 * Chess.com or Lichess blunders when they haven't connected an account yet.
 */
export function DrillsImportNudge({ compact = false }: Props) {
  const router = useRouter();
  const { colors } = useTheme();
  const { tight } = useLayout();
  const hydrated = useHydrated(useProgressStore.persist);
  const profile = useProgressStore((state) => state.gameProfile);
  const ownCount = useProgressStore((state) => state.ownDrills.length);
  const [dismissed, setDismissed] = useState(sessionDismissed);
  const [sheetOpen, setSheetOpen] = useState(false);

  const shouldHide = !hydrated || profile != null || ownCount > 0 || dismissed;
  // Keep compact phone screens with very short heights strictly single-screen with zero overflow.
  if (shouldHide && !sheetOpen) return null;
  if (compact && tight && !sheetOpen) return null;

  const dismiss = () => {
    sessionDismissed = true;
    setDismissed(true);
  };

  return (
    <>
      {!shouldHide ? (
        compact ? (
          <View style={styles.pillBar} testID="drills-import-nudge">
            <Pressable
              {...controlA11y('button', 'Pull your recent Chess.com or Lichess blunders')}
              testID="drills-import-nudge-open"
              onPress={() => setSheetOpen(true)}
              style={(state) => {
                const hovered = 'hovered' in state && Boolean(state.hovered);
                return [styles.pillMain, (hovered || state.pressed) && styles.pillHover];
              }}>
              <Text style={styles.pillText} numberOfLines={1}>
                Train on your own blunders · <Text style={styles.pillAccent}>Chess.com / Lichess</Text>
              </Text>
            </Pressable>
            <Pressable
              {...controlA11y('button', 'Dismiss game import suggestion')}
              testID="drills-import-nudge-dismiss"
              hitSlop={spacing.xs}
              onPress={dismiss}
              style={(state) => [styles.dismissBtn, state.pressed && styles.dismissPressed]}>
              <IconX color={colors.textDim} size={14} />
            </Pressable>
          </View>
        ) : (
          <View style={styles.card} testID="drills-import-nudge">
            <View style={styles.cardTop}>
              <Text style={styles.cardTitle}>Practice your own blunders</Text>
              <Pressable
                {...controlA11y('button', 'Dismiss game import suggestion')}
                testID="drills-import-nudge-dismiss"
                hitSlop={spacing.xs}
                onPress={dismiss}
                style={(state) => [styles.dismissBtn, state.pressed && styles.dismissPressed]}>
                <IconX color={colors.textDim} size={15} />
              </Pressable>
            </View>
            <Text style={styles.cardBody}>
              Pull recent mistakes from your public Chess.com or Lichess games — no password needed.
            </Text>
            <Button
              compact
              variant="secondary"
              label="Connect Chess.com / Lichess"
              testID="drills-import-nudge-open"
              onPress={() => setSheetOpen(true)}
            />
          </View>
        )
      ) : null}

      <Sheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title="Pull your recent blunders"
        subtitle="Public Chess.com or Lichess games only. No password."
        testID="drills-import-sheet">
        <ChessAccountForm
          testIDPrefix="drills-connect"
          drillLabel="Back to drills"
          onDrill={() => setSheetOpen(false)}
          onOpenPgn={() => {
            setSheetOpen(false);
            router.push('/progress' as Href);
          }}
        />
      </Sheet>
    </>
  );
}

const styles = themedStyleSheet((colors) => ({
  card: {
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing[12],
    gap: spacing[8],
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.xs,
  },
  cardTitle: {
    flex: 1,
    minWidth: 0,
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes[14],
    lineHeight: lineHeights[18],
    color: colors.text,
  },
  cardBody: {
    fontFamily: fonts.body,
    fontSize: fontSizes[13],
    lineHeight: lineHeights[18],
    color: colors.textMuted,
  },
  pillBar: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingLeft: spacing[10],
    paddingRight: spacing[4],
    minHeight: 34,
    gap: spacing[4],
  },
  pillMain: {
    flex: 1,
    minWidth: 0,
    paddingVertical: spacing[6],
    cursor: 'pointer',
  },
  pillHover: {
    opacity: 0.85,
  },
  pillText: {
    fontFamily: fonts.body,
    fontSize: fontSizes[12],
    lineHeight: lineHeights[16],
    color: colors.textMuted,
  },
  pillAccent: {
    fontFamily: fonts.bodyBold,
    color: colors.accent,
  },
  dismissBtn: {
    width: 26,
    height: 26,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
  dismissPressed: {
    opacity: 0.65,
  },
}));
