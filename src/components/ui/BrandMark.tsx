import { Image, View } from 'react-native';

import { useTheme } from '@/src/theme/useTheme';
import { themedStyleSheet } from '@/src/theme/themed';

const LOGO_SOURCE = require('../../../assets/images/logo-mark.png');

type Props = {
  size?: number;
};

/** Knight & Shield brand emblem inside a crisp rounded frame. */
export function BrandMark({ size = 28 }: Props) {
  useTheme();
  const radius = Math.max(4, Math.round(size * 0.24));
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.frame, { width: size, height: size, borderRadius: radius }]}>
      <Image source={LOGO_SOURCE} resizeMode="cover" style={styles.image} />
    </View>
  );
}

const styles = themedStyleSheet((colors) => ({
  frame: {
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.background,
    flexShrink: 0,
  },
  image: {
    width: '100%',
    height: '100%',
  },
}));
