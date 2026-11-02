import { useEffect, useState } from 'react';
import { Platform, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { stageMetrics, type StageMetrics } from '@/src/components/ui/stageMetrics';

function useVisualWindow(): { width: number; height: number } {
  const windowSize = useWindowDimensions();
  const [visual, setVisual] = useState({ width: windowSize.width, height: windowSize.height });

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const read = () => {
      const view = window.visualViewport;
      setVisual({
        width: view?.width ?? window.innerWidth,
        height: view?.height ?? window.innerHeight,
      });
    };
    read();
    window.visualViewport?.addEventListener('resize', read);
    window.visualViewport?.addEventListener('scroll', read);
    window.addEventListener('resize', read);
    return () => {
      window.visualViewport?.removeEventListener('resize', read);
      window.visualViewport?.removeEventListener('scroll', read);
      window.removeEventListener('resize', read);
    };
  }, []);

  if (Platform.OS !== 'web') return windowSize;
  return visual.width > 0 && visual.height > 0 ? visual : windowSize;
}

export function useLayout(): StageMetrics {
  const { width, height } = useVisualWindow();
  const insets = useSafeAreaInsets();
  return stageMetrics(width, height, insets.top, insets.bottom);
}
