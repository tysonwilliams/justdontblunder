import { themedStyleSheet } from '@/src/theme/themed';
import { typeRole } from '@/src/theme/tokens';

export const text = themedStyleSheet((colors) => ({
  eyebrow: {
    ...typeRole.eyebrow,
    color: colors.accent,
  },
  display: {
    ...typeRole.display,
    color: colors.text,
  },
  title: {
    ...typeRole.title,
    color: colors.text,
  },
  titlePhone: typeRole.titleCompact,
  habit: {
    ...typeRole.habit,
    color: colors.warning,
  },
  habitPhone: typeRole.habitCompact,
  body: {
    ...typeRole.body,
    color: colors.text,
  },
  bodyPhone: typeRole.bodyCompact,
  bodyStrong: {
    ...typeRole.bodyStrong,
    color: colors.text,
  },
  muted: {
    ...typeRole.muted,
    color: colors.textMuted,
  },
  mutedPhone: typeRole.mutedCompact,
  meta: {
    ...typeRole.meta,
    color: colors.text,
  },
  metaPhone: typeRole.metaCompact,
  section: {
    ...typeRole.section,
    color: colors.textMuted,
  },
  hero: {
    ...typeRole.hero,
    color: colors.text,
  },
  heroPhone: typeRole.heroCompact,
  stat: {
    ...typeRole.stat,
    color: colors.text,
  },
}));
