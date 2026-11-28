import type { AccessibilityState } from 'react-native';

type ControlRole = 'button' | 'tab' | 'link';

/**
 * Native screen readers read the accessibility* props. React Native Web
 * forwards aria-label, aria-pressed, aria-selected, and aria-live, and drops
 * accessibilityState, so both are set.
 */
export function controlA11y(role: ControlRole, label: string, selected?: boolean) {
  if (role === 'link') {
    return {
      accessibilityRole: role,
      accessibilityLabel: label,
      'aria-label': label,
    };
  }
  if (role === 'tab') {
    const isSelected = Boolean(selected);
    const state: AccessibilityState = { selected: isSelected };
    return {
      accessibilityRole: role,
      accessibilityLabel: label,
      accessibilityState: state,
      'aria-label': label,
      'aria-selected': isSelected,
    };
  }
  if (selected === undefined) {
    return {
      accessibilityRole: role,
      accessibilityLabel: label,
      'aria-label': label,
    };
  }
  const state: AccessibilityState = { selected };
  return {
    accessibilityRole: role,
    accessibilityLabel: label,
    accessibilityState: state,
    'aria-label': label,
    'aria-pressed': selected,
  };
}

export function switchA11y(label: string, checked: boolean) {
  const state: AccessibilityState = { checked };
  return {
    accessibilityRole: 'switch' as const,
    accessibilityLabel: label,
    accessibilityState: state,
    'aria-label': label,
    'aria-checked': checked,
  };
}

export function liveA11y() {
  return {
    accessibilityLiveRegion: 'polite' as const,
    'aria-live': 'polite' as const,
  };
}

/** Square names stay on a view. A button role would turn the square into a <button>. */
export function squareA11y(label: string, selected: boolean) {
  const state: AccessibilityState = { selected };
  return {
    accessibilityLabel: label,
    accessibilityState: state,
    'aria-label': label,
    'aria-selected': selected,
  };
}
