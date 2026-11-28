import { useRouter, type Href } from 'expo-router';
import { Linking, Pressable, Text, View } from 'react-native';

import { BlunderOverlay } from '@/src/components/Board/BlunderOverlay';
import { ChessBoard } from '@/src/components/Board/ChessBoard';
import { Welcome } from '@/src/components/home/Welcome';
import { useHomeTrainer } from '@/src/components/home/useHomeTrainer';
import { MenuButton } from '@/src/components/SettingsMenu';
import { StreakBadge } from '@/src/components/StreakBadge';
import { DueTodayLink } from '@/src/components/review/DueTodayLink';
import { controlA11y } from '@/src/components/ui/a11y';
import { BoardLead } from '@/src/components/ui/BoardLead';
import { Button } from '@/src/components/ui/Button';
import { ColorLegend } from '@/src/components/ui/ColorLegend';
import { LineBox } from '@/src/components/ui/LineBox';
import { PhoneTray } from '@/src/components/ui/PhoneTray';
import { PlayFrame, ScoreFrame } from '@/src/components/ui/PlayFrame';
import { play } from '@/src/components/ui/playStyles';
import { ProgressTrack } from '@/src/components/ui/ProgressTrack';
import { PlaySkeleton } from '@/src/components/ui/Skeleton';
import { forceSkeleton } from '@/src/components/ui/skeletonMode';
import { PuzzleCount } from '@/src/components/ui/PuzzleCount';
import { text } from '@/src/components/ui/text';
import { useKeyboardShortcuts } from '@/src/components/ui/useKeyboardShortcuts';
import { useLayout } from '@/src/components/ui/useLayout';
import { themeInstruction } from '@/src/logic/drills';
import { themedStyleSheet } from '@/src/theme/themed';
import { useTheme } from '@/src/theme/useTheme';
import { fonts, fontSizes, lineHeights, radii, spacing } from '@/src/theme';

