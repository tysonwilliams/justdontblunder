import { TextInput } from 'react-native';

import { useTheme } from '@/src/theme/useTheme';
import { themedStyleSheet } from '@/src/theme/themed';
import { fonts, fontSizes, radii, spacing } from '@/src/theme';

type Complete = 'email' | 'current-password' | 'new-password';

type Props = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  testID: string;
  secure?: boolean;
  autoComplete?: Complete;
  textContentType?: 'emailAddress' | 'password' | 'newPassword';
};

export function AuthField({
  label,
  value,
  onChangeText,
  testID,
  secure = false,
  autoComplete,
  textContentType,
}: Props) {
  const { colors } = useTheme();
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      autoCapitalize="none"
      autoCorrect={false}
      spellCheck={false}
      secureTextEntry={secure}
      keyboardType={autoComplete === 'email' ? 'email-address' : 'default'}
      autoComplete={autoComplete}
      textContentType={textContentType}
      placeholder={label}
      placeholderTextColor={colors.textDim}
      accessibilityLabel={label}
      testID={testID}
      style={[styles.field, { color: colors.text }]}
    />
  );
}

const styles = themedStyleSheet((colors) => ({
  field: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    paddingHorizontal: spacing[12],
    paddingVertical: spacing[10],
    fontFamily: fonts.body,
    fontSize: fontSizes[16],
    minHeight: 44,
  },
}));
