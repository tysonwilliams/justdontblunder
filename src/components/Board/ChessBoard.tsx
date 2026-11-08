import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { LayoutChangeEvent, Platform, Text, View, type ViewStyle } from 'react-native';
import type { Square } from 'chess.js';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { playFeedback, playMoveOutcome, unlockFeedback } from '@/src/feedback/playFeedback';
import { BoardArrows } from '@/src/components/Board/BoardArrows';
import { BoardSquare } from '@/src/components/Board/BoardSquare';
import { centerOf } from '@/src/components/Board/boardCoords';
import { chessBoardPropsEqual } from '@/src/components/Board/boardProps';
import { buildBoardRows } from '@/src/components/Board/boardSquares';
import type { BoardArrow, BoardMoveEvent, ChessBoardProps } from '@/src/components/Board/boardTypes';
import {
  DRAG_SCALE,
  dragDropIntent,
  motionsBetween,
  pointerToBoard,
  pointToSquare,
  type DropIntent,
} from '@/src/components/Board/boardMotion';
import { PieceFlight, type PieceFlightModel } from '@/src/components/Board/PieceFlight';
import { Piece } from '@/src/components/Board/Piece';
import { BOARD_BORDER, squareSizeForFrame } from '@/src/components/Board/boardGeometry';
import { pieceCodeFrom } from '@/src/components/Board/pieceCode';
import { useReducedMotion } from '@/src/components/Board/useReducedMotion';
import { useLayout } from '@/src/components/ui/useLayout';
import {
  createGame,
  getLegalTargets,
  pieceAt,
  snapshot,
  tryMove,
  type GameSnapshot,
} from '@/src/logic/game';
import { useTheme } from '@/src/theme/useTheme';
import { themedStyleSheet } from '@/src/theme/themed';
import { fonts, fontSizes, lineHeights, radii, spacing } from '@/src/theme';

export type { BoardArrow, BoardMoveEvent };

const EMPTY_ARROWS: BoardArrow[] = [];
const DRAG_ARM_PX = 8;
const SNAP_SPRING = { damping: 14, stiffness: 280, mass: 0.55 };

const webBoardTouch: ViewStyle | null =
  Platform.OS === 'web' ? ({ touchAction: 'none', userSelect: 'none' } as ViewStyle) : null;

type Phase = 'idle' | 'dragging' | 'settling';
type Placement = { fen: string; from: Square };

function turnStatus(snap: GameSnapshot, hideTurn: boolean): string | null {
  if (snap.isCheckmate) return 'Checkmate';
  if (snap.isStalemate) return 'Stalemate';
  if (hideTurn) return null;
  if (snap.isCheck) return `${snap.turn === 'w' ? 'White' : 'Black'} in check`;
  return `${snap.turn === 'w' ? 'White' : 'Black'} to move`;
}

function planFlights(before: string, after: string, squareSize: number, reduced: boolean): PieceFlightModel[] {
  if (reduced || squareSize <= 0) return [];
  const motions = motionsBetween(before, after);
  if (!motions?.length) return [];
  return motions.map((motion, index) => ({
    id: `${index}:${motion.kind}:${motion.kind === 'slide' ? `${motion.from}${motion.to}` : motion.square}:${after}`,
    motion,
  }));
}

