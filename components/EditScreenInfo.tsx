import { StyleSheet } from 'react-native';

import { ExternalLink } from './ExternalLink';
import { MonoText } from './StyledText';
import { Text, View } from './Themed';

import Colors from '@/constants/Colors';
import { expoStarter, fontSizes, lineHeights, radii, spacing } from '@/src/theme';

export default function EditScreenInfo({ path }: { path: string }) {
  return (
    <View>
      <View style={styles.getStartedContainer}>
        <Text
          style={styles.getStartedText}
          lightColor={expoStarter.light.textSoft}
          darkColor={expoStarter.dark.textSoft}>
          Open up the code for this screen:
        </Text>

        <View
          style={[styles.codeHighlightContainer, styles.homeScreenFilename]}
          darkColor={expoStarter.dark.code}
          lightColor={expoStarter.light.code}>
          <MonoText>{path}</MonoText>
        </View>

        <Text
          style={styles.getStartedText}
          lightColor={expoStarter.light.textSoft}
          darkColor={expoStarter.dark.textSoft}>
          Change any of the text, save the file, and your app will automatically update.
        </Text>
      </View>

      <View style={styles.helpContainer}>
        <ExternalLink
          style={styles.helpLink}
          href="https://docs.expo.io/get-started/create-a-new-app/#opening-the-app-on-your-phonetablet">
          <Text style={styles.helpLinkText} lightColor={Colors.light.tint}>
            Tap here if your app doesn't automatically update after making changes
          </Text>
        </ExternalLink>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  getStartedContainer: {
    alignItems: 'center',
    marginHorizontal: spacing[50],
  },
  homeScreenFilename: {
    marginVertical: spacing[7],
  },
  codeHighlightContainer: {
    borderRadius: radii.swatch,
    paddingHorizontal: spacing.xs,
  },
  getStartedText: {
    fontSize: fontSizes[17],
    lineHeight: lineHeights[24],
    textAlign: 'center',
  },
  helpContainer: {
    marginTop: spacing[15],
    marginHorizontal: spacing[20],
    alignItems: 'center',
  },
  helpLink: {
    paddingVertical: spacing[15],
  },
  helpLinkText: {
    textAlign: 'center',
  },
});
