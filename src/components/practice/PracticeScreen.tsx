import { useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import type { Color } from 'chess.js';

import { BlunderOverlay } from '@/src/components/Board/BlunderOverlay';
import { ChessBoard } from '@/src/components/Board/ChessBoard';
import { sentence, usePracticeGame } from '@/src/components/practice/usePracticeGame';
import { MenuButton } from '@/src/components/SettingsMenu';
import { PlaySkeleton } from '@/src/components/ui/Skeleton';
import { forceSkeleton } from '@/src/components/ui/skeletonMode';
import { controlA11y, liveA11y } from '@/src/components/ui/a11y';
import { BoardLead } from '@/src/components/ui/BoardLead';
import { Button } from '@/src/components/ui/Button';
import { SegmentedControl } from '@/src/components/ui/Chip';
import { ColorLegend } from '@/src/components/ui/ColorLegend';
import { Dialog } from '@/src/components/ui/Dialog';
import { IconChevronDown, IconSliders } from '@/src/components/ui/icons';
import { LineBox } from '@/src/components/ui/LineBox';
import { PhoneTray } from '@/src/components/ui/PhoneTray';
import { PlayFrame } from '@/src/components/ui/PlayFrame';
import { play } from '@/src/components/ui/playStyles';
import { Sheet } from '@/src/components/ui/Sheet';
import { text } from '@/src/components/ui/text';
import { useKeyboardShortcuts } from '@/src/components/ui/useKeyboardShortcuts';
import { useLayout } from '@/src/components/ui/useLayout';
import { HABIT_PROMPT } from '@/src/logic/drills';
import { drillFromBlunder, drillFromHang } from '@/src/logic/personalDrill';
import { PRACTICE_ELOS, type PracticeElo } from '@/src/logic/reply';
import { useProgressStore } from '@/src/store/progress';
import { themedStyleSheet } from '@/src/theme/themed';
import { useTheme } from '@/src/theme/useTheme';
import { fonts, fontSizes, lineHeights, radii, spacing } from '@/src/theme';

const SIDE_OPTIONS: readonly { id: Color; label: string; testID: string }[] = [
  { id: 'w', label: 'White', testID: 'practice-white' },
  { id: 'b', label: 'Black', testID: 'practice-black' },
];

const ELO_OPTIONS: readonly { id: string; label: string; testID: string }[] = PRACTICE_ELOS.map((elo) => ({
  id: String(elo),
  label: String(elo),
  testID: `practice-elo-${elo}`,
}));

function materialText(delta: number): string {
  if (delta > 0) return `+${delta}`;
  if (delta < 0) return String(delta);
  return 'Even';
}

type PendingReset = { kind: 'new' } | { kind: 'side'; side: Color };

export function PracticeScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { phone, topNav } = useLayout();
  const game = usePracticeGame();
  const savePersonalDrill = useProgressStore((state) => state.savePersonalDrill);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [pendingReset, setPendingReset] = useState<PendingReset | null>(null);

  const activeGame = game.playerMoves > 0 && !game.gameOver;

  const requestNewGame = () => {
    if (activeGame) {
      setPendingReset({ kind: 'new' });
      return;
    }
    game.resetBoard();
  };

  const requestSide = (side: Color) => {
    if (side === game.playerColor) return;
    if (activeGame) {
      setPendingReset({ kind: 'side', side });
      return;
    }
    game.setPlayerColor(side);
  };

  const confirmReset = () => {
    const action = pendingReset;
    setPendingReset(null);
    if (!action) return;
    if (action.kind === 'side') game.setPlayerColor(action.side);
    else game.resetBoard();
  };

  useKeyboardShortcuts(
    {
      u: () => {
        if (!game.canUndo) return false;
        game.undoMove();
        return true;
      },
      f: () => {
        game.toggleFlip();
        return true;
      },
      Enter: () => {
        if (!game.feedback) return false;
        if (game.tone === 'danger') game.tryAgain();
        else game.dismissFeedback();
        return true;
      },
      ' ': () => {
        if (!game.feedback) return false;
        if (game.tone === 'danger') game.tryAgain();
        else game.dismissFeedback();
        return true;
      },
    },
    !optionsOpen && pendingReset === null,
  );

  const hangingVisible = !game.feedback && !game.status && game.hangingNow[0];
  const offerKey =
    game.tone === 'danger' && game.blunder
      ? `move:${game.blunder.fen}:${game.blunder.from}${game.blunder.to}`
      : (hangingVisible || game.tone === 'warn') && game.isPlayerTurn
        ? `hang:${game.fen}`
        : null;
  const saved = offerKey != null && offerKey === savedId;
  const saveOffer = () => {
    if (!offerKey || saved) return;
    const drill =
      game.tone === 'danger' && game.blunder ? drillFromBlunder(game.blunder) : drillFromHang(game.fen);
    if (!drill) return;
    savePersonalDrill(drill);
    setSavedId(offerKey);
  };
  if (forceSkeleton()) return <PlaySkeleton />;
  const showFeedback = game.feedback != null && (game.tone === 'danger' || !game.gameOver);
  const preMoveHang = !game.feedback && !game.status ? game.hangingNow[0] : undefined;
  const danger = game.tone === 'danger';
  const drillAction = offerKey
    ? {
        label: saved ? 'Saved' : 'Drill this',
        active: saved,
        onPress: saveOffer,
        testID: 'drill-this',
      }
    : undefined;
  const sideLabel = game.playerColor === 'w' ? 'White' : 'Black';
  const oppLabel = game.playerColor === 'w' ? 'Black' : 'White';
  const matLabel = materialText(game.materialDelta);

  return (
    <>
      <PlayFrame
        intro={
          <BoardLead gap={phone ? spacing[6] : spacing[10]}>
            {phone ? (
              <View style={[styles.topRow, styles.topRowPhone]}>
                <Pressable
                  {...controlA11y('button', `Practice options: ${sideLabel}, ${game.botElo} Elo`, optionsOpen)}
                  testID="practice-options-trigger"
                  onPress={() => setOptionsOpen(true)}
                  style={(state) => [styles.trigger, state.pressed && styles.pressed]}>
                  <IconSliders color={colors.textMuted} size={13} />
                  <Text style={styles.triggerText} numberOfLines={1}>
                    {sideLabel} · {game.botElo}
                  </Text>
                  <IconChevronDown color={colors.textDim} size={13} />
                </Pressable>
                <View style={styles.topRight}>
                  {game.canUndo ? (
                    <Pressable
                      {...controlA11y('button', 'Undo move')}
                      testID="practice-undo-phone"
                      onPress={game.undoMove}
                      style={(state) => [styles.undoChip, state.pressed && styles.pressed]}>
                      <Text style={styles.undoChipText}>Undo</Text>
                    </Pressable>
                  ) : null}
                  <View
                    style={[
                      styles.matPill,
                      game.materialDelta > 0 && styles.matPlus,
                      game.materialDelta < 0 && styles.matMinus,
                    ]}>
                    <Text
                      style={[
                        styles.matText,
                        game.materialDelta > 0 && styles.matTextPlus,
                        game.materialDelta < 0 && styles.matTextMinus,
                      ]}>
                      {matLabel}
                    </Text>
                  </View>
                  <ColorLegend compact />
                  {!topNav ? <MenuButton compact /> : null}
                </View>
              </View>
            ) : (
              <View style={styles.deskControls}>
                <View style={styles.topRow}>
                  <Text style={text.title} numberOfLines={1}>
                    Your game
                  </Text>
                  <View style={styles.topRight}>
                    <View
                      testID="practice-material"
                      style={[
                        styles.matPill,
                        game.materialDelta > 0 && styles.matPlus,
                        game.materialDelta < 0 && styles.matMinus,
                      ]}>
                      <Text
                        style={[
                          styles.matText,
                          game.materialDelta > 0 && styles.matTextPlus,
                          game.materialDelta < 0 && styles.matTextMinus,
                        ]}>
                        Material: {matLabel}
                      </Text>
                    </View>
                    <ColorLegend compact={false} />
                    {!topNav ? <MenuButton /> : null}
                  </View>
                </View>
                <View style={styles.controlRow}>
                  <View style={styles.sideWrap}>
                    <SegmentedControl
                      height={32}
                      options={SIDE_OPTIONS}
                      value={game.playerColor}
                      onChange={requestSide}
                    />
                  </View>
                  <View style={styles.eloWrap}>
                    <SegmentedControl
                      height={32}
                      options={ELO_OPTIONS}
                      value={String(game.botElo)}
                      onChange={(value) => game.setBotElo(Number(value) as PracticeElo)}
                    />
                  </View>
                </View>
                <View style={styles.actionRow}>
                  <Button
                    compact
                    variant="secondary"
                    label="Undo"
                    testID="practice-undo"
                    disabled={!game.canUndo}
                    onPress={game.undoMove}
                    style={styles.actionBtn}
                  />
                  <Button
                    compact
                    variant="secondary"
                    label="Flip"
                    testID="practice-flip"
                    onPress={game.toggleFlip}
                    style={styles.actionBtn}
                  />
                  <Button
                    compact
                    variant="secondary"
                    label="Resign"
                    testID="practice-resign"
                    disabled={!game.canResign}
                    onPress={game.resignGame}
                    style={styles.actionBtn}
                  />
                  <Button
                    compact
                    variant="secondary"
                    label="New game"
                    testID="practice-new"
                    onPress={requestNewGame}
                    style={styles.actionBtn}
                  />
                </View>
              </View>
            )}
            {phone ? (
              <>
                <LineBox height={24}>
                  <Text style={[text.title, text.titlePhone]} numberOfLines={1}>
                    Your game
                  </Text>
                </LineBox>
                <LineBox height={18}>
                  <Text style={[text.habit, text.habitPhone]} numberOfLines={1}>
                    {HABIT_PROMPT}
                  </Text>
                </LineBox>
              </>
            ) : (
              <Text style={text.habit}>{HABIT_PROMPT}</Text>
            )}
          </BoardLead>
        }
        board={
          <ChessBoard
            fen={game.fen}
            orientation={game.orientation}
            flipCue={game.orientation === 'black'}
            interactive={!game.thinking && !game.gameOver && game.isPlayerTurn}
            highlightSquares={game.feedback && game.tone === 'danger' ? game.highlights : []}
            attentionSquares={game.tone === 'warn' ? game.highlights : preMoveHang ? preMoveHang.squares : []}
            highlightTone="danger"
            arrows={game.feedback && game.tone === 'success' ? [] : game.arrow}
            lastMove={game.lastMove}
            onMove={game.onMove}
          />
        }
        aside={
          <PhoneTray
            banner={
              showFeedback && game.feedback ? (
                <BlunderOverlay
                  visible
                  tone={game.tone}
                  title={game.feedback.title}
                  message={
                    game.gameOver && game.resultLine ? `${game.panelMessage} ${game.resultLine}` : game.panelMessage
                  }
                  hint={game.feedback.bestMoveHint}
                  headerAction={drillAction}
                  actionLabel={danger ? 'Try again' : 'Continue'}
                  onDismiss={danger ? game.tryAgain : game.dismissFeedback}
                  actionTestID={danger ? 'try-again' : undefined}
                  secondaryLabel={danger ? 'Continue' : undefined}
                  onSecondary={danger ? game.dismissFeedback : undefined}
                />
              ) : game.gameOver ? (
                <View {...liveA11y()} style={[play.guide, phone && play.phoneCard]} testID="practice-report">
                  <Text style={[text.bodyStrong, phone && text.bodyPhone]} numberOfLines={phone ? 1 : undefined}>
                    {game.resultLine}
                  </Text>
                  <Text style={[text.muted, phone && text.mutedPhone]} numberOfLines={1}>
                    {game.playerMoves} {game.playerMoves === 1 ? 'move' : 'moves'} · {game.sessionBlunders.length}{' '}
                    {game.sessionBlunders.length === 1 ? 'blunder' : 'blunders'} · {game.cleanPct}% clean
                  </Text>
                  <View style={styles.reportActions}>
                    {game.sessionBlunders.length > 0 ? (
                      game.blundersAdded ? (
                        <Button
                          compact={phone}
                          variant="secondary"
                          label="Review now →"
                          testID="practice-open-review"
                          onPress={() => router.push('/drills?mode=review' as Href)}
                          style={styles.actionBtn}
                        />
                      ) : (
                        <Button
                          compact={phone}
                          variant="secondary"
                          label={phone ? 'Add to Review' : 'Add blunders to Review'}
                          testID="practice-add-review"
                          onPress={game.addBlundersToReview}
                          style={styles.actionBtn}
                        />
                      )
                    ) : null}
                    <Button compact={phone} label="Play again" onPress={game.resetBoard} style={styles.actionBtn} />
                  </View>
                </View>
              ) : game.hangingNow[0] ? (
                <BlunderOverlay
                  visible
                  tone="warn"
                  title="Hanging piece"
                  message={sentence(
                    `Before you move: your ${game.hangingNow[0].message.replace('You left the ', '').replace(' hanging', '')} on ${game.hangingNow[0].squares[0]} is hanging`,
                  )}
                  headerAction={drillAction}
                />
              ) : game.status ? (
                <View {...liveA11y()} style={[play.guide, phone && play.phoneCard]}>
                  <Text style={[text.bodyStrong, phone && text.bodyPhone]} numberOfLines={phone ? 2 : undefined}>
                    {game.status}
                  </Text>
                </View>
              ) : (
                <View style={[play.guide, phone && play.phoneCard]}>
                  <Text style={[text.body, phone && text.bodyPhone]} numberOfLines={phone ? 3 : undefined}>
                    You play {sideLabel} vs. {game.botElo} Elo {oppLabel}. Leave a piece hanging and it gets punished.
                  </Text>
                </View>
              )
            }
          />
        }
      />

      <Sheet
        visible={optionsOpen}
        onClose={() => setOptionsOpen(false)}
        title="Practice options"
        subtitle="Blunder-shield sparring against a local opponent."
        testID="practice-options-sheet">
        <View style={styles.sheetSection}>
          <Text style={text.section}>Play as</Text>
          <SegmentedControl
            height={38}
            options={SIDE_OPTIONS}
            value={game.playerColor}
            onChange={(side) => {
              setOptionsOpen(false);
              requestSide(side);
            }}
          />
        </View>
        <View style={styles.sheetSection}>
          <Text style={text.section}>Opponent strength (Elo)</Text>
          <SegmentedControl
            height={38}
            options={ELO_OPTIONS}
            value={String(game.botElo)}
            onChange={(value) => game.setBotElo(Number(value) as PracticeElo)}
          />
        </View>
        <View style={styles.actionRow}>
          <Button
            variant="secondary"
            label="Flip board"
            onPress={() => {
              game.toggleFlip();
              setOptionsOpen(false);
            }}
            style={styles.actionBtn}
          />
          <Button
            variant="secondary"
            label="Resign"
            disabled={!game.canResign}
            onPress={() => {
              game.resignGame();
              setOptionsOpen(false);
            }}
            style={styles.actionBtn}
          />
        </View>
        <View style={styles.actionRow}>
          <Button
            variant="secondary"
            label="Undo move"
            disabled={!game.canUndo}
            onPress={() => {
              game.undoMove();
              setOptionsOpen(false);
            }}
            style={styles.actionBtn}
          />
          <Button
            variant="secondary"
            label="New game"
            onPress={() => {
              setOptionsOpen(false);
              requestNewGame();
            }}
            style={styles.actionBtn}
          />
        </View>
        <Button label="Done" onPress={() => setOptionsOpen(false)} />
      </Sheet>

      <Dialog visible={pendingReset !== null} onClose={() => setPendingReset(null)}>
        <Text style={text.title}>
          {pendingReset?.kind === 'side' ? 'Switch sides?' : 'Start a new game?'}
        </Text>
        <Text style={[text.muted, styles.dialogCopy]}>
          Your current game ({game.playerMoves} {game.playerMoves === 1 ? 'move' : 'moves'}) will be cleared. Resign first if you want to add blunders to Review.
        </Text>
        <View style={styles.dialogActions}>
          <Button
            variant="secondary"
            label="Cancel"
            onPress={() => setPendingReset(null)}
            style={styles.actionBtn}
          />
          <Button
            label={pendingReset?.kind === 'side' ? 'Switch sides' : 'New game'}
            testID="practice-confirm-reset"
            onPress={confirmReset}
            style={styles.actionBtn}
          />
        </View>
      </Dialog>
    </>
  );
}