function squaresHiddenBy(flights: readonly PieceFlightModel[]): Square[] {
  const squares: Square[] = [];
  for (const flight of flights) {
    const motion = flight.motion;
    if (motion.kind === 'slide') squares.push(motion.to);
    else if (motion.direction === 'in') squares.push(motion.square);
  }
  return squares;
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
  const { colors, scheme } = useTheme();
  const { phone } = useLayout();
  const reduced = useReducedMotion();
  const [measured, setMeasured] = useState(0);
  const [gameFen, setGameFen] = useState(() => fen ?? createGame().fen());
  const [selected, setSelected] = useState<Square | null>(null);
  const [legal, setLegal] = useState<Square[]>([]);
  const [dragSquare, setDragSquare] = useState<Square | null>(null);
  const [hoverSquare, setHoverSquare] = useState<Square | null>(null);
  const [flights, setFlights] = useState<PieceFlightModel[]>([]);
  const [placement, setPlacement] = useState<Placement | null>(null);
  const [rejectedFrom, setRejectedFrom] = useState<Square | null>(null);

  const activeFen = fen ?? gameFen;
  const [trackedFen, setTrackedFen] = useState(activeFen);
  const game = useMemo(() => createGame(activeFen), [activeFen]);
  const snap = snapshot(game);
  const outer = size && size > 0 ? Math.round(size) : measured;
  const squareSize = squareSizeForFrame(outer);

  const dragX = useSharedValue(0);
  const dragY = useSharedValue(0);
  const lift = useSharedValue(0);
  const shake = useSharedValue(0);
  const tracking = useSharedValue(0);
  const dragSettled = useSharedValue(0);
  const sizeSV = useSharedValue(squareSize);
  const orientSV = useSharedValue(orientation);
  const hoverSV = useSharedValue<Square | null>(null);

  const phase = useRef<Phase>('idle');
  const dragFrom = useRef<Square | null>(null);
  const suppressPress = useRef(false);
  const shieldTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reducedRef = useRef(reduced);
  reducedRef.current = reduced;
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

  if (trackedFen !== activeFen) {
    const previous = trackedFen;
    const skipped = placement?.fen === activeFen;
    setTrackedFen(activeFen);
    setPlacement(null);
    setRejectedFrom(null);
    setSelected(null);
    setLegal([]);
    setHoverSquare(null);
    setDragSquare(null);
    phase.current = 'idle';
    dragFrom.current = null;
    setFlights(skipped ? [] : planFlights(previous, activeFen, squareSize, reduced));
  } else if (placement && placement.fen !== activeFen) {
    const from = placement.from;
    setPlacement(null);
    setRejectedFrom(from);
  }

  useLayoutEffect(() => {
    sizeSV.value = squareSize;
    orientSV.value = orientation;
  }, [orientation, sizeSV, squareSize, orientSV]);

  useLayoutEffect(() => {
    tracking.value = 0;
    hoverSV.value = null;
  }, [activeFen, hoverSV, tracking]);

  const finishFlight = useCallback((id: string) => {
    setFlights((current) => (current.some((flight) => flight.id === id) ? current.filter((flight) => flight.id !== id) : current));
  }, []);

  const dragStyle = useAnimatedStyle(() => {
    const piece = sizeSV.value;
    return {
      transform: [
        { translateX: dragX.value - piece / 2 + shake.value },
        { translateY: dragY.value - piece / 2 },
        { scale: 1 + (DRAG_SCALE - 1) * lift.value },
      ],
    };
  });

  const onLayout = (event: LayoutChangeEvent) => {
    const next = Math.round(event.nativeEvent.layout.width);
    setMeasured((prev) => (prev === next ? prev : next));
  };

  const clearSelection = useCallback(() => {
    setSelected(null);
    setLegal([]);
  }, []);

  const clearSettleTimer = useCallback(() => {
    if (settleTimer.current) clearTimeout(settleTimer.current);
    settleTimer.current = null;
  }, []);

  const finishSettle = useCallback(
    (deselect: boolean) => {
      if (phase.current !== 'settling') return;
      clearSettleTimer();
      phase.current = 'idle';
      dragFrom.current = null;
      tracking.value = 0;
      shake.value = 0;
      setDragSquare(null);
      setHoverSquare(null);
      hoverSV.value = null;
      if (deselect) clearSelection();
    },
    [clearSelection, clearSettleTimer, hoverSV, shake, tracking],
  );

  const armSettle = useCallback(
    (deselect: boolean, ms: number) => {
      clearSettleTimer();
      settleTimer.current = setTimeout(() => finishSettle(deselect), ms);
    },
    [clearSettleTimer, finishSettle],
  );

  const armPressShield = useCallback(() => {
    suppressPress.current = true;
    if (shieldTimer.current) clearTimeout(shieldTimer.current);
    shieldTimer.current = setTimeout(() => {
      suppressPress.current = false;
    }, 400);
  }, []);

  const beginSnap = useCallback(
    (from: Square, bounce: boolean) => {
      const now = latest.current;
      const piece = pieceAt(now.game, from);
      tracking.value = 0;
      hoverSV.value = null;
      setHoverSquare(null);
      if (!piece || now.squareSize <= 0) {
        phase.current = 'idle';
        dragFrom.current = null;
        setDragSquare(null);
        if (bounce) clearSelection();
        return;
      }
      phase.current = 'settling';
      dragFrom.current = from;
      setDragSquare(from);
      const center = centerOf(from, now.orientation, now.squareSize);
      shake.value = 0;
      if (reducedRef.current) {
        dragX.value = center.x;
        dragY.value = center.y;
        lift.value = 0;
        finishSettle(bounce);
        return;
      }
      lift.value = withTiming(0, { duration: 160 });
      if (bounce) {
        dragX.value = withSpring(center.x, SNAP_SPRING, (finished) => {
          if (finished) runOnJS(finishSettle)(bounce);
        });
        dragY.value = withSpring(center.y, SNAP_SPRING);
        armSettle(bounce, 900);
      } else {
        dragX.value = withTiming(center.x, { duration: 120, easing: Easing.out(Easing.cubic) }, (finished) => {
          if (finished) runOnJS(finishSettle)(bounce);
        });
        dragY.value = withTiming(center.y, { duration: 120, easing: Easing.out(Easing.cubic) });
        armSettle(bounce, 240);
      }
    },
    [armSettle, clearSelection, dragX, dragY, finishSettle, hoverSV, lift, shake, tracking],
  );

  const shakePiece = useCallback(
    (square: Square) => {
      const now = latest.current;
      playFeedback('blunder');
      if (reducedRef.current || now.squareSize <= 0 || !pieceAt(now.game, square)) {
        clearSelection();
        return;
      }
      phase.current = 'settling';
      dragFrom.current = square;
      setDragSquare(square);
      const center = centerOf(square, now.orientation, now.squareSize);
      dragX.value = center.x;
      dragY.value = center.y;
      lift.value = 0;
      const amp = Math.max(5, now.squareSize * 0.09);
      shake.value = withSequence(
        withTiming(-amp, { duration: 42 }),
        withTiming(amp, { duration: 48 }),
        withTiming(-amp * 0.65, { duration: 40 }),
        withTiming(amp * 0.35, { duration: 36 }),
        withTiming(0, { duration: 36 }, (finished) => {
          if (finished) runOnJS(finishSettle)(true);
        }),
      );
      armSettle(true, 360);
    },
    [armSettle, clearSelection, dragX, dragY, finishSettle, lift, shake],
  );

  const commitMove = useCallback(
    (from: Square, to: Square, source: 'tap' | 'drag') => {
      const now = latest.current;
      if (!now.interactive) return;
      const beforeFen = now.game.fen();
      const probe = createGame(beforeFen);
      const moved = tryMove(probe, from, to);
      if (!moved) {
        if (source === 'drag') beginSnap(from, true);
        else shakePiece(from);
        if (source === 'drag') playFeedback('blunder');
        return;
      }
      const afterFen = probe.fen();
      if (source === 'drag') setPlacement({ fen: afterFen, from });
      const allowed = now.onMove?.({ from, to, beforeFen, afterFen, san: moved.san });
      if (allowed === false) {
        clearSelection();
        playMoveOutcome(moved.san, false);
        return;
      }
      playMoveOutcome(moved.san, allowed);
      if (now.fen === undefined) setGameFen(afterFen);
      now.onPositionChange?.(snapshot(probe));
      clearSelection();
    },
    [beginSnap, clearSelection, shakePiece],
  );

  const onSquarePress = useCallback(
    (square: Square) => {
      if (suppressPress.current || phase.current !== 'idle') return;
      const now = latest.current;
      if (!now.interactive) return;
      const piece = pieceAt(now.game, square);
      if (now.selected) {
        if (now.legal.includes(square)) {
          commitMove(now.selected, square, 'tap');
          return;
        }
        if (piece && piece.color === now.snap.turn) {
          setSelected(square);
          setLegal(getLegalTargets(now.game, square));
          return;
        }
        shakePiece(now.selected);
        return;
      }
      if (piece && piece.color === now.snap.turn) {
        setSelected(square);
        setLegal(getLegalTargets(now.game, square));
      }
    },
    [commitMove, shakePiece],
  );

  const startDrag = useCallback(
    (square: Square, x: number, y: number) => {
      tracking.value = 0;
      const now = latest.current;
      if (phase.current === 'settling' || !now.interactive || now.squareSize <= 0) return;
      const piece = pieceAt(now.game, square);
      if (!piece || piece.color !== now.snap.turn) return;
      phase.current = 'dragging';
      dragFrom.current = square;
      dragX.value = x;
      dragY.value = y;
      shake.value = 0;
      tracking.value = 1;
      armPressShield();
      setSelected(square);
      setLegal(getLegalTargets(now.game, square));
      setDragSquare(square);
      playFeedback('pickup');
      lift.value = withTiming(reducedRef.current ? 0 : 1, { duration: reducedRef.current ? 0 : 90 });
    },
    [armPressShield, dragX, dragY, lift, shake, tracking],
  );

  const rememberHover = useCallback((square: Square | null) => {
    setHoverSquare((current) => (current === square ? current : square));
  }, []);

  const endDrag = useCallback(
    (x: number, y: number) => {
      tracking.value = 0;
      hoverSV.value = null;
      setHoverSquare(null);
      if (phase.current !== 'dragging') return;
      const from = dragFrom.current;
      const now = latest.current;
      if (!from || now.squareSize <= 0) {
        phase.current = 'idle';
        dragFrom.current = null;
        setDragSquare(null);
        return;
      }
      const intent: DropIntent = dragDropIntent({
        from,
        x,
        y,
        squareSize: now.squareSize,
        orientation: now.orientation,
        legal: getLegalTargets(now.game, from),
      });
      switch (intent.kind) {
        case 'move':
          phase.current = 'idle';
          commitMove(from, intent.to, 'drag');
          return;
        case 'snap':
          playFeedback(intent.reason === 'origin' ? 'drop' : 'blunder');
          beginSnap(from, intent.reason !== 'origin');
          return;
        default: {
          const _exhaustive: never = intent;
          return _exhaustive;
        }
      }
    },
    [beginSnap, commitMove, hoverSV, tracking],
  );

  const cancelDrag = useCallback(() => {
    if (phase.current !== 'dragging') return;
    const from = dragFrom.current;
    tracking.value = 0;
    if (from) beginSnap(from, true);
    else {
      phase.current = 'idle';
      setDragSquare(null);
    }
  }, [beginSnap, tracking]);

  const handlers = useRef({ startDrag, endDrag, rememberHover, cancelDrag });
  handlers.current = { startDrag, endDrag, rememberHover, cancelDrag };

  const startDragJS = useCallback((square: Square, x: number, y: number) => {
    handlers.current.startDrag(square, x, y);
  }, []);
  const endDragJS = useCallback((x: number, y: number) => {
    handlers.current.endDrag(x, y);
  }, []);
  const hoverJS = useCallback((square: Square | null) => {
    handlers.current.rememberHover(square);
  }, []);
  const cancelDragJS = useCallback(() => {
    handlers.current.cancelDrag();
  }, []);

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .enabled(interactive)
        .minDistance(DRAG_ARM_PX)
        .maxPointers(1)
        .shouldCancelWhenOutside(false)
        .onStart((event) => {
          'worklet';
          dragSettled.value = 0;
          const point = pointerToBoard(event.x, event.y);
          const boardSize = sizeSV.value;
          if (boardSize <= 0) return;
          const square = pointToSquare(point.x, point.y, boardSize, orientSV.value);
          if (!square) return;
          runOnJS(startDragJS)(square, point.x, point.y);
        })
        .onUpdate((event) => {
          'worklet';
          if (tracking.value !== 1) return;
          const point = pointerToBoard(event.x, event.y);
          dragX.value = point.x;
          dragY.value = point.y;
          const boardSize = sizeSV.value;
          const square = boardSize > 0 ? pointToSquare(point.x, point.y, boardSize, orientSV.value) : null;
          if (square !== hoverSV.value) {
            hoverSV.value = square;
            runOnJS(hoverJS)(square);
          }
        })
        .onEnd((event) => {
          'worklet';
          if (dragSettled.value === 1) return;
          dragSettled.value = 1;
          const point = pointerToBoard(event.x, event.y);
          runOnJS(endDragJS)(point.x, point.y);
        })
        .onFinalize((_event, success) => {
          'worklet';
          if (success || dragSettled.value === 1) return;
          dragSettled.value = 1;
          runOnJS(cancelDragJS)();
        }),
    [
      cancelDragJS,
      dragSettled,
      dragX,
      dragY,
      endDragJS,
      hoverJS,
      hoverSV,
      interactive,
      orientSV,
      sizeSV,
      startDragJS,
      tracking,
    ],
  );

  useEffect(() => {
    if (!rejectedFrom) return;
    const from = rejectedFrom;
    setRejectedFrom(null);
    beginSnap(from, true);
  }, [beginSnap, rejectedFrom]);

  useEffect(() => {
    return () => {
      if (shieldTimer.current) clearTimeout(shieldTimer.current);
      if (settleTimer.current) clearTimeout(settleTimer.current);
    };
  }, []);

  const hiddenSquares = squaresHiddenBy(flights);
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
    hoverSquare ?? '',
    hiddenSquares.join(','),
    squareSize,
    scheme,
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
        dropSquare: hoverSquare,
        hiddenSquares,
        squareSize,
        palette: colors,
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
    <View style={styles.wrap} onPointerDown={unlockFeedback}>
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
      <GestureDetector gesture={pan} touchAction="none" userSelect="none">
        <View
          collapsable={false}
          style={[styles.hit, outer > 0 ? { height: outer } : styles.boardSquare, webBoardTouch]}
          onLayout={onLayout}>
          <View style={styles.board}>
            {rows.map((row, rankIndex) => (
              <View key={`r-${rankIndex}`} style={styles.row}>
                {row.map((model) => (
                  <BoardSquare key={model.square} {...model} onPress={onSquarePress} />
                ))}
              </View>
            ))}
            <BoardArrows arrows={arrowDraw} orientation={orientation} squareSize={squareSize} />
          </View>
          <View pointerEvents="none" style={styles.motion}>
            {flights.map((flight) => (
              <PieceFlight
                key={flight.id}
                flight={flight}
                orientation={orientation}
                squareSize={squareSize}
                onDone={finishFlight}
              />
            ))}
            {dragPiece ? (
              <Animated.View
                pointerEvents="none"
                style={[styles.dragGhost, { width: squareSize, height: squareSize }, dragStyle]}>
                <Piece code={pieceCodeFrom(dragPiece.color, dragPiece.type)} size={squareSize} />
              </Animated.View>
            ) : null}
          </View>
        </View>
      </GestureDetector>
    </View>
  );
}

export const ChessBoard = memo(ChessBoardView, chessBoardPropsEqual);

const styles = themedStyleSheet((colors) => ({
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
  hit: {
    width: '100%',
    position: 'relative',
  },
  board: {
    borderRadius: radii.sm,
    overflow: 'hidden',
    borderWidth: BOARD_BORDER,
    borderColor: colors.boardFrame,
    width: '100%',
    height: '100%',
    backgroundColor: colors.boardFrameBg,
  },
  boardSquare: {
    aspectRatio: 1,
  },
  row: {
    flexDirection: 'row',
  },
  motion: {
    position: 'absolute',
    left: BOARD_BORDER,
    top: BOARD_BORDER,
    right: BOARD_BORDER,
    bottom: BOARD_BORDER,
    zIndex: 20,
  },
  dragGhost: {
    position: 'absolute',
    left: 0,
    top: 0,
    zIndex: 30,
  },
}));