export function HomeTrainer() {
  useTheme();
  const router = useRouter();
  const { phone, topNav } = useLayout();
  const trainer = useHomeTrainer();
  const drill = trainer.drill;

  useKeyboardShortcuts(
    {
      Enter: () => {
        if (trainer.round === 'correct' || trainer.round === 'revealed') {
          trainer.next();
          return true;
        }
        if (trainer.round === 'retry' && trainer.replyReady) {
          trainer.tryAgain();
          return true;
        }
        return false;
      },
      ' ': () => {
        if (trainer.round === 'correct' || trainer.round === 'revealed') {
          trainer.next();
          return true;
        }
        if (trainer.round === 'retry' && trainer.replyReady) {
          trainer.tryAgain();
          return true;
        }
        return false;
      },
      h: () => {
        if (trainer.round !== 'playing') return false;
        if (trainer.unprompted) trainer.stepHint();
        else trainer.revealIdea();
        return true;
      },
      r: () => {
        if (trainer.round !== 'retry' || !trainer.replyReady) return false;
        trainer.tryAgain();
        return true;
      },
      p: () => {
        if (trainer.round !== 'retry' || !trainer.replyReady || !trainer.hasReplay) return false;
        trainer.replayReply();
        return true;
      },
    },
    !trainer.done && Boolean(drill),
  );

  if (forceSkeleton()) return <PlaySkeleton />;

  if (trainer.done) {
    const pct = trainer.score.total ? Math.round((trainer.score.correct / trainer.score.total) * 100) : 0;
    return (
      <View style={styles.stage}>
        <ScoreFrame>
          <View style={play.done} testID="daily-complete">
            {phone ? null : <Text style={text.eyebrow}>Daily 7</Text>}
            <Text style={[text.title, phone && text.titlePhone]}>Daily 7 complete</Text>
            <Text style={[text.hero, phone && text.heroPhone]}>
              {trainer.score.correct}/{trainer.score.total}
            </Text>
            {trainer.dailyOutcomes.length > 0 ? (
              <View style={styles.dotStrip} testID="daily-outcomes">
                {trainer.dailyOutcomes.map((ok, i) => (
                  <View key={i} style={[styles.outcomeDot, ok ? styles.outcomeSave : styles.outcomeMiss]} />
                ))}
              </View>
            ) : null}
            <Text style={[text.muted, phone && text.mutedPhone]}>
              {pct}% saved on the first try
              {trainer.dailyXpEarned > 0 ? ` · +${trainer.dailyXpEarned} XP` : ''}
            </Text>
            {trainer.hydrated && trainer.streak > 0 ? (
              <View style={styles.streakWrap}>
                <StreakBadge streak={trainer.streak} celebrate />
              </View>
            ) : null}
            <Button
              compact={phone}
              label="Play more drills"
              testID="daily-more-drills"
              onPress={() => router.push('/drills' as Href)}
            />
            {trainer.dueCount > 0 ? (
              <Button
                compact={phone}
                variant="secondary"
                label={`Review ${trainer.dueCount} due`}
                testID="daily-review-due"
                onPress={() => router.push('/drills?mode=review' as Href)}
              />
            ) : !trainer.hasProfile ? (
              <Button
                compact={phone}
                variant="secondary"
                label="Import your own games"
                testID="daily-import-games"
                onPress={() => router.push('/progress' as Href)}
              />
            ) : null}
            <Button
              compact={phone}
              variant="ghost"
              label="Another 7"
              testID="daily-another"
              onPress={trainer.restart}
            />
          </View>
        </ScoreFrame>
        <Welcome />
      </View>
    );
  }

  if (!drill) return <PlaySkeleton />;

  const hintLabel =
    trainer.hintStep === 0 ? 'Hint (1/3)' : trainer.hintStep === 1 ? 'Hint (2/3)' : 'Show the idea';
  const coachText = trainer.unprompted
    ? trainer.hintStep === 0
      ? 'Find any safe move — no threat highlight.'
      : trainer.hintStep === 1
        ? 'Check the amber piece under fire.'
        : themeInstruction(drill.theme)
    : themeInstruction(drill.theme);

  return (
    <View style={styles.stage}>
      <PlayFrame
        intro={
          <BoardLead gap={phone ? spacing[6] : spacing[10]}>
            <View style={[styles.meta, phone && styles.metaPhone]}>
              <DueTodayLink variant="pill" />
              <View style={styles.metaRight}>
                {trainer.hydrated && trainer.streak > 0 ? (
                  <StreakBadge streak={trainer.streak} celebrate compact={phone} />
                ) : null}
                <ColorLegend compact={phone} />
                {!topNav ? <MenuButton compact={phone} /> : null}
              </View>
            </View>
            {!phone && trainer.sourceLabel ? (
              trainer.sourceUrl ? (
                <Pressable
                  {...controlA11y('link', `Open game: ${trainer.sourceLabel}`)}
                  testID="home-source"
                  onPress={() => {
                    if (trainer.sourceUrl) void Linking.openURL(trainer.sourceUrl);
                  }}
                  style={(state) => {
                    const hovered = 'hovered' in state && Boolean(state.hovered);
                    return [styles.sourcePill, styles.sourcePillLink, (hovered || state.pressed) && styles.sourcePillHover];
                  }}>
                  <Text style={styles.sourceTextLink} numberOfLines={1}>
                    {trainer.sourceLabel} ↗
                  </Text>
                </Pressable>
              ) : (
                <View style={styles.sourcePill} testID="home-source">
                  <Text style={styles.sourceText} numberOfLines={1}>
                    {trainer.sourceLabel}
                  </Text>
                </View>
              )
            ) : null}
            {phone ? (
              <>
                <LineBox height={24}>
                  <Text style={[text.title, text.titlePhone]} numberOfLines={1}>
                    {trainer.headline}
                  </Text>
                </LineBox>
                <LineBox height={18}>
                  <Text style={[text.habit, text.habitPhone]} numberOfLines={1}>
                    {trainer.prompt}
                  </Text>
                </LineBox>
              </>
            ) : (
              <>
                <Text style={text.title}>{trainer.headline}</Text>
                <Text style={text.habit}>{trainer.prompt}</Text>
              </>
            )}
            <View style={styles.progressRow}>
              <View style={play.progressGrow}>
                <ProgressTrack progress={trainer.progress} />
              </View>
              <PuzzleCount index={trainer.index} total={trainer.total} spaced={!phone} phone={phone} />
            </View>
          </BoardLead>
        }
        board={
          <ChessBoard
            key={`${drill.id}-${trainer.index}`}
            fen={trainer.boardFen}
            orientation={trainer.orientation}
            flipCue={trainer.orientation === 'black'}
            interactive={trainer.round === 'playing'}
            lastMove={trainer.boardLastMove}
            arrows={trainer.threatArrow}
            attentionSquares={trainer.attentionSquares}
            highlightSquares={trainer.marks.squares}
            highlightTone={trainer.marks.tone}
            onMove={trainer.onMove}
          />
        }
        aside={
          <PhoneTray
            banner={
              trainer.card ? (
                <BlunderOverlay
                  visible
                  tone={trainer.card.tone}
                  title={trainer.card.title}
                  message={trainer.roundCopy}
                  compactNote={trainer.compactNote}
                  waiting={trainer.card.tone === 'danger' && !trainer.replyReady ? 'Showing reply…' : undefined}
                  onWaitingPress={
                    trainer.card.tone === 'danger' && !trainer.replyReady ? trainer.skipReply : undefined
                  }
                  actionLabel={
                    trainer.card.tone === 'danger' ? (trainer.replyReady ? 'Try again' : undefined) : 'Next drill'
                  }
                  onDismiss={
                    trainer.card.tone === 'danger' ? (trainer.replyReady ? trainer.tryAgain : undefined) : trainer.next
                  }
                  actionTestID={trainer.card.tone === 'danger' ? 'try-again' : undefined}
                  secondaryLabel={
                    trainer.card.tone === 'danger' && trainer.replyReady
                      ? trainer.hasReplay
                        ? 'Replay'
                        : 'Next drill'
                      : undefined
                  }
                  onSecondary={
                    trainer.card.tone === 'danger' && trainer.replyReady
                      ? trainer.hasReplay
                        ? trainer.replayReply
                        : trainer.next
                      : undefined
                  }
                  extraLabel={
                    !phone && trainer.card.tone === 'danger' && trainer.replyReady && trainer.hasReplay
                      ? 'Next drill'
                      : undefined
                  }
                  onExtra={
                    !phone && trainer.card.tone === 'danger' && trainer.replyReady && trainer.hasReplay
                      ? trainer.next
                      : undefined
                  }
                />
              ) : (
                <View style={[play.guide, phone && play.phoneCard, phone && styles.coachCard]}>
                  <Text
                    testID="home-coach"
                    style={[text.muted, phone && text.mutedPhone, styles.coachCopy]}
                    numberOfLines={phone ? 2 : undefined}>
                    {coachText}
                  </Text>
                  <View style={phone ? styles.phoneActions : styles.deskActions}>
                    {trainer.unprompted && trainer.hintStep < 2 ? (
                      <Button
                        compact={phone}
                        variant="secondary"
                        label={hintLabel}
                        testID="home-hint"
                        onPress={trainer.stepHint}
                        style={phone ? styles.actionFlex : undefined}
                      />
                    ) : (
                      <Button
                        compact={phone}
                        variant="secondary"
                        label="Show the idea"
                        testID="home-idea"
                        onPress={trainer.revealIdea}
                        style={phone ? styles.actionFlex : undefined}
                      />
                    )}
                    <Button
                      compact={phone}
                      variant="ghost"
                      label="All drills"
                      testID="start-drill"
                      onPress={() => router.push('/drills' as Href)}
                      style={phone ? styles.actionFlex : undefined}
                    />
                  </View>
                </View>
              )
            }
          />
        }
      />
      <Welcome />
    </View>
  );
}

