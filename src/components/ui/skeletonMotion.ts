/** Pulse length for skeleton bones. Zero means the bone stays still. */
export const SKELETON_PULSE_MS = 900;

export function skeletonPulseMs(reducedMotion: boolean): number {
  return reducedMotion ? 0 : SKELETON_PULSE_MS;
}
