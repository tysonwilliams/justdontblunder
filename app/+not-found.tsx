import { Link, Stack } from 'expo-router';
import { Text, View } from 'react-native';

import { useTheme } from '@/src/theme/useTheme';
import { themedStyleSheet } from '@/src/theme/themed';
import { fonts, fontSizes, layout, spacing } from '@/src/theme';

export default function NotFoundScreen() {
  useTheme();
  return (
    <>
      <Stack.Screen options={{ title: 'Oops' }} />
      <View style={styles.container}>
        <Text style={styles.title}>That page isn't on the board.</Text>
        <Link href="/" style={styles.link}>
          <Text style={styles.linkText}>Back to home</Text>
        </Link>
      </View>
    </>
  );
}

const styles = themedStyleSheet((colors) => ({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: layout.gutter,
    backgroundColor: colors.background,
  },
  title: {
    fontSize: fontSizes[20],
    fontFamily: fonts.display,
    color: colors.text,
  },
  link: {
    marginTop: spacing[15],
    paddingVertical: spacing[15],
  },
  linkText: {
    fontSize: fontSizes[14],
    fontFamily: fonts.bodyBold,
    color: colors.accent,
  },
}));
