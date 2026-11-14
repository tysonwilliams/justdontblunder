import { Link, type Href } from 'expo-router';
import { Text, View } from 'react-native';

import { LegalPage } from '@/src/components/legal/LegalPage';
import { text } from '@/src/components/ui/text';
import {
  OWNER_CONTACT_LABEL,
  OWNER_CONTACT_NOTE,
  OWNER_CONTACT_PLACEHOLDER,
  PRIVACY_EFFECTIVE_DATE,
  privacyIntro,
  privacySections,
  type PrivacyBlock,
} from '@/src/legal/privacyPolicy';
import { useTheme } from '@/src/theme/useTheme';
import { themedStyleSheet } from '@/src/theme/themed';
import { fonts, fontSizes, lineHeights, radii, spacing } from '@/src/theme';

export function PrivacyPolicy() {
  useTheme();
  return (
    <LegalPage eyebrow="Just Don't Blunder" title="Privacy">
      <Text style={text.muted} testID="privacy-effective">
        Effective {PRIVACY_EFFECTIVE_DATE}.
      </Text>
      <Text style={text.body}>{privacyIntro}</Text>
      {privacySections.map((section) => (
        <View key={section.heading} style={styles.section}>
          <Text style={text.section}>{section.heading}</Text>
          {section.blocks.map((block, index) => (
            <PrivacyBlockView key={`${section.heading}-${index}`} block={block} />
          ))}
        </View>
      ))}
      <View
        style={styles.placeholder}
        testID="owner-contact-placeholder"
        accessibilityLabel={`${OWNER_CONTACT_LABEL}. ${OWNER_CONTACT_NOTE}`}>
        <Text style={styles.placeholderNote}>{OWNER_CONTACT_NOTE}</Text>
        <Text style={text.meta}>{OWNER_CONTACT_LABEL}</Text>
        <Text style={styles.placeholderValue} selectable>
          {OWNER_CONTACT_PLACEHOLDER}
        </Text>
      </View>
    </LegalPage>
  );
}

function PrivacyBlockView({ block }: { block: PrivacyBlock }) {
  switch (block.kind) {
    case 'paragraph':
      return <Text style={text.body}>{block.text}</Text>;
    case 'list':
      return (
        <View style={styles.list}>
          {block.items.map((item) => (
            <Text key={item} style={text.body}>
              {'·  '}
              {item}
            </Text>
          ))}
        </View>
      );
    case 'link':
      return (
        <Link href={block.href as Href} testID="privacy-delete-link" style={styles.link}>
          <Text style={styles.linkText}>{block.label}</Text>
        </Link>
      );
    default: {
      const _exhaustive: never = block;
      return _exhaustive;
    }
  }
}

const styles = themedStyleSheet((colors) => ({
  section: {
    gap: spacing.sm,
  },
  list: {
    gap: spacing[6],
  },
  link: {
    alignSelf: 'flex-start',
    paddingVertical: spacing[2],
    cursor: 'pointer',
  },
  linkText: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes[16],
    lineHeight: lineHeights[24],
    color: colors.accent,
  },
  placeholder: {
    gap: spacing[6],
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.warning,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing[14],
  },
  placeholderNote: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes[13],
    lineHeight: lineHeights[18],
    color: colors.warning,
  },
  placeholderValue: {
    fontFamily: 'SpaceMono',
    fontSize: fontSizes[14],
    lineHeight: lineHeights[22],
    color: colors.text,
  },
}));
