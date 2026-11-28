import { useState } from 'react';
import { Text, View } from 'react-native';

import { LegalPage } from '@/src/components/legal/LegalPage';
import { Button } from '@/src/components/ui/Button';
import { Dialog } from '@/src/components/ui/Dialog';
import { liveA11y } from '@/src/components/ui/a11y';
import { text } from '@/src/components/ui/text';
import { signOutBeforeDeviceErase } from '@/src/auth/deviceSession';
import { loadSupabaseAuth } from '@/src/data/supabaseLazy';
import { useRequestAccountDeletion, type AccountDeletionResult } from '@/src/legal/requestAccountDeletion';
import { eraseDeviceData } from '@/src/store/eraseDeviceData';
import { useAccountStore } from '@/src/auth/session';
import { useTheme } from '@/src/theme/useTheme';
import { themedStyleSheet } from '@/src/theme/themed';
import { fonts, fontSizes, letterSpacing, lineHeights, spacing } from '@/src/theme';

const ERASED = 'Erased. Progress and the scan cursor on this device are gone. You can keep playing as a guest.';
const ERASE_FAILED = 'Could not erase this device. Try again.';
const ACCOUNT_DELETED =
  'Your account, the leaderboard name and scores, and the synced progress are deleted. Progress on this device is erased. You can keep playing as a guest.';
const ACCOUNT_LOCAL_FAILED =
  'The account was deleted, but this device could not be erased. Use Erase my data on this device.';
const ACCOUNT_FAILED = 'The account could not be deleted. You are still signed in. Try again.';
const ACCOUNT_GUEST = 'There is no account on this device to delete.';

type Confirm = 'device' | 'account' | null;

export function DeleteAccount() {
  useTheme();
  const requestDeletion = useRequestAccountDeletion();
  const phase = useAccountStore((state) => state.phase);
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [working, setWorking] = useState(false);
  const [deviceStatus, setDeviceStatus] = useState<string | null>(null);
  const [accountStatus, setAccountStatus] = useState<string | null>(null);

  const erase = async () => {
    if (working) return;
    setWorking(true);
    try {
      const api = await loadSupabaseAuth();
      const ready = await signOutBeforeDeviceErase(api);
      if (ready === 'failed') {
        setDeviceStatus(ERASE_FAILED);
        setConfirm(null);
        return;
      }
      await eraseDeviceData();
      setDeviceStatus(ERASED);
      setConfirm(null);
    } catch {
      setDeviceStatus(ERASE_FAILED);
      setConfirm(null);
    } finally {
      setWorking(false);
    }
  };

  const deleteAccount = async () => {
    if (working) return;
    setWorking(true);
    try {
      const result = await requestDeletion();
      setAccountStatus(accountMessage(result));
      setConfirm(null);
    } finally {
      setWorking(false);
    }
  };

  return (
    <LegalPage eyebrow="Just Don't Blunder" title="Delete data">
      <View style={styles.section}>
        <Text style={text.section}>On this device</Text>
        <Text style={text.body}>
          Erasing removes streaks, XP, lessons, drill results, review history, imported positions, a linked Chess.com
          or Lichess username, and the scan cursor on this device. Appearance and sound stay. You can keep playing
          immediately. If an account is signed in, this also signs out. The synced copy stays until you delete the
          account, including a public leaderboard name and its scores.
        </Text>
        <Button
          label="Erase my data on this device"
          variant="danger"
          testID="erase-device"
          onPress={() => {
            setDeviceStatus(null);
            setConfirm('device');
          }}
        />
        {deviceStatus ? (
          <Text style={text.body} testID="erase-status" {...liveA11y()}>
            {deviceStatus}
          </Text>
        ) : null}
      </View>

      <View style={styles.section}>
        <Text style={text.section}>Account</Text>
        {phase === 'loading' ? <Text style={text.body}>Checking for an account on this device.</Text> : null}
        {phase === 'guest' ? (
          <Text style={text.body}>
            You're playing as a guest, so there is no account to delete. Erasing this device is above.
          </Text>
        ) : null}
        {phase === 'signed-in' ? (
          <>
            <Text style={text.body}>
              Deleting the account removes the profile, linked Chess.com and Lichess usernames, scanned game ids,
              drills, review history, attempts, streak days, and the leaderboard name and scores. The copy on this
              device is erased too. Play stays open as a guest afterwards.
            </Text>
            <Button
              label="Delete my account"
              variant="danger"
              testID="account-delete"
              onPress={() => {
                setAccountStatus(null);
                setConfirm('account');
              }}
            />
          </>
        ) : null}
        {accountStatus ? (
          <Text style={text.body} testID="account-status" {...liveA11y()}>
            {accountStatus}
          </Text>
        ) : null}
      </View>

      <Dialog visible={confirm !== null}>
        {confirm === 'account' ? (
          <>
            <Text style={styles.dialogTitle}>Delete your account?</Text>
            <Text style={styles.dialogBody}>
              This deletes the account, the leaderboard name and scores, and the synced progress, then erases the
              copy on this device. You can keep playing as a guest. This cannot be undone.
            </Text>
            <Button
              label={working ? 'Deleting' : 'Delete account'}
              variant="danger"
              testID="account-delete-confirm"
              onPress={() => {
                void deleteAccount();
              }}
            />
            <Button
              label="Cancel"
              variant="ghost"
              testID="account-delete-cancel"
              onPress={() => {
                if (working) return;
                setConfirm(null);
              }}
            />
          </>
        ) : (
          <>
            <Text style={styles.dialogTitle}>Erase data on this device?</Text>
            <Text style={styles.dialogBody}>
              Progress and the scan cursor stored here will be removed. This cannot be undone. Appearance and sound
              stay.
            </Text>
            <Button
              label={working ? 'Erasing' : 'Erase'}
              variant="danger"
              testID="erase-confirm"
              onPress={() => {
                void erase();
              }}
            />
            <Button
              label="Cancel"
              variant="ghost"
              testID="erase-cancel"
              onPress={() => {
                if (working) return;
                setConfirm(null);
              }}
            />
          </>
        )}
      </Dialog>
    </LegalPage>
  );
}

function accountMessage(result: AccountDeletionResult): string {
  switch (result.status) {
    case 'deleted':
      return ACCOUNT_DELETED;
    case 'deleted-local-failed':
      return ACCOUNT_LOCAL_FAILED;
    case 'guest':
      return ACCOUNT_GUEST;
    case 'failed':
      return ACCOUNT_FAILED;
    default: {
      const _exhaustive: never = result;
      return _exhaustive;
    }
  }
}

const styles = themedStyleSheet((colors) => ({
  section: {
    gap: spacing.sm,
  },
  dialogTitle: {
    fontFamily: fonts.display,
    fontSize: fontSizes[24],
    lineHeight: lineHeights[30],
    color: colors.text,
    textAlign: 'center',
    letterSpacing: letterSpacing.tight,
  },
  dialogBody: {
    fontFamily: fonts.body,
    fontSize: fontSizes[15],
    lineHeight: lineHeights[22],
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
}));
