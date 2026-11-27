import { Link, type Href } from 'expo-router';
import { Text, View } from 'react-native';

import { PIECE_CREDIT } from '@/src/components/Board/pieceCredit';
import { BrandMark } from '@/src/components/ui/BrandMark';
import { text } from '@/src/components/ui/text';
import { useTheme } from '@/src/theme/useTheme';
import { themedStyleSheet } from '@/src/theme/themed';
import { fonts, fontSizes, lineHeights, spacing } from '@/src/theme';

const PRIVACY_HREF = '/privacy' as Href;
const TERMS_HREF = '/terms' as Href;
const DELETE_HREF = '/delete-account' as Href;
const PROGRESS_HREF = '/progress' as Href;

type Props = {
  /** Legal pages sit outside the tabs, so they link back to Progress. */
  showProgressLink?: boolean;
};

/**
 * Quiet about row for scrolling pages.
 * Board stages do not render this, so the phone board stays fixed.
 */
export function AboutFooter({ showProgressLink = false }: Props) {
  useTheme();
  return (
    <View style={styles.footer} testID="about-footer">
      <View style={styles.brandRow}>
        <BrandMark size={22} />
        <Text style={text.section}>About</Text>
      </View>
      <Text style={text.muted}>Just Don't Blunder. Play is open with no account.</Text>
      <View style={styles.links}>
        <TextLink href={PRIVACY_HREF} label="Privacy" testID="about-privacy" />
        <Text style={text.muted}>·</Text>
        <TextLink href={TERMS_HREF} label="Terms" testID="about-terms" />
        <Text style={text.muted}>·</Text>
        <TextLink href={DELETE_HREF} label="Delete data" testID="about-delete" />
        {showProgressLink ? (
          <>
            <Text style={text.muted}>·</Text>
            <TextLink href={PROGRESS_HREF} label="Progress" testID="about-progress" />
          </>
        ) : null}
      </View>
      <Text style={text.muted}>{PIECE_CREDIT}</Text>
    </View>
  );
}

function TextLink({ href, label, testID }: { href: Href; label: string; testID: string }) {
  return (
    <Link href={href} testID={testID} style={styles.link}>
      <Text style={styles.linkText}>{label}</Text>
    </Link>
  );
}

const styles = themedStyleSheet((colors) => ({
  footer: {
    width: '100%',
    gap: spacing[6],
    paddingTop: spacing.sm,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  links: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.sm,
  },
  link: {
    paddingVertical: spacing[2],
    cursor: 'pointer',
  },
  linkText: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes[15],
    lineHeight: lineHeights[22],
    color: colors.accent,
  },
}));
