import { memo, useCallback, useMemo, useRef, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';
import type { Square } from 'chess.js';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';

import { playMoveSound, unlockMoveSounds } from '@/src/audio/playMoveSound';
import { soundForSan } from '@/src/audio/moveSound';
import { BoardArrows } from '@/src/components/Board/BoardArrows';
import { BoardSquare } from '@/src/components/Board/BoardSquare';
import { squareAt } from '@/src/components/Board/boardCoords';
import { chessBoardPropsEqual } from '@/src/components/Board/boardProps';
import { buildBoardRows } from '@/src/components/Board/boardSquares';
import type { BoardArrow, BoardMoveEvent, ChessBoardProps } from '@/src/components/Board/boardTypes';
import { Piece } from '@/src/components/Board/Piece';
import { squareSizeForFrame } from '@/src/components/Board/boardGeometry';
import { pieceCodeFrom } from '@/src/components/Board/pieceCode';
import { useLayout } from '@/src/components/ui/useLayout';
import {
  createGame,
  getLegalTargets,
  pieceAt,
  snapshot,
  tryMove,
  type GameSnapshot,
} from '@/src/logic/game';
import { colors, fonts, fontSizes, lineHeights, radii, spacing } from '@/src/theme';

export type { BoardArrow, BoardMoveEvent };

const EMPTY_ARROWS: BoardArrow[] = [];

function turnStatus(snap: GameSnapshot, hideTurn: boolean): string | null {
  if (snap.isCheckmate) return 'Checkmate';
  if (snap.isStalemate) return 'Stalemate';
  if (hideTurn) return null;
  if (snap.isCheck) return `${snap.turn === 'w' ? 'White' : 'Black'} in check`;
  return `${snap.turn === 'w' ? 'White' : 'Black'} to move`;
}

function ChessBoardView({
  fen,
  orientation = 'white',
  interactive = true,
  highlightSquares = [],
  highlightTone = 'danger',
  attentionSquares = [],
  lastMove = null,
  arrows = [],
  flipCue = false,
  hideTurn = false,
  size,
  onMove,
  onPositionChange,
}: ChessBoardProps) {
  const { phone } = useLayout();
  const [measured, setMeasured] = useState(0);
  const [gameFen, setGameFen] = useState(() => fen ?? createGame().fen());
  const [selected, setSelected] = useState<Square | null>(null);
  const [legal, setLegal] = useState<Square[]>([]);
  const [dragSquare, setDragSquare] = useState<Square | null>(null);

  const activeFen = fen ?? gameFen;
  const game = useMemo(() => createGame(activeFen), [activeFen]);
  const snap = snapshot(game);
  const outer = size && size > 0 ? Math.round(size) : measured;
  const squareSize = squareSizeForFrame(outer);

  const dragX = useSharedValue(0);
  const dragY = useSharedValue(0);
  const dragFrom = useRef<Square | null>(null);
  const latest = useRef({
    interactive,
    game,
    snap,
    selected,
    legal,
    fen,
    onMove,
    onPositionChange,
    orientation,
    squareSize,
  });
  latest.current = {
    interactive,
    game,
    snap,
    selected,
    legal,
    fen,
    onMove,
    onPositionChange,
    orientation,
    squareSize,
  };

  const dragStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: dragX.value - squareSize / 2 }, { translateY: dragY.value - squareSize / 2 }],
  }));

  const onLayout = (event: LayoutChangeEvent) => {
    const next = Math.round(event.nativeEvent.layout.width);
    setMeasured((prev) => (prev === next ? prev : next));
  };

  const clearSelection = useCallback(() => {
    setSelected(null);
    setLegal([]);
  }, []);

  const commitMove = useCallback(
    (from: Square, to: Square) => {
      const now = latest.current;
      if (!now.interactive) return;
      const beforeFen = now.game.fen();
      const probe = createGame(beforeFen);
      const moved = tryMove(probe, from, to);
      if (!moved) {
        clearSelection();
        playMoveSound('fail');
        return;
      }
      const afterFen = probe.fen();
      const allowed = now.onMove?.({ from, to, beforeFen, afterFen, san: moved.san });
      if (allowed === false) {
        clearSelection();
        playMoveSound('fail');
        return;
      }
      playMoveSound(soundForSan(moved.san));
      if (now.fen === undefined) setGameFen(afterFen);
      now.onPositionChange?.(snapshot(probe));
      clearSelection();
    },
    [clearSelection],
  );

  const onSquarePress = useCallback(
    (square: Square) => {
      const now = latest.current;
      if (!now.interactive) return;
      const piece = pieceAt(now.game, square);
      if (now.selected) {
        if (now.legal.includes(square)) {
          commitMove(now.selected, square);
          return;
        }
        if (piece && piece.color === now.snap.turn) {
          setSelected(square);
          setLegal(getLegalTargets(now.game, square));
          return;
        }
        clearSelection();
        playMoveSound('fail');
        return;
      }
      if (piece && piece.color === now.snap.turn) {
        setSelected(square);
        setLegal(getLegalTargets(now.game, square));
      }
    },
    [clearSelection, commitMove],
  );

  const startDrag = useCallback((square: Square) => {
    const now = latest.current;
    if (!now.interactive) return;
    const piece = pieceAt(now.game, square);
    if (!piece || piece.color !== now.snap.turn) return;
    setSelected(square);
    setLegal(getLegalTargets(now.game, square));
    dragFrom.current = square;
    setDragSquare(square);
  }, []);

  const endDrag = useCallback(
    (x: number, y: number) => {
      const from = dragFrom.current;
      dragFrom.current = null;
      setDragSquare(null);
      const now = latest.current;
      if (!from || now.squareSize <= 0) return;
      const fileIndex = Math.max(0, Math.min(7, Math.floor(x / now.squareSize)));
      const rankIndex = Math.max(0, Math.min(7, Math.floor(y / now.squareSize)));
      const to = squareAt(fileIndex, rankIndex, now.orientation);
      if (to !== from && getLegalTargets(now.game, from).includes(to)) {
        commitMove(from, to);
      } else if (to !== from) {
        clearSelection();
        playMoveSound('fail');
      } else {
        clearSelection();
      }
    },
    [clearSelection, commitMove],
  );

  const finishDrag = useCallback(() => {
    dragFrom.current = null;
    setDragSquare(null);
  }, []);

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .onBegin((event) => {
          if (squareSize <= 0) return;
          const fileIndex = Math.max(0, Math.min(7, Math.floor(event.x / squareSize)));
          const rankIndex = Math.max(0, Math.min(7, Math.floor(event.y / squareSize)));
          dragX.value = event.x;
          dragY.value = event.y;
          runOnJS(startDrag)(squareAt(fileIndex, rankIndex, orientation));
        })
        .onUpdate((event) => {
          dragX.value = event.x;
          dragY.value = event.y;
        })
        .onEnd((event) => {
          runOnJS(endDrag)(event.x, event.y);
        })
        .onFinalize(() => {
          runOnJS(finishDrag)();
        }),
    [dragX, dragY, endDrag, finishDrag, orientation, squareSize, startDrag],
  );

  const rowKey = [
    activeFen,
    orientation,
    selected ?? '',
    legal.join(','),
    highlightSquares.join(','),
    attentionSquares.join(','),
    highlightTone,
    lastMove ? `${lastMove.from}${lastMove.to}` : '',
    dragSquare ?? '',
    squareSize,
  ].join('|');
  const rows = useMemo(
    () =>
      buildBoardRows({
        game,
        orientation,
        selected,
        legal,
        highlightSquares,
        attentionSquares,
        highlightTone,
        lastMove,
        dragSquare,
        squareSize,
      }),
    // rowKey digests every visual input. A new array with the same squares
    // must not rebuild the grid.
    [rowKey],
  );

  const arrowKey = arrows
    .map((arrow) => `${arrow.from}${arrow.to}${arrow.color ?? ''}${arrow.label ?? ''}`)
    .join('|');
  const arrowDraw = useMemo(() => (arrows.length ? arrows : EMPTY_ARROWS), [arrowKey]);

  const dragPiece = dragSquare ? pieceAt(game, dragSquare) : null;
  const turnLine = turnStatus(snap, hideTurn);

  return (
    <View style={styles.wrap} onPointerDown={unlockMoveSounds}>
      {turnLine || flipCue ? (
        <View style={[styles.meta, phone && styles.metaPhone]}>
          {turnLine ? (
            <Text style={[styles.turn, phone && styles.turnPhone]} numberOfLines={1}>
              {turnLine}
            </Text>
          ) : null}
          {flipCue ? (
            <Text style={[styles.flip, phone && styles.flipPhone]} numberOfLines={1}>
              {phone ? 'Playing Black' : "You're playing Black. Board flipped."}
            </Text>
          ) : null}
        </View>
      ) : null}
      <GestureDetector gesture={pan}>
        <View style={[styles.board, outer > 0 ? { height: outer } : styles.boardSquare]} onLayout={onLayout}>
          {rows.map((row, rankIndex) => (
            <View key={`r-${rankIndex}`} style={styles.row}>
              {row.map((model) => (
                <BoardSquare key={model.square} {...model} onPress={onSquarePress} />
              ))}
            </View>
          ))}
          <BoardArrows arrows={arrowDraw} orientation={orientation} squareSize={squareSize} />
          {dragPiece ? (
            <Animated.View
              pointerEvents="none"
              style={[styles.dragGhost, { width: squareSize, height: squareSize }, dragStyle]}>
              <Piece code={pieceCodeFrom(dragPiece.color, dragPiece.type)} size={squareSize} />
            </Animated.View>
          ) : null}
        </View>
      </GestureDetector>
    </View>
  );
}

