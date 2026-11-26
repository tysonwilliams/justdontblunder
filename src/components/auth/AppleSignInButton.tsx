import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import {
  APPLE_BUTTON_TITLE,
  APPLE_LOGO_PATH,
  APPLE_LOGO_VIEWBOX,
  APPLE_TITLE_FONT_FAMILY,
  APPLE_TITLE_FONT_WEIGHT,
  appleButtonPaint,
  appleButtonStyle,
  appleLogoSize,
  appleTitleFontSize,
  appleTitleLetterSpacing,
} from '@/src/auth/appleButton';
import {
  SIGN_IN_BUTTON_HEIGHT,
  SIGN_IN_BUTTON_RADIUS,
  SIGN_IN_LOGO_LEFT,
} from '@/src/auth/signInButtonMetrics';
import { controlA11y } from '@/src/components/ui/a11y';

type Props = {
  scheme: 'dark' | 'light';
  onPress: () => void;
};

const logo = appleLogoSize(SIGN_IN_BUTTON_HEIGHT);
const titleSize = appleTitleFontSize(SIGN_IN_BUTTON_HEIGHT);

/**
 * Continue with Apple. White on a dark page, black on a light page.
 * The press still starts the Supabase Apple redirect.
 */
export function AppleSignInButton({ scheme, onPress }: Props) {
  const paint = appleButtonPaint(appleButtonStyle(scheme));
  return (
    <Pressable
      {...controlA11y('button', APPLE_BUTTON_TITLE)}
      testID="account-apple"
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: paint.background,
          borderColor: paint.borderColor,
          borderWidth: paint.borderWidth,
          opacity: pressed ? 0.88 : 1,
        },
      ]}>
      <View pointerEvents="none" style={styles.logo}>
        <Svg width={logo.width} height={logo.height} viewBox={APPLE_LOGO_VIEWBOX}>
          <Path d={APPLE_LOGO_PATH} fill={paint.foreground} fillRule="nonzero" />
        </Svg>
      </View>
      <Text style={[styles.title, { color: paint.foreground }]} numberOfLines={1}>
        {APPLE_BUTTON_TITLE}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    position: 'relative',
    width: '100%',
    height: SIGN_IN_BUTTON_HEIGHT,
    borderRadius: SIGN_IN_BUTTON_RADIUS,
    borderStyle: 'solid',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    cursor: 'pointer',
  },
  logo: {
    position: 'absolute',
    left: SIGN_IN_LOGO_LEFT,
    top: 0,
    height: SIGN_IN_BUTTON_HEIGHT,
    justifyContent: 'center',
  },
  title: {
    fontFamily: Platform.OS === 'web' ? APPLE_TITLE_FONT_FAMILY : undefined,
    fontWeight: APPLE_TITLE_FONT_WEIGHT,
    fontSize: titleSize,
    lineHeight: titleSize + 4,
    letterSpacing: appleTitleLetterSpacing(titleSize),
    textAlign: 'center',
  },
});
