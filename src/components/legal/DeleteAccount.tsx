import { useState } from 'react';
import { Text, View } from 'react-native';

import { LegalPage } from '@/src/components/legal/LegalPage';
import { Button } from '@/src/components/ui/Button';
import { Dialog } from '@/src/components/ui/Dialog';
import { liveA11y } from '@/src/components/ui/a11y';
import { text } from '@/src/components/ui/text';
import { useRequestAccountDeletion } from '@/src/legal/requestAccountDeletion';
import { eraseDeviceData } from '@/src/store/eraseDeviceData';
import { useTheme } from '@/src/theme/useTheme';
import { themedStyleSheet } from '@/src/theme/themed';
import { fonts, fontSizes, letterSpacing, lineHeights, spacing } from '@/src/theme';

const ERASED = 'Erased. Progress and the scan cursor on this device are gone. You can keep playing as a guest.';
const ERASE_FAILED = 'Could not erase this device. Try again.';
const ACCOUNT_UNAVAILABLE =
  'Account deletion is not available yet. When you can sign in, this page will delete the account and all synced data.';

export function DeleteAccount() {
  useTheme();
  const requestDeletion = useRequestAccountDeletion();
  const [confirming, setConfirming] = useState(false);
  const [working, setWorking] = useState(false);
  const [deviceStatus, setDeviceStatus] = useState<string | null>(null);
  const [accountStatus, setAccountStatus] = useState<string | null>(null);
  const [accountBusy, setAccountBusy] = useState(false);

  const erase = async () => {
    if (working) return;
    setWorking(true);
    try {
      await eraseDeviceData();
      setDeviceStatus(ERASED);
      setConfirming(false);
    } catch {
      setDeviceStatus(ERASE_FAILED);
      setConfirming(false);
    } finally {
      setWorking(false);
    }
  };

  const askForAccountDeletion = async () => {
    if (accountBusy) return;
    setAccountBusy(true);
    try {
      const result = await requestDeletion();
      switch (result.status) {
        case 'unavailable':
          setAccountStatus(ACCOUNT_UNAVAILABLE);
          break;
        default: {
          const _exhaustive: never = result.status;
          setAccountStatus(_exhaustive);
        }
      }
    } finally {
      setAccountBusy(false);
    }
  };

  return (
    <LegalPage eyebrow="Just Don't Blunder" title="Delete data">
      <View style={styles.section}>
        <Text style={text.section}>On this device</Text>
        <Text style={text.body}>
          Guest progress is stored in this browser or on this device. Erasing it removes streaks, XP, lessons, drill
          results, review history, imported positions, a linked Chess.com or Lichess username, and the scan cursor.
          Appearance and sound stay. You can keep playing immediately, with no account. Home will ask where to start
          the next time it opens.
        </Text>
        <Button
          label="Erase my data on this device"
          variant="danger"
          testID="erase-device"
          onPress={() => {
            setDeviceStatus(null);
            setConfirming(true);
          }}
        />
        {deviceStatus ? (
          <Text style={text.body} testID="erase-status" {...liveA11y()}>
            {deviceStatus}
          </Text>
        ) : null}
      </View>

      <View style={styles.section}>
        <Text style={text.section}>Accounts, coming soon</Text>
        <Text style={text.body}>
          There is no account to delete yet. Signed-in users will be able to delete their account and all synced data
          from this page. That synced data is the profile (display name and timezone), linked Chess.com and Lichess
          usernames, scanned game ids, drills, review history, attempts, and streak days.
        </Text>
        <Button
          label="Delete my account"
          variant="secondary"
          testID="account-delete"
          onPress={() => {
            void askForAccountDeletion();
          }}
        />
        {accountStatus ? (
          <Text style={text.body} testID="account-status" {...liveA11y()}>
            {accountStatus}
          </Text>
        ) : null}
      </View>

      <Dialog visible={confirming}>
        <Text style={styles.dialogTitle}>Erase data on this device?</Text>
        <Text style={styles.dialogBody}>
          Progress and the scan cursor stored here will be removed. This cannot be undone. Appearance and sound stay.
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
            setConfirming(false);
          }}
        />
      </Dialog>
    </LegalPage>
  );
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
