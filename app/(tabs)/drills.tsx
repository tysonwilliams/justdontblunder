import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';

import { DrillSession } from '@/src/components/DrillSession';
import { DrillsPrompt } from '@/src/components/drills/DrillsPrompt';
import { SafeChoiceSession } from '@/src/components/SafeChoiceSession';
import {
  drillHref,
  observedDrillHref,
  resolveDrillQuery,
  type DrillMode,
  type DrillSourceFilter,
  type ThemeFilter,
} from '@/src/logic/drillLink';
import { metadataFor } from '@/src/seo/site';

export function generateMetadata() {
  return metadataFor('/drills');
}

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default function DrillsScreen() {
  const params = useLocalSearchParams<{
    mode?: string | string[];
    theme?: string | string[];
    streak?: string | string[];
    pick?: string | string[];
    source?: string | string[];
  }>();
  const router = useRouter();
  const rawMode = firstParam(params.mode);
  const rawTheme = firstParam(params.theme);
  const rawStreak = firstParam(params.streak);
  const rawPick = firstParam(params.pick);
  const rawSource = firstParam(params.source);
  const query = {
    mode: rawMode,
    theme: rawTheme,
    streak: rawStreak,
    pick: rawPick,
    source: rawSource,
  };
  const { mode, theme, streak, source, href } = resolveDrillQuery(query);
  const observed = observedDrillHref(query);

  useEffect(() => {
    if (observed === href) return;
    router.replace(href as Href);
  }, [href, observed, router]);

  const onMode = (next: DrillMode) => {
    router.replace(drillHref(next, theme, next === 'play' && streak, next === 'review' ? 'all' : source) as Href);
  };
  const onTheme = (next: ThemeFilter) => {
    router.replace(drillHref(mode, next, streak, source) as Href);
  };
  const onStreak = (next: boolean) => {
    router.replace(drillHref('play', theme, next, source) as Href);
  };
  const onSource = (next: DrillSourceFilter) => {
    router.replace(drillHref(mode, theme, streak, next) as Href);
  };

  return (
    <View style={styles.stage}>
      {mode === 'pick' ? (
        <SafeChoiceSession
          key={`pick-${theme}-${source}`}
          theme={theme}
          source={source}
          onMode={onMode}
          onTheme={onTheme}
          onSource={onSource}
        />
      ) : (
        <DrillSession
          key={`${mode}-${theme}-${streak ? '1' : '0'}-${source}`}
          mode={mode}
          theme={theme}
          streak={streak}
          source={source}
          onMode={onMode}
          onTheme={onTheme}
          onStreak={onStreak}
          onSource={onSource}
        />
      )}
      <DrillsPrompt />
    </View>
  );
}

const styles = StyleSheet.create({
  stage: {
    flex: 1,
    width: '100%',
    minHeight: 0,
  },
});
