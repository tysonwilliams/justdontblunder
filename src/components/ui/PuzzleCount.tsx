import { Text } from 'react-native';

import { text } from '@/src/components/ui/text';
import { puzzleCounter, scanNote } from '@/src/logic/earlyPlay';
import { useProgressStore } from '@/src/store/progress';

type Props = {
  index: number;
  total: number;
  /** Desktop counts use spaces: "1 / 7". Phone drills stay "1/7". */
  spaced: boolean;
  phone?: boolean;
  /** Extra tail such as a streak score. It stays on the same line. */
  extra?: string;
};

/** Puzzle counter. A running scan adds a short note without a new row. */
export function PuzzleCount({ index, total, spaced, phone = false, extra }: Props) {
  const phase = useProgressStore((state) => state.scan.phase);
  const found = useProgressStore((state) => state.scan.found);
  const note = scanNote(phase, found);
  const label = puzzleCounter(index, total, note, spaced);
  return (
    <Text
      style={[text.meta, phone && text.metaPhone]}
      numberOfLines={1}
      testID={note ? 'scan-count' : undefined}>
      {extra ? `${label} · ${extra}` : label}
    </Text>
  );
}
