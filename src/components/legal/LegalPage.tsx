import type { ReactNode } from 'react';
import { Text, View } from 'react-native';

import { AboutFooter } from '@/src/components/legal/AboutFooter';
import { BrandMark } from '@/src/components/ui/BrandMark';
import { Screen } from '@/src/components/ui/Screen';
import { text } from '@/src/components/ui/text';
import { useTheme } from '@/src/theme/useTheme';
import { themedStyleSheet } from '@/src/theme/themed';
import { spacing } from '@/src/theme';

type Props = {
  eyebrow: string;
  title: string;
  children: ReactNode;
};

/** Scrolling legal page. Not a board screen, so it can grow past one viewport. */
export function LegalPage({ eyebrow, title, children }: Props) {
  useTheme();
  return (
    <Screen maxWidth={720}>
      <View style={styles.page}>
        <View style={styles.header}>
          <View style={styles.brandRow}>
            <BrandMark size={24} />
            <Text style={text.eyebrow}>{eyebrow}</Text>
          </View>
          <Text style={text.display}>{title}</Text>
        </View>
        {children}
        <AboutFooter showProgressLink />
      </View>
    </Screen>
  );
}

const styles = themedStyleSheet(() => ({
  page: {
    width: '100%',
    gap: spacing[20],
    paddingBottom: spacing.xxl,
  },
  header: {
    gap: spacing[6],
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
}));
