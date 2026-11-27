import { useEffect, useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import type { Color } from 'chess.js';

import { Button } from '@/src/components/ui/Button';
import { SegmentedControl } from '@/src/components/ui/Chip';
import { text } from '@/src/components/ui/text';
import { cleanUsername, type GameSite } from '@/src/logic/gameImport';
import { poolSummary } from '@/src/logic/puzzlePool';
import { analyzePastedPgn } from '@/src/logic/scanWorkerClient';
import { cancelOwnScan, runOwnScan } from '@/src/store/ownGames';
import { useProgressStore } from '@/src/store/progress';
import { useTheme } from '@/src/theme/useTheme';
import { themedStyleSheet } from '@/src/theme/themed';
import { fonts, fontSizes, radii, spacing } from '@/src/theme';

type ImportTab = 'username' | 'pgn';

const TABS: readonly { id: ImportTab; label: string; testID: string }[] = [
  { id: 'username', label: 'Username', testID: 'import-tab-username' },
  { id: 'pgn', label: 'Paste PGN', testID: 'import-tab-pgn' },
];

const SITES: readonly { id: GameSite; label: string; testID: string }[] = [
  { id: 'chesscom', label: 'Chess.com', testID: 'import-chesscom' },
  { id: 'lichess', label: 'Lichess', testID: 'import-lichess' },
];

const COLORS: readonly { id: Color; label: string; testID: string }[] = [
  { id: 'w', label: 'I played White', testID: 'import-white' },
  { id: 'b', label: 'I played Black', testID: 'import-black' },
];

export function GameImport() {
  const { colors } = useTheme();
  const profile = useProgressStore((state) => state.gameProfile);
  const scan = useProgressStore((state) => state.scan);
  const mergeImportedDrills = useProgressStore((state) => state.mergeImportedDrills);
  const [tab, setTab] = useState<ImportTab>('username');
  const [site, setSite] = useState<GameSite>(profile?.site ?? 'chesscom');
  const [username, setUsername] = useState(profile?.username ?? '');
  const [pgn, setPgn] = useState('');
  const [userColor, setUserColor] = useState<Color>('w');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setSite(profile.site);
    setUsername(profile.username);
  }, [profile]);

  const scanning = scan.phase === 'scanning';

  const findGames = async () => {
    if (scanning) {
      cancelOwnScan();
      return;
    }
    if (busy) return;
    const name = cleanUsername(username);
    if (!name) {
      setStatus('Use the public username, with no spaces.');
      return;
    }
    setBusy(true);
    setStatus('');
    const result = await runOwnScan(site, name);
    if (result === 'error' || result === 'paused') {
      setStatus(useProgressStore.getState().scan.message);
    }
    setBusy(false);
  };

  const usePgn = async () => {
    if (busy || scanning) return;
    setBusy(true);
    setStatus('Reading that game.');
    await new Promise((resolve) => setTimeout(resolve, 0));
    try {
      const result = await analyzePastedPgn(pgn, userColor);
      if (!result.readable) {
        setStatus('That PGN could not be read.');
        return;
      }
      if (result.drills.length === 0) {
        setStatus('No one-move blunder in your moves.');
        return;
      }
      mergeImportedDrills(result.drills);
      setStatus(poolSummary(useProgressStore.getState().ownDrills.length));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={text.section}>Your games</Text>
        <View style={styles.tabSwitch}>
          <SegmentedControl height={30} options={TABS} value={tab} onChange={setTab} />
        </View>
      </View>
      <Text style={text.muted}>
        {tab === 'username'
          ? 'Public Chess.com or Lichess games become your puzzles. No password.'
          : 'Paste a PGN to pull one-move blunders from a single game.'}
      </Text>

      {tab === 'username' ? (
        <View style={styles.form}>
          <SegmentedControl height={36} options={SITES} value={site} onChange={setSite} />
          <TextInput
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            autoCorrect={false}
            spellCheck={false}
            placeholder="Public username"
            placeholderTextColor={colors.textDim}
            accessibilityLabel="Chess username"
            testID="import-username"
            style={[styles.field, { color: colors.text }]}
          />
          <Button
            label={scanning ? 'Stop' : 'Find my blunders'}
            onPress={() => {
              void findGames();
            }}
            testID="import-find"
          />
        </View>
      ) : (
        <View style={styles.form}>
          <SegmentedControl height={36} options={COLORS} value={userColor} onChange={setUserColor} />
          <TextInput
            value={pgn}
            onChangeText={setPgn}
            autoCapitalize="none"
            autoCorrect={false}
            spellCheck={false}
            multiline
            placeholder="1. e4 e5 2. Qh5 …"
            placeholderTextColor={colors.textDim}
            accessibilityLabel="PGN"
            testID="import-pgn"
            style={[styles.field, styles.pgn, { color: colors.text }]}
          />
          <Button label="Use this game" variant="secondary" onPress={() => void usePgn()} testID="import-paste" />
        </View>
      )}

      {status || scan.message ? (
        <Text style={text.body} testID="import-status">
          {status || scan.message}
        </Text>
      ) : null}
    </View>
  );
}

const styles = themedStyleSheet((colors) => ({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing[10],
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  tabSwitch: {
    width: 196,
    flexShrink: 0,
  },
  form: {
    gap: spacing[10],
  },
  field: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    borderRadius: radii.md,
    paddingHorizontal: spacing[12],
    paddingVertical: spacing[10],
    fontFamily: fonts.body,
    fontSize: fontSizes[16],
    minHeight: 44,
  },
  pgn: {
    minHeight: 88,
    textAlignVertical: 'top',
  },
}));
