import { useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { stageMetrics, type StageMetrics } from '@/src/components/ui/stageMetrics';

export function useLayout(): StageMetrics {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  return stageMetrics(width, height, insets.top, insets.bottom);
}
