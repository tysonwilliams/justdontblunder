import { useLocalSearchParams } from 'expo-router';

import { DrillSession } from '@/src/components/DrillSession';

export default function LearnScreen() {
  const params = useLocalSearchParams<{ review?: string }>();
  return <DrillSession mode="learn" reviewing={params.review === '1'} />;
}