const styles = themedStyleSheet((colors) => ({
  stage: {
    flex: 1,
    width: '100%',
    minHeight: 0,
  },
  meta: {
    width: '100%',
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  metaPhone: {
    height: 30,
    minHeight: 30,
    overflow: 'hidden',
  },
  metaRight: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: spacing[4],
    flexShrink: 0,
  },
  sourcePill: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing[10],
    paddingVertical: spacing[3],
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    maxWidth: '100%',
  },
  sourcePillLink: {
    cursor: 'pointer',
  },
  sourcePillHover: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
  },
  sourceText: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes[12],
    lineHeight: lineHeights[16],
    color: colors.textMuted,
  },
  sourceTextLink: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes[12],
    lineHeight: lineHeights[16],
    color: colors.accent,
  },
  progressRow: {
    height: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  coachCard: {
    paddingVertical: spacing[4],
    gap: spacing[4],
    justifyContent: 'center',
  },
  coachCopy: {
    width: '100%',
  },
  phoneActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[6],
  },
  deskActions: {
    gap: spacing[8],
  },
  actionFlex: {
    flex: 1,
    flexBasis: 0,
  },
  streakWrap: {
    alignSelf: 'center',
  },
  dotStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[6],
    marginVertical: spacing[2],
  },
  outcomeDot: {
    width: 10,
    height: 10,
    borderRadius: radii.pill,
  },
  outcomeSave: {
    backgroundColor: colors.success,
  },
  outcomeMiss: {
    backgroundColor: colors.danger,
  },
}));
