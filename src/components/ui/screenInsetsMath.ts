type Insets = { top: number; right: number; bottom: number; left: number };

/** Keep the larger inset from each edge. A zero from one source does not erase the other. */
export function unionInsets(provider: Insets, css: Insets): Insets {
  return {
    top: Math.max(provider.top, css.top),
    right: Math.max(provider.right, css.right),
    bottom: Math.max(provider.bottom, css.bottom),
    left: Math.max(provider.left, css.left),
  };
}