const styles = themedStyleSheet((colors) => ({
  topRow: {
    width: '100%',
    minHeight: 32,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  topRowPhone: {
    height: 30,
    minHeight: 30,
    overflow: 'hidden',
  },
  topRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[6],
    flexShrink: 0,
  },
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[5],
    height: 30,
    paddingHorizontal: spacing[10],
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    cursor: 'pointer',
  },
  triggerText: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes[12],
    lineHeight: lineHeights[16],
    color: colors.text,
  },
  undoChip: {
    height: 26,
    paddingHorizontal: spacing[8],
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
  undoChipText: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes[11],
    lineHeight: lineHeights[14],
    color: colors.text,
  },
  pressed: {
    opacity: 0.82,
  },
  deskControls: {
    width: '100%',
    gap: spacing[8],
  },
  controlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[8],
  },
  sideWrap: {
    width: 132,
    flexShrink: 0,
  },
  eloWrap: {
    flex: 1,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[6],
  },
  reportActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[8],
  },
  actionBtn: {
    flex: 1,
    flexBasis: 0,
  },
  matPill: {
    paddingHorizontal: spacing[8],
    paddingVertical: spacing[3],
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  matPlus: {
    borderColor: colors.success,
    backgroundColor: colors.successSoft,
  },
  matMinus: {
    borderColor: colors.danger,
    backgroundColor: colors.dangerSoft,
  },
  matText: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes[12],
    lineHeight: lineHeights[16],
    color: colors.textMuted,
  },
  matTextPlus: {
    color: colors.success,
  },
  matTextMinus: {
    color: colors.danger,
  },
  sheetSection: {
    gap: spacing[8],
  },
  dialogCopy: {
    textAlign: 'center',
  },
  dialogActions: {
    width: '100%',
    flexDirection: 'row',
    gap: spacing[8],
    marginTop: spacing[4],
  },
}));
