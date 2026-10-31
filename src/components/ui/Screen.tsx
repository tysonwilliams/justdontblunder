import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { useLayout } from '@/src/components/ui/useLayout';
import { colors, layout } from '@/src/theme';

type Props = {
  children: ReactNode;
  /** Board stages use the wide frame. Pages (progress, results) use a calmer measure. */
  variant?: 'board' | 'page';
  maxWidth?: number;
};

export function Screen({ children, variant = 'page', maxWidth }: Props) {
  const { padX, padTop, padBottom } = useLayout();
  const cap = maxWidth ?? (variant === 'board' ? layout.stageMax : layout.pageMax);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: padTop,
          paddingBottom: padBottom,
          paddingHorizontal: padX,
        },
      ]}>
      <View style={[styles.column, { maxWidth: cap }]}>{children}</View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    flexGrow: 1,
    width: '100%',
    alignItems: 'center',
  },
  column: {
    width: '100%',
    minWidth: 0,
    flexGrow: 1,
  },
});
