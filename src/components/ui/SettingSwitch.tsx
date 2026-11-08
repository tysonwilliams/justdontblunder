import { Pressable, Text, View } from 'react-native';

import { switchA11y } from '@/src/components/ui/a11y';
import { useLayout } from '@/src/components/ui/useLayout';
import { useTheme } from '@/src/theme/useTheme';
import { themedStyleSheet } from '@/src/theme/themed';
import { fonts, fontSizes, lineHeights, radii, spacing } from '@/src/theme';

type Props = {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
  testID?: string;
};

export function SettingSwitch({ label, value, onChange, testID }: Props) {
  useTheme();
  const { phone } = useLayout();
  return (
    <Pressable
      {...switchA11y(label, value)}
      testID={testID}
      onPress={() => onChange(!value)}
      style={[styles.row, phone && styles.rowPhone]}>
      <Text style={[styles.label, phone && styles.labelPhone]} numberOfLines={1}>
        {label}
      </Text>
      <View style={[styles.track, value && styles.trackOn]}>
        <View style={styles.knob} />
      </View>
    </Pressable>
  );
}

const styles = themedStyleSheet((colors) => ({
  row: {
    flex: 1,
    minHeight: 40,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingHorizontal: spacing[12],
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    cursor: 'pointer',
  },
  rowPhone: {
    minHeight: 32,
    paddingHorizontal: spacing.sm,
  },
  label: {
    flexShrink: 1,
    fontFamily: fonts.bodyBold,
    color: colors.text,
    fontSize: fontSizes[14],
    lineHeight: lineHeights[18],
  },
  labelPhone: {
    fontSize: fontSizes[12],
    lineHeight: lineHeights[16],
  },
  track: {
    width: 40,
    height: 24,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    padding: spacing[2],
    backgroundColor: colors.surfaceRaised,
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
  },
  trackOn: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
    justifyContent: 'flex-end',
  },
  knob: {
    width: 18,
    height: 18,
    borderRadius: radii.pill,
    backgroundColor: colors.text,
  },
}));
