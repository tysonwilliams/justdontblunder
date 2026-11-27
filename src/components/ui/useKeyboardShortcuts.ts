import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

export type ShortcutMap = Record<string, (() => void) | undefined>;

function isTypingTarget(target: EventTarget | null): boolean {
  if (!target || typeof target !== 'object') return false;
  const el = target as { tagName?: string; isContentEditable?: boolean };
  if (el.isContentEditable) return true;
  const tag = (el.tagName ?? '').toUpperCase();
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}

/**
 * Web keyboard shortcut listener. Keys are matched by `event.key` (case-insensitive for letters,
 * e.g. 'Enter', ' ', 'Escape', 'ArrowLeft', 'ArrowRight', 'h', 'r', '1', '2').
 * Automatically ignores events while typing in inputs or when Ctrl/Meta/Alt is held.
 */
export function useKeyboardShortcuts(handlers: ShortcutMap, enabled = true): void {
  const ref = useRef(handlers);
  ref.current = handlers;

  useEffect(() => {
    if (!enabled || Platform.OS !== 'web' || typeof window === 'undefined') return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
      if (isTypingTarget(event.target) && event.key !== 'Escape') return;
      const map = ref.current;
      const direct = map[event.key];
      const lower = event.key.length === 1 ? map[event.key.toLowerCase()] : undefined;
      const fn = direct ?? lower;
      if (!fn) return;
      event.preventDefault();
      fn();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [enabled]);
}
