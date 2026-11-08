import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useEffect } from 'react';

import { DrillSession } from '@/src/components/DrillSession';
import { SafeChoiceSession } from '@/src/components/SafeChoiceSession';
import { PlaySkeleton } from '@/src/components/ui/Skeleton';
import {
  drillHref,
  parseDrillMode,
  parseThemeFilter,
  type DrillMode,
  type ThemeFilter,
} from '@/src/logic/drillLink';

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default function DrillsScreen() {
  const params = useLocalSearchParams<{
    mode?: string | string[];
    theme?: string | string[];
    pick?: string | string[];
  }>();
  const router = useRouter();
  const pick = firstParam(params.pick) === '1';
  const mode = parseDrillMode(pick ? 'pick' : firstParam(params.mode));
  const theme = parseThemeFilter(firstParam(params.theme));

  useEffect(() => {
    if (!pick) return;
    router.replace(drillHref('pick', theme) as Href);
  }, [pick, router, theme]);

  const onMode = (next: DrillMode) => {
    router.setParams({ mode: next === 'streak' ? '' : next, pick: '' });
  };
  const onTheme = (next: ThemeFilter) => {
    router.setParams({ theme: next === 'all' ? '' : next });
  };

  if (pick) return <PlaySkeleton />;

  if (mode === 'pick') {
    return <SafeChoiceSession key={`pick-${theme}`} theme={theme} onMode={onMode} onTheme={onTheme} />;
  }

  return (
    <DrillSession key={`${mode}-${theme}`} mode={mode} theme={theme} onMode={onMode} onTheme={onTheme} />
  );
}
