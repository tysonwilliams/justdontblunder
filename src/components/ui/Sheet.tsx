import { useRef, useState, type ReactNode } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View, type GestureResponderEvent } from 'react-native';

import { controlA11y } from '@/src/components/ui/a11y';
import { IconX } from '@/src/components/ui/icons';
import { useScreenInsets } from '@/src/components/ui/screenInsets';
import { useKeyboardShortcuts } from '@/src/components/ui/useKeyboardShortcuts';
import { useLayout } from '@/src/components/ui/useLayout';
import { useTheme } from '@/src/theme/useTheme';
import { themedStyleSheet } from '@/src/theme/themed';
import { fonts, fontSizes, layout, letterSpacing, lineHeights, radii, shadows, spacing } from '@/src/theme';

type Props = {
  visible: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  /** 'drawer' slides from the right on desktop; 'sheet' centers as a compact modal on desktop. Both are bottom sheets on phone. */
  variant?: 'sheet' | 'drawer';
  testID?: string;
  children: ReactNode;
};

export function Sheet({ visible, onClose, title, subtitle, variant = 'sheet', testID, children }: Props) {
  const { colors } = useTheme();
  const { phone } = useLayout();
  const insets = useScreenInsets();
  const [dragY, setDragY] = useState(0);
  const dragStartY = useRef<number | null>(null);
  const dragLastY = useRef(0);
  useKeyboardShortcuts({ Escape: onClose }, visible);

  const onDragGrant = (event: GestureResponderEvent) => {
    dragStartY.current = event.nativeEvent.pageY;
    dragLastY.current = 0;
  };
  const onDragMove = (event: GestureResponderEvent) => {
    if (dragStartY.current == null) return;
    const dy = Math.max(0, event.nativeEvent.pageY - dragStartY.current);
    dragLastY.current = dy;
    setDragY(dy);
  };
  const onDragEnd = () => {
    const dy = dragLastY.current;
    dragStartY.current = null;
    dragLastY.current = 0;
    setDragY(0);
    if (dy > 72) onClose();
  };

  if (!visible) return null;

  const isDrawer = !phone && variant === 'drawer';

  return (
    <Modal
      visible={visible}
      transparent
      animationType={phone && Platform.OS !== 'web' ? 'slide' : 'fade'}
      statusBarTranslucent
      onRequestClose={onClose}>
      <View
        style={[
          styles.backdrop,
          phone ? styles.backdropPhone : isDrawer ? styles.backdropDrawer : styles.backdropCenter,
        ]}>
        <Pressable
          {...controlA11y('button', 'Close')}
          testID={testID ? `${testID}-backdrop` : undefined}
          onPress={onClose}
          style={StyleSheet.absoluteFill}
        />
        <View
          testID={testID}
          style={[
            styles.panel,
            phone
              ? [
                  styles.panelPhone,
                  { paddingBottom: Math.max(spacing.lg, insets.bottom + spacing.md) },
                  dragY > 0 && { transform: [{ translateY: dragY }] },
                ]
              : isDrawer
                ? [styles.panelDrawer, { paddingTop: Math.max(spacing.lg, insets.top + spacing.md) }]
                : styles.panelCenter,
          ]}>
          <View
            onStartShouldSetResponder={() => false}
            onMoveShouldSetResponder={() => phone}
            onResponderGrant={phone ? onDragGrant : undefined}
            onResponderMove={phone ? onDragMove : undefined}
            onResponderRelease={phone ? onDragEnd : undefined}
            onResponderTerminate={phone ? onDragEnd : undefined}>
            {phone ? (
              <View style={styles.handleRow}>
                <View style={styles.handle} />
              </View>
            ) : null}
            <View style={styles.header}>
              <View style={styles.headerCopy}>
                <Text style={styles.title} numberOfLines={1}>
                  {title}
                </Text>
                {subtitle ? (
                  <Text style={styles.subtitle} numberOfLines={1}>
                    {subtitle}
                  </Text>
                ) : null}
              </View>
              <Pressable
                {...controlA11y('button', 'Close')}
                testID="sheet-close"
                onPress={onClose}
                hitSlop={spacing.sm}
                style={(state) => {
                  const hovered = 'hovered' in state && Boolean(state.hovered);
                  return [styles.close, (hovered || state.pressed) && styles.closeHover];
                }}>
                <IconX color={colors.textMuted} size={18} />
              </Pressable>
            </View>
          </View>
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.body}
            showsVerticalScrollIndicator={false}
            bounces={false}>
            {children}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = themedStyleSheet((colors) => ({
  backdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
  },
  backdropPhone: {
    justifyContent: 'flex-end',
  },
  backdropCenter: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: layout.gutter,
  },
  backdropDrawer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  panel: {
    backgroundColor: colors.surface,
    borderColor: colors.borderStrong,
    ...shadows.dialog,
  },
  panelPhone: {
    width: '100%',
    maxHeight: '86%',
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    borderTopWidth: 1,
    paddingHorizontal: layout.gutter,
    paddingTop: spacing.sm,
  },
  panelCenter: {
    width: '100%',
    maxWidth: 420,
    maxHeight: '85%',
    borderRadius: radii.xl,
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing[20],
  },
  panelDrawer: {
    width: 380,
    maxWidth: '92%',
    height: '100%',
    borderLeftWidth: 1,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  handleRow: {
    alignItems: 'center',
    paddingBottom: spacing[10],
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: radii.pill,
    backgroundColor: colors.borderStrong,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingBottom: spacing[14],
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerCopy: {
    flex: 1,
    minWidth: 0,
    gap: spacing[2],
  },
  title: {
    fontFamily: fonts.display,
    fontSize: fontSizes[20],
    lineHeight: lineHeights[26],
    letterSpacing: letterSpacing.tight,
    color: colors.text,
  },
  subtitle: {
    fontFamily: fonts.body,
    fontSize: fontSizes[13],
    lineHeight: lineHeights[18],
    color: colors.textMuted,
  },
  close: {
    width: 36,
    height: 36,
    borderRadius: radii.circleMd,
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
  closeHover: {
    backgroundColor: colors.hover,
  },
  scroll: {
    flexGrow: 0,
  },
  body: {
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    gap: spacing.md,
  },
}));
