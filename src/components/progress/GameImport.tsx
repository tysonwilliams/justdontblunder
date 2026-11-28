import { useRouter, type Href } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Linking, Pressable, Text, TextInput, View } from 'react-native';
import type { Color } from 'chess.js';

import { MiniBoard } from '@/src/components/Board/MiniBoard';
import { controlA11y } from '@/src/components/ui/a11y';
import { Button } from '@/src/components/ui/Button';
import { SegmentedControl } from '@/src/components/ui/Chip';
import { IconChevronDown } from '@/src/components/ui/icons';
import { text } from '@/src/components/ui/text';
import { drillHref, themeFilterLabel } from '@/src/logic/drillLink';
import { personalSourceLabel, themeLabel, type DrillTheme } from '@/src/logic/drills';
import { cleanUsername, type GameSite } from '@/src/logic/gameImport';
import { poolSummary } from '@/src/logic/puzzlePool';
import { analyzePastedPgn } from '@/src/logic/scanWorkerClient';
import { cancelOwnScan, runOwnScan } from '@/src/store/ownGames';
import { useProgressStore } from '@/src/store/progress';
import { useTheme } from '@/src/theme/useTheme';
import { themedStyleSheet } from '@/src/theme/themed';
import { fonts, fontSizes, lineHeights, radii, spacing } from '@/src/theme';

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

const THEME_KEYS: readonly DrillTheme[] = ['hanging', 'fork', 'pin', 'back_rank', 'missed_mate'];

