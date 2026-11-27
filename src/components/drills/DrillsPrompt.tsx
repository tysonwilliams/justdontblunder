import { useEffect, useRef, useState } from 'react';
import { Text, TextInput, View } from 'react-native';

import { Button } from '@/src/components/ui/Button';
import { FilterChips } from '@/src/components/ui/Chip';
import { text } from '@/src/components/ui/text';
import { playUnlocked } from '@/src/logic/earlyPlay';
import { claimOnboarding, shouldOfferUsernameSheet } from '@/src/logic/onboardingPrompt';
import { cleanUsername, type GameSite } from '@/src/logic/gameImport';
import { cancelOwnScan, runOwnScan } from '@/src/store/ownGames';
import { useProgressStore, type ScanProgress } from '@/src/store/progress';
import { useHydrated } from '@/src/store/useHydrated';
import { useTheme } from '@/src/theme/useTheme';
import { themedStyleSheet } from '@/src/theme/themed';
import { fonts, fontSizes, layout, radii, spacing } from '@/src/theme';

const SITES: readonly { id: GameSite; label: string; testID: string }[] = [
  { id: 'chesscom', label: 'Chess.com', testID: 'drills-chesscom' },
  { id: 'lichess', label: 'Lichess', testID: 'drills-lichess' },
];

type Phase = 'ask' | 'scanning' | 'done';

function initialPhase(): Phase {
  const scan = useProgressStore.getState().scan;
  if (scan.phase === 'scanning' || (scan.phase === 'paused' && scan.cursor?.resume)) return 'scanning';
  if (scan.phase === 'error' && playUnlocked({ found: scan.found, incoming: scan.incoming, failed: true })) {
    return 'done';
  }
  return 'ask';
}

function statusCopy(phase: Phase, scan: ScanProgress): string {
  if (scan.phase === 'error' || scan.phase === 'paused') return scan.message;
  const unlocked = playUnlocked({ found: scan.found, incoming: scan.incoming, failed: false });
  if (phase === 'scanning' && scan.phase === 'scanning' && scan.incoming && unlocked) {
    return `${scan.message} You can play these while the rest load.`;
  }
  return scan.message;
}

/**
 * Asks for a public username. Sits over Drills and leaves the board where it is.
 * It waits until a drill is finished, and it stays hidden when this tab already
 * showed the welcome card.
 */
export function DrillsPrompt() {
  const { colors } = useTheme();
  const hydrated = useHydrated(useProgressStore.persist);
  const profile = useProgressStore((state) => state.gameProfile);
  const drillsCompleted = useProgressStore((state) => state.drillsCompleted);
  const skipped = useProgressStore((state) => state.drillsPromptSkipped);
  const scan = useProgressStore((state) => state.scan);
  const skipDrillsPrompt = useProgressStore((state) => state.skipDrillsPrompt);
  const scanPromptDismissed = useProgressStore((state) => state.scanPromptDismissed);
  const dismissScanPrompt = useProgressStore((state) => state.dismissScanPrompt);
  const [site, setSite] = useState<GameSite>('chesscom');
  const [username, setUsername] = useState('');
  const [phase, setPhase] = useState<Phase>(initialPhase);
  const [closed, setClosed] = useState(false);
  const showingResult = useRef(false);
  const failed = scan.phase === 'error';
  const unlocked = playUnlocked({ found: scan.found, incoming: scan.incoming, failed });
  const live = scan.phase === 'scanning';
  const showPlay = phase === 'done' || (phase === 'scanning' && unlocked);

  useEffect(() => {
    if (scan.phase === 'scanning') setPhase('scanning');
  }, [scan.phase]);

  if (
    !shouldOfferUsernameSheet({
      hydrated,
      skipped,
      closed,
      scanPromptDismissed,
      hasProfile: profile != null,
      phase,
      showingResult: showingResult.current,
      drillsCompleted,
    })
  ) {
    return null;
  }
  if (!claimOnboarding('username')) return null;

  const stop = () => {
    cancelOwnScan();
    setPhase('ask');
  };

  const submit = async () => {
    if (phase === 'scanning' || live) return;
    const name = cleanUsername(username);
    if (!name) {
      const current = useProgressStore.getState().scan;
      useProgressStore.getState().setScan({
        phase: 'error',
        found: current.found,
        games: current.games,
        incoming: false,
        message: 'Use the public username, with no spaces.',
        cursor: current.cursor,
      });
      return;
    }
    setPhase('scanning');
    const result = await runOwnScan(site, name);
    if (result === 'scanning') return;
    if (result === 'paused') {
      setPhase('ask');
      return;
    }
    const now = useProgressStore.getState().scan;
    const kept = playUnlocked({
      found: now.found,
      incoming: now.incoming,
      failed: result === 'error',
    });
    if (result === 'done' || kept) {
      showingResult.current = true;
      setPhase('done');
      return;
    }
    setPhase('ask');
  };

  const play = () => {
    dismissScanPrompt();
    setClosed(true);
  };

  return (
    <View style={[styles.scrim, { backgroundColor: colors.overlay }]} testID="drills-prompt">
      <View style={styles.card}>
        <Text style={text.eyebrow}>Your games</Text>
        <Text style={text.title}>Practice your own blunders</Text>
        {phase === 'ask' ? (
          <Text style={text.body}>
            Add a Chess.com or Lichess username. Your recent mistakes become the puzzles. No password.
          </Text>
        ) : (
          <Text style={text.body} testID="drills-status">
            {statusCopy(phase, scan)}
          </Text>
        )}
        {phase === 'ask' ? (
          <>
            <FilterChips options={SITES} value={site} onChange={setSite} />
            <TextInput
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              autoCorrect={false}
              spellCheck={false}
              placeholder="Username"
              placeholderTextColor={colors.textDim}
              accessibilityLabel="Chess username"
              testID="drills-username"
              style={[styles.field, { color: colors.text }]}
            />
          </>
        ) : null}
        {phase === 'ask' && (scan.phase === 'error' || scan.phase === 'paused') ? (
          <Text style={text.body} testID="drills-status">
            {scan.message}
          </Text>
        ) : null}
        {showPlay ? (
          <Button label="Play these" testID="drills-play" onPress={play} />
        ) : (
          <Button
            label={live ? 'Stop' : 'Use my games'}
            testID="drills-find"
            onPress={() => {
              if (live) {
                stop();
                return;
              }
              void submit();
            }}
          />
        )}
        {showPlay && live ? <Button label="Stop" variant="ghost" testID="drills-stop" onPress={stop} /> : null}
        {phase === 'done' ? null : (
          <Button label="Not now" variant="ghost" testID="drills-skip" onPress={skipDrillsPrompt} />
        )}
      </View>
    </View>
  );
}

const styles = themedStyleSheet((colors) => ({
  scrim: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    zIndex: 30,
    alignItems: 'center',
    justifyContent: 'center',
    padding: layout.gutter,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  field: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    paddingHorizontal: spacing[12],
    paddingVertical: spacing[10],
    fontFamily: fonts.body,
    fontSize: fontSizes[16],
    minHeight: 44,
  },
}));
