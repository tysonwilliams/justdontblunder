import { useMemo, useState } from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import type { Square } from 'chess.js';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';

import { Piece, pieceCodeFrom } from '@/src/components/Board/Piece';
import {
  createGame,
  getLegalTargets,
  pieceAt,
  snapshot,
  tryMove,
  type GameSnapshot,
} from '@/src/logic/game';
import { colors, fonts, radii } from '@/src/theme';

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const;
const RANKS_WHITE = [8, 7, 6, 5, 4, 3, 2, 1] as const;
const RANKS_BLACK = [1, 2, 3, 4, 5, 6, 7, 8] as const;

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
  lastMove?: { from: Square; to: Square } | null;
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
  lastMove = null,
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
      return;
    }
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
    if (getLegalTargets(game, from).includes(to)) {
      commitMove(from, to);
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
    <View style={styles.wrap}>
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
                const isLast =
                  lastMove != null && (lastMove.from === square || lastMove.to === square);
                const hideForDrag = dragSquare === square;

                let bg: string = isDark ? colors.boardDark : colors.boardLight;
                if (isLast) bg = colors.boardLastMove;
                if (isSelected) bg = colors.boardSelected;
                if (isHighlight) bg = colors.boardBlunder;

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
                            width: squareSize * (piece ? 0.86 : 0.28),
                            height: squareSize * (piece ? 0.86 : 0.28),
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

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
  },
  meta: {
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  turn: {
    fontFamily: fonts.bodyBold,
    color: colors.textMuted,
    fontSize: 14,
  },
  board: {
    borderRadius: radii.sm,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: colors.border,
    aspectRatio: 1,
    width: '100%',
    backgroundColor: colors.bgSoft,
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
    backgroundColor: colors.boardLegal,
    zIndex: 1,
  },
  legalCapture: {
    backgroundColor: 'transparent',
    borderWidth: 3,
    borderColor: 'rgba(255,92,92,0.55)',
  },
  coord: {
    position: 'absolute',
    fontSize: 10,
    fontFamily: fonts.bodyBold,
    opacity: 0.85,
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