export function GameImport() {
  const router = useRouter();
  const { colors } = useTheme();
  const profile = useProgressStore((state) => state.gameProfile);
  const ownDrills = useProgressStore((state) => state.ownDrills);
  const scan = useProgressStore((state) => state.scan);
  const mergeImportedDrills = useProgressStore((state) => state.mergeImportedDrills);
  const clearGameProfile = useProgressStore((state) => state.clearGameProfile);
  const [tab, setTab] = useState<ImportTab>('username');
  const [site, setSite] = useState<GameSite>(profile?.site ?? 'chesscom');
  const [username, setUsername] = useState(profile?.username ?? '');
  const [pgn, setPgn] = useState('');
  const [userColor, setUserColor] = useState<Color>('w');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [showRecent, setShowRecent] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setSite(profile.site);
    setUsername(profile.username);
  }, [profile]);

  const scanning = scan.phase === 'scanning';

  const breakdown = useMemo(() => {
    const counts: Record<DrillTheme, number> = {
      hanging: 0,
      fork: 0,
      pin: 0,
      back_rank: 0,
      missed_mate: 0,
    };
    for (const drill of ownDrills) {
      counts[drill.theme] = (counts[drill.theme] ?? 0) + 1;
    }
    return THEME_KEYS.map((theme) => ({ theme, count: counts[theme] }))
      .filter((item) => item.count > 0)
      .sort((a, b) => b.count - a.count);
  }, [ownDrills]);

  const perGame = scan.games > 0 ? (ownDrills.length / scan.games).toFixed(1) : null;
  const recentBlunders = useMemo(() => ownDrills.slice(0, 6), [ownDrills]);

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

  const disconnect = () => {
    cancelOwnScan();
    clearGameProfile();
    setUsername('');
    setStatus('Account disconnected.');
  };

  const applyPgn = async () => {
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
            returnKeyType="search"
            onSubmitEditing={() => {
              void findGames();
            }}
            placeholder="Public username"
            placeholderTextColor={colors.textDim}
            accessibilityLabel="Chess username"
            testID="import-username"
            style={[styles.field, { color: colors.text }]}
          />
          <View style={styles.formActions}>
            <Button
              label={scanning ? 'Stop' : profile ? 'Scan for newer games' : 'Find my blunders'}
              onPress={() => {
                void findGames();
              }}
              testID="import-find"
              style={styles.formActionGrow}
            />
            {profile && !scanning ? (
              <Button
                variant="ghost"
                fullWidth={false}
                label="Disconnect"
                testID="import-disconnect"
                onPress={disconnect}
              />
            ) : null}
          </View>
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
          <Button label="Use this game" variant="secondary" onPress={() => void applyPgn()} testID="import-paste" />
        </View>
      )}

      {status || scan.message ? (
        <Text style={text.body} testID="import-status">
          {status || scan.message}
        </Text>
      ) : null}

      {ownDrills.length > 0 || scan.games > 0 ? (
        <View style={styles.lab} testID="blunder-lab">
          <View style={styles.labStats}>
            {scan.games > 0 ? (
              <View style={styles.labStat}>
                <Text style={styles.labValue}>{scan.games}</Text>
                <Text style={styles.labLabel}>Games scanned</Text>
              </View>
            ) : null}
            <View style={styles.labStat}>
              <Text style={styles.labValue}>{ownDrills.length}</Text>
              <Text style={styles.labLabel}>Personal puzzles</Text>
            </View>
            {perGame ? (
              <View style={styles.labStat}>
                <Text style={styles.labValue}>{perGame}</Text>
                <Text style={styles.labLabel}>Blunders / game</Text>
              </View>
            ) : null}
          </View>

          {breakdown.length > 0 ? (
            <View style={styles.blindSpotWrap}>
              <Text style={styles.blindSpotTitle}>Your top blind spots — tap to drill</Text>
              <View style={styles.pillRow}>
                {breakdown.map((item, idx) => (
                  <Pressable
                    key={item.theme}
                    {...controlA11y('button', `Drill ${themeFilterLabel(item.theme)}, ${item.count} personal puzzles`)}
                    testID={`personal-theme-${item.theme}`}
                    onPress={() => router.push(drillHref('play', item.theme, false, 'own') as Href)}
                    style={(state) => {
                      const hovered = 'hovered' in state && Boolean(state.hovered);
                      return [
                        styles.themePill,
                        idx === 0 && styles.themePillTop,
                        (hovered || state.pressed) && styles.themePillHover,
                      ];
                    }}>
                    <Text style={[styles.themePillLabel, idx === 0 && styles.themePillLabelTop]}>
                      {themeFilterLabel(item.theme)} · {item.count}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}

          {ownDrills.length > 0 ? (
            <Button
              compact
              variant="secondary"
              label="Drill your blunders"
              testID="drill-own-blunders"
              onPress={() => router.push(drillHref('play', 'all', false, 'own') as Href)}
            />
          ) : null}

          {recentBlunders.length > 0 ? (
            <View style={styles.recentWrap}>
              <Pressable
                {...controlA11y('button', showRecent ? 'Hide recent blunders' : 'Show recent blunders', showRecent)}
                testID="recent-blunders-toggle"
                onPress={() => setShowRecent((open) => !open)}
                style={(state) => {
                  const hovered = 'hovered' in state && Boolean(state.hovered);
                  return [styles.recentToggle, (hovered || state.pressed) && styles.recentToggleHover];
                }}>
                <Text style={styles.recentToggleText}>
                  {showRecent ? 'Hide recent blunders' : `Browse recent blunders (${ownDrills.length})`}
                </Text>
                <View style={showRecent ? styles.chevronUp : undefined}>
                  <IconChevronDown color={colors.textMuted} size={14} />
                </View>
              </Pressable>
              {showRecent ? (
                <View style={styles.recentList} testID="recent-blunders-list">
                  {recentBlunders.map((drill) => {
                    const label = personalSourceLabel(drill);
                    return (
                      <View key={drill.id} style={styles.recentItem}>
                        <MiniBoard
                          fen={drill.fen}
                          size={56}
                          orientation={drill.sideToMove === 'b' ? 'black' : 'white'}
                        />
                        <View style={styles.recentCopy}>
                          <Text style={styles.recentTitle} numberOfLines={1}>
                            {themeLabel(drill.theme)}
                            {drill.source?.move ? ` · ${drill.source.move}` : ''}
                          </Text>
                          <Text style={styles.recentNote} numberOfLines={2}>
                            {drill.note}
                          </Text>
                          <View style={styles.recentLinks}>
                            {label ? (
                              <Text style={styles.recentMeta} numberOfLines={1}>
                                {label}
                              </Text>
                            ) : null}
                            {drill.source?.url ? (
                              <Pressable
                                {...controlA11y('link', `Open game ${label ?? ''}`)}
                                onPress={() => {
                                  if (drill.source?.url) void Linking.openURL(drill.source.url);
                                }}>
                                <Text style={styles.recentLink}>Game ↗</Text>
                              </Pressable>
                            ) : null}
                          </View>
                        </View>
                      </View>
                    );
                  })}
                </View>
              ) : null}
            </View>
          ) : null}
        </View>
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
  formActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[8],
  },
  formActionGrow: {
    flex: 1,
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
  lab: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing[12],
    gap: spacing[10],
  },
  labStats: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  labStat: {
    flex: 1,
    backgroundColor: colors.background,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing[10],
    paddingHorizontal: spacing[10],
    gap: spacing[2],
  },
  labValue: {
    fontFamily: fonts.display,
    fontSize: fontSizes[20],
    lineHeight: lineHeights[24],
    color: colors.text,
  },
  labLabel: {
    fontFamily: fonts.body,
    fontSize: fontSizes[12],
    lineHeight: lineHeights[16],
    color: colors.textMuted,
  },
  blindSpotWrap: {
    gap: spacing[6],
  },
  blindSpotTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes[13],
    lineHeight: lineHeights[18],
    color: colors.textMuted,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[6],
  },
  themePill: {
    paddingHorizontal: spacing[10],
    paddingVertical: spacing[5],
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.background,
    cursor: 'pointer',
  },
  themePillTop: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
  },
  themePillHover: {
    opacity: 0.85,
  },
  themePillLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes[12],
    lineHeight: lineHeights[16],
    color: colors.text,
  },
  themePillLabelTop: {
    color: colors.accent,
  },
  recentWrap: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing[8],
    gap: spacing[8],
  },
  recentToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing[4],
    cursor: 'pointer',
  },
  recentToggleHover: {
    opacity: 0.8,
  },
  recentToggleText: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes[13],
    lineHeight: lineHeights[18],
    color: colors.textMuted,
  },
  chevronUp: {
    transform: [{ rotate: '180deg' }],
  },
  recentList: {
    gap: spacing[8],
  },
  recentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[10],
    padding: spacing[8],
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  recentCopy: {
    flex: 1,
    minWidth: 0,
    gap: spacing[2],
  },
  recentTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes[13],
    lineHeight: lineHeights[18],
    color: colors.text,
  },
  recentNote: {
    fontFamily: fonts.body,
    fontSize: fontSizes[12],
    lineHeight: lineHeights[16],
    color: colors.textMuted,
  },
  recentLinks: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[6],
  },
  recentMeta: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: fontSizes[11],
    lineHeight: lineHeights[14],
    color: colors.textDim,
  },
  recentLink: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes[12],
    lineHeight: lineHeights[16],
    color: colors.accent,
  },
}));
