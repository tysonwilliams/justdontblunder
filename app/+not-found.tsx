import { Link, Stack } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { colors, fonts, fontSizes, spacing } from '@/src/theme';

export default function NotFoundScreen() {
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing[20],
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
});
