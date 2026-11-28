import { useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';

import { PIECE_CREDIT } from '@/src/components/Board/pieceCredit';
import { ChessAccountForm } from '@/src/components/chess/ChessAccountForm';
import { BrandMark } from '@/src/components/ui/BrandMark';
import { controlA11y } from '@/src/components/ui/a11y';
import { Button } from '@/src/components/ui/Button';
import { SegmentedControl } from '@/src/components/ui/Chip';
import { Dialog } from '@/src/components/ui/Dialog';
import { IconMenu } from '@/src/components/ui/icons';
import { useMenuStore } from '@/src/components/ui/menuState';
import { SettingSwitch } from '@/src/components/ui/SettingSwitch';
import { Sheet } from '@/src/components/ui/Sheet';
import { text } from '@/src/components/ui/text';
import { signOutBeforeDeviceErase } from '@/src/auth/deviceSession';
import { signOutCurrentAccount, useAccountStore } from '@/src/auth/session';
import { authFrom } from '@/src/auth/supabaseAuth';
import { getSupabase } from '@/src/data/supabase';
import { playFeedback } from '@/src/feedback/playFeedback';
import { clearOnboardingClaim } from '@/src/logic/onboardingPrompt';
import { eraseDeviceData } from '@/src/store/eraseDeviceData';
import { useFeedbackSettings } from '@/src/store/feedbackSettings';
import { useProgressStore, type Experience } from '@/src/store/progress';
import { useThemePreference } from '@/src/store/themePreference';
import type { ThemePreference } from '@/src/theme/preference';
import { useTheme } from '@/src/theme/useTheme';
import { themedStyleSheet } from '@/src/theme/themed';
import {
  BOARD_THEMES,
  boardThemeSwatches,
  fonts,
  fontSizes,
  letterSpacing,
  lineHeights,
  radii,
  spacing,
} from '@/src/theme';

const APPEARANCE: readonly { id: ThemePreference; label: string; testID: string }[] = [
  { id: 'system', label: 'System', testID: 'theme-system' },
  { id: 'light', label: 'Light', testID: 'theme-light' },
  { id: 'dark', label: 'Dark', testID: 'theme-dark' },
];

const START: readonly { id: Experience; label: string; testID: string }[] = [
  { id: 'new', label: 'Brand new', testID: 'experience-new' },
  { id: 'basics', label: 'Basics', testID: 'experience-basics' },
  { id: 'intermediate', label: 'Club 1000+', testID: 'experience-intermediate' },
];

const SIGN_OUT_FAILED = 'Could not sign out. Try again.';

export function MenuButton({ compact = false }: { compact?: boolean }) {
  const { colors } = useTheme();
  const openMenu = useMenuStore((state) => state.openMenu);
  return (
    <Pressable
      {...controlA11y('button', 'Menu')}
      testID="open-menu"
      hitSlop={spacing.xs}
      onPress={openMenu}
      style={(state) => {
        const hovered = 'hovered' in state && Boolean(state.hovered);
        return [
          styles.trigger,
          compact && styles.triggerCompact,
          (hovered || state.pressed) && styles.triggerHover,
          state.pressed && styles.pressed,
        ];
      }}>
      <IconMenu color={colors.textMuted} size={compact ? 18 : 20} />
    </Pressable>
  );
}

export function SettingsMenu() {
  const router = useRouter();
  useTheme();
  const open = useMenuStore((state) => state.open);
  const closeMenu = useMenuStore((state) => state.closeMenu);
  const preference = useThemePreference((state) => state.preference);
  const setPreference = useThemePreference((state) => state.setPreference);
  const boardTheme = useThemePreference((state) => state.boardTheme);
  const setBoardTheme = useThemePreference((state) => state.setBoardTheme);
  const sound = useFeedbackSettings((state) => state.sound);
  const setSound = useFeedbackSettings((state) => state.setSound);
  const haptics = useFeedbackSettings((state) => state.haptics);
  const setHaptics = useFeedbackSettings((state) => state.setHaptics);
  const experience = useProgressStore((state) => state.experience);
  const setExperience = useProgressStore((state) => state.setExperience);
  const phase = useAccountStore((state) => state.phase);
  const configured = useAccountStore((state) => state.configured);
  const accountLabel = useAccountStore((state) => state.user?.label ?? null);
  const [accountStatus, setAccountStatus] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  const navigate = (href: Href) => {
    closeMenu();
    router.push(href);
  };

  return (
    <>
      <Sheet visible={open} onClose={closeMenu} title="Settings" variant="drawer" testID="settings-menu">
        <View style={styles.section}>
          <Text style={text.section}>Your chess games</Text>
          <Text style={styles.note}>
            Pull recent blunders from your public Chess.com or Lichess games into Drills and Review. No password.
          </Text>
          <ChessAccountForm
            testIDPrefix="settings-chess"
            onDrill={() => navigate('/drills' as Href)}
            onOpenPgn={() => navigate('/progress' as Href)}
          />
        </View>

        <View style={styles.section}>
          <Text style={text.section}>Account</Text>
          {phase === 'signed-in' && accountLabel ? (
            <View style={styles.accountBox}>
              <Text style={styles.accountLabel} testID="progress-account" numberOfLines={1}>
                {accountLabel}
              </Text>
              <Text style={styles.note}>Progress syncs while you are signed in.</Text>
              <Button
                compact
                label="Sign out"
                variant="secondary"
                fullWidth={false}
                testID="progress-sign-out"
                onPress={() => {
                  void signOutCurrentAccount().then((result) => {
                    if (result === 'failed') setAccountStatus(SIGN_OUT_FAILED);
                  });
                }}
              />
              {accountStatus ? <Text style={text.muted}>{accountStatus}</Text> : null}
            </View>
          ) : phase === 'guest' && configured ? (
            <View style={styles.accountBox}>
              <Text style={styles.note}>Stored on this device. Sign in to sync across browsers.</Text>
              <Button
                compact
                label="Sign in"
                variant="secondary"
                fullWidth={false}
                testID="progress-sign-in"
                onPress={() => navigate('/account' as Href)}
              />
            </View>
          ) : (
            <Text style={styles.note}>Stored on this device. Play stays open with no account.</Text>
          )}
        </View>

        <View style={styles.section}>
          <Text style={text.section}>Appearance & feedback</Text>
          <SegmentedControl
            height={36}
            options={APPEARANCE}
            value={preference}
            onChange={setPreference}
          />
          <View style={styles.boardRow}>
            {BOARD_THEMES.map((id) => {
              const swatch = boardThemeSwatches[id];
              const active = boardTheme === id;
              return (
                <Pressable
                  key={id}
                  {...controlA11y('button', `${swatch.label} board theme`, active)}
                  testID={`board-theme-${id}`}
                  onPress={() => setBoardTheme(id)}
                  style={(state) => {
                    const hovered = 'hovered' in state && Boolean(state.hovered);
                    return [
                      styles.boardTile,
                      active && styles.boardTileOn,
                      (hovered || state.pressed) && !active && styles.boardTileHover,
                    ];
                  }}>
                  <View style={styles.swatchGrid}>
                    <View style={styles.swatchRow}>
                      <View style={[styles.swatchSq, { backgroundColor: swatch.light }]} />
                      <View style={[styles.swatchSq, { backgroundColor: swatch.dark }]} />
                    </View>
                    <View style={styles.swatchRow}>
                      <View style={[styles.swatchSq, { backgroundColor: swatch.dark }]} />
                      <View style={[styles.swatchSq, { backgroundColor: swatch.light }]} />
                    </View>
                  </View>
                  <Text style={[styles.boardLabel, active && styles.boardLabelOn]} numberOfLines={1}>
                    {swatch.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <View style={styles.list}>
            <SettingSwitch
              plain
              label="Sound"
              value={sound}
              testID="setting-sound"
              onChange={(next) => {
                setSound(next);
                if (next) playFeedback('save');
              }}
            />
            {Platform.OS !== 'web' ? (
              <>
                <View style={styles.divider} />
                <SettingSwitch
                  plain
                  label="Haptics"
                  value={haptics}
                  testID="setting-haptics"
                  onChange={(next) => {
                    setHaptics(next);
                    if (next) playFeedback('pickup');
                  }}
                />
              </>
            ) : null}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={text.section}>Starting level</Text>
          <SegmentedControl
            height={36}
            options={START}
            value={experience ?? 'basics'}
            onChange={setExperience}
          />
          <Text style={styles.note}>
            {experience === 'intermediate'
              ? 'Unprompted scanning on drills (no highlighted danger square until you ask for a hint) and a stronger practice opponent.'
              : experience === 'new'
                ? 'Guided prompts, danger highlights, and a gentler practice opponent.'
                : 'Guided prompts, danger highlights, and a club-beginner practice opponent.'}
          </Text>
          <MenuRow
            label="Show welcome again"
            testID="show-welcome"
            onPress={() => {
              clearOnboardingClaim();
              setExperience(null);
              navigate('/' as Href);
            }}
          />
        </View>

        <View style={styles.section}>
          <Text style={text.section}>Privacy & data</Text>
          <View style={styles.list}>
            <MenuRow label="Privacy policy" testID="progress-privacy" onPress={() => navigate('/privacy' as Href)} />
            <View style={styles.divider} />
            <MenuRow label="Terms of service" testID="menu-terms" onPress={() => navigate('/terms' as Href)} />
            <View style={styles.divider} />
            <MenuRow label="Delete data" testID="progress-delete" onPress={() => navigate('/delete-account' as Href)} />
            <View style={styles.divider} />
            <MenuRow
              label="Reset local progress"
              tone="danger"
              testID="menu-reset"
              onPress={() => {
                closeMenu();
                setConfirmReset(true);
              }}
            />
          </View>
        </View>

        <View style={styles.brandFooter}>
          <View style={styles.brandRow}>
            <BrandMark size={24} />
            <Text style={styles.brandName}>Just Don't Blunder</Text>
          </View>
          <Text style={styles.credit}>{PIECE_CREDIT}</Text>
        </View>
      </Sheet>

      <Dialog visible={confirmReset} onClose={() => setConfirmReset(false)}>
        <Text style={styles.dialogTitle}>Reset progress?</Text>
        <Text style={styles.dialogBody}>
          Streaks, XP, lessons, drill results, and saved positions on this device will go back to zero.
        </Text>
        <Button
          label="Reset"
          variant="danger"
          onPress={() => {
            void (async () => {
              const client = getSupabase();
              const ready = await signOutBeforeDeviceErase(client ? authFrom(client) : null);
              if (ready === 'failed') {
                setAccountStatus(SIGN_OUT_FAILED);
                setConfirmReset(false);
                return;
              }
              await eraseDeviceData();
              setConfirmReset(false);
            })();
          }}
        />
        <Button label="Cancel" variant="ghost" onPress={() => setConfirmReset(false)} />
      </Dialog>
    </>
  );
}

function MenuRow({
  label,
  onPress,
  testID,
  tone = 'default',
}: {
  label: string;
  onPress: () => void;
  testID?: string;
  tone?: 'default' | 'danger';
}) {
  return (
    <Pressable
      {...controlA11y('button', label)}
      testID={testID}
      onPress={onPress}
      style={(state) => {
        const hovered = 'hovered' in state && Boolean(state.hovered);
        return [styles.row, (hovered || state.pressed) && styles.rowHover];
      }}>
      <Text style={[styles.rowLabel, tone === 'danger' && styles.rowDanger]}>{label}</Text>
    </Pressable>
  );
}

const styles = themedStyleSheet((colors) => ({
  trigger: {
    width: 38,
    height: 38,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
  triggerCompact: {
    width: 30,
    height: 30,
  },
  triggerHover: {
    backgroundColor: colors.hover,
  },
  pressed: {
    opacity: 0.78,
  },
  section: {
    gap: spacing[10],
  },
  boardRow: {
    flexDirection: 'row',
    gap: spacing[8],
  },
  boardTile: {
    flex: 1,
    alignItems: 'center',
    gap: spacing[5],
    paddingVertical: spacing[8],
    paddingHorizontal: spacing[4],
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    cursor: 'pointer',
  },
  boardTileOn: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
  },
  boardTileHover: {
    backgroundColor: colors.surfaceRaised,
    borderColor: colors.borderStrong,
  },
  swatchGrid: {
    width: 28,
    height: 28,
    borderRadius: radii.swatch,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  swatchRow: {
    flexDirection: 'row',
    flex: 1,
  },
  swatchSq: {
    flex: 1,
  },
  boardLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes[11],
    lineHeight: lineHeights[14],
    color: colors.textMuted,
  },
  boardLabelOn: {
    color: colors.accent,
  },
  accountBox: {
    gap: spacing.sm,
    backgroundColor: colors.background,
    borderRadius: radii.md,
    padding: spacing[12],
  },
  accountLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes[15],
    lineHeight: lineHeights[20],
    color: colors.text,
  },
  note: {
    fontFamily: fonts.body,
    fontSize: fontSizes[13],
    lineHeight: lineHeights[18],
    color: colors.textMuted,
  },
  list: {
    gap: spacing[2],
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
  },
  row: {
    minHeight: 42,
    justifyContent: 'center',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing[4],
    borderRadius: radii.sm,
    cursor: 'pointer',
  },
  rowHover: {
    backgroundColor: colors.hover,
  },
  rowLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes[15],
    lineHeight: lineHeights[20],
    color: colors.text,
  },
  rowDanger: {
    color: colors.danger,
  },
  brandFooter: {
    gap: spacing[6],
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingTop: spacing.xs,
  },
  brandName: {
    fontFamily: fonts.display,
    fontSize: fontSizes[14],
    lineHeight: lineHeights[18],
    letterSpacing: letterSpacing.tight,
    color: colors.text,
  },
  credit: {
    fontFamily: fonts.body,
    fontSize: fontSizes[12],
    lineHeight: lineHeights[16],
    color: colors.textDim,
  },
  dialogTitle: {
    fontFamily: fonts.display,
    fontSize: fontSizes[24],
    lineHeight: lineHeights[30],
    color: colors.text,
    textAlign: 'center',
    letterSpacing: letterSpacing.tight,
  },
  dialogBody: {
    fontFamily: fonts.body,
    fontSize: fontSizes[15],
    lineHeight: lineHeights[22],
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
}));
