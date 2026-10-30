import { useMemo, useState } from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import type { Square } from 'chess.js';
import Svg, { Polygon } from 'react-native-svg';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';

import { playMoveSound, unlockMoveSounds } from '@/src/audio/playMoveSound';
import { soundForSan } from '@/src/audio/moveSound';
import { Piece, pieceCodeFrom } from '@/src/components/Board/Piece';
import {
  createGame,
  getLegalTargets,
  pieceAt,
  snapshot,
  tryMove,
  type GameSnapshot,
} from '@/src/logic/game';
import { legalMoveInk, squareBackground, type HighlightTone } from '@/src/components/Board/highlight';
import { colors, fonts, radii } from '@/src/theme';

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const;
const RANKS_WHITE = [8, 7, 6, 5, 4, 3, 2, 1] as const;
const RANKS_BLACK = [1, 2, 3, 4, 5, 6, 7, 8] as const;

export type BoardArrow = {
  from: Square;
  to: Square;
  color?: string;
};

export type BoardMoveEvent = {
  from: Square;
  to: Square;
  beforeFen: string;
  afterFen: string;
  san: string;
};

type Props = {
  fen?: string;
  orientation?: 'white' | 'black';
  interactive?: boolean;
  highlightSquares?: Square[];
  /** Danger (red) is a blunder. Success (green) is a save. */
  highlightTone?: HighlightTone;
  /** Softer amber attention (e.g. your hanging piece to save). */
  attentionSquares?: Square[];
  lastMove?: { from: Square; to: Square } | null;
  arrows?: BoardArrow[];
  /** Black-to-move drills flip the board. Say so next to the turn. */
  flipCue?: boolean;
  onMove?: (event: BoardMoveEvent) => boolean | void;
  onPositionChange?: (snap: GameSnapshot) => void;
};

function squareAt(fileIndex: number, rankIndex: number, orientation: 'white' | 'black'): Square {
  const files = orientation === 'white' ? FILES : [...FILES].reverse();
  const ranks = orientation === 'white' ? RANKS_WHITE : RANKS_BLACK;
  return `${files[fileIndex]}${ranks[rankIndex]}` as Square;
}

