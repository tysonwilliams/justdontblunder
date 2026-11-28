import { useEffect, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { controlA11y } from '@/src/components/ui/a11y';
import { Button } from '@/src/components/ui/Button';
import { SegmentedControl } from '@/src/components/ui/Chip';
import { playUnlocked } from '@/src/logic/earlyPlay';
import { cleanUsername, type GameSite } from '@/src/logic/gameImport';
import { cancelOwnScan, runOwnScan } from '@/src/store/ownGames';
import { useProgressStore } from '@/src/store/progress';
import { themedStyleSheet } from '@/src/theme/themed';
import { useTheme } from '@/src/theme/useTheme';
import { fonts, fontSizes, lineHeights, radii, spacing } from '@/src/theme';

const SITES: readonly { id: GameSite; label: string; testID: string }[] = [
  { id: 'chesscom', label: 'Chess.com', testID: 'connect-site-chesscom' },
  { id: 'lichess', label: 'Lichess', testID: 'connect-site-lichess' },
];

function siteLabel(site: GameSite): string {
  return site === 'chesscom' ? 'Chess.com' : 'Lichess';
}

type Props = {
  /** Called when the user taps the play/drill CTA once personal blunders are available. */
  onDrill?: () => void;
  /** Label for the ready-to-drill CTA. */
  drillLabel?: string;
  /** Optional callback to open the Progress screen for pasting a PGN. */
  onOpenPgn?: () => void;
  /** Prefix for testIDs so Settings and Drills sheets stay uniquely addressable. */
  testIDPrefix?: string;
};

/**
 * Compact public Chess.com / Lichess account importer.
 * Pulls recent game blunders in the background with no password required.
 */
export function ChessAccountForm({
  onDrill,
  drillLabel = 'Drill my blunders',
  onOpenPgn,
  testIDPrefix = 'chess-connect',
}: Props) {
  const { colors } = useTheme();
  const profile = useProgressStore((state) => state.gameProfile);
  const ownDrills = useProgressStore((state) => state.ownDrills);
  const scan = useProgressStore((state) => state.scan);
  const [site, setSite] = useState<GameSite>(profile?.site ?? 'chesscom');
  const [username, setUsername] = useState(profile?.username ?? '');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setSite(profile.site);
    setUsername(profile.username);
  }, [profile]);

  const scanning = scan.phase === 'scanning';
  const failed = scan.phase === 'error';
  const unlocked = playUnlocked({ found: scan.found, incoming: scan.incoming, failed });
  const canDrillNow = Boolean(onDrill) && (ownDrills.length > 0 || (scanning && unlocked));
  const sameProfile =
    profile != null &&
    profile.site === site &&
    cleanUsername(username)?.toLowerCase() === profile.username.toLowerCase();

  const submit = async () => {
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

  const liveStatus =
    status ||
    (scanning && scan.incoming && unlocked
      ? `${scan.message} Ready to drill while the rest load.`
      : scan.message);

  return (
    <View style={styles.wrap} testID={testIDPrefix}>
      {profile ? (
        <View style={styles.connectedRow} testID={`${testIDPrefix}-connected`}>
          <Text style={styles.connectedText} numberOfLines={1}>
            {profile.username} · {siteLabel(profile.site)}
          </Text>
          <Text style={styles.connectedCount} numberOfLines={1}>
            {ownDrills.length} {ownDrills.length === 1 ? 'blunder' : 'blunders'}
          </Text>
        </View>
      ) : null}

      <SegmentedControl
        height={34}
        options={SITES.map((item) => ({ ...item, testID: `${testIDPrefix}-${item.id}` }))}
        value={site}
        onChange={setSite}
      />

      <TextInput
        value={username}
        onChangeText={(next) => {
          setUsername(next);
          if (status) setStatus('');
        }}
        onSubmitEditing={() => void submit()}
        returnKeyType="go"
        autoCapitalize="none"
        autoCorrect={false}
        spellCheck={false}
        placeholder="Public username (no password)"
        placeholderTextColor={colors.textDim}
        accessibilityLabel="Chess.com or Lichess username"
        testID={`${testIDPrefix}-username`}
        style={[styles.field, { color: colors.text }]}
      />

      <View style={styles.actions}>
        <Button
          compact
          label={scanning ? 'Stop scan' : sameProfile ? 'Scan for newer games' : 'Pull recent blunders'}
          variant={canDrillNow && sameProfile && !scanning ? 'secondary' : 'primary'}
          testID={`${testIDPrefix}-submit`}
          onPress={() => void submit()}
        />
        {canDrillNow && onDrill ? (
          <Button
            compact
            label={scanning ? 'Start drilling now' : drillLabel}
            variant={scanning || sameProfile ? 'primary' : 'secondary'}
            testID={`${testIDPrefix}-drill`}
            onPress={onDrill}
          />
        ) : null}
      </View>

      {liveStatus ? (
        <Text style={styles.status} testID={`${testIDPrefix}-status`}>
          {liveStatus}
        </Text>
      ) : null}

      {onOpenPgn ? (
        <Pressable
          {...controlA11y('button', 'Or paste a PGN in Progress')}
          testID={`${testIDPrefix}-pgn`}
          onPress={onOpenPgn}
          style={(state) => [styles.pgnLink, state.pressed && styles.pgnPressed]}>
          <Text style={styles.pgnLinkText}>Or paste a PGN in Progress →</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = themedStyleSheet((colors) => ({
  wrap: {
    gap: spacing[8],
  },
  connectedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingHorizontal: spacing[10],
    paddingVertical: spacing[6],
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
  },
  connectedText: {
    flex: 1,
    minWidth: 0,
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes[13],
    lineHeight: lineHeights[18],
    color: colors.text,
  },
  connectedCount: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes[12],
    lineHeight: lineHeights[16],
    color: colors.accent,
  },
  field: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    borderRadius: radii.md,
    paddingHorizontal: spacing[12],
    paddingVertical: spacing[8],
    fontFamily: fonts.body,
    fontSize: fontSizes[15],
    minHeight: 40,
  },
  actions: {
    gap: spacing[6],
  },
  status: {
    fontFamily: fonts.body,
    fontSize: fontSizes[13],
    lineHeight: lineHeights[18],
    color: colors.textMuted,
  },
  pgnLink: {
    alignSelf: 'flex-start',
    paddingVertical: spacing[2],
    cursor: 'pointer',
  },
  pgnPressed: {
    opacity: 0.75,
  },
  pgnLinkText: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes[12],
    lineHeight: lineHeights[16],
    color: colors.textMuted,
  },
}));
