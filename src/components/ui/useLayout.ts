import { useEffect, useState } from 'react';
import { Platform, useWindowDimensions } from 'react-native';

import { phoneSlots, type PhoneSlots } from '@/src/components/ui/phoneSlots';
import { useScreenInsets } from '@/src/components/ui/screenInsets';
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

export type LayoutMetrics = StageMetrics & {
  /** Phone column slots. Null when the board sits beside the side panel. */
  slots: PhoneSlots | null;
};

export function useLayout(): LayoutMetrics {
  const { width, height } = useVisualWindow();
  const insets = useScreenInsets();
  const metrics = stageMetrics(width, height, insets.top, insets.bottom);
  const slots = metrics.phone ? phoneSlots(metrics.contentHeight, metrics.boardWidth, metrics.turnRow) : null;
  return { ...metrics, slots };
}
