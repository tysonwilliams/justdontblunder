import { useEffect } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { useReducedMotion } from '@/src/components/Board/useReducedMotion';
import { controlA11y, liveA11y } from '@/src/components/ui/a11y';
import { Button } from '@/src/components/ui/Button';
import { IconBookmark, IconCheck, IconInfo, IconX } from '@/src/components/ui/icons';
import { PHONE_BANNER } from '@/src/components/ui/phoneSlots';
import { text } from '@/src/components/ui/text';
import { useLayout } from '@/src/components/ui/useLayout';
import { useTheme } from '@/src/theme/useTheme';
import { themedStyleSheet } from '@/src/theme/themed';
import { fonts, fontSizes, letterSpacing, lineHeights, radii, spacing } from '@/src/theme';
import type { Palette } from '@/src/theme/tokens';

type Tone = 'danger' | 'success' | 'warn';

type HeaderAction = {
  label: string;
  active?: boolean;
  onPress: () => void;
  testID?: string;
};

type Props = {
  visible: boolean;
  title: string;
  message: string;
  tone?: Tone;
  hint?: string;
  headerAction?: HeaderAction;
  actionLabel?: string;
  onDismiss?: () => void;
  actionTestID?: string;
  secondaryLabel?: string;
  onSecondary?: () => void;
  secondaryTestID?: string;
  extraLabel?: string;
  onExtra?: () => void;
  extraTestID?: string;
  /** Short meta label shown inline on phone next to the title (e.g. next review gap or game move). */
  compactNote?: string;
  /** Shown in place of the buttons while a punishment line is still playing. */
  waiting?: string;
  /** Tap handler on the waiting label to skip straight to the end of playback. */
  onWaitingPress?: () => void;
};

