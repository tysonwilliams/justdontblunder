import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';

import { DrillSession } from '@/src/components/DrillSession';
import type { DrillPlayMode } from '@/src/components/DrillModeBar';
import { SafeChoiceSession } from '@/src/components/SafeChoiceSession';

function pickParam(value: string | string[] | undefined): boolean {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw === '1';
}

export default function DrillsScreen() {
  const params = useLocalSearchParams<{ pick?: string | string[] }>();
  const router = useRouter();
  const pick = pickParam(params.pick);
  const [mode, setMode] = useState<DrillPlayMode>(pick ? 'pick' : 'streak');

  useEffect(() => {
    setMode(pick ? 'pick' : 'streak');
  }, [pick]);

  const onMode = (next: DrillPlayMode) => {
    setMode(next);
    router.setParams({ pick: next === 'pick' ? '1' : '' });
  };

  switch (mode) {
    case 'pick':
      return <SafeChoiceSession onMode={onMode} />;
    case 'streak':
      return <DrillSession mode="streak" onMode={onMode} />;
    default: {
      const _exhaustive: never = mode;
      return _exhaustive;
    }
  }
}
