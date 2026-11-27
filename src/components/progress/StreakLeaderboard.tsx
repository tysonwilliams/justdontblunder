import { useEffect, useRef, useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';

import { Button } from '@/src/components/ui/Button';
import { liveA11y } from '@/src/components/ui/a11y';
import { SettingSwitch } from '@/src/components/ui/SettingSwitch';
import { Bone } from '@/src/components/ui/Skeleton';
import { text } from '@/src/components/ui/text';
import { useLayout } from '@/src/components/ui/useLayout';
import {
  loadLeaderboardPage,
  saveLeaderboardName,
  type LeaderboardPage,
  type LeaderboardRow,
} from '@/src/data/leaderboard';
import { useAccountStore } from '@/src/auth/session';
import { checkDisplayName, DISPLAY_NAME_MAX } from '@/src/logic/displayName';
import { drillHref } from '@/src/logic/drillLink';
import { useProgressStore } from '@/src/store/progress';
import { useTheme } from '@/src/theme/useTheme';
import { themedStyleSheet } from '@/src/theme/themed';
import { fonts, fontSizes, radii, spacing } from '@/src/theme';

const NO_SERVER = 'This build has no leaderboard server. Your best stays on this device.';
const UNAVAILABLE = 'The public board is not available right now. Your best stays on this device.';
const GUEST_NOTE =
  'Sign in to post a score. The board shows a name you choose. It does not show your email. Play stays open without an account.';

type ViewProps = {
  best: number;
  signedIn: boolean;
  loading: boolean;
  configured: boolean;
  unavailable: boolean;
  week: readonly LeaderboardRow[];
  allTime: readonly LeaderboardRow[];
  name: string;
  optedIn: boolean;
  notice: string | null;
  saving: boolean;
  onName: (value: string) => void;
  onOptIn: (value: boolean) => void;
  onSave: () => void;
  onPlay: () => void;
};

export function StreakLeaderboard() {
  const router = useRouter();
  const phase = useAccountStore((state) => state.phase);
  const best = useProgressStore((state) => state.bestPuzzleStreak);
  const [page, setPage] = useState<LeaderboardPage | null>(null);
  const [name, setName] = useState('');
  const [optedIn, setOptedIn] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const dirty = useRef(false);

  useEffect(() => {
    if (phase === 'loading') return;
    let current = true;
    void loadLeaderboardPage().then((next) => {
      if (!current) return;
      setPage(next);
      if (dirty.current) return;
      setName(next.name);
      setOptedIn(next.optedIn);
    });
    return () => {
      current = false;
    };
  }, [phase]);

  const save = () => {
    if (saving) return;
    const checked = checkDisplayName(name);
    if (!checked.ok) {
      setNotice(checked.message);
      return;
    }
    setSaving(true);
    setNotice(null);
    void saveLeaderboardName(checked.name, optedIn).then((result) => {
      setSaving(false);
      if (!result.ok) {
        setNotice(result.message);
        return;
      }
      setName(checked.name);
      setNotice(optedIn ? 'You are on the board.' : 'Saved. The board stays off until you turn it on.');
    });
  };

  return (
    <StreakLeaderboardView
      best={best}
      signedIn={phase === 'signed-in'}
      loading={page === null}
      configured={page?.configured ?? false}
      unavailable={page?.unavailable ?? false}
      week={page?.week ?? []}
      allTime={page?.allTime ?? []}
      name={name}
      optedIn={optedIn}
      notice={notice}
      saving={saving}
      onName={(value) => {
        dirty.current = true;
        setName(value);
      }}
      onOptIn={(value) => {
        dirty.current = true;
        setOptedIn(value);
      }}
      onSave={save}
      onPlay={() => {
        router.push(drillHref('play', 'all', true) as Href);
      }}
    />
  );
}

export function StreakLeaderboardView({
  best,
  signedIn,
  loading,
  configured,
  unavailable,
  week,
  allTime,
  name,
  optedIn,
  notice,
  saving,
  onName,
  onOptIn,
  onSave,
  onPlay,
}: ViewProps) {
  const { colors } = useTheme();
  const { phone } = useLayout();
  const boardsReady = !loading && configured && !unavailable;
  return (
    <View style={styles.card} testID="leaderboard">
      <View style={styles.top}>
        <View style={styles.topCopy}>
          <Text style={text.section}>Streak leaderboard</Text>
          <Text style={text.bodyStrong} testID="leaderboard-local-best">
            Best on this device: {best}
          </Text>
        </View>
        <Button compact label="Play Streak" fullWidth={false} testID="leaderboard-play" onPress={onPlay} />
      </View>

      <Text style={text.muted}>
        Positions come one after another. The first blunder ends the run. Any safe move passes.
      </Text>

      {signedIn ? (
        <View style={styles.form}>
          <View style={styles.inputRow}>
            <TextInput
              value={name}
              onChangeText={onName}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="off"
              spellCheck={false}
              maxLength={DISPLAY_NAME_MAX}
              placeholder="Public name"
              placeholderTextColor={colors.textDim}
              accessibilityLabel="Public display name"
              testID="leaderboard-name"
              style={[styles.field, { color: colors.text }]}
            />
            <Button
              compact
              variant="secondary"
              fullWidth={false}
              label={saving ? 'Saving' : 'Save'}
              testID="leaderboard-save"
              onPress={onSave}
            />
          </View>
          <SettingSwitch
            plain
            label="Show on the leaderboard"
            value={optedIn}
            testID="leaderboard-opt-in"
            onChange={onOptIn}
          />
          <Text style={text.muted}>
            {optedIn
              ? 'The board shows this name and your score. It does not show your email.'
              : 'Off until you turn it on. The board shows the name, not your email.'}
          </Text>
        </View>
      ) : loading ? null : (
        <Text style={text.muted}>{GUEST_NOTE}</Text>
      )}
      {notice ? (
        <Text style={text.body} testID="leaderboard-notice" {...liveA11y()}>
          {notice}
        </Text>
      ) : null}
      {loading ? <Bone height={16} /> : null}
      {!loading && !configured ? <Text style={text.muted}>{NO_SERVER}</Text> : null}
      {!loading && configured && unavailable ? <Text style={text.muted}>{UNAVAILABLE}</Text> : null}
      {boardsReady ? (
        <View style={[styles.boards, !phone && styles.boardsWide]}>
          <BoardList
            title="This week"
            detail="Resets Monday at 00:00 UTC"
            testID="leaderboard-week"
            rows={week}
          />
          <BoardList title="All-time best" detail="Highest run posted" testID="leaderboard-all-time" rows={allTime} />
        </View>
      ) : null}
    </View>
  );
}

function BoardList({
  title,
  detail,
  testID,
  rows,
}: {
  title: string;
  detail: string;
  testID: string;
  rows: readonly LeaderboardRow[];
}) {
  const visible = rows.filter((row) => !row.displayName.includes('@'));
  return (
    <View style={styles.board} testID={testID}>
      <Text style={text.bodyStrong}>{title}</Text>
      <Text style={text.muted}>{detail}</Text>
      {visible.length === 0 ? <Text style={text.muted}>No public scores yet.</Text> : null}
      {visible.map((row, index) => (
        <View key={`${row.displayName}-${index}`} style={styles.row}>
          <Text style={styles.rank} numberOfLines={1}>
            {index + 1}. {row.displayName}
          </Text>
          <Text style={styles.score}>{row.score}</Text>
        </View>
      ))}
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
    gap: spacing[12],
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  topCopy: {
    flex: 1,
    minWidth: 0,
    gap: spacing[2],
  },
  form: {
    gap: spacing[6],
    paddingTop: spacing[4],
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  field: {
    flex: 1,
    minWidth: 0,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    borderRadius: radii.md,
    paddingHorizontal: spacing[12],
    paddingVertical: spacing.sm,
    fontFamily: fonts.body,
    fontSize: fontSizes[15],
    minHeight: 40,
  },
  boards: {
    gap: spacing.sm,
  },
  boardsWide: {
    flexDirection: 'row',
  },
  board: {
    flex: 1,
    minWidth: 0,
    gap: spacing[4],
    backgroundColor: colors.background,
    borderRadius: radii.md,
    paddingHorizontal: spacing[12],
    paddingVertical: spacing[12],
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    minHeight: 28,
  },
  rank: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: fontSizes[15],
    color: colors.text,
  },
  score: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes[15],
    color: colors.text,
  },
}));
