import { Link, type Href } from 'expo-router';
import { Linking, Pressable, Text, View } from 'react-native';

import { text } from '@/src/components/ui/text';
import type { LegalBlock, LegalSection } from '@/src/legal/blocks';
import { useTheme } from '@/src/theme/useTheme';
import { themedStyleSheet } from '@/src/theme/themed';
import { fonts, fontSizes, lineHeights, spacing } from '@/src/theme';

type Props = {
  effective: string;
  effectiveTestID: string;
  intro: string;
  sections: readonly LegalSection[];
};

export function LegalDocument({ effective, effectiveTestID, intro, sections }: Props) {
  useTheme();
  return (
    <View style={styles.doc}>
      <Text style={text.muted} testID={effectiveTestID}>
        Effective {effective}.
      </Text>
      <Text style={text.body}>{intro}</Text>
      {sections.map((section) => (
        <View key={section.heading} style={styles.section}>
          <Text style={text.title} accessibilityRole="header">
            {section.heading}
          </Text>
          {section.blocks.map((block, index) => (
            <LegalBlockView key={`${section.heading}-${index}`} block={block} />
          ))}
        </View>
      ))}
    </View>
  );
}

function LegalBlockView({ block }: { block: LegalBlock }) {
  switch (block.kind) {
    case 'paragraph':
      return <Text style={text.body}>{block.text}</Text>;
    case 'subheading':
      return (
        <Text style={text.bodyStrong} accessibilityRole="header">
          {block.text}
        </Text>
      );
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
        <Link href={block.href as Href} testID={block.testID} style={styles.link}>
          <Text style={styles.linkText}>{block.label}</Text>
        </Link>
      );
    case 'mail':
      return (
        <Pressable
          accessibilityRole="link"
          testID={block.testID}
          style={styles.link}
          onPress={() => {
            void Linking.openURL(`mailto:${block.email}`);
          }}>
          <Text style={styles.linkText} selectable>
            {block.email}
          </Text>
        </Pressable>
      );
    default: {
      const _exhaustive: never = block;
      return _exhaustive;
    }
  }
}

const styles = themedStyleSheet((colors) => ({
  doc: {
    width: '100%',
    gap: spacing[20],
  },
  section: {
    width: '100%',
    gap: spacing.sm,
  },
  list: {
    width: '100%',
    gap: spacing[6],
  },
  link: {
    alignSelf: 'flex-start',
    maxWidth: '100%',
    paddingVertical: spacing[2],
    cursor: 'pointer',
  },
  linkText: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes[16],
    lineHeight: lineHeights[24],
    color: colors.accent,
  },
}));
