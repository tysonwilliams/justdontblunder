import type { ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { useKeyboardShortcuts } from '@/src/components/ui/useKeyboardShortcuts';
import { useTheme } from '@/src/theme/useTheme';
import { themedStyleSheet } from '@/src/theme/themed';
import { layout, radii, shadows, spacing } from '@/src/theme';

type Props = {
  visible: boolean;
  onClose?: () => void;
  children: ReactNode;
};

export function Dialog({ visible, onClose, children }: Props) {
  useTheme();
  useKeyboardShortcuts({ Escape: onClose }, visible, { modal: true });
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        {onClose ? <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} style={StyleSheet.absoluteFill} /> : null}
        <View style={styles.card}>{children}</View>
      </View>
    </Modal>
  );
}

const styles = themedStyleSheet((colors) => ({
  backdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    padding: layout.gutter,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing[28],
    paddingBottom: spacing[20],
    alignItems: 'center',
    gap: spacing[10],
    ...shadows.dialog,
  },
}));
