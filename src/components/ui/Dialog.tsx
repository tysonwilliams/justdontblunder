import type { ReactNode } from 'react';
import { Modal, StyleSheet, View } from 'react-native';

import { colors, radii, shadows, spacing } from '@/src/theme';

type Props = {
  visible: boolean;
  children: ReactNode;
};

export function Dialog({ visible, children }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <View style={styles.backdrop}>
        <View style={styles.card}>{children}</View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing[20],
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
});