export function ChessBoard({
  fen,
  orientation = 'white',
  interactive = true,
  highlightSquares = [],
  highlightTone = 'danger',
  attentionSquares = [],
  lastMove = null,
  arrows = [],
  flipCue = false,
  onMove,
  onPositionChange,
}: Props) {
  const [boardSize, setBoardSize] = useState(320);
  const [gameFen, setGameFen] = useState(() => fen ?? createGame().fen());
  const [selected, setSelected] = useState<Square | null>(null);
  const [legal, setLegal] = useState<Square[]>([]);
  const [dragSquare, setDragSquare] = useState<Square | null>(null);

  const activeFen = fen ?? gameFen;
  const game = useMemo(() => createGame(activeFen), [activeFen]);
  const snap = snapshot(game);
  const squareSize = boardSize / 8;

  const dragX = useSharedValue(0);
  const dragY = useSharedValue(0);

  const dragStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: dragX.value - squareSize / 2 },
      { translateY: dragY.value - squareSize / 2 },
    ],
  }));

  const onLayout = (e: LayoutChangeEvent) => {
    setBoardSize(e.nativeEvent.layout.width);
  };

  const clearSelection = () => {
    setSelected(null);
    setLegal([]);
  };

  const commitMove = (from: Square, to: Square) => {
    if (!interactive) return;
    const beforeFen = game.fen();
    const probe = createGame(beforeFen);
    const moved = tryMove(probe, from, to);
    if (!moved) {
      clearSelection();
      playMoveSound('fail');
      return;
    }
    const afterFen = probe.fen();
    const allowed = onMove?.({
      from,
      to,
      beforeFen,
      afterFen,
      san: moved.san,
    });
    if (allowed === false) {
      clearSelection();
      playMoveSound('fail');
      return;
    }
    playMoveSound(soundForSan(moved.san));
    if (fen === undefined) {
      setGameFen(afterFen);
    }
    onPositionChange?.(snapshot(probe));
    clearSelection();
  };

  const onSquarePress = (square: Square) => {
    if (!interactive) return;
    const piece = pieceAt(game, square);

    if (selected) {
      if (legal.includes(square)) {
        commitMove(selected, square);
        return;
      }
      if (piece && piece.color === snap.turn) {
        setSelected(square);
        setLegal(getLegalTargets(game, square));
        return;
      }
      clearSelection();
      playMoveSound('fail');
      return;
    }

    if (piece && piece.color === snap.turn) {
      setSelected(square);
      setLegal(getLegalTargets(game, square));
    }
  };

  const startDrag = (square: Square) => {
    if (!interactive) return;
    const piece = pieceAt(game, square);
    if (!piece || piece.color !== snap.turn) return;
    setSelected(square);
    setLegal(getLegalTargets(game, square));
    setDragSquare(square);
  };

  const endDrag = (x: number, y: number) => {
    const from = dragSquare;
    setDragSquare(null);
    if (!from) return;
    const fileIndex = Math.max(0, Math.min(7, Math.floor(x / squareSize)));
    const rankIndex = Math.max(0, Math.min(7, Math.floor(y / squareSize)));
    const to = squareAt(fileIndex, rankIndex, orientation);
    if (to !== from && getLegalTargets(game, from).includes(to)) {
      commitMove(from, to);
    } else if (to !== from) {
      clearSelection();
      playMoveSound('fail');
    } else {
      clearSelection();
    }
  };

  const pan = Gesture.Pan()
    .onBegin((e) => {
      const fileIndex = Math.max(0, Math.min(7, Math.floor(e.x / squareSize)));
      const rankIndex = Math.max(0, Math.min(7, Math.floor(e.y / squareSize)));
      const square = squareAt(fileIndex, rankIndex, orientation);
      dragX.value = e.x;
      dragY.value = e.y;
      runOnJS(startDrag)(square);
    })
    .onUpdate((e) => {
      dragX.value = e.x;
      dragY.value = e.y;
    })
    .onEnd((e) => {
      runOnJS(endDrag)(e.x, e.y);
    })
    .onFinalize(() => {
      runOnJS(setDragSquare)(null);
    });

  const dragPiece = dragSquare ? pieceAt(game, dragSquare) : null;

  return (
    <View style={styles.wrap} onPointerDown={unlockMoveSounds}>
      <View style={styles.meta}>
        <Text style={styles.turn}>
          {snap.isCheckmate
            ? 'Checkmate'
            : snap.isStalemate
              ? 'Stalemate'
              : snap.isCheck
                ? `${snap.turn === 'w' ? 'White' : 'Black'} in check`
                : `${snap.turn === 'w' ? 'White' : 'Black'} to move`}
        </Text>
        {flipCue ? <Text style={styles.flip}>You're playing Black. Board flipped.</Text> : null}
      </View>
      <GestureDetector gesture={pan}>
        <View style={styles.board} onLayout={onLayout}>
          {Array.from({ length: 8 }).map((_, rankIndex) => (
            <View key={`r-${rankIndex}`} style={styles.row}>
              {Array.from({ length: 8 }).map((__, fileIndex) => {
                const square = squareAt(fileIndex, rankIndex, orientation);
                const isDark = (fileIndex + rankIndex) % 2 === 1;
                const piece = pieceAt(game, square);
                const isSelected = selected === square;
                const isLegal = legal.includes(square);
                const isHighlight = highlightSquares.includes(square);
                const isAttention = attentionSquares.includes(square);
                const isLast =
                  lastMove != null && (lastMove.from === square || lastMove.to === square);
                const hideForDrag = dragSquare === square;

                const bg = squareBackground({
                  isDark,
                  isLast,
                  isAttention,
                  isSelected,
                  isHighlight,
                  highlightTone,
                });

                return (
                  <Pressable
                    key={square}
                    onPress={() => onSquarePress(square)}
                    style={[
                      styles.square,
                      {
                        width: squareSize,
                        height: squareSize,
                        backgroundColor: bg,
                      },
                    ]}>
                    {isLegal ? (
                      <View
                        style={[
                          styles.legalDot,
                          piece ? styles.legalCapture : null,
                          {
                            width: squareSize * (piece ? 0.9 : 0.32),
                            height: squareSize * (piece ? 0.9 : 0.32),
                            backgroundColor: piece ? 'transparent' : legalMoveInk(isDark),
                            borderColor: piece ? legalMoveInk(isDark) : 'transparent',
                          },
                        ]}
                      />
                    ) : null}
                    {piece && !hideForDrag ? (
                      <Piece code={pieceCodeFrom(piece.color, piece.type)} size={squareSize} />
                    ) : null}
                    {rankIndex === 7 ? (
                      <Text
                        style={[
                          styles.coord,
                          styles.fileCoord,
                          { color: isDark ? colors.boardLight : colors.boardDark },
                        ]}>
                        {square[0]}
                      </Text>
                    ) : null}
                    {fileIndex === 0 ? (
                      <Text
                        style={[
                          styles.coord,
                          styles.rankCoord,
                          { color: isDark ? colors.boardLight : colors.boardDark },
                        ]}>
                        {square[1]}
                      </Text>
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          ))}
          {arrows.length && squareSize > 0 ? (
            <Svg
              pointerEvents="none"
              width={boardSize}
              height={boardSize}
              style={styles.arrows}
              viewBox={`0 0 ${boardSize} ${boardSize}`}>
              {arrows.map((arrow) => (
                <ArrowShape
                  key={`${arrow.from}${arrow.to}`}
                  from={centerOf(arrow.from, orientation, squareSize)}
                  to={centerOf(arrow.to, orientation, squareSize)}
                  color={arrow.color ?? colors.danger}
                  square={squareSize}
                />
              ))}
            </Svg>
          ) : null}
          {dragPiece ? (
            <Animated.View
              pointerEvents="none"
              style={[
                styles.dragGhost,
                { width: squareSize, height: squareSize },
                dragStyle,
              ]}>
              <Piece
                code={pieceCodeFrom(dragPiece.color, dragPiece.type)}
                size={squareSize}
              />
            </Animated.View>
          ) : null}
        </View>
      </GestureDetector>
    </View>
  );
}

function centerOf(
  square: Square,
  orientation: 'white' | 'black',
  squareSize: number,
): { x: number; y: number } {
  const file = square.charCodeAt(0) - 97;
  const rank = Number(square[1]) - 1;
  const col = orientation === 'white' ? file : 7 - file;
  const row = orientation === 'white' ? 7 - rank : rank;
  return { x: (col + 0.5) * squareSize, y: (row + 0.5) * squareSize };
}

function ArrowShape({
  from,
  to,
  color,
  square,
}: {
  from: { x: number; y: number };
  to: { x: number; y: number };
  color: string;
  square: number;
}) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const startX = from.x + ux * square * 0.28;
  const startY = from.y + uy * square * 0.28;
  const tipX = to.x - ux * square * 0.18;
  const tipY = to.y - uy * square * 0.18;
  const head = square * 0.28;
  const baseX = tipX - ux * head;
  const baseY = tipY - uy * head;
  const px = -uy;
  const py = ux;
  const wing = head * 0.55;
  const points = `${tipX},${tipY} ${baseX + px * wing},${baseY + py * wing} ${baseX - px * wing},${baseY - py * wing}`;
  return (
    <>
      <Polygon
        points={`${startX + px * 3},${startY + py * 3} ${baseX + px * 3},${baseY + py * 3} ${baseX - px * 3},${baseY - py * 3} ${startX - px * 3},${startY - py * 3}`}
        fill={color}
        opacity={0.95}
      />
      <Polygon points={points} fill={color} />
    </>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    alignSelf: 'flex-start',
  },
  meta: {
    marginBottom: 10,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  turn: {
    fontFamily: fonts.bodyBold,
    color: colors.text,
    fontSize: 15,
  },
  flip: {
    fontFamily: fonts.bodyBold,
    color: colors.accentText,
    backgroundColor: colors.warn,
    fontSize: 14,
    lineHeight: 18,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.pill,
    overflow: 'hidden',
  },
  board: {
    borderRadius: radii.sm,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: colors.boardFrame,
    aspectRatio: 1,
    width: '100%',
    backgroundColor: colors.boardFrameBg,
  },
  row: {
    flexDirection: 'row',
  },
  square: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  legalDot: {
    position: 'absolute',
    borderRadius: 999,
    zIndex: 1,
  },
  legalCapture: {
    backgroundColor: 'transparent',
    borderWidth: 4,
  },
  arrows: {
    position: 'absolute',
    left: 0,
    top: 0,
    zIndex: 4,
  },
  coord: {
    position: 'absolute',
    fontSize: 14,
    fontFamily: fonts.bodyBold,
  },
  fileCoord: {
    right: 3,
    bottom: 1,
  },
  rankCoord: {
    left: 3,
    top: 1,
  },
  dragGhost: {
    position: 'absolute',
    left: 0,
    top: 0,
    zIndex: 20,
    opacity: 0.95,
  },
});
