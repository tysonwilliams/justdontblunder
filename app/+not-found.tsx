import { Link, Stack } from 'expo-router';
import { createElement } from 'react';
import { Text, View } from 'react-native';

import { privateMetadata } from '@/src/seo/site';
import { useTheme } from '@/src/theme/useTheme';
import { themedStyleSheet } from '@/src/theme/themed';
import { fonts, fontSizes, layout, spacing } from '@/src/theme';

export function generateMetadata() {
  return privateMetadata('/404', "Page not found · Just Don't Blunder", "That page isn't on the board.");
}

export default function NotFoundScreen() {
  useTheme();
  return (
    <>
      {createElement('title', null, "Page not found · Just Don't Blunder")}
      {createElement('meta', { name: 'description', content: "That page isn't on the board." })}
      {createElement('meta', { name: 'robots', content: 'noindex, nofollow' })}
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
