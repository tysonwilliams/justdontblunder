import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { useSafeAreaInsets, type EdgeInsets } from 'react-native-safe-area-context';

import { unionInsets } from '@/src/components/ui/screenInsetsMath';

const ZERO: EdgeInsets = { top: 0, right: 0, bottom: 0, left: 0 };

/**
 * Expo Router's web provider reports zero insets. viewport-fit=cover still
 * draws under the notch and the home indicator, so the CSS env() wins when
 * it is larger.
 */

function readCssInsets(): EdgeInsets {
  if (typeof document === 'undefined') return ZERO;
  const probe = document.createElement('div');
  const style = probe.style;
  style.position = 'fixed';
  style.top = '0';
  style.left = '0';
  style.visibility = 'hidden';
  style.pointerEvents = 'none';
  style.paddingTop = 'env(safe-area-inset-top, 0px)';
  style.paddingRight = 'env(safe-area-inset-right, 0px)';
  style.paddingBottom = 'env(safe-area-inset-bottom, 0px)';
  style.paddingLeft = 'env(safe-area-inset-left, 0px)';
  document.documentElement.appendChild(probe);
  const computed = getComputedStyle(probe);
  const insets = {
    top: Number.parseFloat(computed.paddingTop) || 0,
    right: Number.parseFloat(computed.paddingRight) || 0,
    bottom: Number.parseFloat(computed.paddingBottom) || 0,
    left: Number.parseFloat(computed.paddingLeft) || 0,
  };
  probe.remove();
  return insets;
}

export function useScreenInsets(): EdgeInsets {
  const provider = useSafeAreaInsets();
  const [css, setCss] = useState(readCssInsets);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const apply = () => {
      const next = readCssInsets();
      setCss((prev) =>
        prev.top === next.top &&
        prev.right === next.right &&
        prev.bottom === next.bottom &&
        prev.left === next.left
          ? prev
          : next,
      );
    };
    apply();
    window.addEventListener('resize', apply);
    window.visualViewport?.addEventListener('resize', apply);
    return () => {
      window.removeEventListener('resize', apply);
      window.visualViewport?.removeEventListener('resize', apply);
    };
  }, []);

  if (Platform.OS !== 'web') return provider;
  return unionInsets(provider, css);
}