export function BlunderOverlay({
  visible,
  title,
  message,
  tone = 'danger',
  hint,
  headerAction,
  actionLabel = 'Got it',
  onDismiss,
  actionTestID,
  secondaryLabel,
  onSecondary,
  secondaryTestID,
  extraLabel,
  onExtra,
  extraTestID,
  compactNote,
  waiting,
  onWaitingPress,
}: Props) {
  const { colors } = useTheme();
  const { phone, tight, contentHeight } = useLayout();
  const reduced = useReducedMotion();
  const opacity = useSharedValue(1);

  useEffect(() => {
    if (!visible || reduced) {
      opacity.value = 1;
      return;
    }
    opacity.value = 0;
    opacity.value = withTiming(1, { duration: 180 });
  }, [message, opacity, reduced, title, tone, visible]);

  const fade = useAnimatedStyle(() => ({ opacity: opacity.value }));

  if (!visible) return null;
  const toneColor = toneColors(colors, tone);
  const iconSize = phone ? 14 : 22;
  const rowActions = phone || contentHeight < 800;
  const copy = hint ? `${message} Try ${hint}.` : message;

  if (phone) {
    return (
      <Animated.View
        {...liveA11y()}
        style={[
          styles.banner,
          { backgroundColor: toneColor.soft, borderColor: toneColor.accent },
          fade,
        ]}>
        <View style={styles.bannerTop}>
          <View style={[styles.bannerIcon, { backgroundColor: toneColor.accent }]}>
            <ToneIcon tone={tone} color={glyphColor(colors, tone)} size={iconSize} />
          </View>
          <View style={styles.bannerCopy}>
            <View style={styles.bannerTitleRow}>
              <Text style={styles.bannerTitle} numberOfLines={1}>
                {title}
              </Text>
              {headerAction ? (
                <BookmarkAction action={headerAction} compact />
              ) : compactNote ? (
                <Text style={styles.bannerCompactNote} numberOfLines={1}>
                  {compactNote}
                </Text>
              ) : null}
            </View>
            <Text style={styles.bannerMessage} numberOfLines={2} testID="coach-line">
              {copy}
            </Text>
          </View>
        </View>
        <View style={styles.bannerActions}>
          {waiting && !onDismiss ? (
            onWaitingPress ? (
              <Pressable
                {...controlA11y('button', `${waiting} Tap to skip`)}
                onPress={onWaitingPress}
                style={styles.waitingTap}>
                <Text style={styles.waitingPhone} numberOfLines={1}>
                  {waiting}
                </Text>
              </Pressable>
            ) : (
              <Text style={styles.waitingPhone} numberOfLines={1}>
                {waiting}
              </Text>
            )
          ) : (
            <>
              {onDismiss ? (
                <Button
                  compact
                  label={actionLabel}
                  onPress={onDismiss}
                  testID={actionTestID}
                  style={styles.action}
                />
              ) : (
                <View style={styles.action} />
              )}
              {onSecondary && secondaryLabel ? (
                <Button
                  compact
                  label={secondaryLabel}
                  onPress={onSecondary}
                  variant="secondary"
                  testID={secondaryTestID}
                  style={styles.action}
                />
              ) : null}
              {onExtra && extraLabel ? (
                <Button
                  compact
                  label={extraLabel}
                  onPress={onExtra}
                  variant="secondary"
                  testID={extraTestID}
                  style={styles.action}
                />
              ) : null}
            </>
          )}
        </View>
      </Animated.View>
    );
  }

  return (
    <Animated.View
      {...liveA11y()}
      style={[styles.card, { borderColor: toneColor.accent }, fade]}>
      <View style={styles.head}>
        <View style={[styles.badge, { backgroundColor: toneColor.soft }]}>
          <ToneIcon tone={tone} color={toneColor.accent} size={iconSize} />
        </View>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        {headerAction ? <BookmarkAction action={headerAction} compact={false} /> : null}
      </View>
      <Text style={text.body} numberOfLines={tight ? 3 : undefined} testID="coach-line">
        {message}
      </Text>
      {hint ? (
        <View style={styles.hintBox}>
          <Text style={styles.hintLabel}>Try</Text>
          <Text style={styles.hint}>{hint}</Text>
        </View>
      ) : null}
      {waiting && !onDismiss ? (
        onWaitingPress ? (
          <Pressable
            {...controlA11y('button', `${waiting} Click to skip`)}
            onPress={onWaitingPress}
            style={styles.waitingTap}>
            <Text style={styles.waiting}>{waiting}</Text>
          </Pressable>
        ) : (
          <Text style={styles.waiting}>{waiting}</Text>
        )
      ) : null}
      {rowActions && (onDismiss || (onSecondary && secondaryLabel) || (onExtra && extraLabel)) ? (
        <View style={styles.actions}>
          {onDismiss ? (
            <Button label={actionLabel} onPress={onDismiss} testID={actionTestID} style={styles.action} />
          ) : null}
          {onSecondary && secondaryLabel ? (
            <Button
              label={secondaryLabel}
              onPress={onSecondary}
              variant="secondary"
              testID={secondaryTestID}
              style={styles.action}
            />
          ) : null}
          {onExtra && extraLabel ? (
            <Button
              label={extraLabel}
              onPress={onExtra}
              variant="secondary"
              testID={extraTestID}
              style={styles.action}
            />
          ) : null}
        </View>
      ) : (
        <>
          {onDismiss ? <Button label={actionLabel} onPress={onDismiss} testID={actionTestID} /> : null}
          {onSecondary && secondaryLabel ? (
            <Button label={secondaryLabel} onPress={onSecondary} variant="secondary" testID={secondaryTestID} />
          ) : null}
          {onExtra && extraLabel ? (
            <Button label={extraLabel} onPress={onExtra} variant="secondary" testID={extraTestID} />
          ) : null}
        </>
      )}
    </Animated.View>
  );
}

function BookmarkAction({ action, compact }: { action: HeaderAction; compact: boolean }) {
  const { colors } = useTheme();
  return (
    <Pressable
      {...controlA11y('button', action.label, Boolean(action.active))}
      testID={action.testID}
      hitSlop={spacing[6]}
      onPress={action.onPress}
      style={(state) => {
        const hovered = 'hovered' in state && Boolean(state.hovered);
        return [
          styles.bookmark,
          compact && styles.bookmarkCompact,
          action.active && styles.bookmarkActive,
          (hovered || state.pressed) && !action.active && styles.bookmarkHover,
        ];
      }}>
      <IconBookmark
        color={action.active ? colors.accent : colors.textMuted}
        size={compact ? 12 : 14}
        filled={Boolean(action.active)}
      />
      <Text
        style={[
          styles.bookmarkLabel,
          compact && styles.bookmarkLabelCompact,
          action.active && styles.bookmarkLabelActive,
        ]}
        numberOfLines={1}>
        {action.label}
      </Text>
    </Pressable>
  );
}

