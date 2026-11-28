import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

/** Return `false` to indicate the shortcut did not apply in the current state (skips preventDefault). */
export type ShortcutHandler = () => boolean | void;
export type ShortcutMap = Record<string, ShortcutHandler | undefined>;

export type ShortcutOptions = {
  /**
   * Mark this listener as belonging to an open Modal/Sheet/Dialog.
   * While any modal listener is active, non-modal screen shortcuts are suppressed.
   */
  modal?: boolean;
};

let openModalCount = 0;

function isTypingTarget(target: EventTarget | null): boolean {
  if (!target || typeof target !== 'object') return false;
  const el = target as { tagName?: string; isContentEditable?: boolean };
  if (el.isContentEditable) return true;
  const tag = (el.tagName ?? '').toUpperCase();
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}

function isInteractiveTarget(target: EventTarget | null): boolean {
  if (!target || typeof target !== 'object') return false;
  const el = target as {
    tagName?: string;
    getAttribute?: (name: string) => string | null;
    closest?: (selector: string) => unknown;
  };
  const tag = (el.tagName ?? '').toUpperCase();
  if (tag === 'BUTTON' || tag === 'A') return true;
  const role = el.getAttribute?.('role');
  if (role === 'button' || role === 'link' || role === 'tab' || role === 'switch' || role === 'checkbox') {
    return true;
  }
  if (typeof el.closest === 'function') {
    return Boolean(el.closest('button, a, [role="button"], [role="link"], [role="tab"], [role="switch"]'));
  }
  return false;
}

/**
 * Web keyboard shortcut listener. Keys are matched by `event.key` (case-insensitive for letters,
 * e.g. 'Enter', ' ', 'Escape', 'ArrowLeft', 'ArrowRight', 'h', 'r', '1', '2').
 * Automatically ignores events while typing in inputs, skips Enter/Space on focused buttons/links,
 * suppresses background screen shortcuts while any modal is open, and ignores Ctrl/Meta/Alt combos.
 */
export function useKeyboardShortcuts(
  handlers: ShortcutMap,
  enabled = true,
  options: ShortcutOptions = {},
): void {
  const ref = useRef(handlers);
  ref.current = handlers;
  const isModal = Boolean(options.modal);

  useEffect(() => {
    if (!enabled || !isModal || Platform.OS !== 'web' || typeof window === 'undefined') return;
    openModalCount += 1;
    return () => {
      openModalCount = Math.max(0, openModalCount - 1);
    };
  }, [enabled, isModal]);

  useEffect(() => {
    if (!enabled || Platform.OS !== 'web' || typeof window === 'undefined') return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
      if (!isModal && openModalCount > 0) return;
      if (isTypingTarget(event.target) && event.key !== 'Escape') return;
      if ((event.key === 'Enter' || event.key === ' ') && isInteractiveTarget(event.target)) return;
      const map = ref.current;
      const direct = map[event.key];
      const lower = event.key.length === 1 ? map[event.key.toLowerCase()] : undefined;
      const fn = direct ?? lower;
      if (!fn) return;
      const result = fn();
      if (result !== false) {
        event.preventDefault();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [enabled, isModal]);
}
