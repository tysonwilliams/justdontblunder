import type { ReactNode } from 'react';
import { ScrollView, View } from 'react-native';

import { useLayout } from '@/src/components/ui/useLayout';
import { useTheme } from '@/src/theme/useTheme';
import { themedStyleSheet } from '@/src/theme/themed';
import { layout } from '@/src/theme/tokens';

type Props = {
  children: ReactNode;
  /** Board stages fill the viewport. Pages (progress, results) scroll. */
  variant?: 'board' | 'page';
  maxWidth?: number;
};

export function Screen({ children, variant = 'page', maxWidth }: Props) {
  useTheme();
  const { padX, padTop, padBottom, contentW } = useLayout();
  const cap = maxWidth ?? (variant === 'board' ? contentW + padX * 2 : layout.pageMax);

  if (variant === 'board') {
    return (
      <View style={styles.screen}>
        <View
          style={[
            styles.boardFrame,
            {
              paddingTop: padTop,
              paddingBottom: padBottom,
              paddingHorizontal: padX,
              maxWidth: cap,
            },
          ]}>
          {children}
        </View>
      </View>
    );
  }

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

const styles = themedStyleSheet((colors) => ({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
    overflow: 'hidden',
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
  boardFrame: {
    flex: 1,
    width: '100%',
    alignSelf: 'center',
    minHeight: 0,
    minWidth: 0,
  },
}));
