import { useSyncExternalStore } from 'react';
import { Platform, useWindowDimensions } from 'react-native';

import { phoneSlots, type PhoneSlots } from '@/src/components/ui/phoneSlots';
import { useScreenInsets } from '@/src/components/ui/screenInsets';
import { stageMetrics, type StageMetrics } from '@/src/components/ui/stageMetrics';

type WindowSize = { width: number; height: number };

const EMPTY_SIZE: WindowSize = { width: 0, height: 0 };
const viewportListeners = new Set<() => void>();
let viewportSize: WindowSize = EMPTY_SIZE;
let viewportBound = false;

function readViewportSize(): WindowSize {
  if (typeof window === 'undefined') return EMPTY_SIZE;
  const view = window.visualViewport;
  const width = Math.round(view?.width ?? window.innerWidth);
  const height = Math.round(view?.height ?? window.innerHeight);
  return width > 0 && height > 0 ? { width, height } : EMPTY_SIZE;
}

function syncViewportSize() {
  const next = readViewportSize();
  if (next.width === viewportSize.width && next.height === viewportSize.height) return;
  viewportSize = next;
  for (const listener of viewportListeners) listener();
}

function bindViewport() {
  if (viewportBound || Platform.OS !== 'web' || typeof window === 'undefined') return;
  viewportBound = true;
  viewportSize = readViewportSize();
  window.visualViewport?.addEventListener('resize', syncViewportSize);
  window.visualViewport?.addEventListener('scroll', syncViewportSize);
  window.addEventListener('resize', syncViewportSize);
}

function unbindViewport() {
  if (!viewportBound || typeof window === 'undefined') return;
  viewportBound = false;
  window.visualViewport?.removeEventListener('resize', syncViewportSize);
  window.visualViewport?.removeEventListener('scroll', syncViewportSize);
  window.removeEventListener('resize', syncViewportSize);
}

function subscribeViewport(listener: () => void): () => void {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return () => undefined;
  viewportListeners.add(listener);
  bindViewport();
  return () => {
    viewportListeners.delete(listener);
    if (viewportListeners.size === 0) unbindViewport();
  };
}

function getViewportSnapshot(): WindowSize {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return EMPTY_SIZE;
  if (!viewportBound) {
    const current = readViewportSize();
    if (current.width !== viewportSize.width || current.height !== viewportSize.height) {
      viewportSize = current;
    }
  }
  return viewportSize;
}

function getServerViewportSnapshot(): WindowSize {
  return EMPTY_SIZE;
}

function useVisualWindow(): WindowSize {
  const windowSize = useWindowDimensions();
  const visual = useSyncExternalStore(subscribeViewport, getViewportSnapshot, getServerViewportSnapshot);
  if (Platform.OS !== 'web') return windowSize;
  return visual.width > 0 && visual.height > 0 ? visual : windowSize;
}

export type LayoutMetrics = StageMetrics & {
  /** Phone column slots. Null when the board sits beside the side panel. */
  slots: PhoneSlots | null;
};

export function useLayout(): LayoutMetrics {
  const { width, height } = useVisualWindow();
  const insets = useScreenInsets();
  const metrics = stageMetrics(width, height, insets.top, insets.bottom);
  const slots = metrics.phone ? phoneSlots(metrics.contentHeight, metrics.boardWidth, metrics.turnRow) : null;
  return { ...metrics, slots };
}