export const ChessBoard = memo(ChessBoardView, chessBoardPropsEqual);

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    alignSelf: 'flex-start',
  },
  meta: {
    marginBottom: spacing.sm,
    minHeight: 28,
    flexDirection: 'row',
    flexWrap: 'nowrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  metaPhone: {
    marginBottom: spacing.xs,
    minHeight: 18,
    height: 18,
  },
  turn: {
    fontFamily: fonts.bodyBold,
    color: colors.text,
    fontSize: fontSizes[15],
    lineHeight: lineHeights[20],
    flexShrink: 1,
  },
  turnPhone: {
    fontSize: fontSizes[12],
    lineHeight: lineHeights[16],
  },
  flip: {
    fontFamily: fonts.bodyBold,
    color: colors.accentText,
    backgroundColor: colors.warning,
    fontSize: fontSizes[14],
    lineHeight: lineHeights[18],
    paddingHorizontal: spacing[10],
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
    overflow: 'hidden',
  },
  flipPhone: {
    fontSize: fontSizes[11],
    lineHeight: lineHeights[14],
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing[1],
  },
  board: {
    borderRadius: radii.sm,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: colors.boardFrame,
    width: '100%',
    backgroundColor: colors.boardFrameBg,
  },
  boardSquare: {
    aspectRatio: 1,
  },
  row: {
    flexDirection: 'row',
  },
  dragGhost: {
    position: 'absolute',
    left: 0,
    top: 0,
    zIndex: 20,
    opacity: 0.95,
  },
});
