const counts = new Map<string, number>();

/** Dev and test counter. Production builds leave it at zero. */
export function noteSquareRender(square: string): void {
  if (process.env.NODE_ENV === 'production') return;
  counts.set(square, (counts.get(square) ?? 0) + 1);
}

export function squareRenderCount(square: string): number {
  return counts.get(square) ?? 0;
}

export function resetSquareRenderCounts(): void {
  counts.clear();
}
