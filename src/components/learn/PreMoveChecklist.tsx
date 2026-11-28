import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { controlA11y } from '@/src/components/ui/a11y';
import { Button } from '@/src/components/ui/Button';
import { text } from '@/src/components/ui/text';
import {
  BLUNDER_TRIGGERS,
  PRE_MOVE_STEPS,
  TIME_TROUBLE_CHECK,
} from '@/src/logic/antiBlunderGuide';
import { fonts, fontSizes, lineHeights, radii, spacing } from '@/src/theme';
import { themedStyleSheet } from '@/src/theme/themed';
import { useTheme } from '@/src/theme/useTheme';

type Props = {
  onPractice?: () => void;
};

/**
 * Compact, expandable 4-step pre-move checklist anchored in Learn.
 * Even when collapsed, the four-step mantra stays scannable at a glance.
 */
export function PreMoveChecklist({ onPractice }: Props) {
  useTheme();
  const [expanded, setExpanded] = useState(false);

  return (
    <View style={styles.card} testID="pre-move-checklist">
      <Pressable
        {...controlA11y('button', expanded ? 'Hide pre-move checklist details' : 'Show pre-move checklist details', expanded)}
        testID="pre-move-checklist-toggle"
        onPress={() => setExpanded((open) => !open)}
        style={(state) => {
          const hovered = 'hovered' in state && Boolean(state.hovered);
          return [styles.header, (hovered || state.pressed) && styles.headerHover];
        }}>
        <View style={styles.headerCopy}>
          <Text style={text.eyebrow}>Before every move</Text>
          <Text style={styles.title}>The 4-step blunder check</Text>
          {!expanded ? (
            <Text style={styles.summary}>
              1. Last move · 2. Loose pieces · 3. Checks & threats · 4. Verify reply
            </Text>
          ) : null}
        </View>
        <View style={styles.togglePill}>
          <Text style={styles.toggleText}>{expanded ? 'Hide' : 'Steps'}</Text>
        </View>
      </Pressable>

      {expanded ? (
        <View style={styles.body} testID="pre-move-checklist-body">
          <View style={styles.steps}>
            {PRE_MOVE_STEPS.map((step) => (
              <View key={step.number} style={styles.stepRow}>
                <View style={styles.stepNum}>
                  <Text style={styles.stepNumText}>{step.number}</Text>
                </View>
                <View style={styles.stepCopy}>
                  <Text style={styles.stepTitle}>{step.title}</Text>
                  <Text style={styles.stepDetail}>{step.detail}</Text>
                </View>
              </View>
            ))}
          </View>

          <View style={styles.blitzBox}>
            <Text style={styles.blitzLabel}>{TIME_TROUBLE_CHECK.title}</Text>
            <Text style={styles.blitzCopy}>{TIME_TROUBLE_CHECK.summary}</Text>
          </View>

          <View style={styles.triggers}>
            <Text style={styles.subhead}>High-risk moments</Text>
            {BLUNDER_TRIGGERS.map((item) => (
              <Text key={item.label} style={styles.triggerLine}>
                <Text style={styles.triggerBold}>{item.label}: </Text>
                {item.tip}
              </Text>
            ))}
          </View>

          {onPractice ? (
            <Button
              compact
              variant="secondary"
              label="Practice the 4-step check"
              testID="checklist-practice"
              onPress={onPractice}
            />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = themedStyleSheet((colors) => ({
  card: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[10],
    paddingVertical: spacing[10],
    paddingHorizontal: spacing[12],
    cursor: 'pointer',
  },
  headerHover: {
    backgroundColor: colors.surfaceRaised,
  },
  headerCopy: {
    flex: 1,
    minWidth: 0,
    gap: spacing[2],
  },
  title: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes[15],
    lineHeight: lineHeights[20],
    color: colors.text,
  },
  summary: {
    fontFamily: fonts.body,
    fontSize: fontSizes[12],
    lineHeight: lineHeights[16],
    color: colors.textMuted,
  },
  togglePill: {
    paddingHorizontal: spacing[10],
    paddingVertical: spacing[4],
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.background,
    flexShrink: 0,
  },
  toggleText: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes[12],
    lineHeight: lineHeights[16],
    color: colors.textMuted,
  },
  body: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    padding: spacing[12],
    gap: spacing[12],
  },
  steps: {
    gap: spacing[8],
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[8],
  },
  stepNum: {
    width: 22,
    height: 22,
    borderRadius: radii.badge,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing[1],
    flexShrink: 0,
  },
  stepNumText: {
    fontFamily: fonts.bodyExtra,
    fontSize: fontSizes[12],
    lineHeight: lineHeights[16],
    color: colors.accent,
  },
  stepCopy: {
    flex: 1,
    minWidth: 0,
    gap: spacing[1],
  },
  stepTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes[13],
    lineHeight: lineHeights[18],
    color: colors.text,
  },
  stepDetail: {
    fontFamily: fonts.body,
    fontSize: fontSizes[12],
    lineHeight: lineHeights[16],
    color: colors.textMuted,
  },
  blitzBox: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    padding: spacing[10],
    gap: spacing[2],
  },
  blitzLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes[12],
    lineHeight: lineHeights[16],
    color: colors.warning,
  },
  blitzCopy: {
    fontFamily: fonts.body,
    fontSize: fontSizes[12],
    lineHeight: lineHeights[16],
    color: colors.textMuted,
  },
  triggers: {
    gap: spacing[4],
  },
  subhead: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes[12],
    lineHeight: lineHeights[16],
    color: colors.textDim,
  },
  triggerLine: {
    fontFamily: fonts.body,
    fontSize: fontSizes[12],
    lineHeight: lineHeights[16],
    color: colors.textMuted,
  },
  triggerBold: {
    fontFamily: fonts.bodyBold,
    color: colors.text,
  },
}));
