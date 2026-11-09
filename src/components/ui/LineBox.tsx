import type { ReactNode } from 'react';
import { View } from 'react-native';

/**
 * Fixed-height line above the board. Hidden copy stays mounted at opacity 0
 * so the line does not collapse and push the squares.
 */
export function LineBox({
  height,
  children,
  hidden = false,
}: {
  height: number;
  children: ReactNode;
  hidden?: boolean;
}) {
  return (
    <View
      pointerEvents={hidden ? 'none' : 'auto'}
      style={{
        height,
        width: '100%',
        overflow: 'hidden',
        opacity: hidden ? 0 : 1,
        justifyContent: 'center',
      }}>
      {children}
    </View>
  );
}