function ToneIcon({ tone, color, size }: { tone: Tone; color: string; size: number }) {
  switch (tone) {
    case 'success':
      return <IconCheck color={color} size={size} />;
    case 'warn':
      return <IconInfo color={color} size={size} />;
    case 'danger':
      return <IconX color={color} size={size} />;
    default: {
      const _exhaustive: never = tone;
      return _exhaustive;
    }
  }
}

function toneColors(colors: Palette, tone: Tone): { accent: string; soft: string } {
  switch (tone) {
    case 'success':
      return { accent: colors.success, soft: colors.successSoft };
    case 'warn':
      return { accent: colors.warning, soft: colors.warningSoft };
    case 'danger':
      return { accent: colors.danger, soft: colors.dangerSoft };
    default: {
      const _exhaustive: never = tone;
      return _exhaustive;
    }
  }
}

function glyphColor(colors: Palette, tone: Tone): string {
  switch (tone) {
    case 'success':
    case 'warn':
      return colors.accentText;
    case 'danger':
      return colors.onDanger;
    default: {
      const _exhaustive: never = tone;
      return _exhaustive;
    }
  }
}

const styles = themedStyleSheet((colors) => ({
  banner: {
    height: PHONE_BANNER,
    width: '100%',
    borderRadius: radii.md,
    borderWidth: 1,
    borderLeftWidth: 4,
    paddingHorizontal: spacing[10],
    paddingVertical: spacing[3],
    gap: spacing[2],
    overflow: 'hidden',
    justifyContent: 'space-between',
  },
  bannerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    height: 44,
  },
  bannerIcon: {
    width: 26,
    height: 26,
    borderRadius: radii.badge,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerCopy: {
    flex: 1,
    minWidth: 0,
    height: 44,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  bannerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[6],
  },
  bannerTitle: {
    flex: 1,
    fontFamily: fonts.display,
    fontSize: fontSizes[14],
    lineHeight: lineHeights[16],
    color: colors.text,
    letterSpacing: letterSpacing.tight,
  },
  bannerCompactNote: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes[11],
    lineHeight: lineHeights[14],
    color: colors.textMuted,
    flexShrink: 0,
  },
  waitingTap: {
    cursor: 'pointer',
  },
  bookmark: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[4],
    minHeight: 30,
    paddingHorizontal: spacing[10],
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    cursor: 'pointer',
    flexShrink: 0,
  },
  bookmarkCompact: {
    minHeight: 20,
    paddingHorizontal: spacing[6],
    gap: spacing[3],
  },
  bookmarkActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
  },
  bookmarkHover: {
    backgroundColor: colors.surfaceRaised,
  },
  bookmarkLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes[12],
    lineHeight: lineHeights[16],
    color: colors.text,
  },
  bookmarkLabelCompact: {
    fontSize: fontSizes[10],
    lineHeight: lineHeights[13],
  },
  bookmarkLabelActive: {
    color: colors.accent,
  },
  bannerMessage: {
    fontFamily: fonts.body,
    fontSize: fontSizes[12],
    lineHeight: lineHeights[14],
    color: colors.textMuted,
  },
  bannerActions: {
    height: 32,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[6],
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderLeftWidth: 4,
    padding: spacing.md,
    gap: spacing.sm,
    shadowColor: colors.shadow,
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  badge: {
    width: 40,
    height: 40,
    borderRadius: radii.circleLg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    fontFamily: fonts.display,
    fontSize: fontSizes[22],
    lineHeight: lineHeights[28],
    color: colors.text,
    letterSpacing: letterSpacing.tight,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing[6],
  },
  action: {
    flex: 1,
    flexBasis: 0,
  },
  hintBox: {
    backgroundColor: colors.background,
    borderRadius: radii.md,
    paddingHorizontal: spacing[12],
    paddingVertical: spacing[10],
    gap: spacing.xxs,
  },
  hintLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes[14],
    letterSpacing: letterSpacing.pill,
    textTransform: 'uppercase',
    color: colors.textDim,
  },
  hint: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes[14],
    color: colors.text,
  },
  waiting: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes[15],
    color: colors.textMuted,
  },
  waitingPhone: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes[13],
    lineHeight: lineHeights[16],
    color: colors.textMuted,
  },
}));
