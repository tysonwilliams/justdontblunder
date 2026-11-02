import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useEffect } from 'react';

import { DrillSession } from '@/src/components/DrillSession';

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default function DrillsScreen() {
  const params = useLocalSearchParams<{ pick?: string | string[] }>();
  const router = useRouter();
  const pick = firstParam(params.pick) === '1';

  useEffect(() => {
    if (pick) router.replace('/learn?pick=1' as Href);
  }, [pick, router]);

  if (pick) return null;
  return <DrillSession mode="streak" />;
}
