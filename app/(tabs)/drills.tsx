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
  type ThemeFilter,
} from '@/src/logic/drillLink';

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default function DrillsScreen() {
  const params = useLocalSearchParams<{
    mode?: string | string[];
    theme?: string | string[];
    streak?: string | string[];
    pick?: string | string[];
  }>();
  const router = useRouter();
  const query = {
    mode: firstParam(params.mode),
    theme: firstParam(params.theme),
    streak: firstParam(params.streak),
    pick: firstParam(params.pick),
  };
  const { mode, theme, streak, href } = resolveDrillQuery(query);

  useEffect(() => {
    if (observedDrillHref(query) === href) return;
    router.replace(href as Href);
  }, [href, query.mode, query.pick, query.streak, query.theme, router]);

  const onMode = (next: DrillMode) => {
    router.replace(drillHref(next, theme, next === 'play' && streak) as Href);
  };
  const onTheme = (next: ThemeFilter) => {
    router.replace(drillHref(mode, next, streak) as Href);
  };
  const onStreak = (next: boolean) => {
    router.replace(drillHref('play', theme, next) as Href);
  };

  return (
    <View style={styles.stage}>
      {mode === 'pick' ? (
        <SafeChoiceSession key={`pick-${theme}`} theme={theme} onMode={onMode} onTheme={onTheme} />
      ) : (
        <DrillSession
          key={`${mode}-${theme}-${streak ? '1' : '0'}`}
          mode={mode}
          theme={theme}
          streak={streak}
          onMode={onMode}
          onTheme={onTheme}
          onStreak={onStreak}
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
